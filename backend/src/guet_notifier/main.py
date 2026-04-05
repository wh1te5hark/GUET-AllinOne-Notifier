import logging
import json
from datetime import UTC, datetime

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc, inspect, select, text
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
from guet_notifier.collector_pcportal import (
    fetch_login_info,
    fetch_receive_box_messages,
    mark_message_read,
)
from guet_notifier.db import Base, engine, get_db_session
from guet_notifier.models import CollectorSetting, Credential, NotificationItem, UserProfile
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
    SmartCampusMessageItem,
    SmartCampusCollectorSetting,
    SmartCampusProfileResponse,
    SmartCampusSyncResponse,
)
from guet_notifier.settings import settings

Base.metadata.create_all(bind=engine)


def _ensure_schema_columns() -> None:
    inspector = inspect(engine)
    try:
        user_columns = {col["name"] for col in inspector.get_columns("users")}
    except Exception:
        user_columns = set()
    if "real_name" not in user_columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN real_name VARCHAR(128) DEFAULT ''"))
    try:
        notif_columns = {col["name"] for col in inspector.get_columns("notification_items")}
    except Exception:
        notif_columns = set()
    if notif_columns and "is_marked_read" not in notif_columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE notification_items ADD COLUMN is_marked_read BOOLEAN DEFAULT 0"))


_ensure_schema_columns()

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


def _load_user_cookies_payload(db: Session, user_id: int) -> list[dict]:
    credential = db.scalar(
        select(Credential).where(
            Credential.user_id == user_id,
            Credential.kind == "cas_cookie",
        )
    )
    if credential is None or not credential.cookie_jar_json:
        return []
    try:
        payload = json.loads(credential.cookie_jar_json)
    except json.JSONDecodeError:
        return []
    return [c for c in payload if isinstance(c, dict)]


def _to_message_schema(item: NotificationItem) -> SmartCampusMessageItem:
    return SmartCampusMessageItem(
        id=item.id,
        source=item.source,
        external_id=item.external_id,
        title=item.title,
        sender=item.sender,
        content_text=item.content_text,
        content_html=item.content_html,
        occurred_at_text=item.occurred_at_text,
        is_marked_read=item.is_marked_read,
        fetched_at=item.fetched_at.isoformat(),
    )


def _get_or_create_smart_campus_setting(db: Session, user_id: int) -> CollectorSetting:
    setting = db.scalar(
        select(CollectorSetting).where(
            CollectorSetting.user_id == user_id,
            CollectorSetting.collector_key == "smart_campus",
        )
    )
    if setting is None:
        setting = CollectorSetting(
            user_id=user_id,
            collector_key="smart_campus",
            enabled=True,
            schedule_mode="visual",
            cron_expr="*/30 * * * *",
            visual_mode="every_n_minutes",
            interval_minutes=30,
            daily_time="08:00",
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


def _to_setting_schema(setting: CollectorSetting) -> SmartCampusCollectorSetting:
    return SmartCampusCollectorSetting(
        enabled=setting.enabled,
        schedule_mode=setting.schedule_mode,
        cron_expr=setting.cron_expr,
        visual_mode=setting.visual_mode,
        interval_minutes=setting.interval_minutes,
        daily_time=setting.daily_time,
    )


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
        real_name=user.real_name or "",
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
        real_name=user.real_name or "",
        avatar_base64=profile.avatar_base64 or "",
    )


@app.get("/api/v1/me/cookies", response_model=list[CookieItem])
def get_my_cookies(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db_session),
) -> list[CookieItem]:
    token = authorization.removeprefix("Bearer ") if authorization else None
    user = require_user_by_token(db, token)
    payload = _load_user_cookies_payload(db, user.id)
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


@app.post("/api/v1/collectors/smart-campus/profile/sync", response_model=SmartCampusProfileResponse)
async def sync_smart_campus_profile(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db_session),
) -> SmartCampusProfileResponse:
    token = authorization.removeprefix("Bearer ") if authorization else None
    user = require_user_by_token(db, token)
    cookies = _load_user_cookies_payload(db, user.id)
    if not cookies:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未找到可用 CAS Cookies，请先重新登录。",
        )
    try:
        info = await fetch_login_info(cookies)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"拉取智慧校园用户信息失败：{exc}",
        ) from exc

    real_name = info.user_name.strip()
    if real_name:
        user.real_name = real_name
        db.commit()
        db.refresh(user)

    return SmartCampusProfileResponse(
        student_id=user.student_id,
        login_name=info.login_name or user.student_id,
        real_name=user.real_name or info.user_name,
        display_name=user.display_name or "",
        user_pic=info.user_pic,
    )


