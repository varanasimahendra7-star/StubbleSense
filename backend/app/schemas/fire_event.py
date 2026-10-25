from typing import List
from pydantic import BaseModel, Field


class FireObservation(BaseModel):
    """Schema for a single synthetic fire observation."""

    id: str = Field(..., description="Unique deterministic identifier for demo fire observation")
    latitude: float = Field(..., description="Latitude coordinate (Punjab/Haryana)")
    longitude: float = Field(..., description="Longitude coordinate (Punjab/Haryana)")
    district: str = Field(..., description="District name")
    state: str = Field(..., description="State name (Punjab or Haryana)")
    observed_at: str = Field(..., description="Observation timestamp in ISO 8601 UTC")
    confidence: str = Field(..., description="Confidence level: nominal, high, or low")
    brightness_kelvin: float = Field(..., description="Brightness temperature in Kelvin")
    frp_mw: float = Field(..., description="Fire Radiative Power in Megawatts")
    satellite: str = Field(..., description="Synthetic satellite sensor label")
    is_synthetic: bool = Field(True, description="Explicit flag indicating synthetic demonstration data")


class FireEventsResponse(BaseModel):
    """API response container for fire observations."""

    total: int = Field(..., description="Total count of fire events matching filter")
    data_notice: str = Field(
        "SYNTHETIC DEMO DATA - Generated for demonstration and testing. Not live NASA FIRMS observations.",
        description="Clear data provenance notice",
    )
    items: List[FireObservation]
