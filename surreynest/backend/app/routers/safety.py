"""Safety intelligence routes: comprehensive crime analytics for students.

Provides detailed crime analysis beyond basic safety scores:
- /safety/guildford-overview, citywide Guildford overview and methodology
- /safety/intelligence/{postcode}, full analysis for a sector
- /safety/rankings, safest and hotspot areas across Guildford
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.rate_limit import limiter
from app.services import safety_intelligence as si
from app.services import score_service
from app.utils.postcode import extract_postcode_sector

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/safety/guildford-overview",
    summary="Guildford-wide safety overview",
)
@limiter.limit("30/minute")
async def get_guildford_safety_overview(
    request: Request,
    db: Session = Depends(get_db),
):
    """Get Guildford-wide safety data before drilling into a postcode."""
    return si.get_guildford_overview(db)


@router.get(
    "/safety/intelligence",
    summary="Full safety intelligence for a postcode",
)
@limiter.limit("60/minute")
async def get_safety_intelligence(
    request: Request,
    postcode: str = Query(..., description="Postcode to analyse", examples=["GU2 7XH"]),
    db: Session = Depends(get_db),
):
    """Get comprehensive safety intelligence for a postcode sector.

    Returns crime breakdown, trend, comparison, holiday risk,
    student vulnerability index, and contextual tips.
    """
    sector = extract_postcode_sector(postcode)
    result = si.get_full_safety_intelligence(sector, db)

    if not result["crime_breakdown"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No crime data available for sector {sector}",
        )

    return result


@router.get(
    "/safety/rankings",
    summary="Safest and hotspot areas in Guildford",
)
@limiter.limit("30/minute")
async def get_safety_rankings(
    request: Request,
    db: Session = Depends(get_db),
):
    """Get area rankings: top 5 safest and top 5 hotspot areas."""
    return si.get_area_rankings(db)

@router.get(
    "/safety/map",
    response_model=dict,
    summary="Get safety map summary data",
)
async def get_safety_map(
    postcode: str = Query(..., description="Postcode (e.g. GU2 7)"),
    db: Session = Depends(get_db),
) -> dict:
    """Return honest map-side summary data for a postcode sector.

    SurreyNest stores aggregated sector/month/category counts from police.uk,
    not every raw incident coordinate. This endpoint therefore returns the
    summary data needed for a map sidebar or drill-down panel instead of
    pretending to expose incident-level pins that do not exist in the DB.
    """
    sector = extract_postcode_sector(postcode)
    intelligence = si.get_full_safety_intelligence(sector, db)
    score = score_service.get_safety_score(sector, db)

    if not intelligence["crime_breakdown"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No crime data available for sector {sector}",
        )

    return {
        "postcode_sector": sector,
        "available": True,
        "safety_score": score.get("safety_score") if score else None,
        "total_tracked_crimes": intelligence["compared_to_average"]["sector_total"],
        "crime_breakdown": intelligence["crime_breakdown"],
        "crime_trend": intelligence["crime_trend"],
        "methodology": intelligence["methodology"],
        "note": (
            "SurreyNest stores aggregated sector data for comparison, not raw incident "
            "coordinates. Use this endpoint for map-side summaries, not incident pins."
        ),
    }
