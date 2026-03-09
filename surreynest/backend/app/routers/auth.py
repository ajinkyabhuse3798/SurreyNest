"""Auth routes: register, login, logout, get profile, delete account.

Thin route layer — delegates to auth_service for hashing and JWT creation.
JWT is set as an httpOnly cookie (not localStorage) to prevent XSS theft.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.review import Review
from app.models.user import User
from app.schemas.auth import LoginResponse
from app.schemas.user import UserCreate, UserResponse
from app.services.auth_service import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/auth/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db),
) -> UserResponse:
    """Create a new user account.

    Args:
        user_data: Email and password validated by Pydantic schema.
        db: SQLAlchemy session.

    Returns:
        Created user details (never includes password).

    Raises:
        HTTPException: 400 if email already registered.
    """
    # Normalise email — login already does .lower(), registration must match
    user_data.email = user_data.email.strip().lower()

    # Check for existing user
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
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

    logger.info("User registered: %s", user.email)
    return UserResponse.model_validate(user)


@router.post(
    "/auth/login",
    response_model=LoginResponse,
    summary="Login and get auth cookie",
)
async def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> LoginResponse:
    """Authenticate user and set a JWT httpOnly cookie.

    Uses OAuth2 password flow (username field = email).
    JWT is set as an httpOnly cookie ONLY — never exposed in the response body.
    Returns user info (id, email, role) for the frontend to display.

    Args:
        response: FastAPI-injected response — used to set the auth cookie.
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

    # Update last_login
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    token = create_access_token(user.id, user.role)
    logger.info("User logged in: %s", user.email)

    # Set JWT as httpOnly cookie (XSS-safe) — the ONLY place the token lives.
    # JavaScript cannot read this cookie.
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,                    # JavaScript cannot read this
        secure=settings.environment == "production",  # HTTPS only in prod
        samesite="lax",                   # CSRF protection
        max_age=settings.access_token_expire_days * 86400,
        path="/",
    )

    # Return user info (NOT the token) — frontend uses this for display
    return LoginResponse(
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/auth/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Logout — clear auth cookie",
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
