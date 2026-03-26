"""Land Registry pipeline: multi-year Price Paid Data + HPI time-adjustment.

Loads Price Paid CSVs (pp-*.csv) from data/raw/land_registry/,
filters to Guildford core (GU1 to GU5, GU7), removes outliers,
time-adjusts prices using UK HPI Guildford series, and computes
both area_value_index and implied weekly rent per postcode.

Run:  python -m app.data_pipelines.land_registry_pipeline
"""

import logging
from datetime import datetime, timezone
from glob import glob
from pathlib import Path
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.data_pipelines.utils import run_pipeline_with_tracking

logger = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────────────────
DATA_RAW = Path(__file__).resolve().parents[2] / "data" / "raw"
PP_DIR = DATA_RAW / "land_registry"
HPI_DIR = DATA_RAW / "hpi"
PROCESSED_PATH = Path(__file__).resolve().parents[2] / "data" / "processed" / "land_registry_guildford.csv"

# ── Allowed Guildford postcode districts ─────────────────────────────────────
ALLOWED_DISTRICTS = {"GU1", "GU2", "GU3", "GU4", "GU5", "GU7"}

# ── Land Registry CSV columns (no headers in bulk download) ──────────────────
COLUMN_NAMES = [
    "transaction_id", "price", "date_of_transfer", "postcode",
    "property_type", "old_new", "duration", "paon", "saon",
    "street", "locality", "town", "district", "county",
    "ppd_category", "record_status",
]

# Property type code mapping
PROPERTY_TYPE_MAP = {
    "D": "Detached",
    "S": "Semi-Detached",
    "T": "Terraced",
    "F": "Flat",
    "O": "Other",
}

# Real-world gross rental yields by property type (Guildford, 2025).
# Families and academics pay a yield premium on houses vs flats.
# Sources: Zoopla rental yield data, VOA statistics, local agent benchmarks.
YIELD_BY_TYPE = {
    "F": 0.035,  # Flat, unchanged; student/professional demand is well-captured
    "T": 0.040,  # Terraced, +0.5%; popular HMO/family rental type
    "S": 0.043,  # Semi-Detached, +0.8%; strong family demand near university
    "D": 0.038,  # Detached, +0.3%; higher sale price means lower % yield
    "O": 0.038,  # Other, safe mid-range fallback
}

# Forward projection: annualised growth rate used when projecting from latest HPI date to today.
# UK HPI has ~2 month lag; fallback covers periods where trailing 12-month data is absent.
ANNUAL_FORWARD_GROWTH_FALLBACK = 0.04   # 4% per annum (South East England long-run average)

# Only project forward if gap is meaningfully large (avoids floating-point noise
# when HPI data is near-current, e.g. last month's data on a nightly run).
FORWARD_PROJECTION_MIN_YEARS = 0.05    # ~18 days


def _normalise_postcode(pc: str) -> str:
    """Normalise postcode to 'GU1 1AA' format."""
    pc = str(pc).strip().upper().replace("  ", " ")
    if " " not in pc and len(pc) >= 4:
        return pc[:-3] + " " + pc[-3:]
    return pc


# ═════════════════════════════════════════════════════════════════════════════
# HPI LOADING
# ═════════════════════════════════════════════════════════════════════════════
TYPE_INDEX_COLS = {
    "F": "FlatIndex",
    "D": "DetachedIndex",
    "S": "SemiDetachedIndex",
    "T": "TerracedIndex",
}


