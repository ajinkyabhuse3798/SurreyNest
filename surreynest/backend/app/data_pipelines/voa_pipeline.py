"""VOA pipeline: download ONS PRMS statistics and extract Guildford rent bands.

The ONS Private Rental Market Summary Statistics XLS uses one sheet per
bedroom category (not one wide row with bedroom columns):

    Table2.3  → One Bedroom          (bedroom_count = 1)
    Table2.4  → Two Bedrooms         (bedroom_count = 2)
    Table2.5  → Three Bedrooms       (bedroom_count = 3)
    Table2.6  → Four or more Bedrooms (bedroom_count = 4 and 5)
    Table2.7  → All categories       (not used for per-bedroom bands)

Each sheet has the same column layout (header at row 6):
    col 0: empty | col 1: LA Code | col 2: Area Code | col 3: Area |
    col 4: Count | col 5: Mean | col 6: Lower quartile |
    col 7: Median  ← this is what we extract
    col 8: Upper quartile

Outputs:
- ``data/processed/voa_rental_stats_clean.csv`` , full multi-column record
- ``data/raw/voa_rental_stats_2024.csv``         , slim (bedroom_count, weekly_rent)
  This slim CSV is the file ``train.py`` reads as ``VOA_PATH`` for MODE B.

Usage:
    python -m app.data_pipelines.voa_pipeline
"""

import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
import requests
from sqlalchemy.orm import Session

from app.data_pipelines.utils import run_pipeline_with_tracking
from app.database import SessionLocal

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
GUILDFORD_LA_CODE = "E07000209"
GUILDFORD_LA_NAME = "Guildford"
MONTHLY_TO_WEEKLY = 4.333  # ONS publishes monthly rents; divide for weekly

ONS_URL = (
    "https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/housing/"
    "datasets/privaterentalmarketsummarystatisticsinengland/"
    "october2022toseptember2023/privaterentalmarketstatistics231220.xls"
)

# Each bedroom count maps to the sheet name patterns to try (case-insensitive
# substring match, robust to minor edition renaming like "Table 2.3" vs "Table2.3")
BEDROOM_SHEET_PATTERNS: Dict[int, List[str]] = {
    1: ["2.3", "one bedroom", "1 bedroom"],
    2: ["2.4", "two bedroom", "2 bedroom"],
    3: ["2.5", "three bedroom", "3 bedroom"],
    4: ["2.6", "four", "4 bedroom", "4 or more"],
    # 5+ bedrooms: reuse the 4+ sheet (no separate 5-bed sheet in ONS data)
}

# Sanity bounds for monthly rent (£/month), rejects missing/corrupt cells
VALID_MONTHLY_RANGE = (0.0, 20_000.0)

# ── Paths ─────────────────────────────────────────────────────────────────────
_DATA_ROOT = Path(__file__).resolve().parents[2] / "data"

RAW_PATH = _DATA_ROOT / "raw" / "voa_rental_stats_2024.xls"
PROCESSED_PATH = _DATA_ROOT / "processed" / "voa_rental_stats_clean.csv"

# Slim CSV consumed by train.py, must match VOA_PATH defined in train.py
VOA_CSV_PATH = _DATA_ROOT / "raw" / "voa_rental_stats_2024.csv"


# =============================================================================
# Step 1: Download
# =============================================================================


def download_voa_xls(url: str = ONS_URL, dest: Path = RAW_PATH) -> Path:
    """Download the ONS PRMS XLS file with 3-attempt exponential backoff.

    Uses ``requests.get`` with ``stream=True`` for large binary files.
    Does NOT use ``api_call_with_retry``, that helper returns parsed JSON.

    Args:
        url: URL of the ONS XLS file.
        dest: Destination path to save the raw binary.

    Returns:
        Path to the saved file.

    Raises:
        requests.RequestException: If all three attempts fail.
    """
    dest.parent.mkdir(parents=True, exist_ok=True)

    for attempt in range(3):
        try:
            logger.info("Downloading VOA XLS (attempt %d): %s", attempt + 1, url)
            response = requests.get(url, stream=True, timeout=60)
            response.raise_for_status()

            with dest.open("wb") as fh:
                for chunk in response.iter_content(chunk_size=8192):
                    fh.write(chunk)

            logger.info("Downloaded %d bytes → %s", dest.stat().st_size, dest)
            return dest

        except requests.RequestException as exc:
            if attempt == 2:
                logger.error(
                    "Failed to download VOA XLS after 3 attempts",
                    exc_info=True,
                )
                raise
            wait = 2**attempt  # 1 s, 2 s, 4 s
            logger.warning(
                "Download attempt %d failed (%s), retrying in %ds",
                attempt + 1,
                exc,
                wait,
            )
            time.sleep(wait)

    raise requests.RequestException("All download retries exhausted")  # unreachable


