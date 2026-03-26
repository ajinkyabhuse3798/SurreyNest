"""EPC pipeline: clean EPC bulk data and upsert to properties table.

Reads from backend/data/raw/certificates.csv (Guildford EPC bulk download).
Cleaning steps: filter rental tenure, post-2018 dates, GU postcodes;
normalise property types and postcodes; deduplicate on UPRN.
Saves cleaned CSV to data/processed/epc_clean.csv and upserts to properties table.
"""

import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import pandas as pd
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.data_pipelines.utils import run_pipeline_with_tracking
from app.models.property import Property
from app.services.geocoding_service import geocode_batch

logger = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────────────────
RAW_PATH = Path(__file__).resolve().parents[2] / "data" / "raw" / "certificates.csv"
PROCESSED_PATH = Path(__file__).resolve().parents[2] / "data" / "processed" / "epc_clean.csv"

# ── Property type normalisation mapping ──────────────────────────────────────
PROPERTY_TYPE_MAP = {
    "flat": "Flat",
    "maisonette": "Flat",
    "house": "Other", # further classified by built_form below
    "bungalow": "Other",
    "park home": "Other",
}

# Built-form to property_type mapping (for House type)
BUILT_FORM_TO_TYPE = {
    "detached": "Detached",
    "semi-detached": "Semi-Detached",
    "mid-terrace": "Terraced",
    "end-terrace": "Terraced",
    "enclosed end-terrace": "Terraced",
    "enclosed mid-terrace": "Terraced",
    "terraced": "Terraced",
}

# ── Columns we keep from the raw CSV ────────────────────────────────────────
KEEP_COLUMNS = [
    "UPRN",
    "ADDRESS1",
    "ADDRESS2",
    "ADDRESS3",
    "POSTCODE",
    "PROPERTY_TYPE",
    "BUILT_FORM",
    "TOTAL_FLOOR_AREA",
    "NUMBER_HABITABLE_ROOMS",
    "CURRENT_ENERGY_RATING",
    "POTENTIAL_ENERGY_RATING",
    "LODGEMENT_DATE",
    "TENURE",
    # ── v3.3.0: new ML features ──────────────────────────────────────────
    "CONSTRUCTION_AGE_BAND",
    "MAINS_GAS_FLAG",
    "FLOOR_LEVEL",
    "HEATING_COST_CURRENT",
    "HOT_WATER_COST_CURRENT",
    "LIGHTING_COST_CURRENT",
]

# ── Construction age band → ordinal encoding ─────────────────────────────────
# Newer buildings command higher rents (modern kitchens, insulation, en-suites).
# Mapping covers all ONS EPC age bands.
AGE_BAND_ORDINAL = {
    "england and wales: before 1900": 0,
    "before 1900": 0,
    "england and wales: 1900-1929": 1,
    "1900-1929": 1,
    "england and wales: 1930-1949": 2,
    "1930-1949": 2,
    "england and wales: 1950-1966": 3,
    "1950-1966": 3,
    "england and wales: 1967-1975": 4,
    "1967-1975": 4,
    "england and wales: 1976-1982": 5,
    "1976-1982": 5,
    "england and wales: 1983-1990": 6,
    "1983-1990": 6,
    "england and wales: 1991-1995": 7,
    "1991-1995": 7,
    "england and wales: 1996-2002": 8,
    "1996-2002": 8,
    "england and wales: 2003-2006": 9,
    "2003-2006": 9,
    "england and wales: 2007-2011": 10,
    "2007-2011": 10,
    "england and wales: 2012 onwards": 11,
    "2012 onwards": 11,
}

# ── Floor level text → ordinal ───────────────────────────────────────────────
FLOOR_LEVEL_MAP = {
    "ground": 0, "basement": -1, "0": 0,
    "1": 1, "1st": 1, "2": 2, "2nd": 2,
    "3": 3, "3rd": 3, "4": 4, "4th": 4,
    "5": 5, "5th": 5, "6": 6, "7": 7,
    "8": 8, "9": 9, "10": 10,
}


