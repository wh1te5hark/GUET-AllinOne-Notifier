import base64
import json
import logging
import re
import secrets
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import quote

import httpx
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from guet_notifier.models import Credential, SessionToken, User
from guet_notifier.settings import settings

logger = logging.getLogger("guet_notifier.auth")
CHALLENGE_EXPIRES_SECONDS = 300


class CasAuthError(Exception):
    pass


@dataclass(frozen=True)
class CasLoginForm:
    action_path: str
    execution: str
    pwd_encrypt_salt: str
    need_captcha: bool


@dataclass
class PendingCas2FA:
    challenge_id: str
    student_id: str
    action_path: str
    redirect_url: str
    hidden_fields: dict[str, str]
    code_field_candidates: list[str]
    available_reauth_types: list[str]
    reauth_type: str
    is_multifactor: str
    service: str | None
    cookies: list[dict[str, str]]
    created_at: datetime
    wechat_uuid: str | None = None
    wechat_state: str | None = None
    wechat_redirect_uri: str | None = None


@dataclass
class CasLoginResult:
    student_id: str
    redirect_url: str
    cookies: list[dict[str, str]]
    requires_2fa: bool
    challenge_id: str | None = None
    code_field_candidates: list[str] | None = None
    available_2fa_methods: list[str] | None = None


pending_2fa_challenges: dict[str, PendingCas2FA] = {}


def _random_string(length: int) -> str:
    chars = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678"
    return "".join(secrets.choice(chars) for _ in range(length))


def _is_dev_environment() -> bool:
    return settings.environment.lower() in {"dev", "development", "local"}


def _mask_student_id(student_id: str) -> str:
    normalized = student_id.strip()
    if len(normalized) <= 4:
        return "***"
    return f"{normalized[:2]}***{normalized[-2:]}"


def _body_preview(text: str, limit: int = 400) -> str:
    compact = " ".join(text.split())
    if len(compact) <= limit:
        return compact
    return f"{compact[:limit]}...<truncated>"


def _extract_attr(tag: str, attr: str) -> str | None:
    match = re.search(rf'{attr}="([^"]*)"', tag, flags=re.IGNORECASE)
    if match:
        return match.group(1)
    match = re.search(rf"{attr}='([^']*)'", tag, flags=re.IGNORECASE)
    return match.group(1) if match else None


def _cleanup_expired_challenges() -> None:
    now = datetime.now(UTC)
    expired = [
        challenge_id
        for challenge_id, challenge in pending_2fa_challenges.items()
        if now - challenge.created_at > timedelta(seconds=CHALLENGE_EXPIRES_SECONDS)
    ]
    for challenge_id in expired:
        pending_2fa_challenges.pop(challenge_id, None)


def _is_2fa_page(url: str, text: str) -> bool:
    payload = f"{url}\n{text}".lower()
    markers = ["reauthcheck", "reauthloginview", "ismultifactor", "mfa", "2fa", "双因素", "二次验证"]
    return any(marker in payload for marker in markers)