# =============================================================================
# Step 2: Parse XLS, per-sheet strategy
# =============================================================================


def _get_sheet_names(xls_path: Path) -> List[str]:
    """Return all sheet names from an XLS or XLSX file.

    Args:
        xls_path: Path to the spreadsheet file.

    Returns:
        List of sheet name strings.
    """
    suffix = xls_path.suffix.lower()
    if suffix == ".xlsx":
        import openpyxl  # noqa: PLC0415

        wb = openpyxl.load_workbook(str(xls_path), read_only=True, data_only=True)
        names: List[str] = list(wb.sheetnames)
        wb.close()
        return names

    import xlrd  # noqa: PLC0415

    return xlrd.open_workbook(str(xls_path)).sheet_names()


def _find_sheet_for_bedroom(
    sheet_names: List[str], bed_count: int
) -> Optional[str]:
    """Match a sheet name for the given bedroom count using pattern list.

    Args:
        sheet_names: All sheet names in the workbook.
        bed_count: Bedroom count (1 to 4).

    Returns:
        Matching sheet name, or ``None`` if no pattern matches.
    """
    patterns = BEDROOM_SHEET_PATTERNS.get(bed_count, [])
    for pattern in patterns:
        for name in sheet_names:
            if pattern.lower() in name.lower():
                logger.info(
                    "  bedroom=%d → sheet '%s' (pattern '%s')",
                    bed_count,
                    name,
                    pattern,
                )
                return name
    return None


def _extract_median_from_sheet(
    xls_path: Path,
    sheet_name: str,
    engine: str,
) -> Optional[float]:
    """Extract Guildford's median monthly rent from a single per-bedroom sheet.

    Scans for the Guildford row by LA code, then finds the Median column
    header dynamically (falling back to column index 7, the known position).

    Args:
        xls_path: Path to the spreadsheet file.
        sheet_name: Name of the sheet to read.
        engine: pandas engine, ``"xlrd"`` for .xls, ``"openpyxl"`` for .xlsx.

    Returns:
        Median monthly rent in £, or ``None`` if data is suppressed (``".."``).

    Raises:
        ValueError: If the Guildford row cannot be found in the sheet.
    """
    df_raw = pd.read_excel(
        str(xls_path),
        sheet_name=sheet_name,
        header=None,
        dtype=str,
        engine=engine,
    )

    # Find Guildford row by scanning for the LA code
    guildford_row_idx: Optional[int] = None
    for row_idx in range(len(df_raw)):
        if GUILDFORD_LA_CODE in " ".join(str(v) for v in df_raw.iloc[row_idx]):
            guildford_row_idx = row_idx
            break

    if guildford_row_idx is None:
        raise ValueError(
            f"Guildford ({GUILDFORD_LA_CODE}) not found in sheet '{sheet_name}'."
        )

    # Locate the "Median" column header: scan the first 20 rows (covers fixed
    # header at row 6) then fall back to the 15 rows just above the data row.
    median_col_idx: Optional[int] = None
    search_ranges = [range(min(20, guildford_row_idx)), range(max(0, guildford_row_idx - 15), guildford_row_idx)]
    for search_range in search_ranges:
        for row_idx in search_range:
            for col_idx, cell_val in enumerate(df_raw.iloc[row_idx]):
                if str(cell_val).strip().lower() == "median":
                    median_col_idx = col_idx
                    break
            if median_col_idx is not None:
                break
        if median_col_idx is not None:
            break

    if median_col_idx is None:
        # Fallback: column 7 is the Median in the known ONS layout
        median_col_idx = 7
        logger.warning(
            "Could not auto-detect Median column in '%s', using col 7 fallback",
            sheet_name,
        )

    raw_val = str(df_raw.iloc[guildford_row_idx, median_col_idx]).strip()

    # Suppressed values are published as ".." when sample size is too small
    if raw_val in ("..", "nan", "", "None"):
        logger.warning(
            "Median value suppressed ('%s') in sheet '%s' for Guildford, skipping",
            raw_val,
            sheet_name,
        )
        return None

    try:
        return float(raw_val.replace(",", "").replace("£", ""))
    except ValueError:
        logger.warning(
            "Cannot parse median value '%s' in sheet '%s', skipping",
            raw_val,
            sheet_name,
        )
        return None


