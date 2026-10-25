from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.equipment import router as equipment_router
from app.api.fire_events import router as fire_events_router
from app.api.health import router as health_router
from app.api.interventions import router as interventions_router
from app.api.villages import router as villages_router
from app.config import get_settings
from app.database import init_db

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="StubbleSense Backend API",
    lifespan=lifespan,
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
app.include_router(fire_events_router, prefix="/api")
app.include_router(villages_router, prefix="/api")
app.include_router(equipment_router, prefix="/api")
app.include_router(interventions_router, prefix="/api")
