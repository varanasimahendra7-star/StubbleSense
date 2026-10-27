import os
import uuid
from typing import Optional
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security import hash_password
from app.models.intervention import InterventionModel
from app.models.user import UserModel

settings = get_settings()


def ensure_initial_super_admin(db: Session) -> Optional[UserModel]:
    """Provision initial super_admin from environment variables if no super_admin exists.

    Only the bootstrap process (CLI create_user or explicit INITIAL_SUPER_ADMIN_PASSWORD env)
    is authorized to create super_admin accounts.
    """
    super_admin = db.query(UserModel).filter(UserModel.role == "super_admin").first()
    if super_admin:
        return None

    username = os.getenv("INITIAL_SUPER_ADMIN_USERNAME", "superadmin").strip()
    password = os.getenv("INITIAL_SUPER_ADMIN_PASSWORD")
    if not password:
        # Require explicit password environment variable to bootstrap via startup
        return None

    full_name = os.getenv("INITIAL_SUPER_ADMIN_FULL_NAME", "System Developer & Super Admin").strip()
    new_super_admin = UserModel(
        id=f"USER-SUPER-{uuid.uuid4().hex[:8].upper()}",
        username=username,
        full_name=full_name,
        hashed_password=hash_password(password.strip()),
        role="super_admin",
        is_active=True,
        status="active",
        is_synthetic=False,
    )
    db.add(new_super_admin)
    db.commit()
    db.refresh(new_super_admin)
    return new_super_admin


