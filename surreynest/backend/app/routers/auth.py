"""Auth routes: register, login, logout, get profile, delete account.

Thin route layer — delegates to auth_service for hashing and JWT creation.
JWT is set as an httpOnly cookie (not localStorage) to prevent XSS theft.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.review import Review
from app.models.user import User
from app.schemas.auth import Token
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
    response_model=Token,
    summary="Login and get JWT token",
)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    """Authenticate user and return a JWT access token.

    Uses OAuth2 password flow (username field = email).

    Args:
        form_data: OAuth2 form with username (email) and password.
        db: SQLAlchemy session.

    Returns:
        JWT token.

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

    # Set JWT as httpOnly cookie (XSS-safe) AND return in body for backward compat
    from app.config import settings
    response = Response()
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,                    # JavaScript cannot read this
        secure=settings.environment == "production",  # HTTPS only in prod
        samesite="lax",                   # CSRF protection
        max_age=settings.access_token_expire_days * 86400,
        path="/",
    )
    # Return JSON body too so frontend can decode user info from the token
    import json
    response.status_code = 200
    response.headers["content-type"] = "application/json"
    response.body = json.dumps({"access_token": token, "token_type": "bearer"}).encode()
    return response


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
