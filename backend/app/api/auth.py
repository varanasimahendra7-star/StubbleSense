import secrets
import uuid
from typing import List
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.dependencies import VALID_ROLES, get_current_user, require_roles
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.intervention import FieldVerificationModel, InterventionAuditModel, InterventionModel
from app.models.user import UserModel
from app.schemas.auth import (
    AuthResponse,
    DemoAccountItem,
    DemoAccountsResponse,
    RegistrationStatusResponse,
    RolePolicyItem,
    UserCreateRequest,
    UserDeleteResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
    UserStatusUpdateRequest,
)
from app.services.user_service import get_eval_demo_credentials

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["Authentication & Access Control"])


@router.post("/login", response_model=AuthResponse)
def login(
    payload: UserLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """Authenticate user, set HttpOnly session cookie, and return public profile."""
    user = db.query(UserModel).filter(UserModel.username == payload.username.strip()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active or user.status != "active":
        if user.status == "rejected":
            detail = "Account registration has been rejected. Account is disabled."
        elif user.status == "pending":
            detail = "Account is disabled or pending administrator approval."
        elif user.status == "deactivated":
            detail = "Account is deactivated and disabled. Please contact your administrator."
        else:
            detail = "Account is disabled. Please contact your administrator."
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )

    token = create_access_token(
        subject=user.id,
        role=user.role,
        full_name=user.full_name,
    )
    csrf_token = secrets.token_urlsafe(32)

    # Set secure HttpOnly cookie (no client JavaScript access)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    # Set non-HttpOnly CSRF cookie for Double-Submit protection
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    return AuthResponse(
        user=UserResponse.model_validate(user),
        csrf_token=csrf_token,
        message=f"Welcome, {user.full_name} ({user.role})",
    )


@router.post("/logout")
def logout(response: Response):
    """Clear session cookie and terminate browser authentication."""
    response.delete_cookie(
        key="access_token",
        path="/",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
    )
    response.delete_cookie(
        key="csrf_token",
        path="/",
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
    )
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: UserModel = Depends(get_current_user)):
    """Return profile of currently authenticated user."""
    return UserResponse.model_validate(current_user)


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def provision_user(
    payload: UserCreateRequest,
    current_admin: UserModel = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Provision new staff accounts (restricted exclusively to administrators)."""
    if payload.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role. Must be one of: {', '.join(sorted(VALID_ROLES))}",
        )

    # Only the bootstrap CLI or startup process may create super_admin
    if payload.role == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="super_admin accounts can only be provisioned through the bootstrap process.",
        )

    # Only super_admin may provision admin accounts
    if payload.role == "admin" and current_admin.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super_admin may provision administrator accounts.",
        )

    existing = db.query(UserModel).filter(UserModel.username == payload.username.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{payload.username}' is already registered.",
        )

    new_user = UserModel(
        id=f"USER-{payload.role.upper()[:5]}-{uuid.uuid4().hex[:8].upper()}",
        username=payload.username.strip(),
        full_name=payload.full_name.strip(),
        hashed_password=hash_password(payload.password),
        role=payload.role,
        is_active=True,
        status="active",
        is_synthetic=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return UserResponse.model_validate(new_user)


@router.get("/users", response_model=List[UserResponse])
def list_users(
    current_admin: UserModel = Depends(require_roles("super_admin")),
    db: Session = Depends(get_db),
):
    """List registered users (restricted exclusively to super_admin). Excludes soft-deleted accounts."""
    users = (
        db.query(UserModel)
        .filter(UserModel.status != "deleted")
        .order_by(UserModel.created_at.desc())
        .all()
    )
    return [UserResponse.model_validate(u) for u in users]


@router.get("/staff", response_model=List[UserResponse])
def list_staff(
    current_admin: UserModel = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """List operational staff accounts (field_officer and equipment_coordinator) for District or Super Admin."""
    staff = (
        db.query(UserModel)
        .filter(
            UserModel.role.in_(["field_officer", "equipment_coordinator"]),
            UserModel.status != "deleted",
        )
        .order_by(UserModel.created_at.desc())
        .all()
    )
    return [UserResponse.model_validate(u) for u in staff]


@router.get("/demo-accounts", response_model=DemoAccountsResponse)
def get_demo_accounts(db: Session = Depends(get_db)):
    """Retrieve available evaluation accounts metadata for evaluation testing."""
    current_settings = get_settings()

    # 1. Local Development Demo Accounts Mode (only when ENABLE_DEV_DEMO_ACCOUNTS=true in dev)
    if current_settings.ENABLE_DEV_DEMO_ACCOUNTS:
        try:
            creds = get_eval_demo_credentials()
            items = [
                DemoAccountItem(
                    role=c["role"],
                    label=c["label"],
                    username=c["username"],
                    password=c.get("password", ""),
                    description=c["description"],
                )
                for c in creds
            ]
            return DemoAccountsResponse(
                enabled=True,
                mode="development_demo",
                notice="Development demo mode active. Credentials can be populated automatically.",
                accounts=items,
            )
        except ValueError as err:
            return DemoAccountsResponse(
                enabled=False,
                mode="disabled",
                notice=f"Evaluation demo accounts enabled but misconfigured: {str(err)}",
                accounts=[],
            )

    # 2. Production Evaluation Mode
    # Strictly check for the dedicated provisioned evaluation accounts in the database
    eval_roles_metadata = [
        ("super_admin", "Super Admin", "eval_superadmin", "Full system oversight, user and role administration, cross-district view."),
        ("admin", "District Admin", "eval_admin", "District governance, intervention creation, equipment allocation, and staff management."),
        ("field_officer", "Field Officer", "eval_field_officer", "Dedicated Field Operations dashboard, spot inspection, and on-site clearance verification."),
        ("equipment_coordinator", "Equipment Coordinator", "eval_equipment_coord", "Dedicated Equipment Operations dashboard, machinery allocation, and dispatch mobilization."),
    ]

    active_eval_accounts = []
    for role, label, username, description in eval_roles_metadata:
        user = (
            db.query(UserModel)
            .filter(
                UserModel.role == role,
                UserModel.username == username,
                UserModel.is_active == True,
                UserModel.status == "active",
            )
            .first()
        )
        if user:
            active_eval_accounts.append(
                DemoAccountItem(
                    role=role,
                    label=label,
                    username=user.username,
                    password="",  # Strictly omitted/empty in production - passwords are never exposed
                    description=description,
                )
            )

    # STRICT CHECK: All 4 dedicated eval_* accounts MUST actually exist in the database
    if len(active_eval_accounts) == 4:
        return DemoAccountsResponse(
            enabled=True,
            mode="evaluation",
            notice="Evaluation accounts are active for all four operational roles. Click a role to pre-fill the username, then enter your assigned evaluation password.",
            accounts=active_eval_accounts,
        )

    return DemoAccountsResponse(
        enabled=False,
        mode="disabled",
        notice="Evaluation accounts are not active on this deployment. Staff and evaluators must use provisioned credentials.",
        accounts=[],
    )


@router.get("/registration-status", response_model=RegistrationStatusResponse)
def get_registration_status():
    """Retrieve public registration capability status and role policy metadata."""
    current_settings = get_settings()
    is_auto = bool(current_settings.AUTO_APPROVE_PUBLIC_REGISTRATION)

    roles = [
        RolePolicyItem(
            role="super_admin",
            label="Super Admin (System Bootstrap Only)",
            description="Full system pass-through authority. Provisioned exclusively via secure CLI bootstrap; cannot be self-registered.",
            can_self_register=False,
            requires_approval=True,
        ),
        RolePolicyItem(
            role="admin",
            label="District Admin (District Administrator)",
            description="District-level governance and administrative coordination. Provisioned only by Super Admin.",
            can_self_register=False,
            requires_approval=True,
        ),
        RolePolicyItem(
            role="field_officer",
            label="Field Officer (Ground Verification & Audit)",
            description="Ground inspection, residue verification, and local intervention management."
            + (" (Auto-activated for local evaluation)" if is_auto else " Requires administrator approval before activation."),
            can_self_register=True,
            requires_approval=not is_auto,
        ),
        RolePolicyItem(
            role="equipment_coordinator",
            label="Equipment Coordinator (Machinery Dispatch)",
            description="Machinery allocation, Custom Hiring Center tracking, and dispatch mobilization."
            + (" (Auto-activated for local evaluation)" if is_auto else " Requires administrator approval before activation."),
            can_self_register=True,
            requires_approval=not is_auto,
        ),
    ]

    if not current_settings.ENABLE_PUBLIC_REGISTRATION:
        return RegistrationStatusResponse(
            enabled=False,
            auto_approve=False,
            notice="Public self-registration is disabled by default (ENABLE_PUBLIC_REGISTRATION=false). Accounts must be provisioned by an administrator or via CLI bootstrap.",
            policy="All operational staff accounts must be provisioned by an authorized District or Super Administrator.",
            roles=roles,
        )

    if is_auto:
        notice = "Self-registration is enabled with automatic activation for operational staff (field_officer and equipment_coordinator) in this local evaluation environment."
        policy = "Self-registered field officers and equipment coordinators are immediately activated upon registration."
    else:
        notice = "Self-registration is enabled. Accounts are created in a PENDING inactive state and require administrator approval before access is granted."
        policy = "Self-registered staff accounts require manual review and activation by an administrator before signing in."

    return RegistrationStatusResponse(
        enabled=True,
        auto_approve=is_auto,
        notice=notice,
        policy=policy,
        roles=roles,
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register_user(
    payload: UserRegisterRequest,
    db: Session = Depends(get_db),
):
    """Public self-registration endpoint for prospective operational staff."""
    current_settings = get_settings()
    if not current_settings.ENABLE_PUBLIC_REGISTRATION:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public self-registration is disabled (ENABLE_PUBLIC_REGISTRATION=false). Accounts must be provisioned by an administrator or via CLI bootstrap.",
        )

    if payload.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role '{payload.role}'. Must be one of: {', '.join(sorted(VALID_ROLES))}",
        )

    # Super admin accounts can only be provisioned via bootstrap process
    if payload.role == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="super_admin accounts can only be provisioned through the bootstrap process.",
        )

    # Admin accounts cannot be self-registered
    if payload.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="District Admin accounts cannot be self-registered. Only a Super Admin can provision administrator accounts.",
        )

    # Check for existing username
    existing = db.query(UserModel).filter(UserModel.username == payload.username.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{payload.username}' is already registered.",
        )

    # Determine initial activation state:
    # Auto-approval only applies to field_officer and equipment_coordinator when AUTO_APPROVE_PUBLIC_REGISTRATION=True
    is_auto_approved = (
        bool(current_settings.AUTO_APPROVE_PUBLIC_REGISTRATION)
        and payload.role in ("field_officer", "equipment_coordinator")
    )
    initial_status = "active" if is_auto_approved else "pending"

    new_user = UserModel(
        id=f"USER-{payload.role.upper()[:5]}-{uuid.uuid4().hex[:8].upper()}",
        username=payload.username.strip(),
        full_name=payload.full_name.strip(),
        hashed_password=hash_password(payload.password),
        role=payload.role,
        is_active=is_auto_approved,
        status=initial_status,
        is_synthetic=False,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    message = (
        "Registration successful. Your account has been automatically activated for evaluation and is ready for sign in."
        if is_auto_approved
        else "Registration submitted successfully. Your account is pending administrator approval before access is granted."
    )

    return AuthResponse(
        user=UserResponse.model_validate(new_user),
        message=message,
    )


@router.patch("/users/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: str,
    payload: UserStatusUpdateRequest,
    current_admin: UserModel = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Update status of an account (approve pending registrations, reject, deactivate, or activate)."""
    target_user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not target_user or target_user.status == "deleted":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id '{user_id}' was not found.",
        )

    # 1. Determine target status & is_active
    if payload.status:
        req_status = payload.status.lower().strip()
        if req_status not in ("active", "pending", "rejected", "deactivated"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid status '{payload.status}'. Must be one of: active, pending, rejected, deactivated.",
            )
        new_status = req_status
        new_is_active = (req_status == "active")
    elif payload.is_active is not None:
        new_is_active = payload.is_active
        new_status = "active" if new_is_active else "deactivated"
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Must specify either 'status' or 'is_active'.",
        )

    # 2. Only super_admin may modify admin or super_admin accounts
    if target_user.role in ("super_admin", "admin") and current_admin.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="District Admins may only manage Field Officer and Equipment Coordinator accounts.",
        )

    # 3. Prevent deactivating/rejecting the last active Super Admin
    if target_user.role == "super_admin" and not new_is_active:
        active_super_count = (
            db.query(UserModel)
            .filter(
                UserModel.role == "super_admin",
                UserModel.is_active == True,
                UserModel.status != "deleted",
            )
            .count()
        )
        if active_super_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate the last active Super Admin account. System must maintain at least one active Super Admin.",
            )

    # 4. Prevent administrators from deactivating or rejecting their own account
    if target_user.id == current_admin.id and not new_is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate or reject their own active account.",
        )

    target_user.status = new_status
    target_user.is_active = new_is_active
    db.commit()
    db.refresh(target_user)
    return UserResponse.model_validate(target_user)