def load_hpi_guildford() -> Optional[pd.DataFrame]:
    """Load UK HPI CSVs and return the Guildford monthly series.

    Returns:
        DataFrame with ['Date', 'Index', 'AveragePrice', 'FlatIndex',
        'DetachedIndex', 'SemiDetachedIndex', 'TerracedIndex'] for Guildford,
        sorted by date, duplicates dropped (latest file wins).
        Returns None if no HPI files found.
    """
    files = sorted(glob(str(HPI_DIR / "UK-HPI*.csv")))
    if not files:
        logger.warning("No HPI files found in %s, skipping time-adjustment", HPI_DIR)
        return None

    dfs = []
    for f in files:
        try:
            df = pd.read_csv(f, low_memory=False)
            dfs.append(df)
        except Exception as e:
            logger.warning("Error reading HPI file %s: %s", f, e)

    if not dfs:
        return None

    hpi = pd.concat(dfs, ignore_index=True)
    hpi_gu = hpi[hpi["RegionName"].str.strip().str.lower() == "guildford"].copy()

    if hpi_gu.empty:
        logger.warning("No Guildford rows found in HPI data")
        return None

    hpi_gu["Date"] = pd.to_datetime(hpi_gu["Date"], format="%d/%m/%Y", errors="coerce")
    hpi_gu = hpi_gu.dropna(subset=["Date"])
    hpi_gu = hpi_gu.drop_duplicates(subset=["Date"], keep="last")  # 2025 file wins
    hpi_gu = hpi_gu.sort_values("Date").reset_index(drop=True)

    numeric_cols = ["Index", "AveragePrice"] + list(TYPE_INDEX_COLS.values())
    for col in numeric_cols:
        if col in hpi_gu.columns:
            hpi_gu[col] = pd.to_numeric(hpi_gu[col], errors="coerce")
    keep_cols = ["Date"] + numeric_cols

    # Log type-index coverage at latest month
    latest = hpi_gu.iloc[-1]
    logger.info(
        "Loaded HPI Guildford: %d months (%s → %s) | Latest: Flat=%.1f Det=%.1f Semi=%.1f Ter=%.1f Blend=%.1f",
        len(hpi_gu),
        hpi_gu["Date"].iloc[0].strftime("%b %Y"),
        hpi_gu["Date"].iloc[-1].strftime("%b %Y"),
        latest.get("FlatIndex", float("nan")),
        latest.get("DetachedIndex", float("nan")),
        latest.get("SemiDetachedIndex", float("nan")),
        latest.get("TerracedIndex", float("nan")),
        latest.get("Index", float("nan")),
    )

    available = [c for c in keep_cols if c in hpi_gu.columns]
    return hpi_gu[available].copy()


def compute_hpi_adjustment(
    sale_date: pd.Series,
    property_type: pd.Series,
    hpi_df: pd.DataFrame,
) -> pd.Series:
    """Compute property-type-specific HPI adjustment factor to normalise prices to latest month.

    Routes each sale to its own index series:
        F (Flat) → FlatIndex, D (Detached) → DetachedIndex,
        S (Semi-Detached) → SemiDetachedIndex, T (Terraced) → TerracedIndex,
        O / unknown → blended Index (fallback).

    For each sale: factor = latest_type_index / sale_month_type_index

    Args:
        sale_date: Series of sale dates.
        property_type: Series of Price Paid type codes (D/S/T/F/O).
        hpi_df: Guildford HPI DataFrame with 'Date', 'Index', and type-specific columns.

    Returns:
        Series of adjustment factors (1.0 if no adjustment possible).
    """
    hpi_df = hpi_df.copy()
    hpi_df["year_month"] = hpi_df["Date"].dt.to_period("M")

    # Build per-type lookup: {type_code: {year_month: index_value}}
    type_maps: dict = {}
    type_latest: dict = {}
    for code, col in TYPE_INDEX_COLS.items():
        if col in hpi_df.columns:
            type_maps[code] = dict(zip(hpi_df["year_month"], hpi_df[col]))
            type_latest[code] = hpi_df[col].iloc[-1]

    # Blended fallback
    blend_map = dict(zip(hpi_df["year_month"], hpi_df["Index"]))
    blend_latest = hpi_df["Index"].iloc[-1]

    # Log which types use type-specific vs blended index
    available_types = list(type_maps.keys())
    logger.info("Type-specific HPI adjustment enabled for: %s (fallback: blended Index)", available_types)

    def _get_factor(row):
        dt, ptype = row
        if pd.isna(dt):
            return 1.0
        ym = pd.Period(dt, freq="M")
        if ptype in type_maps:
            latest = type_latest[ptype]
            idx = type_maps[ptype].get(ym)
        else:
            latest = blend_latest
            idx = blend_map.get(ym)
        if idx is None or idx == 0 or pd.isna(idx):
            # Fallback to blended index if type-specific is missing for that month
            idx = blend_map.get(ym)
            latest = blend_latest
        if idx is None or idx == 0 or pd.isna(idx):
            return 1.0
        return latest / idx

    combined = pd.DataFrame({"dt": sale_date, "ptype": property_type})
    return combined.apply(_get_factor, axis=1)


