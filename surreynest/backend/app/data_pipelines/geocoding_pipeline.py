"""Geocoding pipeline: backfill lat/lng for properties with NULL coordinates.

Standalone pipeline that queries the properties table for rows missing
lat/lng, batch-geocodes their postcodes via Postcodes.io, and bulk-updates
the properties table. Fully idempotent, re-running skips already-geocoded
properties.

Usage:
    python -m app.data_pipelines.geocoding_pipeline
"""

import logging
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.data_pipelines.utils import run_pipeline_with_tracking
from app.services.geocoding_service import geocode_batch

logger = logging.getLogger(__name__)


def run_geocoding_pipeline(db: Optional[Session] = None) -> int:
    """Backfill lat/lng for properties with NULL coordinates.

    Steps:
        1. Query distinct postcodes where properties lack lat/lng.
        2. Batch-geocode via Postcodes.io (uses postcode_cache).
        3. Bulk UPDATE properties SET lat=?, lng=? WHERE postcode=?.
        4. Log summary: geocoded, updated, failed counts.

    Args:
        db: SQLAlchemy session. Creates one if not provided.

    Returns:
        Number of properties updated with coordinates.
    """
    logger.info("Starting geocoding pipeline, backfilling NULL lat/lng")

    own_session = db is None
    if own_session:
        db = SessionLocal()

    try:
        # ── Step 1: count current state ──────────────────────────────────
        total_props = db.execute(
            text("SELECT COUNT(*) FROM properties")
        ).scalar()
        null_count_before = db.execute(
            text("SELECT COUNT(*) FROM properties WHERE lat IS NULL OR lng IS NULL")
        ).scalar()

        logger.info(
            "Properties: %d total, %d missing lat/lng (%.1f%%)",
            total_props,
            null_count_before,
            100 * null_count_before / total_props if total_props > 0 else 0,
        )

        if null_count_before == 0:
            logger.info("All properties already have coordinates, nothing to do")
            return 0

        # ── Step 2: get unique postcodes needing geocoding ───────────────
        rows = db.execute(
            text(
                "SELECT DISTINCT postcode FROM properties "
                "WHERE (lat IS NULL OR lng IS NULL) AND postcode IS NOT NULL"
            )
        ).fetchall()

        postcodes_to_geocode = [row[0] for row in rows]
        logger.info(
            "Found %d unique postcodes to geocode (%d properties affected)",
            len(postcodes_to_geocode),
            null_count_before,
        )

        # ── Step 3: batch geocode ────────────────────────────────────────
        geocode_map = geocode_batch(postcodes_to_geocode, db)

        # Count results
        successful = {pc: coords for pc, coords in geocode_map.items() if coords[0] is not None}
        failed = {pc: coords for pc, coords in geocode_map.items() if coords[0] is None}

        logger.info(
            "Geocoding results: %d/%d postcodes resolved, %d failed",
            len(successful),
            len(postcodes_to_geocode),
            len(failed),
        )

        if failed:
            failed_list = list(failed.keys())[:10]  # Show first 10
            logger.warning(
                "Failed postcodes (showing up to 10): %s",
                ", ".join(failed_list),
            )

        # ── Step 4: bulk update properties ───────────────────────────────
        properties_updated = 0

        for postcode, (lat, lng) in successful.items():
            result = db.execute(
                text(
                    "UPDATE properties SET lat = :lat, lng = :lng "
                    "WHERE postcode = :postcode AND (lat IS NULL OR lng IS NULL)"
                ),
                {"lat": lat, "lng": lng, "postcode": postcode},
            )
            properties_updated += result.rowcount

        db.commit()

        # ── Step 5: verify and log summary ───────────────────────────────
        null_count_after = db.execute(
            text("SELECT COUNT(*) FROM properties WHERE lat IS NULL OR lng IS NULL")
        ).scalar()

        logger.info(
            "Geocoding pipeline complete:\n"
            "  Postcodes: %d geocoded, %d failed\n"
            "  Properties: %d updated, %d still missing coords\n"
            "  Before: %d missing → After: %d missing",
            len(successful),
            len(failed),
            properties_updated,
            null_count_after,
            null_count_before,
            null_count_after,
        )

        return properties_updated

    except Exception:
        db.rollback()
        raise
    finally:
        if own_session:
            db.close()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    run_pipeline_with_tracking("geocoding_pipeline", run_geocoding_pipeline)
