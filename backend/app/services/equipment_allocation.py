from typing import List, Optional
from app.data.synthetic_equipment import SYNTHETIC_EQUIPMENT
from app.data.synthetic_villages import SYNTHETIC_VILLAGES
from app.schemas.equipment import (
    EquipmentItem,
    EquipmentRecommendation,
    VillageAllocationResponse,
)
from app.services.risk_scoring import calculate_village_risk, haversine_km


def get_all_equipment(
    equipment_type: Optional[str] = None,
    status: Optional[str] = None,
    district: Optional[str] = None,
    state: Optional[str] = None,
) -> List[EquipmentItem]:
    """Retrieve and filter equipment units from the synthetic fleet registry."""
    results: List[EquipmentItem] = []

    for item in SYNTHETIC_EQUIPMENT:
        if equipment_type and equipment_type.lower() != "all" and item["equipment_type"].lower() != equipment_type.lower():
            continue
        if status and status.lower() != "all" and item["status"].lower() != status.lower():
            continue
        if district and district.lower() != "all" and item["district"].lower() != district.lower():
            continue
        if state and state.lower() != "all" and item["state"].lower() != state.lower():
            continue

        results.append(EquipmentItem(**item))

    # Sort deterministically by status (Available first), then by name
    status_order = {"Available": 0, "In-Use": 1, "Maintenance": 2}
    results.sort(key=lambda x: (status_order.get(x.status, 3), x.name))
    return results


def recommend_equipment_for_village(
    village_id: str,
    max_distance_km: float = 50.0,
    include_unavailable: bool = False,
    equipment_type: Optional[str] = None,
) -> Optional[VillageAllocationResponse]:
    """Generate explainable equipment recommendations for a specific village.

    Returns None if the village_id is not found in the synthetic village registry.
    """
    # 1. Locate the village
    village_dict = next((v for v in SYNTHETIC_VILLAGES if v["id"] == village_id), None)
    if not village_dict:
        return None

    # 2. Compute current village risk profile
    village_risk = calculate_village_risk(village_dict)

    # 3. Match and score equipment within max_distance_km
    recommendations: List[EquipmentRecommendation] = []
    v_lat = village_dict["latitude"]
    v_lon = village_dict["longitude"]

    for eq in SYNTHETIC_EQUIPMENT:
        if equipment_type and equipment_type.lower() != "all" and eq["equipment_type"].lower() != equipment_type.lower():
            continue

        if not include_unavailable and eq["status"] != "Available":
            continue

        dist_km = round(haversine_km(v_lat, v_lon, eq["latitude"], eq["longitude"]), 1)
        if dist_km > max_distance_km:
            continue

        # Explainable suitability computation
        # Proximity score (Closer = higher, max 50 pts)
        prox_score = max(0.0, (max_distance_km - dist_km) / max_distance_km * 50.0)

        # Risk priority match (Max 35 pts)
        is_high_capacity = eq["capacity_acres_per_day"] >= 14.0
        if village_risk.risk_category in ("Critical", "High"):
            if eq["equipment_type"] in ("Happy Seeder", "Paddy Straw Baler", "Super SMS Combine") and is_high_capacity:
                match_score = 35.0
                match_reason = f"High-throughput {eq['equipment_type']} ({eq['category']}) suited for {village_risk.risk_category} priority zone"
            else:
                match_score = 22.0
                match_reason = f"Standard {eq['equipment_type']} suited for supplementary residue mitigation"
        else:
            match_score = 25.0
            match_reason = f"{eq['equipment_type']} appropriate for {village_risk.risk_category} baseline management"

        # Availability bonus (15 pts if available)
        avail_score = 15.0 if eq["status"] == "Available" else 0.0

        raw_suitability = prox_score + match_score + avail_score
        suitability = round(min(99.0, max(10.0, raw_suitability)), 1)

        # Explainable reasons
        reasons = [
            f"Stationed {dist_km} km from village at {eq['hub_name']} ({eq['district']})",
            f"Operational throughput: {eq['capacity_acres_per_day']} acres/day ({eq['category']})",
            match_reason,
            f"Current status: {eq['status']} | Indicative subsidized hiring rate: Rs {eq['daily_rental_inr']}/day",
        ]

        recommendations.append(
            EquipmentRecommendation(
                equipment=EquipmentItem(**eq),
                distance_km=dist_km,
                suitability_score=suitability,
                recommendation_reasons=reasons,
            )
        )

    # Sort descending by suitability score, then ascending by distance
    recommendations.sort(key=lambda r: (-r.suitability_score, r.distance_km))

    return VillageAllocationResponse(
        village=village_risk,
        total_recommendations=len(recommendations),
        recommendations=recommendations,
    )
