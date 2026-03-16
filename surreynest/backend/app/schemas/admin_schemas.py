"""Pydantic schemas for admin dashboard endpoints."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


# ── Overview Stats ────────────────────────────────────────────────────────────


class OverviewStats(BaseModel):
    """High-level KPIs for the admin dashboard."""

    total_users: int
    pro_users: int
    total_properties: int
    reviews_pending: int
    reviews_approved: int
    reviews_flagged: int


# ── Signup chart data ─────────────────────────────────────────────────────────


class SignupDataPoint(BaseModel):
    """Single day's signup count for the trend chart."""

    date: str  # ISO date string e.g. "2026-03-15"
    count: int


class SignupChartResponse(BaseModel):
    """Response for the signup trend chart endpoint."""

    data: list[SignupDataPoint]
    total_period: int  # Total signups in the period


# ── Subscription analytics ───────────────────────────────────────────────────


class SubscriptionStats(BaseModel):
    """Pro subscription analytics."""

    active_pro: int
    expiring_soon: int  # expiring within 7 days
    total_revenue_monthly: float  # active_pro × monthly price
    recent_conversions: int  # became pro in last 30 days


class ProUserRow(BaseModel):
    """Single subscriber in the subscriber list."""

    id: uuid.UUID
    email: str
    is_pro: bool
    pro_expires_at: Optional[datetime] = None
    created_at: datetime
    last_login: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SubscriptionListResponse(BaseModel):
    """Response for the pro subscribers list."""

    subscribers: list[ProUserRow]
    total: int
    page: int
    pages: int


# ── User management ──────────────────────────────────────────────────────────


class AdminUserRow(BaseModel):
    """Single user row in the admin user table."""

    id: uuid.UUID
    email: str
    role: str
    is_pro: bool
    is_verified: bool
    pro_expires_at: Optional[datetime] = None
    created_at: datetime
    last_login: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AdminUserListResponse(BaseModel):
    """Paginated user list for admin."""

    users: list[AdminUserRow]
    total: int
    page: int
    pages: int


class UserUpdateRequest(BaseModel):
    """Request body for updating a user (admin action)."""

    role: Optional[str] = None
    is_pro: Optional[bool] = None
    pro_expires_at: Optional[datetime] = None