def _extract_2fa_form(
    html: str,
) -> tuple[str | None, dict[str, str], list[str]]:
    form_match = re.search(
        r"<form[^>]*action=(?:\"([^\"]+)\"|'([^']+)')[^>]*>(.*?)</form>",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not form_match:
        # GUET CAS 的 reAuth 页面常由 JS 驱动，没有显式 form。
        # 兜底到已知提交接口，避免误判为“无法解析”。
        if "/reAuthCheck/reAuthSubmit.do" in html:
            return (
                "/authserver/reAuthCheck/reAuthSubmit.do",
                {},
                ["dynamicCode", "otpCode", "code"],
            )
        return None, {}, []

    action_path = form_match.group(1) or form_match.group(2)
    form_html = form_match.group(3) or ""
    hidden_fields: dict[str, str] = {}
    code_fields: list[str] = []
    fallback_candidates = [
        "otpCode",
        "verifyCode",
        "authCode",
        "dynamicCode",
        "mobileCode",
        "emailCode",
        "code",
    ]

    for input_match in re.finditer(r"<input[^>]*>", form_html, flags=re.IGNORECASE):
        tag = input_match.group(0)
        input_name = _extract_attr(tag, "name")
        if not input_name:
            continue
        input_type = (_extract_attr(tag, "type") or "text").lower()
        input_value = _extract_attr(tag, "value") or ""
        if input_type == "hidden":
            hidden_fields[input_name] = input_value
            continue
        if input_type in {"text", "tel", "number", "password"} and input_name not in {
            "username",
            "password",
            "passwordText",
        }:
            code_fields.append(input_name)

    for field in fallback_candidates:
        if field not in code_fields:
            code_fields.append(field)
    return action_path, hidden_fields, code_fields


def _extract_reauth_params(html: str) -> dict[str, str | None]:
    defaults: dict[str, str | None] = {
        "reAuthType": "",
        "isMultifactor": "false",
        "service": None,
    }
    for key in list(defaults.keys()):
        match = re.search(rf'"{key}"\s*:\s*"([^"]*)"', html)
        if match:
            defaults[key] = match.group(1)
            continue
        null_match = re.search(rf'"{key}"\s*:\s*null', html)
        if null_match:
            defaults[key] = None
    return defaults


def _extract_available_reauth_types(html: str) -> list[str]:
    types = re.findall(r'class="dropdown-item changeReAuthTypes"[^>]*id="([^"]+)"', html)
    return [item for item in types if item]


def _map_reauth_type_to_method(reauth_type: str) -> str | None:
    mapping = {
        "3": "sms_code",
        "8": "wechat_qr",
    }
    return mapping.get(reauth_type)


def _add_client_cookies(client: httpx.AsyncClient, cookies: list[dict[str, str]]) -> None:
    for cookie in cookies:
        client.cookies.set(
            cookie["name"],
            cookie["value"],
            domain=cookie.get("domain") or "cas.guet.edu.cn",
            path=cookie.get("path") or "/",
        )


def _is_cas_session_ready(cookies: list[dict[str, str]]) -> bool:
    cookie_names = {cookie["name"].upper() for cookie in cookies}
    return "CASTGC" in cookie_names


def _build_cookie_snapshot(client: httpx.AsyncClient) -> list[dict[str, str]]:
    return [
        {
            "name": cookie.name,
            "value": cookie.value,
            "domain": cookie.domain or "cas.guet.edu.cn",
            "path": cookie.path or "/",
        }
        for cookie in client.cookies.jar
    ]


def _absolute_cas_url(path: str) -> str:
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return f"{settings.cas_base_url.rstrip('/')}/{path.lstrip('/')}"


def _response_json_or_empty(response: httpx.Response) -> dict:
    try:
        payload = response.json()
    except ValueError:
        return {}
    return payload if isinstance(payload, dict) else {}


def encrypt_password(password: str, salt: str) -> str:
    if not salt:
        return password
    key = salt.strip().encode("utf-8")
    iv = _random_string(16).encode("utf-8")
    plaintext = (_random_string(64) + password).encode("utf-8")
    cipher = AES.new(key, AES.MODE_CBC, iv=iv)
    encrypted = cipher.encrypt(pad(plaintext, AES.block_size))
    return base64.b64encode(encrypted).decode("utf-8")


def parse_login_form(html: str) -> CasLoginForm:
    action_marker = 'id="pwdFromId" action="'
    execution_marker = 'id="execution" name="execution" value="'
    salt_marker = 'id="pwdEncryptSalt" value="'
    captcha_marker = 'needCaptcha = "'

    action_start = html.find(action_marker)
    execution_start = html.find(execution_marker)
    salt_start = html.find(salt_marker)
    captcha_start = html.find(captcha_marker)
    if action_start == -1 or execution_start == -1 or salt_start == -1:
        raise CasAuthError("CAS 登录页结构已变化，暂无法解析表单")

    action_start += len(action_marker)
    execution_start += len(execution_marker)
    salt_start += len(salt_marker)
    captcha_start = captcha_start + len(captcha_marker) if captcha_start != -1 else -1

    action_path = html[action_start : html.find('"', action_start)]
    execution = html[execution_start : html.find('"', execution_start)]
    pwd_encrypt_salt = html[salt_start : html.find('"', salt_start)]
    need_captcha_value = (
        html[captcha_start : html.find('"', captcha_start)] if captcha_start != -1 else ""
    )
    return CasLoginForm(
        action_path=action_path,
        execution=execution,
        pwd_encrypt_salt=pwd_encrypt_salt,
        need_captcha=bool(need_captcha_value),
    )


async def login_with_cas(
    student_id: str,
    password: str,
) -> CasLoginResult:
    _cleanup_expired_challenges()
    if _is_dev_environment():
        logger.info(
            "CAS login start: base=%s student_id=%s",
            settings.cas_base_url,
            _mask_student_id(student_id),
        )

    async with httpx.AsyncClient(
        base_url=settings.cas_base_url,
        follow_redirects=True,
        timeout=15.0,
        headers={"User-Agent": "GUET-AllinOne-Notifier/0.1"},
    ) as client:
        login_page = await client.get("/authserver/login")
        if _is_dev_environment():
            logger.info(
                "CAS login page: status=%s final_url=%s body_preview=%s",
                login_page.status_code,
                login_page.url,
                _body_preview(login_page.text),
            )
        if login_page.status_code >= 400:
            raise CasAuthError("CAS 登录页访问失败")

        form = parse_login_form(login_page.text)
        if _is_dev_environment():
            logger.info(
                "CAS form parsed: action=%s execution_len=%s has_salt=%s need_captcha=%s",
                form.action_path,
                len(form.execution),
                bool(form.pwd_encrypt_salt),
                form.need_captcha,
            )
        if form.need_captcha:
            raise CasAuthError("CAS 当前要求验证码，现阶段暂不支持")

        response = await client.post(
            form.action_path,
            data={
                "username": student_id,
                "password": encrypt_password(password, form.pwd_encrypt_salt),
                "passwordText": password,
                "rememberMe": "true",
                "_eventId": "submit",
                "cllt": "userNameLogin",
                "dllt": "generalLogin",
                "lt": "",
                "execution": form.execution,
            },
        )
        if _is_dev_environment():
            logger.info(
                "CAS login submit result: status=%s final_url=%s body_preview=%s",
                response.status_code,
                response.url,
                _body_preview(response.text),
            )
        cookies = _build_cookie_snapshot(client)
        if _is_dev_environment():
            cookie_preview = [{"name": item["name"], "domain": item["domain"]} for item in cookies]
            logger.info("CAS cookie jar: count=%s cookies=%s", len(cookies), cookie_preview)

    if response.status_code >= 400:
        if _is_dev_environment():
            logger.warning("CAS login failed with HTTP status=%s", response.status_code)
        raise CasAuthError("CAS 登录请求失败")

    response_url = str(response.url)
    if _is_2fa_page(response_url, response.text):
        action_path, hidden_fields, code_fields = _extract_2fa_form(response.text)
        if not action_path:
            action_path = "/authserver/reAuthCheck/reAuthSubmit.do"
            code_fields = ["dynamicCode", "otpCode", "code"]
        reauth_params = _extract_reauth_params(response.text)
        available_reauth_types = _extract_available_reauth_types(response.text)
        available_methods = []
        for reauth_type in available_reauth_types:
            method = _map_reauth_type_to_method(reauth_type)
            if method and method not in available_methods:
                available_methods.append(method)
        current_method = _map_reauth_type_to_method((reauth_params.get("reAuthType") or "").strip())
        if current_method and current_method not in available_methods:
            available_methods.append(current_method)
        if not available_methods:
            available_methods = ["sms_code", "wechat_qr"]

        challenge_id = secrets.token_urlsafe(24)
        pending_2fa_challenges[challenge_id] = PendingCas2FA(
            challenge_id=challenge_id,
            student_id=student_id,
            action_path=action_path,
            redirect_url=response_url,
            hidden_fields=hidden_fields,
            code_field_candidates=code_fields,
            available_reauth_types=available_reauth_types,
            reauth_type=(reauth_params.get("reAuthType") or "").strip(),
            is_multifactor=(reauth_params.get("isMultifactor") or "false"),
            service=reauth_params.get("service"),
            cookies=cookies,
            created_at=datetime.now(UTC),
        )
        if _is_dev_environment():
            logger.warning(
                "CAS login requires 2FA: final_url=%s challenge_id=%s code_fields=%s available_types=%s methods=%s",
                response.url,
                challenge_id,
                code_fields,
                available_reauth_types,
                available_methods,
            )
        return CasLoginResult(
            student_id=student_id,
            redirect_url=response_url,
            cookies=cookies,
            requires_2fa=True,
            challenge_id=challenge_id,
            code_field_candidates=code_fields,
            available_2fa_methods=available_methods,
        )

    if "/authserver/login" in response_url and not _is_cas_session_ready(cookies):
        if _is_dev_environment():
            logger.warning("CAS login no cookies returned, likely auth failed")
        raise CasAuthError("CAS 未返回登录 Cookie，可能账号密码错误或触发额外校验")

    return CasLoginResult(
        student_id=student_id,
        redirect_url=response_url,
        cookies=cookies,
        requires_2fa=False,
    )


async def _switch_reauth_type(
    client: httpx.AsyncClient,
    challenge: PendingCas2FA,
    target_type: str,
) -> str:
    response = await client.post(
        "/authserver/reAuthCheck/changeReAuthType.do",
        data={
            "isMultifactor": challenge.is_multifactor,
            "reAuthType": target_type,
            "service": challenge.service or "",
        },
    )
    if response.status_code >= 400:
        raise CasAuthError("切换 2FA 认证方式失败")
    payload = _response_json_or_empty(response)
    if str(payload.get("code", "")) != "1":
        raise CasAuthError(payload.get("message") or "切换 2FA 认证方式失败")
    actual_type = str(payload.get("data", {}).get("reAuthType") or target_type)
    challenge.reauth_type = actual_type
    return actual_type


async def send_sms_code_for_cas_2fa(challenge_id: str) -> str:
    _cleanup_expired_challenges()
    challenge = pending_2fa_challenges.get(challenge_id)
    if challenge is None:
        raise CasAuthError("2FA 挑战不存在或已过期，请重新登录")

    async with httpx.AsyncClient(
        base_url=settings.cas_base_url,
        follow_redirects=False,
        timeout=15.0,
        headers={"User-Agent": "GUET-AllinOne-Notifier/0.1", "Referer": challenge.redirect_url},
    ) as client:
        _add_client_cookies(client, challenge.cookies)
        if challenge.reauth_type != "3":
            await _switch_reauth_type(client, challenge, "3")
        response = await client.post(
            "/authserver/dynamicCode/getDynamicCodeByReauth.do",
            data={
                "userName": challenge.student_id,
                "authCodeTypeName": "reAuthDynamicCodeType",
            },
        )
        if response.status_code >= 400:
            raise CasAuthError("发送短信验证码失败")
        payload = _response_json_or_empty(response)
        if payload.get("res") not in {"success", "wechat_success", "cpdaily_success", "code_time_fail"}:
            raise CasAuthError(payload.get("returnMessage") or "发送短信验证码失败")
        challenge.cookies = _build_cookie_snapshot(client)
        return str(payload.get("returnMessage") or "验证码已发送，请查收")


async def initiate_wechat_2fa(challenge_id: str) -> tuple[str, str]:
    """发起微信扫码 2FA，返回 (qr_image_url, wechat_uuid)。"""
    _cleanup_expired_challenges()
    challenge = pending_2fa_challenges.get(challenge_id)
    if challenge is None:
        raise CasAuthError("2FA 挑战不存在或已过期，请重新登录")

    async with httpx.AsyncClient(
        base_url=settings.cas_base_url,
        follow_redirects=False,
        timeout=15.0,
        headers={"User-Agent": "GUET-AllinOne-Notifier/0.1", "Referer": challenge.redirect_url},
    ) as client:
        _add_client_cookies(client, challenge.cookies)
        if challenge.reauth_type != "8":
            await _switch_reauth_type(client, challenge, "8")
        reauth_flag = "2" if str(challenge.is_multifactor).lower() == "true" else "1"
        query = f"type=weixin&reAuth={reauth_flag}"
        if challenge.service:
            query += f"&success={quote(challenge.service, safe='')}"
        combined_resp = await client.get(f"/authserver/combinedLogin.do?{query}")
        challenge.cookies = _build_cookie_snapshot(client)

    if combined_resp.status_code in (301, 302, 303, 307, 308):
        wechat_page_url = combined_resp.headers.get("location", "")
    else:
        wechat_page_url = ""
        url_in_html = re.search(r'(https?://open\.weixin\.qq\.com[^"\'>\s]+)', combined_resp.text)
        if url_in_html:
            wechat_page_url = url_in_html.group(1)

    if not wechat_page_url or "open.weixin.qq.com" not in wechat_page_url:
        if _is_dev_environment():
            logger.warning(
                "combinedLogin did not redirect to WeChat: status=%s body=%s",
                combined_resp.status_code,
                _body_preview(combined_resp.text),
            )
        raise CasAuthError("CAS 未返回微信扫码页面")

    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=15.0,
        headers={"User-Agent": "Mozilla/5.0"},
    ) as wx_client:
        resp = await wx_client.get(wechat_page_url)
        if resp.status_code >= 400:
            raise CasAuthError("获取微信二维码页面失败")
        html = resp.text
        final_url = str(resp.url)

    uuid_match = re.search(r'src="/connect/qrcode/([^"]+)"', html)
    if not uuid_match:
        raise CasAuthError("无法从微信页面提取二维码")
    wechat_uuid = uuid_match.group(1)

    state_match = re.search(r'[?&]state=([^&"]+)', wechat_page_url) or re.search(
        r'[?&]state=([^&"]+)', final_url
    )
    redirect_match = re.search(r'[?&]redirect_uri=([^&"]+)', wechat_page_url) or re.search(
        r'[?&]redirect_uri=([^&"]+)', final_url
    )

    challenge.wechat_uuid = wechat_uuid
    challenge.wechat_state = state_match.group(1) if state_match else None
    challenge.wechat_redirect_uri = redirect_match.group(1) if redirect_match else None

    if _is_dev_environment():
        logger.info(
            "WeChat 2FA initiated: uuid=%s state=%s",
            wechat_uuid,
            challenge.wechat_state,
        )

    qr_image_url = f"https://open.weixin.qq.com/connect/qrcode/{wechat_uuid}"
    return qr_image_url, wechat_uuid