def compute_forward_growth_rate(hpi_df: pd.DataFrame) -> float:
    """Derive annualised HPI growth rate from trailing 12 months of data.

    Uses ratio of last index to index 12 months prior. Clamped to [0.0, 0.10].
    Falls back to ANNUAL_FORWARD_GROWTH_FALLBACK if fewer than 13 rows.
    """
    if len(hpi_df) < 13:
        logger.info(
            "Fewer than 13 HPI months (%d rows), using fallback growth %.1f%%",
            len(hpi_df), ANNUAL_FORWARD_GROWTH_FALLBACK * 100,
        )
        return ANNUAL_FORWARD_GROWTH_FALLBACK

    idx_now = hpi_df["Index"].iloc[-1]
    idx_12m_ago = hpi_df["Index"].iloc[-13]

    if pd.isna(idx_now) or pd.isna(idx_12m_ago) or idx_12m_ago == 0:
        logger.warning("HPI index invalid for growth calc, using fallback")
        return ANNUAL_FORWARD_GROWTH_FALLBACK

    raw_growth = (idx_now / idx_12m_ago) - 1.0
    clamped = max(0.0, min(0.10, raw_growth))
    if raw_growth != clamped:
        logger.warning("Raw HPI growth %.1f%% clamped to %.1f%%", raw_growth * 100, clamped * 100)
    logger.info("Trailing 12-month HPI growth: %.2f%%", clamped * 100)
    return clamped


