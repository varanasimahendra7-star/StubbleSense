from typing import List
from pydantic import BaseModel, Field


class VillageRiskItem(BaseModel):
    """Schema for explainable village risk assessment."""

    id: str = Field(..., description="Stable unique identifier for the village")
    name: str = Field(..., description="Village or rural settlement name")
    district: str = Field(..., description="District name")
    state: str = Field(..., description="State name (Punjab or Haryana)")
    latitude: float = Field(..., description="Latitude coordinate")
    longitude: float = Field(..., description="Longitude coordinate")
    risk_score: float = Field(..., description="Numeric risk score from 0.0 to 100.0")
    risk_category: str = Field(..., description="Risk category: Critical, High, Medium, or Low")
    nearby_fire_count: int = Field(..., description="Number of synthetic fires within 15 km radius")
    high_confidence_fire_count: int = Field(..., description="Number of nearby fires with high confidence")
    reasons: List[str] = Field(..., description="Human-readable factors explaining the score")
    is_synthetic: bool = Field(True, description="Explicit flag indicating synthetic demonstration data")


class VillageRiskResponse(BaseModel):
    """API response container for explainable village risk ranking."""

    total: int = Field(..., description="Total count of villages in response")
    data_notice: str = Field(
        "DEMO DATA NOTICE: All village risk scores are illustrative synthetic calculations based on demo fire events. They are NOT certified or field-validated risk predictions.",
        description="Clear data provenance notice",
    )
    scoring_formula_summary: str = Field(
        "Risk Score = min(100, Proximity Density (max 45) + Confidence Severity (max 30) + Recency (max 20) + High FRP Intensity (max 15)). Categories: Critical (>=75), High (50-74), Medium (25-49), Low (<25).",
        description="Transparent scoring formula summary",
    )
    items: List[VillageRiskItem]
