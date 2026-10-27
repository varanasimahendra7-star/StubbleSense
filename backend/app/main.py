from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.equipment import router as equipment_router
from app.api.fire_events import router as fire_events_router
from app.api.health import router as health_router
from app.api.interventions import router as interventions_router
from app.api.villages import router as villages_router
from app.config import get_settings
from app.core.dependencies import verify_csrf
from app.database import SessionLocal, init_db
from app.services.user_service import (
    ensure_initial_admin,
    ensure_initial_super_admin,
    ensure_production_evaluation_accounts,
    seed_dev_demo_users,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Safe backward-compatible schema initialization
    init_db()
    # Safe idempotent initial super admin, admin, evaluation accounts & optional dev demo accounts
    db = SessionLocal()
    try:
        ensure_initial_super_admin(db)
        ensure_initial_admin(db)
        ensure_production_evaluation_accounts(db)
        seed_dev_demo_users(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="StubbleSense Backend API",
    lifespan=lifespan,
    dependencies=[Depends(verify_csrf)],
)

# Enable CORS narrowly for trusted frontend origins (no wildcard with credentials)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(fire_events_router, prefix="/api")
app.include_router(villages_router, prefix="/api")
app.include_router(equipment_router, prefix="/api")
app.include_router(interventions_router, prefix="/api")
