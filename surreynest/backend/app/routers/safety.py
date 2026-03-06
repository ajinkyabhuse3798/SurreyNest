"""Safety intelligence routes: comprehensive crime analytics for students.

Provides detailed crime analysis beyond basic safety scores:
- /safety/intelligence/{postcode} — full analysis for a sector
- /safety/rankings — safest and hotspot areas across Guildford
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.geocoding_service import _normalise_postcode
from app.services import safety_intelligence as si

logger = logging.getLogger(__name__)

router = APIRouter()


def _extract_sector(postcode: str) -> str:
    """Extract postcode sector from full postcode."""
    normalised = _normalise_postcode(postcode)
    parts = normalised.strip().split()
    if len(parts) == 2 and len(parts[1]) >= 1:
        return parts[0] + " " + parts[1][0]
    return normalised


@router.get(
    "/safety/intelligence",
    summary="Full safety intelligence for a postcode",
)
async def get_safety_intelligence(
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
async def get_safety_rankings(
    db: Session = Depends(get_db),
):
    """Get area rankings: top 5 safest and top 5 hotspot areas."""
    return si.get_area_rankings(db)
