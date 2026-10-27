from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class InterventionAuditItem(BaseModel):
    """Schema representing an immutable status audit history entry."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    intervention_id: str
    from_status: str
    to_status: str
    changed_by: str
    reason: Optional[str] = None
    timestamp: datetime


class FieldVerificationItem(BaseModel):
    """Schema representing on-site ground verification by an agricultural nodal officer."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    intervention_id: str
    verifier_name: str
    verified_at: datetime
    outcome: str
    verified_acres: float
    evidence_metadata: Dict[str, Any] = Field(default_factory=dict)
    verification_notes: Optional[str] = None
    is_synthetic: bool = True


class InterventionItem(BaseModel):
    """Comprehensive schema for an intervention with lifecycle, audits, and verification."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    village_id: str
    village_name: str
    district: str
    state: str
    equipment_id: Optional[str] = None
    equipment_name: Optional[str] = None
    intervention_type: str
    target_acres: float
    status: str
    completion_status: str
    assigned_officer_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    notes: Optional[str] = None
    is_synthetic: bool = True
    audits: List[InterventionAuditItem] = Field(default_factory=list)
    verification: Optional[FieldVerificationItem] = None



class InterventionCreate(BaseModel):
    """Payload to create a new agricultural residue intervention."""

    village_id: str = Field(..., description="Target synthetic village identifier (e.g. DEMO-VILL-PB-01)")
    equipment_id: Optional[str] = Field(None, description="Optional machinery identifier from CHC registry")
    intervention_type: str = Field(..., description="e.g. In-situ Happy Seeding, Ex-situ Baler Collection")
    target_acres: float = Field(..., gt=0.0, le=5000.0, description="Planned acreage to treat")
    assigned_officer_id: Optional[str] = Field(None, description="Optional designated nodal officer ID")
    notes: Optional[str] = Field(None, description="Administrative or operational notes")
    requested_by: str = Field(..., min_length=2, description="Coordinator or farmer requesting intervention")


class InterventionStatusUpdate(BaseModel):
    """Payload to transition intervention lifecycle status."""

    new_status: str = Field(..., description="Proposed, Approved, In Progress, Completed, or Cancelled")
    changed_by: str = Field(..., min_length=2, description="Actor requesting or executing the status transition")
    reason: Optional[str] = Field(None, description="Operational justification for the status change")


class FieldVerificationCreate(BaseModel):
    """Payload to record ground field verification."""

    verifier_name: str = Field(..., min_length=2, description="Designated nodal officer conducting ground audit")
    outcome: str = Field(
        ...,
        description="Verified Cleared, Partial Residue Remaining, Violation Detected / Fire Evidence Found, or Inaccessible / Flagged",
    )
    verified_acres: float = Field(..., gt=0.0, description="Actual physical acreage verified")
    evidence_metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Structured inspection metadata (GPS coordinates, camera ID, satellite anomaly correlation)",
    )
    verification_notes: Optional[str] = Field(None, description="Ground inspection notes and observations")


class InterventionListResponse(BaseModel):
    """Response container for intervention list queries."""

    total: int
    data_notice: str = Field(
        "DEMO DATA NOTICE: All interventions, audits, and verification records are illustrative synthetic demonstration data.",
        description="Data provenance notice",
    )
    items: List[InterventionItem]
