import logging
import json
import re
from datetime import UTC, datetime

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Response, status
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
from guet_notifier.forwarding import forward_notifications_for_user
from guet_notifier.models import (
    CollectorSetting,
    Credential,
    NotificationItem,
    SubscriptionRule,
    TestPusherDelivery,
    UserProfile,
)
from guet_notifier import registry as app_registry
from guet_notifier.registry import TEST_COLLECTOR_SOURCE
from guet_notifier.schemas import (
    CasCookieLoginRequest,
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
    RuleConfigPayload,
    RuleCreateRequest,
    RuleResponse,
    RuleUpdateRequest,
    CatalogItemResponse,
    TestPusherDeliveryResponse,
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
    try:
        rule_columns = {col["name"] for col in inspector.get_columns("subscription_rules")}
    except Exception:
        rule_columns = set()
    if rule_columns:
        with engine.begin() as conn:
            if "rule_config_json" not in rule_columns:
                conn.execute(text("ALTER TABLE subscription_rules ADD COLUMN rule_config_json TEXT DEFAULT '{}'"))
                if "config_json" in rule_columns:
                    conn.execute(
                        text(
                            """
                            UPDATE subscription_rules
                            SET rule_config_json = config_json
                            WHERE (rule_config_json IS NULL OR rule_config_json = '')
                              AND config_json IS NOT NULL
                            """
                        )
                    )
                elif "rule_config" in rule_columns:
                    conn.execute(
                        text(
                            """
                            UPDATE subscription_rules
                            SET rule_config_json = rule_config
                            WHERE (rule_config_json IS NULL OR rule_config_json = '')
                              AND rule_config IS NOT NULL
                            """
                        )
                    )
            if "rule_config" not in rule_columns:
                conn.execute(text("ALTER TABLE subscription_rules ADD COLUMN rule_config TEXT DEFAULT '{}'"))
                conn.execute(
                    text(
                        """
                        UPDATE subscription_rules
                        SET rule_config = rule_config_json
                        WHERE (rule_config IS NULL OR rule_config = '')
                          AND rule_config_json IS NOT NULL
                        """
                    )
                )
            if "created_at" not in rule_columns:
                conn.execute(text("ALTER TABLE subscription_rules ADD COLUMN created_at DATETIME"))
                conn.execute(
                    text(
                        """
                        UPDATE subscription_rules
                        SET created_at = CURRENT_TIMESTAMP
                        WHERE created_at IS NULL
                        """
                    )
                )
            if "updated_at" not in rule_columns:
                conn.execute(text("ALTER TABLE subscription_rules ADD COLUMN updated_at DATETIME"))
                conn.execute(
                    text(
                        """
                        UPDATE subscription_rules
                        SET updated_at = CURRENT_TIMESTAMP
                        WHERE updated_at IS NULL
                        """
                    )
                )


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


def _list_notifications_for_source(
    db: Session,
    *,
    user_id: int,
    source: str,
    q: str,
    sender: str,
    read_state: str,
    sort_by: str,
    sort_dir: str,
) -> list[NotificationItem]:
    stmt = select(NotificationItem).where(
        NotificationItem.user_id == user_id,
        NotificationItem.source == source,
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

    return list(db.scalars(stmt.limit(200)).all())


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


def _to_rule_schema(rule: SubscriptionRule) -> RuleResponse:
    config_data: dict = {}
    raw_config_json = rule.rule_config_json or rule.rule_config
    if raw_config_json:
        try:
            parsed = json.loads(raw_config_json)
            if isinstance(parsed, dict):
                config_data = parsed
        except json.JSONDecodeError:
            config_data = {}
    return RuleResponse(
        id=rule.id,
        name=rule.name,
        enabled=rule.enabled,
        config=RuleConfigPayload.model_validate(config_data or {}),
        created_at=rule.created_at.isoformat(),
        updated_at=rule.updated_at.isoformat(),
    )


def _dump_rule_config(config: RuleConfigPayload) -> str:
    dumped = config.model_dump()
    mode = str((dumped.get("match") or {}).get("mode") or "all").strip().lower()
    if mode == "keyword":
        dumped["match"]["mode"] = "any"
    elif mode not in {"all", "any"}:
        dumped["match"]["mode"] = "all"
    return json.dumps(dumped, ensure_ascii=False)


def _validate_rule_config(config: RuleConfigPayload) -> None:
    mode = str(config.match.mode or "").strip().lower()
    if mode not in {"all", "any", "keyword"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="match.mode 仅支持 all / any / keyword")
    collector_keys = {c["key"] for c in app_registry.list_collectors()}
    for src in config.sources:
        sk = str(src).strip()
        if sk and sk not in collector_keys:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"未知采集器来源: {sk}，请从系统提供的采集器列表中选择。",
            )
    pusher_keys = {p["key"] for p in app_registry.list_pushers()}
    channel_keys = [str(k).strip() for k in config.channel_keys if str(k).strip()]
    if not channel_keys:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="至少选择一个推送渠道。",
        )
    for k in channel_keys:
        if k not in pusher_keys:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"未知推送渠道: {k}，请从系统提供的推送器列表中选择。",
            )
    if not config.match.use_regex:
        return
    patterns = [*config.match.include_any, *config.match.exclude_any]
    for pattern in patterns:
        try:
            re.compile(str(pattern))
        except re.error as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"正则表达式无效：{pattern} ({exc})",
            ) from exc


