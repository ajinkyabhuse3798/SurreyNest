"""StreetSmarts leaderboard endpoint.

GET /api/leaderboard/streets?district=GU1&limit=10

Ranks streets by a composite score derived from:
  - Safety (crime_data)
  - Value (area_values implied rent — lower = better for students)
  - Proximity to University of Surrey
  - HMO availability (licensed HMO count)

All four pillars are min-max normalised 0–100 and equally weighted.
Results are cached in Redis for 10 minutes (shared across workers).
"""

import logging
import math
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.cache import get_json, set_json
from app.database import get_db
from app.schemas.leaderboard import LeaderboardResponse, ScorePillar, StreetRank
from app.services.score_service import get_safety_score

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

# Note: Crime category weights have been removed — safety scoring is now
# delegated entirely to score_service.get_safety_score() for consistency.

# Allowed districts
ALLOWED_DISTRICTS = {"GU1", "GU2", "GU3", "GU4", "GU5", "GU7"}

# Cache TTL
CACHE_TTL = 600  # 10 minutes


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
            ARRAY_AGG(DISTINCT SPLIT_PART(p.postcode, ' ', 1) || ' ' || SUBSTRING(SPLIT_PART(p.postcode, ' ', 2) FROM 1 FOR 1)) AS sectors,
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
            generated_at=datetime.now(timezone.utc).isoformat(),
        )

    # Step 2: Pre-fetch safety scores for every unique sector via score_service
    # (same 95th-percentile algorithm used on property detail pages — consistent app-wide)
    all_sectors = set()
    for r in rows:
        for s in (r[5] or []):
            all_sectors.add(s.strip())

    safety_by_sector: dict = {}
    for sector in all_sectors:
        result = get_safety_score(sector, db)
        safety_by_sector[sector] = result["safety_score"] if result and result.get("safety_score") is not None else None

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

        # Safety: average the 95th-percentile safety scores for the street's sectors
        # Falls back to None if no crime data exists for any sector
        sector_safety_scores = [
            safety_by_sector[s]
            for s in sectors
            if s in safety_by_sector and safety_by_sector[s] is not None
        ]
        street_safety = round(sum(sector_safety_scores) / len(sector_safety_scores), 1) if sector_safety_scores else None

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
            "safety_score": street_safety,
            "avg_rent": round(avg_rent, 1) if avg_rent else None,
            "hmo_count": hmo_count,
        })

    # Step 6: Normalise Value, Proximity, HMO via min-max within the district.
    # Safety is already normalised globally by score_service — no re-normalisation needed.
    rent_vals = [s["avg_rent"] or 999 for s in streets_data]
    dist_vals = [s["dist_uni"] for s in streets_data]
    hmo_vals = [float(s["hmo_count"]) for s in streets_data]

    # Higher rent = worse for students → invert
    norm_value = _min_max_normalise(rent_vals, invert=True)
    # Closer distance = better → invert
    norm_prox = _min_max_normalise(dist_vals, invert=True)
    # More HMOs = more licensed housing = better
    norm_hmo = _min_max_normalise(hmo_vals, invert=False)

    # Step 7: Compute composite and build response
    ranked = []
    for i, s in enumerate(streets_data):
        # Safety: direct from score_service (0–100 global 95th-pct scale)
        # Fallback to 50.0 only when genuinely no crime data exists for the sector
        safety = s["safety_score"] if s["safety_score"] is not None else 50.0
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
                    detail=f"Sector: {', '.join(s['sectors'])}" if s["sectors"] else "No crime data",
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
        generated_at=datetime.now(timezone.utc).isoformat(),
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

    cache_key = f"leaderboard:{district}_{limit}"

    cached = get_json(cache_key)
    if cached is not None:
        return LeaderboardResponse(**cached)

    result = _build_leaderboard(db, district, limit)
    set_json(cache_key, result.model_dump(), CACHE_TTL)
    return result
