"""ML feature engineering: build features from EPC, HMO, crime, and geocoding data.

Merges data from multiple sources to create a feature matrix for rent prediction:
- EPC data: floor area, rooms, energy rating, property type, built form
- HMO register: is_hmo flag
- Crime data: safety scores by postcode sector
- Geocoding: lat/lng, distances to town centre and university
- Area value index: placeholder (0.5) until Land Registry data arrives
"""

import logging
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from geopy.distance import geodesic
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.crime_data import CrimeData
from app.models.hmo_record import HmoRecord
from app.models.postcode_cache import PostcodeCache
from app.models.property import Property

logger = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────────────────
EPC_CLEAN_PATH = Path(__file__).resolve().parents[2] / "data" / "processed" / "epc_clean.csv"
FEATURES_PATH = Path(__file__).resolve().parents[2] / "data" / "processed" / "features.csv"

# ── Guildford reference points ───────────────────────────────────────────────
GUILDFORD_TOWN_CENTRE = (51.2362, -0.5704)  # High Street area
UNIVERSITY_OF_SURREY = (51.2430, -0.5890)   # Stag Hill campus

# ── Energy rating ordinal encoding (from data-dictionary.md) ─────────────────
ENERGY_RATING_MAP = {"A": 6, "B": 5, "C": 4, "D": 3, "E": 2, "F": 1, "G": 0}

# ── Category weights for safety score (from api-reference.md) ────────────────
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


def _extract_postcode_sector(postcode: str) -> str:
    """Extract postcode sector from full postcode.

    Args:
        postcode: Full normalised postcode, e.g. "GU2 7XH".

    Returns:
        Postcode sector, e.g. "GU2 7".
    """
    parts = str(postcode).strip().split()
    if len(parts) == 2:
        return f"{parts[0]} {parts[1][0]}"
    return str(postcode)[:-2].strip()


def _compute_distance(lat: float, lng: float, ref_point: tuple) -> Optional[float]:
    """Compute geodesic distance in km from a point to a reference.

    Args:
        lat: Latitude of the point.
        lng: Longitude of the point.
        ref_point: (lat, lng) tuple of reference location.

    Returns:
        Distance in kilometres, or None if coordinates are invalid.
    """
    if pd.isna(lat) or pd.isna(lng):
        return None
    try:
        return geodesic((lat, lng), ref_point).km
    except Exception:
        return None


def load_epc_data(db: Session) -> pd.DataFrame:
    """Load EPC property data from the database.

    Args:
        db: SQLAlchemy session.

    Returns:
        DataFrame with property data.
    """
    logger.info("Loading properties from database")
    props = db.query(Property).all()

    records = []
    for p in props:
        records.append(
            {
                "uprn": p.uprn,
                "postcode": p.postcode,
                "property_type": p.property_type,
                "built_form": p.built_form,
                "floor_area_m2": p.floor_area_m2,
                "num_rooms": p.num_rooms,
                "energy_rating": p.energy_rating,
                "potential_rating": p.potential_rating,
                "lat": p.lat,
                "lng": p.lng,
            }
        )

    df = pd.DataFrame(records)
    logger.info("Loaded %d properties from DB", len(df))
    return df


def load_hmo_flags(db: Session) -> pd.DataFrame:
    """Load HMO flags from the database.

    Args:
        db: SQLAlchemy session.

    Returns:
        DataFrame with uprn and is_hmo columns.
    """
    logger.info("Loading HMO records from database")
    hmos = db.query(HmoRecord).all()

    # Build set of postcodes that have HMO licenses
    hmo_postcodes = set()
    for h in hmos:
        if h.postcode:
            hmo_postcodes.add(h.postcode)

    return hmo_postcodes


def load_safety_scores(db: Session) -> pd.DataFrame:
    """Compute safety scores from crime data in the database.

    Args:
        db: SQLAlchemy session.

    Returns:
        DataFrame with postcode_sector and safety_score columns.
    """
    logger.info("Computing safety scores from crime data")
    crimes = db.query(CrimeData).all()

    if not crimes:
        logger.warning("No crime data found — returning empty safety scores")
        return pd.DataFrame(columns=["postcode_sector", "safety_score"])

    rows = []
    for c in crimes:
        rows.append(
            {
                "postcode_sector": c.postcode_sector,
                "category": c.category,
                "count": c.count,
            }
        )

    df = pd.DataFrame(rows)
    df["weight"] = df["category"].map(CATEGORY_WEIGHTS).fillna(1.0)
    df["weighted_count"] = df["count"] * df["weight"]

    sector_sums = df.groupby("postcode_sector")["weighted_count"].sum()
    normaliser = sector_sums.quantile(0.95) if len(sector_sums) > 1 else sector_sums.max()
    if normaliser == 0:
        normaliser = 1.0

    scores = pd.DataFrame(
        {
            "postcode_sector": sector_sums.index,
            "safety_score": [
                round(max(0, min(100, 100 - (ws / normaliser * 100))), 1)
                for ws in sector_sums.values
            ],
        }
    )

    logger.info("Computed safety scores for %d sectors", len(scores))
    return scores


