"""Letting agent reputation endpoints.

IMPORTANT: /agents/suggest MUST be declared before /agents/{agent_name}
to prevent FastAPI treating 'suggest' as an agent_name path param.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.rate_limit import limiter
from app.schemas.agent import AgentDetail, AgentSearchResult, AgentSummary
from app.services.agent_service import (
    get_agent_detail,
    get_agent_list,
    get_agent_suggestions,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/agents",
    response_model=list[AgentSummary],
    summary="List letting agents sorted by score",
)
@limiter.limit("30/minute")
async def list_agents(
    request: Request,
    sector: str = Query(default=None, description="Filter by postcode sector"),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[AgentSummary]:
    """Get list of agents with aggregated review scores.

    Public endpoint. Sorted by composite score descending.
    """
    return get_agent_list(sector=sector, limit=limit, db=db)


@router.get(
    "/agents/suggest",
    response_model=list[AgentSearchResult],
    summary="Autocomplete agent name suggestions",
)
@limiter.limit("60/minute")
async def suggest_agents(
    request: Request,
    q: str = Query(min_length=1, max_length=100),
    db: Session = Depends(get_db),
) -> list[AgentSearchResult]:
    """Get agent name suggestions for autocomplete.

    Public endpoint. Returns up to 10 matches.
    NOTE: This route must be declared BEFORE /agents/{agent_name}.
    """
    return get_agent_suggestions(q=q, db=db)


@router.get(
    "/agents/{agent_name}",
    response_model=AgentDetail,
    summary="Get full agent profile",
)
@limiter.limit("30/minute")
async def get_agent(
    request: Request,
    agent_name: str,
    db: Session = Depends(get_db),
) -> AgentDetail:
    """Get full agent profile with recent reviews.

    Public endpoint. Returns 404 if no reviews exist for this agent.
    """
    detail = get_agent_detail(agent_name=agent_name, db=db)
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent '{agent_name}' not found",
        )
    return detail
