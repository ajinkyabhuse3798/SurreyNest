"""Crime pipeline: fetch police.uk data and compute safety scores by postcode sector.

Collects crime data for all unique postcodes in the properties table,
aggregates by postcode sector and category, computes safety scores,
and upserts to the crime_data table.
"""

import logging
from datetime import date, datetime, timezone
from dateutil.relativedelta import relativedelta
from typing import Dict, List, Optional, Set, Tuple

import pandas as pd
from sqlalchemy import func, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session


from app.database import SessionLocal
from app.data_pipelines.utils import (
    RateLimiter,
    api_call_with_retry,
    run_pipeline_with_tracking,
)
from app.models.crime_data import CrimeData
from app.models.pipeline_config import PipelineConfig
from app.models.postcode_cache import PostcodeCache
from app.models.property import Property

logger = logging.getLogger(__name__)

# ── Police.uk API ────────────────────────────────────────────────────────────
POLICE_API_BASE = "https://data.police.uk/api"

# Categories we track for safety score (from api-reference.md)
TRACKED_CATEGORIES = [
    "anti-social-behaviour",
    "burglary",
    "drugs",
    "robbery",
    "theft-from-the-person",
    "vehicle-crime",
    "violent-crime",
    "public-order",
]

# Safety score weighting (from api-reference.md)
CATEGORY_WEIGHTS = {
    "violent-crime": 3.0,
    "robbery": 2.5,
    "anti-social-behaviour": 2.0,
    "burglary": 2.0,
    "drugs": 1.5,
    "public-order": 1.5,
    "vehicle-crime": 1.0,
    "theft-from-the-person": 1.0,
}

# Postcodes.io batch API
POSTCODES_BATCH_URL = "https://api.postcodes.io/postcodes"
POSTCODES_BATCH_SIZE = 100


def _extract_postcode_sector(postcode: str) -> str:
    """Extract postcode sector from a full postcode.

    Postcode sector = everything before the last 2 characters of the incode.
    Example: "GU2 7XH" → "GU2 7"

    Args:
        postcode: Full normalised postcode.

    Returns:
        Postcode sector string.
    """
    parts = postcode.strip().split()
    if len(parts) == 2:
        outcode = parts[0]
        incode = parts[1]
        return f"{outcode} {incode[0]}"
    # Fallback: drop last 2 chars
    return postcode[:-2].strip()


def _get_months_range(months_back: int = 12) -> List[str]:
    """Generate a list of YYYY-MM strings for the last N months.

    Args:
        months_back: Number of months to go back.

    Returns:
        List of date strings in YYYY-MM format.
    """
    today = date.today()
    # Police API data is typically 2 months behind
    start = today - relativedelta(months=2)
    months = []
    for i in range(months_back):
        d = start - relativedelta(months=i)
        months.append(d.strftime("%Y-%m"))
    return months


def get_unique_sectors_with_coords(
    db: Session,
) -> Dict[str, Tuple[float, float]]:
    """Get unique postcode sectors and representative coordinates from properties.

    Uses the postcode_cache table for coordinates. Falls back to properties
    table lat/lng if available.

    Args:
        db: SQLAlchemy session.

    Returns:
        Dict mapping postcode sector → (lat, lng).
    """
    # Get unique postcodes from properties table
    postcodes = (
        db.query(Property.postcode)
        .filter(Property.postcode.isnot(None))
        .distinct()
        .all()
    )
    postcodes = [p[0] for p in postcodes]
    logger.info("Found %d unique postcodes in properties", len(postcodes))

    # Group by sector and find representative coords
    sector_coords: Dict[str, Tuple[float, float]] = {}
    sectors_needing_coords: Dict[str, List[str]] = {}

    for pc in postcodes:
        sector = _extract_postcode_sector(pc)
        if sector not in sectors_needing_coords:
            sectors_needing_coords[sector] = []
        sectors_needing_coords[sector].append(pc)

    logger.info("Grouped into %d unique sectors", len(sectors_needing_coords))

    # Try to get coords from postcode_cache for any postcode in each sector
    for sector, sector_postcodes in sectors_needing_coords.items():
        for pc in sector_postcodes:
            cached = (
                db.query(PostcodeCache)
                .filter(PostcodeCache.postcode == pc, PostcodeCache.is_valid == True)
                .first()
            )
            if cached:
                sector_coords[sector] = (cached.lat, cached.lng)
                break

    # For sectors without cached coords, try properties table
    for sector, sector_postcodes in sectors_needing_coords.items():
        if sector in sector_coords:
            continue
        for pc in sector_postcodes:
            prop = (
                db.query(Property)
                .filter(
                    Property.postcode == pc,
                    Property.lat.isnot(None),
                    Property.lng.isnot(None),
                )
                .first()
            )
            if prop:
                sector_coords[sector] = (prop.lat, prop.lng)
                break

    # For remaining sectors, geocode via Postcodes.io
    missing_sectors = set(sectors_needing_coords.keys()) - set(sector_coords.keys())
    if missing_sectors:
        logger.info("Geocoding %d sectors via Postcodes.io", len(missing_sectors))
        postcodes_to_geocode = []
        sector_to_pc = {}
        for sector in missing_sectors:
            pc = sectors_needing_coords[sector][0]
            postcodes_to_geocode.append(pc)
            sector_to_pc[pc] = sector

        # Batch geocode
        rate_limiter = RateLimiter(requests_per_second=50.0)
        for i in range(0, len(postcodes_to_geocode), POSTCODES_BATCH_SIZE):
            batch = postcodes_to_geocode[i : i + POSTCODES_BATCH_SIZE]
            rate_limiter.wait()
            try:
                response = api_call_with_retry(
                    POSTCODES_BATCH_URL,
                    method="POST",
                    json_body={"postcodes": batch},
                )
                for item in response.get("result", []):
                    query_pc = item.get("query", "")
                    result_data = item.get("result")
                    if result_data and query_pc in sector_to_pc:
                        lat = result_data.get("latitude")
                        lng = result_data.get("longitude")
                        if lat and lng:
                            sector = sector_to_pc[query_pc]
                            sector_coords[sector] = (lat, lng)

                            # Cache it
                            cache_stmt = insert(PostcodeCache).values(
                                postcode=query_pc,
                                lat=lat,
                                lng=lng,
                                ward=result_data.get("admin_ward", ""),
                                district=result_data.get("admin_district", ""),
                                is_valid=True,
                                cached_at=datetime.now(timezone.utc),
                            )
                            cache_stmt = cache_stmt.on_conflict_do_nothing()
                            db.execute(cache_stmt)
                db.commit()
            except Exception:
                logger.error("Batch geocode failed", exc_info=True)

    logger.info(
        "Resolved coordinates for %d / %d sectors",
        len(sector_coords),
        len(sectors_needing_coords),
    )
    return sector_coords