# ═════════════════════════════════════════════════════════════════════════════
# PRICE PAID LOADING + CLEANING
# ═════════════════════════════════════════════════════════════════════════════
def clean_land_registry_data() -> pd.DataFrame:
    """Load, filter, and clean all Price Paid CSVs.

    Returns:
        Cleaned DataFrame with Guildford-only transactions, outliers removed,
        HPI-adjusted prices and implied weekly rents, aggregated per postcode.
    """
    files = sorted(glob(str(PP_DIR / "pp-*.csv")))
    if not files:
        raise FileNotFoundError(f"No Price Paid files found in {PP_DIR}")

    logger.info("Found %d Price Paid file(s)", len(files))

    # ── Load all files ───────────────────────────────────────────────────
    dfs = []
    for f in files:
        try:
            df = pd.read_csv(f, header=None, names=COLUMN_NAMES, low_memory=False)
            dfs.append(df)
            logger.info("  Loaded %s: %d rows", Path(f).name, len(df))
        except Exception as e:
            logger.warning("  Error reading %s: %s", Path(f).name, e)

    if not dfs:
        raise FileNotFoundError("All Price Paid files failed to load")

    df = pd.concat(dfs, ignore_index=True)
    initial_count = len(df)
    logger.info("Total raw rows (all UK): %d", initial_count)

    # ── Filter: Guildford postcodes only ─────────────────────────────────
    df["postcode"] = df["postcode"].fillna("").astype(str).str.strip().str.upper()
    df["_district"] = df["postcode"].str.split(r"\s+", n=1).str[0]
    df = df[df["_district"].isin(ALLOWED_DISTRICTS)]
    logger.info("After Guildford filter (GU1-5, GU7): %d rows", len(df))

    # ── Clean price and date ─────────────────────────────────────────────
    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df["date_of_transfer"] = pd.to_datetime(df["date_of_transfer"], errors="coerce")
    df = df.dropna(subset=["price", "date_of_transfer", "postcode"])

    # ── Outlier removal ──────────────────────────────────────────────────
    pre_outlier = len(df)
    df = df[(df["price"] >= 30_000) & (df["price"] <= 3_000_000)]
    logger.info(
        "Removed %d outliers (price < £30k or > £3M): %d rows remain",
        pre_outlier - len(df),
        len(df),
    )

    # ── Normalise postcodes ──────────────────────────────────────────────
    df["postcode"] = df["postcode"].apply(_normalise_postcode)

    # ── Map property type ────────────────────────────────────────────────
    df["property_type_label"] = df["property_type"].map(PROPERTY_TYPE_MAP).fillna("Other")

    # ── HPI time-adjustment ──────────────────────────────────────────────
    hpi_df = load_hpi_guildford()
    if hpi_df is not None:
        df["hpi_factor"] = compute_hpi_adjustment(
            df["date_of_transfer"], df["property_type"], hpi_df
        )
        df["adjusted_price"] = (df["price"] * df["hpi_factor"]).round(0)
        # Log per-type factor stats to verify type-specific adjustment is working
        for ptype, label in [("F","Flat"), ("D","Detached"), ("S","Semi"), ("T","Terraced")]:
            mask = df["property_type"] == ptype
            if mask.any():
                logger.info(
                    "  HPI factor %s: mean=%.3f, median=%.3f (n=%d)",
                    label, df.loc[mask, "hpi_factor"].mean(),
                    df.loc[mask, "hpi_factor"].median(), mask.sum(),
                )
        logger.info(
            "HPI adjustment applied (type-specific): overall mean factor=%.3f, median=%.3f",
            df["hpi_factor"].mean(),
            df["hpi_factor"].median(),
        )
    else:
        df["adjusted_price"] = df["price"]
        logger.warning("No HPI data, using raw prices (no time-adjustment)")

    # ── Forward projection: HPI latest date → today ───────────────────────
    if hpi_df is not None:
        today = datetime.now(timezone.utc).date()
        latest_hpi_date = hpi_df["Date"].iloc[-1].date()
        years_forward = (today - latest_hpi_date).days / 365.25

        if years_forward > FORWARD_PROJECTION_MIN_YEARS:
            annual_growth = compute_forward_growth_rate(hpi_df)
            forward_factor = (1 + annual_growth) ** years_forward
            df["adjusted_price"] = (df["adjusted_price"] * forward_factor).round(0)
            logger.info(
                "Forward projection: HPI latest=%s → today=%s, gap=%.2f yrs, "
                "growth=%.2f%%, factor=%.4f",
                latest_hpi_date.strftime("%b %Y"), today.strftime("%Y-%m-%d"),
                years_forward, annual_growth * 100, forward_factor,
            )
        elif years_forward < 0:
            logger.warning("HPI date %s is future, skipping forward projection", latest_hpi_date)
        else:
            logger.info("HPI data is current (gap=%.3f yrs), no projection needed", years_forward)

    # ── Compute implied weekly rent (tiered by property type) ────────────
    df["implied_weekly_rent"] = df.apply(
        lambda row: round(
            row["adjusted_price"] * YIELD_BY_TYPE.get(row["property_type"], 0.038) / 52, 2
        ),
        axis=1,
    )

    logger.info(
        "Implied rent stats: mean=£%.0f/wk, median=£%.0f/wk, min=£%.0f/wk, max=£%.0f/wk",
        df["implied_weekly_rent"].mean(),
        df["implied_weekly_rent"].median(),
        df["implied_weekly_rent"].min(),
        df["implied_weekly_rent"].max(),
    )

    # ── Aggregate per postcode ───────────────────────────────────────────
    agg_df = df.groupby("postcode").agg(
        median_sale_price=("adjusted_price", "median"),
        mean_sale_price=("adjusted_price", "mean"),
        sale_count=("adjusted_price", "count"),
        median_weekly_rent=("implied_weekly_rent", "median"),
        mean_weekly_rent=("implied_weekly_rent", "mean"),
    ).reset_index()

    # ── Normalise to 0 to 1 area_value_index ────────────────────────────────
    min_price = agg_df["median_sale_price"].min()
    max_price = agg_df["median_sale_price"].max()
    price_range = max_price - min_price if max_price > min_price else 1.0

    agg_df["area_value_index"] = (
        (agg_df["median_sale_price"] - min_price) / price_range
    ).round(4)

    logger.info(
        "Aggregated to %d postcodes. Area value index range: £%d  to  £%d",
        len(agg_df), int(min_price), int(max_price),
    )

    return agg_df


