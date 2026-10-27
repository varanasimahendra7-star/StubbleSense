import os

# Explicit test-only JWT secret for automated test environments (satisfies >= 32 character requirement)
os.environ.setdefault("JWT_SECRET", "test_suite_jwt_secret_minimum_32_characters_strictly_for_testing!")

import pytest

from app.core.dependencies import get_current_user
from app.main import app
from app.models.user import UserModel


@pytest.fixture(autouse=True)
def override_auth_for_legacy_tests(request):
    """Default test authentication fixture for existing regression suites.

    Provides a default admin user so existing tests can execute without breaking.
    Does NOT override for test_auth.py so auth tests run with real authentication.
    """
    if "test_auth" in request.node.fspath.basename:
        # Do not override auth for authentication tests
        yield
        return

    mock_user = UserModel(
        id="MOCK-ADMIN-01",
        username="legacy_test_admin",
        full_name="Legacy Test Administrator",
        hashed_password="mock",
        role="admin",
        is_active=True,
        is_synthetic=True,
    )

    app.dependency_overrides[get_current_user] = lambda: mock_user
    yield
    app.dependency_overrides.pop(get_current_user, None)
