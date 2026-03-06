"""StreetSmarts leaderboard endpoint.

GET /api/leaderboard/streets?district=GU1&limit=10

Ranks streets by a composite score derived from:
  - Safety (crime_data)
  - Value (area_values implied rent — lower = better for students)
  - Proximity to University of Surrey
  - HMO availability (licensed HMO count)

All four pillars are min-max normalised 0–100 and equally weighted.
Results are cached in-memory for 10 minutes.
"""

import logging
import math
import time
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Constants ────────────────────────────────────────────────────────────────

SURREY_UNI = (51.2417, -0.5888)
TOWN_CENTRE = (51.2362, -0.5704)

# Streets must have at least this many properties to appear
MIN_PROPERTIES = 5

# Exclude these from street extraction (town/county names, not streets)
NOISE_WORDS = {
    "GUILDFORD", "SURREY", "GODALMING", "WOKING", "CRANLEIGH",
    "FARNHAM", "ALDERSHOT", "HASLEMERE",
}

# Crime category weights (same as score_service.py)
CRIME_WEIGHTS = {
    "violent-crime": 3.0,
    "robbery": 2.5,
    "anti-social-behaviour": 2.0,
    "burglary": 2.0,
    "drugs": 1.5,
    "public-order": 1.5,
    "vehicle-crime": 1.0,
    "theft-from-the-person": 1.0,
}

# Allowed districts
ALLOWED_DISTRICTS = {"GU1", "GU2", "GU3", "GU4", "GU5", "GU7"}

# ── Cache ────────────────────────────────────────────────────────────────────

_cache = {}
CACHE_TTL = 600  # 10 minutes


# ── Response schema ──────────────────────────────────────────────────────────

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


# ── Helpers ──────────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Approximate distance in km using Haversine formula."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _min_max_normalise(values: List[float], invert: bool = False) -> List[float]:
    """Normalise values to 0–100. If invert=True, lower raw → higher score."""
    if not values:
        return []
    mn, mx = min(values), max(values)
    if mx == mn:
        return [50.0] * len(values)
    normalised = [(v - mn) / (mx - mn) * 100 for v in values]
    if invert:
        normalised = [100 - n for n in normalised]
    return normalised


def _compute_safety_score(crime_counts: dict) -> float:
    """Weighted crime score for a sector — higher = MORE crime (bad)."""
    return sum(
        count * CRIME_WEIGHTS.get(cat, 1.0)
        for cat, count in crime_counts.items()
    )


# ── Main aggregation ─────────────────────────────────────────────────────────

