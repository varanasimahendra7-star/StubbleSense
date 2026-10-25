from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class InterventionModel(Base):
    """SQLAlchemy model representing an agricultural residue intervention record."""

    __tablename__ = "interventions"

    id = Column(String(50), primary_key=True, index=True)
    village_id = Column(String(50), nullable=False, index=True)
    village_name = Column(String(150), nullable=False)
    district = Column(String(100), nullable=False, index=True)
    state = Column(String(50), nullable=False)
    equipment_id = Column(String(50), nullable=True, index=True)
    equipment_name = Column(String(150), nullable=True)
    intervention_type = Column(String(100), nullable=False)
    target_acres = Column(Float, nullable=False)
    status = Column(String(50), nullable=False, default="Proposed", index=True)
    completion_status = Column(String(50), nullable=False, default="Pending", index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    notes = Column(Text, nullable=True)
    is_synthetic = Column(Boolean, default=True, nullable=False)

    # Relationships
    audits = relationship(
        "InterventionAuditModel",
        back_populates="intervention",
        cascade="all, delete-orphan",
        order_by="InterventionAuditModel.timestamp.asc()",
    )
    verification = relationship(
        "FieldVerificationModel",
        back_populates="intervention",
        uselist=False,
        cascade="all, delete-orphan",
    )


class InterventionAuditModel(Base):
    """SQLAlchemy model tracking immutable audit history of intervention status transitions."""

    __tablename__ = "intervention_audits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    intervention_id = Column(
        String(50),
        ForeignKey("interventions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_status = Column(String(50), nullable=False)
    to_status = Column(String(50), nullable=False)
    changed_by = Column(String(150), nullable=False)
    reason = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    intervention = relationship("InterventionModel", back_populates="audits")


class FieldVerificationModel(Base):
    """SQLAlchemy model storing ground field verification by agricultural nodal officers."""

    __tablename__ = "field_verifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    intervention_id = Column(
        String(50),
        ForeignKey("interventions.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    verifier_name = Column(String(150), nullable=False)
    verified_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    outcome = Column(String(100), nullable=False)
    verified_acres = Column(Float, nullable=False)
    evidence_metadata = Column(JSON, nullable=False, default=dict)
    verification_notes = Column(Text, nullable=True)
    is_synthetic = Column(Boolean, default=True, nullable=False)

    intervention = relationship("InterventionModel", back_populates="verification")
