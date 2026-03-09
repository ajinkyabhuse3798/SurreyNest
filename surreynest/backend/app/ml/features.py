"""ML feature engineering: build features from EPC, HMO, crime, geocoding, and
Land Registry / HPI / IPHRP data.

Merges data from multiple sources to create a feature matrix for rent prediction:
- EPC data: floor area, rooms, energy rating, property type, built form
- HMO register: is_hmo flag
- Crime data: safety scores by postcode sector
- Geocoding: lat/lng, distances to town centre and university
- Land Registry (Price Paid): implied_weekly_rent, median_sale_price, sale_count
- IPHRP: South East rental growth trend (iphrp_growth_pct)
- Area value index: 0–1 normalised per postcode from Land Registry
"""

import logging
from glob import glob
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from geopy.distance import geodesic
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.data_pipelines.epc_pipeline import AGE_BAND_ORDINAL
from app.models.crime_data import CrimeData
from app.models.hmo_record import HmoRecord
from app.models.postcode_cache import PostcodeCache
from app.models.property import Property

logger = logging.getLogger(__name__)

# ── Paths ──────────────────────────────────────────────────────────────────────────────
DATA_BASE = Path(__file__).resolve().parents[2] / "data"
EPC_CLEAN_PATH = DATA_BASE / "processed" / "epc_clean.csv"
FEATURES_PATH = DATA_BASE / "processed" / "features.csv"
LAND_REGISTRY_PATH = DATA_BASE / "processed" / "land_registry_guildford.csv"
IPHRP_DIR = DATA_BASE / "raw" / "iphrp"

# ── Guildford reference points ───────────────────────────────────────────────
GUILDFORD_TOWN_CENTRE = (51.2362, -0.5704)  # High Street area
UNIVERSITY_OF_SURREY = (51.2430, -0.5890)   # Stag Hill campus
GUILDFORD_STATION = (51.2372, -0.5617)       # London Road station forecourt

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


def _save_config_to_db(db: Session, key: str, value: float,
                       description: str = "", source: str = "pipeline") -> None:
    """Upsert a config value into the pipeline_config table.

    Uses INSERT ... ON CONFLICT DO UPDATE so repeated pipeline runs
    always overwrite with the latest value.

    Args:
        db: SQLAlchemy session.
        key: Config key, e.g. "iphrp_growth_pct".
        value: Numeric value to store.
        description: Human-readable explanation.
        source: Which pipeline wrote this.
    """
    from datetime import datetime, timezone
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from app.models.pipeline_config import PipelineConfig

    stmt = pg_insert(PipelineConfig.__table__).values(
        key=key,
        value=value,
        description=description,
        updated_at=datetime.now(timezone.utc),
        source=source,
    ).on_conflict_do_update(
        index_elements=["key"],
        set_={
            "value": value,
            "description": description,
            "updated_at": datetime.now(timezone.utc),
            "source": source,
        },
    )
    db.execute(stmt)
    db.commit()
    logger.info("pipeline_config: %s = %.6f (source=%s)", key, value, source)


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
                # v3.3.0 new ML features
                "construction_age_band": p.construction_age_band,
                "mains_gas_flag": p.mains_gas_flag,
                "floor_level": p.floor_level,
                "annual_energy_cost": p.annual_energy_cost,
                # v4.0.0 scraped market features
                "actual_market_rent_weekly": p.actual_market_rent_weekly,
                "price_drop_pct": p.price_drop_pct,
                # v4.1.0 real bedrooms
                "actual_bedrooms": p.actual_bedrooms,
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


