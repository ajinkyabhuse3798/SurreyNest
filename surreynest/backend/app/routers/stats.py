"""Public platform statistics endpoint.

Returns real counts from the database for display on the homepage.
Cached in Redis for 10 minutes to avoid repeated full-table scans.
"""

import logging

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.cache import get_json, set_json
from app.database import get_db
from app.models.hmo_record import HmoRecord
from app.models.property import Property
from app.models.review import Review
from app.models.user import User
from app.rate_limit import limiter

logger = logging.getLogger(__name__)

router = APIRouter()

_CACHE_KEY = "public:stats"
_CACHE_TTL = 600  # 10 minutes


class PublicStats(BaseModel):
    """Real platform statistics for the homepage trust bar.

    Attributes:
        properties_indexed: Total properties in the EPC database.
        hmo_licensed: Active licensed HMOs on the GBC register.
        districts_covered: Number of distinct GU postcode districts.
        data_sources: Number of official UK data sources used.
        reviews_published: Total approved tenant reviews.
        registered_users: Total registered accounts.
    """

    properties_indexed: int
    hmo_licensed: int
    districts_covered: int
    data_sources: int
    reviews_published: int
    registered_users: int


@router.get(
    "/stats",
    response_model=PublicStats,
    summary="Public platform statistics",
)
@limiter.limit("60/minute")
async def get_public_stats(
    request: Request,
    db: Session = Depends(get_db),
) -> PublicStats:
    """Return real platform statistics for homepage display.

    Results are cached for 10 minutes. Falls back to DB query on cache miss.

    Args:
        db: SQLAlchemy session.

    Returns:
        PublicStats with live counts from the database.
    """
    cached = get_json(_CACHE_KEY)
    if cached:
        return PublicStats(**cached)

    properties = db.query(func.count(Property.uprn)).scalar() or 0

    hmo_licensed = (
        db.query(func.count(HmoRecord.id))
        .filter(HmoRecord.is_active == True)  # noqa: E712
        .scalar()
        or 0
    )

    # Count distinct GU postcode districts (GU1, GU2 … GU7)
    district_result = db.execute(
        text("SELECT COUNT(DISTINCT SPLIT_PART(postcode, ' ', 1)) FROM properties")
    ).scalar()
    districts = int(district_result or 0)

    reviews = (
        db.query(func.count(Review.id))
        .filter(Review.is_moderated == True)  # noqa: E712
        .scalar()
        or 0
    )

    users = db.query(func.count(User.id)).scalar() or 0

    stats = PublicStats(
        properties_indexed=properties,
        hmo_licensed=hmo_licensed,
        districts_covered=districts,
        data_sources=4,  # police.uk, EPC register, Land Registry, GBC HMO — always 4
        reviews_published=reviews,
        registered_users=users,
    )

    set_json(_CACHE_KEY, stats.model_dump(), ttl_seconds=_CACHE_TTL)
    logger.info("Public stats refreshed: %s", stats.model_dump())
    return stats
