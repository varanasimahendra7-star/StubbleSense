from datetime import timedelta
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, hash_password
from app.database import Base, get_db, init_db
from app.main import app
from app.models.intervention import InterventionModel
from app.models.user import UserModel
from app.services.user_service import ensure_initial_super_admin, seed_dev_demo_users


@pytest.fixture(name="test_session")
def fixture_test_session():
    """Create isolated SQLite in-memory database with test users and sample interventions."""
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    init_db(test_engine)

    db = TestingSessionLocal()
    try:
        # Seed test users for each role
        super_user = UserModel(
            id="TEST-SUPER-01",
            username="super_tester",
            full_name="Test Super Admin",
            hashed_password=hash_password("SuperPass123!"),
            role="super_admin",
            is_active=True,
            is_synthetic=True,
        )
        admin_user = UserModel(
            id="TEST-ADMIN-01",
            username="admin_tester",
            full_name="Test Administrator",
            hashed_password=hash_password("AdminPass123!"),
            role="admin",
            is_active=True,
            is_synthetic=True,
        )
        field_user_1 = UserModel(
            id="TEST-FIELD-01",
            username="field_tester_a",
            full_name="Officer Alpha",
            hashed_password=hash_password("FieldPassA123!"),
            role="field_officer",
            is_active=True,
            is_synthetic=True,
        )
        field_user_2 = UserModel(
            id="TEST-FIELD-02",
            username="field_tester_b",
            full_name="Officer Bravo",
            hashed_password=hash_password("FieldPassB123!"),
            role="field_officer",
            is_active=True,
            is_synthetic=True,
        )
        equip_user = UserModel(
            id="TEST-EQUIP-01",
            username="equip_tester",
            full_name="Test Equipment Coordinator",
            hashed_password=hash_password("EquipPass123!"),
            role="equipment_coordinator",
            is_active=True,
            is_synthetic=True,
        )
        inactive_user = UserModel(
            id="TEST-INACTIVE-01",
            username="inactive_tester",
            full_name="Test Inactive User",
            hashed_password=hash_password("InactivePass123!"),
            role="field_officer",
            is_active=False,
            is_synthetic=True,
        )
        db.add_all([super_user, admin_user, field_user_1, field_user_2, equip_user, inactive_user])
        db.commit()

        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(name="client")
def fixture_client(test_session):
    """FastAPI TestClient with overridden get_db."""
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


def auth_cookie_headers(client: TestClient, user_id: str, role: str, full_name: str) -> dict:
    """Helper to set access_token + csrf_token cookies and return X-CSRF-Token headers."""
    token = create_access_token(subject=user_id, role=role, full_name=full_name)
    csrf_token = f"csrf-token-for-{user_id}"
    client.cookies.set("access_token", token)
    client.cookies.set("csrf_token", csrf_token)
    return {"X-CSRF-Token": csrf_token}


# -----------------------------------------------------------------------------
# Base Authentication Tests
# -----------------------------------------------------------------------------

def test_login_successful_sets_httponly_and_csrf_cookies(client):
    """Successful login sets HttpOnly access_token, csrf_token cookie, and returns user profile."""
    res = client.post("/api/auth/login", json={"username": "admin_tester", "password": "AdminPass123!"})
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["username"] == "admin_tester"
    assert data["user"]["role"] == "admin"
    assert "hashed_password" not in data["user"]
    assert "csrf_token" in data and len(data["csrf_token"]) > 10

    # Verify cookies
    assert "access_token" in res.cookies
    assert "csrf_token" in res.cookies
    set_cookie_header = res.headers.get("set-cookie", "")
    assert "access_token" in set_cookie_header
    assert "HttpOnly" in set_cookie_header


def test_login_invalid_password(client):
    """Incorrect password returns HTTP 401."""
    res = client.post("/api/auth/login", json={"username": "admin_tester", "password": "WrongPassword!"})
    assert res.status_code == 401
    assert "Invalid username or password" in res.json()["detail"]


def test_login_unknown_user(client):
    """Nonexistent username returns HTTP 401."""
    res = client.post("/api/auth/login", json={"username": "ghost_user", "password": "SomePassword123!"})
    assert res.status_code == 401
    assert "Invalid username or password" in res.json()["detail"]


def test_login_inactive_user(client):
    """Disabled account returns HTTP 403."""
    res = client.post("/api/auth/login", json={"username": "inactive_tester", "password": "InactivePass123!"})
    assert res.status_code == 403
    assert "disabled" in res.json()["detail"].lower()


def test_logout_clears_cookies(client):
    """Logout endpoint deletes both session and CSRF cookies."""
    login_res = client.post("/api/auth/login", json={"username": "admin_tester", "password": "AdminPass123!"})
    assert login_res.status_code == 200
    csrf = login_res.json()["csrf_token"]

    logout_res = client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    assert logout_res.status_code == 200
    assert logout_res.json()["message"] == "Logged out successfully"


def test_get_me_authenticated(client):
    """GET /api/auth/me returns profile of logged-in user."""
    token = create_access_token(subject="TEST-FIELD-01", role="field_officer", full_name="Officer Alpha")
    client.cookies.set("access_token", token)

    res = client.get("/api/auth/me")
    assert res.status_code == 200
    assert res.json()["username"] == "field_tester_a"
    assert res.json()["role"] == "field_officer"


def test_unauthenticated_request_rejected(client):
    """Protected endpoints reject requests without valid session with HTTP 401."""
    res = client.get("/api/interventions")
    assert res.status_code == 401
    assert "Authentication required" in res.json()["detail"]


def test_expired_token_rejected(client):
    """Expired JWT token returns HTTP 401."""
    expired_token = create_access_token(
        subject="TEST-ADMIN-01",
        role="admin",
        full_name="Test Administrator",
        expires_delta=timedelta(minutes=-30),
    )
    client.cookies.set("access_token", expired_token)

    res = client.get("/api/auth/me")
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


# -----------------------------------------------------------------------------
# CSRF Protection Tests
# -----------------------------------------------------------------------------

def test_csrf_protection_enforcement(client):
    """Cookie-authenticated mutating requests require a valid X-CSRF-Token header."""
    # 1. Login to establish cookie session
    login_res = client.post("/api/auth/login", json={"username": "admin_tester", "password": "AdminPass123!"})
    csrf_token = login_res.json()["csrf_token"]

    payload = {
        "village_id": "DEMO-VILL-PB-01",
        "intervention_type": "In-situ Happy Seeding",
        "target_acres": 20.0,
        "requested_by": "CSRF Tester",
    }

    # 2. Mutating request with MISSING CSRF header -> 403 Forbidden
    res_missing = client.post("/api/interventions", json=payload)
    assert res_missing.status_code == 403
    assert "CSRF validation failed" in res_missing.json()["detail"]

    # 3. Mutating request with MISMATCHED CSRF header -> 403 Forbidden
    res_mismatched = client.post("/api/interventions", json=payload, headers={"X-CSRF-Token": "bad-csrf-token"})
    assert res_mismatched.status_code == 403
    assert "CSRF validation failed" in res_mismatched.json()["detail"]

    # 4. Mutating request with MATCHING CSRF header -> 201 Created
    res_valid = client.post("/api/interventions", json=payload, headers={"X-CSRF-Token": csrf_token})
    assert res_valid.status_code == 201

    # 5. Bearer token request without cookies -> succeeds without CSRF header (non-browser API client)
    client.cookies.clear()
    bearer_token = create_access_token(subject="TEST-ADMIN-01", role="admin", full_name="Admin")
    res_bearer = client.post(
        "/api/interventions",
        json=payload,
        headers={"Authorization": f"Bearer {bearer_token}"},
    )
    assert res_bearer.status_code == 201


# -----------------------------------------------------------------------------
# Super Admin & User Provisioning Tests
# -----------------------------------------------------------------------------

