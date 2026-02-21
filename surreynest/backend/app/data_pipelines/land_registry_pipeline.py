# TODO: Run when land_registry_ppd_2024.csv is available
"""Land Registry pipeline: clean Price Paid Data and compute area value index.

Downloads and processes Land Registry Price Paid Data for Surrey.
Filters to GU postcodes, post-2020 dates, computes median sale price
per postcode, and normalises to 0–1 area_value_index feature.

This pipeline gracefully skips if the raw file does not exist.
"""

import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.data_pipelines.utils import run_pipeline_with_tracking

logger = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────────────────
RAW_PATH = Path(__file__).resolve().parents[2] / "data" / "raw" / "land_registry_ppd_2024.csv"
PROCESSED_PATH = Path(__file__).resolve().parents[2] / "data" / "processed" / "land_registry_clean.csv"

# ── Land Registry CSV columns (no headers in bulk download) ──────────────────
COLUMN_NAMES = [
    "transaction_id",
    "price",
    "date_of_transfer",
    "postcode",
    "property_type",
    "old_new",
    "duration",
    "paon",
    "saon",
    "street",
    "locality",
    "town",
    "district",
    "county",
    "ppd_category",
    "record_status",
]

# Property type code mapping
PROPERTY_TYPE_MAP = {
    "D": "Detached",
    "S": "Semi-Detached",
    "T": "Terraced",
    "F": "Flat",
    "O": "Other",
}


def clean_land_registry_data(raw_path: Optional[Path] = None) -> pd.DataFrame:
    """Load and clean Land Registry Price Paid Data.

    Args:
        raw_path: Path to raw CSV. Defaults to project path.

    Returns:
        Cleaned DataFrame with median prices per postcode.

    Raises:
        FileNotFoundError: If raw file doesn't exist.
    """
    path = raw_path or RAW_PATH
    logger.info("Loading Land Registry data from %s", path)

    if not path.exists():
        logger.warning(
            "Raw file not found at %s — skipping Land Registry pipeline. "
            "Download the file and re-run.",
            path,
        )
        raise FileNotFoundError(f"Raw file not found: {path}")

    # Try reading with and without headers
    try:
        df = pd.read_csv(str(path), low_memory=False)
        # If first column looks like a UUID, it has no headers
        if len(df.columns) >= 16 and str(df.columns[0]).count("-") >= 3:
            df = pd.read_csv(str(path), header=None, names=COLUMN_NAMES, low_memory=False)
    except Exception:
        df = pd.read_csv(str(path), header=None, names=COLUMN_NAMES, low_memory=False)

    initial_count = len(df)
    logger.info("Loaded %d raw Land Registry records", initial_count)

    # ── Filter: GU postcodes only ────────────────────────────────────────
    df["postcode"] = df["postcode"].fillna("").astype(str)
    df = df[df["postcode"].str.upper().str.startswith("GU")]
    logger.info("After GU postcode filter: %d rows", len(df))

    # ── Filter: post-2020 ────────────────────────────────────────────────
    df["date_of_transfer"] = pd.to_datetime(df["date_of_transfer"], errors="coerce")
    df = df[df["date_of_transfer"] >= "2020-01-01"]
    logger.info("After post-2020 filter: %d rows", len(df))

    # ── Compute median sale price per postcode ───────────────────────────
    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df = df.dropna(subset=["price"])

    median_prices = df.groupby("postcode")["price"].median().reset_index()
    median_prices.columns = ["postcode", "median_sale_price"]

    # ── Normalise to 0–1 area_value_index ────────────────────────────────
    min_price = median_prices["median_sale_price"].min()
    max_price = median_prices["median_sale_price"].max()
    price_range = max_price - min_price if max_price > min_price else 1.0

    median_prices["area_value_index"] = (
        (median_prices["median_sale_price"] - min_price) / price_range
    ).round(4)

    logger.info(
        "Computed area_value_index for %d postcodes (range: £%d – £%d)",
        len(median_prices),
        min_price,
        max_price,
    )

    return median_prices


def save_clean_csv(df: pd.DataFrame, output_path: Optional[Path] = None) -> None:
    """Save cleaned Land Registry data to processed CSV.

    Args:
        df: Cleaned DataFrame with postcode and area_value_index.
        output_path: Destination path. Defaults to project path.
    """
    path = output_path or PROCESSED_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(str(path), index=False)
    logger.info("Saved %d rows to %s", len(df), path)


def run_land_registry_pipeline(db: Optional[Session] = None) -> int:
    """Execute the full Land Registry pipeline.

    Skips gracefully if the raw file is not available.

    Args:
        db: SQLAlchemy session (unused currently — no DB table for this).

    Returns:
        Number of rows processed, or 0 if skipped.
    """
    logger.info("Starting Land Registry pipeline")

    if not RAW_PATH.exists():
        logger.info(
            "Raw file %s not found — skipping pipeline. "
            "Will run when data is available.",
            RAW_PATH,
        )
        return 0

    try:
        df = clean_land_registry_data()
        save_clean_csv(df)
        logger.info("Land Registry pipeline complete: %d postcodes processed", len(df))
        return len(df)
    except FileNotFoundError:
        return 0


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    run_pipeline_with_tracking("land_registry_pipeline", run_land_registry_pipeline)
