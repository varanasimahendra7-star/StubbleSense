from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import get_settings


settings = get_settings()

database_url = settings.DATABASE_URL

# Use the installed psycopg 3 driver for PostgreSQL
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
elif database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

# SQLite requires check_same_thread=False for FastAPI
connect_args = {}
if database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    database_url,
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
    import app.models.user  # noqa: F401

    Base.metadata.create_all(bind=target_engine)

    # Safe backward-compatible SQLite migration for existing databases
    from sqlalchemy import inspect, text
    inspector = inspect(target_engine)
    if "interventions" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("interventions")]
        if "assigned_officer_id" not in columns:
            with target_engine.begin() as conn:
                conn.execute(text("ALTER TABLE interventions ADD COLUMN assigned_officer_id VARCHAR(50);"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_interventions_assigned_officer_id ON interventions (assigned_officer_id);"))

    if "users" in inspector.get_table_names():
        user_columns = [c["name"] for c in inspector.get_columns("users")]
        if "status" not in user_columns:
            with target_engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'active';"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_status ON users (status);"))
                conn.execute(text("UPDATE users SET status = 'active' WHERE is_active = 1 AND (status IS NULL OR status = '');"))
                conn.execute(text("UPDATE users SET status = 'pending' WHERE is_active = 0 AND (status IS NULL OR status = '');"))
