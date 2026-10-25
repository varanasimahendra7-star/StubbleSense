from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_village_risk_returns_200_and_valid_schema():
    response = client.get("/api/villages/risk")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "data_notice" in data
    assert "scoring_formula_summary" in data
    assert "items" in data
    assert data["total"] > 0
    assert len(data["items"]) == data["total"]
    assert "DEMO DATA NOTICE" in data["data_notice"]

    # Verify first item keys
    first_item = data["items"][0]
    required_keys = {
        "id",
        "name",
        "district",
        "state",
        "latitude",
        "longitude",
        "risk_score",
        "risk_category",
        "nearby_fire_count",
        "high_confidence_fire_count",
        "reasons",
        "is_synthetic",
    }
    assert required_keys.issubset(first_item.keys())
    assert first_item["is_synthetic"] is True
    assert isinstance(first_item["reasons"], list)
    assert len(first_item["reasons"]) > 0


def test_village_risk_ordering():
    response = client.get("/api/villages/risk")
    assert response.status_code == 200
    data = response.json()
    scores = [item["risk_score"] for item in data["items"]]
    # Should be sorted descending
    assert scores == sorted(scores, reverse=True)


def test_village_zero_fire_handling():
    response = client.get("/api/villages/risk?district=Rupnagar")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    rupnagar_village = data["items"][0]
    assert rupnagar_village["risk_score"] == 0.0
    assert rupnagar_village["risk_category"] == "Low"
    assert rupnagar_village["nearby_fire_count"] == 0
    assert any("Zero thermal fire" in r for r in rupnagar_village["reasons"])


def test_village_high_risk_reasons():
    response = client.get("/api/villages/risk?district=Sangrur")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    top_village = data["items"][0]
    assert 50.0 <= top_village["risk_score"] <= 100.0
    assert top_village["risk_category"] in ("High", "Critical")
    assert top_village["nearby_fire_count"] >= 1
    assert any("monitoring radius" in r for r in top_village["reasons"])
    # Cautious phrasing check: must not claim FRP alone proves crop combustion
    assert all("indicates intense crop combustion" not in r for r in top_village["reasons"])
    assert any("synthetic fire radiative power" in r for r in top_village["reasons"])


def test_village_risk_filter_by_state():
    response = client.get("/api/villages/risk?state=Haryana")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    for item in data["items"]:
        assert item["state"].lower() == "haryana"


def test_village_risk_filter_by_category():
    response = client.get("/api/villages/risk?category=Low")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    for item in data["items"]:
        assert item["risk_category"].lower() == "low"
