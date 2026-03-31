"""Business logic for letting agent reputation aggregation."""

import logging
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import cache
from app.models.letting_agent import LettingAgent
from app.models.review import Review
from app.schemas.agent import (
    AgentDetail,
    AgentReviewItem,
    AgentReviewSummary,
    AgentSearchResult,
    AgentSummary,
)

logger = logging.getLogger(__name__)

_CACHE_TTL = 600  # 10 minutes


def _compute_agent_score(
    avg_overall: float,
    avg_landlord: float,
    avg_condition: float,
    avg_value: float,
) -> float:
    """Compute 0-100 composite agent score from 1-5 ratings.

    Weights: overall×40%, landlord×30%, condition×15%, value×15%.

    Args:
        avg_overall: Average overall rating (1 to 5).
        avg_landlord: Average landlord rating (1 to 5).
        avg_condition: Average condition rating (1 to 5).
        avg_value: Average value rating (1 to 5).

    Returns:
        Composite score 0 to 100.
    """
    weighted = (
        avg_overall * 0.40
        + avg_landlord * 0.30
        + avg_condition * 0.15
        + avg_value * 0.15
    )
    return round((weighted - 1) / 4 * 100, 1)


def _slug_to_display_name(slug: str) -> str:
    """Convert a slug to a display name.

    Args:
        slug: Hyphen-separated lowercase slug (e.g. "cavenders-guildford").

    Returns:
        Title-cased display name (e.g. "Cavenders Guildford").
    """
    return slug.replace("-", " ").title()


def get_agent_list(
    sector: Optional[str],
    limit: int,
    db: Session,
) -> List[AgentSummary]:
    """Get aggregated list of agents sorted by score.

    Args:
        sector: Optional postcode sector filter.
        limit: Maximum number of agents to return.
        db: Database session.

    Returns:
        List of AgentSummary objects.
    """
    cache_key = f"agents:list:{sector or 'all'}:{limit}"
    cached = cache.get_json(cache_key)
    if cached:
        return [AgentSummary(**a) for a in cached]

    query = (
        db.query(
            Review.agent_name,
            func.count(Review.id).label("review_count"),
            func.avg(Review.overall_rating).label("avg_overall"),
            func.avg(Review.landlord_rating).label("avg_landlord"),
            func.avg(Review.condition_rating).label("avg_condition"),
            func.avg(Review.value_rating).label("avg_value"),
            func.max(Review.created_at).label("latest_review_date"),
        )
        .filter(Review.agent_name.isnot(None))
        .filter(Review.is_moderated == True)  # noqa: E712
        .filter(Review.is_flagged == False)  # noqa: E712
        .group_by(Review.agent_name)
    )

    rows = query.all()
    results = []
    for row in rows:
        agent_name = row.agent_name
        avg_overall = float(row.avg_overall)
        avg_landlord = float(row.avg_landlord)
        avg_condition = float(row.avg_condition)
        avg_value = float(row.avg_value)

        # Try to get verified profile
        profile = db.query(LettingAgent).filter(LettingAgent.name == agent_name).first()

        display_name = (
            profile.display_name if profile else _slug_to_display_name(agent_name)
        )
        is_verified = profile.is_verified if profile else False
        postcode_sectors = profile.postcode_sectors if profile else None

        score = _compute_agent_score(
            avg_overall, avg_landlord, avg_condition, avg_value
        )

        summary = AgentSummary(
            name=agent_name,
            display_name=display_name,
            is_verified=is_verified,
            postcode_sectors=postcode_sectors,
            stats=AgentReviewSummary(
                review_count=row.review_count,
                avg_overall_rating=round(avg_overall, 2),
                avg_landlord_rating=round(avg_landlord, 2),
                avg_condition_rating=round(avg_condition, 2),
                avg_value_rating=round(avg_value, 2),
                agent_score=score,
                latest_review_date=row.latest_review_date,
            ),
        )
        results.append(summary)

    # Sort by score descending
    results.sort(key=lambda a: a.stats.agent_score, reverse=True)
    results = results[:limit]

    cache.set_json(cache_key, [a.model_dump() for a in results], ttl_seconds=_CACHE_TTL)
    return results