def ensure_initial_admin(db: Session) -> Optional[UserModel]:
    """Provision initial admin from environment variables if no admin exists."""
    admin_user = db.query(UserModel).filter(UserModel.role.in_(("admin", "super_admin"))).first()
    if admin_user:
        return None

    # Check for admin credentials in environment
    username = os.getenv("INITIAL_ADMIN_USERNAME", "admin").strip()
    password = os.getenv("INITIAL_ADMIN_PASSWORD", "Admin@Stubble2026!").strip()
    full_name = os.getenv("INITIAL_ADMIN_FULL_NAME", "District Agricultural Officer (Admin)").strip()

    new_admin = UserModel(
        id=f"USER-ADMIN-{uuid.uuid4().hex[:8].upper()}",
        username=username,
        full_name=full_name,
        hashed_password=hash_password(password),
        role="admin",
        is_active=True,
        status="active",
        is_synthetic=True,
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    return new_admin


def get_eval_demo_credentials() -> list[dict]:
    """Retrieve evaluation demo accounts definitions with configured passwords from environment."""
    current_settings = get_settings()
    fallback_pw = current_settings.EVAL_DEMO_PASSWORD

    def resolve_password(role_pw: str, prefix: str) -> str:
        if role_pw:
            return role_pw
        if fallback_pw:
            return f"{prefix}@{fallback_pw}"
        raise ValueError(
            "Demo accounts are enabled (ENABLE_DEV_DEMO_ACCOUNTS=true), but no demo passwords were provided. "
            "Please configure EVAL_DEMO_PASSWORD or role-specific passwords in your environment."
        )

    return [
        {
            "id": "DEMO-USER-SUPER-01",
            "username": "superadmin_demo",
            "full_name": "Developer Super Admin",
            "password": resolve_password(current_settings.EVAL_DEMO_SUPERADMIN_PASSWORD, "Super"),
            "role": "super_admin",
            "label": "Developer Super Admin",
            "description": "Full system pass-through access, user management, and configuration inspection.",
        },
        {
            "id": "DEMO-USER-ADMIN-01",
            "username": "admin_demo",
            "full_name": "District Officer H. Singh (Admin)",
            "password": resolve_password(current_settings.EVAL_DEMO_ADMIN_PASSWORD, "Admin"),
            "role": "admin",
            "label": "District Admin",
            "description": "District-level governance, intervention creation, status transitions, and risk monitoring.",
        },
        {
            "id": "DEMO-USER-FIELD-01",
            "username": "field_officer_demo",
            "full_name": "Nodal Field Officer S. Sandhu",
            "password": resolve_password(current_settings.EVAL_DEMO_FIELD_OFFICER_PASSWORD, "Field"),
            "role": "field_officer",
            "label": "Field Officer",
            "description": "Field inspections, spot audits, and on-site clearance verification for assigned interventions.",
        },
        {
            "id": "DEMO-USER-EQUIP-01",
            "username": "equipment_coord_demo",
            "full_name": "CHC Dispatcher M. Dhillon",
            "password": resolve_password(current_settings.EVAL_DEMO_EQUIP_COORD_PASSWORD, "Equip"),
            "role": "equipment_coordinator",
            "label": "Equipment Coordinator",
            "description": "Custom Hiring Center machinery allocation, equipment status tracking, and dispatching.",
        },
    ]


def seed_dev_demo_users(db: Session) -> int:
    """Seed demo accounts for evaluation deployment only when ENABLE_DEV_DEMO_ACCOUNTS=true."""
    current_settings = get_settings()
    if not current_settings.ENABLE_DEV_DEMO_ACCOUNTS:
        return 0

    try:
        demo_users = get_eval_demo_credentials()
    except ValueError:
        # Passwords not configured in environment; do not seed demo accounts
        return 0

    added = 0
    for u in demo_users:
        existing = db.query(UserModel).filter(UserModel.username == u["username"]).first()
        if not existing:
            new_u = UserModel(
                id=u["id"],
                username=u["username"],
                full_name=u["full_name"],
                hashed_password=hash_password(u["password"]),
                role=u["role"],
                is_active=True,
                status="active",
                is_synthetic=True,
            )
            db.add(new_u)
            added += 1

    # Ensure field_officer_demo has at least one assigned synthetic intervention
    fo_assigned = db.query(InterventionModel).filter(
        InterventionModel.assigned_officer_id == "DEMO-USER-FIELD-01"
    ).first()
    if not fo_assigned:
        target_int = db.query(InterventionModel).filter(InterventionModel.id == "INT-2026-PB-001").first()
        if not target_int:
            target_int = db.query(InterventionModel).first()
        if target_int:
            target_int.assigned_officer_id = "DEMO-USER-FIELD-01"
            db.add(target_int)
            added += 1

    if added > 0:
        db.commit()
    return added


def ensure_production_evaluation_accounts(db: Session) -> int:
    """Idempotently bootstrap evaluation accounts for all 4 roles in production when configured via environment.

    Compatible with PostgreSQL and SQLite. Ensures unique, securely hashed credentials per role.
    Updates existing eval_* accounts' password hashes to match configured environment password.
    Ensures assigned intervention for field officer.
    """
    current_settings = get_settings()

    eval_shared_pw = current_settings.EVAL_ACCOUNTS_PASSWORD
    sp_pw = current_settings.EVAL_SUPERADMIN_PASSWORD or eval_shared_pw
    adm_pw = current_settings.EVAL_ADMIN_PASSWORD or eval_shared_pw
    fo_pw = current_settings.EVAL_FIELD_OFFICER_PASSWORD or eval_shared_pw
    ec_pw = current_settings.EVAL_EQUIP_COORD_PASSWORD or eval_shared_pw

    role_specs = [
        ("super_admin", "eval_superadmin", "System Super Admin (Evaluation)", sp_pw),
        ("admin", "eval_admin", "District Administrator (Evaluation)", adm_pw),
        ("field_officer", "eval_field_officer", "Nodal Field Officer (Evaluation)", fo_pw),
        ("equipment_coordinator", "eval_equipment_coord", "CHC Equipment Dispatcher (Evaluation)", ec_pw),
    ]

    added_or_updated = 0
    for role, username, full_name, password in role_specs:
        if not password:
            continue

        existing = db.query(UserModel).filter(UserModel.username == username).first()
        if not existing:
            new_user = UserModel(
                id=f"USER-{role.upper()[:5]}-EVAL",
                username=username,
                full_name=full_name,
                hashed_password=hash_password(password),
                role=role,
                is_active=True,
                status="active",
                is_synthetic=False,
            )
            db.add(new_user)
            added_or_updated += 1
        else:
            # Update password hash if password has been provided in environment
            existing.hashed_password = hash_password(password)
            existing.is_active = True
            existing.status = "active"
            existing.full_name = full_name
            db.add(existing)
            added_or_updated += 1

    if added_or_updated > 0:
        db.commit()

    # Ensure eval_field_officer has an assigned intervention in the database for verification testing
    fo_user = db.query(UserModel).filter(UserModel.username == "eval_field_officer").first()
    if fo_user:
        assigned = db.query(InterventionModel).filter(InterventionModel.assigned_officer_id == fo_user.id).first()
        if not assigned:
            target_int = db.query(InterventionModel).filter(InterventionModel.id == "INT-2026-PB-001").first()
            if not target_int:
                target_int = db.query(InterventionModel).first()
            if target_int:
                target_int.assigned_officer_id = fo_user.id
                db.add(target_int)
                db.commit()

    return added_or_updated
