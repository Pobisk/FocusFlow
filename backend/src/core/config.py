"""Application configuration using Pydantic Settings v2."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with validation."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────
    environment: Literal["development", "staging", "production"] = "development"
    log_level: Literal["debug", "info", "warning", "error"] = "info"
    secret_key: str = Field(..., min_length=32)

    # ── Database ─────────────────────────────────────
    database_url: PostgresDsn = Field(..., examples=["postgresql://user:pass@localhost/db"])

    @computed_field  # type: ignore[misc]
    @property
    def is_dev(self) -> bool:
        return self.environment == "development"

    # ── S3 Storage ───────────────────────────────────
    s3_endpoint: str
    s3_bucket: str
    s3_region: str
    s3_access_key: str
    s3_secret_key: str

    # ── CORS ─────────────────────────────────────────
    cors_origins: list[str] = Field(default_factory=list)

    # ── Scheduler ────────────────────────────────────
    scheduler_timezone: str = "UTC"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings instance for performance."""
    return Settings()


# Global settings instance (import anywhere)
settings = get_settings()
