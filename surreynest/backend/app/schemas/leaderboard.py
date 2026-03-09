"""Pydantic schemas for the StreetSmarts leaderboard endpoint."""

from typing import List, Optional

from pydantic import BaseModel


class ScorePillar(BaseModel):
    label: str
    score: float
    detail: str


class StreetRank(BaseModel):
    rank: int
    street_name: str
    district: str
    composite_score: float
    pillars: List[ScorePillar]
    property_count: int
    avg_weekly_rent: Optional[float] = None
    avg_rooms: Optional[float] = None
    distance_to_uni_km: float
    postcode_sectors: List[str] = []


class LeaderboardResponse(BaseModel):
    district: str
    streets: List[StreetRank]
    total_streets: int
    generated_at: str
