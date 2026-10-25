from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
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
    db: Session = Depends(get_db),
):
    """Retrieve agricultural residue intervention records with optional filtering."""
    items = get_interventions(
        db=db,
        village_id=village_id,
        status=status_filter,
        completion_status=completion_status,
        district=district,
    )
    return InterventionListResponse(
        total=len(items),
        items=items,
    )


@router.post("/interventions", response_model=InterventionItem, status_code=status.HTTP_201_CREATED)
def create_new_intervention(
    payload: InterventionCreate,
    db: Session = Depends(get_db),
):
    """Create a new intervention record linked to a village and optional machinery."""
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
    db: Session = Depends(get_db),
):
    """Retrieve a single intervention with full audit history and field verification."""
    item = get_intervention_by_id(db=db, intervention_id=intervention_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Intervention with ID '{intervention_id}' was not found.",
        )
    return item


@router.patch("/interventions/{intervention_id}/status", response_model=InterventionItem)
def change_intervention_status(
    intervention_id: str,
    payload: InterventionStatusUpdate,
    db: Session = Depends(get_db),
):
    """Transition intervention lifecycle status and record entry in audit trail."""
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
    db: Session = Depends(get_db),
):
    """Record an on-site field verification audit and mark completion status as Field-Verified."""
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