def clean_voa_data(xls_path: Path = RAW_PATH) -> pd.DataFrame:
    """Parse the ONS PRMS XLS and extract Guildford weekly rent bands.

    Strategy: iterate over per-bedroom sheets (Table2.3 through Table2.6),
    extract the median monthly rent for Guildford, and convert to weekly.
    Bedroom 5 reuses the "four or more bedrooms" sheet (Table2.6).

    Args:
        xls_path: Path to the raw XLS/XLSX file.

    Returns:
        DataFrame with columns: ``local_authority_code``,
        ``local_authority_name``, ``bedroom_count``, ``monthly_rent``,
        ``weekly_rent``, ``source_sheet``.

    Raises:
        FileNotFoundError: If ``xls_path`` does not exist.
        ValueError: If no valid rent values can be extracted.
    """
    if not xls_path.exists():
        raise FileNotFoundError(f"VOA XLS file not found: {xls_path}")

    suffix = xls_path.suffix.lower()
    engine = "openpyxl" if suffix == ".xlsx" else "xlrd"

    sheet_names = _get_sheet_names(xls_path)
    logger.info("Available sheets in %s: %s", xls_path.name, sheet_names)

    records = []

    # Extract from per-bedroom sheets (1 to 4 have distinct sheets; 5 reuses 4+)
    extracted: Dict[int, float] = {}
    for bed_count in [1, 2, 3, 4]:
        sheet_name = _find_sheet_for_bedroom(sheet_names, bed_count)
        if sheet_name is None:
            logger.warning(
                "No sheet found for bedroom_count=%d (patterns=%s), skipping",
                bed_count,
                BEDROOM_SHEET_PATTERNS.get(bed_count),
            )
            continue

        monthly = _extract_median_from_sheet(xls_path, sheet_name, engine)
        if monthly is None:
            continue

        if not (VALID_MONTHLY_RANGE[0] < monthly <= VALID_MONTHLY_RANGE[1]):
            logger.warning(
                "Monthly rent £%.2f outside valid range %s for bed_count=%d, skipping",
                monthly,
                VALID_MONTHLY_RANGE,
                bed_count,
            )
            continue

        extracted[bed_count] = monthly
        weekly = round(monthly / MONTHLY_TO_WEEKLY, 2)
        records.append(
            {
                "local_authority_code": GUILDFORD_LA_CODE,
                "local_authority_name": GUILDFORD_LA_NAME,
                "bedroom_count": bed_count,
                "monthly_rent": round(monthly, 2),
                "weekly_rent": weekly,
                "source_sheet": sheet_name,
            }
        )
        logger.info(
            "  %d bed: monthly=£%.2f  weekly=£%.2f  (sheet=%s)",
            bed_count,
            monthly,
            weekly,
            sheet_name,
        )

    # Bedroom 5: reuse 4+ data if available
    if 4 in extracted:
        monthly_5 = extracted[4]
        weekly_5 = round(monthly_5 / MONTHLY_TO_WEEKLY, 2)
        sheet_4 = _find_sheet_for_bedroom(sheet_names, 4) or "Table2.6"
        records.append(
            {
                "local_authority_code": GUILDFORD_LA_CODE,
                "local_authority_name": GUILDFORD_LA_NAME,
                "bedroom_count": 5,
                "monthly_rent": round(monthly_5, 2),
                "weekly_rent": weekly_5,
                "source_sheet": sheet_4,
            }
        )
        logger.info(
            "  5 bed: monthly=£%.2f  weekly=£%.2f  (reused 4+ sheet)",
            monthly_5,
            weekly_5,
        )

    if not records:
        raise ValueError(
            "No valid rent values extracted from any bedroom sheet.  "
            "Check BEDROOM_SHEET_PATTERNS and the ONS file structure."
        )

    df = pd.DataFrame(records)
    logger.info("Extracted %d bedroom band records for Guildford", len(df))
    return df


# =============================================================================
# Steps 3 & 4: Save CSVs
# =============================================================================