def fetch_crimes_for_location(
    lat: float,
    lng: float,
    months: List[str],
    rate_limiter: RateLimiter,
) -> List[Dict]:
    """Fetch crime data for a location across multiple months.

    Args:
        lat: Latitude.
        lng: Longitude.
        months: List of YYYY-MM strings.
        rate_limiter: Rate limiter instance.

    Returns:
        List of crime records with category and month.
    """
    crimes = []
    for month in months:
        rate_limiter.wait()
        try:
            url = f"{POLICE_API_BASE}/crimes-at-location"
            data = api_call_with_retry(
                url,
                params={"lat": lat, "lng": lng, "date": month},
            )
            if isinstance(data, list):
                for crime in data:
                    category = crime.get("category", "")
                    if category in TRACKED_CATEGORIES:
                        crimes.append(
                            {
                                "category": category,
                                "month": month,
                            }
                        )
        except Exception:
            logger.warning(
                "Failed to fetch crimes for lat=%.4f lng=%.4f month=%s",
                lat,
                lng,
                month,
                exc_info=True,
            )
    return crimes


def aggregate_crimes(
    all_crimes: Dict[str, List[Dict]],
) -> pd.DataFrame:
    """Aggregate crime counts by postcode sector, category, and month.

    Args:
        all_crimes: Dict mapping sector → list of crime records.

    Returns:
        DataFrame with columns: postcode_sector, category, month, count.
    """
    rows = []
    for sector, crimes in all_crimes.items():
        if not crimes:
            continue
        for crime in crimes:
            rows.append(
                {
                    "postcode_sector": sector,
                    "category": crime["category"],
                    "month": crime["month"],
                }
            )

    if not rows:
        return pd.DataFrame(columns=["postcode_sector", "category", "month", "count"])

    df = pd.DataFrame(rows)
    aggregated = (
        df.groupby(["postcode_sector", "category", "month"])
        .size()
        .reset_index(name="count")
    )
    return aggregated


def compute_safety_scores(
    aggregated: pd.DataFrame,
) -> Tuple[Dict[str, float], float]:
    """Compute safety scores per postcode sector.

    Formula from api-reference.md:
    1. Sum count × weight for all categories in a sector
    2. Divide by 95th percentile across all sectors (normalise)
    3. safety_score = max(0, 100 - (weighted_sum / normaliser * 100))
    4. Clamp to 0–100

    Args:
        aggregated: DataFrame with postcode_sector, category, month, count columns.

    Returns:
        Tuple of (scores dict, normaliser value).
        Scores dict maps postcode sector → safety score (0–100).
        Normaliser is the 95th-percentile weighted sum, persisted for use
        by score_service at request time.
    """
    if aggregated.empty:
        return {}, 1.0

    # Compute weighted sum per sector
    aggregated["weight"] = aggregated["category"].map(CATEGORY_WEIGHTS).fillna(1.0)
    aggregated["weighted_count"] = aggregated["count"] * aggregated["weight"]

    sector_sums = aggregated.groupby("postcode_sector")["weighted_count"].sum()

    # Normaliser = 95th percentile
    normaliser = sector_sums.quantile(0.95) if len(sector_sums) > 1 else sector_sums.max()
    if normaliser == 0:
        normaliser = 1.0

    scores = {}
    for sector, weighted_sum in sector_sums.items():
        score = max(0, min(100, 100 - (weighted_sum / normaliser * 100)))
        scores[sector] = round(score, 1)

    return scores, float(normaliser)


