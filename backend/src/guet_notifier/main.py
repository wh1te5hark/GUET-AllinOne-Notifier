import logging
import json

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from guet_notifier.auth import (
    CasAuthError,
    complete_wechat_2fa,
    initiate_wechat_2fa,
    issue_session_token,
    login_with_cas,
    poll_wechat_2fa_status,
    require_user_by_token,
    send_sms_code_for_cas_2fa,
    upsert_user_with_cookies,
    verify_cas_2fa,
)
from guet_notifier.db import Base, engine, get_db_session
from guet_notifier.models import Credential, UserProfile
from guet_notifier.schemas import (
    Cas2FAChallengeRequest,
    Cas2FASendCodeResponse,
    Cas2FAVerifyRequest,
    Cas2FAWeChatInitResponse,
    Cas2FAWeChatStatusResponse,
    CasLoginRequest,
    CookieItem,
    LoginResponse,
    MeResponse,
    ProfileUpdateRequest,
    ProfileUpdateResponse,
)
from guet_notifier.settings import settings

Base.metadata.create_all(bind=engine)

if settings.environment.lower() in {"dev", "development", "local"}:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    logging.getLogger("guet_notifier").setLevel(logging.INFO)

app = FastAPI(
    title="GUET-AllinOne-Notifier",
    description="适用于桂林电子科技大学的消息全能推送平台",
    version="0.1.0",
)

logger = logging.getLogger("guet_notifier.main")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _build_login_response(
    db: Session,
    student_id: str,
    redirect_url: str,
    cookies: list[dict[str, str]],
) -> LoginResponse:
    user = upsert_user_with_cookies(db, student_id=student_id, cookies=cookies)
    access_token = issue_session_token(db, user.id)
    return LoginResponse(
        access_token=access_token,
        student_id=user.student_id,
        cas_redirect_url=redirect_url,
        requires_2fa=False,
        cas_cookies=[
            CookieItem(
                name=c["name"],
                value=c["value"],
                domain=c.get("domain", ""),
                path=c.get("path", "/"),
            )
            for c in cookies
        ],
    )


def _get_or_create_profile(db: Session, user_id: int) -> UserProfile:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user_id))
    if profile is None:
        profile = UserProfile(user_id=user_id, avatar_base64="")
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "guet-notifier", "docs": "/docs"}


@app.post("/api/v1/auth/cas/login", response_model=LoginResponse)
async def cas_login(
    payload: CasLoginRequest,
    db: Session = Depends(get_db_session),
) -> LoginResponse:
    if settings.environment.lower() in {"dev", "development", "local"}:
        logger.info("Received CAS login request for student_id=%s***", payload.student_id[:2])
    try:
        login_result = await login_with_cas(payload.student_id, payload.password)
    except CasAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if login_result.requires_2fa:
        return LoginResponse(
            student_id=login_result.student_id,
            cas_redirect_url=login_result.redirect_url,
            requires_2fa=True,
            challenge_id=login_result.challenge_id,
            challenge_expires_in=300,
            code_field_candidates=login_result.code_field_candidates or [],
            available_2fa_methods=login_result.available_2fa_methods or [],
            message="CAS 需要二次验证",
        )

    return _build_login_response(
        db, login_result.student_id, login_result.redirect_url, login_result.cookies,
    )


@app.post("/api/v1/auth/cas/2fa/verify", response_model=LoginResponse)
async def cas_verify_2fa(
    payload: Cas2FAVerifyRequest,
    db: Session = Depends(get_db_session),
) -> LoginResponse:
    try:
        result = await verify_cas_2fa(challenge_id=payload.challenge_id, code=payload.code)
    except CasAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _build_login_response(db, result.student_id, result.redirect_url, result.cookies)


@app.post("/api/v1/auth/cas/2fa/sms/send", response_model=Cas2FASendCodeResponse)
async def cas_2fa_send_sms_code(payload: Cas2FAChallengeRequest) -> Cas2FASendCodeResponse:
    try:
        message = await send_sms_code_for_cas_2fa(payload.challenge_id)
    except CasAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return Cas2FASendCodeResponse(challenge_id=payload.challenge_id, message=message)