def _normalise_postcode(pc: str) -> str:
    """Normalise postcode to uppercase with single space.

    Args:
        pc: Raw postcode string.

    Returns:
        Normalised postcode, e.g. "GU2 7XH".
    """
    pc = str(pc).strip().upper()
    # Remove all spaces and re-insert the standard single space
    pc = re.sub(r"\s+", "", pc)
    if len(pc) >= 4:
        return pc[:-3] + " " + pc[-3:]
    return pc


def _normalise_property_type(row: pd.Series) -> str:
    """Map raw EPC property type + built form to our 5-category system.

    Args:
        row: DataFrame row with PROPERTY_TYPE and BUILT_FORM columns.

    Returns:
        One of: Flat, Terraced, Semi-Detached, Detached, Other.
    """
    raw_type = str(row.get("PROPERTY_TYPE", "")).strip().lower()
    raw_form = str(row.get("BUILT_FORM", "")).strip().lower()

    # Direct mapping for non-house types
    mapped = PROPERTY_TYPE_MAP.get(raw_type)
    if mapped and mapped != "Other":
        return mapped

    # For houses/bungalows, use built form
    form_mapped = BUILT_FORM_TO_TYPE.get(raw_form)
    if form_mapped:
        return form_mapped

    return "Other"


def clean_epc_data(raw_path: Optional[Path] = None) -> pd.DataFrame:
    """Load and clean EPC certificates CSV.

    Args:
        raw_path: Path to raw certificates.csv. Defaults to project path.

    Returns:
        Cleaned DataFrame ready for DB upsert.
    """
    path = raw_path or RAW_PATH
    logger.info("Loading EPC data from %s", path)

    df = pd.read_csv(str(path), low_memory=False, usecols=KEEP_COLUMNS)
    initial_count = len(df)
    logger.info("Loaded %d raw EPC records", initial_count)

    # ── Filter: UPRN must exist ──────────────────────────────────────────
    df = df.dropna(subset=["UPRN"])
    df["UPRN"] = df["UPRN"].astype(str).str.strip().str.replace(r"\.0$", "", regex=True)
    df = df[df["UPRN"].str.len() > 0]
    logger.info("After UPRN filter: %d rows", len(df))

    # ── Clean + normalise tenure ────────────────────────────────────────
    df["TENURE"] = df["TENURE"].fillna("").str.lower().str.strip()
    # Normalise duplicate labels: "rented (private)" → "rental (private)"
    TENURE_NORMALISATION = {
        "rented (private)": "rental (private)",
        "rented (social)": "rental (social)",
    }
    df["TENURE"] = df["TENURE"].replace(TENURE_NORMALISATION)
    logger.info("Tenure cleaned + normalised: %d rows (all tenure types kept)", len(df))

    # ── Filter: post-2018 lodgement date ─────────────────────────────────
    df["LODGEMENT_DATE"] = pd.to_datetime(df["LODGEMENT_DATE"], errors="coerce")
    df = df[df["LODGEMENT_DATE"] >= "2018-01-01"]
    logger.info("After post-2018 filter: %d rows", len(df))

    # ── Filter: GU postcodes only ────────────────────────────────────────
    df["POSTCODE"] = df["POSTCODE"].fillna("").astype(str)
    df = df[df["POSTCODE"].str.upper().str.startswith("GU")]
    logger.info("After GU postcode filter: %d rows", len(df))

    # ── Filter: allowed postcode districts (Guildford core + Godalming) ──
    # Extract the outward code (part before the space, e.g. "GU1" from "GU1 5QS")
    ALLOWED_DISTRICTS = ["GU1", "GU2", "GU3", "GU4", "GU5", "GU7"]
    df["_pc_district"] = (
        df["POSTCODE"]
        .str.upper()
        .str.strip()
        .str.split(r"\s+", n=1)  # split on first whitespace
        .str[0]                   # outward code: "GU1", "GU12", "GU24", etc.
    )
    pre_filter = len(df)
    df = df[df["_pc_district"].isin(ALLOWED_DISTRICTS)]
    df = df.drop(columns=["_pc_district"])
    logger.info(
        "After postcode prefix filter (GU1-GU5, GU7): %d rows (dropped %d non-core)",
        len(df),
        pre_filter - len(df),
    )

    # ── Normalise postcode ───────────────────────────────────────────────
    df["POSTCODE"] = df["POSTCODE"].apply(_normalise_postcode)

    # ── Normalise property type ──────────────────────────────────────────
    df["PROPERTY_TYPE_NORM"] = df.apply(_normalise_property_type, axis=1)

    # ── Build address ────────────────────────────────────────────────────
    addr_cols = ["ADDRESS1", "ADDRESS2", "ADDRESS3"]
    for col in addr_cols:
        df[col] = df[col].fillna("").astype(str).str.strip()
    df["ADDRESS_FULL"] = df[addr_cols].apply(
        lambda row: ", ".join(part for part in row if part), axis=1
    )

    # ── Numeric cleaning ─────────────────────────────────────────────────
    df["TOTAL_FLOOR_AREA"] = pd.to_numeric(df["TOTAL_FLOOR_AREA"], errors="coerce")
    df["NUMBER_HABITABLE_ROOMS"] = pd.to_numeric(
        df["NUMBER_HABITABLE_ROOMS"], errors="coerce"
    )

    # ── Remove floor area outliers (< 10 m² = data errors) ───────────────
    FLOOR_AREA_MIN = 10
    tiny_count = (df["TOTAL_FLOOR_AREA"] < FLOOR_AREA_MIN).sum()
    df = df[df["TOTAL_FLOOR_AREA"].isna() | (df["TOTAL_FLOOR_AREA"] >= FLOOR_AREA_MIN)]
    logger.info("Removed %d rows with floor area < %d m²", tiny_count, FLOOR_AREA_MIN)

    # ── Cap floor area at 300 m² (outlier correction) ────────────────────
    FLOOR_AREA_CAP = 300
    capped_count = (df["TOTAL_FLOOR_AREA"] > FLOOR_AREA_CAP).sum()
    df["TOTAL_FLOOR_AREA"] = df["TOTAL_FLOOR_AREA"].clip(upper=FLOOR_AREA_CAP)
    logger.info(
        "Capped floor area at %d m²: %d rows affected", FLOOR_AREA_CAP, capped_count
    )

    # ── Remove room count outliers (> 15 = likely commercial) ────────────
    ROOMS_MAX = 15
    big_rooms_count = (df["NUMBER_HABITABLE_ROOMS"] > ROOMS_MAX).sum()
    df = df[df["NUMBER_HABITABLE_ROOMS"].isna() | (df["NUMBER_HABITABLE_ROOMS"] <= ROOMS_MAX)]
    logger.info("Removed %d rows with rooms > %d (likely commercial)", big_rooms_count, ROOMS_MAX)

    # ── Deduplicate on UPRN (keep most recent by lodgement date) ─────────
    df = df.sort_values("LODGEMENT_DATE", ascending=False)
    df = df.drop_duplicates(subset=["UPRN"], keep="first")
    logger.info("After dedup on UPRN: %d rows", len(df))

    # ── Clean new ML feature columns (v3.3.0) ────────────────────────────
    # Construction age band → raw string (ordinal encoding done in features.py)
    df["CONSTRUCTION_AGE_BAND"] = (
        df["CONSTRUCTION_AGE_BAND"].fillna("").astype(str).str.strip().str.lower()
    )

    # Mains gas flag → integer 1/0
    df["_mains_gas"] = (
        df["MAINS_GAS_FLAG"].fillna("").astype(str).str.strip().str.upper()
    )
    df["_mains_gas_int"] = df["_mains_gas"].map({"Y": 1, "N": 0})

    # Floor level → integer ordinal
    df["_floor_level_raw"] = (
        df["FLOOR_LEVEL"].fillna("").astype(str).str.strip().str.lower()
    )
    df["_floor_level_int"] = df["_floor_level_raw"].map(FLOOR_LEVEL_MAP)

    # Annual energy cost = heating + hot water + lighting (£/year from EPC)
    for cost_col in ["HEATING_COST_CURRENT", "HOT_WATER_COST_CURRENT", "LIGHTING_COST_CURRENT"]:
        df[cost_col] = pd.to_numeric(df[cost_col], errors="coerce")
    df["_annual_energy_cost"] = (
        df["HEATING_COST_CURRENT"].fillna(0)
        + df["HOT_WATER_COST_CURRENT"].fillna(0)
        + df["LIGHTING_COST_CURRENT"].fillna(0)
    )
    # Only keep if at least heating cost was present (not all-zero)
    df.loc[df["HEATING_COST_CURRENT"].isna(), "_annual_energy_cost"] = None

    logger.info(
        "New features: age_band coverage=%.1f%%, mains_gas coverage=%.1f%%, "
        "floor_level coverage=%.1f%%, energy_cost coverage=%.1f%%",
        df["CONSTRUCTION_AGE_BAND"].ne("").mean() * 100,
        df["_mains_gas_int"].notna().mean() * 100,
        df["_floor_level_int"].notna().mean() * 100,
        df["_annual_energy_cost"].notna().mean() * 100,
    )

    # ── Build final output DataFrame ─────────────────────────────────────
    result = pd.DataFrame(
        {
            "uprn": df["UPRN"],
            "address": df["ADDRESS_FULL"],
            "postcode": df["POSTCODE"],
            "property_type": df["PROPERTY_TYPE_NORM"],
            "built_form": df["BUILT_FORM"].fillna("").str.strip(),
            "floor_area_m2": df["TOTAL_FLOOR_AREA"],
            "num_rooms": df["NUMBER_HABITABLE_ROOMS"],
            "energy_rating": df["CURRENT_ENERGY_RATING"].fillna("").str.strip().str.upper(),
            "potential_rating": df["POTENTIAL_ENERGY_RATING"].fillna("").str.strip().str.upper(),
            "epc_date": df["LODGEMENT_DATE"].dt.date,
            "tenure": df["TENURE"].str[:100],
            # ── v3.3.0 new columns ───────────────────────────────────────
            "construction_age_band": df["CONSTRUCTION_AGE_BAND"].replace("", None),
            "mains_gas_flag": df["_mains_gas_int"],
            "floor_level": df["_floor_level_int"],
            "annual_energy_cost": df["_annual_energy_cost"],
        }
    )

    # Drop rows with empty energy_rating
    result["energy_rating"] = result["energy_rating"].replace("", None)
    result["potential_rating"] = result["potential_rating"].replace("", None)
    result["built_form"] = result["built_form"].replace("", None)

    return result


