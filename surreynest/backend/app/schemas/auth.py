"""Pydantic schemas for JWT tokens and authentication."""

from pydantic import BaseModel


class Token(BaseModel):
    """JWT token response returned after successful login.

    Attributes:
        access_token: The JWT string.
        token_type: Always "bearer".
    """

    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Decoded JWT payload used internally for auth checks.

    Attributes:
        user_id: UUID of the authenticated user.
        role: User role (student, landlord, admin).
    """

    user_id: str
    role: str
