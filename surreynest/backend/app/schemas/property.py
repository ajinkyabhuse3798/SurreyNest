"""Pydantic schemas for property search and detail responses."""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class PropertySuggestion(BaseModel):
    """Lightweight property suggestion for autocomplete.

    Attributes:
        uprn: Unique Property Reference Number.
        address: Full address.
        postcode: Normalised postcode.
    """

    uprn: str
    address: str
    postcode: str


class PropertyResponse(BaseModel):
    """Summary property data returned in search results.

    Attributes:
        uprn: Unique Property Reference Number.
        address: Full street address.
        postcode: Normalised postcode.
        property_type: Flat/Terraced/Semi-Detached/Detached/Other.
        floor_area_m2: Total floor area in m².
        num_rooms: Number of habitable rooms.
        energy_rating: Current EPC rating A-G.
        lat: Latitude.
        lng: Longitude.
        distance_m: Distance from search postcode in metres (only in search results).
        safety_score: Area safety score 0-100 derived from crime data (null if no data).
        fairness_score: Rent fairness score 0-100 (null until user reviews supply actual rent).
        hmo_status: HMO licence status, 'licensed', 'unlicensed', or 'not_found'.
    """

    uprn: str
    address: str
    postcode: str
    property_type: Optional[str] = None
    floor_area_m2: Optional[float] = None
    num_rooms: Optional[int] = None
    energy_rating: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    distance_m: Optional[float] = None
    safety_score: Optional[float] = None
    fairness_score: Optional[float] = None
    hmo_status: Optional[str] = None
    tenure: Optional[str] = None

    model_config = {"from_attributes": True}


class HmoDetail(BaseModel):
    """HMO licence details embedded in property detail.

    Attributes:
        is_hmo: Whether property is on the HMO register.
        is_active: Whether the HMO licence is currently active.
        licence_number: Official licence number.
        max_occupants: Maximum permitted occupants.
        expiry_date: Licence expiry date.
    """

    is_hmo: bool
    is_active: Optional[bool] = None
    licence_number: Optional[str] = None
    max_occupants: Optional[int] = None
    expiry_date: Optional[date] = None


class ReviewSummary(BaseModel):
    """Aggregated review statistics for a property.

    Attributes:
        avg_overall: Average overall rating.
        avg_landlord: Average landlord rating.
        avg_condition: Average condition rating.
        avg_value: Average value rating.
        review_count: Total number of moderated reviews.
    """

    avg_overall: Optional[float] = None
    avg_landlord: Optional[float] = None
    avg_condition: Optional[float] = None
    avg_value: Optional[float] = None
    review_count: int = 0


class RentPredictionSummary(BaseModel):
    """Cached rent prediction summary embedded in property detail.

    Attributes:
        predicted_weekly_rent: Mid-point model output in £/week.
        rent_low: Lower bound of the calibrated market band for similar homes.
        rent_high: Upper bound of the calibrated market band for similar homes.
        confidence: Data-quality score describing how tailored the prediction is.
        model_version: Version of the model that generated this prediction.
        computed_at: When this prediction was generated.
    """

    predicted_weekly_rent: Optional[float] = None
    rent_low: Optional[float] = None
    rent_high: Optional[float] = None
    confidence: Optional[float] = None
    model_version: str
    computed_at: datetime

    model_config = {"protected_namespaces": ()}


class FloodRiskDetail(BaseModel):
    """Flood risk data for a property's postcode area.

    Attributes:
        area_code: EA flood area ID.
        label: Short area name.
        description: Full description of the flood area.
        river_or_sea: Water body name.
        distance_km: Distance from property to flood area centre.
        current_severity: Active warning severity (1-4), None if no warning.
        severity_label: Human readable severity.
        message: Current warning message.
    """

    area_code: str
    label: str
    description: Optional[str] = None
    river_or_sea: Optional[str] = None
    distance_km: Optional[float] = None
    current_severity: Optional[int] = None
    severity_label: Optional[str] = None
    message: Optional[str] = None


class PropertyDetail(BaseModel):
    """Full property detail with all associated data.

    Extends PropertyResponse with HMO, review, safety, and rent prediction data.
    """

    uprn: str
    address: str
    postcode: str
    property_type: Optional[str] = None
    built_form: Optional[str] = None
    floor_area_m2: Optional[float] = None
    num_rooms: Optional[int] = None
    energy_rating: Optional[str] = None
    potential_rating: Optional[str] = None
    epc_date: Optional[date] = None
    tenure: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    hmo: HmoDetail
    reviews: ReviewSummary
    safety_score: Optional[float] = None
    rent_prediction: Optional[RentPredictionSummary] = None
    flood_risk: Optional[FloodRiskDetail] = None

    model_config = {"from_attributes": True}


class PropertySearchParams(BaseModel):
    """Query parameters for property search.

    Attributes:
        postcode: Postcode to search near.
        radius: Search radius in metres (default 1000, max 5000).
        page: Page number (default 1).
        per_page: Results per page (default 20, max 50).
    """

    postcode: str
    radius: int = Field(default=1000, ge=250, le=2000)
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=50)

    @field_validator("radius")
    @classmethod
    def validate_radius(cls, v: int) -> int:
        """Restrict radius to allowed values."""
        allowed = [250, 500, 1000, 2000]
        if v not in allowed:
            raise ValueError(f"Radius must be one of {allowed}")
        return v


class PropertySearchResponse(BaseModel):
    """Paginated search results.

    Attributes:
        results: List of property results.
        total: Total matching properties.
        page: Current page number.
        per_page: Results per page.
        pages: Total number of pages.
    """

    results: List[PropertyResponse]
    total: int
    page: int
    per_page: int
    pages: int
