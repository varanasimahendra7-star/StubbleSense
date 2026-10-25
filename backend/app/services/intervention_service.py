from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session

from app.data.synthetic_equipment import SYNTHETIC_EQUIPMENT
from app.data.synthetic_interventions import seed_initial_interventions
from app.data.synthetic_villages import SYNTHETIC_VILLAGES
from app.models.intervention import (
    FieldVerificationModel,
    InterventionAuditModel,
    InterventionModel,
)
from app.schemas.intervention import (
    FieldVerificationCreate,
    InterventionCreate,
    InterventionStatusUpdate,
)

# Valid lifecycle statuses
VALID_STATUSES = {"Proposed", "Approved", "In Progress", "Completed", "Cancelled"}

# Valid transition map
ALLOWED_TRANSITIONS = {
    "Proposed": {"Approved", "Cancelled"},
    "Approved": {"In Progress", "Proposed", "Cancelled"},
    "In Progress": {"Completed", "Approved", "Cancelled"},
    "Completed": {"In Progress"},  # Re-opening an intervention
    "Cancelled": {"Proposed"},    # Re-instating an intervention
}

VALID_VERIFICATION_OUTCOMES = {
    "Verified Cleared",
    "Partial Residue Remaining",
    "Violation Detected / Fire Evidence Found",
    "Inaccessible / Flagged",
}


def ensure_seeded_data(db: Session) -> None:
    """Ensure that deterministic synthetic demo interventions are present."""
    seed_initial_interventions(db)


def get_interventions(
    db: Session,
    village_id: Optional[str] = None,
    status: Optional[str] = None,
    completion_status: Optional[str] = None,
    district: Optional[str] = None,
) -> List[InterventionModel]:
    """Retrieve interventions with optional filtering."""
    ensure_seeded_data(db)
    query = db.query(InterventionModel)

    if village_id:
        query = query.filter(InterventionModel.village_id == village_id)
    if status and status != "all":
        query = query.filter(InterventionModel.status == status)
    if completion_status and completion_status != "all":
        query = query.filter(InterventionModel.completion_status == completion_status)
    if district and district != "all":
        query = query.filter(InterventionModel.district == district)

    return query.order_by(InterventionModel.created_at.desc()).all()


def get_intervention_by_id(db: Session, intervention_id: str) -> Optional[InterventionModel]:
    """Retrieve a single intervention by its unique identifier."""
    ensure_seeded_data(db)
    return db.query(InterventionModel).filter(InterventionModel.id == intervention_id).first()


def create_intervention(db: Session, payload: InterventionCreate) -> InterventionModel:
    """Create a new intervention record after validating village and equipment references."""
    ensure_seeded_data(db)

    # 1. Validate village existence
    village = next((v for v in SYNTHETIC_VILLAGES if v["id"] == payload.village_id), None)
    if not village:
        raise ValueError(f"Village with ID '{payload.village_id}' not found in synthetic village registry.")

    # 2. Validate optional equipment existence
    equipment_name = None
    if payload.equipment_id:
        eq = next((e for e in SYNTHETIC_EQUIPMENT if e["id"] == payload.equipment_id), None)
        if not eq:
            raise ValueError(f"Equipment with ID '{payload.equipment_id}' not found in synthetic equipment registry.")
        equipment_name = eq["name"]

    # 3. Generate deterministic identifier
    state_code = "PB" if village["state"].lower() == "punjab" else "HR"
    count = db.query(InterventionModel).count() + 1
    intervention_id = f"INT-2026-{state_code}-{count:03d}"

    now = datetime.utcnow()
    new_intervention = InterventionModel(
        id=intervention_id,
        village_id=village["id"],
        village_name=village["name"],
        district=village["district"],
        state=village["state"],
        equipment_id=payload.equipment_id,
        equipment_name=equipment_name,
        intervention_type=payload.intervention_type,
        target_acres=payload.target_acres,
        status="Proposed",
        completion_status="Pending",
        created_at=now,
        updated_at=now,
        notes=payload.notes,
        is_synthetic=True,
    )
    db.add(new_intervention)

    # 4. Add initial audit entry
    initial_audit = InterventionAuditModel(
        intervention_id=intervention_id,
        from_status="None",
        to_status="Proposed",
        changed_by=payload.requested_by,
        reason=f"Initial intervention proposal submitted for {payload.target_acres} acres ({payload.intervention_type}).",
        timestamp=now,
    )
    db.add(initial_audit)

    db.commit()
    db.refresh(new_intervention)
    return new_intervention


