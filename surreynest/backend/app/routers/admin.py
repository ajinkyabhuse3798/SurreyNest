"""Admin dashboard routes: stats, user management, subscription analytics.

All endpoints require admin role via the `require_admin` dependency.
"""

import logging
import math
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.property import Property
from app.models.review import Review
from app.models.user import User
from app.schemas.admin_schemas import (
    AdminUserListResponse,
    AdminUserRow,
    OverviewStats,
    ProUserRow,
    SignupChartResponse,
    SignupDataPoint,
    SubscriptionListResponse,
    SubscriptionStats,
    UserUpdateRequest,
)
from app.services.auth_service import require_admin

logger = logging.getLogger(__name__)

router = APIRouter()

MONTHLY_PRO_PRICE = 5.99  # £/month — keep in sync with frontend Pricing.jsx


# ── Overview Stats ────────────────────────────────────────────────────────────


@router.get(
    "/admin/stats/overview",
    response_model=OverviewStats,
    summary="Dashboard KPIs (admin)",
)
async def get_overview_stats(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
) -> OverviewStats:
    """Return high-level KPIs for the admin dashboard."""
    total_users = db.query(func.count(User.id)).scalar() or 0
    pro_users = (
        db.query(func.count(User.id)).filter(User.is_pro == True).scalar() or 0  # noqa: E712
    )
    total_properties = db.query(func.count(Property.uprn)).scalar() or 0
    reviews_pending = (
        db.query(func.count(Review.id))
        .filter(Review.is_moderated == False, Review.is_flagged == False)  # noqa: E712
        .scalar()
        or 0
    )
    reviews_approved = (
        db.query(func.count(Review.id))
        .filter(Review.is_moderated == True, Review.is_flagged == False)  # noqa: E712
        .scalar()
        or 0
    )
    reviews_flagged = (
        db.query(func.count(Review.id))
        .filter(Review.is_flagged == True)  # noqa: E712
        .scalar()
        or 0
    )

    return OverviewStats(
        total_users=total_users,
        pro_users=pro_users,
        total_properties=total_properties,
        reviews_pending=reviews_pending,
        reviews_approved=reviews_approved,
        reviews_flagged=reviews_flagged,
    )


# ── Signup Trends ─────────────────────────────────────────────────────────────


@router.get(
    "/admin/stats/signups",
    response_model=SignupChartResponse,
    summary="Daily signup chart data (admin)",
)
async def get_signup_trends(
    days: int = Query(default=30, ge=7, le=365),
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
) -> SignupChartResponse:
    """Return daily signup counts for the last N days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    rows = (
        db.query(
            cast(User.created_at, Date).label("signup_date"),
            func.count(User.id).label("cnt"),
        )
        .filter(User.created_at >= cutoff)
        .group_by(cast(User.created_at, Date))
        .order_by(cast(User.created_at, Date))
        .all()
    )

    # Build a full date range (fill gaps with 0)
    date_map = {str(r.signup_date): r.cnt for r in rows}
    data = []
    total = 0
    for i in range(days):
        d = (cutoff + timedelta(days=i + 1)).date()
        count = date_map.get(str(d), 0)
        total += count
        data.append(SignupDataPoint(date=str(d), count=count))

    return SignupChartResponse(data=data, total_period=total)


# ── Subscription Analytics ───────────────────────────────────────────────────


@router.get(
    "/admin/stats/subscriptions",
    response_model=SubscriptionStats,
    summary="Pro subscription analytics (admin)",
)
async def get_subscription_stats(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
) -> SubscriptionStats:
    """Return Pro subscription analytics."""
    now = datetime.now(timezone.utc)

    active_pro = (
        db.query(func.count(User.id)).filter(User.is_pro == True).scalar() or 0  # noqa: E712
    )
    expiring_soon = (
        db.query(func.count(User.id))
        .filter(
            User.is_pro == True,  # noqa: E712
            User.pro_expires_at != None,  # noqa: E711
            User.pro_expires_at <= now + timedelta(days=7),
        )
        .scalar()
        or 0
    )
    # Users who became pro in the last 30 days —
    # we approximate by checking pro_expires_at > now and created_at or last_login recent
    recent_conversions = (
        db.query(func.count(User.id))
        .filter(
            User.is_pro == True,  # noqa: E712
            User.last_login >= now - timedelta(days=30),
        )
        .scalar()
        or 0
    )

    return SubscriptionStats(
        active_pro=active_pro,
        expiring_soon=expiring_soon,
        total_revenue_monthly=round(active_pro * MONTHLY_PRO_PRICE, 2),
        recent_conversions=recent_conversions,
    )


@router.get(
    "/admin/subscriptions",
    response_model=SubscriptionListResponse,
    summary="List Pro subscribers (admin)",
)
async def list_subscribers(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
) -> SubscriptionListResponse:
    """Return paginated list of Pro subscribers."""
    query = db.query(User).filter(User.is_pro == True)  # noqa: E712
    total = query.count()
    offset = (page - 1) * per_page
    users = query.order_by(User.created_at.desc()).offset(offset).limit(per_page).all()

    return SubscriptionListResponse(
        subscribers=[ProUserRow.model_validate(u) for u in users],
        total=total,
        page=page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


# ── User Management ──────────────────────────────────────────────────────────


@router.get(
    "/admin/users",
    response_model=AdminUserListResponse,
    summary="List all users (admin)",
)
async def list_users(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None, description="Search by email"),
    role: Optional[str] = Query(default=None, description="Filter by role"),
    is_pro: Optional[bool] = Query(default=None, description="Filter by pro status"),
    sort_by: str = Query(default="created_at", description="Sort field"),
    sort_order: str = Query(default="desc", description="asc or desc"),
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
) -> AdminUserListResponse:
    """Return paginated, searchable, filterable user list."""
    query = db.query(User)

    # Filters
    if search:
        query = query.filter(User.email.ilike(f"%{search}%"))
    if role:
        query = query.filter(User.role == role)
    if is_pro is not None:
        query = query.filter(User.is_pro == is_pro)

    total = query.count()

    # Sorting
    sort_col = getattr(User, sort_by, User.created_at)
    if sort_order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    offset = (page - 1) * per_page
    users = query.offset(offset).limit(per_page).all()

    return AdminUserListResponse(
        users=[AdminUserRow.model_validate(u) for u in users],
        total=total,
        page=page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.patch(
    "/admin/users/{user_id}",
    response_model=AdminUserRow,
    summary="Update a user (admin)",
)
async def update_user(
    user_id: uuid.UUID,
    update: UserUpdateRequest,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
) -> AdminUserRow:
    """Update a user's role, pro status, or pro expiry.

    Only the fields provided in the request body are updated.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found",
        )

    valid_roles = {"student", "landlord", "admin"}
    if update.role is not None:
        if update.role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role. Must be one of: {valid_roles}",
            )
        user.role = update.role

    if update.is_pro is not None:
        user.is_pro = update.is_pro

    if update.pro_expires_at is not None:
        user.pro_expires_at = update.pro_expires_at

    db.commit()
    db.refresh(user)

    logger.info("Admin updated user %s: role=%s, is_pro=%s", user_id, user.role, user.is_pro)
    return AdminUserRow.model_validate(user)
