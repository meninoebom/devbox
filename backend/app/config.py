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


settings = Settings()
