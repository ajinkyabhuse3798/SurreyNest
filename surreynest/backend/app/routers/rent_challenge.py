"""Rent increase challenge endpoint.

POST /api/rent/challenge-increase, analyses a proposed rent increase
and returns a verdict with tribunal brief.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.rate_limit import limiter
from app.schemas.rent_challenge import RentChallengeRequest, RentChallengeResponse
from app.services.rent_challenge_service import analyse_rent_increase

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/rent/challenge-increase",
    response_model=RentChallengeResponse,
    summary="Analyse a proposed rent increase against market data",
)
@limiter.limit("10/minute")
async def challenge_rent_increase(
    request: Request,
    challenge_request: RentChallengeRequest,
    db: Session = Depends(get_db),
) -> RentChallengeResponse:
    """Analyse a Section 13 rent increase notice.

    No authentication required. Returns verdict, comparables, and
    a plain-text tribunal brief ready to submit.
    """
    try:
        return analyse_rent_increase(request=challenge_request, db=db)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
