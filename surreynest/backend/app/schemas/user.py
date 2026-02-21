"""Pydantic schemas for user registration and responses."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


class UserCreate(BaseModel):
    """Request body for user registration.

    Attributes:
        email: Valid email address, lowercased on validation.
        password: Plain text password, minimum 8 characters.
    """

    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, v: str) -> str:
        """Ensure email is always stored lowercase."""
        return v.lower()

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        """Enforce minimum password length of 8 characters."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserResponse(BaseModel):
    """Response body for user data — never includes password fields.

    Attributes:
        id: User UUID.
        email: User email.
        role: User role (student, landlord, admin).
        created_at: Account creation timestamp.
    """

    id: uuid.UUID
    email: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}