def test_super_admin_bootstrap_and_full_access(client, test_session, monkeypatch):
    """Super admin bootstrap creates developer account and passes all role authorization checks."""
    monkeypatch.setenv("INITIAL_SUPER_ADMIN_USERNAME", "dev_superadmin")
    monkeypatch.setenv("INITIAL_SUPER_ADMIN_PASSWORD", "SuperSecureDev2026!")
    monkeypatch.setenv("INITIAL_SUPER_ADMIN_FULL_NAME", "Lead System Developer")

    # Clear existing super_admin to test bootstrap
    test_session.query(UserModel).filter(UserModel.role == "super_admin").delete()
    test_session.commit()

    created = ensure_initial_super_admin(test_session)
    assert created is not None
    assert created.role == "super_admin"

    # Super admin authenticates
    headers = auth_cookie_headers(client, created.id, "super_admin", created.full_name)

    # 1. Access equipment recommendations (restricted to coordinator/admin/super_admin)
    res_rec = client.get("/api/equipment/recommendations?village_id=DEMO-VILL-PB-01")
    assert res_rec.status_code == 200

    # 2. Super admin can create intervention
    res_create = client.post(
        "/api/interventions",
        json={
            "village_id": "DEMO-VILL-PB-01",
            "intervention_type": "Ex-situ Baler Collection",
            "target_acres": 50.0,
            "requested_by": "Super Admin Requisition",
        },
        headers=headers,
    )
    assert res_create.status_code == 201

    # 3. Super admin can provision an administrator account
    res_prov = client.post(
        "/api/auth/users",
        json={
            "username": "new_regional_admin",
            "password": "PasswordAdmin123!",
            "full_name": "Regional Admin S. Gill",
            "role": "admin",
        },
        headers=headers,
    )
    assert res_prov.status_code == 201
    assert res_prov.json()["role"] == "admin"


def test_regular_admin_cannot_create_super_admin_or_admin(client):
    """Regular admins cannot provision super_admin or admin accounts (privilege escalation blocked)."""
    headers = auth_cookie_headers(client, "TEST-ADMIN-01", "admin", "Test Administrator")

    # 1. Admin attempts to create super_admin -> 403 Forbidden
    res_super = client.post(
        "/api/auth/users",
        json={
            "username": "escalated_super",
            "password": "Password123!",
            "full_name": "Escalated Super",
            "role": "super_admin",
        },
        headers=headers,
    )
    assert res_super.status_code == 403
    assert "bootstrap" in res_super.json()["detail"].lower()

    # 2. Admin attempts to create another admin -> 403 Forbidden
    res_admin = client.post(
        "/api/auth/users",
        json={
            "username": "second_admin",
            "password": "Password123!",
            "full_name": "Second Admin",
            "role": "admin",
        },
        headers=headers,
    )
    assert res_admin.status_code == 403
    assert "super_admin" in res_admin.json()["detail"].lower()

    # 3. Admin can provision staff (field_officer) -> 201 Created
    res_field = client.post(
        "/api/auth/users",
        json={
            "username": "authorized_officer",
            "password": "Password123!",
            "full_name": "Authorized Officer",
            "role": "field_officer",
        },
        headers=headers,
    )
    assert res_field.status_code == 201
    assert res_field.json()["role"] == "field_officer"


# -----------------------------------------------------------------------------
# Equipment Coordinator Least-Privilege Boundaries
# -----------------------------------------------------------------------------

def test_equipment_coordinator_boundaries(client):
    """Equipment coordinators cannot create interventions, verify work, or mark Completed/Cancelled."""
    equip_headers = auth_cookie_headers(client, "TEST-EQUIP-01", "equipment_coordinator", "Test Equipment Coordinator")

    # 1. Cannot create interventions
    res_create = client.post(
        "/api/interventions",
        json={
            "village_id": "DEMO-VILL-PB-01",
            "intervention_type": "In-situ Happy Seeding",
            "target_acres": 15.0,
            "requested_by": "Coordinator Attempt",
        },
        headers=equip_headers,
    )
    assert res_create.status_code == 403

    # Setup an intervention via admin
    admin_headers = auth_cookie_headers(client, "TEST-ADMIN-01", "admin", "Test Administrator")
    int_res = client.post(
        "/api/interventions",
        json={
            "village_id": "DEMO-VILL-PB-01",
            "intervention_type": "In-situ Happy Seeding",
            "target_acres": 15.0,
            "requested_by": "Admin Setup",
        },
        headers=admin_headers,
    )
    int_id = int_res.json()["id"]

    # Admin approves the intervention
    client.patch(
        f"/api/interventions/{int_id}/status",
        json={"new_status": "Approved", "changed_by": "Admin", "reason": "Approved"},
        headers=admin_headers,
    )

    # 2. Equipment coordinator cannot verify field work
    equip_headers = auth_cookie_headers(client, "TEST-EQUIP-01", "equipment_coordinator", "Test Equipment Coordinator")
    res_verify = client.post(
        f"/api/interventions/{int_id}/verify",
        json={
            "verifier_name": "Coordinator Attempt",
            "outcome": "Verified Cleared",
            "verified_acres": 15.0,
        },
        headers=equip_headers,
    )
    assert res_verify.status_code == 403

    # 3. Equipment coordinator cannot mark Completed or Cancelled
    res_completed = client.patch(
        f"/api/interventions/{int_id}/status",
        json={"new_status": "Completed", "changed_by": "Coordinator", "reason": "Self completed"},
        headers=equip_headers,
    )
    assert res_completed.status_code == 403

    # 4. Equipment coordinator CAN transition Approved -> In Progress for machinery dispatch
    res_mobilize = client.patch(
        f"/api/interventions/{int_id}/status",
        json={"new_status": "In Progress", "changed_by": "Coordinator", "reason": "Machinery dispatched"},
        headers=equip_headers,
    )
    assert res_mobilize.status_code == 200
    assert res_mobilize.json()["status"] == "In Progress"

    # 5. Equipment coordinator CAN access equipment recommendations
    res_rec = client.get("/api/equipment/recommendations?village_id=DEMO-VILL-PB-01")
    assert res_rec.status_code == 200


# -----------------------------------------------------------------------------
# Field Officer Cross-Record (IDOR / BOLA) Isolation Tests
# -----------------------------------------------------------------------------

def test_field_officer_cross_record_idor_isolation(client, test_session):
    """Field Officer A cannot access, modify, or verify Field Officer B's intervention."""
    admin_headers = auth_cookie_headers(client, "TEST-ADMIN-01", "admin", "Admin")

    # 1. Admin creates Intervention A assigned to Officer A
    res_a = client.post(
        "/api/interventions",
        json={
            "village_id": "DEMO-VILL-PB-01",
            "intervention_type": "In-situ Happy Seeding",
            "target_acres": 30.0,
            "assigned_officer_id": "TEST-FIELD-01",
            "requested_by": "Admin for Officer A",
        },
        headers=admin_headers,
    )
    int_a_id = res_a.json()["id"]

    # Admin approves Intervention A
    client.patch(
        f"/api/interventions/{int_a_id}/status",
        json={"new_status": "Approved", "changed_by": "Admin"},
        headers=admin_headers,
    )

    # 2. Admin creates Intervention B assigned to Officer B
    res_b = client.post(
        "/api/interventions",
        json={
            "village_id": "DEMO-VILL-PB-02",
            "intervention_type": "Ex-situ Baler Collection",
            "target_acres": 25.0,
            "assigned_officer_id": "TEST-FIELD-02",
            "requested_by": "Admin for Officer B",
        },
        headers=admin_headers,
    )
    int_b_id = res_b.json()["id"]

    # 3. Officer B attempts to GET Intervention A (assigned to Officer A) -> 403 Forbidden
    officer_b_headers = auth_cookie_headers(client, "TEST-FIELD-02", "field_officer", "Officer Bravo")
    res_read_a = client.get(f"/api/interventions/{int_a_id}")
    assert res_read_a.status_code == 403
    assert "not assigned to you" in res_read_a.json()["detail"].lower()

    # 4. Officer B attempts to PATCH status of Intervention A -> 403 Forbidden
    res_patch_a = client.patch(
        f"/api/interventions/{int_a_id}/status",
        json={"new_status": "In Progress", "changed_by": "Officer Bravo"},
        headers=officer_b_headers,
    )
    assert res_patch_a.status_code == 403
    assert "not assigned to you" in res_patch_a.json()["detail"].lower()

    # 5. Officer B attempts to verify Intervention A -> 403 Forbidden
    res_verify_a = client.post(
        f"/api/interventions/{int_a_id}/verify",
        json={
            "verifier_name": "Officer Bravo",
            "outcome": "Verified Cleared",
            "verified_acres": 30.0,
        },
        headers=officer_b_headers,
    )
    assert res_verify_a.status_code == 403
    assert "assigned to you" in res_verify_a.json()["detail"].lower()

    # 6. Officer B can view and access their own Intervention B -> 200 OK
    res_read_b = client.get(f"/api/interventions/{int_b_id}")
    assert res_read_b.status_code == 200
    assert res_read_b.json()["id"] == int_b_id

    # 7. Officer B's list view only returns their assigned records
    res_list = client.get("/api/interventions")
    assert res_list.status_code == 200
    list_items = res_list.json()["items"]
    # All items returned must either be assigned to Officer B
    for item in list_items:
        assert item["assigned_officer_id"] == "TEST-FIELD-02"

    # 8. Unassigned intervention cannot be accessed by field officer
    unassigned_int = InterventionModel(
        id="INT-UNASSIGNED-TEST",
        village_id="DEMO-VILL-PB-01",
        village_name="Khurana",
        district="Sangrur",
        state="Punjab",
        intervention_type="In-situ Happy Seeding",
        target_acres=10.0,
        status="Proposed",
        completion_status="Pending",
        assigned_officer_id=None,
        is_synthetic=True,
    )
    test_session.add(unassigned_int)
    test_session.commit()

    res_unassigned = client.get(f"/api/interventions/{unassigned_int.id}")
    assert res_unassigned.status_code == 403
    assert "not assigned to you" in res_unassigned.json()["detail"].lower()


