"""Property routes: GET /properties, GET /properties/{uprn}.

Thin route layer — delegates to property_service for all business logic.
"""

import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.schemas.property import PropertyDetail, PropertySearchResponse
from app.services import property_service

logger = logging.getLogger(__name__)

router = APIRouter()

# Rate limiter (uses the app-level limiter from main.py)
limiter = Limiter(key_func=get_remote_address)

# UK postcode regex — allows optional space between outward and inward parts
POSTCODE_RE = re.compile(
    r"^[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}$", re.IGNORECASE
)
ALLOWED_RADII = {250, 500, 1000, 2000}


@router.get(
    "/properties",
    response_model=PropertySearchResponse,
    summary="Search properties near a postcode",
)
@limiter.limit(f"{settings.rate_limit_search}/minute")
async def search_properties(
    request: Request,
    postcode: str = Query(..., description="Postcode to search near", examples=["GU2 7XH"]),
    radius: int = Query(default=1000, ge=100, le=5000, description="Search radius in metres"),
    page: int = Query(default=1, ge=1, description="Page number"),
    per_page: int = Query(default=20, ge=1, le=50, description="Results per page"),
    db: Session = Depends(get_db),
) -> PropertySearchResponse:
    """Search for properties within a radius of the given postcode.

    Uses PostGIS ST_DWithin for efficient spatial queries.
    Results are ordered by distance from the search postcode.
    """
    # ── Validate postcode format ──────────────────────────────────────────
    normalised_postcode = postcode.strip().upper()
    if not POSTCODE_RE.match(normalised_postcode):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UK postcode format",
        )

    # ── Validate radius ───────────────────────────────────────────────────
    if radius not in ALLOWED_RADII:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Radius must be one of {sorted(ALLOWED_RADII)}",
        )

    try:
        result = property_service.search_properties(
            postcode=normalised_postcode,
            radius_m=radius,
            page=page,
            per_page=per_page,
            db=db,
        )
        return PropertySearchResponse(**result)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.get(
    "/properties/{uprn}",
    response_model=PropertyDetail,
    summary="Get full property detail",
)
async def get_property(
    uprn: str,
    db: Session = Depends(get_db),
) -> PropertyDetail:
    """Get detailed property information by UPRN.

    Includes HMO status, review summary, safety score, and rent prediction.
    """
    result = property_service.get_property_detail(uprn, db)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Property with UPRN {uprn} not found",
        )
    return PropertyDetail(**result)
