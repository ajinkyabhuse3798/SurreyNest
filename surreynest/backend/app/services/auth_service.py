"""Authentication service: password hashing, JWT creation and verification.

Uses passlib for bcrypt hashing and python-jose for JWT tokens.
All auth config values come from app.config.settings.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.auth import TokenData

logger = logging.getLogger(__name__)

# ── Password hashing ─────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── OAuth2 scheme for JWT bearer tokens ──────────────────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(plain: str) -> str:
    """Hash a plain text password using bcrypt.

    Args:
        plain: Plain text password.

    Returns:
        bcrypt hash string.
    """
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain text password against a bcrypt hash.

    Args:
        plain: Plain text password.
        hashed: bcrypt hash from database.

    Returns:
        True if password matches, False otherwise.
    """
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: uuid.UUID, role: str) -> str:
    """Create a JWT access token.

    Args:
        user_id: User UUID to encode as subject.
        role: User role to include in payload.

    Returns:
        Encoded JWT string.
    """
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=settings.access_token_expire_days),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def get_current_user(
    request: Request = None,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency: decode JWT and return the authenticated user.

    Reads the JWT from the httpOnly cookie first (browser requests),
    then falls back to the Authorization Bearer header (API clients/tests).

    Args:
        request: The incoming request (for cookie access).
        token: JWT bearer token from Authorization header (optional fallback).
        db: SQLAlchemy session.

    Returns:
        User ORM object.

    Raises:
        HTTPException: 401 if token is invalid or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Prefer httpOnly cookie over Authorization header
    jwt_token = None
    if request and request.cookies.get("access_token"):
        jwt_token = request.cookies["access_token"]
    elif token:
        jwt_token = token

    if not jwt_token:
        raise credentials_exception

    try:
        payload = jwt.decode(
            jwt_token, settings.secret_key, algorithms=[settings.algorithm]
        )
        user_id: Optional[str] = payload.get("sub")
        role: Optional[str] = payload.get("role")

        if user_id is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if user is None:
        raise credentials_exception

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """FastAPI dependency: require the current user to have admin role.

    Args:
        current_user: Authenticated user from get_current_user.

    Returns:
        User ORM object if admin.

    Raises:
        HTTPException: 403 if user is not an admin.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
