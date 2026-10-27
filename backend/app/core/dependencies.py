import secrets
from typing import Callable, List, Optional
from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database import get_db
from app.models.user import UserModel

VALID_ROLES = {"super_admin", "admin", "field_officer", "equipment_coordinator"}


def verify_csrf(request: Request) -> None:
    """Validate CSRF protection for cookie-authenticated mutating requests.

    Safe methods (GET, HEAD, OPTIONS) do not require CSRF token.
    Requests without cookie authentication (e.g. Bearer auth or unauthenticated endpoints) do not require CSRF token.
    Browser sessions using the 'access_token' cookie MUST provide a matching 'X-CSRF-Token' header.
    """
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return

    # If no cookie auth is present (or cookie has been cleared/deleted), proceed
    if not request.cookies.get("access_token"):
        return

    # Whitelist login and registration endpoints (cookies from prior session shouldn't block login or registration)
    if request.url.path.endswith("/auth/login") or request.url.path.endswith("/auth/register"):
        return

    csrf_cookie = request.cookies.get("csrf_token")
    csrf_header = request.headers.get("x-csrf-token")

    if not csrf_cookie or not csrf_header or not secrets.compare_digest(csrf_cookie, csrf_header):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF validation failed. Missing or invalid X-CSRF-Token header.",
        )


def get_current_user(
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
) -> UserModel:
    """Extract authenticated user from HttpOnly cookie or Authorization Bearer header."""
    token: Optional[str] = None

    if access_token:
        token = access_token
    elif authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or token is invalid. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload["sub"]
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_roles(*allowed_roles: str) -> Callable[[UserModel], UserModel]:
    """Dependency factory checking that the authenticated user possesses an authorized role.

    super_admin is granted automatic pass-through for all general application roles.
    If super_admin is explicitly the ONLY required role, non-super_admin accounts are rejected.
    """
    def role_checker(current_user: UserModel = Depends(get_current_user)) -> UserModel:
        # If user is super_admin, they pass all role checks
        if current_user.role == "super_admin":
            return current_user

        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {', '.join(allowed_roles)}. Your role: {current_user.role}.",
            )
        return current_user

    return role_checker
