"""Pydantic schemas for the listing checker."""

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field


class CheckListingRequest(BaseModel):
    """Request body for analysing a manual postcode and optional pasted wording."""

    postcode: Optional[str] = Field(None, max_length=10)
    listing_text: Optional[str] = Field(None, max_length=15000)


class NearbyProperty(BaseModel):
    """Nearby property summary for the analysed area."""

    uprn: str
    address: str
    postcode: str
    property_type: Optional[str] = None
    num_rooms: Optional[int] = None
    tenure: Optional[str] = None


class ListingComplianceIssue(BaseModel):
    """Single wording issue or positive signal found in the listing text."""

    id: str
    category: Literal[
        "rental_bidding",
        "rent_in_advance",
        "benefits_discrimination",
        "children_discrimination",
        "pets",
    ]
    title: str
    severity: Literal["high", "medium", "low"]
    status: Literal["flagged", "review", "positive"]
    applies_from: Optional[date] = None
    summary: str
    guidance: str
    evidence: str


class ListingComplianceReport(BaseModel):
    """Compliance scan result for manually pasted listing wording."""

    status: Literal["HIGH_RISK", "REVIEW", "CLEAR", "NOT_AVAILABLE"]
    headline: str
    summary: str
    analysed_text_source: Optional[Literal["manual_text"]] = None
    issues: list[ListingComplianceIssue] = Field(default_factory=list)
    positives: list[ListingComplianceIssue] = Field(default_factory=list)


class CheckListingResponse(BaseModel):
    """Full listing checker response."""

    postcode: str
    postcode_sector: str
    safety_score: Optional[float] = None
    safety_label: Optional[str] = None
    avg_predicted_rent_weekly: Optional[float] = None
    avg_predicted_rent_monthly: Optional[float] = None
    properties_in_area: int = 0
    nearby_properties: list[NearbyProperty] = Field(default_factory=list)
    hmo_licensed_count: int = 0
    hmo_total_count: int = 0
    flood_risk_severity: Optional[str] = None
    compliance_report: ListingComplianceReport
    message: str = ""