def _parse_cookie_text(cookie_text: str) -> list[dict[str, str]]:
    cookies: list[dict[str, str]] = []
    normalized_text = cookie_text.replace("\r", ";").replace("\n", ";")
    for segment in normalized_text.split(";"):
        pair = segment.strip()
        if not pair or "=" not in pair:
            continue
        name, value = pair.split("=", 1)
        name = name.strip()
        value = value.strip()
        if not name:
            continue
        cookies.append(
            {
                "name": name,
                "value": value,
                "domain": ".guet.edu.cn",
                "path": "/",
            }
        )
    return cookies


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


@app.post("/api/v1/auth/cas/cookie-login", response_model=LoginResponse)
async def cas_cookie_login(
    payload: CasCookieLoginRequest,
    db: Session = Depends(get_db_session),
) -> LoginResponse:
    cookies = _parse_cookie_text(payload.cookie_text)
    if not cookies:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cookies 格式无效，请使用 name=value; name2=value2 的格式。",
        )
    try:
        login_info = await fetch_login_info(cookies)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cookies 无法用于访问智慧校园，请检查是否过期：{exc}",
        ) from exc
    student_id = (login_info.login_name or "").strip()
    if not student_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cookies 校验通过但未识别到学号，请更换 Cookies 重试。",
        )
    return _build_login_response(
        db=db,
        student_id=student_id,
        redirect_url="cookie_login",
        cookies=cookies,
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


@app.get("/api/v1/rules", response_model=list[RuleResponse])
def list_rules(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db_session),
) -> list[RuleResponse]:
    token = authorization.removeprefix("Bearer ") if authorization else None
    user = require_user_by_token(db, token)
    rules = db.scalars(
        select(SubscriptionRule)
        .where(SubscriptionRule.user_id == user.id)
        .order_by(SubscriptionRule.updated_at.desc(), SubscriptionRule.id.desc())
    ).all()
    return [_to_rule_schema(rule) for rule in rules]


@app.post("/api/v1/rules", response_model=RuleResponse, status_code=status.HTTP_201_CREATED)
def create_rule(
    payload: RuleCreateRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db_session),
) -> RuleResponse:
    token = authorization.removeprefix("Bearer ") if authorization else None
    user = require_user_by_token(db, token)
    _validate_rule_config(payload.config)
    rule = SubscriptionRule(
        user_id=user.id,
        name=payload.name.strip(),
        enabled=payload.enabled,
        rule_config=_dump_rule_config(payload.config),
        rule_config_json=_dump_rule_config(payload.config),
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _to_rule_schema(rule)


@app.put("/api/v1/rules/{rule_id}", response_model=RuleResponse)
def update_rule(
    rule_id: int,
    payload: RuleUpdateRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db_session),
) -> RuleResponse:
    token = authorization.removeprefix("Bearer ") if authorization else None
    user = require_user_by_token(db, token)
    rule = db.scalar(
        select(SubscriptionRule).where(
            SubscriptionRule.id == rule_id,
            SubscriptionRule.user_id == user.id,
        )
    )
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="规则不存在")
    _validate_rule_config(payload.config)
    rule.name = payload.name.strip()
    rule.enabled = payload.enabled
    rule.rule_config = _dump_rule_config(payload.config)
    rule.rule_config_json = _dump_rule_config(payload.config)
    db.commit()
    db.refresh(rule)
    return _to_rule_schema(rule)


@app.delete("/api/v1/rules/{rule_id}")
def delete_rule(
    rule_id: int,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db_session),
) -> Response:
    token = authorization.removeprefix("Bearer ") if authorization else None
    user = require_user_by_token(db, token)
    rule = db.scalar(
        select(SubscriptionRule).where(
            SubscriptionRule.id == rule_id,
            SubscriptionRule.user_id == user.id,
        )
    )
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="规则不存在")
    db.delete(rule)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/v1/meta/collectors", response_model=list[CatalogItemResponse])
def list_collector_catalog() -> list[CatalogItemResponse]:
    return [CatalogItemResponse(**item) for item in app_registry.list_collectors()]


@app.get("/api/v1/meta/pushers", response_model=list[CatalogItemResponse])
def list_pusher_catalog() -> list[CatalogItemResponse]:
    return [CatalogItemResponse(**item) for item in app_registry.list_pushers()]


