from typing import Any

from fastapi.testclient import TestClient

from guet_notifier.auth import CasLoginResult, encrypt_password, parse_login_form
from guet_notifier.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root_lists_service() -> None:
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "guet-notifier"
    assert data["docs"] == "/docs"


def test_me_requires_bearer_token() -> None:
    response = client.get("/api/v1/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "缺少认证令牌"


def test_parse_login_form_extracts_real_fields() -> None:
    html = '''
    <form class="loginFromClass" method="post" id="pwdFromId" action="/authserver/login">
      <input type="hidden" id="pwdEncryptSalt" value="abc1234567890123" />
      <input type="hidden" id="execution" name="execution" value="exec-token" />
      <script>var needCaptcha = "";</script>
    </form>
    '''
    form = parse_login_form(html)
    assert form.action_path == "/authserver/login"
    assert form.execution == "exec-token"
    assert form.pwd_encrypt_salt == "abc1234567890123"
    assert form.need_captcha is False


def test_encrypt_password_returns_base64_ciphertext() -> None:
    encrypted = encrypt_password("secret", "1234567890abcdef")
    assert encrypted != "secret"
    assert isinstance(encrypted, str)
    assert len(encrypted) > 20


def test_cas_login_persists_cookie_and_returns_token(monkeypatch: Any) -> None:
    from guet_notifier import main as main_module

    async def fake_login_with_cas(
        student_id: str,
        password: str,
    ) -> CasLoginResult:
        assert student_id == "20230001"
        assert password == "secret"
        return CasLoginResult(
            student_id=student_id,
            redirect_url="https://cas.guet.edu.cn/authserver/index.do",
            cookies=[
                {
                    "name": "TGC",
                    "value": "cookie-value",
                    "domain": "cas.guet.edu.cn",
                    "path": "/",
                }
            ],
            requires_2fa=False,
        )

    monkeypatch.setattr(main_module, "login_with_cas", fake_login_with_cas)
    response = client.post(
        "/api/v1/auth/cas/login",
        json={"student_id": "20230001", "password": "secret"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["student_id"] == "20230001"
    assert data["access_token"]

    me_response = client.get(
        "/api/v1/me",
        headers={"Authorization": f"Bearer {data['access_token']}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["student_id"] == "20230001"