@router.delete("/users/{user_id}", response_model=UserDeleteResponse)
def delete_user(
    user_id: str,
    current_admin: UserModel = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Safely delete or soft-delete a user account while preserving operational audit history."""
    target_user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not target_user or target_user.status == "deleted":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id '{user_id}' was not found.",
        )

    # 1. District Admin can delete only field_officer and equipment_coordinator accounts
    if target_user.role in ("super_admin", "admin") and current_admin.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="District Admins may only manage and delete Field Officer and Equipment Coordinator accounts.",
        )

    # 2. Prevent deletion of the last active Super Admin
    if target_user.role == "super_admin":
        active_super_count = (
            db.query(UserModel)
            .filter(
                UserModel.role == "super_admin",
                UserModel.is_active == True,
                UserModel.status != "deleted",
            )
            .count()
        )
        if active_super_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last active Super Admin account. System must maintain at least one active Super Admin.",
            )

    # 3. Prevent users from deleting their own account
    if target_user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account.",
        )

    # 4. Check for associated operational history (interventions, audits, verifications)
    has_interventions = (
        db.query(InterventionModel)
        .filter(
            (InterventionModel.assigned_officer_id == target_user.id)
            | (InterventionModel.assigned_officer_id == target_user.username)
        )
        .first()
        is not None
    )
    has_audits = (
        db.query(InterventionAuditModel)
        .filter(
            (InterventionAuditModel.changed_by == target_user.full_name)
            | (InterventionAuditModel.changed_by == target_user.username)
        )
        .first()
        is not None
    )
    has_verifications = (
        db.query(FieldVerificationModel)
        .filter(
            (FieldVerificationModel.verifier_name == target_user.full_name)
            | (FieldVerificationModel.verifier_name == target_user.username)
        )
        .first()
        is not None
    )

    has_operational_history = has_interventions or has_audits or has_verifications

    if has_operational_history:
        # Soft-delete: retain record to preserve historical audit trail & foreign keys safely
        target_user.status = "deleted"
        target_user.is_active = False
        db.commit()
        return UserDeleteResponse(
            message=f"Account '@{target_user.username}' has historical operational records and was safely archived (soft-deleted).",
            user_id=target_user.id,
            deleted_id=target_user.id,
            soft_deleted=True,
        )
    else:
        # Hard-delete: cleanly purge accounts with zero operational history
        db.delete(target_user)
        db.commit()
        return UserDeleteResponse(
            message=f"Account '@{target_user.username}' has been permanently deleted.",
            user_id=target_user.id,
            deleted_id=target_user.id,
            soft_deleted=False,
        )
