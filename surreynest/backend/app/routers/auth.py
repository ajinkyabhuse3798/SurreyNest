"""Auth routes: register, login, logout, get profile, delete account,
forgot/reset password, email verification.

Thin route layer, delegates to auth_service for hashing and JWT creation.
JWT is set as an httpOnly cookie (not localStorage) to prevent XSS theft.
"""

import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.auth_token import AuthToken
from app.models.review import Review
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginResponse,
    MessageResponse,
    RegisterResponse,
    ResendVerificationRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.schemas.user import UserCreate, UserResponse
from app.services.auth_service import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.services.email_service import send_password_reset_email, send_verification_email

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Token helpers ─────────────────────────────────────────────────────────────

_RESET_TTL_MINUTES = 15
_VERIFY_TTL_HOURS = 24


def _make_token() -> tuple[str, str]:
    """Generate a cryptographically secure token and its SHA-256 hash.

    Returns:
        (raw_token, token_hash), store the hash, send the raw token by email.
    """
    raw = secrets.token_urlsafe(32)
    digest = hashlib.sha256(raw.encode()).hexdigest()
    return raw, digest


def _make_otp() -> tuple[str, str]:
    """Generate a 6-digit numeric OTP and its SHA-256 hash.

    Returns:
        (raw_otp, otp_hash)
    """
    raw = "".join(secrets.choice("0123456789") for _ in range(6))
    digest = hashlib.sha256(raw.encode()).hexdigest()
    return raw, digest


def _set_auth_cookie(response: Response, user: User) -> None:
    """Write the signed auth cookie for a user session."""
    token = create_access_token(user.id, user.role)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        max_age=settings.access_token_expire_days * 86400,
        path="/",
    )


def _invalidate_old_tokens(db: Session, user_id: object, token_type: str) -> None:
    """Mark any existing unused tokens of this type as used (prevents multiple valid links).

    Args:
        db: SQLAlchemy session.
        user_id: User UUID.
        token_type: "reset" or "verify".
    """
    now = datetime.now(timezone.utc)
    db.query(AuthToken).filter(
        AuthToken.user_id == user_id,
        AuthToken.token_type == token_type,
        AuthToken.used_at.is_(None),
    ).update({"used_at": now}, synchronize_session="fetch")


@router.post(
    "/auth/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
@limiter.limit("5/minute")
async def register(
    request: Request,
    response: Response,
    user_data: UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> RegisterResponse:
    """Create a new user account.

    Args:
        user_data: Email and password validated by Pydantic schema.
        db: SQLAlchemy session.

    Returns:
        Created user details (never includes password).

    Raises:
        HTTPException: 400 if email already registered.
    """
    # Normalise email, login already does .lower(), registration must match
    user_data.email = user_data.email.strip().lower()

    # Check for existing user
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already registered with this email. Please try logging in.",
        )

    # Create user
    user = User(
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        role="student",
        created_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if not settings.smtp_host:
        user.is_verified = True
        user.last_login = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)
        _set_auth_cookie(response, user)

        logger.info("User registered and auto-verified (SMTP disabled): %s", user.email)
        return RegisterResponse(
            user=UserResponse.model_validate(user),
            requires_verification=False,
            message="Account created. You're signed in.",
        )

    # Send verification email (best-effort, don't block registration if it fails)
    raw_token, token_hash = _make_otp()
    verify_token = AuthToken(
        user_id=user.id,
        token_hash=token_hash,
        token_type="verify",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=_VERIFY_TTL_HOURS),
    )
    db.add(verify_token)
    db.commit()

    background_tasks.add_task(send_verification_email, user.email, raw_token)

    logger.info("User registered and awaiting verification: %s", user.email)
    return RegisterResponse(
        user=UserResponse.model_validate(user),
        requires_verification=True,
        message="Account created. Check your email for the verification code.",
    )


