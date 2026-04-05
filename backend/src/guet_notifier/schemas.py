from pydantic import BaseModel, Field


class CasLoginRequest(BaseModel):
    student_id: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=1, max_length=128)


class CookieItem(BaseModel):
    name: str
    value: str
    domain: str
    path: str = "/"


class LoginResponse(BaseModel):
    access_token: str | None = None
    token_type: str = "bearer"
    student_id: str
    cas_redirect_url: str
    requires_2fa: bool = False
    challenge_id: str | None = None
    challenge_expires_in: int | None = None
    code_field_candidates: list[str] = Field(default_factory=list)
    available_2fa_methods: list[str] = Field(default_factory=list)
    cas_cookies: list[CookieItem] = Field(default_factory=list)
    message: str | None = None


class Cas2FAVerifyRequest(BaseModel):
    challenge_id: str = Field(min_length=1, max_length=128)
    code: str = Field(min_length=1, max_length=16)


class Cas2FAChallengeRequest(BaseModel):
    challenge_id: str = Field(min_length=1, max_length=128)


class Cas2FAWeChatInitResponse(BaseModel):
    challenge_id: str
    method: str = "wechat_qr"
    qr_image_url: str
    wechat_uuid: str
    message: str


class Cas2FAWeChatStatusResponse(BaseModel):
    challenge_id: str
    status: str  # waiting | scanned | confirmed | expired | cancelled | error
    message: str
    login_result: LoginResponse | None = None


class Cas2FASendCodeResponse(BaseModel):
    challenge_id: str
    method: str = "sms_code"
    message: str


class MeResponse(BaseModel):
    id: int
    student_id: str
    display_name: str
    real_name: str = ""
    avatar_base64: str = ""


class ProfileUpdateRequest(BaseModel):
    display_name: str = Field(default="", max_length=128)
    avatar_base64: str = Field(default="", max_length=15_000_000)


class ProfileUpdateResponse(BaseModel):
    id: int
    student_id: str
    display_name: str
    real_name: str = ""
    avatar_base64: str = ""


class SmartCampusProfileResponse(BaseModel):
    student_id: str
    login_name: str
    real_name: str
    display_name: str = ""
    user_pic: str = ""


class SmartCampusMessageItem(BaseModel):
    id: int
    source: str
    external_id: str
    title: str
    sender: str = ""
    content_text: str = ""
    content_html: str = ""
    occurred_at_text: str = ""
    is_marked_read: bool = False
    fetched_at: str


class SmartCampusSyncResponse(BaseModel):
    fetched_count: int
    saved_count: int
    marked_read_count: int = 0
    messages: list[SmartCampusMessageItem]


class SmartCampusCollectorSetting(BaseModel):
    enabled: bool = True
    schedule_mode: str = "visual"  # visual | cron
    cron_expr: str = "*/30 * * * *"
    visual_mode: str = "every_n_minutes"  # every_n_minutes | daily_time
    interval_minutes: int = 30
    daily_time: str = "08:00"