def get_agent_detail(agent_name: str, db: Session) -> Optional[AgentDetail]:
    """Get full agent profile with recent reviews.

    Args:
        agent_name: Normalised agent slug.
        db: Database session.

    Returns:
        AgentDetail or None if no reviews found.
    """
    agent_name_lower = agent_name.lower().strip()

    reviews = (
        db.query(Review)
        .filter(func.lower(Review.agent_name) == agent_name_lower)
        .filter(Review.is_moderated == True)  # noqa: E712
        .filter(Review.is_flagged == False)  # noqa: E712
        .order_by(Review.created_at.desc())
        .limit(20)
        .all()
    )

    if not reviews:
        return None

    avg_overall = sum(r.overall_rating for r in reviews) / len(reviews)
    avg_landlord = sum(r.landlord_rating for r in reviews) / len(reviews)
    avg_condition = sum(r.condition_rating for r in reviews) / len(reviews)
    avg_value = sum(r.value_rating for r in reviews) / len(reviews)
    score = _compute_agent_score(avg_overall, avg_landlord, avg_condition, avg_value)

    profile = (
        db.query(LettingAgent).filter(LettingAgent.name == agent_name_lower).first()
    )

    display_name = (
        profile.display_name if profile else _slug_to_display_name(agent_name_lower)
    )
    is_verified = profile.is_verified if profile else False
    postcode_sectors = profile.postcode_sectors if profile else None
    website = profile.website if profile else None

    return AgentDetail(
        name=agent_name_lower,
        display_name=display_name,
        is_verified=is_verified,
        postcode_sectors=postcode_sectors,
        website=website,
        stats=AgentReviewSummary(
            review_count=len(reviews),
            avg_overall_rating=round(avg_overall, 2),
            avg_landlord_rating=round(avg_landlord, 2),
            avg_condition_rating=round(avg_condition, 2),
            avg_value_rating=round(avg_value, 2),
            agent_score=score,
            latest_review_date=reviews[0].created_at if reviews else None,
        ),
        recent_reviews=[AgentReviewItem.model_validate(r) for r in reviews],
    )


def get_agent_suggestions(q: str, db: Session) -> List[AgentSearchResult]:
    """Get autocomplete suggestions for agent names.

    Args:
        q: Search query string.
        db: Database session.

    Returns:
        List of up to 10 AgentSearchResult objects.
    """
    # Sanitise wildcards to prevent SQL injection
    safe_q = q.replace("%", r"\%").replace("_", r"\_")

    # Search review agent names (case-insensitive)
    review_rows = (
        db.query(
            Review.agent_name,
            func.count(Review.id).label("review_count"),
        )
        .filter(Review.agent_name.isnot(None))
        .filter(Review.is_moderated == True)  # noqa: E712
        .filter(Review.is_flagged == False)  # noqa: E712
        .filter(Review.agent_name.ilike(f"%{safe_q}%", escape="\\"))
        .group_by(Review.agent_name)
        .all()
    )

    # Search verified profiles
    profile_rows = (
        db.query(LettingAgent)
        .filter(LettingAgent.display_name.ilike(f"%{safe_q}%", escape="\\"))
        .all()
    )

    # Merge by slug, dedup
    results: dict[str, AgentSearchResult] = {}

    for row in review_rows:
        name = row.agent_name
        results[name] = AgentSearchResult(
            name=name,
            display_name=_slug_to_display_name(name),
            review_count=row.review_count,
        )

    for profile in profile_rows:
        existing = results.get(profile.name)
        if existing:
            # Update display name to verified one
            results[profile.name] = AgentSearchResult(
                name=profile.name,
                display_name=profile.display_name,
                review_count=existing.review_count,
            )
        else:
            results[profile.name] = AgentSearchResult(
                name=profile.name,
                display_name=profile.display_name,
                review_count=0,
            )

    sorted_results = sorted(
        results.values(), key=lambda r: r.review_count, reverse=True
    )
    return sorted_results[:10]
