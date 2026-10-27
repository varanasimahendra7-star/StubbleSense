from datetime import datetime, timedelta
from typing import Any, Dict, Optional
import bcrypt
import jwt

from app.config import get_settings

settings = get_settings()


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt with random salt."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plaintext password against bcrypt hash in constant time."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(
    subject: str,
    role: str,
    full_name: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Generate signed JWT containing user ID, role, and expiration."""
    current_settings = get_settings()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=current_settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: Dict[str, Any] = {
        "sub": subject,
        "role": role,
        "full_name": full_name,
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    encoded = jwt.encode(payload, current_settings.JWT_SECRET, algorithm=current_settings.JWT_ALGORITHM)
    return encoded


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a signed JWT token."""
    current_settings = get_settings()
    try:
        payload = jwt.decode(token, current_settings.JWT_SECRET, algorithms=[current_settings.JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None
