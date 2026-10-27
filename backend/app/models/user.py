from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, String

from app.database import Base


class UserModel(Base):
    """SQLAlchemy model representing an authenticated user account."""

    __tablename__ = "users"

    id = Column(String(50), primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    full_name = Column(String(150), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, index=True)  # super_admin, admin, field_officer, equipment_coordinator
    is_active = Column(Boolean, default=True, nullable=False)
    status = Column(String(50), default="active", nullable=False, index=True)  # active, pending, rejected, deactivated, deleted
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    is_synthetic = Column(Boolean, default=True, nullable=False)