async def poll_wechat_2fa_status(challenge_id: str) -> dict:
    """轮询微信扫码状态。返回 {status, message, wx_code?}。"""
    _cleanup_expired_challenges()
    challenge = pending_2fa_challenges.get(challenge_id)
    if challenge is None:
        raise CasAuthError("2FA 挑战不存在或已过期，请重新登录")
    if not challenge.wechat_uuid:
        raise CasAuthError("尚未发起微信扫码，请先调用初始化接口")

    poll_url = (
        f"https://long.open.weixin.qq.com/connect/l/qrconnect"
        f"?uuid={challenge.wechat_uuid}&_={int(time.time() * 1000)}"
    )
    async with httpx.AsyncClient(timeout=35.0) as wx_client:
        try:
            resp = await wx_client.get(poll_url)
        except httpx.TimeoutException:
            return {"status": "waiting", "message": "等待扫码中…"}

    text = resp.text
    errcode_match = re.search(r"wx_errcode=(\d+)", text)
    code_match = re.search(r"wx_code='([^']*)'", text)

    errcode = int(errcode_match.group(1)) if errcode_match else 0
    wx_code = code_match.group(1) if code_match else ""

    if _is_dev_environment():
        logger.info("WeChat poll: errcode=%s wx_code=%s", errcode, wx_code[:8] if wx_code else "")

    if errcode == 408:
        return {"status": "waiting", "message": "等待扫码中…"}
    if errcode == 404:
        return {"status": "scanned", "message": "已扫码，请在手机上确认"}
    if errcode == 402:
        return {"status": "expired", "message": "二维码已过期，请重新获取"}
    if errcode == 403:
        return {"status": "cancelled", "message": "用户已取消"}
    if errcode == 405 and wx_code:
        return {"status": "confirmed", "message": "已确认", "wx_code": wx_code}
    return {"status": "error", "message": f"未知状态 ({errcode})"}