def load_land_registry_features() -> pd.DataFrame:
    """Load Price Paid derived features from processed CSV.

    Returns a DataFrame with per-postcode columns:
      - implied_weekly_rent  (median, HPI-adjusted, 3.5% yield)
      - median_sale_price
      - sale_count           (market liquidity signal)

    For properties whose postcode is not in the CSV, we fall back to
    the postcode-sector median so coverage stays close to 100%.

    Returns:
        DataFrame with postcode, implied_weekly_rent, median_sale_price, sale_count.
    """
    if not LAND_REGISTRY_PATH.exists():
        logger.warning(
            "land_registry_guildford.csv not found at %s — skipping LR features",
            LAND_REGISTRY_PATH,
        )
        return pd.DataFrame(columns=["postcode", "implied_weekly_rent",
                                      "median_sale_price", "sale_count"])

    df = pd.read_csv(str(LAND_REGISTRY_PATH))
    df = df[["postcode", "median_weekly_rent", "median_sale_price", "sale_count"]].copy()
    df = df.rename(columns={"median_weekly_rent": "implied_weekly_rent"})

    # Build sector-level fallback medians
    df["_sector"] = df["postcode"].str.strip().str.split(r"\s+").str[0] + " " + \
                    df["postcode"].str.strip().str.split(r"\s+").str[1].str[0]
    sector_medians = df.groupby("_sector").agg(
        implied_weekly_rent=("implied_weekly_rent", "median"),
        median_sale_price=("median_sale_price", "median"),
        sale_count=("sale_count", "median"),
    ).reset_index().rename(columns={"_sector": "postcode_sector"})

    df = df.drop(columns=["_sector"])
    logger.info(
        "Loaded %d postcodes from land_registry_guildford.csv (implied rent: £%.0f–£%.0f/wk)",
        len(df),
        df["implied_weekly_rent"].min(),
        df["implied_weekly_rent"].max(),
    )
    return df, sector_medians