def test_demo_accounts_endpoint_disabled_when_configured(test_session):
    """When ENABLE_DEV_DEMO_ACCOUNTS is explicitly false, demo accounts endpoint returns disabled."""
    from app.config import get_settings
    settings = get_settings()
    original_setting = settings.ENABLE_DEV_DEMO_ACCOUNTS
    settings.ENABLE_DEV_DEMO_ACCOUNTS = False

    app.dependency_overrides[get_db] = lambda: test_session
    client = TestClient(app)

    try:
        res = client.get("/api/auth/demo-accounts")
        assert res.status_code == 200
        data = res.json()
        assert data["enabled"] is False
        assert len(data["accounts"]) == 0
        assert "disabled" in data["notice"].lower()
    finally:
        settings.ENABLE_DEV_DEMO_ACCOUNTS = original_setting
        app.dependency_overrides.pop(get_db, None)


def test_demo_accounts_disabled_by_default(test_session):
    """Verify evaluation demo accounts and auto-approval are disabled by default for production safety."""
    from app.config import Settings
    default_settings = Settings()
    assert default_settings.ENABLE_DEV_DEMO_ACCOUNTS is False
    assert default_settings.ENABLE_PUBLIC_REGISTRATION is False
    assert default_settings.AUTO_APPROVE_PUBLIC_REGISTRATION is False
    assert default_settings.EVAL_DEMO_PASSWORD == ""


def test_demo_accounts_enabled_full_lifecycle_and_role_permissions(test_session):
    """Test full evaluation lifecycle: enable demo accounts, seed, verify endpoint, test login,

    session restoration, logout, and role permissions for all four evaluation accounts.
    """
    from app.config import get_settings
    settings = get_settings()
    original_setting = settings.ENABLE_DEV_DEMO_ACCOUNTS
    original_pw = settings.EVAL_DEMO_PASSWORD
    settings.ENABLE_DEV_DEMO_ACCOUNTS = True
    settings.EVAL_DEMO_PASSWORD = "TestEvalPassword2026!"

    app.dependency_overrides[get_db] = lambda: test_session
    client = TestClient(app)

    try:
        # Seed an intervention that field officer can be assigned
        sample_int = InterventionModel(
            id="INT-2026-PB-001",
            village_id="DEMO-VILL-PB-01",
            village_name="Khurana",
            district="Sangrur",
            state="Punjab",
            intervention_type="In-situ Happy Seeding",
            target_acres=45.0,
            status="Proposed",
            completion_status="Pending",
            assigned_officer_id=None,
            is_synthetic=True,
        )
        test_session.add(sample_int)
        test_session.commit()

        # 1. Seed demo users
        added_count = seed_dev_demo_users(test_session)
        assert added_count >= 4

        # Verify idempotency (second seed call must not duplicate users)
        assert seed_dev_demo_users(test_session) == 0

        # 2. Query demo accounts endpoint
        res = client.get("/api/auth/demo-accounts")
        assert res.status_code == 200
        demo_data = res.json()
        assert demo_data["enabled"] is True
        assert len(demo_data["accounts"]) == 4

        accounts_by_role = {a["role"]: a for a in demo_data["accounts"]}
        assert set(accounts_by_role.keys()) == {
            "super_admin",
            "admin",
            "field_officer",
            "equipment_coordinator",
        }

        # 3. Test every demo account: Login -> Session restore (/me) -> Check role -> Logout
        for role, cred in accounts_by_role.items():
            login_client = TestClient(app)
            login_res = login_client.post(
                "/api/auth/login",
                json={
                    "username": cred["username"],
                    "password": cred["password"],
                },
            )
            assert login_res.status_code == 200, f"Login failed for demo user {cred['username']}"
            assert "access_token" in login_client.cookies
            assert "csrf_token" in login_client.cookies

            # Session restoration (/api/auth/me)
            me_res = login_client.get("/api/auth/me")
            assert me_res.status_code == 200
            assert me_res.json()["username"] == cred["username"]
            assert me_res.json()["role"] == role

            # Fire events view access
            fe_res = login_client.get("/api/fire-events")
            assert fe_res.status_code == 200

            # Logout (requires CSRF token for cookie-authenticated POST)
            csrf_val = login_client.cookies.get("csrf_token")
            logout_res = login_client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf_val})
            assert logout_res.status_code == 200
            # Session terminated: /api/auth/me returns 401
            assert login_client.get("/api/auth/me").status_code == 401

        # 4. Test Super Admin demo capabilities
        sa_client = TestClient(app)
        sa_client.post("/api/auth/login", json={"username": "superadmin_demo", "password": accounts_by_role["super_admin"]["password"]})
        assert sa_client.get("/api/auth/users").status_code == 200
        assert sa_client.get("/api/interventions").status_code == 200

        # 5. Test District Admin demo capabilities & restrictions
        admin_client = TestClient(app)
        admin_client.post("/api/auth/login", json={"username": "admin_demo", "password": accounts_by_role["admin"]["password"]})
        admin_csrf = admin_client.cookies.get("csrf_token")
        # Forbidden: admin cannot access super-admin-only user list
        assert admin_client.get("/api/auth/users").status_code == 403
        # Allowed: create intervention
        create_int_res = admin_client.post(
            "/api/interventions",
            json={
                "village_id": "DEMO-VILL-PB-01",
                "intervention_type": "In-situ Happy Seeding",
                "target_acres": 25.0,
                "requested_by": "District Admin Demo",
            },
            headers={"X-CSRF-Token": admin_csrf},
        )
        assert create_int_res.status_code == 201
        # Forbidden: admin cannot create super_admin
        prov_super_res = admin_client.post(
            "/api/auth/users",
            json={
                "username": "illegal_super",
                "password": "Password123!",
                "full_name": "Illegal",
                "role": "super_admin",
            },
            headers={"X-CSRF-Token": admin_csrf},
        )
        assert prov_super_res.status_code == 403

        # 6. Test Field Officer demo capabilities & restrictions
        fo_client = TestClient(app)
        fo_client.post("/api/auth/login", json={"username": "field_officer_demo", "password": accounts_by_role["field_officer"]["password"]})
        fo_csrf = fo_client.cookies.get("csrf_token")
        # Field officer has assigned synthetic intervention INT-2026-PB-001
        fo_ints = fo_client.get("/api/interventions").json()
        assigned_ids = [item["id"] for item in fo_ints["items"]]
        assert "INT-2026-PB-001" in assigned_ids
        # Forbidden: field officer cannot create intervention
        fo_create_res = fo_client.post(
            "/api/interventions",
            json={
                "village_id": "DEMO-VILL-PB-01",
                "intervention_type": "In-situ Happy Seeding",
                "target_acres": 15.0,
                "requested_by": "Field Officer Demo",
            },
            headers={"X-CSRF-Token": fo_csrf},
        )
        assert fo_create_res.status_code == 403

        # 7. Test Equipment Coordinator demo capabilities & restrictions
        ec_client = TestClient(app)
        ec_client.post("/api/auth/login", json={"username": "equipment_coord_demo", "password": accounts_by_role["equipment_coordinator"]["password"]})
        ec_csrf = ec_client.cookies.get("csrf_token")
        # Allowed: view equipment fleet
        assert ec_client.get("/api/equipment").status_code == 200
        # Forbidden: equipment coordinator cannot create intervention
        ec_create_res = ec_client.post(
            "/api/interventions",
            json={
                "village_id": "DEMO-VILL-PB-01",
                "intervention_type": "In-situ Happy Seeding",
                "target_acres": 10.0,
                "requested_by": "Equip Coord Demo",
            },
            headers={"X-CSRF-Token": ec_csrf},
        )
        assert ec_create_res.status_code == 403

        # Forbidden: equipment coordinator cannot conduct field verification
        ec_verify_res = ec_client.post(
            f"/api/interventions/{sample_int.id}/verify",
            json={
                "verifier_name": "Equipment Coord Demo",
                "outcome": "Verified Cleared",
                "verified_acres": 45.0,
            },
            headers={"X-CSRF-Token": ec_csrf},
        )
        assert ec_verify_res.status_code == 403

        # Equipment coordinator transition rules:
        # First, admin transitions sample_int from Proposed -> Approved
        admin_appr = admin_client.patch(
            f"/api/interventions/{sample_int.id}/status",
            json={"new_status": "Approved", "changed_by": "Admin Demo"},
            headers={"X-CSRF-Token": admin_csrf},
        )
        assert admin_appr.status_code == 200

        # Equipment coordinator CAN transition Approved -> In Progress for machinery dispatch
        ec_dispatch_res = ec_client.patch(
            f"/api/interventions/{sample_int.id}/status",
            json={"new_status": "In Progress", "changed_by": "Equip Coord Demo", "reason": "Machinery mobilized"},
            headers={"X-CSRF-Token": ec_csrf},
        )
        assert ec_dispatch_res.status_code == 200

        # Equipment coordinator CANNOT transition In Progress -> Completed
        ec_complete_res = ec_client.patch(
            f"/api/interventions/{sample_int.id}/status",
            json={"new_status": "Completed", "changed_by": "Equip Coord Demo"},
            headers={"X-CSRF-Token": ec_csrf},
        )
        assert ec_complete_res.status_code == 403

    finally:
        settings.ENABLE_DEV_DEMO_ACCOUNTS = original_setting
        settings.EVAL_DEMO_PASSWORD = original_pw
        app.dependency_overrides.pop(get_db, None)