def save_clean_csv(df: pd.DataFrame, output_path: Optional[Path] = None) -> None:
    """Save cleaned Land Registry data to processed CSV."""
    path = output_path or PROCESSED_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(str(path), index=False)
    logger.info("Saved %d rows to %s", len(df), path)


def upsert_to_db(df: pd.DataFrame, db: Session) -> int:
    """Bulk upsert area values to the area_values table.

    Args:
        df: DataFrame with postcode, median_sale_price, area_value_index.
        db: SQLAlchemy session.

    Returns:
        Number of rows upserted.
    """
    import time
    from sqlalchemy.dialects.postgresql import insert
    from app.models.area_value import AreaValue

    if df.empty:
        return 0

    now = datetime.now(timezone.utc)
    start_time = time.time()

    records = []
    for _, row in df.iterrows():
        records.append({
            "postcode": row["postcode"],
            "median_sale_price": float(row["median_sale_price"]),
            "area_value_index": float(row["area_value_index"]),
            "implied_weekly_rent": float(row["median_weekly_rent"]),
            "sale_count": float(row["sale_count"]),
            "updated_at": now,
        })

    stmt = insert(AreaValue).values(records)
    stmt = stmt.on_conflict_do_update(
        index_elements=["postcode"],
        set_={
            "median_sale_price": stmt.excluded.median_sale_price,
            "area_value_index": stmt.excluded.area_value_index,
            "implied_weekly_rent": stmt.excluded.implied_weekly_rent,
            "sale_count": stmt.excluded.sale_count,
            "updated_at": stmt.excluded.updated_at,
        },
    )
    db.execute(stmt)
    db.commit()

    elapsed = time.time() - start_time
    logger.info(
        "Upserted %d area values to DB in %.1fs (min=%.4f, max=%.4f, mean=%.4f)",
        len(records), elapsed,
        df["area_value_index"].min(),
        df["area_value_index"].max(),
        df["area_value_index"].mean(),
    )
    return len(records)



def run_land_registry_pipeline(db: Optional[Session] = None) -> int:
    """Execute the full Land Registry pipeline.

    Returns:
        Number of rows processed, or 0 if skipped.
    """
    logger.info("Starting Land Registry pipeline (multi-year + HPI)")

    pp_files = glob(str(PP_DIR / "pp-*.csv"))
    if not pp_files:
        logger.info("No Price Paid files in %s, skipping pipeline.", PP_DIR)
        return 0

    own_session = db is None
    if own_session:
        db = SessionLocal()

    try:
        df = clean_land_registry_data()
        save_clean_csv(df)

        try:
            rows = upsert_to_db(df, db)
            logger.info(
                "Land Registry pipeline complete: %d postcodes, %d upserted",
                len(df), rows,
            )
        except Exception:
            logger.error("DB upsert failed, CSV was saved", exc_info=True)

        return len(df)
    except FileNotFoundError:
        return 0
    finally:
        if own_session:
            db.close()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    run_pipeline_with_tracking("land_registry_pipeline", run_land_registry_pipeline)
