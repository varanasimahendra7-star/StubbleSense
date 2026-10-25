import os
from functools import lru_cache


class Settings:
    """Application configuration settings."""

    APP_NAME: str = os.getenv("APP_NAME", "StubbleSense")
    APP_VERSION: str = os.getenv("APP_VERSION", "0.1.0")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./stubble_sense.db")
    CORS_ORIGINS: list[str] = [
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
