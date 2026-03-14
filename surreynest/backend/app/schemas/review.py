"""Pydantic schemas for tenant review creation and responses."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class ReviewCreate(BaseModel):
    """Request body for creating a new review.

    Attributes:
        uprn: Property UPRN being reviewed.
        overall_rating: 1-5 star overall rating.
        landlord_rating: 1-5 landlord responsiveness rating.
        condition_rating: 1-5 property condition rating.
        value_rating: 1-5 rent value rating.
        weekly_rent_paid: Optional self-reported weekly rent in £.
        move_in_year: Optional year tenancy started.
        review_text: Free text, 50-1000 characters.
    """

    uprn: str
    overall_rating: int = Field(ge=1, le=5)
    landlord_rating: int = Field(ge=1, le=5)
    condition_rating: int = Field(ge=1, le=5)
    value_rating: int = Field(ge=1, le=5)
    weekly_rent_paid: Optional[float] = Field(default=None, gt=0)
    move_in_year: Optional[int] = Field(default=None, ge=2000, le=2030)
    review_text: str = Field(min_length=50, max_length=1000)
    agent_name: Optional[str] = None

    @field_validator("review_text")
    @classmethod
    def strip_review_text(cls, v: str) -> str:
        """Strip whitespace from review text."""
        return v.strip()

    @field_validator("agent_name")
    @classmethod
    def normalise_agent_name(cls, v: Optional[str]) -> Optional[str]:
        """Normalise agent name to lowercase slug."""
        return v.lower().strip() if v else None


class ReviewResponse(BaseModel):
    """Response body for a single review.

    Attributes:
        id: Review UUID.
        user_id: Author's user UUID (null if account deleted).
        uprn: Property UPRN.
        overall_rating: 1-5 overall rating.
        landlord_rating: 1-5 landlord rating.
        condition_rating: 1-5 condition rating.
        value_rating: 1-5 value rating.
        weekly_rent_paid: Self-reported weekly rent if provided.
        move_in_year: Year tenancy started if provided.
        review_text: Review body text.
        created_at: When review was submitted.
        is_moderated: Whether admin has approved this review.
    """

    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    uprn: str
    overall_rating: int
    landlord_rating: int
    condition_rating: int
    value_rating: int
    weekly_rent_paid: Optional[float] = None
    move_in_year: Optional[int] = None
    agent_name: Optional[str] = None
    review_text: str
    created_at: datetime
    is_moderated: bool

    model_config = {"from_attributes": True}


class ReviewListResponse(BaseModel):
    """Paginated list of reviews for a property.

    Attributes:
        reviews: List of review responses.
        total: Total review count.
        page: Current page.
        pages: Total pages.
    """

    reviews: list[ReviewResponse]
    total: int
    page: int
    pages: int
