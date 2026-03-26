"""Comprehensive EDA across all SurreyNest datasets.

Run:  python -m app.data_pipelines.eda_all_datasets

Audits Land Registry Price Paid, HPI, IPHRP, and existing DB tables
(properties, crime_data, hmo_records, flood_risk). Prints a clear
console report with stats, anomalies, and cross-dataset consistency.
"""

import logging
import sys
from glob import glob
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────────────────
DATA_RAW = Path(__file__).resolve().parents[2] / "data" / "raw"
PP_DIR = DATA_RAW / "land_registry"
HPI_DIR = DATA_RAW / "hpi"
IPHRP_DIR = DATA_RAW / "iphrp"

# Allowed Guildford postcode districts
ALLOWED_DISTRICTS = {"GU1", "GU2", "GU3", "GU4", "GU5", "GU7"}

# Land Registry columns (no header in bulk downloads)
PP_COLUMNS = [
    "transaction_id", "price", "date_of_transfer", "postcode",
    "property_type", "old_new", "duration", "paon", "saon",
    "street", "locality", "town", "district", "county",
    "ppd_category", "record_status",
]

PP_TYPE_MAP = {"D": "Detached", "S": "Semi-Detached", "T": "Terraced", "F": "Flat", "O": "Other"}


def _hr(title: str) -> None:
    """Print section header."""
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")


def _subhr(title: str) -> None:
    print(f"\n  --- {title} ---")


# ═════════════════════════════════════════════════════════════════════════════
# 1. LAND REGISTRY PRICE PAID
# ═════════════════════════════════════════════════════════════════════════════
def eda_price_paid() -> pd.DataFrame:
    """Load, filter, and profile all Price Paid CSVs."""
    _hr("1. LAND REGISTRY PRICE PAID DATA")

    files = sorted(glob(str(PP_DIR / "pp-*.csv")))
    if not files:
        print("  ❌ No Price Paid files found in data/raw/land_registry/")
        return pd.DataFrame()

    print(f"  Found {len(files)} file(s):")
    for f in files:
        size_mb = Path(f).stat().st_size / (1024 * 1024)
        print(f"    • {Path(f).name} ({size_mb:.0f} MB)")

    # Load all files
    dfs = []
    for f in files:
        try:
            df = pd.read_csv(f, header=None, names=PP_COLUMNS, low_memory=False)
            df["_source_file"] = Path(f).name
            dfs.append(df)
        except Exception as e:
            print(f"  ⚠️  Error reading {Path(f).name}: {e}")

    if not dfs:
        return pd.DataFrame()

    df = pd.concat(dfs, ignore_index=True)
    print(f"\n  Total raw rows (all UK): {len(df):,}")

    # ── Filter to Guildford ──────────────────────────────────────────────
    df["postcode"] = df["postcode"].fillna("").astype(str).str.strip().str.upper()
    df["_district"] = df["postcode"].str.split(r"\s+", n=1).str[0]
    df_gu = df[df["_district"].isin(ALLOWED_DISTRICTS)].copy()
    print(f"  After Guildford filter (GU1-5, GU7): {len(df_gu):,}")

    if df_gu.empty:
        print("  ❌ No Guildford rows found!")
        return df_gu

    # ── Parse price and date ─────────────────────────────────────────────
    df_gu["price"] = pd.to_numeric(df_gu["price"], errors="coerce")
    df_gu["date_of_transfer"] = pd.to_datetime(df_gu["date_of_transfer"], errors="coerce")
    df_gu["year"] = df_gu["date_of_transfer"].dt.year

    # ── Anomaly detection ────────────────────────────────────────────────
    _subhr("Anomalies")
    null_price = df_gu["price"].isna().sum()
    null_date = df_gu["date_of_transfer"].isna().sum()
    null_postcode = (df_gu["postcode"] == "").sum()
    very_low = (df_gu["price"] < 30_000).sum()
    very_high = (df_gu["price"] > 3_000_000).sum()

    print(f"  Null prices:       {null_price}")
    print(f"  Null dates:        {null_date}")
    print(f"  Empty postcodes:   {null_postcode}")
    print(f"  Price < £30k:      {very_low}  ← likely distressed/family sales")
    print(f"  Price > £3M:       {very_high} ← luxury outliers")

    # ── Stats ────────────────────────────────────────────────────────────
    _subhr("Price Distribution (Guildford)")
    clean = df_gu.dropna(subset=["price"])
    print(f"  Count:    {len(clean):,}")
    print(f"  Min:      £{clean['price'].min():,.0f}")
    print(f"  25th:     £{clean['price'].quantile(0.25):,.0f}")
    print(f"  Median:   £{clean['price'].median():,.0f}")
    print(f"  75th:     £{clean['price'].quantile(0.75):,.0f}")
    print(f"  Max:      £{clean['price'].max():,.0f}")
    print(f"  Mean:     £{clean['price'].mean():,.0f}")
    print(f"  Std Dev:  £{clean['price'].std():,.0f}")

    _subhr("By Year")
    year_stats = clean.groupby("year")["price"].agg(["count", "median", "mean"]).round(0)
    for yr, row in year_stats.iterrows():
        print(f"  {int(yr)}: {int(row['count']):,} sales, median £{row['median']:,.0f}, mean £{row['mean']:,.0f}")

    _subhr("By Property Type")
    df_gu["property_type_label"] = df_gu["property_type"].map(PP_TYPE_MAP).fillna("Unknown")
    type_stats = clean.copy()
    type_stats["property_type_label"] = type_stats["property_type"].map(PP_TYPE_MAP).fillna("Unknown")
    for ptype, grp in type_stats.groupby("property_type_label"):
        print(f"  {ptype:15s}: {len(grp):,} sales, median £{grp['price'].median():,.0f}")

    _subhr("By Postcode District")
    for dist, grp in clean.groupby("_district"):
        print(f"  {dist}: {len(grp):,} sales, median £{grp['price'].median():,.0f}")

    return df_gu


