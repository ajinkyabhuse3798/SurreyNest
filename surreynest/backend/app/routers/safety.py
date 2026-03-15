"""Safety intelligence routes: comprehensive crime analytics for students.

Provides detailed crime analysis beyond basic safety scores:
- /safety/intelligence/{postcode} — full analysis for a sector
- /safety/rankings — safest and hotspot areas across Guildford
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.rate_limit import limiter
from app.services import safety_intelligence as si

logger = logging.getLogger(__name__)

router = APIRouter()


def _extract_sector(postcode: str) -> str:
    """Extract postcode sector from full postcode.

    Accepts both full postcodes ('GU2 7XH') and sectors ('GU2 7').
    Uses simple whitespace normalisation — NOT _normalise_postcode(),
    which corrupts short sector strings (B1 lesson: never route sector
    strings through full-postcode normalisation).
    """
    import re
    pc = str(postcode).strip().upper()
    pc = re.sub(r"\s+", " ", pc)  # collapse multiple spaces to one
    parts = pc.split()
    if len(parts) == 2 and len(parts[1]) >= 1:
        return parts[0] + " " + parts[1][0]
    return pc


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
    sector = _extract_sector(postcode)
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
