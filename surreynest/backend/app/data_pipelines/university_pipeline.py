"""University accommodation seeder pipeline.

Identifies University of Surrey accommodation properties in the database,
sets is_university=True for all matched properties, and seeds
actual_market_rent_weekly with bills-adjusted private-market equivalent rents
for properties that currently have NULL market rent.

Bills adjustment: university rents are bills-inclusive (electricity, water,
internet). Private market equivalent = university_rent + £30/week bills allowance.

Run: docker exec surreynest-backend python -m app.data_pipelines.university_pipeline
"""

import logging
from datetime import datetime, timezone
from typing import Dict

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.property import Property

logger = logging.getLogger(__name__)

# ── Known University of Surrey accommodation postcodes ────────────────────────
# Source: official University of Surrey room booking pages (2025/26 academic year)
# bills_incl_min / bills_incl_max: weekly rent range, ALL bills included
UNIVERSITY_POSTCODES: Dict[str, Dict] = {
    "GU2 7JG": {"band": "C1/C2", "bills_incl_min": 137.50, "bills_incl_max": 147.50},
    "GU2 7JQ": {"band": "C2",   "bills_incl_min": 147.50, "bills_incl_max": 147.50},
    "GU2 7JH": {"band": "C1",   "bills_incl_min": 137.50, "bills_incl_max": 147.50},
    "GU2 7JW": {"band": "C2",   "bills_incl_min": 147.50, "bills_incl_max": 147.50},
    "GU2 7JP": {"band": "D3",   "bills_incl_min": 147.50, "bills_incl_max": 217.00},
    "GU2 7JN": {"band": "D2/D3", "bills_incl_min": 208.50, "bills_incl_max": 217.00},
    "GU2 7XR": {"band": "D2",   "bills_incl_min": 208.50, "bills_incl_max": 208.50},
    "GU2 7JL": {"band": "E",    "bills_incl_min": 242.00, "bills_incl_max": 247.00},
    "GU2 7YW": {"band": "D3/E/F","bills_incl_min": 200.00, "bills_incl_max": 394.00},
}

# Conservative bills allowance per week (electricity + water + broadband)
BILLS_WEEKLY_ALLOWANCE = 30.0


def _bills_adjusted_midpoint(postcode_data: Dict) -> float:
    """Compute private-market equivalent rent from bills-inclusive range.

    Takes the midpoint of the bills-inclusive range and adds the bills
    allowance to get a private-market equivalent for ML training.

    Args:
        postcode_data: Dict with bills_incl_min and bills_incl_max keys.

    Returns:
        Private-market equivalent weekly rent in £.
    """
    midpoint = (postcode_data["bills_incl_min"] + postcode_data["bills_incl_max"]) / 2.0
    return round(midpoint + BILLS_WEEKLY_ALLOWANCE, 2)


def run_university_pipeline(db: Session) -> Dict:
    """Flag university properties and seed bills-adjusted rents.

    For each property at a known university postcode:
    1. Sets is_university = True and is_university_managed = True
    2. Seeds actual_market_rent_weekly with the bills-adjusted private-market
       equivalent ONLY if the current value is NULL

    Args:
        db: SQLAlchemy session.

    Returns:
        Summary dict with flagged_count, rent_seeded_count, postcodes_found.
    """
    university_postcodes = set(UNIVERSITY_POSTCODES.keys())
    flagged_count = 0
    rent_seeded_count = 0
    postcodes_found = set()

    logger.info(
        "University pipeline: scanning %d known postcodes", len(university_postcodes)
    )

    for postcode, rent_data in UNIVERSITY_POSTCODES.items():
        props = (
            db.query(Property)
            .filter(Property.postcode == postcode)
            .all()
        )

        if not props:
            logger.debug("No properties found at university postcode %s", postcode)
            continue

        postcodes_found.add(postcode)
        adjusted_rent = _bills_adjusted_midpoint(rent_data)

        for prop in props:
            updated = False

            # Flag as university-managed
            if not prop.is_university:
                prop.is_university = True
                updated = True
            if not prop.is_university_managed:
                prop.is_university_managed = True
                updated = True

            if updated:
                flagged_count += 1

            # Seed rent ONLY if currently NULL (don't overwrite scraped data)
            if prop.actual_market_rent_weekly is None:
                prop.actual_market_rent_weekly = adjusted_rent
                prop.updated_at = datetime.now(timezone.utc)
                rent_seeded_count += 1
                logger.debug(
                    "Seeded rent £%.2f/wk for UPRN %s (%s, band %s)",
                    adjusted_rent,
                    prop.uprn,
                    postcode,
                    rent_data["band"],
                )

        logger.info(
            "Postcode %s: flagged %d properties, private-market equiv £%.2f/wk (band %s)",
            postcode,
            len(props),
            adjusted_rent,
            rent_data["band"],
        )

    db.commit()

    summary = {
        "flagged_count": flagged_count,
        "rent_seeded_count": rent_seeded_count,
        "postcodes_found": sorted(postcodes_found),
        "postcodes_searched": len(university_postcodes),
    }

    logger.info(
        "University pipeline complete: %d properties flagged, %d rents seeded, "
        "%d/%d postcodes matched",
        flagged_count,
        rent_seeded_count,
        len(postcodes_found),
        len(university_postcodes),
    )

    return summary


def main() -> None:
    """Entry point for standalone execution."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )

    db = SessionLocal()
    try:
        summary = run_university_pipeline(db)
        logger.info("Summary: %s", summary)
    finally:
        db.close()


if __name__ == "__main__":
    main()