# ═════════════════════════════════════════════════════════════════════════════
# 2. UK HOUSE PRICE INDEX
# ═════════════════════════════════════════════════════════════════════════════
def eda_hpi() -> pd.DataFrame:
    """Load HPI files and extract Guildford series."""
    _hr("2. UK HOUSE PRICE INDEX (HPI)")

    files = sorted(glob(str(HPI_DIR / "UK-HPI*.csv")))
    if not files:
        print("  ❌ No HPI files found in data/raw/hpi/")
        return pd.DataFrame()

    print(f"  Found {len(files)} file(s):")
    for f in files:
        print(f"    • {Path(f).name}")

    # Load and merge, the 2025 file extends the 2024 file
    dfs = []
    for f in files:
        df = pd.read_csv(f, low_memory=False)
        dfs.append(df)

    hpi = pd.concat(dfs, ignore_index=True)

    # Extract Guildford
    hpi_gu = hpi[hpi["RegionName"].str.strip().str.lower() == "guildford"].copy()
    hpi_gu["Date"] = pd.to_datetime(hpi_gu["Date"], format="%d/%m/%Y", errors="coerce")
    hpi_gu = hpi_gu.drop_duplicates(subset=["Date"], keep="last")  # 2025 file takes precedence
    hpi_gu = hpi_gu.sort_values("Date")

    print(f"\n  Total UK rows: {len(hpi):,}")
    print(f"  Guildford rows: {len(hpi_gu):,}")
    print(f"  Date range: {hpi_gu['Date'].min().strftime('%b %Y')} → {hpi_gu['Date'].max().strftime('%b %Y')}")

    if hpi_gu.empty:
        return hpi_gu

    _subhr("Guildford Average House Price (Recent)")
    recent = hpi_gu[hpi_gu["Date"] >= "2021-01-01"].copy()
    for _, row in recent.iterrows():
        if pd.notna(row.get("AveragePrice")):
            print(f"  {row['Date'].strftime('%b %Y')}: £{row['AveragePrice']:,.0f}  ({row.get('12m%Change', 'N/A')}% YoY)")

    _subhr("Anomalies")
    null_price = hpi_gu["AveragePrice"].isna().sum()
    print(f"  Null AveragePrice: {null_price}")

    # Latest index for time-adjustment reference
    latest = hpi_gu.iloc[-1]
    print(f"\n  Latest data point: {latest['Date'].strftime('%b %Y')}")
    print(f"  Latest avg price: £{latest['AveragePrice']:,.0f}")
    print(f"  Latest index:     {latest.get('Index', 'N/A')}")

    return hpi_gu


