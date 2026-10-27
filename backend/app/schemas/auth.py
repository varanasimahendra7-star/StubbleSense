from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class UserResponse(BaseModel):
    """Public user profile schema with no sensitive fields."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    full_name: str
    role: str
    is_active: bool
    status: str = "active"
    is_synthetic: bool


class UserLoginRequest(BaseModel):
    """Credentials payload for logging in."""

    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6)


class UserCreateRequest(BaseModel):
    """Administrator payload for provisioning new staff accounts."""

    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    full_name: str = Field(..., min_length=2, max_length=150)
    role: str = Field(..., description="super_admin, admin, field_officer, or equipment_coordinator")


class UserRegisterRequest(BaseModel):
    """Public registration payload for requesting new staff accounts."""

    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    full_name: str = Field(..., min_length=2, max_length=150)
    role: str = Field(..., description="Requested role: field_officer or equipment_coordinator")


class UserStatusUpdateRequest(BaseModel):
    """Payload for updating user active/pending/rejected/deactivated status."""

    is_active: Optional[bool] = None
    status: Optional[str] = Field(None, description="active, pending, rejected, deactivated")


class UserDeleteResponse(BaseModel):
    """Response returned upon user deletion."""

    message: str
    user_id: str
    deleted_id: str
    soft_deleted: bool


class RolePolicyItem(BaseModel):
    """Role registration policy item."""

    role: str
    label: str
    description: str
    can_self_register: bool
    requires_approval: bool


class RegistrationStatusResponse(BaseModel):
    """Status and policy details for public portal registration."""

    enabled: bool
    auto_approve: bool = False
    notice: str
    policy: str
    roles: list[RolePolicyItem]


class AuthResponse(BaseModel):
    """Authentication response returning public user info and message."""

    user: UserResponse
    csrf_token: Optional[str] = None
    message: str = "Authentication successful"


class DemoAccountItem(BaseModel):
    """Evaluation demo account metadata and credentials for evaluation."""

    role: str
    label: str
    username: str
    password: str = ""
    description: str


class DemoAccountsResponse(BaseModel):
    """Response containing status and available evaluation demo accounts."""

    enabled: bool
    mode: str = "evaluation"
    notice: str
    accounts: list[DemoAccountItem] = []