@router.post(
    "/auth/login",
    response_model=LoginResponse,
    summary="Login and get auth cookie",
)
@limiter.limit("10/minute")
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> LoginResponse:
    """Authenticate user and set a JWT httpOnly cookie.

    Uses OAuth2 password flow (username field = email).
    JWT is set as an httpOnly cookie ONLY, never exposed in the response body.
    Returns user info (id, email, role) for the frontend to display.

    Args:
        response: FastAPI-injected response, used to set the auth cookie.
        form_data: OAuth2 form with username (email) and password.
        db: SQLAlchemy session.

    Returns:
        LoginResponse with user info (no token).

    Raises:
        HTTPException: 401 if credentials are invalid.
    """
    user = db.query(User).filter(User.email == form_data.username.lower()).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not settings.smtp_host and not user.is_verified:
        user.is_verified = True

    # Update last_login
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    logger.info("User logged in: %s", user.email)

    # Set JWT as httpOnly cookie (XSS-safe), the ONLY place the token lives.
    # JavaScript cannot read this cookie.
    _set_auth_cookie(response, user)

    # Return user info (NOT the token), frontend uses this for display
    return LoginResponse(
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/auth/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Logout, clear auth cookie",
)
async def logout() -> Response:
    """Clear the httpOnly JWT cookie."""
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(
        key="access_token",
        path="/",
        httponly=True,
        samesite="lax",
    )
    logger.info("User logged out (cookie cleared)")
    return response


# ── Profile endpoints ────────────────────────────────────────────────────────


@router.get(
    "/auth/me",
    response_model=UserResponse,
    summary="Get current user profile",
)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Return the currently authenticated user's profile.

    Args:
        current_user: Authenticated user from JWT token.

    Returns:
        User profile data (never includes password).
    """
    return UserResponse.model_validate(current_user)


@router.delete(
    "/auth/me",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete account and anonymise reviews",
)
async def delete_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Delete the authenticated user's account.

    Anonymises all reviews by setting user_id to NULL (preserving the
    review content), then deletes the user row.

    Args:
        current_user: Authenticated user from JWT token.
        db: SQLAlchemy session.

    Returns:
        204 No Content on success.
    """
    # Anonymise all reviews by this user (set user_id=NULL)
    db.query(Review).filter(Review.user_id == current_user.id).update(
        {"user_id": None}, synchronize_session="fetch"
    )

    # Delete the user row
    db.delete(current_user)
    db.commit()

    logger.info("User account deleted and reviews anonymised: %s", current_user.email)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Password reset ────────────────────────────────────────────────────────────


