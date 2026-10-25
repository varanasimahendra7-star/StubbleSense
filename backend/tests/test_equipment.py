from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_list_equipment_returns_200_and_schema():
    response = client.get("/api/equipment")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "data_notice" in data
    assert "items" in data
    assert data["total"] > 0
    assert len(data["items"]) == data["total"]
    assert "DEMO DATA NOTICE" in data["data_notice"]

    first_item = data["items"][0]
    required_keys = {
        "id",
        "name",
        "equipment_type",
        "category",
        "hub_name",
        "district",
        "state",
        "latitude",
        "longitude",
        "status",
        "capacity_acres_per_day",
        "daily_rental_inr",
        "contact_officer",
        "is_synthetic",
    }
    assert required_keys.issubset(first_item.keys())
    assert first_item["is_synthetic"] is True


def test_list_equipment_filter_by_status():
    response = client.get("/api/equipment?status=Available")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    for item in data["items"]:
        assert item["status"].lower() == "available"


def test_list_equipment_filter_by_type():
    response = client.get("/api/equipment?equipment_type=Happy Seeder")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    for item in data["items"]:
        assert item["equipment_type"].lower() == "happy seeder"


def test_recommendations_for_valid_village():
    # Khurana village in Sangrur
    response = client.get("/api/equipment/recommendations?village_id=DEMO-VILL-PB-01")
    assert response.status_code == 200
    data = response.json()
    assert "village" in data
    assert data["village"]["id"] == "DEMO-VILL-PB-01"
    assert "total_recommendations" in data
    assert "recommendations" in data
    assert data["total_recommendations"] > 0

    first_rec = data["recommendations"][0]
    assert "equipment" in first_rec
    assert "distance_km" in first_rec
    assert "suitability_score" in first_rec
    assert "recommendation_reasons" in first_rec
    assert "caution_notice" in first_rec

    # Geodesic distance must be realistic positive number
    assert 0.0 < first_rec["distance_km"] <= 50.0
    # Must have explainable reasons
    assert len(first_rec["recommendation_reasons"]) >= 3
    # Caution notice must state it does not guarantee dispatch
    assert "Does not constitute physical dispatch" in first_rec["caution_notice"]


def test_recommendations_unknown_village_returns_404():
    response = client.get("/api/equipment/recommendations?village_id=UNKNOWN-VILLAGE-999")
    assert response.status_code == 404
    detail = response.json()["detail"]
    assert "not found" in detail.lower()


def test_recommendations_invalid_distance_query_returns_422():
    # max_distance_km has le=200 and ge=1
    response = client.get("/api/equipment/recommendations?village_id=DEMO-VILL-PB-01&max_distance_km=0.5")
    assert response.status_code == 422


def test_recommendations_empty_when_radius_too_small():
    # 1.0 km radius from Khurana (closest hub is ~3-5 km away)
    response = client.get("/api/equipment/recommendations?village_id=DEMO-VILL-PB-01&max_distance_km=1.0")
    assert response.status_code == 200
    data = response.json()
    assert data["total_recommendations"] == 0
    assert data["recommendations"] == []
