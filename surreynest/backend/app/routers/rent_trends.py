"""Rent trends endpoint for the RentRadar chart.

GET /api/rent-trends/{postcode_sector}

Returns yearly median implied rents (historical) plus a 2-year forecast
based on IPHRP growth. Used by the RentRadarChart component on
PropertyDetail pages.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.rent_history import RentHistory
from app.models.pipeline_config import PipelineConfig
from app.rate_limit import limiter

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Fallback IPHRP growth if pipeline_config unavailable ─────────────────────
DEFAULT_IPHRP_GROWTH = 6.0


# ── Response schemas ─────────────────────────────────────────────────────────


class YearlyRent(BaseModel):
    year: int
    median_weekly_rent: float
    transaction_count: Optional[int] = None


class RentTrendResponse(BaseModel):
    postcode_sector: str
    historical: List[YearlyRent]
    forecast: List[YearlyRent]
    iphrp_growth_pct: float
    total_change_pct: Optional[float] = None
    total_transactions: int = 0


# ── Helpers ──────────────────────────────────────────────────────────────────


def _extract_sector(postcode: str) -> str:
    """Extract postcode sector from a full or partial postcode."""
    if not postcode:
        return ""
    normalised = postcode.strip().upper()
    parts = normalised.split()
    if len(parts) == 2 and len(parts[1]) >= 1:
        return f"{parts[0]} {parts[1][0]}"
    return normalised


def _get_iphrp_growth(db: Session) -> float:
    """Get latest IPHRP growth % from pipeline_config or fallback."""
    row = (
        db.query(PipelineConfig)
        .filter(PipelineConfig.key == "iphrp_growth_pct")
        .first()
    )
    if row and row.value:
        try:
            return float(row.value)
        except (ValueError, TypeError):
            pass
    return DEFAULT_IPHRP_GROWTH


# ── Endpoint ─────────────────────────────────────────────────────────────────


@router.get(
    "/rent-trends/{postcode_sector}",
    response_model=RentTrendResponse,
    summary="Historical rent trends + forecast for a postcode sector",
)
@limiter.limit("60/minute")
async def get_rent_trends(
    request: Request,
    postcode_sector: str,
    db: Session = Depends(get_db),
) -> RentTrendResponse:
    """Return yearly median implied rent for a postcode sector.

    Historical data comes from the rent_history table (populated by the
    Land Registry pipeline). Forecast uses IPHRP South East growth rate.
    """
    sector = _extract_sector(postcode_sector)

    if not sector:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid postcode sector",
        )

    # Query historical data
    rows = (
        db.query(RentHistory)
        .filter(RentHistory.postcode_sector == sector)
        .order_by(RentHistory.year)
        .all()
    )

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No rent history data for sector {sector}",
        )

    historical = [
        YearlyRent(
            year=r.year,
            median_weekly_rent=round(r.implied_weekly_rent, 1),
            transaction_count=r.transaction_count,
        )
        for r in rows
    ]

    total_transactions = sum(r.transaction_count for r in rows)

    # Compute total change %
    first_rent = historical[0].median_weekly_rent
    last_rent = historical[-1].median_weekly_rent
    total_change = None
    if first_rent > 0:
        total_change = round(((last_rent - first_rent) / first_rent) * 100, 1)

    # Generate 2-year forecast
    iphrp_growth = _get_iphrp_growth(db)
    last_year = historical[-1].year
    forecast_rent = last_rent
    forecast = []

    for i in range(1, 3):  # 2 years ahead
        forecast_rent = round(forecast_rent * (1 + iphrp_growth / 100), 1)
        forecast.append(
            YearlyRent(
                year=last_year + i,
                median_weekly_rent=forecast_rent,
            )
        )

    return RentTrendResponse(
        postcode_sector=sector,
        historical=historical,
        forecast=forecast,
        iphrp_growth_pct=iphrp_growth,
        total_change_pct=total_change,
        total_transactions=total_transactions,
    )
