from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["Health"])
settings = get_settings()


@router.get("/health")
def health_check():
    """Health check endpoint to verify backend operational status."""
    current_settings = get_settings()
    return {
        "status": "ok",
        "app": current_settings.APP_NAME,
        "environment": current_settings.ENVIRONMENT,
        "demo_accounts_enabled": current_settings.ENABLE_DEV_DEMO_ACCOUNTS,
    }