@app.post("/api/v1/auth/cas/2fa/wechat/init", response_model=Cas2FAWeChatInitResponse)
async def cas_2fa_wechat_init(payload: Cas2FAChallengeRequest) -> Cas2FAWeChatInitResponse:
    try:
        qr_image_url, wechat_uuid = await initiate_wechat_2fa(payload.challenge_id)
    except CasAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return Cas2FAWeChatInitResponse(
        challenge_id=payload.challenge_id,
        qr_image_url=qr_image_url,
        wechat_uuid=wechat_uuid,
        message="请使用微信扫描二维码",
    )


@app.post("/api/v1/auth/cas/2fa/wechat/poll", response_model=Cas2FAWeChatStatusResponse)
async def cas_2fa_wechat_poll(
    payload: Cas2FAChallengeRequest,
    db: Session = Depends(get_db_session),
) -> Cas2FAWeChatStatusResponse:
    try:
        result = await poll_wechat_2fa_status(payload.challenge_id)
    except CasAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    poll_status = result["status"]
    poll_message = result["message"]

    if poll_status == "confirmed":
        wx_code = result.get("wx_code", "")
        try:
            login_result = await complete_wechat_2fa(payload.challenge_id, wx_code)
        except CasAuthError as exc:
            return Cas2FAWeChatStatusResponse(
                challenge_id=payload.challenge_id,
                status="error",
                message=str(exc),
            )
        login_resp = _build_login_response(
            db, login_result.student_id, login_result.redirect_url, login_result.cookies,
        )
        return Cas2FAWeChatStatusResponse(
            challenge_id=payload.challenge_id,
            status="confirmed",
            message="微信扫码认证成功",
            login_result=login_resp,
        )

    return Cas2FAWeChatStatusResponse(
        challenge_id=payload.challenge_id,
        status=poll_status,
        message=poll_message,
    )


@app.get("/api/v1/me", response_model=MeResponse)
def get_me(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db_session),
) -> MeResponse:
    token = authorization.removeprefix("Bearer ") if authorization else None
    user = require_user_by_token(db, token)
    profile = _get_or_create_profile(db, user.id)
    return MeResponse(
        id=user.id,
        student_id=user.student_id,
        display_name=user.display_name,
        avatar_base64=profile.avatar_base64 or "",
    )


@app.put("/api/v1/profile", response_model=ProfileUpdateResponse)
def update_profile(
    payload: ProfileUpdateRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db_session),
) -> ProfileUpdateResponse:
    token = authorization.removeprefix("Bearer ") if authorization else None
    user = require_user_by_token(db, token)
    profile = _get_or_create_profile(db, user.id)

    user.display_name = payload.display_name.strip()
    profile.avatar_base64 = payload.avatar_base64.strip()
    db.commit()
    db.refresh(user)
    db.refresh(profile)
    return ProfileUpdateResponse(
        id=user.id,
        student_id=user.student_id,
        display_name=user.display_name,
        avatar_base64=profile.avatar_base64 or "",
    )


@app.get("/api/v1/me/cookies", response_model=list[CookieItem])
def get_my_cookies(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db_session),
) -> list[CookieItem]:
    token = authorization.removeprefix("Bearer ") if authorization else None
    user = require_user_by_token(db, token)
    credential = db.scalar(
        select(Credential).where(
            Credential.user_id == user.id,
            Credential.kind == "cas_cookie",
        )
    )
    if credential is None or not credential.cookie_jar_json:
        return []
    try:
        payload = json.loads(credential.cookie_jar_json)
    except json.JSONDecodeError:
        return []
    cookies = [
        CookieItem(
            name=str(c.get("name", "")),
            value=str(c.get("value", "")),
            domain=str(c.get("domain", "")),
            path=str(c.get("path", "/")),
        )
        for c in payload
        if isinstance(c, dict)
    ]
    return cookies
