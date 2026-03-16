"""Scraped Rent Pipeline v5.0.0

Ingests Rightmove rental listings from scraped files (JSON or CSV) into the
properties table as SCR_RM_ records with real market rents.

v5.0.0 improvements over v4.0.0:
  1. JSON format support (new 2026-03 scraper output)
  2. Two-layer room detection:
       - Property type: House Share / HMO / Flat Share / Parking
       - Description keywords: "ROOM TO LET", "ROOM TO RENT" — catches
         rooms disguised as Terraced/Semi listings (confirmed at Guildford Park
         Avenue GU2 7NN: 8 individual rooms listed as "1-bed Terraced" at
         exactly the same coordinates)
  3. Coordinate-based deduplication (round to 4dp ≈ 11m) per
     (lat, lng, bedrooms, mapped_type) — correctly collapses re-listed
     duplicates while keeping genuinely different properties on same street
  4. Real lat/lng stored → features.py computes accurate distance_to_town_km,
     distance_to_uni_km, station_proximity_score at training time
  5. price_drop_pct from listingUpdateReason (not random): 0.05 if
     'price_reduced', 0.0 otherwise
  6. Complete 17→5 property type remapping to match model's ptype_ columns
  7. Studio handling: propertyType='Studio' AND bedrooms=None → actual_bedrooms=0
  8. EPC-aware floor_area imputation: postcode match first, then
     type×bedroom median from DB, then hardcoded fallback table
  9. Idempotent upsert via PostgreSQL ON CONFLICT DO UPDATE
"""

import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import pandas as pd
import numpy as np
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.models.property import Property

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
DATA_DIR = Path("data/raw/Rental Data")

# ── Room-listing exclusion ─────────────────────────────────────────────────────
# Property types that are per-room prices, not whole-property prices.
# Feeding these into the model would teach it wrong labels:
#   e.g. "1-bed Terraced = £190/wk" when the whole house rents for £950/wk
ROOM_LISTING_TYPES = {
    "House Share",
    "House of Multiple Occupation",
    "Flat Share",
    "Parking",
}

# Description keywords that indicate a room listing even if propertyType looks
# like a whole property (the Guildford Park Avenue pattern: "1-bed Terraced"
# that is actually "ROOM TO LET" in a 5-bed house)
ROOM_DESCRIPTION_KEYWORDS = [
    "room to let",
    "room to rent",
    "single room",
    "double room",
    "en-suite room",
    "ensuite room",
    "room only",
    "room available",
    "bedsit",
]

# ── Property type remapping (17 scraper types → 5 model types) ────────────────
# Model uses ptype_Flat, ptype_Terraced, ptype_Semi-Detached, ptype_Detached,
# ptype_Unknown (+ ptype_Studio implicitly via is_studio flag)
TYPE_REMAP = {
    "Apartment": "Flat",
    "Flat": "Flat",
    "Ground Flat": "Flat",
    "Penthouse": "Flat",
    "Maisonette": "Flat",
    "Studio": "Flat",           # Studio → Flat with actual_bedrooms=0
    "Terraced": "Terraced",
    "End of Terrace": "Terraced",
    "Semi-Detached": "Semi-Detached",
    "House": "Semi-Detached",   # Generic 'House' maps to most common type
    "Detached": "Detached",
    "Bungalow": "Detached",
    "Barn Conversion": "Detached",
}

# ── Outlier thresholds ────────────────────────────────────────────────────────
MAX_BEDROOMS = 6        # 7+ bedrooms: 3 extreme outliers in dataset
MAX_RENT_WEEKLY = 1200  # matches train.py OUTLIER_CAP_WEEKLY (1000) with margin

# ── Floor area fallback table (type × bedroom → median m²) ───────────────────
# Derived from EDA of existing 18,496 EPC properties in DB.
# Used when postcode match fails and DB median query returns no rows.
FALLBACK_FLOOR_AREA: dict[tuple[str, int], float] = {
    ("Flat", 0): 32.0,   # Studio
    ("Flat", 1): 48.0,
    ("Flat", 2): 65.0,
    ("Flat", 3): 85.0,
    ("Terraced", 1): 55.0,
    ("Terraced", 2): 70.0,
    ("Terraced", 3): 89.0,
    ("Terraced", 4): 110.0,
    ("Terraced", 5): 130.0,
    ("Semi-Detached", 2): 80.0,
    ("Semi-Detached", 3): 95.0,
    ("Semi-Detached", 4): 115.0,
    ("Semi-Detached", 5): 135.0,
    ("Detached", 3): 120.0,
    ("Detached", 4): 145.0,
    ("Detached", 5): 175.0,
}
_FALLBACK_BY_BEDS: dict[int, float] = {
    0: 32.0, 1: 50.0, 2: 68.0, 3: 90.0, 4: 115.0, 5: 140.0, 6: 170.0,
}


