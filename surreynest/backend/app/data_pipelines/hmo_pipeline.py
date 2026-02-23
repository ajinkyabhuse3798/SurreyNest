"""HMO pipeline: parse Guildford HMO register and upsert to hmo_records table.

The HMO register file is an HTML table saved with a .xls extension.
Reads via pd.read_html(), extracts postcodes, flags expired licences,
geocodes via Postcodes.io batch API, and upserts to the hmo_records table.
"""

import logging
import re
from datetime import datetime, date, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.data_pipelines.utils import (
    RateLimiter,
    api_call_with_retry,
    run_pipeline_with_tracking,
)
from app.models.hmo_record import HmoRecord
from app.models.postcode_cache import PostcodeCache

logger = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────────────────
RAW_PATH = Path(__file__).resolve().parents[2] / "data" / "raw" / "hmo_register_raw.xls"

# ── Postcode regex for GU area ───────────────────────────────────────────────
POSTCODE_REGEX = re.compile(r"GU\d{1,2}\s?\d[A-Z]{2}", re.IGNORECASE)

# ── Postcodes.io batch endpoint ──────────────────────────────────────────────
POSTCODES_BATCH_URL = "https://api.postcodes.io/postcodes"
POSTCODES_BATCH_SIZE = 100


def _normalise_postcode(pc: str) -> str:
    """Normalise postcode to uppercase with single space.

    Args:
        pc: Raw postcode string.

    Returns:
        Normalised postcode, e.g. "GU2 7XH".
    """
    pc = str(pc).strip().upper()
    pc = re.sub(r"\s+", "", pc)
    if len(pc) >= 4:
        return pc[:-3] + " " + pc[-3:]
    return pc


def _extract_postcode(address: str) -> Optional[str]:
    """Extract GU-area postcode from an address string.

    Args:
        address: Full address string from HMO register.

    Returns:
        Normalised postcode or None if not found.
    """
    match = POSTCODE_REGEX.search(str(address))
    if match:
        return _normalise_postcode(match.group())
    return None


def _parse_date(date_str: str) -> Optional[date]:
    """Parse date from various formats in the HMO register.

    Args:
        date_str: Date string, e.g. "22-02-2029" or "2029-02-22".

    Returns:
        date object or None.
    """
    if pd.isna(date_str) or str(date_str).strip() == "":
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(str(date_str).strip(), fmt).date()
        except ValueError:
            continue
    logger.warning("Could not parse date: %s", date_str)
    return None


def geocode_postcodes_batch(
    postcodes: List[str],
    db: Session,
) -> Dict[str, Tuple[Optional[float], Optional[float]]]:
    """Geocode postcodes via Postcodes.io batch API with DB cache.

    Args:
        postcodes: List of normalised postcodes to geocode.
        db: SQLAlchemy session for cache reads/writes.

    Returns:
        Dict mapping postcode → (lat, lng). Missing postcodes get (None, None).
    """
    results: Dict[str, Tuple[Optional[float], Optional[float]]] = {}
    uncached: List[str] = []

    # ── Check cache first (per conventions.md: always check cache) ────────
    for pc in postcodes:
        cached = db.query(PostcodeCache).filter(PostcodeCache.postcode == pc).first()
        if cached:
            if cached.is_valid:
                results[pc] = (cached.lat, cached.lng)
            else:
                results[pc] = (None, None)
        else:
            uncached.append(pc)

    if not uncached:
        return results

    logger.info("Geocoding %d uncached postcodes via Postcodes.io", len(uncached))
    rate_limiter = RateLimiter(requests_per_second=50.0)

    # ── Batch API calls ──────────────────────────────────────────────────
    for i in range(0, len(uncached), POSTCODES_BATCH_SIZE):
        batch = uncached[i : i + POSTCODES_BATCH_SIZE]
        rate_limiter.wait()

        try:
            response = api_call_with_retry(
                POSTCODES_BATCH_URL,
                method="POST",
                json_body={"postcodes": batch},
            )
        except Exception:
            logger.error("Batch geocode failed for batch starting at %d", i)
            for pc in batch:
                results[pc] = (None, None)
            continue

        for item in response.get("result", []):
            query_pc = item.get("query", "")
            normalised_pc = _normalise_postcode(query_pc)
            result_data = item.get("result")

            if result_data:
                lat = result_data.get("latitude")
                lng = result_data.get("longitude")
                ward = result_data.get("admin_ward", "")
                district = result_data.get("admin_district", "")
                results[normalised_pc] = (lat, lng)

                # Cache the result
                cache_stmt = insert(PostcodeCache).values(
                    postcode=normalised_pc,
                    lat=lat or 0.0,
                    lng=lng or 0.0,
                    ward=ward,
                    district=district,
                    is_valid=True,
                    cached_at=datetime.now(timezone.utc),
                )
                cache_stmt = cache_stmt.on_conflict_do_update(
                    index_elements=["postcode"],
                    set_={
                        "lat": cache_stmt.excluded.lat,
                        "lng": cache_stmt.excluded.lng,
                        "ward": cache_stmt.excluded.ward,
                        "district": cache_stmt.excluded.district,
                        "cached_at": datetime.now(timezone.utc),
                    },
                )
                db.execute(cache_stmt)
            else:
                results[normalised_pc] = (None, None)
                # Cache as invalid so we don't retry
                cache_stmt = insert(PostcodeCache).values(
                    postcode=normalised_pc,
                    lat=0.0,
                    lng=0.0,
                    is_valid=False,
                    cached_at=datetime.now(timezone.utc),
                )
                cache_stmt = cache_stmt.on_conflict_do_nothing()
                db.execute(cache_stmt)

        db.commit()

    return results


