"""Pydantic schemas for letting agent listing, detail, and search."""

from datetime import datetime
from typing import List, Optional
import uuid

from pydantic import BaseModel


class AgentReviewSummary(BaseModel):
    """Aggregate review stats for a letting agent."""

    review_count: int
    avg_overall_rating: float
    avg_landlord_rating: float
    avg_condition_rating: float
    avg_value_rating: float
    agent_score: float  # 0-100 composite
    latest_review_date: Optional[datetime] = None


class AgentReviewItem(BaseModel):
    """A single review item on an agent's profile."""

    id: uuid.UUID
    uprn: str
    overall_rating: int
    landlord_rating: int
    condition_rating: int
    value_rating: int
    review_text: str
    move_in_year: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentSummary(BaseModel):
    """Summary of a letting agent for the directory listing."""

    name: str  # slug
    display_name: str
    is_verified: bool
    postcode_sectors: Optional[list] = None
    stats: AgentReviewSummary


class AgentDetail(AgentSummary):
    """Full agent profile with recent reviews."""

    website: Optional[str] = None
    recent_reviews: List[AgentReviewItem] = []


class AgentSearchResult(BaseModel):
    """Lightweight result for autocomplete suggestions."""

    name: str  # slug
    display_name: str
    review_count: int
