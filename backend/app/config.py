import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BACKEND_DIR / "stubble_sense.db"

# Load .env from the backend directory (if present). OS env vars always take precedence.
_dotenv_path = BACKEND_DIR / ".env"
if _dotenv_path.exists():
    load_dotenv(dotenv_path=_dotenv_path, override=False)


# Known insecure or default placeholder values that must be rejected in all environments
INSECURE_JWT_SECRETS = {
    "replace_this_with_a_secure_random_secret_in_production",
    "replace_this_with_a_secure_random_secret_at_least_32_characters_long",
    "replace_this_with_a_secure_random_secret_at_least_32_characters_in_production",
    "secret",
    "changeme",
    "password",
    "admin",
}


class Settings:
    """Application configuration settings."""

    def __init__(self):
        self.APP_NAME: str = os.getenv("APP_NAME", "StubbleSense")
        self.APP_VERSION: str = os.getenv("APP_VERSION", "0.1.0")
        self.ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").lower()
        self.DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH.as_posix()}")

        is_production = self.ENVIRONMENT == "production"

        # JWT Secret: strictly enforce an explicit, strong secret in every environment
        raw_jwt_secret = os.getenv("JWT_SECRET")
        if not raw_jwt_secret or len(raw_jwt_secret.strip()) < 32 or raw_jwt_secret.strip().lower() in INSECURE_JWT_SECRETS:
            raise ValueError(
                "CRITICAL SECURITY ERROR: JWT_SECRET must be explicitly configured with at least 32 characters in the environment. "
                "Cannot start application with missing or insecure JWT_SECRET."
            )
        self.JWT_SECRET = raw_jwt_secret.strip()

        self.JWT_ALGORITHM: str = "HS256"
        self.ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))  # 8 hours

        # Production security defaults: demo accounts default to False
        self.ENABLE_DEV_DEMO_ACCOUNTS: bool = os.getenv("ENABLE_DEV_DEMO_ACCOUNTS", "false").lower() in ("true", "1", "yes")
        if is_production and self.ENABLE_DEV_DEMO_ACCOUNTS:
            raise ValueError(
                "CRITICAL SECURITY ERROR: ENABLE_DEV_DEMO_ACCOUNTS cannot be enabled in a production environment."
            )

        # Public self-registration defaults to False
        self.ENABLE_PUBLIC_REGISTRATION: bool = os.getenv("ENABLE_PUBLIC_REGISTRATION", "false").lower() in ("true", "1", "yes")

        # Auto-approve self-registration defaults to False and is strictly forbidden in production
        self.AUTO_APPROVE_PUBLIC_REGISTRATION: bool = os.getenv("AUTO_APPROVE_PUBLIC_REGISTRATION", "false").lower() in ("true", "1", "yes")
        if is_production and self.AUTO_APPROVE_PUBLIC_REGISTRATION:
            raise ValueError(
                "CRITICAL SECURITY ERROR: AUTO_APPROVE_PUBLIC_REGISTRATION cannot be enabled in a production environment."
            )

        # Production evaluation accounts passwords (configured strictly via environment variables)
        self.EVAL_ACCOUNTS_PASSWORD: str = os.getenv("EVAL_ACCOUNTS_PASSWORD", os.getenv("EVALUATION_PASSWORD", "")).strip()
        self.EVAL_SUPERADMIN_PASSWORD: str = os.getenv("EVAL_SUPERADMIN_PASSWORD", "").strip()
        self.EVAL_ADMIN_PASSWORD: str = os.getenv("EVAL_ADMIN_PASSWORD", "").strip()
        self.EVAL_FIELD_OFFICER_PASSWORD: str = os.getenv("EVAL_FIELD_OFFICER_PASSWORD", "").strip()
        self.EVAL_EQUIP_COORD_PASSWORD: str = os.getenv("EVAL_EQUIP_COORD_PASSWORD", "").strip()

        # Local development demo passwords (used only when ENABLE_DEV_DEMO_ACCOUNTS=true)
        self.EVAL_DEMO_PASSWORD: str = os.getenv("EVAL_DEMO_PASSWORD", "")
        self.EVAL_DEMO_SUPERADMIN_PASSWORD: str = os.getenv("EVAL_DEMO_SUPERADMIN_PASSWORD", "")
        self.EVAL_DEMO_ADMIN_PASSWORD: str = os.getenv("EVAL_DEMO_ADMIN_PASSWORD", "")
        self.EVAL_DEMO_FIELD_OFFICER_PASSWORD: str = os.getenv("EVAL_DEMO_FIELD_OFFICER_PASSWORD", "")
        self.EVAL_DEMO_EQUIP_COORD_PASSWORD: str = os.getenv("EVAL_DEMO_EQUIP_COORD_PASSWORD", "")

        # Cookie security: HTTPS-secure cookies in production by default
        default_cookie_secure = "true" if is_production else "false"
        self.COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", default_cookie_secure).lower() in ("true", "1", "yes")
        if is_production and not self.COOKIE_SECURE:
            raise ValueError(
                "CRITICAL SECURITY ERROR: COOKIE_SECURE must be true in a production environment."
            )

        self.CORS_ORIGINS: list[str] = [
            origin.strip()
            for origin in os.getenv(
                "CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173",
            ).split(",")
            if origin.strip()
        ]


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