@router.post(
    "/auth/forgot-password",
    response_model=MessageResponse,
    summary="Request a password reset email",
)
@limiter.limit("3/hour")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Send a password-reset link to the given email address.

    Always returns 200, we never reveal whether an email is registered.

    Args:
        body: Email address of the account.
        db: SQLAlchemy session.

    Returns:
        Generic success message (same whether email exists or not).
    """
    if not settings.smtp_host:
        logger.info("Password reset requested while SMTP is disabled.")
        return MessageResponse(
            message=(
                "Password reset is not available on this deployment yet because "
                "email delivery is not configured."
            )
        )

    email = body.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()

    if user:
        _invalidate_old_tokens(db, user.id, "reset")
        raw_token, token_hash = _make_token()
        reset_token = AuthToken(
            user_id=user.id,
            token_hash=token_hash,
            token_type="reset",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=_RESET_TTL_MINUTES),
        )
        db.add(reset_token)
        db.commit()
        try:
            await send_password_reset_email(user.email, raw_token)
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to send reset email to %s: %s", email, exc)

    # Always return success, timing-safe, doesn't leak account existence
    return MessageResponse(
        message="If that email is registered, you'll receive a reset link shortly."
    )


@router.post(
    "/auth/reset-password",
    response_model=MessageResponse,
    summary="Reset password using a valid token",
)
@limiter.limit("5/hour")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Validate a password-reset token and update the user's password.

    Args:
        body: Raw token from the email link + new password.
        db: SQLAlchemy session.

    Returns:
        Success message.

    Raises:
        HTTPException: 400 if token is invalid, expired, or already used.
        HTTPException: 422 if new_password fails complexity rules.
    """
    from app.schemas.user import UserCreate  # reuse validator

    # Validate password strength
    try:
        UserCreate(email="x@x.com", password=body.new_password)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters with at least one letter and one number.",
        )

    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    db_token = (
        db.query(AuthToken)
        .filter(
            AuthToken.token_hash == token_hash,
            AuthToken.token_type == "reset",
        )
        .first()
    )

    now = datetime.now(timezone.utc)

    if not db_token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link.")
    if db_token.used_at is not None:
        raise HTTPException(status_code=400, detail="This reset link has already been used.")
    expires = db_token.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < now:
        raise HTTPException(status_code=400, detail="This reset link has expired. Please request a new one.")

    user = db.query(User).filter(User.id == db_token.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset link.")

    user.hashed_password = hash_password(body.new_password)
    db_token.used_at = now
    db.commit()

    logger.info("Password reset for user: %s", user.email)
    return MessageResponse(message="Password updated successfully. You can now sign in.")


# ── Email verification ────────────────────────────────────────────────────────


@router.post(
    "/auth/verify-email",
    response_model=LoginResponse,
    summary="Verify email address with a token and log in",
)
@limiter.limit("10/hour")
async def verify_email(
    request: Request,
    response: Response,
    body: VerifyEmailRequest,
    db: Session = Depends(get_db),
) -> LoginResponse:
    """Verify a user's email address using a one-time token and issue JWT.

    Args:
        response: FastAPI-injected response to set auth cookie.
        body: Verification email and token.
        db: SQLAlchemy session.

    Returns:
        LoginResponse with user data.

    Raises:
        HTTPException: 400 if token is invalid, expired, or already used.
    """
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    db_token = (
        db.query(AuthToken)
        .filter(
            AuthToken.user_id == user.id,
            AuthToken.token_hash == token_hash,
            AuthToken.token_type == "verify",
        )
        .first()
    )

    now = datetime.now(timezone.utc)

    if not db_token:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link.")
    if db_token.used_at is not None:
        raise HTTPException(status_code=400, detail="This email has already been verified.")
    expires = db_token.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification code has expired. Please request a new one.",
        )

    user.is_verified = True
    user.last_login = now
    db_token.used_at = now
    db.commit()

    _set_auth_cookie(response, user)

    logger.info("Email verified and user logged in: %s", user.email)
    return LoginResponse(
        user=UserResponse.model_validate(user),
        message="Email verified successfully! You are now logged in.",
    )


@router.post(
    "/auth/resend-verification",
    response_model=MessageResponse,
    summary="Resend the email verification code",
)
@limiter.limit("2/hour")
async def resend_verification(
    request: Request,
    body: ResendVerificationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Resend the verification email to the user.

    Args:
        body: Email address of the user.
        db: SQLAlchemy session.

    Returns:
        Success message.
    """
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()

    if not settings.smtp_host:
        if user and not user.is_verified:
            user.is_verified = True
            user.last_login = datetime.now(timezone.utc)
            db.commit()
            logger.info(
                "User auto-verified from resend flow because SMTP is disabled: %s",
                user.email,
            )
        return MessageResponse(
            message=(
                "Email delivery is not configured on this deployment. "
                "If this account exists, it no longer needs email verification."
            )
        )

    if not user:
        # Don't leak existence, just say it's sent
        return MessageResponse(message="Verification email sent. Please check your inbox.")

    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email address is already verified.",
        )

    _invalidate_old_tokens(db, user.id, "verify")
    raw_token, token_hash = _make_otp()
    verify_token = AuthToken(
        user_id=user.id,
        token_hash=token_hash,
        token_type="verify",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=_VERIFY_TTL_HOURS),
    )
    db.add(verify_token)
    db.commit()

    background_tasks.add_task(send_verification_email, user.email, raw_token)

    logger.info("Verification email resent to %s", user.email)
    return MessageResponse(message="Verification email sent. Please check your inbox.")
