"""AI tenancy agreement checker endpoint.

POST /api/contract/check — uses Claude AI to analyse tenancy agreements.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.rate_limit import limiter
from app.schemas.contract import ContractCheckRequest, ContractCheckResponse
from app.services.contract_service import check_contract

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/contract/check",
    response_model=ContractCheckResponse,
    summary="Analyse a tenancy agreement for problematic clauses",
)
@limiter.limit("5/hour")
async def check_tenancy_contract(
    request: Request,
    contract_request: ContractCheckRequest,
    db: Session = Depends(get_db),
) -> ContractCheckResponse:
    """Analyse a tenancy agreement using AI.

    No authentication required. Rate limited to 5 per hour per IP.
    Returns structured clause analysis with risk levels.
    """
    try:
        return await check_contract(request=contract_request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
