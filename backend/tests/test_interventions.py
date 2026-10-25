import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db, init_db
from app.data.synthetic_interventions import seed_initial_interventions
from app.main import app


@pytest.fixture(name="test_session")
def fixture_test_session():
    """Create an isolated in-memory SQLite database for test execution."""
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    init_db(test_engine)

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(name="client")
def fixture_client(test_session):
    """FastAPI TestClient with isolated test database dependency override."""
    def override_get_db():
        try:
            yield test_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(app)
    try:
        yield test_client
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_seeding_and_list_interventions(client):
    """Initial query should seed 5 synthetic interventions with provenance notice."""
    response = client.get("/api/interventions")
    assert response.status_code == 200
    data = response.json()

    assert data["total"] == 5
    assert len(data["items"]) == 5
    assert "DEMO DATA NOTICE" in data["data_notice"]

    # All seeded items must be explicitly marked as synthetic
    for item in data["items"]:
        assert item["is_synthetic"] is True
        assert len(item["audits"]) > 0


def test_seeding_is_idempotent(test_session):
    """Multiple seeding invocations must never create duplicate demo records."""
    # First seeding
    seeded_first = seed_initial_interventions(test_session)
    assert seeded_first == 5

    # Second and third invocations should do nothing
    seeded_second = seed_initial_interventions(test_session)
    assert seeded_second == 0

    seeded_third = seed_initial_interventions(test_session)
    assert seeded_third == 0


def test_create_intervention_success(client):
    """Creating an intervention for a valid village and machinery should succeed."""
    payload = {
        "village_id": "DEMO-VILL-PB-01",
        "equipment_id": "DEMO-EQ-001",
        "intervention_type": "In-situ Happy Seeding",
        "target_acres": 40.0,
        "notes": "Test cluster requisition",
        "requested_by": "Test Nodal Coordinator",
    }
    response = client.post("/api/interventions", json=payload)
    assert response.status_code == 201
    item = response.json()

    assert item["village_name"] == "Khurana"
    assert item["equipment_name"] == "Turbo Happy Seeder #04"
    assert item["status"] == "Proposed"
    assert item["completion_status"] == "Pending"
    assert item["target_acres"] == 40.0
    assert item["is_synthetic"] is True

    # Audit history should contain the initial proposal
    assert len(item["audits"]) == 1
    assert item["audits"][0]["to_status"] == "Proposed"
    assert item["audits"][0]["changed_by"] == "Test Nodal Coordinator"


def test_create_intervention_invalid_village(client):
    """Creating an intervention with an unknown village ID should return 404."""
    payload = {
        "village_id": "NONEXISTENT-VILLAGE",
        "intervention_type": "In-situ Mulching",
        "target_acres": 25.0,
        "requested_by": "Test Coordinator",
    }
    response = client.post("/api/interventions", json=payload)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_create_intervention_invalid_equipment(client):
    """Creating an intervention with an unknown equipment ID should return 404."""
    payload = {
        "village_id": "DEMO-VILL-PB-01",
        "equipment_id": "NONEXISTENT-EQUIPMENT",
        "intervention_type": "In-situ Mulching",
        "target_acres": 25.0,
        "requested_by": "Test Coordinator",
    }
    response = client.post("/api/interventions", json=payload)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_status_transitions_and_audit_history(client):
    """Lifecycle transitions must be logged in audit trail and Completed sets Self-Reported."""
    # 1. Fetch INT-2026-HR-005 which is in Proposed status
    detail_res = client.get("/api/interventions/INT-2026-HR-005")
    assert detail_res.status_code == 200
    assert detail_res.json()["status"] == "Proposed"

    # 2. Transition Proposed -> Approved
    res_appr = client.patch(
        "/api/interventions/INT-2026-HR-005/status",
        json={"new_status": "Approved", "changed_by": "Officer Verma", "reason": "Budget approved"},
    )
    assert res_appr.status_code == 200
    assert res_appr.json()["status"] == "Approved"

    # 3. Transition Approved -> In Progress
    res_prog = client.patch(
        "/api/interventions/INT-2026-HR-005/status",
        json={"new_status": "In Progress", "changed_by": "CHC Operator", "reason": "Tractor dispatched"},
    )
    assert res_prog.status_code == 200
    assert res_prog.json()["status"] == "In Progress"

    # 4. Transition In Progress -> Completed
    # Crucial rule: Transitioning to Completed sets Self-Reported, NOT Field-Verified
    res_comp = client.patch(
        "/api/interventions/INT-2026-HR-005/status",
        json={"new_status": "Completed", "changed_by": "Farmer Lead G. Singh", "reason": "All 25 acres mulched"},
    )
    assert res_comp.status_code == 200
    comp_data = res_comp.json()
    assert comp_data["status"] == "Completed"
    assert comp_data["completion_status"] == "Self-Reported"
    assert comp_data["completion_status"] != "Field-Verified"

    # 5. Audit history must have all steps
    audits = comp_data["audits"]
    assert len(audits) >= 4
    to_statuses = [a["to_status"] for a in audits]
    assert "Proposed" in to_statuses
    assert "Approved" in to_statuses
    assert "In Progress" in to_statuses
    assert "Completed" in to_statuses


def test_reject_invalid_status_transition(client):
    """Invalid status transition must be rejected with HTTP 422."""
    # INT-2026-HR-005 starts in Proposed; cannot jump directly to Completed
    res = client.patch(
        "/api/interventions/INT-2026-HR-005/status",
        json={"new_status": "Completed", "changed_by": "Hacker", "reason": "Skipping steps"},
    )
    assert res.status_code == 422
    assert "Invalid status transition" in res.json()["detail"]


def test_field_verification_elevates_to_field_verified(client):
    """Recording field verification strictly sets completion status to Field-Verified."""
    # INT-2026-PB-002 is Self-Reported Completed
    res_before = client.get("/api/interventions/INT-2026-PB-002")
    assert res_before.json()["completion_status"] == "Self-Reported"
    assert res_before.json()["verification"] is None

    # Submit ground field verification
    verify_payload = {
        "verifier_name": "Nodal Officer S. Sandhu",
        "outcome": "Verified Cleared",
        "verified_acres": 60.0,
        "evidence_metadata": {
            "inspection_lat": 30.2745,
            "inspection_lon": 75.9812,
            "method": "GPS perimeter walk",
        },
        "verification_notes": "All square bales removed and transported to bio-pellet plant.",
    }
    res_verify = client.post("/api/interventions/INT-2026-PB-002/verify", json=verify_payload)
    assert res_verify.status_code == 200
    data = res_verify.json()

    # Must be elevated to Field-Verified
    assert data["completion_status"] == "Field-Verified"
    assert data["verification"] is not None
    assert data["verification"]["outcome"] == "Verified Cleared"
    assert data["verification"]["verified_acres"] == 60.0
    assert data["verification"]["is_synthetic"] is True
    assert data["verification"]["evidence_metadata"]["is_synthetic"] is True

    # Audit history should record the verification
    last_audit = data["audits"][-1]
    assert "field verification" in last_audit["reason"].lower()


def test_get_intervention_404(client):
    """Querying nonexistent intervention returns 404."""
    res = client.get("/api/interventions/INT-UNKNOWN-999")
    assert res.status_code == 404
    assert "was not found" in res.json()["detail"]