async def complete_wechat_2fa(challenge_id: str, wx_code: str) -> CasLoginResult:
    """用微信回调 code 完成 CAS 2FA 认证。"""
    _cleanup_expired_challenges()
    challenge = pending_2fa_challenges.get(challenge_id)
    if challenge is None:
        raise CasAuthError("2FA 挑战不存在或已过期，请重新登录")

    redirect_uri = challenge.wechat_redirect_uri or quote(
        f"{settings.cas_base_url}/authserver/callback", safe=""
    )
    state = challenge.wechat_state or ""
    callback_url = (
        f"{settings.cas_base_url}/authserver/callback"
        f"?code={quote(wx_code, safe='')}&state={quote(state, safe='')}"
    )

    if _is_dev_environment():
        logger.info("WeChat 2FA completing: callback_url=%s", callback_url)

    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=15.0,
        headers={"User-Agent": "GUET-AllinOne-Notifier/0.1"},
    ) as client:
        _add_client_cookies(client, challenge.cookies)
        resp = await client.get(callback_url)
        if _is_dev_environment():
            logger.info(
                "WeChat callback result: status=%s url=%s",
                resp.status_code,
                resp.url,
            )
        cookies = _build_cookie_snapshot(client)

    if not _is_cas_session_ready(cookies):
        raise CasAuthError("微信扫码完成但未获得有效登录会话")

    pending_2fa_challenges.pop(challenge_id, None)
    return CasLoginResult(
        student_id=challenge.student_id,
        redirect_url=str(resp.url),
        cookies=cookies,
        requires_2fa=False,
    )


