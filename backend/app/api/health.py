from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["Health"])
settings = get_settings()


@router.get("/health")
def health_check():
    """Health check endpoint to verify backend operational status."""
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
    }
