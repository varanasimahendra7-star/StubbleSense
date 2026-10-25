from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import get_settings

settings = get_settings()

# SQLite requires check_same_thread=False for multi-threaded access in FastAPI
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency that yields a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(engine_instance=None):
    """Safely initialize database tables without dropping or deleting existing tables."""
    target_engine = engine_instance or engine
    import app.models.intervention  # noqa: F401

    Base.metadata.create_all(bind=target_engine)

