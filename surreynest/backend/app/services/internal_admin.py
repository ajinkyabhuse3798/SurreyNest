"""Internal-only access checks for operational endpoints."""

import secrets

from fastapi import Header, HTTPException, status

from app.config import settings


def require_internal_admin_key(
    x_internal_admin_key: str | None = Header(
        default=None, alias="X-Internal-Admin-Key"
    ),
) -> None:
    """Require the configured internal admin key for ops-only routes."""
    expected = getattr(settings, "internal_admin_key", "")

    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Internal admin key is not configured",
        )

    if not x_internal_admin_key or not secrets.compare_digest(
        x_internal_admin_key, expected
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal admin key",
        )
