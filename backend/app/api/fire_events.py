from typing import Optional
from fastapi import APIRouter, Query

from app.data.synthetic_fires import get_synthetic_fire_events
from app.schemas.fire_event import FireEventsResponse

router = APIRouter(tags=["Fire Events"])


@router.get("/fire-events", response_model=FireEventsResponse)
def get_fire_events(
    district: Optional[str] = Query(None, description="Filter by district name (case-insensitive)"),
    state: Optional[str] = Query(None, description="Filter by state (Punjab, Haryana)"),
    date: Optional[str] = Query(None, description="Filter by date string prefix (e.g. YYYY-MM-DD)"),
):
    """Retrieve deterministic synthetic fire observation events for demonstration.

    All returned observations are strictly synthetic demo data for regional testing.
    """
    items = get_synthetic_fire_events(district=district, state=state, date=date)
    return FireEventsResponse(
        total=len(items),
        items=items,
    )