@app.get("/api/v1/pushers/test-deliveries", response_model=list[TestPusherDeliveryResponse])
def list_test_pusher_deliveries(
    limit: int = Query(default=50, ge=1, le=200),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db_session),
) -> list[TestPusherDeliveryResponse]:
    token = authorization.removeprefix("Bearer ") if authorization else None
    user = require_user_by_token(db, token)
    rows = db.scalars(
        select(TestPusherDelivery)
        .where(TestPusherDelivery.user_id == user.id)
        .order_by(TestPusherDelivery.id.desc())
        .limit(limit)
    ).all()
    return [
        TestPusherDeliveryResponse(
            id=r.id,
            rule_id=r.rule_id,
            notification_item_id=r.notification_item_id,
            title=r.title,
            subject=r.subject,
            body=r.body,
            source=r.source,
            external_id=r.external_id,
            created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]


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
    synced_items: list[NotificationItem] = []
    push_success_count = 0
    push_failed_count = 0
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
        db.flush()
        synced_items.append(item)
        try:
            if await mark_message_read(cookies, external_id):
                item.is_marked_read = True
                marked_read_count += 1
        except Exception:
            # 标记已读失败不影响采集主流程
            pass
    push_success_count, push_failed_count = forward_notifications_for_user(
        db,
        user_id=user.id,
        collector_key="smart_campus",
        items=synced_items,
    )
    db.commit()
    if push_success_count or push_failed_count:
        logger.info(
            "Rules executed for user_id=%s collector=%s: push_success=%s push_failed=%s",
            user.id,
            "smart_campus",
            push_success_count,
            push_failed_count,
        )

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


@app.post("/api/v1/collectors/test/messages/sync", response_model=SmartCampusSyncResponse)
def sync_test_collector_messages(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db_session),
) -> SmartCampusSyncResponse:
    """Inject synthetic NotificationItem rows and run rule forwarding (no CAS cookies)."""
    token = authorization.removeprefix("Bearer ") if authorization else None
    user = require_user_by_token(db, token)
    now = datetime.now(UTC)
    ts = int(now.timestamp() * 1000)
    messages: list[dict] = [
        {
            "external_id": f"{TEST_COLLECTOR_SOURCE}-{ts}-homework",
            "title": "[测试采集器] 作业提醒（联调）",
            "sender": "测试采集器",
            "content_text": "联调通知：包含关键字「作业」「软件工程」，可用于匹配规则。",
            "content_html": "",
            "occurred_at_text": now.strftime("%Y-%m-%d %H:%M"),
            "raw": {"collector": TEST_COLLECTOR_SOURCE, "kind": "homework"},
        },
        {
            "external_id": f"{TEST_COLLECTOR_SOURCE}-{ts}-bill",
            "title": "[测试采集器] 电费账单",
            "sender": "测试采集器",
            "content_text": "联调通知：电费账单提醒。",
            "content_html": "",
            "occurred_at_text": now.strftime("%Y-%m-%d %H:%M"),
            "raw": {"collector": TEST_COLLECTOR_SOURCE, "kind": "bill"},
        },
    ]
    saved_count = 0
    synced_items: list[NotificationItem] = []
    for msg in messages:
        ext = msg["external_id"]
        item = db.scalar(
            select(NotificationItem).where(
                NotificationItem.user_id == user.id,
                NotificationItem.source == TEST_COLLECTOR_SOURCE,
                NotificationItem.external_id == ext,
            )
        )
        if item is None:
            item = NotificationItem(
                user_id=user.id,
                source=TEST_COLLECTOR_SOURCE,
                external_id=ext,
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
        db.flush()
        synced_items.append(item)

    push_success_count, push_failed_count = forward_notifications_for_user(
        db,
        user_id=user.id,
        collector_key=TEST_COLLECTOR_SOURCE,
        items=synced_items,
    )
    db.commit()
    if push_success_count or push_failed_count:
        logger.info(
            "Rules executed for user_id=%s collector=%s: push_success=%s push_failed=%s",
            user.id,
            TEST_COLLECTOR_SOURCE,
            push_success_count,
            push_failed_count,
        )

    latest = db.scalars(
        select(NotificationItem)
        .where(
            NotificationItem.user_id == user.id,
            NotificationItem.source == TEST_COLLECTOR_SOURCE,
        )
        .order_by(NotificationItem.fetched_at.desc(), NotificationItem.id.desc())
        .limit(20)
    ).all()
    return SmartCampusSyncResponse(
        fetched_count=len(messages),
        saved_count=saved_count,
        marked_read_count=0,
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
    rows = _list_notifications_for_source(
        db,
        user_id=user.id,
        source="smart_campus",
        q=q,
        sender=sender,
        read_state=read_state,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    return [_to_message_schema(item) for item in rows]


@app.get("/api/v1/collectors/test/messages", response_model=list[SmartCampusMessageItem])
def list_test_collector_messages(
    q: str = Query(default="", max_length=128),
    sender: str = Query(default="", max_length=64),
    read_state: str = Query(default="all"),
    sort_by: str = Query(default="fetched_at"),
    sort_dir: str = Query(default="desc"),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db_session),
) -> list[SmartCampusMessageItem]:
    token = authorization.removeprefix("Bearer ") if authorization else None
    user = require_user_by_token(db, token)
    rows = _list_notifications_for_source(
        db,
        user_id=user.id,
        source=TEST_COLLECTOR_SOURCE,
        q=q,
        sender=sender,
        read_state=read_state,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
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
