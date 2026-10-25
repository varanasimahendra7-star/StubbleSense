from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_fire_events_returns_200_and_schema():
    response = client.get("/api/fire-events")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "data_notice" in data
    assert "items" in data
    assert data["total"] > 0
    assert len(data["items"]) == data["total"]

    # Verify each item structure and synthetic tag
    first_item = data["items"][0]
    required_keys = {
        "id",
        "latitude",
        "longitude",
        "district",
        "state",
        "observed_at",
        "confidence",
        "brightness_kelvin",
        "frp_mw",
        "satellite",
        "is_synthetic",
    }
    assert required_keys.issubset(first_item.keys())
    assert first_item["is_synthetic"] is True
    assert "SYNTHETIC" in data["data_notice"]


def test_get_fire_events_filter_by_district():
    response = client.get("/api/fire-events?district=Sangrur")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 2
    for item in data["items"]:
        assert item["district"].lower() == "sangrur"


def test_get_fire_events_filter_by_state():
    response = client.get("/api/fire-events?state=Haryana")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    for item in data["items"]:
        assert item["state"].lower() == "haryana"


def test_get_fire_events_filter_by_date():
    response = client.get("/api/fire-events?date=2026-10-25")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    for item in data["items"]:
        assert item["observed_at"].startswith("2026-10-25")
