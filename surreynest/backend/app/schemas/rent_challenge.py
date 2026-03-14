"""Pydantic schemas for the rent increase challenger."""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator


class RentChallengeRequest(BaseModel):
    """Request body for analysing a rent increase.

    Either uprn or postcode must be provided.
    """

    uprn: Optional[str] = None
    postcode: Optional[str] = None
    current_weekly_rent: float = Field(gt=0)
    proposed_weekly_rent: float = Field(gt=0)
    property_type: Optional[str] = None
    bedrooms: Optional[int] = Field(default=None, ge=0, le=15)

    @model_validator(mode="after")
    def require_uprn_or_postcode(self) -> "RentChallengeRequest":
        """Ensure at least one of uprn or postcode is provided."""
        if not self.uprn and not self.postcode:
            raise ValueError("Either 'uprn' or 'postcode' must be provided.")
        return self


class ComparableProperty(BaseModel):
    """A comparable property for rent evidence."""

    postcode: str
    implied_weekly_rent: float
    source: str
    bedrooms: Optional[int] = None
    distance_label: str


class RentChallengeResponse(BaseModel):
    """Full analysis response for a rent increase challenge."""

    ml_predicted_rent: float
    sector_median_rent: Optional[float] = None
    current_weekly_rent: float
    proposed_weekly_rent: float
    increase_amount: float
    increase_pct: float
    comparables: List[ComparableProperty]
    is_above_market: bool
    market_excess_pct: float
    verdict: Literal["FAIR", "BORDERLINE", "ABOVE_MARKET", "SIGNIFICANTLY_ABOVE_MARKET"]
    verdict_detail: str
    challenge_strength: Literal["STRONG", "MODERATE", "WEAK", "NOT_RECOMMENDED"]
    tribunal_brief: str
    postcode: str
    postcode_sector: str
    analysed_at: datetime
