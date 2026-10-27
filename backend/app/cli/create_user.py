import argparse
import getpass
from pathlib import Path
import sys

# Ensure backend root is on sys.path regardless of execution working directory
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.security import hash_password
from app.database import SessionLocal, init_db
from app.models.user import UserModel


def main():
    parser = argparse.ArgumentParser(description="StubbleSense Secure User Provisioning CLI")
    parser.add_argument("--username", required=True, help="Unique username")
    parser.add_argument(
        "--password",
        required=False,
        default=None,
        help="Secure password (minimum 8 characters). If omitted, a hidden password prompt will be shown.",
    )
    parser.add_argument("--full-name", required=True, help="Full name or designated title")
    parser.add_argument(
        "--role",
        required=True,
        choices=["super_admin", "admin", "field_officer", "equipment_coordinator"],
        help="Access role",
    )

    args = parser.parse_args()

    password = args.password
    if not password:
        password = getpass.getpass("Enter secure password (hidden): ")

    if len(password) < 8:
        print("[ERROR] Password must be at least 8 characters long.")
        sys.exit(1)

    init_db()
    db = SessionLocal()
    try:
        existing = db.query(UserModel).filter(UserModel.username == args.username.strip()).first()
        if existing:
            print(f"[ERROR] User with username '{args.username}' already exists.")
            sys.exit(1)

        user_id = f"USER-{args.role.upper()[:5]}-{args.username.lower()[:8]}"
        user = UserModel(
            id=user_id,
            username=args.username.strip(),
            full_name=args.full_name.strip(),
            hashed_password=hash_password(password),
            role=args.role,
            is_active=True,
            status="active",
            is_synthetic=False,
        )
        db.add(user)
        db.commit()
        print(f"[SUCCESS] User '{user.username}' successfully created with role '{user.role}'.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
