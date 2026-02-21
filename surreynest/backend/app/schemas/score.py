"""Pydantic schemas for safety score and rent fairness score responses."""

from typing import List, Optional

from pydantic import BaseModel


class CrimeBreakdown(BaseModel):
    """A single crime category count within a safety score breakdown.

    Attributes:
        category: Crime category name from police.uk.
        total_count: Total crimes in this category over the data period.
    """

    category: str
    total_count: int


class SafetyScoreResponse(BaseModel):
    """Safety score for a postcode sector with crime breakdown.

    Attributes:
        postcode_sector: Postcode sector (e.g. "GU2 7").
        safety_score: Computed score 0-100 (higher = safer).
        breakdown: List of crime categories and counts.
    """

    postcode_sector: str
    safety_score: float
    breakdown: List[CrimeBreakdown]


class RentFairnessResponse(BaseModel):
    """Rent fairness score comparing actual vs predicted rent.

    Attributes:
        score: Fairness score 0-100.
        label: Human-readable label (e.g. "Below market").
        colour: Display colour (green/amber/red).
        ratio: actual_rent / predicted_rent.
        predicted_rent: Model's predicted weekly rent in £.
        actual_rent: Tenant's reported weekly rent in £.
        difference_pounds: actual - predicted in £.
        difference_percent: Percentage difference.
    """

    score: int
    label: str
    colour: str
    ratio: float
    predicted_rent: float
    actual_rent: float
    difference_pounds: float
    difference_percent: float
