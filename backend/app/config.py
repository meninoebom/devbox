"""Application configuration using pydantic-settings."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", env_file_encoding="utf-8")

    DATABASE_URL: str = f"sqlite+aiosqlite:///{BASE_DIR / 'devbox.db'}"
    SECRET_KEY: str = "devbox-secret-change-in-production"
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    DEBUG: bool = True
    UPLOAD_DIR: str = str(BASE_DIR / "uploads")

    # The Workbench lab specimen (see docker-compose.yml). A plain asyncpg DSN
    # (no +asyncpg driver suffix — the LabRunner uses asyncpg directly). Only the
    # Workbench needs this running; the rest of the app is unaffected when it is down.
    LAB_DSN: str = "postgresql://devbox_lab:devbox_lab@localhost:5435/devbox_lab"
    LAB_STATEMENT_TIMEOUT_MS: int = 5000
    LAB_ROW_CAP: int = 500

    # The Mechanic (Phase 3). No key -> the endpoint returns a clear "set a key"
    # message; the gate never needs one (it injects a scripted client).
    ANTHROPIC_API_KEY: str = ""
    MECHANIC_MODEL: str = "claude-sonnet-5"

    # The Gym (Phase 5). Reps append to this log, continuing the engineering-gym
    # convention. Config, so the gate can point it at a temp dir.
    HOMEBASE_LOG_DIR: str = str(Path.home() / "Documents" / "homebase-log")


settings = Settings()