@app.post("/api/v1/collectors/smart-campus/messages/sync", response_model=SmartCampusSyncResponse)
async def sync_smart_campus_messages(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db_session),
) -> SmartCampusSyncResponse:
    token = authorization.removeprefix("Bearer ") if authorization else None
    user = require_user_by_token(db, token)
    cookies = _load_user_cookies_payload(db, user.id)
    if not cookies:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未找到可用 CAS Cookies，请先重新登录。",
        )
    setting = _get_or_create_smart_campus_setting(db, user.id)
    if not setting.enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="智慧校园采集器已禁用，请先在采集器设置中启用。",
        )
    try:
        messages = await fetch_receive_box_messages(cookies, page=1, rows=20)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"拉取智慧校园通知失败：{exc}",
        ) from exc

    saved_count = 0
    marked_read_count = 0
    for msg in messages:
        external_id = msg["external_id"]
        if not external_id:
            continue
        item = db.scalar(
            select(NotificationItem).where(
                NotificationItem.user_id == user.id,
                NotificationItem.source == "smart_campus",
                NotificationItem.external_id == external_id,
            )
        )
        if item is None:
            item = NotificationItem(
                user_id=user.id,
                source="smart_campus",
                external_id=external_id,
            )
            db.add(item)
            saved_count += 1
        item.title = msg["title"]
        item.sender = msg["sender"]
        item.content_text = msg["content_text"]
        item.content_html = msg["content_html"]
        item.occurred_at_text = msg["occurred_at_text"]
        item.raw_json = json.dumps(msg["raw"], ensure_ascii=False)
        item.fetched_at = datetime.now(UTC)
        try:
            if await mark_message_read(cookies, external_id):
                item.is_marked_read = True
                marked_read_count += 1
        except Exception:
            # 标记已读失败不影响采集主流程
            pass
    db.commit()

    latest = db.scalars(
        select(NotificationItem)
        .where(
            NotificationItem.user_id == user.id,
            NotificationItem.source == "smart_campus",
        )
        .order_by(NotificationItem.fetched_at.desc(), NotificationItem.id.desc())
        .limit(20)
    ).all()
    return SmartCampusSyncResponse(
        fetched_count=len(messages),
        saved_count=saved_count,
        marked_read_count=marked_read_count,
        messages=[_to_message_schema(item) for item in latest],
    )


@app.get("/api/v1/collectors/smart-campus/messages", response_model=list[SmartCampusMessageItem])
def list_smart_campus_messages(
    q: str = Query(default="", max_length=128),
    sender: str = Query(default="", max_length=64),
    read_state: str = Query(default="all"),  # all | read | unread
    sort_by: str = Query(default="fetched_at"),  # fetched_at | occurred_at_text | title | sender
    sort_dir: str = Query(default="desc"),  # asc | desc
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db_session),
) -> list[SmartCampusMessageItem]:
    token = authorization.removeprefix("Bearer ") if authorization else None
    user = require_user_by_token(db, token)
    stmt = select(NotificationItem).where(
        NotificationItem.user_id == user.id,
        NotificationItem.source == "smart_campus",
    )
    if q.strip():
        kw = f"%{q.strip()}%"
        stmt = stmt.where(
            NotificationItem.title.like(kw)
            | NotificationItem.sender.like(kw)
            | NotificationItem.content_text.like(kw)
        )
    if sender.strip():
        stmt = stmt.where(NotificationItem.sender.like(f"%{sender.strip()}%"))
    if read_state == "read":
        stmt = stmt.where(NotificationItem.is_marked_read.is_(True))
    elif read_state == "unread":
        stmt = stmt.where(NotificationItem.is_marked_read.is_(False))

    sortable = {
        "fetched_at": NotificationItem.fetched_at,
        "occurred_at_text": NotificationItem.occurred_at_text,
        "title": NotificationItem.title,
        "sender": NotificationItem.sender,
    }
    sort_column = sortable.get(sort_by, NotificationItem.fetched_at)
    if sort_dir == "asc":
        stmt = stmt.order_by(sort_column.asc(), NotificationItem.id.asc())
    else:
        stmt = stmt.order_by(desc(sort_column), NotificationItem.id.desc())

    rows = db.scalars(stmt.limit(200)).all()
    return [_to_message_schema(item) for item in rows]


@app.get("/api/v1/collectors/smart-campus/settings", response_model=SmartCampusCollectorSetting)
def get_smart_campus_settings(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db_session),
) -> SmartCampusCollectorSetting:
    token = authorization.removeprefix("Bearer ") if authorization else None
    user = require_user_by_token(db, token)
    setting = _get_or_create_smart_campus_setting(db, user.id)
    return _to_setting_schema(setting)


@app.put("/api/v1/collectors/smart-campus/settings", response_model=SmartCampusCollectorSetting)
def update_smart_campus_settings(
    payload: SmartCampusCollectorSetting,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db_session),
) -> SmartCampusCollectorSetting:
    token = authorization.removeprefix("Bearer ") if authorization else None
    user = require_user_by_token(db, token)
    setting = _get_or_create_smart_campus_setting(db, user.id)
    setting.enabled = payload.enabled
    setting.schedule_mode = payload.schedule_mode if payload.schedule_mode in {"visual", "cron"} else "visual"
    setting.cron_expr = payload.cron_expr.strip() or "*/30 * * * *"
    setting.visual_mode = payload.visual_mode if payload.visual_mode in {"every_n_minutes", "daily_time"} else "every_n_minutes"
    setting.interval_minutes = max(1, min(1440, int(payload.interval_minutes)))
    setting.daily_time = (payload.daily_time or "08:00").strip()[:8]
    db.commit()
    db.refresh(setting)
    return _to_setting_schema(setting)