def geocode_properties(df: pd.DataFrame, db: Session) -> pd.DataFrame:
    """Add lat/lng to properties from postcode cache where missing.

    Args:
        df: Properties DataFrame.
        db: SQLAlchemy session.

    Returns:
        Updated DataFrame with lat/lng populated from cache.
    """
    missing_coords = df["lat"].isna() | df["lng"].isna()
    if not missing_coords.any():
        return df

    logger.info("Filling %d missing coordinates from postcode cache", missing_coords.sum())

    # Load all cached postcodes
    cache = db.query(PostcodeCache).filter(PostcodeCache.is_valid == True).all()
    cache_map = {c.postcode: (c.lat, c.lng) for c in cache}

    for idx, row in df[missing_coords].iterrows():
        pc = row["postcode"]
        if pc in cache_map:
            df.at[idx, "lat"] = cache_map[pc][0]
            df.at[idx, "lng"] = cache_map[pc][1]

    still_missing = df["lat"].isna().sum()
    logger.info("After cache fill: %d still missing coordinates", still_missing)
    return df


def build_features(db: Optional[Session] = None) -> pd.DataFrame:
    """Build the full feature matrix for ML training.

    Args:
        db: SQLAlchemy session. Creates one if not provided.

    Returns:
        Feature DataFrame ready for model training.
    """
    own_session = db is None
    if own_session:
        db = SessionLocal()

    try:
        # ── Load base EPC data ───────────────────────────────────────────
        df = load_epc_data(db)

        if df.empty:
            logger.error("No property data found — cannot build features")
            return pd.DataFrame()

        # ── Geocode missing coords ───────────────────────────────────────
        df = geocode_properties(df, db)

        # ── Compute distances ────────────────────────────────────────────
        df["distance_to_town_km"] = df.apply(
            lambda row: _compute_distance(row["lat"], row["lng"], GUILDFORD_TOWN_CENTRE),
            axis=1,
        )
        df["distance_to_uni_km"] = df.apply(
            lambda row: _compute_distance(row["lat"], row["lng"], UNIVERSITY_OF_SURREY),
            axis=1,
        )

        # ── Ordinal encode energy_rating ─────────────────────────────────
        df["energy_rating_ordinal"] = df["energy_rating"].map(ENERGY_RATING_MAP).fillna(3)
        df["potential_rating_ordinal"] = df["potential_rating"].map(ENERGY_RATING_MAP).fillna(3)

        # ── One-hot encode property_type ─────────────────────────────────
        property_dummies = pd.get_dummies(
            df["property_type"], prefix="ptype", dtype=int
        )
        df = pd.concat([df, property_dummies], axis=1)

        # ── HMO flag ────────────────────────────────────────────────────
        hmo_postcodes = load_hmo_flags(db)
        df["is_hmo"] = df["postcode"].isin(hmo_postcodes).astype(int)

        # ── Safety score ────────────────────────────────────────────────
        df["postcode_sector"] = df["postcode"].apply(_extract_postcode_sector)
        safety_scores = load_safety_scores(db)

        if not safety_scores.empty:
            df = df.merge(safety_scores, on="postcode_sector", how="left")
            df["safety_score"] = df["safety_score"].fillna(50.0)  # Neutral default
        else:
            df["safety_score"] = 50.0

        # ── Area value index (placeholder until Land Registry data) ──────
        df["area_value_index"] = 0.5  # Neutral placeholder

        # ── Handle nulls ────────────────────────────────────────────────
        # Critical features: drop rows missing floor area
        df = df.dropna(subset=["floor_area_m2"])

        # Impute optional with median
        for col in ["num_rooms", "distance_to_town_km", "distance_to_uni_km"]:
            median_val = df[col].median()
            df[col] = df[col].fillna(median_val)

        # ── Select final feature columns ────────────────────────────────
        feature_cols = [
            "uprn",
            "postcode",
            "postcode_sector",
            "floor_area_m2",
            "num_rooms",
            "energy_rating_ordinal",
            "potential_rating_ordinal",
            "lat",
            "lng",
            "distance_to_town_km",
            "distance_to_uni_km",
            "is_hmo",
            "safety_score",
            "area_value_index",
        ]
        # Add one-hot property type columns
        ptype_cols = [c for c in df.columns if c.startswith("ptype_")]
        feature_cols.extend(ptype_cols)

        result = df[feature_cols].copy()

        # Drop any remaining NaN rows in coordinate columns
        result = result.dropna(subset=["lat", "lng"])

        logger.info(
            "Feature matrix shape: %s, columns: %s",
            result.shape,
            list(result.columns),
        )

        return result

    finally:
        if own_session:
            db.close()


def save_features(df: pd.DataFrame, output_path: Optional[Path] = None) -> None:
    """Save feature matrix to CSV.

    Args:
        df: Feature DataFrame.
        output_path: Destination path. Defaults to project path.
    """
    path = output_path or FEATURES_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(str(path), index=False)
    logger.info("Saved features to %s", path)


def run_feature_engineering() -> pd.DataFrame:
    """Execute full feature engineering pipeline.

    Returns:
        Feature DataFrame.
    """
    logger.info("Starting feature engineering")
    df = build_features()

    if df.empty:
        logger.error("Feature engineering produced empty output")
        return df

    save_features(df)
    logger.info(
        "Feature engineering complete: shape=%s, columns=%s",
        df.shape,
        list(df.columns),
    )
    return df


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    df = run_feature_engineering()
    if not df.empty:
        logger.info("Shape: %s", df.shape)
        logger.info("Columns: %s", list(df.columns))
        logger.info("Sample:\n%s", df.head(3).to_string())
