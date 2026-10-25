from typing import List
from pydantic import BaseModel, Field

from app.schemas.village_risk import VillageRiskItem


class EquipmentItem(BaseModel):
    """Schema for a synthetic crop residue management machine."""

    id: str = Field(..., description="Unique deterministic identifier for equipment")
    name: str = Field(..., description="Display name and machine unit number")
    equipment_type: str = Field(..., description="Equipment type (e.g. Happy Seeder, Paddy Straw Baler)")
    category: str = Field(..., description="Management method (In-situ Management or Ex-situ Management)")
    hub_name: str = Field(..., description="Custom Hiring Center (CHC) or cooperative depot name")
    district: str = Field(..., description="District where the equipment is stationed")
    state: str = Field(..., description="State (Punjab or Haryana)")
    latitude: float = Field(..., description="Hub latitude coordinate")
    longitude: float = Field(..., description="Hub longitude coordinate")
    status: str = Field(..., description="Current availability: Available, In-Use, or Maintenance")
    capacity_acres_per_day: float = Field(..., description="Operational processing capacity in acres/day")
    daily_rental_inr: int = Field(..., description="Indicative daily subsidized hiring rate in INR")
    contact_officer: str = Field(..., description="Designated CHC nodal contact person")
    is_synthetic: bool = Field(True, description="Explicit flag indicating synthetic demonstration data")


class EquipmentListResponse(BaseModel):
    """Response container for fleet listing."""

    total: int = Field(..., description="Total count of equipment items matching filters")
    data_notice: str = Field(
        "DEMO DATA NOTICE: All equipment units, Custom Hiring Centers, and availability states are illustrative synthetic demonstration records.",
        description="Data provenance notice",
    )
    items: List[EquipmentItem]


class EquipmentRecommendation(BaseModel):
    """Enriched recommendation associating equipment with a target village."""

    equipment: EquipmentItem
    distance_km: float = Field(..., description="Accurate geodesic distance from village to equipment hub in kilometers")
    suitability_score: float = Field(..., description="Illustrative matching score from 0.0 to 100.0")
    recommendation_reasons: List[str] = Field(..., description="Transparent explainable matching factors")
    caution_notice: str = Field(
        "Illustrative demo recommendation based on synthetic hub proximity. Does not constitute physical dispatch or guaranteed fire prevention.",
        description="Cautionary note clarifying recommendation limits",
    )


class VillageAllocationResponse(BaseModel):
    """Response container for village equipment recommendations."""

    village: VillageRiskItem
    total_recommendations: int
    data_notice: str = Field(
        "DEMO DATA NOTICE: All equipment recommendations are illustrative synthetic matching results. They do not initiate live dispatch or guarantee eradication of residue burning.",
        description="Data provenance notice",
    )
    recommendations: List[EquipmentRecommendation]
