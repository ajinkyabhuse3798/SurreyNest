"""Heatmap routes: GET /heatmap/sectors.

Returns aggregated postcode-sector-level data for the NeighbourhoodPulse
interactive heatmap on the Home page. Combines safety scores, average
rent predictions, and HMO density into a single response. Cached in
Redis for 10 minutes since the underlying data only changes weekly.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.cache import get_json, set_json
from app.database import get_db
from app.rate_limit import limiter
from app.models.crime_data import CrimeData
from app.models.hmo_record import HmoRecord
from app.models.property import Property
from app.models.area_value import AreaValue
from app.services.score_service import get_safety_score

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Response schemas ─────────────────────────────────────────────────────────


class SectorData(BaseModel):
    postcode_sector: str
    centre_lat: float
    centre_lng: float
    property_count: int
    safety_score: Optional[float] = None
    avg_weekly_rent: Optional[float] = None
    hmo_count: int = 0
    hmo_density_pct: float = 0.0


class HeatmapBounds(BaseModel):
    min_lat: float
    max_lat: float
    min_lng: float
    max_lng: float


class HeatmapResponse(BaseModel):
    sectors: List[SectorData]
    bounds: HeatmapBounds
    cached_at: str


# Cache TTL
CACHE_TTL_SECONDS = 600  # 10 minutes


def _extract_sector(postcode: str) -> str:
    """Extract postcode sector from a full postcode, e.g. 'GU2 7XH' → 'GU2 7'."""
    if not postcode:
        return ""
    parts = postcode.strip().upper().split()
    if len(parts) == 2 and len(parts[1]) >= 1:
        return f"{parts[0]} {parts[1][0]}"
    return postcode.strip().upper()


def _build_heatmap_data(db: Session) -> dict:
    """Build the full heatmap dataset from the database."""

    # ── 1. Group properties by postcode sector → centre point + count ────
    sectors: Dict[str, dict] = {}

    # Get all properties with valid coordinates
    props = (
        db.query(
            Property.postcode,
            Property.lat,
            Property.lng,
        )
        .filter(
            Property.lat.isnot(None),
            Property.lng.isnot(None),
            Property.postcode.isnot(None),
        )
        .all()
    )

    for p in props:
        sector = _extract_sector(p.postcode)
        if sector not in sectors:
            sectors[sector] = {
                "lats": [],
                "lngs": [],
                "count": 0,
                "hmo_count": 0,
                "rents": [],
            }
        sectors[sector]["lats"].append(p.lat)
        sectors[sector]["lngs"].append(p.lng)
        sectors[sector]["count"] += 1

    if not sectors:
        return {
            "sectors": [],
            "bounds": {"min_lat": 0, "max_lat": 0, "min_lng": 0, "max_lng": 0},
        }

    # ── 2. Average rents per sector from area_values ─────────────────────
    rent_rows = (
        db.query(
            AreaValue.postcode,
            AreaValue.implied_weekly_rent,
        )
        .filter(
            AreaValue.implied_weekly_rent.isnot(None),
        )
        .all()
    )

    sector_rents: Dict[str, list] = {}
    for r in rent_rows:
        sector = _extract_sector(r.postcode)
        if sector not in sector_rents:
            sector_rents[sector] = []
        sector_rents[sector].append(float(r.implied_weekly_rent))

    # ── 3. HMO counts per sector ────────────────────────────────────────
    hmo_rows = db.query(HmoRecord.postcode).all()
    sector_hmo: Dict[str, int] = {}
    for h in hmo_rows:
        sector = _extract_sector(h.postcode)
        sector_hmo[sector] = sector_hmo.get(sector, 0) + 1

    # ── 4. Safety scores per sector ──────────────────────────────────────
    crime_sectors = db.query(CrimeData.postcode_sector).distinct().all()
    crime_sector_names = [r.postcode_sector for r in crime_sectors]

    sector_safety: Dict[str, float] = {}
    for cs in crime_sector_names:
        result = get_safety_score(cs, db)
        if result and result.get("safety_score") is not None:
            sector_safety[cs] = result["safety_score"]

    # ── 5. Assemble the response ─────────────────────────────────────────
    all_lats = []
    all_lngs = []
    result_sectors = []

    for sector_name, data in sectors.items():
        centre_lat = sum(data["lats"]) / len(data["lats"])
        centre_lng = sum(data["lngs"]) / len(data["lngs"])
        prop_count = data["count"]

        all_lats.append(centre_lat)
        all_lngs.append(centre_lng)

        # Rent
        rents = sector_rents.get(sector_name, [])
        avg_rent = round(sum(rents) / len(rents), 1) if rents else None

        # HMO
        hmo_count = sector_hmo.get(sector_name, 0)
        hmo_density = (
            round((hmo_count / prop_count) * 100, 1) if prop_count > 0 else 0.0
        )

        # Safety
        safety = sector_safety.get(sector_name)

        result_sectors.append(
            SectorData(
                postcode_sector=sector_name,
                centre_lat=round(centre_lat, 6),
                centre_lng=round(centre_lng, 6),
                property_count=prop_count,
                safety_score=safety,
                avg_weekly_rent=avg_rent,
                hmo_count=hmo_count,
                hmo_density_pct=hmo_density,
            )
        )

    # Sort by property count descending
    result_sectors.sort(key=lambda s: s.property_count, reverse=True)

    bounds = HeatmapBounds(
        min_lat=round(min(all_lats), 6),
        max_lat=round(max(all_lats), 6),
        min_lng=round(min(all_lngs), 6),
        max_lng=round(max(all_lngs), 6),
    )

    return {
        "sectors": [s.model_dump() for s in result_sectors],
        "bounds": bounds.model_dump(),
        "cached_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Endpoint ─────────────────────────────────────────────────────────────────


@router.get(
    "/heatmap/sectors",
    response_model=HeatmapResponse,
    summary="Aggregated sector data for the NeighbourhoodPulse heatmap",
)
@limiter.limit("30/minute")
async def get_heatmap_sectors(
    request: Request, db: Session = Depends(get_db)
) -> HeatmapResponse:
    """Return aggregated rent, safety, and HMO data per postcode sector.

    Cached in Redis for 10 minutes since underlying data only changes weekly.
    Used by the NeighbourhoodPulse map on the Home page.
    """
    cache_key = "heatmap:sectors"
    cached = get_json(cache_key)
    if cached is not None:
        logger.debug("Heatmap cache hit (Redis)")
        return HeatmapResponse(**cached)

    logger.info("Building heatmap data (cache miss or expired)")
    data = _build_heatmap_data(db)
    set_json(cache_key, data, CACHE_TTL_SECONDS)

    return HeatmapResponse(**data)