def save_clean_csv(df: pd.DataFrame, output_path: Optional[Path] = None) -> None:
    """Save cleaned EPC data to processed CSV.

    Args:
        df: Cleaned DataFrame.
        output_path: Destination path. Defaults to project path.
    """
    path = output_path or PROCESSED_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(str(path), index=False)
    logger.info("Saved %d rows to %s", len(df), path)


def upsert_to_db(df: pd.DataFrame, db: Session) -> int:
    """Upsert cleaned EPC data into the properties table.

    Uses PostgreSQL ON CONFLICT DO UPDATE pattern per conventions.md.
    DataFrame must have lat/lng columns populated from geocoding.

    Args:
        df: Cleaned DataFrame with columns matching Property model,
            including lat and lng from geocoding.
        db: SQLAlchemy session.

    Returns:
        Number of rows upserted.
    """
    now = datetime.now(timezone.utc)
    rows_upserted = 0
    batch_size = 500

    for start in range(0, len(df), batch_size):
        batch = df.iloc[start : start + batch_size]
        records = batch.to_dict("records")

        for record in records:
            record["created_at"] = now
            record["updated_at"] = now
            # Convert pandas NaN to Python None for DB compatibility
            for key, val in record.items():
                if pd.isna(val):
                    record[key] = None
            # Ensure num_rooms is int, not float
            if record.get("num_rooms") is not None:
                record["num_rooms"] = int(record["num_rooms"])

        stmt = insert(Property).values(records)
        stmt = stmt.on_conflict_do_update(
            index_elements=["uprn"],
            set_={
                "address": stmt.excluded.address,
                "postcode": stmt.excluded.postcode,
                "lat": stmt.excluded.lat,
                "lng": stmt.excluded.lng,
                "property_type": stmt.excluded.property_type,
                "built_form": stmt.excluded.built_form,
                "floor_area_m2": stmt.excluded.floor_area_m2,
                "num_rooms": stmt.excluded.num_rooms,
                "energy_rating": stmt.excluded.energy_rating,
                "potential_rating": stmt.excluded.potential_rating,
                "epc_date": stmt.excluded.epc_date,
                "tenure": stmt.excluded.tenure,
                # v3.3.0 new columns
                "construction_age_band": stmt.excluded.construction_age_band,
                "mains_gas_flag": stmt.excluded.mains_gas_flag,
                "floor_level": stmt.excluded.floor_level,
                "annual_energy_cost": stmt.excluded.annual_energy_cost,
                "updated_at": now,
            },
        )
        db.execute(stmt)
        rows_upserted += len(records)

    db.commit()
    logger.info("Upserted %d rows to properties table", rows_upserted)
    return rows_upserted