def load_iphrp_growth() -> float:
    """Extract latest South East annual rental growth % from IPHRP XLSX.

    Returns:
        Latest annual % change for South East, or 0.0 if unavailable.
    """
    xlsx_files = list(IPHRP_DIR.glob("*.xlsx"))
    if not xlsx_files:
        logger.warning("No IPHRP XLSX found in %s", IPHRP_DIR)
        return 0.0

    try:
        df = pd.read_excel(str(xlsx_files[0]), sheet_name="Table 2", header=None)

        # Find header row containing 'South East'
        header_row = None
        for i in range(min(10, len(df))):
            if "South East" in " ".join([str(v) for v in df.iloc[i].values]):
                header_row = i
                break

        if header_row is None:
            return 0.0

        df2 = pd.read_excel(str(xlsx_files[0]), sheet_name="Table 2", header=header_row)
        se_col = [c for c in df2.columns if "south east" in str(c).lower()]
        if not se_col:
            return 0.0

        growth_series = pd.to_numeric(df2[se_col[0]], errors="coerce").dropna()
        if growth_series.empty:
            return 0.0

        latest = float(growth_series.iloc[-1])
        logger.info("IPHRP South East latest annual growth: %.1f%%", latest)
        return latest

    except Exception as e:
        logger.warning("Error reading IPHRP: %s", e)
        return 0.0


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
        df["distance_to_station_km"] = df.apply(
            lambda row: _compute_distance(row["lat"], row["lng"], GUILDFORD_STATION),
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

        # ── Area value index from Land Registry data ────────────────────
        from app.models.area_value import AreaValue
        area_values = db.query(AreaValue).all()

        if area_values:
            av_df = pd.DataFrame(
                [(av.postcode, av.area_value_index) for av in area_values],
                columns=["postcode", "area_value_index"],
            )
            df = df.merge(av_df, on="postcode", how="left")
            df["area_value_index"] = df["area_value_index"].fillna(0.5)
            logger.info(
                "Loaded %d area values from DB (%.1f%% coverage)",
                len(av_df),
                (1 - df["area_value_index"].eq(0.5).mean()) * 100,
            )
        else:
            df["area_value_index"] = 0.5  # Fallback if no data
            logger.warning("No area_value data in DB — using default 0.5")

        # ── Land Registry real rent features ────────────────────────────
        lr_result = load_land_registry_features()
        if isinstance(lr_result, tuple):
            lr_df, sector_medians = lr_result
            if not lr_df.empty:
                # Full postcode join
                df = df.merge(lr_df, on="postcode", how="left")

                # Sector-level fallback for unmatched postcodes
                unmatched = df["implied_weekly_rent"].isna()
                if unmatched.any() and not sector_medians.empty:
                    df_un = df[unmatched].copy()
                    df_un = df_un.merge(
                        sector_medians, on="postcode_sector", how="left",
                        suffixes=("", "_sector")
                    )
                    for col in ["implied_weekly_rent", "median_sale_price", "sale_count"]:
                        df.loc[unmatched, col] = df_un[f"{col}_sector"].values

                # Final fallback: dataset medians
                dataset_median_rent = lr_df["implied_weekly_rent"].median()
                dataset_median_price = lr_df["median_sale_price"].median()
                df["implied_weekly_rent"] = df["implied_weekly_rent"].fillna(dataset_median_rent)
                df["median_sale_price"] = df["median_sale_price"].fillna(dataset_median_price)
                df["sale_count"] = df["sale_count"].fillna(1)

                matched_pct = (1 - unmatched.mean()) * 100
                logger.info(
                    "Land Registry features joined: %.1f%% direct postcode match, "
                    "%.1f%% sector fallback, median implied rent=£%.0f/wk",
                    matched_pct,
                    100 - matched_pct,
                    df["implied_weekly_rent"].median(),
                )
            else:
                df["implied_weekly_rent"] = np.nan
                df["median_sale_price"] = np.nan
                df["sale_count"] = 1
        else:
            df["implied_weekly_rent"] = np.nan
            df["median_sale_price"] = np.nan
            df["sale_count"] = 1

        # ── IPHRP South East rental growth trend ─────────────────────────
        iphrp_growth = load_iphrp_growth()
        df["iphrp_growth_pct"] = iphrp_growth  # scalar — same value for all rows
        logger.info("IPHRP growth feature added: %.1f%%", iphrp_growth)

        # Persist to pipeline_config so score_service reads it live
        _save_config_to_db(db, "iphrp_growth_pct", iphrp_growth,
                           description="South East IPHRP annual rental growth % (ONS)",
                           source="features_pipeline")

        # ── v3.3.0 derived features ──────────────────────────────────────
        # 1. Construction age band → ordinal (newer = higher)
        df["age_band_ordinal"] = (
            df["construction_age_band"]
            .fillna("")
            .str.lower()
            .str.strip()
            .map(AGE_BAND_ORDINAL)
        )
        median_age = df["age_band_ordinal"].median()
        df["age_band_ordinal"] = df["age_band_ordinal"].fillna(
            median_age if pd.notna(median_age) else 6  # default: 1983-1990
        )

        # 2. Mains gas flag (binary, already 1/0 from pipeline)
        df["has_mains_gas"] = df["mains_gas_flag"].fillna(1).astype(int)  # default: has gas

        # 3. Floor level ordinal (already integer from pipeline)
        df["floor_level_ordinal"] = df["floor_level"].fillna(0).astype(int)

        # 4. Annual energy cost (£/yr from EPC assessment)
        energy_cost_median = df["annual_energy_cost"].median()
        df["annual_energy_cost"] = df["annual_energy_cost"].fillna(
            energy_cost_median if pd.notna(energy_cost_median) else 1500.0
        )

        # 5. Energy improvement gap (potential - current): higher = worse condition
        df["energy_improvement_gap"] = (
            df["potential_rating_ordinal"] - df["energy_rating_ordinal"]
        ).clip(-3, 6)

        logger.info(
            "v3.3.0 features: age_band median=%.0f, mains_gas=%.1f%%, "
            "energy_cost median=£%.0f, improvement_gap median=%.1f",
            df["age_band_ordinal"].median(),
            df["has_mains_gas"].mean() * 100,
            df["annual_energy_cost"].median(),
            df["energy_improvement_gap"].median(),
        )

        # ── Handle nulls ────────────────────────────────────────────────
        # Critical features: drop rows missing floor area
        df = df.dropna(subset=["floor_area_m2"])

        # Impute optional with median or sensible defaults
        for col in ["num_rooms", "distance_to_town_km", "distance_to_uni_km", "distance_to_station_km"]:
            median_val = df[col].median()
            df[col] = df[col].fillna(median_val)
            
        # For actual_bedrooms, default to 2 if missing
        df["actual_bedrooms"] = df["actual_bedrooms"].fillna(2).astype(int)

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
            "distance_to_station_km",
            "is_hmo",
            "safety_score",
            "area_value_index",
            "actual_bedrooms",       # v4.1.0: Real/Classifier-predicted bedrooms
            # ── New: Land Registry real data features ──────────────────────
            "implied_weekly_rent",   # postcode-level real rent anchor (MODE C target)
            "median_sale_price",     # absolute neighbourhood value (£)
            "sale_count",            # market liquidity (how many sales we have data for)
            "iphrp_growth_pct",      # South East rental growth trend (%)
            # ── v3.3.0: EPC-derived ML features ───────────────────────────
            "age_band_ordinal",          # construction era (0=pre-1900, 11=2012+)
            "has_mains_gas",             # 1=gas, 0=no gas
            "floor_level_ordinal",       # -1=basement, 0=ground, 1=first...
            "annual_energy_cost",        # £/year running cost from EPC
            "energy_improvement_gap",    # potential - current EPC ordinal
            # ── v4.0.0: Scraped real rents and price drops ─────────────────
            "actual_market_rent_weekly", # ground-truth market targets
            "price_drop_pct",            # % price drops on listings
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
