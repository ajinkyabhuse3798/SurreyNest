"""Flood pipeline: fetch EA flood area data and current warnings per postcode.

Queries the Environment Agency Flood Monitoring API (Open Government Licence v3)
for flood areas within 3km of each unique postcode, matches active warnings
to areas, and upserts results to the flood_risk table.

Attribution: "This uses Environment Agency flood and river level data
from the real-time data API (Beta)"
"""

import logging
import math
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.data_pipelines.utils import run_pipeline_with_tracking
from app.models.flood_risk import FloodRisk
from app.models.postcode_cache import PostcodeCache

logger = logging.getLogger(__name__)

# ── EA Flood Monitoring API endpoints ─────────────────────────────────────────
EA_FLOOD_AREAS_URL = "https://environment.data.gov.uk/flood-monitoring/id/floodAreas"
EA_FLOODS_URL = "https://environment.data.gov.uk/flood-monitoring/id/floods"

# Search radius in km for flood areas around each postcode
SEARCH_RADIUS_KM = 3

# Severity level mapping
SEVERITY_LABELS = {
    1: "Severe Flood Warning",
    2: "Flood Warning",
    3: "Flood Alert",
    4: "Warning No Longer in Force",
}

# Rate limiting: wait between API calls to be a good citizen
API_DELAY_SECONDS = 0.5


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate haversine distance between two points in km.

    Args:
        lat1: Latitude of point 1.
        lng1: Longitude of point 1.
        lat2: Latitude of point 2.
        lng2: Longitude of point 2.

    Returns:
        Distance in kilometres.
    """
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _fetch_flood_areas(lat: float, lng: float, dist_km: int = 3) -> List[Dict]:
    """Fetch flood areas near a location from the EA API.

    Args:
        lat: Latitude.
        lng: Longitude.
        dist_km: Search distance in km.

    Returns:
        List of flood area dicts from the EA API.
    """
    try:
        resp = requests.get(
            EA_FLOOD_AREAS_URL,
            params={"lat": lat, "long": lng, "dist": dist_km},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("items", [])
    except requests.RequestException:
        logger.warning(
            "Failed to fetch flood areas for lat=%.4f, lng=%.4f",
            lat,
            lng,
            exc_info=True,
        )
        return []


def _fetch_current_warnings(lat: float, lng: float, dist_km: int = 5) -> Dict[str, Dict]:
    """Fetch current flood warnings near a location.

    Args:
        lat: Latitude.
        lng: Longitude.
        dist_km: Search distance in km.

    Returns:
        Dict mapping floodAreaID → warning data.
    """
    try:
        resp = requests.get(
            EA_FLOODS_URL,
            params={"lat": lat, "long": lng, "dist": dist_km},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        warnings_map: Dict[str, Dict] = {}
        for item in data.get("items", []):
            flood_area = item.get("floodArea", {})
            area_id = flood_area.get("notation") or item.get("floodAreaID", "")
            if area_id:
                warnings_map[area_id] = {
                    "severity": item.get("severityLevel"),
                    "severity_label": SEVERITY_LABELS.get(item.get("severityLevel")),
                    "message": item.get("message"),
                }
        return warnings_map
    except requests.RequestException:
        logger.warning(
            "Failed to fetch flood warnings for lat=%.4f, lng=%.4f",
            lat,
            lng,
            exc_info=True,
        )
        return {}


def _get_unique_postcodes_with_coords(
    db: Session,
) -> List[Tuple[str, float, float]]:
    """Get unique postcodes with coordinates from postcode_cache.

    Args:
        db: SQLAlchemy session.

    Returns:
        List of (postcode, lat, lng) tuples.
    """
    results = (
        db.query(PostcodeCache.postcode, PostcodeCache.lat, PostcodeCache.lng)
        .filter(PostcodeCache.lat.isnot(None))
        .filter(PostcodeCache.lng.isnot(None))
        .filter(PostcodeCache.is_valid == True)  # noqa: E712
        .all()
    )
    return [(r.postcode, float(r.lat), float(r.lng)) for r in results]


def _deduplicate_postcodes(
    postcodes: List[Tuple[str, float, float]],
    grid_size_km: float = 1.0,
) -> Dict[str, Tuple[str, float, float]]:
    """Group postcodes by geographic grid to reduce API calls.

    Postcodes within the same ~1km grid cell share flood area data.
    We pick one representative postcode per cell.

    Args:
        postcodes: List of (postcode, lat, lng).
        grid_size_km: Grid cell size in km.

    Returns:
        Dict mapping grid_key → representative (postcode, lat, lng).
    """
    grid: Dict[str, Tuple[str, float, float]] = {}
    # ~0.009 degrees ≈ 1km at UK latitudes
    cell_degrees = grid_size_km * 0.009

    for pc, lat, lng in postcodes:
        grid_key = f"{int(lat / cell_degrees)}_{int(lng / cell_degrees)}"
        if grid_key not in grid:
            grid[grid_key] = (pc, lat, lng)

    return grid


def run_flood_pipeline(db: Optional[Session] = None) -> int:
    """Execute the full flood pipeline.

    1. Get unique postcodes from postcode_cache.
    2. Deduplicate by geographic grid (~1km cells).
    3. For each grid cell, fetch flood areas + current warnings.
    4. Assign flood areas to all postcodes in that grid cell.
    5. Upsert to flood_risk table.

    Args:
        db: SQLAlchemy session. Creates one if not provided.

    Returns:
        Number of rows upserted.
    """
    logger.info("Starting flood pipeline")

    own_session = db is None
    if own_session:
        db = SessionLocal()

    try:
        # ── Step 1: Get all postcodes with coordinates ────────────────────
        all_postcodes = _get_unique_postcodes_with_coords(db)
        logger.info("Found %d postcodes with coordinates", len(all_postcodes))

        if not all_postcodes:
            logger.warning("No postcodes with coordinates, skipping flood pipeline")
            return 0

        # ── Step 2: Deduplicate by geographic grid ────────────────────────
        grid = _deduplicate_postcodes(all_postcodes)
        logger.info(
            "Deduplicated %d postcodes into %d grid cells",
            len(all_postcodes),
            len(grid),
        )

        # Build reverse mapping: grid_key → list of postcodes
        cell_degrees = 0.009
        pc_to_grid: Dict[str, str] = {}
        for pc, lat, lng in all_postcodes:
            grid_key = f"{int(lat / cell_degrees)}_{int(lng / cell_degrees)}"
            pc_to_grid[pc] = grid_key

        grid_postcodes: Dict[str, List[str]] = {}
        for pc, gk in pc_to_grid.items():
            grid_postcodes.setdefault(gk, []).append(pc)

        # ── Step 3: Fetch flood data per grid cell ────────────────────────
        now = datetime.now(timezone.utc)
        records_to_upsert: List[Dict[str, Any]] = []

        for idx, (grid_key, (rep_pc, rep_lat, rep_lng)) in enumerate(grid.items()):
            if idx > 0 and idx % 50 == 0:
                logger.info("Processing grid cell %d/%d", idx, len(grid))

            # Fetch flood areas
            areas = _fetch_flood_areas(rep_lat, rep_lng, dist_km=SEARCH_RADIUS_KM)

            # Fetch current warnings (slightly larger radius to catch nearby)
            warnings = _fetch_current_warnings(rep_lat, rep_lng, dist_km=5)

            # Find the closest flood area for this grid cell
            closest_area: Optional[Dict] = None
            closest_dist: float = float("inf")

            for area in areas:
                area_lat = area.get("lat")
                area_lng = area.get("long")
                if area_lat is None or area_lng is None:
                    continue
                dist = _haversine_km(rep_lat, rep_lng, float(area_lat), float(area_lng))
                if dist < closest_dist:
                    closest_dist = dist
                    closest_area = area

            if closest_area is None:
                # No flood areas nearby, still record as no risk
                for pc in grid_postcodes.get(grid_key, [rep_pc]):
                    records_to_upsert.append({
                        "postcode": pc,
                        "area_code": "NONE",
                        "label": "No flood area nearby",
                        "description": None,
                        "county": None,
                        "river_or_sea": None,
                        "area_lat": None,
                        "area_lng": None,
                        "distance_km": None,
                        "current_severity": None,
                        "severity_label": None,
                        "message": None,
                        "last_updated": now,
                    })
                continue

            # Get area code and check for active warnings
            area_code = closest_area.get("fwdCode") or closest_area.get("notation", "")
            warning_data = warnings.get(area_code, {})

            for pc in grid_postcodes.get(grid_key, [rep_pc]):
                # Recalculate distance for this specific postcode
                pc_lat, pc_lng = rep_lat, rep_lng
                for p, la, lo in all_postcodes:
                    if p == pc:
                        pc_lat, pc_lng = la, lo
                        break

                area_lat = closest_area.get("lat")
                area_lng = closest_area.get("long")
                dist_km = (
                    _haversine_km(pc_lat, pc_lng, float(area_lat), float(area_lng))
                    if area_lat and area_lng
                    else None
                )

                records_to_upsert.append({
                    "postcode": pc,
                    "area_code": area_code,
                    "label": closest_area.get("label", ""),
                    "description": closest_area.get("description"),
                    "county": closest_area.get("county"),
                    "river_or_sea": closest_area.get("riverOrSea"),
                    "area_lat": float(area_lat) if area_lat else None,
                    "area_lng": float(area_lng) if area_lng else None,
                    "distance_km": round(dist_km, 2) if dist_km is not None else None,
                    "current_severity": warning_data.get("severity"),
                    "severity_label": warning_data.get("severity_label"),
                    "message": warning_data.get("message"),
                    "last_updated": now,
                })

            # Rate limit
            time.sleep(API_DELAY_SECONDS)

        # ── Step 4: Upsert to database ────────────────────────────────────
        logger.info("Upserting %d flood risk records", len(records_to_upsert))

        # Clear existing records and re-insert (simpler than complex upsert
        # since we refresh all data each run)
        db.query(FloodRisk).delete()
        db.commit()

        # Batch insert
        batch_size = 500
        for i in range(0, len(records_to_upsert), batch_size):
            batch = records_to_upsert[i : i + batch_size]
            db.bulk_insert_mappings(FloodRisk, batch)
            db.commit()

        logger.info("Flood pipeline complete: %d records", len(records_to_upsert))
        return len(records_to_upsert)

    finally:
        if own_session:
            db.close()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    run_pipeline_with_tracking("flood_pipeline", run_flood_pipeline)