def run_epc_pipeline(db: Optional[Session] = None) -> int:
    """Execute the full EPC pipeline: clean → geocode → save CSV → upsert to DB.

    Geocoding step populates lat/lng for every property using Postcodes.io
    batch API with postcode_cache. Without coordinates, PostGIS spatial
    search (ST_DWithin) cannot find properties.

    Args:
        db: SQLAlchemy session. Creates one if not provided.

    Returns:
        Number of rows processed.
    """
    logger.info("Starting EPC pipeline")

    # Clean
    df = clean_epc_data()
    logger.info("Cleaned EPC data: %d rows", len(df))

    # Save processed CSV (before geocoding, coordinates aren't needed in CSV)
    save_clean_csv(df)

    # Geocode and upsert to DB
    own_session = db is None
    if own_session:
        db = SessionLocal()
    try:
        # Extract unique postcodes and batch geocode
        unique_postcodes = df["postcode"].dropna().unique().tolist()
        logger.info("Found %d unique postcodes to geocode", len(unique_postcodes))
        geocode_map = geocode_batch(unique_postcodes, db)

        # Merge lat/lng into the DataFrame
        df["lat"] = df["postcode"].map(
            lambda pc: geocode_map.get(pc, (None, None))[0] if pc else None
        )
        df["lng"] = df["postcode"].map(
            lambda pc: geocode_map.get(pc, (None, None))[1] if pc else None
        )

        geocoded_count = df["lat"].notna().sum()
        logger.info(
            "Geocoded %d/%d properties (%.1f%%)",
            geocoded_count,
            len(df),
            100 * geocoded_count / len(df) if len(df) > 0 else 0,
        )

        rows = upsert_to_db(df, db)
        logger.info("EPC pipeline complete: %d rows upserted", rows)

        # Run geocoding backfill, error-isolated so EPC data is saved even
        # if geocoding fails (e.g. Postcodes.io down)
        try:
            from app.data_pipelines.geocoding_pipeline import run_geocoding_pipeline
            updated = run_geocoding_pipeline(db)
            logger.info("Geocoding backfill: %d properties updated", updated)
        except Exception:
            logger.error(
                "Geocoding backfill failed, EPC data was saved successfully",
                exc_info=True,
            )

        return rows
    finally:
        if own_session:
            db.close()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    run_pipeline_with_tracking("epc_pipeline", run_epc_pipeline)
