"""Auth routes: POST /auth/register, POST /auth/login.

Thin route layer — delegates to auth_service for hashing and JWT creation.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import Token
from app.schemas.user import UserCreate, UserResponse
from app.services.auth_service import (
    create_access_token,
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
        created_at=datetime.utcnow(),
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
    user.last_login = datetime.utcnow()
    db.commit()

    token = create_access_token(user.id, user.role)
    logger.info("User logged in: %s", user.email)

    return Token(access_token=token)
