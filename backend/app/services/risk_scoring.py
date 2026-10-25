import math
from typing import List, Optional
from app.data.synthetic_fires import (
    DEMO_PREVIOUS_DATE,
    DEMO_REFERENCE_DATE,
    SYNTHETIC_FIRE_EVENTS,
)
from app.data.synthetic_villages import SYNTHETIC_VILLAGES
from app.schemas.village_risk import VillageRiskItem


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two points on Earth in kilometers."""
    radius_km = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return radius_km * c


def calculate_village_risk(village: dict) -> VillageRiskItem:
    """Calculate deterministic explainable risk score for a single village."""
    v_lat = village["latitude"]
    v_lon = village["longitude"]

    nearby_fires: List[dict] = []
    close_fires: List[dict] = []

    for fire in SYNTHETIC_FIRE_EVENTS:
        dist = haversine_km(v_lat, v_lon, fire["latitude"], fire["longitude"])
        if dist <= 15.0:
            fire_with_dist = dict(fire)
            fire_with_dist["distance_km"] = dist
            nearby_fires.append(fire_with_dist)
            if dist <= 5.0:
                close_fires.append(fire_with_dist)

    nearby_count = len(nearby_fires)
    high_conf_fires = [f for f in nearby_fires if f["confidence"].lower() == "high"]
    high_conf_count = len(high_conf_fires)

    if nearby_count == 0:
        return VillageRiskItem(
            id=village["id"],
            name=village["name"],
            district=village["district"],
            state=village["state"],
            latitude=v_lat,
            longitude=v_lon,
            risk_score=0.0,
            risk_category="Low",
            nearby_fire_count=0,
            high_confidence_fire_count=0,
            reasons=[
                "Zero thermal fire observations detected within 15 km monitoring radius",
                "Baseline illustrative demo risk level",
            ],
            is_synthetic=True,
        )

    # 1. Proximity score (Max 45)
    prox_score = min(45.0, len(close_fires) * 20.0 + (nearby_count - len(close_fires)) * 12.0)

    # 2. Confidence severity score (Max 30)
    conf_score = min(30.0, high_conf_count * 15.0 + (nearby_count - high_conf_count) * 6.0)

    # 3. Recency score (Max 20, relative to documented deterministic demo reference date)
    dates = [f["observed_at"].split("T")[0] for f in nearby_fires]
    if DEMO_REFERENCE_DATE in dates:
        recency_score = 20.0
        latest_date_str = f"{DEMO_REFERENCE_DATE} (Demo Active Date)"
    elif DEMO_PREVIOUS_DATE in dates:
        recency_score = 12.0
        latest_date_str = f"{DEMO_PREVIOUS_DATE} (Demo Prior Day)"
    else:
        recency_score = 6.0
        latest_date_str = "Prior Demo Date"

    # 4. Intensity / FRP score (Max 15)
    max_frp = max(f["frp_mw"] for f in nearby_fires)
    if max_frp >= 25.0:
        frp_score = 15.0
    elif max_frp >= 18.0:
        frp_score = 8.0
    else:
        frp_score = 4.0

    raw_score = prox_score + conf_score + recency_score + frp_score
    risk_score = round(min(100.0, max(0.0, raw_score)), 1)

    # Category determination
    if risk_score >= 75.0:
        category = "Critical"
    elif risk_score >= 50.0:
        category = "High"
    elif risk_score >= 25.0:
        category = "Medium"
    else:
        category = "Low"

    # Human-readable reasons with cautious, explicitly synthetic phrasing
    reasons: List[str] = [
        f"{nearby_count} synthetic fire observation(s) within 15 km monitoring radius",
    ]
    if close_fires:
        reasons.append(f"{len(close_fires)} active thermal cluster(s) located within immediate 5 km zone")
    if high_conf_count > 0:
        reasons.append(f"{high_conf_count} high-confidence satellite detection(s)")
    reasons.append(f"Peak synthetic fire radiative power of {max_frp} MW recorded in nearby demo observation")
    reasons.append(f"Most recent active observation recorded on {latest_date_str}")

    return VillageRiskItem(
        id=village["id"],
        name=village["name"],
        district=village["district"],
        state=village["state"],
        latitude=v_lat,
        longitude=v_lon,
        risk_score=risk_score,
        risk_category=category,
        nearby_fire_count=nearby_count,
        high_confidence_fire_count=high_conf_count,
        reasons=reasons,
        is_synthetic=True,
    )


def get_village_risk_rankings(
    state: Optional[str] = None,
    district: Optional[str] = None,
    category: Optional[str] = None,
    min_score: Optional[float] = None,
) -> List[VillageRiskItem]:
    """Calculate and return sorted list of villages by risk score (descending)."""
    scored_villages = [calculate_village_risk(v) for v in SYNTHETIC_VILLAGES]

    # Apply filters
    filtered = []
    for item in scored_villages:
        if state and state.lower() != "all" and item.state.lower() != state.lower():
            continue
        if district and district.lower() != "all" and item.district.lower() != district.lower():
            continue
        if category and category.lower() != "all" and item.risk_category.lower() != category.lower():
            continue
        if min_score is not None and item.risk_score < min_score:
            continue
        filtered.append(item)

    # Sort descending by risk score, then alphabetically by village name
    filtered.sort(key=lambda x: (-x.risk_score, x.name))
    return filtered
