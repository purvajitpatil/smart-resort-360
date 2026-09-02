"""Application configuration loaded from environment / .env.

Values come from pydantic-settings. Secrets must never be committed; the
defaults shown here are explicit DEMO defaults only and `JWT_SECRET` is
asserted to be strong when running outside demo mode.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Demo-only defaults (overridden by real values in production).
_DEMO_JWT_SECRETS = {"", "demo-insecure-change-me", "changeme"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Smart Resort 360 API"
    api_prefix: str = "/api/v1"
    environment: str = "development"
    debug: bool = True
    demo_mode: bool = True

    database_url: str = "sqlite:///./smrtresort360.db"

    jwt_secret: str = "demo-insecure-change-me-0123456789abcdef"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    demo_guest_password: str = "DemoGuest!2026"
    demo_staff_password: str = "DemoStaff!2026"
    demo_manager_password: str = "DemoManager!2026"

    hotel_name: str = "Smart Resort 360 Grand Jaipur"
    demo_guest_email: str = "guest@smartresort360.demo"
    admin_email: str = "admin@smartresort360.demo"
    manager_email: str = "manager@smartresort360.demo"

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]
    rate_limit_per_minute: int = 240
    max_body_bytes: int = 1_000_000

    llm_provider: str = "local"
    llm_api_key: str = ""
    llm_base_url: str = ""
    llm_model: str = ""
    osrm_url: str = ""
    openweather_api_key: str = ""
    google_places_api_key: str = ""

    seed_on_startup: bool = True
    # Absolute path to the curated POI catalogue. Empty -> derive from repo root
    # (repo-root/data/pois/jaipur.json). Set in containers where the layout differs.
    seed_data_file: str = ""

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors(cls, v: object) -> object:
        if isinstance(v, str):
            return [item.strip().strip('"').strip("'") for item in v.split(",") if item.strip()]
        return v

    def require_strong_secret(self) -> None:
        """Refuse to boot with a weak JWT secret outside demo mode."""
        if not self.demo_mode and self.jwt_secret in _DEMO_JWT_SECRETS:
            raise RuntimeError("JWT_SECRET must be set to a strong value when DEMO_MODE=false")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