async def verify_cas_2fa(
    challenge_id: str,
    code: str,
) -> CasLoginResult:
    _cleanup_expired_challenges()
    challenge = pending_2fa_challenges.get(challenge_id)
    if challenge is None:
        raise CasAuthError("2FA 挑战不存在或已过期，请重新登录")
    async with httpx.AsyncClient(
        base_url=settings.cas_base_url,
        follow_redirects=False,
        timeout=15.0,
        headers={"User-Agent": "GUET-AllinOne-Notifier/0.1", "Referer": challenge.redirect_url},
    ) as client:
        _add_client_cookies(client, challenge.cookies)
        if challenge.reauth_type != "3":
            await _switch_reauth_type(client, challenge, "3")
        response = await client.post(
            "/authserver/reAuthCheck/reAuthSubmit.do",
            data={
                "service": challenge.service or "",
                "reAuthType": "3",
                "isMultifactor": challenge.is_multifactor,
                "password": "",
                "dynamicCode": code,
                "uuid": "",
                "answer1": "",
                "answer2": "",
                "otpCode": "",
            },
        )
        if _is_dev_environment():
            logger.info(
                "2FA submit response: status=%s body=%s",
                response.status_code,
                _body_preview(response.text),
            )
        if response.status_code >= 400:
            raise CasAuthError("2FA 验证失败，请稍后重试")
        payload = _response_json_or_empty(response)
        msg = str(payload.get("msg") or "")
        code_val = str(payload.get("code") or "")
        fail_codes = {"reauth_failed", "reauth_unauthorized"}
        if code_val.lower() in fail_codes or ("失败" in msg and "成功" not in msg):
            raise CasAuthError(msg or "2FA 验证失败")

        next_url = "/authserver/login"
        if challenge.service:
            next_url += f"?service={quote(challenge.service, safe='')}"
        final_page = await client.get(next_url)
        if final_page.status_code >= 400:
            raise CasAuthError("2FA 验证后会话确认失败")
        cookies = _build_cookie_snapshot(client)
        if not _is_cas_session_ready(cookies):
            raise CasAuthError("2FA 验证后未获得有效登录会话")
        pending_2fa_challenges.pop(challenge_id, None)
        return CasLoginResult(
            student_id=challenge.student_id,
            redirect_url=str(final_page.url),
            cookies=cookies,
            requires_2fa=False,
        )


def issue_session_token(db: Session, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    db.add(SessionToken(user_id=user_id, token=token))
    db.commit()
    return token


def upsert_user_with_cookies(
    db: Session,
    student_id: str,
    cookies: list[dict[str, str]],
    display_name: str = "",
) -> User:
    user = db.scalar(select(User).where(User.student_id == student_id))
    if user is None:
        user = User(student_id=student_id, display_name=display_name)
        db.add(user)
        db.flush()
    else:
        user.display_name = display_name or user.display_name

    credential = db.scalar(
        select(Credential).where(
            Credential.user_id == user.id,
            Credential.kind == "cas_cookie",
        )
    )
    payload = json.dumps(cookies, ensure_ascii=False)
    if credential is None:
        credential = Credential(
            user_id=user.id,
            kind="cas_cookie",
            cookie_jar_json=payload,
        )
        db.add(credential)
    else:
        credential.cookie_jar_json = payload
        credential.is_valid = True

    db.commit()
    db.refresh(user)
    return user


def require_user_by_token(db: Session, token: str | None) -> User:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="缺少认证令牌")
    session_token = db.scalar(select(SessionToken).where(SessionToken.token == token))
    if session_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效认证令牌")
    user = db.get(User, session_token.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在")
    return user
