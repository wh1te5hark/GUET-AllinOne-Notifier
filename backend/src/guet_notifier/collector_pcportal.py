from __future__ import annotations

from dataclasses import dataclass

import httpx


USER_INFO_URL = "https://pcportal.guet.edu.cn/sopplus/_web/portal/api/user/loginInfo.rst?_p=YXM9MiZ0PTUmZD0xMzMmcD0xJmY9NDQmbT1OJg__"
MESSAGE_LIST_URL = "https://pcportal.guet.edu.cn/ucp/_web/onlinenews/receiveBox/api/fetchReceiveBoxJsonp.rst"
MESSAGE_DETAIL_URL = "https://pcportal.guet.edu.cn/ucp/_web/onlinenews/receiveBox/api/findMessageDetailJsonp.rst"
PCPORTAL_HOME = "https://pcportal.guet.edu.cn/"
DEFAULT_TIMEOUT = 30.0


@dataclass
class PcportalUserInfo:
    login_name: str
    user_name: str
    user_pic: str


def _normalize_json(data: dict | None) -> dict:
    if isinstance(data, dict):
        return data
    return {}


def _normalize_message_item(item: dict) -> dict:
    return {
        "external_id": str(item.get("id") or ""),
        "title": str(item.get("subject") or ""),
        "sender": str(item.get("sender") or ""),
        "content_text": str(item.get("contentText") or ""),
        "content_html": str(item.get("content") or ""),
        "occurred_at_text": str(item.get("createTime") or ""),
        "raw": item,
    }


async def _build_client_with_cookies(cookies: list[dict]) -> httpx.AsyncClient:
    client = httpx.AsyncClient(
        follow_redirects=True,
        timeout=DEFAULT_TIMEOUT,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
    )
    for c in cookies:
        name = str(c.get("name") or "")
        if not name:
            continue
        client.cookies.set(
            name,
            str(c.get("value") or ""),
            domain=str(c.get("domain") or "cas.guet.edu.cn"),
            path=str(c.get("path") or "/"),
        )
    return client


async def fetch_login_info(cookies: list[dict]) -> PcportalUserInfo:
    client = await _build_client_with_cookies(cookies)
    async with client:
        await client.get(PCPORTAL_HOME)
        resp = await client.get(
            USER_INFO_URL,
            headers={
                "Accept": "application/json,text/plain,*/*",
                "Referer": "https://pcportal.guet.edu.cn/#/home",
            },
        )
        resp.raise_for_status()
        payload = _normalize_json(resp.json())
        data = _normalize_json(payload.get("data"))
        return PcportalUserInfo(
            login_name=str(data.get("loginName") or ""),
            user_name=str(data.get("userName") or ""),
            user_pic=str(data.get("userPic") or ""),
        )


async def fetch_receive_box_messages(cookies: list[dict], page: int = 1, rows: int = 20) -> list[dict]:
    client = await _build_client_with_cookies(cookies)
    async with client:
        await client.get(PCPORTAL_HOME)
        resp = await client.get(
            MESSAGE_LIST_URL,
            params={
                "innerMsg": 0,
                "page": page,
                "rows": rows,
                "keyWord": "",
                "schedule": "",
            },
            headers={
                "Accept": "application/json,text/plain,*/*",
                "Referer": "https://pcportal.guet.edu.cn/#/message",
            },
        )
        resp.raise_for_status()
        payload = _normalize_json(resp.json())
        result = _normalize_json(payload.get("result"))
        raw_list = result.get("data")
        if not isinstance(raw_list, list):
            return []
        return [_normalize_message_item(item) for item in raw_list if isinstance(item, dict)]


async def mark_message_read(cookies: list[dict], msg_id: str) -> bool:
    normalized_id = str(msg_id or "").strip()
    if not normalized_id:
        return False
    client = await _build_client_with_cookies(cookies)
    async with client:
        await client.get(PCPORTAL_HOME)
        resp = await client.get(
            MESSAGE_DETAIL_URL,
            params={"msgId": normalized_id},
            headers={
                "Accept": "application/json,text/plain,*/*",
                "Referer": "https://pcportal.guet.edu.cn/#/message",
            },
        )
        if resp.status_code >= 400:
            return False
        try:
            payload = _normalize_json(resp.json())
        except Exception:
            return False
        # 该接口返回详情时会更新已读状态，这里只要是成功返回即可视为“已尝试标记”。
        return bool(payload)