def test_registration_status_and_defaults(client):
    """Verify registration-status endpoint reflects configuration and role policy metadata."""
    from app.config import get_settings
    settings = get_settings()
    orig = settings.ENABLE_PUBLIC_REGISTRATION
    try:
        settings.ENABLE_PUBLIC_REGISTRATION = True
        res_default = client.get("/api/auth/registration-status")
        assert res_default.status_code == 200
        data_default = res_default.json()
        assert data_default["enabled"] is True
        assert any(r["role"] == "super_admin" and not r["can_self_register"] for r in data_default["roles"])
        assert any(r["role"] == "field_officer" and r["can_self_register"] for r in data_default["roles"])

        # When toggled to False, reflects disabled status
        settings.ENABLE_PUBLIC_REGISTRATION = False
        res = client.get("/api/auth/registration-status")
        assert res.status_code == 200
        data = res.json()
        assert data["enabled"] is False
    finally:
        settings.ENABLE_PUBLIC_REGISTRATION = orig


def test_public_registration_disabled_by_default(client):
    """Verify that public registration is disabled by default for production security."""
    from app.config import Settings
    fresh_settings = Settings()
    assert fresh_settings.ENABLE_PUBLIC_REGISTRATION is False
    assert fresh_settings.AUTO_APPROVE_PUBLIC_REGISTRATION is False

    from app.config import get_settings
    settings = get_settings()
    orig = settings.ENABLE_PUBLIC_REGISTRATION
    try:
        settings.ENABLE_PUBLIC_REGISTRATION = False
        res = client.get("/api/auth/registration-status")
        assert res.status_code == 200
        assert res.json()["enabled"] is False
    finally:
        settings.ENABLE_PUBLIC_REGISTRATION = orig


def test_public_registration_disabled_when_configured(client):
    """Verify that when public registration is explicitly disabled, registration attempts are forbidden."""
    from app.config import get_settings
    settings = get_settings()
    orig = settings.ENABLE_PUBLIC_REGISTRATION
    try:
        settings.ENABLE_PUBLIC_REGISTRATION = False
        res = client.post(
            "/api/auth/register",
            json={
                "username": "new_staff_01",
                "password": "ValidPassword123!",
                "full_name": "New Staff Member",
                "role": "field_officer",
            },
        )
        assert res.status_code == 403
        assert "disabled" in res.json()["detail"].lower()
    finally:
        settings.ENABLE_PUBLIC_REGISTRATION = orig


def test_public_registration_cannot_create_super_admin(client):
    """Verify public registration cannot provision super_admin even if registration is enabled."""
    from app.config import get_settings
    settings = get_settings()
    orig = settings.ENABLE_PUBLIC_REGISTRATION
    try:
        settings.ENABLE_PUBLIC_REGISTRATION = True
        res = client.post(
            "/api/auth/register",
            json={
                "username": "hack_superadmin",
                "password": "ValidPassword123!",
                "full_name": "Attacker",
                "role": "super_admin",
            },
        )
        assert res.status_code == 403
        assert "bootstrap" in res.json()["detail"].lower()
    finally:
        settings.ENABLE_PUBLIC_REGISTRATION = orig


def test_public_registration_cannot_create_admin(client):
    """Verify public registration cannot provision district admin even if registration is enabled."""
    from app.config import get_settings
    settings = get_settings()
    orig = settings.ENABLE_PUBLIC_REGISTRATION
    try:
        settings.ENABLE_PUBLIC_REGISTRATION = True
        res = client.post(
            "/api/auth/register",
            json={
                "username": "hack_admin",
                "password": "ValidPassword123!",
                "full_name": "Attacker Admin",
                "role": "admin",
            },
        )
        assert res.status_code == 403
        assert "super admin" in res.json()["detail"].lower()
    finally:
        settings.ENABLE_PUBLIC_REGISTRATION = orig


def test_public_registration_validation_rules(client):
    """Verify weak password, invalid role, and duplicate username rejection."""
    from app.config import get_settings
    settings = get_settings()
    orig = settings.ENABLE_PUBLIC_REGISTRATION
    try:
        settings.ENABLE_PUBLIC_REGISTRATION = True

        # Weak password (< 8 chars)
        res_weak = client.post(
            "/api/auth/register",
            json={
                "username": "officer_weak",
                "password": "short",
                "full_name": "Officer Short",
                "role": "field_officer",
            },
        )
        assert res_weak.status_code == 422

        # Invalid role
        res_inv = client.post(
            "/api/auth/register",
            json={
                "username": "officer_inv",
                "password": "ValidPassword123!",
                "full_name": "Officer Invalid",
                "role": "unauthorized_role",
            },
        )
        assert res_inv.status_code == 422

        # Duplicate username
        res_dup = client.post(
            "/api/auth/register",
            json={
                "username": "super_tester",  # already in fixture
                "password": "ValidPassword123!",
                "full_name": "Duplicate User",
                "role": "field_officer",
            },
        )
        assert res_dup.status_code == 409
    finally:
        settings.ENABLE_PUBLIC_REGISTRATION = orig