def load_hmo_register(raw_path: Optional[Path] = None) -> pd.DataFrame:
    """Load and clean the HMO register from HTML-format XLS.

    Args:
        raw_path: Path to the raw .xls file. Defaults to project path.

    Returns:
        Cleaned DataFrame with standardised columns.
    """
    path = raw_path or RAW_PATH
    logger.info("Loading HMO register from %s", path)

    # File is HTML table disguised as .xls — use read_html
    dfs = pd.read_html(str(path))
    if not dfs:
        raise ValueError(f"No tables found in {path}")

    df = dfs[0]
    logger.info("Loaded %d raw HMO records", len(df))

    # ── Remove exact duplicates ──────────────────────────────────────────
    df = df.drop_duplicates()
    logger.info("After dedup: %d rows", len(df))

    # ── Extract postcodes from address ───────────────────────────────────
    df["postcode"] = df["Premises address"].apply(_extract_postcode)

    # ── Parse dates ──────────────────────────────────────────────────────
    df["expiry_date_parsed"] = df["Expiry date"].apply(_parse_date)
    df["issue_date_parsed"] = df["Issue date"].apply(_parse_date)

    # ── Compute is_active ────────────────────────────────────────────────
    today = date.today()
    df["is_active"] = df["expiry_date_parsed"].apply(
        lambda d: d > today if d else False
    )

    # ── Parse max occupants ──────────────────────────────────────────────
    df["max_occupants_parsed"] = pd.to_numeric(
        df["Maximum number of occupants"], errors="coerce"
    )

    return df


def upsert_to_db(df: pd.DataFrame, geocode_map: Dict, db: Session) -> int:
    """Upsert HMO records into the database.

    Args:
        df: Cleaned HMO DataFrame.
        geocode_map: Dict mapping postcode → (lat, lng).
        db: SQLAlchemy session.

    Returns:
        Number of rows upserted.
    """
    now = datetime.now(timezone.utc)
    rows_upserted = 0

    # Clear existing HMO records and re-insert (simpler than complex upsert
    # since HMO register doesn't have a stable unique key like UPRN)
    db.query(HmoRecord).delete()
    db.commit()

    records = []
    for _, row in df.iterrows():
        pc = row.get("postcode")
        lat, lng = geocode_map.get(pc, (None, None)) if pc else (None, None)

        records.append(
            HmoRecord(
                raw_address=str(row.get("Premises address", "")),
                postcode=pc,
                lat=lat,
                lng=lng,
                licence_number=str(row.get("Licence number", "")) if pd.notna(row.get("Licence number")) else None,
                max_occupants=int(row["max_occupants_parsed"]) if pd.notna(row.get("max_occupants_parsed")) else None,
                licence_holder=str(row.get("Licensee", "")) if pd.notna(row.get("Licensee")) else None,
                expiry_date=row.get("expiry_date_parsed"),
                is_active=bool(row.get("is_active", False)),
                last_updated=now,
            )
        )

    db.add_all(records)
    db.commit()
    rows_upserted = len(records)
    logger.info("Inserted %d HMO records", rows_upserted)
    return rows_upserted


def run_hmo_pipeline(db: Optional[Session] = None) -> int:
    """Execute the full HMO pipeline: load → geocode → upsert.

    Args:
        db: SQLAlchemy session. Creates one if not provided.

    Returns:
        Number of rows processed.
    """
    logger.info("Starting HMO pipeline")

    # Load and clean
    df = load_hmo_register()

    # Get unique postcodes for geocoding
    unique_postcodes = df["postcode"].dropna().unique().tolist()
    logger.info("Found %d unique postcodes to geocode", len(unique_postcodes))

    own_session = db is None
    if own_session:
        db = SessionLocal()
    try:
        # Geocode
        geocode_map = geocode_postcodes_batch(unique_postcodes, db)

        # Upsert
        rows = upsert_to_db(df, geocode_map, db)
        logger.info("HMO pipeline complete: %d rows", rows)
        return rows
    finally:
        if own_session:
            db.close()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    run_pipeline_with_tracking("hmo_pipeline", run_hmo_pipeline)