# ═════════════════════════════════════════════════════════════════════════════
# 3. IPHRP (RENTAL PRICE INDEX)
# ═════════════════════════════════════════════════════════════════════════════
def eda_iphrp() -> pd.DataFrame:
    """Load IPHRP XLSX and extract South East rental index."""
    _hr("3. IPHRP, INDEX OF PRIVATE HOUSING RENTAL PRICES")

    xlsx_files = list(IPHRP_DIR.glob("*.xlsx"))
    if not xlsx_files:
        print("  ❌ No IPHRP XLSX files found in data/raw/iphrp/")
        return pd.DataFrame()

    f = xlsx_files[0]
    print(f"  File: {f.name}")

    try:
        # Table 1 has the index values; skip header rows
        df = pd.read_excel(str(f), sheet_name="Table 1", header=None)

        # Find the row with actual column headers (contains "South East")
        header_row = None
        for i in range(min(10, len(df))):
            row_str = " ".join([str(v) for v in df.iloc[i].values])
            if "South East" in row_str:
                header_row = i
                break

        if header_row is None:
            print("  ⚠️  Could not find 'South East' column in Table 1")
            return pd.DataFrame()

        # Re-read with correct header
        df = pd.read_excel(str(f), sheet_name="Table 1", header=header_row)
        # First column is date/time period
        date_col = df.columns[0]
        df = df.rename(columns={date_col: "period"})

        # Extract South East column
        se_col = [c for c in df.columns if "south east" in str(c).lower()]
        if not se_col:
            print("  ⚠️  No 'South East' column found")
            return pd.DataFrame()

        result = df[["period", se_col[0]]].copy()
        result.columns = ["period", "south_east_index"]
        result = result.dropna(subset=["south_east_index"])
        result["south_east_index"] = pd.to_numeric(result["south_east_index"], errors="coerce")
        result = result.dropna(subset=["south_east_index"])

        print(f"  South East rental index rows: {len(result)}")
        if not result.empty:
            print(f"  Period range: {result['period'].iloc[0]} → {result['period'].iloc[-1]}")
            print(f"  Latest index value: {result['south_east_index'].iloc[-1]:.1f} (base=100 in Jan 2015)")

            _subhr("Recent Values")
            for _, row in result.tail(12).iterrows():
                print(f"  {row['period']}: {row['south_east_index']:.1f}")

        return result

    except Exception as e:
        print(f"  ❌ Error reading IPHRP: {e}")
        return pd.DataFrame()


