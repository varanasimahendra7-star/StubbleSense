from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from app.schemas.equipment import EquipmentListResponse, VillageAllocationResponse
from app.services.equipment_allocation import (
    get_all_equipment,
    recommend_equipment_for_village,
)

router = APIRouter(tags=["Equipment Allocation"])


@router.get("/equipment", response_model=EquipmentListResponse)
def list_equipment(
    equipment_type: Optional[str] = Query(None, description="Filter by machinery type"),
    status: Optional[str] = Query(None, description="Filter by status (Available, In-Use, Maintenance)"),
    district: Optional[str] = Query(None, description="Filter by district"),
    state: Optional[str] = Query(None, description="Filter by state (Punjab, Haryana)"),
):
    """Retrieve synthetic agricultural machinery units stationed across CHCs and depots."""
    items = get_all_equipment(
        equipment_type=equipment_type,
        status=status,
        district=district,
        state=state,
    )
    return EquipmentListResponse(
        total=len(items),
        items=items,
    )


@router.get("/equipment/recommendations", response_model=VillageAllocationResponse)
def get_village_equipment_recommendations(
    village_id: str = Query(..., description="Target village identifier (e.g. DEMO-VILL-PB-01)"),
    max_distance_km: float = Query(50.0, ge=1.0, le=200.0, description="Maximum search radius in kilometers"),
    include_unavailable: bool = Query(False, description="Whether to include In-Use or Maintenance machinery"),
    equipment_type: Optional[str] = Query(None, description="Optional machinery type filter"),
):
    """Generate explainable equipment recommendations for a selected village.

    All recommendations are illustrative synthetic demonstrations and do NOT constitute
    physical dispatch, booking, or certified fire elimination.
    """
    result = recommend_equipment_for_village(
        village_id=village_id,
        max_distance_km=max_distance_km,
        include_unavailable=include_unavailable,
        equipment_type=equipment_type,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Village with ID '{village_id}' not found in the synthetic village registry",
        )

    return result
