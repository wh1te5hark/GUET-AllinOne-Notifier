import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    environment: str
    host: str
    port: int
    database_url: str
    cas_base_url: str


base_dir = Path(__file__).resolve().parents[2]
default_sqlite_path = base_dir / ".data" / "app.db"
default_sqlite_path.parent.mkdir(parents=True, exist_ok=True)
default_database_url = f"sqlite:///{default_sqlite_path.as_posix()}"

settings = Settings(
    environment=os.environ.get("GUET_ENV", "development"),
    host=os.environ.get("GUET_HOST", "127.0.0.1"),
    port=int(os.environ.get("GUET_PORT", "8000")),
    database_url=os.environ.get("GUET_DATABASE_URL", default_database_url),
    cas_base_url=os.environ.get("GUET_CAS_BASE_URL", "https://cas.guet.edu.cn"),
)