# ── Parsing helpers ────────────────────────────────────────────────────────────

def _parse_weekly_rent(price_str: str, secondary_str: str) -> Optional[float]:
    """Extract weekly rent from secondaryPrice (£190 pw) or convert pcm.

    Args:
        price_str: Monthly price string, e.g. "£825 pcm".
        secondary_str: Weekly price string, e.g. "£190 pw".

    Returns:
        Weekly rent as float, or None if unparseable.
    """
    # Prefer secondaryPrice (already weekly)
    if secondary_str:
        m = re.search(r"£([\d,]+)", str(secondary_str))
        if m:
            return float(m.group(1).replace(",", ""))

    # Fallback: convert monthly to weekly
    if price_str:
        m = re.search(r"£([\d,]+)", str(price_str))
        if m and "pcm" in str(price_str).lower():
            return round(float(m.group(1).replace(",", "")) * 12 / 52, 2)

    return None


def _is_room_listing(property_type: str, description: str) -> bool:
    """Return True if this listing is a per-room price (not whole property).

    Two detection layers:
      1. Property type is explicitly a share/room type
      2. Description contains room-letting keywords (catches disguised rooms
         like Guildford Park Avenue 1-bed Terraced = "ROOM TO LET" in 5-bed house)

    Args:
        property_type: Raw property type string from scraper.
        description: Full property description text.

    Returns:
        True if this is a room listing that should be excluded.
    """
    if property_type in ROOM_LISTING_TYPES:
        return True

    desc_lower = str(description or "").lower()
    return any(kw in desc_lower for kw in ROOM_DESCRIPTION_KEYWORDS)


# ── File loading ───────────────────────────────────────────────────────────────

def _load_json_file(path: Path) -> list[dict[str, Any]]:
    """Load a Rightmove JSON scrape file (list of property dicts).

    Args:
        path: Path to the .json file.

    Returns:
        List of raw property dicts.
    """
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    logger.info("Loaded JSON file %s: %d records", path.name, len(data))
    return data


