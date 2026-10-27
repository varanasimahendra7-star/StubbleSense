from typing import Optional
from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user
from app.models.user import UserModel
from app.schemas.village_risk import VillageRiskResponse
from app.services.risk_scoring import get_village_risk_rankings

router = APIRouter(tags=["Villages"])


@router.get("/villages/risk", response_model=VillageRiskResponse)
def get_village_risk_ranking(
    state: Optional[str] = Query(None, description="Filter by state (Punjab, Haryana)"),
    district: Optional[str] = Query(None, description="Filter by district name"),
    category: Optional[str] = Query(None, description="Filter by risk category (Critical, High, Medium, Low)"),
    min_score: Optional[float] = Query(None, description="Minimum risk score threshold (0-100)"),
    current_user: UserModel = Depends(get_current_user),
):
    """Retrieve explainable village risk rankings based on synthetic fire proximity.

    All scores are illustrative synthetic demonstrations and not validated predictions.
    """
    items = get_village_risk_rankings(
        state=state,
        district=district,
        category=category,
        min_score=min_score,
    )
    return VillageRiskResponse(
        total=len(items),
        items=items,
    )