def _build_leaderboard(db: Session, district: str, limit: int) -> LeaderboardResponse:
    """Build the street leaderboard from scratch."""
    dist_pattern = f"{district} %"

    # Step 1: Extract streets with aggregated property data
    street_query = text("""
        SELECT
            INITCAP(TRIM(SPLIT_PART(p.address, ',', -1))) AS street_name,
            COUNT(*) AS property_count,
            AVG(p.lat) AS avg_lat,
            AVG(p.lng) AS avg_lng,
            AVG(p.num_rooms) FILTER (WHERE p.num_rooms > 0) AS avg_rooms,
            ARRAY_AGG(DISTINCT SUBSTRING(p.postcode FROM 1 FOR 4)) AS sectors,
            ARRAY_AGG(DISTINCT p.postcode) AS postcodes
        FROM properties p
        WHERE p.lat IS NOT NULL
          AND p.lng IS NOT NULL
          AND p.postcode LIKE :dist_pattern
          AND UPPER(TRIM(SPLIT_PART(p.address, ',', -1))) NOT IN :noise
          AND LENGTH(TRIM(SPLIT_PART(p.address, ',', -1))) > 3
        GROUP BY street_name
        HAVING COUNT(*) >= :min_props
        ORDER BY COUNT(*) DESC
    """)

    rows = db.execute(
        street_query,
        {
            "dist_pattern": dist_pattern,
            "noise": tuple(NOISE_WORDS),
            "min_props": MIN_PROPERTIES,
        },
    ).fetchall()

    if not rows:
        return LeaderboardResponse(
            district=district,
            streets=[],
            total_streets=0,
            generated_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        )

    # Step 2: Get crime data per sector
    all_sectors = set()
    for r in rows:
        for s in (r[5] or []):
            all_sectors.add(s.strip())

    crime_by_sector = {}
    if all_sectors:
        crime_query = text("""
            SELECT postcode_sector, category, SUM(count) AS total
            FROM crime_data
            WHERE postcode_sector = ANY(:sectors)
            GROUP BY postcode_sector, category
        """)
        crime_rows = db.execute(
            crime_query, {"sectors": list(all_sectors)}
        ).fetchall()
        for cr in crime_rows:
            crime_by_sector.setdefault(cr[0], {})[cr[1]] = cr[2]

    # Step 3: Get avg implied rent per postcode
    rent_by_postcode = {}
    all_postcodes = set()
    for r in rows:
        for pc in (r[6] or []):
            all_postcodes.add(pc)

    if all_postcodes:
        rent_query = text("""
            SELECT postcode, implied_weekly_rent
            FROM area_values
            WHERE postcode = ANY(:postcodes)
        """)
        rent_rows = db.execute(
            rent_query, {"postcodes": list(all_postcodes)}
        ).fetchall()
        for rr in rent_rows:
            rent_by_postcode[rr[0]] = rr[1]

    # Step 4: Count active HMOs per postcode
    hmo_by_postcode = {}
    if all_postcodes:
        hmo_query = text("""
            SELECT postcode, COUNT(*) AS hmo_count
            FROM hmo_records
            WHERE is_active = true AND postcode = ANY(:postcodes)
            GROUP BY postcode
        """)
        hmo_rows = db.execute(
            hmo_query, {"postcodes": list(all_postcodes)}
        ).fetchall()
        for hr in hmo_rows:
            hmo_by_postcode[hr[0]] = hr[1]

    # Step 5: Compute raw scores per street
    streets_data = []
    for r in rows:
        street_name = r[0]
        prop_count = r[1]
        avg_lat = r[2]
        avg_lng = r[3]
        avg_rooms = r[4]
        sectors = [s.strip() for s in (r[5] or [])]
        postcodes = r[6] or []

        # Distance to uni
        dist_uni = _haversine_km(avg_lat, avg_lng, *SURREY_UNI)

        # Safety: average weighted crime across the street's sectors
        sector_crimes = []
        for s in sectors:
            if s in crime_by_sector:
                sector_crimes.append(_compute_safety_score(crime_by_sector[s]))
        raw_crime = sum(sector_crimes) / len(sector_crimes) if sector_crimes else 0

        # Avg rent
        rents = [rent_by_postcode[pc] for pc in postcodes if pc in rent_by_postcode]
        avg_rent = sum(rents) / len(rents) if rents else None

        # HMO count
        hmo_count = sum(hmo_by_postcode.get(pc, 0) for pc in postcodes)

        streets_data.append({
            "street_name": street_name,
            "property_count": prop_count,
            "avg_lat": avg_lat,
            "avg_lng": avg_lng,
            "avg_rooms": round(avg_rooms, 1) if avg_rooms else None,
            "sectors": sectors,
            "dist_uni": round(dist_uni, 2),
            "raw_crime": raw_crime,
            "avg_rent": round(avg_rent, 1) if avg_rent else None,
            "hmo_count": hmo_count,
        })

    # Step 6: Min-max normalise each pillar
    crime_vals = [s["raw_crime"] for s in streets_data]
    rent_vals = [s["avg_rent"] or 999 for s in streets_data]
    dist_vals = [s["dist_uni"] for s in streets_data]
    hmo_vals = [float(s["hmo_count"]) for s in streets_data]

    # Higher crime = worse → invert
    norm_safety = _min_max_normalise(crime_vals, invert=True)
    # Higher rent = worse for students → invert
    norm_value = _min_max_normalise(rent_vals, invert=True)
    # Closer distance = better → invert
    norm_prox = _min_max_normalise(dist_vals, invert=True)
    # More HMOs = more licensed housing = better
    norm_hmo = _min_max_normalise(hmo_vals, invert=False)

    # Step 7: Compute composite and build response
    ranked = []
    for i, s in enumerate(streets_data):
        safety = round(norm_safety[i], 1)
        value = round(norm_value[i], 1)
        prox = round(norm_prox[i], 1)
        hmo = round(norm_hmo[i], 1)
        composite = round((safety + value + prox + hmo) / 4, 1)

        ranked.append({
            **s,
            "safety_score": safety,
            "value_score": value,
            "proximity_score": prox,
            "hmo_score": hmo,
            "composite": composite,
        })

    # Sort by composite descending
    ranked.sort(key=lambda x: x["composite"], reverse=True)

    # Build response
    streets = []
    for rank_idx, s in enumerate(ranked[:limit], 1):
        streets.append(StreetRank(
            rank=rank_idx,
            street_name=s["street_name"],
            district=district,
            composite_score=s["composite"],
            pillars=[
                ScorePillar(
                    label="Safety",
                    score=s["safety_score"],
                    detail=f"Crime index: {s['raw_crime']:.0f}",
                ),
                ScorePillar(
                    label="Value",
                    score=s["value_score"],
                    detail=f"Avg £{s['avg_rent']:.0f}/wk" if s["avg_rent"] else "No data",
                ),
                ScorePillar(
                    label="Proximity",
                    score=s["proximity_score"],
                    detail=f"{s['dist_uni']:.1f}km to uni",
                ),
                ScorePillar(
                    label="HMO",
                    score=s["hmo_score"],
                    detail=f"{s['hmo_count']} licensed",
                ),
            ],
            property_count=s["property_count"],
            avg_weekly_rent=s["avg_rent"],
            avg_rooms=s["avg_rooms"],
            distance_to_uni_km=s["dist_uni"],
            postcode_sectors=s["sectors"],
        ))

    return LeaderboardResponse(
        district=district,
        streets=streets,
        total_streets=len(ranked),
        generated_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    )


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.get(
    "/leaderboard/streets",
    response_model=LeaderboardResponse,
    summary="Top-ranked streets by composite student score",
)
async def get_street_leaderboard(
    district: str = Query("GU2", description="Postcode district, e.g. GU1 or GU2"),
    limit: int = Query(10, ge=1, le=50, description="Max streets to return"),
    db: Session = Depends(get_db),
) -> LeaderboardResponse:
    """Return streets ranked by composite score for students.

    Composite score is an equally-weighted average of:
    Safety, Value, Proximity to Uni, and HMO availability.
    """
    district = district.strip().upper()
    if district not in ALLOWED_DISTRICTS:
        district = "GU2"

    cache_key = f"{district}_{limit}"
    now = time.time()

    if cache_key in _cache:
        cached_data, cached_at = _cache[cache_key]
        if now - cached_at < CACHE_TTL:
            return cached_data

    result = _build_leaderboard(db, district, limit)
    _cache[cache_key] = (result, now)
    return result