def upsert_crime_data(aggregated: pd.DataFrame, db: Session) -> int:
    """Bulk upsert aggregated crime data to the crime_data table.

    Uses PostgreSQL ON CONFLICT DO UPDATE on the composite unique constraint
    (postcode_sector, category, month) for atomic, race-condition-free upserts
    in batches of 1000.

    Args:
        aggregated: DataFrame with postcode_sector, category, month, count columns.
        db: SQLAlchemy session.

    Returns:
        Number of rows upserted.
    """
    import time

    if aggregated.empty:
        logger.info("No crime data to upsert")
        return 0

    now = datetime.now(timezone.utc)
    rows_upserted = 0
    batch_size = 1000
    start_time = time.time()

    # Pre-process: convert month strings to date objects
    records = []
    for _, row in aggregated.iterrows():
        month_date = datetime.strptime(row["month"], "%Y-%m").date()
        records.append({
            "postcode_sector": row["postcode_sector"],
            "category": row["category"],
            "month": month_date,
            "count": int(row["count"]),
            "updated_at": now,
        })

    # Bulk upsert in batches
    num_batches = 0
    for start in range(0, len(records), batch_size):
        batch = records[start : start + batch_size]

        stmt = insert(CrimeData).values(batch)
        stmt = stmt.on_conflict_do_update(
            constraint="uq_crime_sector_category_month",
            set_={
                "count": stmt.excluded.count,
                "updated_at": stmt.excluded.updated_at,
            },
        )
        db.execute(stmt)
        rows_upserted += len(batch)
        num_batches += 1

    db.commit()

    elapsed = time.time() - start_time
    logger.info(
        "Upserted %d crime records in %.1fs (%d batches of %d)",
        rows_upserted,
        elapsed,
        num_batches,
        batch_size,
    )
    return rows_upserted


def run_crime_pipeline(db: Optional[Session] = None) -> int:
    """Execute the full crime pipeline.

    Args:
        db: SQLAlchemy session. Creates one if not provided.

    Returns:
        Number of rows processed.
    """
    logger.info("Starting crime pipeline")

    own_session = db is None
    if own_session:
        db = SessionLocal()

    try:
        # Get sectors with coordinates
        sector_coords = get_unique_sectors_with_coords(db)
        if not sector_coords:
            logger.warning("No sectors with coordinates found — skipping crime pipeline")
            return 0

        # Generate month range
        months = _get_months_range(12)
        logger.info("Fetching crime data for %d months: %s to %s", len(months), months[-1], months[0])

        # Fetch crimes for each sector
        rate_limiter = RateLimiter(requests_per_second=12.0)  # Police API: ~12 req/sec
        all_crimes: Dict[str, List[Dict]] = {}

        for i, (sector, (lat, lng)) in enumerate(sector_coords.items()):
            logger.info(
                "Fetching crimes for sector %s (%d/%d)",
                sector,
                i + 1,
                len(sector_coords),
            )
            crimes = fetch_crimes_for_location(lat, lng, months, rate_limiter)
            all_crimes[sector] = crimes

        # Aggregate
        aggregated = aggregate_crimes(all_crimes)
        logger.info("Aggregated %d crime data rows", len(aggregated))

        # Compute safety scores
        scores, normaliser = compute_safety_scores(aggregated)
        logger.info("Computed safety scores for %d sectors (normaliser=%.2f)", len(scores), normaliser)

        # Persist the 95th-percentile normaliser to pipeline_config so
        # score_service can read it at request time instead of re-scanning.
        config_stmt = insert(PipelineConfig).values(
            key="safety_normaliser_p95",
            value=normaliser,
            description="95th-percentile weighted crime sum across all sectors. "
                        "Used by score_service.get_safety_score() to normalise "
                        "per-sector scores without a full-table scan.",
            updated_at=datetime.now(timezone.utc),
            source="crime_pipeline",
        )
        config_stmt = config_stmt.on_conflict_do_update(
            index_elements=["key"],
            set_={
                "value": config_stmt.excluded.value,
                "updated_at": config_stmt.excluded.updated_at,
                "source": config_stmt.excluded.source,
            },
        )
        db.execute(config_stmt)
        db.commit()
        logger.info("Persisted safety_normaliser_p95=%.2f to pipeline_config", normaliser)

        # Log sample scores
        for sector in sorted(scores.keys()):
            if sector.startswith("GU1 ") or sector.startswith("GU2 ") or sector.startswith("GU3 "):
                logger.info("Safety score %s: %.1f", sector, scores[sector])

        # Upsert to DB
        rows = upsert_crime_data(aggregated, db)
        logger.info("Crime pipeline complete: %d rows upserted", rows)
        return rows

    finally:
        if own_session:
            db.close()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    run_pipeline_with_tracking("crime_pipeline", run_crime_pipeline)