def _normalise_json_record(r: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Extract standard fields from a JSON-format Rightmove record.

    Args:
        r: Raw dict from JSON scrape file.

    Returns:
        Normalised dict, or None if rent cannot be parsed.
    """
    coords = r.get("coordinates") or {}
    lat = coords.get("latitude") if isinstance(coords, dict) else None
    lng = coords.get("longitude") if isinstance(coords, dict) else None

    # Station distance (miles → km)
    stations = r.get("nearestStations") or []
    station_mi = stations[0].get("distance") if stations else None
    station_km = station_mi * 1.60934 if station_mi is not None else None

    weekly_rent = _parse_weekly_rent(
        str(r.get("price") or ""), str(r.get("secondaryPrice") or "")
    )
    if weekly_rent is None:
        return None

    return {
        "listing_id": f"RM_{r['id']}",
        "address": str(r.get("displayAddress") or ""),
        "outcode": str(r.get("outcode") or ""),
        "incode": str(r.get("incode") or ""),
        "postcode": f"{r.get('outcode', '')} {r.get('incode', '')}".strip(),
        "lat": float(lat) if lat is not None else None,
        "lng": float(lng) if lng is not None else None,
        "property_type_raw": str(r.get("propertyType") or ""),
        "bedrooms_raw": r.get("bedrooms"),
        "weekly_rent": weekly_rent,
        "description": str(r.get("description") or ""),
        "listing_update_reason": str(r.get("listingUpdateReason") or "new"),
        "station_km": station_km,
    }


def _normalise_csv_record(row: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Extract standard fields from a CSV-format Rightmove record.

    CSV files use flattened column names: coordinates/latitude,
    nearestStations/0/distance, etc.

    Args:
        row: Dict from pd.read_csv row.

    Returns:
        Normalised dict, or None if rent cannot be parsed.
    """
    # Strip BOM from first column key if present
    row = {k.lstrip("\ufeff").strip('"'): v for k, v in row.items()}

    lat_raw = row.get("coordinates/latitude")
    lng_raw = row.get("coordinates/longitude")
    lat = float(lat_raw) if lat_raw and str(lat_raw).strip() else None
    lng = float(lng_raw) if lng_raw and str(lng_raw).strip() else None

    station_mi_raw = row.get("nearestStations/0/distance")
    try:
        station_mi = float(station_mi_raw) if station_mi_raw else None
    except (ValueError, TypeError):
        station_mi = None
    station_km = station_mi * 1.60934 if station_mi is not None else None

    weekly_rent = _parse_weekly_rent(
        str(row.get("price") or ""), str(row.get("secondaryPrice") or "")
    )
    if weekly_rent is None:
        return None

    outcode = str(row.get("outcode") or "").strip()
    incode = str(row.get("incode") or "").strip()

    return {
        "listing_id": f"RM_{row.get('id', '')}",
        "address": str(row.get("displayAddress") or ""),
        "outcode": outcode,
        "incode": incode,
        "postcode": f"{outcode} {incode}".strip(),
        "lat": lat,
        "lng": lng,
        "property_type_raw": str(row.get("propertyType") or ""),
        "bedrooms_raw": row.get("bedrooms"),
        "weekly_rent": weekly_rent,
        "description": str(row.get("description") or ""),
        "listing_update_reason": str(row.get("listingUpdateReason") or "new"),
        "station_km": station_km,
    }


def load_all_rightmove_files() -> list[dict[str, Any]]:
    """Find and load all Rightmove scrape files (JSON + CSV) in DATA_DIR.

    Returns:
        List of normalised record dicts across all files, keyed by listing_id.
        Duplicate listing IDs across files are deduplicated (latest file wins).
    """
    all_records: dict[str, dict[str, Any]] = {}

    json_files = sorted(DATA_DIR.glob("dataset_rightmove-scraper*.json"))
    csv_files = sorted(DATA_DIR.glob("dataset_rightmove-scraper*.csv"))

    for path in csv_files + json_files:  # JSON files override CSV for same ID
        logger.info("Processing %s", path.name)
        try:
            if path.suffix == ".json":
                raw_records = _load_json_file(path)
                for r in raw_records:
                    norm = _normalise_json_record(r)
                    if norm:
                        all_records[norm["listing_id"]] = norm
            else:
                df = pd.read_csv(path, dtype=str, low_memory=False)
                for _, row in df.iterrows():
                    norm = _normalise_csv_record(row.to_dict())
                    if norm and norm["listing_id"] != "RM_":
                        all_records[norm["listing_id"]] = norm
        except Exception:
            logger.exception("Failed to load %s — skipping", path.name)

    logger.info("Total unique listing IDs across all files: %d", len(all_records))
    return list(all_records.values())


# ── Cleaning & classification ──────────────────────────────────────────────────

def clean_and_classify(records: list[dict[str, Any]]) -> pd.DataFrame:
    """Apply all cleaning rules and return a DataFrame of whole-property rentals.

    Exclusion rules (in order):
      1. SW17 outlier (not Guildford)
      2. Property type is a room/share type
      3. Description contains room-letting keywords (disguised HMO rooms)
      4. Weekly rent is None or outside [£100, £1200]
      5. Bedrooms >= MAX_BEDROOMS (extreme outliers)

    Then applies:
      - Property type remapping (17 → 5 model types)
      - Studio bedroom handling (None → 0)
      - price_drop_pct from listingUpdateReason

    Args:
        records: Raw normalised records from load_all_rightmove_files().

    Returns:
        Clean DataFrame with model-ready fields.
    """
    df = pd.DataFrame(records)
    total = len(df)

    # 1. Remove SW17 outlier
    df = df[df["outcode"] != "SW17"]
    logger.info("After SW17 removal: %d (removed %d)", len(df), total - len(df))

    # 2 + 3. Exclude room/share listings
    room_mask = df.apply(
        lambda r: _is_room_listing(r["property_type_raw"], r["description"]),
        axis=1,
    )
    n_rooms = room_mask.sum()
    df = df[~room_mask].copy()
    logger.info("After room exclusion (type+description): %d (excluded %d rooms)", len(df), n_rooms)

    # 4. Exclude invalid rents
    df = df[df["weekly_rent"].notna()]
    df["weekly_rent"] = pd.to_numeric(df["weekly_rent"], errors="coerce")
    df = df[(df["weekly_rent"] >= 100) & (df["weekly_rent"] <= MAX_RENT_WEEKLY)].copy()
    logger.info("After rent filter [£100–£%d/wk]: %d", MAX_RENT_WEEKLY, len(df))

    # 5. Exclude extreme bedroom outliers
    beds_numeric = pd.to_numeric(df["bedrooms_raw"], errors="coerce")
    df = df[(beds_numeric.isna()) | (beds_numeric <= MAX_BEDROOMS)].copy()
    logger.info("After bedroom cap (<=%d): %d", MAX_BEDROOMS, len(df))

    # Remap property type
    df["mapped_type"] = df["property_type_raw"].map(TYPE_REMAP).fillna("Flat")

    # Handle Studio → actual_bedrooms = 0
    beds_series = pd.to_numeric(df["bedrooms_raw"], errors="coerce")
    is_studio = df["property_type_raw"] == "Studio"
    df["actual_bedrooms"] = beds_series.where(~is_studio, other=0)
    df["actual_bedrooms"] = df["actual_bedrooms"].where(df["actual_bedrooms"].notna(), other=None)
    df["actual_bedrooms"] = pd.to_numeric(df["actual_bedrooms"], errors="coerce").astype("Int64")

    # price_drop_pct: real signal from listing metadata
    df["price_drop_pct"] = df["listing_update_reason"].apply(
        lambda r: 0.05 if str(r).lower() == "price_reduced" else 0.0
    )

    # Require valid outcode (GU postcodes)
    df = df[df["outcode"].str.match(r"^GU\d+$", na=False)].copy()
    logger.info("Final clean records (GU postcodes only): %d", len(df))

    return df.reset_index(drop=True)


# ── Coordinate-based deduplication ────────────────────────────────────────────

def deduplicate_by_coordinates(df: pd.DataFrame) -> pd.DataFrame:
    """Remove duplicate listings at the same physical location.

    Groups by (lat_4dp, lng_4dp, actual_bedrooms, mapped_type).
    Within each group:
      - Prefers 'price_reduced' listings (most accurate current market price)
      - Then most-recently-parsed (last occurrence in file order)

    Why 4dp? 0.0001 degree ≈ 11 metres. Two records at the same property
    will have identical or within-11m coordinates. Different houses on the
    same street will differ by ≥11m even if close together.

    Args:
        df: Clean DataFrame from clean_and_classify().

    Returns:
        Deduplicated DataFrame.
    """
    before = len(df)

    df = df.copy()
    # Only deduplicate rows that have valid coordinates
    has_coords = df["lat"].notna() & df["lng"].notna()
    df_with_coords = df[has_coords].copy()
    df_no_coords = df[~has_coords].copy()

    if not df_with_coords.empty:
        df_with_coords["lat_key"] = df_with_coords["lat"].round(4)
        df_with_coords["lng_key"] = df_with_coords["lng"].round(4)

        # Sort so that price_reduced comes last (survives drop_duplicates keep='last')
        sort_order = df_with_coords["listing_update_reason"].apply(
            lambda r: 1 if str(r).lower() == "price_reduced" else 0
        )
        df_with_coords = df_with_coords.assign(_sort=sort_order).sort_values("_sort")

        df_with_coords = df_with_coords.drop_duplicates(
            subset=["lat_key", "lng_key", "actual_bedrooms", "mapped_type"],
            keep="last",
        ).drop(columns=["lat_key", "lng_key", "_sort"])

    result = pd.concat([df_with_coords, df_no_coords], ignore_index=True)
    logger.info(
        "Coordinate dedup: %d → %d (removed %d duplicate locations)",
        before, len(result), before - len(result),
    )
    return result


# ── EPC floor area imputation ──────────────────────────────────────────────────

def _build_epc_median_map(db: Session) -> dict[tuple[str, int], float]:
    """Build a (mapped_type, bedrooms) → median floor_area_m2 lookup from DB.

    Queries the properties table (which has EPC floor area data) to get
    reliable type×bedroom floor area medians for imputation.

    Args:
        db: SQLAlchemy session.

    Returns:
        Dict mapping (property_type, num_rooms) → median floor_area_m2.
    """
    query = text("""
        SELECT
            property_type,
            num_rooms,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY floor_area_m2) AS median_floor_area
        FROM properties
        WHERE floor_area_m2 IS NOT NULL
          AND num_rooms IS NOT NULL
          AND num_rooms <= 10
          AND floor_area_m2 BETWEEN 15 AND 300
          AND uprn NOT LIKE 'SCR_%'
        GROUP BY property_type, num_rooms
        HAVING COUNT(*) >= 5
    """)
    rows = db.execute(query).fetchall()
    result = {}
    for row in rows:
        result[(row.property_type, int(row.num_rooms))] = float(row.median_floor_area)
    logger.info("EPC median floor area map: %d (type, rooms) combos", len(result))
    return result


def _build_postcode_epc_map(db: Session) -> dict[tuple[str, str, int], dict]:
    """Build a (postcode, property_type, num_rooms) → EPC fields lookup.

    Keyed by all three dimensions so a 5-bed semi gets a different floor
    area than a 3-bed semi at the same postcode. This is the critical fix
    over the previous postcode+type-only grouping, which assigned the same
    floor area to all bedroom counts at a postcode.

    Args:
        db: SQLAlchemy session.

    Returns:
        Dict mapping (postcode, property_type, num_rooms) → EPC field dict.
    """
    query = text("""
        SELECT
            postcode,
            property_type,
            num_rooms,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY floor_area_m2) AS median_floor_area,
            MODE() WITHIN GROUP (ORDER BY energy_rating) AS modal_energy_rating,
            MODE() WITHIN GROUP (ORDER BY construction_age_band) AS modal_age_band,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY annual_energy_cost) AS median_energy_cost
        FROM properties
        WHERE floor_area_m2 IS NOT NULL
          AND postcode IS NOT NULL
          AND num_rooms IS NOT NULL
          AND uprn NOT LIKE 'SCR_%'
        GROUP BY postcode, property_type, num_rooms
    """)
    rows = db.execute(query).fetchall()
    result = {}
    for row in rows:
        key = (
            str(row.postcode).strip().upper(),
            str(row.property_type or ""),
            int(row.num_rooms),
        )
        result[key] = {
            "floor_area_m2": float(row.median_floor_area) if row.median_floor_area else None,
            "energy_rating": row.modal_energy_rating or "D",
            "construction_age_band": row.modal_age_band or "K",
            "annual_energy_cost": float(row.median_energy_cost) if row.median_energy_cost else 1200.0,
        }
    logger.info("Postcode EPC map: %d (postcode, type, rooms) combos", len(result))
    return result


def impute_epc_features(
    df: pd.DataFrame,
    postcode_epc_map: dict[tuple[str, str, int], dict],
    type_beds_median: dict[tuple[str, int], float],
) -> pd.DataFrame:
    """Impute EPC-derived features for each scraped listing.

    Priority order (most → least specific):
      1. (postcode, mapped_type, est_num_rooms) exact — beds < 4 only
      2. (postcode, mapped_type, est_num_rooms ± 1/2) — beds < 4 only
      3. (mapped_type, est_num_rooms) global DB median — PRIMARY for beds ≥ 4
      4. FALLBACK_FLOOR_AREA hardcoded table
      5. Absolute fallback

    v5.1.0: For beds ≥ 4 properties, postcode-level EPC data (steps 1-2) is
    skipped. GU2 postcode EPC records are dominated by Victorian/Edwardian stock
    (~90m²) which biases large-house floor areas downward. Global DB median
    (step 3) uses 361-705 records per (type, rooms) cell and is more accurate.

    Args:
        df: Clean DataFrame.
        postcode_epc_map: (postcode, type, num_rooms) → EPC fields dict.
        type_beds_median: (type, num_rooms) → median floor_area from DB.

    Returns:
        DataFrame with floor_area_m2, energy_rating, construction_age_band,
        annual_energy_cost columns added.
    """
    df = df.copy()

    floor_areas = []
    energy_ratings = []
    age_bands = []
    energy_costs = []
    impute_sources = []

    for _, row in df.iterrows():
        postcode = str(row["postcode"]).strip().upper()
        mapped_type = row["mapped_type"]
        beds = int(row["actual_bedrooms"]) if pd.notna(row["actual_bedrooms"]) else 2

        # EPC num_rooms estimate (habitable rooms = bedrooms + living rooms)
        if mapped_type == "Flat":
            est_num_rooms = max(1, beds + 1)   # 1 living room
        else:
            est_num_rooms = max(2, beds + 2)   # living + kitchen/dining

        floor_area = None
        energy_rating = "D"
        age_band = "K"
        energy_cost = 1200.0
        source = "fallback"

        # v5.1.0: For 4+ bedroom properties, postcode-level EPC data in GU2 is
        # dominated by older Victorian/Edwardian housing stock with smaller floor
        # areas than modern large rentals on the private market.
        # Example: GU2 7 has many 3-4 room EPC records for Victorian terraces
        # (~90m²), biasing 4-5 bed house lookups downward.
        # Fix: skip postcode lookup for large properties → use global DB median.
        use_postcode_lookup = (beds < 4)

        # 1. Exact: (postcode, type, num_rooms) — small properties only
        if use_postcode_lookup:
            exact_key = (postcode, mapped_type, est_num_rooms)
            if exact_key in postcode_epc_map:
                epc = postcode_epc_map[exact_key]
                floor_area = epc.get("floor_area_m2")
                energy_rating = epc.get("energy_rating", "D")
                age_band = epc.get("construction_age_band", "K")
                energy_cost = epc.get("annual_energy_cost", 1200.0)
                source = "postcode_exact"

        # 2. Near: (postcode, type, num_rooms ± offset) — small properties only
        if floor_area is None and use_postcode_lookup:
            for delta in (1, -1, 2, -2):
                near_key = (postcode, mapped_type, est_num_rooms + delta)
                if near_key in postcode_epc_map:
                    epc = postcode_epc_map[near_key]
                    floor_area = epc.get("floor_area_m2")
                    energy_rating = epc.get("energy_rating", "D")
                    age_band = epc.get("construction_age_band", "K")
                    energy_cost = epc.get("annual_energy_cost", 1200.0)
                    source = "postcode_near"
                    break

        # 3. Global DB median (type × num_rooms) — bedroom-specific, not postcode-specific.
        # For 4+ bed properties this is the PRIMARY source (step 1/2 skipped above).
        if floor_area is None:
            db_key = (mapped_type, est_num_rooms)
            if db_key in type_beds_median:
                floor_area = type_beds_median[db_key]
                source = "db_median"

        # 4. Hardcoded fallback table
        if floor_area is None:
            fa_key = (mapped_type, beds)
            floor_area = FALLBACK_FLOOR_AREA.get(fa_key)
            if floor_area is not None:
                source = "fallback_table"

        # 5. Absolute fallback
        if floor_area is None:
            floor_area = _FALLBACK_BY_BEDS.get(beds, 65.0)
            source = "absolute_fallback"

        floor_areas.append(round(float(floor_area), 1))
        energy_ratings.append(energy_rating)
        age_bands.append(age_band)
        energy_costs.append(float(energy_cost))
        impute_sources.append(source)

    df["floor_area_m2"] = floor_areas
    df["energy_rating"] = energy_ratings
    df["construction_age_band"] = age_bands
    df["annual_energy_cost"] = energy_costs
    df["_impute_source"] = impute_sources

    source_counts = pd.Series(impute_sources).value_counts()
    logger.info("Floor area imputation sources: %s", source_counts.to_dict())
    return df


# ── Database upsert ────────────────────────────────────────────────────────────

def upsert_scraped_properties(df: pd.DataFrame, db: Session) -> tuple[int, int]:
    """Upsert clean scraped properties into the properties table.

    Uses PostgreSQL INSERT ... ON CONFLICT (uprn) DO UPDATE so running
    the pipeline twice updates existing records instead of failing.

    UPRN format: SCR_RM_{listing_id_without_prefix}
    e.g. listing_id="RM_173196095" → uprn="SCR_RM_173196095"

    Args:
        df: Enriched DataFrame from impute_epc_features().
        db: SQLAlchemy session.

    Returns:
        Tuple of (inserts, updates) counts.
    """
    now = datetime.now(timezone.utc)

    # Estimate num_rooms from bedrooms (EPC convention)
    def estimate_num_rooms(mapped_type: str, beds: int) -> int:
        if mapped_type == "Flat":
            return max(1, beds + 1)
        return max(2, beds + 2)

    records_upserted = 0
    for _, row in df.iterrows():
        beds = int(row["actual_bedrooms"]) if pd.notna(row["actual_bedrooms"]) else 2
        uprn = f"SCR_{row['listing_id']}"  # SCR_RM_173196095

        stmt = pg_insert(Property.__table__).values(
            uprn=uprn,
            address=str(row["address"])[:500],
            postcode=str(row["postcode"])[:10],
            lat=float(row["lat"]) if pd.notna(row["lat"]) else None,
            lng=float(row["lng"]) if pd.notna(row["lng"]) else None,
            property_type=str(row["mapped_type"]),
            built_form="Unknown",
            floor_area_m2=float(row["floor_area_m2"]),
            num_rooms=estimate_num_rooms(row["mapped_type"], beds),
            energy_rating=str(row["energy_rating"]),
            potential_rating="C",   # Conservative default
            construction_age_band=str(row["construction_age_band"]),
            mains_gas_flag=1,       # Most Guildford properties have mains gas
            annual_energy_cost=float(row["annual_energy_cost"]),
            actual_market_rent_weekly=float(row["weekly_rent"]),
            price_drop_pct=float(row["price_drop_pct"]),
            actual_bedrooms=beds,
            created_at=now,
            updated_at=now,
        ).on_conflict_do_update(
            index_elements=["uprn"],
            set_={
                "actual_market_rent_weekly": float(row["weekly_rent"]),
                "price_drop_pct": float(row["price_drop_pct"]),
                "actual_bedrooms": beds,
                "lat": float(row["lat"]) if pd.notna(row["lat"]) else None,
                "lng": float(row["lng"]) if pd.notna(row["lng"]) else None,
                "floor_area_m2": float(row["floor_area_m2"]),
                "energy_rating": str(row["energy_rating"]),
                "construction_age_band": str(row["construction_age_band"]),
                "annual_energy_cost": float(row["annual_energy_cost"]),
                "updated_at": now,
            },
        )
        db.execute(stmt)
        records_upserted += 1

    db.commit()
    logger.info("Upserted %d scraped property records", records_upserted)
    return records_upserted, 0  # (total_upserted, 0) — upsert handles insert/update


# ── Pipeline entry point ───────────────────────────────────────────────────────

def run_pipeline() -> dict[str, int]:
    """Execute the full scraped rent ingestion pipeline v5.0.0.

    Steps:
      1. Load all Rightmove JSON + CSV files from DATA_DIR
      2. Normalise to standard format
      3. Clean: exclude rooms, filter outliers, remap types
      4. Deduplicate by coordinates
      5. Join to EPC data (postcode match → DB median → fallback table)
      6. Upsert into properties table

    Returns:
        Dict with pipeline statistics.
    """
    logger.info("=" * 60)
    logger.info("Scraped Rent Pipeline v5.0.0 — starting")
    logger.info("=" * 60)

    # Step 1: Load all files
    raw_records = load_all_rightmove_files()
    logger.info("Raw records loaded: %d", len(raw_records))

    # Step 2: Clean and classify
    df_clean = clean_and_classify(raw_records)

    # Step 3: Coordinate deduplication
    df_deduped = deduplicate_by_coordinates(df_clean)

    # Step 4: EPC enrichment
    db = next(get_db())
    try:
        postcode_epc_map = _build_postcode_epc_map(db)
        type_beds_median = _build_epc_median_map(db)
        df_enriched = impute_epc_features(df_deduped, postcode_epc_map, type_beds_median)

        # Step 5: Upsert
        total_upserted, _ = upsert_scraped_properties(df_enriched, db)

        # Summary statistics
        by_type = df_enriched["mapped_type"].value_counts().to_dict()
        by_outcode = df_enriched["outcode"].value_counts().to_dict()
        rent_median = df_enriched["weekly_rent"].median()

        logger.info("=" * 60)
        logger.info("Pipeline complete. Records upserted: %d", total_upserted)
        logger.info("By type: %s", by_type)
        logger.info("By outcode: %s", by_outcode)
        logger.info("Median rent: £%.0f/wk", rent_median)
        logger.info("=" * 60)

        return {
            "total_raw": len(raw_records),
            "after_cleaning": len(df_clean),
            "after_dedup": len(df_deduped),
            "upserted": total_upserted,
        }

    except Exception:
        db.rollback()
        logger.exception("Pipeline failed — rolled back")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    stats = run_pipeline()
    logger.info("Final stats: %s", stats)
