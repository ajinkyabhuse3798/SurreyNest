"""Score routes: GET /scores/safety, GET /scores/rent-fairness.

Thin route layer, delegates to score_service for all computation.
"""

import logging

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.rate_limit import limiter
from app.schemas.score import RentFairnessResponse, SafetyScoreResponse
from app.services import score_service
from app.services.geocoding_service import _normalise_postcode
from app.utils.postcode import extract_postcode_sector

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/scores/safety",
    response_model=SafetyScoreResponse,
    summary="Get safety score for a postcode",
)
@limiter.limit("60/minute")
async def get_safety_score(
    request: Request,
    postcode: str = Query(..., description="Postcode to check", examples=["GU2 7XH"]),
    db: Session = Depends(get_db),
) -> SafetyScoreResponse:
    """Get safety score for the postcode sector.

    Returns a 0-100 score (higher = safer) with crime category breakdown.
    """
    sector = extract_postcode_sector(_normalise_postcode(postcode))
    result = score_service.get_safety_score(sector, db)

    if not result or not result.get("available"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No crime data available for postcode sector {sector}",
        )

    return SafetyScoreResponse(**result)


@router.get(
    "/scores/rent-fairness",
    response_model=RentFairnessResponse,
    summary="Get rent fairness score",
)
@limiter.limit("60/minute")
async def get_rent_fairness(
    request: Request,
    uprn: str = Query(..., description="Property UPRN"),
    weekly_rent: float = Query(..., gt=0, description="Weekly rent in £"),
    bedrooms: Optional[int] = Query(
        None, description="Override the AI bedroom estimate"
    ),
    db: Session = Depends(get_db),
) -> RentFairnessResponse:
    """Compare asking rent against model prediction for a property.

    Returns a 0-100 fairness score with detailed comparison.
    """
    prediction = score_service.get_rent_prediction(uprn, db, bedrooms_override=bedrooms)

    if not prediction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Could not generate rent prediction for UPRN {uprn}",
        )

    result = score_service.compute_fairness_score(
        actual_rent=weekly_rent,
        predicted_rent=prediction["predicted_weekly_rent"],
    )

    return RentFairnessResponse(**result)
