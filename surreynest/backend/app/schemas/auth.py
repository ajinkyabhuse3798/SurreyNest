"""Pydantic schemas for JWT tokens and authentication."""

from pydantic import BaseModel

from app.schemas.user import UserResponse


class Token(BaseModel):
    """JWT token — used internally only (never exposed to API clients).

    Attributes:
        access_token: The JWT string.
        token_type: Always "bearer".
    """

    access_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    """Login response — returns user info only (JWT is in httpOnly cookie).

    Attributes:
        user: Authenticated user info.
        message: Success message.
    """

    user: UserResponse
    message: str = "Login successful"


class TokenData(BaseModel):
    """Decoded JWT payload used internally for auth checks.

    Attributes:
        user_id: UUID of the authenticated user.
        role: User role (student, landlord, admin).
    """

    user_id: str
    role: str