# ═════════════════════════════════════════════════════════════════════════════
# 4. EXISTING DATABASE AUDIT
# ═════════════════════════════════════════════════════════════════════════════
def eda_database() -> None:
    """Audit existing data in PostgreSQL."""
    _hr("4. EXISTING DATABASE AUDIT")

    try:
        from sqlalchemy import func
        from app.database import SessionLocal
        from app.models.property import Property
        from app.models.hmo_record import HmoRecord
        from app.models.crime_data import CrimeData
    except Exception as e:
        print(f"  ⚠️  Cannot connect to DB: {e}")
        return

    db = SessionLocal()
    try:
        # ── Properties ───────────────────────────────────────────────────
        _subhr("Properties Table")
        total = db.query(func.count(Property.uprn)).scalar()
        print(f"  Total: {total:,}")

        null_lat = db.query(func.count(Property.uprn)).filter(Property.lat == None).scalar()
        null_area = db.query(func.count(Property.uprn)).filter(Property.floor_area_m2 == None).scalar()
        null_rooms = db.query(func.count(Property.uprn)).filter(Property.num_rooms == None).scalar()
        null_epc = db.query(func.count(Property.uprn)).filter(Property.energy_rating == None).scalar()

        print(f"  Null lat/lng:       {null_lat} ({null_lat/total*100:.1f}%)")
        print(f"  Null floor_area:    {null_area} ({null_area/total*100:.1f}%)")
        print(f"  Null num_rooms:     {null_rooms} ({null_rooms/total*100:.1f}%)")
        print(f"  Null energy_rating: {null_epc} ({null_epc/total*100:.1f}%)")

        # Outliers
        tiny = db.query(func.count(Property.uprn)).filter(Property.floor_area_m2 < 10).scalar()
        huge_rooms = db.query(func.count(Property.uprn)).filter(Property.num_rooms > 15).scalar()
        print(f"\n  ⚠️  Floor area < 10m²: {tiny} (data errors)")
        print(f"  ⚠️  Rooms > 15:        {huge_rooms} (likely commercial)")

        # Tenure breakdown
        _subhr("Tenure Labels (Inconsistency Check)")
        tenure_counts = db.query(Property.tenure, func.count(Property.uprn)).group_by(Property.tenure).all()
        for t, c in sorted(tenure_counts, key=lambda x: -x[1]):
            label = t or "NULL"
            flag = " ⚠️  DUPLICATE?" if label in ["rented (private)", "rented (social)"] else ""
            print(f"  {label:50s}: {c:6,}{flag}")

        # EPC distribution
        _subhr("EPC Rating Distribution")
        epc_counts = db.query(Property.energy_rating, func.count(Property.uprn)).group_by(Property.energy_rating).order_by(Property.energy_rating).all()
        for r, c in epc_counts:
            print(f"  {r or 'NULL':5s}: {c:6,} ({c/total*100:.1f}%)")

        # ── HMO ──────────────────────────────────────────────────────────
        _subhr("HMO Records")
        hmo_total = db.query(func.count(HmoRecord.id)).scalar()
        hmo_active = db.query(func.count(HmoRecord.id)).filter(HmoRecord.is_active == True).scalar()
        print(f"  Total: {hmo_total}, Active: {hmo_active}")

        # ── Crime ────────────────────────────────────────────────────────
        _subhr("Crime Data")
        crime_total = db.query(func.count(CrimeData.id)).scalar()
        crime_sectors = db.query(func.count(func.distinct(CrimeData.postcode_sector))).scalar()
        print(f"  Total records: {crime_total:,}")
        print(f"  Postcode sectors covered: {crime_sectors}")

    finally:
        db.close()


# ═════════════════════════════════════════════════════════════════════════════
# 5. CROSS-DATASET CONSISTENCY
# ═════════════════════════════════════════════════════════════════════════════
def eda_consistency(pp_df: pd.DataFrame) -> None:
    """Check postcode overlap between EPC and Price Paid."""
    _hr("5. CROSS-DATASET CONSISTENCY")

    if pp_df.empty:
        print("  ⚠️  No Price Paid data to compare")
        return

    try:
        from app.database import SessionLocal
        from app.models.property import Property
    except Exception:
        print("  ⚠️  Cannot connect to DB for consistency check")
        return

    db = SessionLocal()
    try:
        # Get all EPC postcodes
        epc_postcodes = set(
            r[0] for r in db.query(Property.postcode).distinct().all() if r[0]
        )

        # Get all Price Paid postcodes (already Guildford filtered)
        pp_postcodes = set(pp_df["postcode"].dropna().unique())

        overlap = epc_postcodes & pp_postcodes
        epc_only = epc_postcodes - pp_postcodes
        pp_only = pp_postcodes - epc_postcodes

        print(f"  EPC postcodes:            {len(epc_postcodes):,}")
        print(f"  Price Paid postcodes:      {len(pp_postcodes):,}")
        print(f"  Overlap (both datasets):   {len(overlap):,} ({len(overlap)/max(len(epc_postcodes),1)*100:.1f}% of EPC)")
        print(f"  EPC-only (no sale data):   {len(epc_only):,}")
        print(f"  PP-only (no EPC data):     {len(pp_only):,}")

        if len(overlap) / max(len(epc_postcodes), 1) < 0.5:
            print("  ⚠️  Low overlap, many EPC properties have no sale price data")
        else:
            print("  ✅ Good overlap, most EPC postcodes have sale data")

    finally:
        db.close()


# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════
def main():
    print("\n" + "█" * 70)
    print("  SURREYNEST, COMPREHENSIVE DATA AUDIT")
    print("  " + "─" * 40)
    print("  Guildford focus: GU1, GU2, GU3, GU4, GU5, GU7")
    print("█" * 70)

    pp_df = eda_price_paid()
    eda_hpi()
    eda_iphrp()
    eda_database()
    eda_consistency(pp_df)

    _hr("AUDIT COMPLETE")
    print("  Review the output above for anomalies flagged with ⚠️")
    print("  Run the updated pipelines to clean and process datasets.\n")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.WARNING,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    main()
