from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.database import get_db
from app.models.user import UserModel
from app.schemas.intervention import (
    FieldVerificationCreate,
    InterventionCreate,
    InterventionItem,
    InterventionListResponse,
    InterventionStatusUpdate,
)
from app.services.intervention_service import (
    create_intervention,
    get_intervention_by_id,
    get_interventions,
    record_field_verification,
    update_intervention_status,
)

router = APIRouter(tags=["Interventions & Field Verification"])


@router.get("/interventions", response_model=InterventionListResponse)
def list_interventions(
    village_id: Optional[str] = Query(None, description="Filter by village ID"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (Proposed, Approved, In Progress, Completed, Cancelled)"),
    completion_status: Optional[str] = Query(None, description="Filter by completion status (Pending, Self-Reported, Field-Verified)"),
    district: Optional[str] = Query(None, description="Filter by district"),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve agricultural residue intervention records with optional filtering.

    Requires authentication. Field officers can inspect interventions in their jurisdiction.
    """
    assigned_officer_filter = None
    if current_user.role == "field_officer":
        assigned_officer_filter = current_user.id

    items = get_interventions(
        db=db,
        village_id=village_id,
        status=status_filter,
        completion_status=completion_status,
        district=district,
        assigned_officer_id=assigned_officer_filter,
    )
    return InterventionListResponse(
        total=len(items),
        items=items,
    )


@router.post("/interventions", response_model=InterventionItem, status_code=status.HTTP_201_CREATED)
def create_new_intervention(
    payload: InterventionCreate,
    current_user: UserModel = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Create a new intervention record linked to a village and optional machinery.

    Restricted exclusively to administrative roles (admin, super_admin).
    """
    try:
        return create_intervention(db=db, payload=payload)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "not found" in str(e).lower() else status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


@router.get("/interventions/{intervention_id}", response_model=InterventionItem)
def get_intervention_detail(
    intervention_id: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve a single intervention with full audit history and field verification."""
    item = get_intervention_by_id(db=db, intervention_id=intervention_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Intervention with ID '{intervention_id}' was not found.",
        )

    # Cross-record access isolation for field officers
    if current_user.role == "field_officer" and item.assigned_officer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. This intervention record is not assigned to you.",
        )

    return item


@router.patch("/interventions/{intervention_id}/status", response_model=InterventionItem)
def change_intervention_status(
    intervention_id: str,
    payload: InterventionStatusUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Transition intervention lifecycle status and record entry in audit trail.

    Role permissions:
    - super_admin / admin: can execute any valid transition (Approve, Cancel, In-Progress, Completed)
    - field_officer: can transition assigned records from Approved -> In Progress or In Progress -> Completed
    - equipment_coordinator: may only transition Approved -> In Progress for machinery mobilization.
    """
    intervention = get_intervention_by_id(db=db, intervention_id=intervention_id)
    if not intervention:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Intervention with ID '{intervention_id}' was not found.",
        )

    # 1. Field officer restrictions
    if current_user.role == "field_officer":
        if intervention.assigned_officer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. This intervention is not assigned to you.",
            )
        valid_field_transitions = {
            ("Approved", "In Progress"),
            ("In Progress", "Completed"),
        }
        if (intervention.status, payload.new_status) not in valid_field_transitions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Field officers cannot transition status from '{intervention.status}' to '{payload.new_status}'.",
            )

    # 2. Equipment coordinator restrictions
    elif current_user.role == "equipment_coordinator":
        if not (intervention.status == "Approved" and payload.new_status == "In Progress"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Equipment coordinators may only transition Approved interventions to In Progress for machinery dispatch.",
            )

    try:
        return update_intervention_status(db=db, intervention_id=intervention_id, payload=payload)
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e).strip("'"),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )


@router.post("/interventions/{intervention_id}/verify", response_model=InterventionItem)
def verify_intervention(
    intervention_id: str,
    payload: FieldVerificationCreate,
    current_officer: UserModel = Depends(require_roles("field_officer", "admin")),
    db: Session = Depends(get_db),
):
    """Record an on-site field verification audit and mark completion status as Field-Verified.

    Strictly restricted to assigned field_officer and administrative roles (admin, super_admin).
    """
    intervention = get_intervention_by_id(db=db, intervention_id=intervention_id)
    if not intervention:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Intervention with ID '{intervention_id}' was not found.",
        )

    # Field officer cross-record verification check
    if current_officer.role == "field_officer" and intervention.assigned_officer_id != current_officer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only verify interventions assigned to you.",
        )

    try:
        return record_field_verification(db=db, intervention_id=intervention_id, payload=payload)
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e).strip("'"),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