def test_public_registration_field_officer_lifecycle_and_approval(client, test_session):
    """Verify field_officer registration creates pending inactive user, which cannot log in until approved."""
    from app.config import get_settings
    settings = get_settings()
    orig = settings.ENABLE_PUBLIC_REGISTRATION
    try:
        settings.ENABLE_PUBLIC_REGISTRATION = True

        # 1. Public self-registration
        reg_res = client.post(
            "/api/auth/register",
            json={
                "username": "applicant_sandhu",
                "password": "SandhuSecurePass123!",
                "full_name": "Applicant Jaswinder Sandhu",
                "role": "field_officer",
            },
        )
        assert reg_res.status_code == 201
        reg_data = reg_res.json()
        assert reg_data["user"]["role"] == "field_officer"
        assert reg_data["user"]["is_active"] is False  # PENDING
        user_id = reg_data["user"]["id"]

        # 2. Attempting to log in as inactive applicant must fail with 403
        login_res = client.post(
            "/api/auth/login",
            json={
                "username": "applicant_sandhu",
                "password": "SandhuSecurePass123!",
            },
        )
        assert login_res.status_code == 403
        assert "disabled" in login_res.json()["detail"].lower()

        # 3. Super Admin logs in and activates the user
        super_login = client.post(
            "/api/auth/login",
            json={"username": "super_tester", "password": "SuperPass123!"},
        )
        assert super_login.status_code == 200
        csrf_token = super_login.cookies.get("csrf_token")

        patch_res = client.patch(
            f"/api/auth/users/{user_id}/status",
            json={"is_active": True},
            headers={"X-CSRF-Token": csrf_token},
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["is_active"] is True

        # 4. Now that the account is active, login succeeds
        now_login = client.post(
            "/api/auth/login",
            json={
                "username": "applicant_sandhu",
                "password": "SandhuSecurePass123!",
            },
        )
        assert now_login.status_code == 200
        assert now_login.json()["user"]["role"] == "field_officer"

        # 5. Field officer is forbidden from calling status update
        fo_patch = client.patch(
            f"/api/auth/users/{user_id}/status",
            json={"is_active": False},
            headers={"X-CSRF-Token": now_login.cookies.get("csrf_token")},
        )
        assert fo_patch.status_code == 403

        # 6. Super Admin logs back in and cannot deactivate their own active account
        super_relogin = client.post(
            "/api/auth/login",
            json={"username": "super_tester", "password": "SuperPass123!"},
        )
        assert super_relogin.status_code == 200
        super_csrf = super_relogin.cookies.get("csrf_token")

        self_deact = client.patch(
            f"/api/auth/users/{super_relogin.json()['user']['id']}/status",
            json={"is_active": False},
            headers={"X-CSRF-Token": super_csrf},
        )
        assert self_deact.status_code == 400
    finally:
        settings.ENABLE_PUBLIC_REGISTRATION = orig


def test_public_registration_equipment_coordinator_approved_by_district_admin(client, test_session):
    """Verify equipment_coordinator self-registration and activation approval by District Admin."""
    from app.config import get_settings
    settings = get_settings()
    original_setting = settings.ENABLE_PUBLIC_REGISTRATION
    try:
        settings.ENABLE_PUBLIC_REGISTRATION = True

        # 1. Public self-registration for equipment_coordinator
        reg_res = client.post(
            "/api/auth/register",
            json={
                "username": "applicant_baler_lead",
                "password": "BalerSecurePass123!",
                "full_name": "Applicant Baler Lead",
                "role": "equipment_coordinator",
            },
        )
        assert reg_res.status_code == 201
        user_data = reg_res.json()["user"]
        assert user_data["role"] == "equipment_coordinator"
        assert user_data["is_active"] is False
        ec_id = user_data["id"]

        # 2. Login before approval must fail
        unapproved_login = client.post(
            "/api/auth/login",
            json={"username": "applicant_baler_lead", "password": "BalerSecurePass123!"},
        )
        assert unapproved_login.status_code == 403
        assert "disabled" in unapproved_login.json()["detail"].lower()

        # 3. District Admin logs in and approves the equipment coordinator
        admin_login = client.post(
            "/api/auth/login",
            json={"username": "admin_tester", "password": "AdminPass123!"},
        )
        assert admin_login.status_code == 200
        admin_csrf = admin_login.cookies.get("csrf_token")

        approve_res = client.patch(
            f"/api/auth/users/{ec_id}/status",
            json={"is_active": True},
            headers={"X-CSRF-Token": admin_csrf},
        )
        assert approve_res.status_code == 200
        assert approve_res.json()["is_active"] is True

        # 4. Now equipment coordinator logs in successfully
        approved_login = client.post(
            "/api/auth/login",
            json={"username": "applicant_baler_lead", "password": "BalerSecurePass123!"},
        )
        assert approved_login.status_code == 200
        assert approved_login.json()["user"]["role"] == "equipment_coordinator"
    finally:
        settings.ENABLE_PUBLIC_REGISTRATION = original_setting


def test_public_registration_auto_approval_mode(client, test_session):
    """Verify that when AUTO_APPROVE_PUBLIC_REGISTRATION is enabled in local evaluation:
    1. Operational roles (field_officer and equipment_coordinator) are activated immediately.
    2. Newly registered operational users can sign in without waiting for administrator approval.
    3. Privileged roles (admin, super_admin) remain strictly forbidden (403).
    """
    from app.config import get_settings
    settings = get_settings()
    orig_reg = settings.ENABLE_PUBLIC_REGISTRATION
    orig_auto = settings.AUTO_APPROVE_PUBLIC_REGISTRATION
    try:
        settings.ENABLE_PUBLIC_REGISTRATION = True
        settings.AUTO_APPROVE_PUBLIC_REGISTRATION = True

        # 1. Status endpoint reflects auto_approve=True
        status_res = client.get("/api/auth/registration-status")
        assert status_res.status_code == 200
        status_data = status_res.json()
        assert status_data["enabled"] is True
        assert status_data["auto_approve"] is True

        # 2. Register field_officer -> activated immediately
        fo_res = client.post(
            "/api/auth/register",
            json={
                "username": "auto_fo_officer",
                "password": "AutoPass123!",
                "full_name": "Auto Field Officer",
                "role": "field_officer",
            },
        )
        assert fo_res.status_code == 201
        fo_user = fo_res.json()["user"]
        assert fo_user["role"] == "field_officer"
        assert fo_user["is_active"] is True
        assert "automatically activated" in fo_res.json()["message"].lower()

        # Login immediately succeeds without admin intervention
        fo_login = client.post(
            "/api/auth/login",
            json={"username": "auto_fo_officer", "password": "AutoPass123!"},
        )
        assert fo_login.status_code == 200
        assert fo_login.json()["user"]["role"] == "field_officer"
        assert fo_login.json()["user"]["is_active"] is True
        client.post("/api/auth/logout")

        # 3. Register equipment_coordinator -> activated immediately
        ec_res = client.post(
            "/api/auth/register",
            json={
                "username": "auto_ec_coord",
                "password": "AutoPass123!",
                "full_name": "Auto Equipment Coordinator",
                "role": "equipment_coordinator",
            },
        )
        assert ec_res.status_code == 201
        ec_user = ec_res.json()["user"]
        assert ec_user["role"] == "equipment_coordinator"
        assert ec_user["is_active"] is True
        assert "automatically activated" in ec_res.json()["message"].lower()

        # Login immediately succeeds
        ec_login = client.post(
            "/api/auth/login",
            json={"username": "auto_ec_coord", "password": "AutoPass123!"},
        )
        assert ec_login.status_code == 200
        assert ec_login.json()["user"]["role"] == "equipment_coordinator"
        client.post("/api/auth/logout")

        # 4. Privileged roles MUST remain rejected even with auto-approval enabled
        res_super = client.post(
            "/api/auth/register",
            json={
                "username": "auto_hack_super",
                "password": "AutoPass123!",
                "full_name": "Illegal Super",
                "role": "super_admin",
            },
        )
        assert res_super.status_code == 403
        assert "bootstrap" in res_super.json()["detail"].lower()

        res_admin = client.post(
            "/api/auth/register",
            json={
                "username": "auto_hack_admin",
                "password": "AutoPass123!",
                "full_name": "Illegal Admin",
                "role": "admin",
            },
        )
        assert res_admin.status_code == 403
        assert "super admin" in res_admin.json()["detail"].lower()

    finally:
        settings.ENABLE_PUBLIC_REGISTRATION = orig_reg
        settings.AUTO_APPROVE_PUBLIC_REGISTRATION = orig_auto


def test_public_registration_pending_approval_mode(client, test_session):
    """Verify that when AUTO_APPROVE_PUBLIC_REGISTRATION is disabled (production default):
    1. Operational roles are created with is_active=False.
    2. Unapproved accounts cannot sign in (403).
    3. Privileged roles remain forbidden (403).
    """
    from app.config import get_settings
    settings = get_settings()
    orig_reg = settings.ENABLE_PUBLIC_REGISTRATION
    orig_auto = settings.AUTO_APPROVE_PUBLIC_REGISTRATION
    try:
        settings.ENABLE_PUBLIC_REGISTRATION = True
        settings.AUTO_APPROVE_PUBLIC_REGISTRATION = False

        status_res = client.get("/api/auth/registration-status")
        assert status_res.status_code == 200
        assert status_res.json()["auto_approve"] is False

        # Register field_officer -> pending approval
        reg_res = client.post(
            "/api/auth/register",
            json={
                "username": "pending_fo_user",
                "password": "PendingPass123!",
                "full_name": "Pending Officer",
                "role": "field_officer",
            },
        )
        assert reg_res.status_code == 201
        assert reg_res.json()["user"]["is_active"] is False
        assert "pending administrator approval" in reg_res.json()["message"].lower()

        # Login fails
        login_res = client.post(
            "/api/auth/login",
            json={"username": "pending_fo_user", "password": "PendingPass123!"},
        )
        assert login_res.status_code == 403
        assert "disabled" in login_res.json()["detail"].lower()

        # Privileged roles rejected
        admin_res = client.post(
            "/api/auth/register",
            json={
                "username": "pending_admin_user",
                "password": "PendingPass123!",
                "full_name": "Pending Admin",
                "role": "admin",
            },
        )
        assert admin_res.status_code == 403

    finally:
        settings.ENABLE_PUBLIC_REGISTRATION = orig_reg
        settings.AUTO_APPROVE_PUBLIC_REGISTRATION = orig_auto


def test_super_admin_vs_district_admin_user_management_rbac(client, test_session):
    """Rigorous audit test of Super Admin vs District Admin demo flow & user governance RBAC.

    1. admin_demo can log in, but GET /api/auth/users returns 403 Forbidden.
    2. admin_demo cannot provision super_admin (403) or admin (403).
    3. admin_demo can provision field_officer (201) and equipment_coordinator (201).
    4. admin_demo cannot activate/deactivate super_admin or admin accounts (403).
    5. admin_demo can activate/deactivate field_officer or coordinator accounts (200).
    6. superadmin_demo can log in and GET /api/auth/users returns 200 with full roster.
    7. superadmin_demo can provision admin accounts (201).
    8. superadmin_demo cannot deactivate their own active account (400).
    """
    from app.config import get_settings
    settings = get_settings()
    orig_demo = settings.ENABLE_DEV_DEMO_ACCOUNTS
    orig_pw = settings.EVAL_DEMO_PASSWORD
    try:
        settings.ENABLE_DEV_DEMO_ACCOUNTS = True
        settings.EVAL_DEMO_PASSWORD = "TestEvalPassword2026!"
        seed_dev_demo_users(test_session)

        # Retrieve demo credentials from public endpoint
        demo_res = client.get("/api/auth/demo-accounts")
        assert demo_res.status_code == 200
        creds = {acc["role"]: acc for acc in demo_res.json()["accounts"]}

        admin_cred = creds["admin"]
        super_cred = creds["super_admin"]

        # =========================================================================
        # 1. District Admin Demo Login & Governance Checks
        # =========================================================================
        admin_client = TestClient(app)
        admin_login = admin_client.post(
            "/api/auth/login",
            json={"username": admin_cred["username"], "password": admin_cred["password"]},
        )
        assert admin_login.status_code == 200
        assert admin_login.json()["user"]["role"] == "admin"
        admin_csrf = admin_login.cookies.get("csrf_token")
        admin_id = admin_login.json()["user"]["id"]

        # Requirement 1: GET /api/auth/users must return 403 for District Admin
        roster_res = admin_client.get("/api/auth/users")
        assert roster_res.status_code == 403
        assert "super_admin" in roster_res.json()["detail"].lower()

        # Requirement 2: District Admin cannot create super_admin
        res_create_super = admin_client.post(
            "/api/auth/users",
            json={
                "username": "illegal_super",
                "password": "Password123!",
                "full_name": "Illegal Super",
                "role": "super_admin",
            },
            headers={"X-CSRF-Token": admin_csrf},
        )
        assert res_create_super.status_code == 403

        # Requirement 3: District Admin cannot create admin
        res_create_admin = admin_client.post(
            "/api/auth/users",
            json={
                "username": "illegal_admin",
                "password": "Password123!",
                "full_name": "Illegal Admin",
                "role": "admin",
            },
            headers={"X-CSRF-Token": admin_csrf},
        )
        assert res_create_admin.status_code == 403

        # Requirement 4: District Admin CAN create field_officer
        res_create_fo = admin_client.post(
            "/api/auth/users",
            json={
                "username": "dist_fo_01",
                "password": "Password123!",
                "full_name": "District Field Officer",
                "role": "field_officer",
            },
            headers={"X-CSRF-Token": admin_csrf},
        )
        assert res_create_fo.status_code == 201
        new_fo_id = res_create_fo.json()["id"]

        # Requirement 5: District Admin CAN create equipment_coordinator
        res_create_ec = admin_client.post(
            "/api/auth/users",
            json={
                "username": "dist_ec_01",
                "password": "Password123!",
                "full_name": "District Equipment Coord",
                "role": "equipment_coordinator",
            },
            headers={"X-CSRF-Token": admin_csrf},
        )
        assert res_create_ec.status_code == 201
        new_ec_id = res_create_ec.json()["id"]

        # Requirement 6: District Admin cannot modify status of super_admin or admin
        # Attempt to deactivate super_tester:
        res_hack_super = admin_client.patch(
            "/api/auth/users/TEST-SUPER-01/status",
            json={"is_active": False},
            headers={"X-CSRF-Token": admin_csrf},
        )
        assert res_hack_super.status_code == 403

        # Attempt to deactivate admin_tester:
        res_hack_admin = admin_client.patch(
            "/api/auth/users/TEST-ADMIN-01/status",
            json={"is_active": False},
            headers={"X-CSRF-Token": admin_csrf},
        )
        assert res_hack_admin.status_code == 403

        # Requirement 7: District Admin CAN update status of operational staff
        res_mod_fo = admin_client.patch(
            f"/api/auth/users/{new_fo_id}/status",
            json={"is_active": False},
            headers={"X-CSRF-Token": admin_csrf},
        )
        assert res_mod_fo.status_code == 200
        assert res_mod_fo.json()["is_active"] is False

        res_mod_ec = admin_client.patch(
            f"/api/auth/users/{new_ec_id}/status",
            json={"is_active": False},
            headers={"X-CSRF-Token": admin_csrf},
        )
        assert res_mod_ec.status_code == 200
        assert res_mod_ec.json()["is_active"] is False

        # =========================================================================
        # 2. Super Admin Demo Login & Governance Checks
        # =========================================================================
        super_client = TestClient(app)
        super_login = super_client.post(
            "/api/auth/login",
            json={"username": super_cred["username"], "password": super_cred["password"]},
        )
        assert super_login.status_code == 200
        assert super_login.json()["user"]["role"] == "super_admin"
        super_csrf = super_login.cookies.get("csrf_token")
        super_id = super_login.json()["user"]["id"]

        # Requirement 8: GET /api/auth/users succeeds for Super Admin with full roster
        super_roster = super_client.get("/api/auth/users")
        assert super_roster.status_code == 200
        roster_users = super_roster.json()
        assert len(roster_users) >= 6
        roles_in_roster = {u["role"] for u in roster_users}
        assert "super_admin" in roles_in_roster
        assert "admin" in roles_in_roster
        assert "field_officer" in roles_in_roster
        assert "equipment_coordinator" in roles_in_roster

        # Requirement 9: Super Admin can provision new admin accounts
        res_super_create_admin = super_client.post(
            "/api/auth/users",
            json={
                "username": "dist_admin_02",
                "password": "Password123!",
                "full_name": "District Administrator 2",
                "role": "admin",
            },
            headers={"X-CSRF-Token": super_csrf},
        )
        assert res_super_create_admin.status_code == 201
        new_admin_id = res_super_create_admin.json()["id"]

        # Requirement 10: Super Admin can activate/deactivate admin accounts
        res_deact_admin = super_client.patch(
            f"/api/auth/users/{new_admin_id}/status",
            json={"is_active": False},
            headers={"X-CSRF-Token": super_csrf},
        )
        assert res_deact_admin.status_code == 200
        assert res_deact_admin.json()["is_active"] is False

        # Requirement 11: Super Admin cannot deactivate own active account
        res_self_deact = super_client.patch(
            f"/api/auth/users/{super_id}/status",
            json={"is_active": False},
            headers={"X-CSRF-Token": super_csrf},
        )
        assert res_self_deact.status_code == 400

    finally:
        settings.ENABLE_DEV_DEMO_ACCOUNTS = orig_demo
        settings.EVAL_DEMO_PASSWORD = orig_pw


# =============================================================================
# REJECT AND DELETE ACTIONS, ROSTER RBAC, OPERATIONAL HISTORY INTEGRITY
# =============================================================================

def test_reject_pending_registration_and_block_login(client: TestClient, test_session):
    """Pending user can be rejected, status updated to rejected, login blocked."""
    pending_user = UserModel(
        id="TEST-PENDING-01",
        username="pending_tester",
        full_name="Pending Tester",
        hashed_password=hash_password("PendingPass123!"),
        role="field_officer",
        status="pending",
        is_active=False,
    )
    test_session.add(pending_user)
    test_session.commit()

    headers = auth_cookie_headers(client, "TEST-SUPER-01", "super_admin", "Test Super Admin")

    res = client.patch(
        f"/api/auth/users/{pending_user.id}/status",
        json={"status": "rejected"},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "rejected"
    assert data["is_active"] is False

    res_login = client.post(
        "/api/auth/login",
        json={"username": "pending_tester", "password": "PendingPass123!"},
    )
    assert res_login.status_code == 403
    assert "disabled" in res_login.json()["detail"].lower()


def test_approve_pending_registration_and_allow_login(client: TestClient, test_session):
    """Pending user can be approved, status updated to active, login allowed."""
    pending_user = UserModel(
        id="TEST-PENDING-02",
        username="pending_approvable",
        full_name="Pending Approvable",
        hashed_password=hash_password("ApprovablePass123!"),
        role="field_officer",
        status="pending",
        is_active=False,
    )
    test_session.add(pending_user)
    test_session.commit()

    headers = auth_cookie_headers(client, "TEST-SUPER-01", "super_admin", "Test Super Admin")

    res = client.patch(
        f"/api/auth/users/{pending_user.id}/status",
        json={"status": "active"},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "active"
    assert data["is_active"] is True

    res_login = client.post(
        "/api/auth/login",
        json={"username": "pending_approvable", "password": "ApprovablePass123!"},
    )
    assert res_login.status_code == 200
    assert "access_token" in res_login.cookies


def test_deactivate_active_user_and_block_login(client: TestClient):
    """Active user can be deactivated, status set to deactivated, login blocked."""
    headers = auth_cookie_headers(client, "TEST-SUPER-01", "super_admin", "Test Super Admin")

    res = client.patch(
        "/api/auth/users/TEST-FIELD-02/status",
        json={"status": "deactivated"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "deactivated"
    assert res.json()["is_active"] is False

    res_login = client.post(
        "/api/auth/login",
        json={"username": "field_tester_b", "password": "FieldPassB123!"},
    )
    assert res_login.status_code == 403


def test_district_admin_cannot_reject_delete_or_deactivate_admin_or_super_admin(client: TestClient):
    """District Admin is forbidden from rejecting, deleting, or modifying status of admin/super_admin."""
    admin_headers = auth_cookie_headers(client, "TEST-ADMIN-01", "admin", "Test Administrator")

    res_patch_super = client.patch(
        "/api/auth/users/TEST-SUPER-01/status",
        json={"status": "rejected"},
        headers=admin_headers,
    )
    assert res_patch_super.status_code == 403

    res_del_super = client.delete(
        "/api/auth/users/TEST-SUPER-01",
        headers=admin_headers,
    )
    assert res_del_super.status_code == 403

    res_del_admin = client.delete(
        "/api/auth/users/TEST-ADMIN-01",
        headers=admin_headers,
    )
    assert res_del_admin.status_code == 403


def test_district_admin_can_manage_and_delete_operational_staff(client: TestClient, test_session):
    """District Admin can reject and delete staff accounts (field_officer, equipment_coordinator)."""
    staff = UserModel(
        id="TEST-STAFF-DEL-01",
        username="staff_del_01",
        full_name="Staff Delete Me",
        hashed_password=hash_password("Pass123!"),
        role="field_officer",
        status="pending",
        is_active=False,
    )
    test_session.add(staff)
    test_session.commit()

    admin_headers = auth_cookie_headers(client, "TEST-ADMIN-01", "admin", "Test Administrator")

    res_reject = client.patch(
        f"/api/auth/users/{staff.id}/status",
        json={"status": "rejected"},
        headers=admin_headers,
    )
    assert res_reject.status_code == 200
    assert res_reject.json()["status"] == "rejected"

    res_del = client.delete(
        f"/api/auth/users/{staff.id}",
        headers=admin_headers,
    )
    assert res_del.status_code == 200
    del_data = res_del.json()
    assert del_data["soft_deleted"] is False
    assert del_data["user_id"] == staff.id
    assert del_data["deleted_id"] == staff.id

    assert test_session.query(UserModel).filter_by(id=staff.id).first() is None


def test_unauthorized_roles_cannot_modify_or_delete_users(client: TestClient):
    """Field Officer and Equipment Coordinator cannot call status or delete endpoints."""
    field_headers = auth_cookie_headers(client, "TEST-FIELD-01", "field_officer", "Officer Alpha")
    equip_headers = auth_cookie_headers(client, "TEST-EQUIP-01", "equipment_coordinator", "Test Equipment Coordinator")

    for h in [field_headers, equip_headers]:
        res_patch = client.patch("/api/auth/users/TEST-FIELD-02/status", json={"status": "deactivated"}, headers=h)
        assert res_patch.status_code == 403

        res_del = client.delete("/api/auth/users/TEST-FIELD-02", headers=h)
        assert res_del.status_code == 403


def test_self_deletion_and_self_deactivation_prevented(client: TestClient, test_session):
    """Users cannot delete or deactivate their own accounts when other admins exist."""
    other_super = UserModel(
        id="TEST-SUPER-OTHER",
        username="super_other",
        full_name="Other Super Admin",
        hashed_password=hash_password("OtherSuper123!"),
        role="super_admin",
        is_active=True,
    )
    test_session.add(other_super)
    test_session.commit()

    super_headers = auth_cookie_headers(client, "TEST-SUPER-01", "super_admin", "Test Super Admin")

    res_del_self = client.delete("/api/auth/users/TEST-SUPER-01", headers=super_headers)
    assert res_del_self.status_code == 400
    assert "own account" in res_del_self.json()["detail"].lower()

    res_deact_self = client.patch("/api/auth/users/TEST-SUPER-01/status", json={"status": "deactivated"}, headers=super_headers)
    assert res_deact_self.status_code == 400
    assert "own active account" in res_deact_self.json()["detail"].lower()


def test_last_active_super_admin_guard(client: TestClient, test_session):
    """Cannot delete or deactivate the last active super_admin even if another admin attempts it."""
    supers = test_session.query(UserModel).filter_by(role="super_admin", is_active=True).all()
    assert len(supers) == 1
    super_id = supers[0].id

    caller_super = UserModel(
        id="TEST-SUPER-02",
        username="caller_super",
        full_name="Caller Super",
        hashed_password=hash_password("SuperPass123!"),
        role="super_admin",
        is_active=True,
    )
    test_session.add(caller_super)
    test_session.commit()

    caller_headers = auth_cookie_headers(client, "TEST-SUPER-02", "super_admin", "Caller Super")

    res1 = client.patch(f"/api/auth/users/{super_id}/status", json={"status": "deactivated"}, headers=caller_headers)
    assert res1.status_code == 200

    res2 = client.patch("/api/auth/users/TEST-SUPER-02/status", json={"status": "deactivated"}, headers=caller_headers)
    assert res2.status_code == 400
    assert "last active super admin" in res2.json()["detail"].lower()

    res3 = client.delete("/api/auth/users/TEST-SUPER-02", headers=caller_headers)
    assert res3.status_code == 400
    assert "last active super admin" in res3.json()["detail"].lower()


def test_soft_delete_preserves_operational_history(client: TestClient, test_session):
    """Users with operational records (interventions, audits, verifications) are soft deleted."""
    intervention = InterventionModel(
        id="INT-HIST-01",
        village_id="VIL-TEST-01",
        village_name="Test Village",
        district="Ludhiana",
        state="Punjab",
        intervention_type="Custom Hiring Center Subsidy",
        target_acres=50.0,
        status="Approved",
        completion_status="Pending",
        assigned_officer_id="TEST-FIELD-01",
        is_synthetic=True,
    )
    test_session.add(intervention)
    test_session.commit()

    super_headers = auth_cookie_headers(client, "TEST-SUPER-01", "super_admin", "Test Super Admin")

    res_del = client.delete("/api/auth/users/TEST-FIELD-01", headers=super_headers)
    assert res_del.status_code == 200
    data = res_del.json()
    assert data["soft_deleted"] is True
    assert "archived" in data["message"].lower() or "retained" in data["message"].lower()

    user_db = test_session.query(UserModel).filter_by(id="TEST-FIELD-01").first()
    assert user_db is not None
    assert user_db.status == "deleted"
    assert user_db.is_active is False

    int_db = test_session.query(InterventionModel).filter_by(id="INT-HIST-01").first()
    assert int_db is not None
    assert int_db.assigned_officer_id == "TEST-FIELD-01"

    res_list = client.get("/api/auth/users", headers=super_headers)
    assert res_list.status_code == 200
    listed_ids = [u["id"] for u in res_list.json()]
    assert "TEST-FIELD-01" not in listed_ids


def test_district_admin_staff_roster_endpoint(client: TestClient):
    """GET /api/auth/staff returns only field_officer and equipment_coordinator accounts."""
    admin_headers = auth_cookie_headers(client, "TEST-ADMIN-01", "admin", "Test Administrator")

    res = client.get("/api/auth/staff", headers=admin_headers)
    assert res.status_code == 200
    staff_list = res.json()
    assert len(staff_list) > 0

    roles = {u["role"] for u in staff_list}
    assert roles.issubset({"field_officer", "equipment_coordinator"})
    assert "admin" not in roles
    assert "super_admin" not in roles


# =============================================================================
# PRODUCTION SECURITY DEFAULTS & SAFE STARTUP VALIDATION TESTS
# =============================================================================

def test_production_and_dev_security_requires_strong_jwt_secret(monkeypatch):
    """Every environment strictly requires an explicit, strong JWT_SECRET of at least 32 chars."""
    from app.config import Settings

    for env_mode in ("production", "development"):
        monkeypatch.setenv("ENVIRONMENT", env_mode)
        monkeypatch.setenv("COOKIE_SECURE", "true" if env_mode == "production" else "false")

        # Missing JWT_SECRET
        monkeypatch.delenv("JWT_SECRET", raising=False)
        with pytest.raises(ValueError, match="JWT_SECRET"):
            Settings()

        # Short/insecure JWT_SECRET (< 32 characters)
        monkeypatch.setenv("JWT_SECRET", "short_secret_under_32")
        with pytest.raises(ValueError, match="JWT_SECRET"):
            Settings()

        # Known placeholder JWT_SECRET
        monkeypatch.setenv("JWT_SECRET", "replace_this_with_a_secure_random_secret_in_production")
        with pytest.raises(ValueError, match="JWT_SECRET"):
            Settings()

    # Valid strong JWT_SECRET (>= 32 characters) in production
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("COOKIE_SECURE", "true")
    strong_secret = "a_super_strong_cryptographic_secret_key_32b_minimum!"
    monkeypatch.setenv("JWT_SECRET", strong_secret)
    prod_settings = Settings()
    assert prod_settings.JWT_SECRET == strong_secret
    assert prod_settings.COOKIE_SECURE is True
    assert prod_settings.ENABLE_DEV_DEMO_ACCOUNTS is False


def test_production_security_forbids_demo_accounts_and_auto_approval(monkeypatch):
    """Production deployment strictly forbids enabling demo accounts or auto-approving registrations."""
    from app.config import Settings

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("COOKIE_SECURE", "true")
    monkeypatch.setenv("JWT_SECRET", "a_super_strong_cryptographic_secret_key_32b_minimum!")

    # Attempting to enable demo accounts in production
    monkeypatch.setenv("ENABLE_DEV_DEMO_ACCOUNTS", "true")
    with pytest.raises(ValueError, match="ENABLE_DEV_DEMO_ACCOUNTS cannot be enabled in a production environment"):
        Settings()

    monkeypatch.setenv("ENABLE_DEV_DEMO_ACCOUNTS", "false")

    # Attempting to enable auto-approve registrations in production
    monkeypatch.setenv("AUTO_APPROVE_PUBLIC_REGISTRATION", "true")
    with pytest.raises(ValueError, match="AUTO_APPROVE_PUBLIC_REGISTRATION cannot be enabled in a production environment"):
        Settings()

    monkeypatch.setenv("AUTO_APPROVE_PUBLIC_REGISTRATION", "false")

    # Insecure cookies forbidden in production
    monkeypatch.setenv("COOKIE_SECURE", "false")
    with pytest.raises(ValueError, match="COOKIE_SECURE must be true in a production environment"):
        Settings()


def test_demo_accounts_misconfigured_without_passwords_handled_safely(test_session):
    """When demo accounts are enabled but no passwords are provided in env, endpoint informs safely."""
    from app.config import get_settings
    settings = get_settings()
    orig_demo = settings.ENABLE_DEV_DEMO_ACCOUNTS
    orig_pw = settings.EVAL_DEMO_PASSWORD
    orig_spw = settings.EVAL_DEMO_SUPERADMIN_PASSWORD
    orig_apw = settings.EVAL_DEMO_ADMIN_PASSWORD
    orig_fpw = settings.EVAL_DEMO_FIELD_OFFICER_PASSWORD
    orig_epw = settings.EVAL_DEMO_EQUIP_COORD_PASSWORD

    try:
        settings.ENABLE_DEV_DEMO_ACCOUNTS = True
        settings.EVAL_DEMO_PASSWORD = ""
        settings.EVAL_DEMO_SUPERADMIN_PASSWORD = ""
        settings.EVAL_DEMO_ADMIN_PASSWORD = ""
        settings.EVAL_DEMO_FIELD_OFFICER_PASSWORD = ""
        settings.EVAL_DEMO_EQUIP_COORD_PASSWORD = ""

        app.dependency_overrides[get_db] = lambda: test_session
        client = TestClient(app)

        res = client.get("/api/auth/demo-accounts")
        assert res.status_code == 200
        data = res.json()
        assert data["enabled"] is False
        assert "misconfigured" in data["notice"].lower()
    finally:
        settings.ENABLE_DEV_DEMO_ACCOUNTS = orig_demo
        settings.EVAL_DEMO_PASSWORD = orig_pw
        settings.EVAL_DEMO_SUPERADMIN_PASSWORD = orig_spw
        settings.EVAL_DEMO_ADMIN_PASSWORD = orig_apw
        settings.EVAL_DEMO_FIELD_OFFICER_PASSWORD = orig_fpw
        settings.EVAL_DEMO_EQUIP_COORD_PASSWORD = orig_epw
        app.dependency_overrides.pop(get_db, None)
