"""Pydantic schemas for JWT tokens and authentication."""

from pydantic import BaseModel, EmailStr

from app.schemas.user import UserResponse


class Token(BaseModel):
    """JWT token, used internally only (never exposed to API clients).

    Attributes:
        access_token: The JWT string.
        token_type: Always "bearer".
    """

    access_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    """Login response, returns user info only (JWT is in httpOnly cookie).

    Attributes:
        user: Authenticated user info.
        message: Success message.
    """

    user: UserResponse
    message: str = "Login successful"


class RegisterResponse(BaseModel):
    """Registration response with verification guidance."""

    user: UserResponse
    requires_verification: bool = True
    message: str = "Account created"


class TokenData(BaseModel):
    """Decoded JWT payload used internally for auth checks.

    Attributes:
        user_id: UUID of the authenticated user.
        role: User role (student, landlord, admin).
    """

    user_id: str
    role: str


class ForgotPasswordRequest(BaseModel):
    """Request body for forgot-password flow.

    Attributes:
        email: Email address of the account to reset.
    """

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Request body for resetting the password with a token.

    Attributes:
        token: Raw reset token from the email link.
        new_password: The new password to set.
    """

    token: str
    new_password: str


class VerifyEmailRequest(BaseModel):
    """Request body for email verification.

    Attributes:
        email: Email address of the account to verify.
        token: 6-digit verification code.
    """

    email: EmailStr
    token: str


class ResendVerificationRequest(BaseModel):
    """Request body for resending verification code.

    Attributes:
        email: Email address to resend the code to.
    """

    email: EmailStr


class MessageResponse(BaseModel):
    """Generic success message response.

    Attributes:
        message: Human-readable success message.
    """

    message: str