def update_intervention_status(
    db: Session,
    intervention_id: str,
    payload: InterventionStatusUpdate,
) -> InterventionModel:
    """Transition intervention lifecycle status and record in audit trail."""
    intervention = get_intervention_by_id(db, intervention_id)
    if not intervention:
        raise KeyError(f"Intervention with ID '{intervention_id}' does not exist.")

    if payload.new_status not in VALID_STATUSES:
        raise ValueError(
            f"Invalid status '{payload.new_status}'. Allowed statuses are: {', '.join(sorted(VALID_STATUSES))}."
        )

    current_status = intervention.status
    if current_status == payload.new_status:
        return intervention

    allowed = ALLOWED_TRANSITIONS.get(current_status, set())
    if payload.new_status not in allowed:
        raise ValueError(
            f"Invalid status transition from '{current_status}' to '{payload.new_status}'. "
            f"Allowed transitions from '{current_status}' are: {', '.join(sorted(allowed)) if allowed else 'None'}."
        )

    now = datetime.utcnow()

    # Rule: Transitioning to Completed sets completion_status to Self-Reported, NOT Field-Verified
    if payload.new_status == "Completed":
        intervention.status = "Completed"
        if intervention.completion_status != "Field-Verified":
            intervention.completion_status = "Self-Reported"
    else:
        intervention.status = payload.new_status
        if intervention.completion_status == "Self-Reported":
            intervention.completion_status = "Pending"

    intervention.updated_at = now

    audit = InterventionAuditModel(
        intervention_id=intervention.id,
        from_status=current_status,
        to_status=payload.new_status,
        changed_by=payload.changed_by,
        reason=payload.reason or f"Transitioned from {current_status} to {payload.new_status}.",
        timestamp=now,
    )
    db.add(audit)

    db.commit()
    db.refresh(intervention)
    return intervention


def record_field_verification(
    db: Session,
    intervention_id: str,
    payload: FieldVerificationCreate,
) -> InterventionModel:
    """Record an on-site field verification audit and update completion status to Field-Verified."""
    intervention = get_intervention_by_id(db, intervention_id)
    if not intervention:
        raise KeyError(f"Intervention with ID '{intervention_id}' does not exist.")

    if payload.outcome not in VALID_VERIFICATION_OUTCOMES:
        raise ValueError(
            f"Invalid verification outcome '{payload.outcome}'. "
            f"Allowed outcomes: {', '.join(sorted(VALID_VERIFICATION_OUTCOMES))}."
        )

    now = datetime.utcnow()

    # Prepare evidence metadata with synthetic disclaimer flag
    evidence = dict(payload.evidence_metadata or {})
    evidence["is_synthetic"] = True
    evidence["synthetic_notice"] = "Synthetic demonstration audit. Does not represent actual physical on-site audit."

    # Check if verification record already exists
    verification = (
        db.query(FieldVerificationModel)
        .filter(FieldVerificationModel.intervention_id == intervention_id)
        .first()
    )

    if verification:
        verification.verifier_name = payload.verifier_name
        verification.verified_at = now
        verification.outcome = payload.outcome
        verification.verified_acres = payload.verified_acres
        verification.evidence_metadata = evidence
        verification.verification_notes = payload.verification_notes
    else:
        verification = FieldVerificationModel(
            intervention_id=intervention.id,
            verifier_name=payload.verifier_name,
            verified_at=now,
            outcome=payload.outcome,
            verified_acres=payload.verified_acres,
            evidence_metadata=evidence,
            verification_notes=payload.verification_notes,
            is_synthetic=True,
        )
        db.add(verification)

    # Strictly set completion status to Field-Verified
    previous_completion_status = intervention.completion_status
    intervention.completion_status = "Field-Verified"

    # If outcome is Verified Cleared and status not yet Completed, complete it
    if payload.outcome == "Verified Cleared" and intervention.status != "Completed":
        intervention.status = "Completed"

    intervention.updated_at = now

    audit = InterventionAuditModel(
        intervention_id=intervention.id,
        from_status=intervention.status,
        to_status=intervention.status,
        changed_by=payload.verifier_name,
        reason=(
            f"Ground field verification completed: outcome='{payload.outcome}', "
            f"verified {payload.verified_acres} acres (completion_status: {previous_completion_status} -> Field-Verified)."
        ),
        timestamp=now,
    )
    db.add(audit)

    db.commit()
    db.refresh(intervention)
    return intervention
