"""Land Registry pipeline: multi-year Price Paid Data + HPI time-adjustment.

Loads Price Paid CSVs (pp-*.csv) from data/raw/land_registry/,
filters to Guildford core (GU1–GU5, GU7), removes outliers,
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

# Guildford gross rental yield (GU1 town-centre typical: 3–3.5%, not 4%)
# Using 3.5% corrects the systematic over-estimation of implied_weekly_rent
# that caused the v2.0.0 model to underpredict rent for expensive GU1 postcodes.
GROSS_YIELD = 0.035


def _normalise_postcode(pc: str) -> str:
    """Normalise postcode to 'GU1 1AA' format."""
    pc = str(pc).strip().upper().replace("  ", " ")
    if " " not in pc and len(pc) >= 4:
        return pc[:-3] + " " + pc[-3:]
    return pc


# ═════════════════════════════════════════════════════════════════════════════
# HPI LOADING
# ═════════════════════════════════════════════════════════════════════════════
def load_hpi_guildford() -> Optional[pd.DataFrame]:
    """Load UK HPI CSVs and return the Guildford monthly series.

    Returns:
        DataFrame with ['Date', 'Index', 'AveragePrice'] for Guildford,
        sorted by date, duplicates dropped (latest file wins).
        Returns None if no HPI files found.
    """
    files = sorted(glob(str(HPI_DIR / "UK-HPI*.csv")))
    if not files:
        logger.warning("No HPI files found in %s — skipping time-adjustment", HPI_DIR)
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
    hpi_gu["Index"] = pd.to_numeric(hpi_gu["Index"], errors="coerce")

    logger.info(
        "Loaded HPI Guildford: %d months (%s → %s)",
        len(hpi_gu),
        hpi_gu["Date"].iloc[0].strftime("%b %Y"),
        hpi_gu["Date"].iloc[-1].strftime("%b %Y"),
    )
    return hpi_gu[["Date", "Index", "AveragePrice"]].copy()


def compute_hpi_adjustment(sale_date: pd.Series, hpi_df: pd.DataFrame) -> pd.Series:
    """Compute HPI adjustment factor to normalise prices to latest month.

    For each sale date, finds the closest HPI month and computes:
        factor = latest_index / sale_month_index

    So a property sold when index was 80 and latest is 100 gets factor=1.25.

    Args:
        sale_date: Series of sale dates.
        hpi_df: Guildford HPI DataFrame with 'Date' and 'Index'.

    Returns:
        Series of adjustment factors (1.0 if no adjustment possible).
    """
    latest_index = hpi_df["Index"].iloc[-1]

    # Build a monthly index lookup
    hpi_df = hpi_df.copy()
    hpi_df["year_month"] = hpi_df["Date"].dt.to_period("M")
    index_map = dict(zip(hpi_df["year_month"], hpi_df["Index"]))

    def _get_factor(dt):
        if pd.isna(dt):
            return 1.0
        ym = pd.Period(dt, freq="M")
        idx = index_map.get(ym)
        if idx is None or idx == 0 or pd.isna(idx):
            return 1.0
        return latest_index / idx

    return sale_date.apply(_get_factor)


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
        df["hpi_factor"] = compute_hpi_adjustment(df["date_of_transfer"], hpi_df)
        df["adjusted_price"] = (df["price"] * df["hpi_factor"]).round(0)
        logger.info(
            "HPI adjustment applied: mean factor=%.3f, median factor=%.3f",
            df["hpi_factor"].mean(),
            df["hpi_factor"].median(),
        )
    else:
        df["adjusted_price"] = df["price"]
        logger.warning("No HPI data — using raw prices (no time-adjustment)")

    # ── Compute implied weekly rent ──────────────────────────────────────
    df["implied_weekly_rent"] = (df["adjusted_price"] * GROSS_YIELD / 52).round(2)

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

    # ── Normalise to 0–1 area_value_index ────────────────────────────────
    min_price = agg_df["median_sale_price"].min()
    max_price = agg_df["median_sale_price"].max()
    price_range = max_price - min_price if max_price > min_price else 1.0

    agg_df["area_value_index"] = (
        (agg_df["median_sale_price"] - min_price) / price_range
    ).round(4)

    logger.info(
        "Aggregated to %d postcodes. Area value index range: £%d – £%d",
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
        logger.info("No Price Paid files in %s — skipping pipeline.", PP_DIR)
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
            logger.error("DB upsert failed — CSV was saved", exc_info=True)

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