def save_clean_csv(df: pd.DataFrame, output_path: Path = PROCESSED_PATH) -> None:
    """Save the full cleaned dataset to the processed CSV.

    Args:
        df: Cleaned DataFrame with all columns.
        output_path: Destination path.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(str(output_path), index=False)
    logger.info("Saved full clean CSV: %d rows → %s", len(df), output_path)


def save_voa_for_train(df: pd.DataFrame, output_path: Path = VOA_CSV_PATH) -> None:
    """Save a slim two-column CSV consumed by ``train.py`` for MODE B.

    The file contains only ``bedroom_count`` and ``weekly_rent`` (5 rows for
    bedrooms 1 to 5).  ``train.py`` reads this path via ``VOA_PATH``, keeping
    the file slim ensures the training script stays DB-free.

    Args:
        df: Cleaned DataFrame containing at least ``bedroom_count`` and
            ``weekly_rent`` columns.
        output_path: Destination path, must match ``train.py``'s ``VOA_PATH``.
    """
    slim = df[["bedroom_count", "weekly_rent"]].copy()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    slim.to_csv(str(output_path), index=False)
    logger.info(
        "Saved train CSV (%d rows) → %s:\n%s",
        len(slim),
        output_path,
        slim.to_string(index=False),
    )


# =============================================================================
# Step 5: DB Upsert
# =============================================================================


def upsert_to_db(df: pd.DataFrame, db: Session) -> int:
    """Upsert VOA rent bands to the ``voa_rent_bands`` table.

    Uses PostgreSQL ``ON CONFLICT DO UPDATE`` targeting the
    ``uq_voa_la_bedroom`` unique constraint on
    ``(local_authority_code, bedroom_count)``.

    Args:
        df: Cleaned DataFrame from ``clean_voa_data()``.
        db: SQLAlchemy session.

    Returns:
        Number of rows upserted.
    """
    from sqlalchemy.dialects.postgresql import insert  # noqa: PLC0415

    from app.models.voa_rent_band import VoaRentBand  # noqa: PLC0415

    if df.empty:
        return 0

    now = datetime.now(timezone.utc)
    records = [
        {
            "local_authority_code": row["local_authority_code"],
            "local_authority_name": row["local_authority_name"],
            "bedroom_count": int(row["bedroom_count"]),
            "monthly_rent": float(row["monthly_rent"]),
            "weekly_rent": float(row["weekly_rent"]),
            "source_sheet": row.get("source_sheet"),
            "updated_at": now,
        }
        for _, row in df.iterrows()
    ]

    stmt = insert(VoaRentBand).values(records)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_voa_la_bedroom",
        set_={
            "local_authority_name": stmt.excluded.local_authority_name,
            "monthly_rent": stmt.excluded.monthly_rent,
            "weekly_rent": stmt.excluded.weekly_rent,
            "source_sheet": stmt.excluded.source_sheet,
            "updated_at": stmt.excluded.updated_at,
        },
    )
    db.execute(stmt)
    db.commit()

    logger.info("Upserted %d VOA rent band records to DB", len(records))
    return len(records)


# =============================================================================
# Main pipeline
# =============================================================================


def run_voa_pipeline(db: Optional[Session] = None) -> int:
    """Execute the full VOA rental statistics pipeline.

    Steps:
        1. Download XLS if not already cached (3-retry backoff).
        2. Parse and extract Guildford rent bands (per-bedroom sheets).
        3. Save full processed CSV.
        4. Save slim CSV for ``train.py`` MODE B.
        5. Upsert to ``voa_rent_bands`` table (error-isolated, CSVs always
           saved even if the DB is unavailable).

    Args:
        db: SQLAlchemy session.  Creates one internally if not provided.

    Returns:
        Number of bedroom-band rows processed.
    """
    logger.info("Starting VOA pipeline")

    # Step 1: Download if not cached
    if not RAW_PATH.exists():
        logger.info("Raw XLS not found, downloading from ONS")
        download_voa_xls()
    else:
        logger.info("Using cached XLS at %s", RAW_PATH)

    # Step 2: Parse
    df = clean_voa_data(RAW_PATH)

    # Steps 3 & 4: Always save CSVs before DB so they are useful even if DB is down
    save_clean_csv(df)
    save_voa_for_train(df)

    # Step 5: DB upsert (error-isolated)
    own_session = db is None
    if own_session:
        db = SessionLocal()

    try:
        rows = upsert_to_db(df, db)
        logger.info("VOA pipeline complete: %d bedroom bands upserted to DB", rows)
    except Exception:
        logger.error(
            "DB upsert failed, CSVs were saved successfully", exc_info=True
        )
        rows = len(df)
    finally:
        if own_session:
            db.close()  # type: ignore[union-attr]

    return rows


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    run_pipeline_with_tracking("voa_pipeline", run_voa_pipeline)
