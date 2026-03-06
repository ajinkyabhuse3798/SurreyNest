"""ML model training: rent prediction using XGBoost.

MODE F (v3.2.0): Upgrades from sklearn GradientBoostingRegressor to XGBoost
with log-transformed target and outlier capping.

Three improvements over v3.1.0:
  1. XGBoost (faster, better regularisation, handles missing values natively)
  2. Log-transform target: trains on log1p(rent), predicts with expm1()
     - Skewness 2.60 → 0.24 (near-normal)
     - Model learns proportional errors, not absolute
  3. Outlier cap at £1,000/wk: removes 7.1% mansion properties irrelevant
     to student housing

IMPORTANT: EPC 'num_rooms' = total HABITABLE rooms (bedrooms + living rooms +
large kitchens), NOT bedrooms. This model derives estimated_bedrooms using:
  - Flats:  est_bedrooms = max(0, habitable_rooms - 1)
  - Houses: est_bedrooms = max(1, habitable_rooms - 2)

Keeps v3.0.0 fix: area_value_index is NOT a training feature (prevents
quasi-circular leakage).
"""

import json
import logging
from pathlib import Path
from typing import Dict, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor

logger = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────────────────
FEATURES_PATH = Path(__file__).resolve().parents[2] / "data" / "processed" / "features.csv"
MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "rent_model_v1.pkl"

# ── Model version ────────────────────────────────────────────────────────────
MODEL_VERSION = "v3.2.0"  # MODE F — XGBoost + log-transform + outlier cap

# Path to processed Land Registry CSV
LAND_REGISTRY_CSV = Path(__file__).resolve().parents[2] / "data" / "processed" / "land_registry_guildford.csv"

# ── Outlier cap ──────────────────────────────────────────────────────────────
# Properties above this threshold are luxury mansions, irrelevant to students.
# Removing them reduces noise and lets the model focus on the £50–1,000 range.
OUTLIER_CAP_WEEKLY = 1000.0  # £/week


def estimate_bedrooms(df: pd.DataFrame) -> pd.Series:
    """Derive estimated bedrooms from EPC habitable rooms + property type.

    EPC 'num_rooms' counts ALL habitable rooms (bedrooms + living rooms +
    kitchens if > 13m²), NOT just bedrooms. This function estimates the
    actual bedroom count:

      - Flats:  est_bedrooms = max(0, habitable_rooms - 1)
                (subtract 1 living room; studios have 0 bedrooms)
      - Houses: est_bedrooms = max(1, habitable_rooms - 2)
                (subtract living room + kitchen/dining)

    Args:
        df: DataFrame with 'num_rooms' and ptype_* one-hot columns.

    Returns:
        Series of estimated bedroom counts (int).
    """
    rooms = df["num_rooms"].fillna(3).astype(int)
    is_flat = df.get("ptype_Flat", pd.Series(0, index=df.index)).astype(int)

    # Flats: subtract 1 (living room). Studios (1 hab room) → 0 bedrooms.
    flat_beds = (rooms - 1).clip(lower=0)
    # Houses: subtract 2 (living room + kitchen/dining). Min 1 bedroom.
    house_beds = (rooms - 2).clip(lower=1)

    return (is_flat * flat_beds + (1 - is_flat) * house_beds).astype(int)


def compute_real_target(df: pd.DataFrame) -> pd.Series:
    """Compute rent target using Land Registry implied rents (MODE E/F).

    Uses implied_weekly_rent (postcode median, HPI-adjusted at 3.5% yield) as
    the base anchor. This captures real postcode-level market pricing.

    Then applies structured property-level adjustments:
      - Floor area relative to sector median (bigger → more rent)
      - Property type (Detached +18%, Semi +8%, Flat −10%, Terraced 0%)
      - Room count vs sector median (+4% per extra habitable room)
      - Energy efficiency ordinal (A/B small positive; E/F/G small negative)

    Args:
        df: Feature DataFrame (must contain implied_weekly_rent, postcode_sector,
            floor_area_m2, num_rooms, and ptype_* one-hot columns).

    Returns:
        Series of weekly rent targets in £, rounded to 2 d.p.

    Raises:
        ValueError: If implied_weekly_rent column is missing or all-NaN.
    """
    if "implied_weekly_rent" not in df.columns or df["implied_weekly_rent"].isna().all():
        raise ValueError(
            "implied_weekly_rent not found in features — "
            "run land_registry_pipeline and features.py first"
        )

    rng = np.random.RandomState(42)
    base = df["implied_weekly_rent"].copy()

    # Guard: postcode_sector must exist for group-relative calculations
    if "postcode_sector" not in df.columns:
        logger.warning("postcode_sector missing — using dataset-level medians for adjustments")
        df = df.copy()
        df["postcode_sector"] = "GU_FALLBACK"

    # ── Floor area premium ────────────────────────────────────────────────
    sector_area_median = df.groupby("postcode_sector")["floor_area_m2"].transform("median")
    area_ratio = (df["floor_area_m2"] / sector_area_median.clip(lower=20)).clip(0.5, 2.0)
    area_adj = (area_ratio - 1.0) * 0.40

    # ── Property type premium ─────────────────────────────────────────────
    type_adj = pd.Series(0.0, index=df.index)
    if "ptype_Detached" in df.columns:
        type_adj += df["ptype_Detached"] * 0.18
    if "ptype_Semi-Detached" in df.columns:
        type_adj += df["ptype_Semi-Detached"] * 0.08
    if "ptype_Flat" in df.columns:
        type_adj += df["ptype_Flat"] * (-0.10)

    # ── Room count premium ────────────────────────────────────────────────
    sector_room_median = df.groupby("postcode_sector")["num_rooms"].transform("median")
    room_adj = ((df["num_rooms"] - sector_room_median) * 0.04).clip(-0.15, 0.20)

    # ── Energy efficiency premium ─────────────────────────────────────────
    energy_adj = pd.Series(0.0, index=df.index)
    if "energy_rating_ordinal" in df.columns:
        energy_adj = ((df["energy_rating_ordinal"] - 3) * 0.02).clip(-0.06, 0.06)

    # ── Combine and apply ─────────────────────────────────────────────────
    total_adj = (area_adj + type_adj + room_adj + energy_adj).clip(-0.35, 0.60)
    noise = 1 + rng.normal(0, 0.03, size=len(df))
    target = (base * (1 + total_adj) * noise).clip(lower=50, upper=2_500)

    logger.info(
        "MODE F target stats: mean=£%.1f  median=£%.1f  std=£%.1f  min=£%.1f  max=£%.1f",
        target.mean(), target.median(), target.std(), target.min(), target.max(),
    )
    return target.round(2)


def get_feature_columns(df: pd.DataFrame) -> list:
    """Get the list of numeric feature columns for training.

    v3.2.0 features (same as v3.1.0):
    - NO area_value_index (quasi-circular with target via sale prices)
    - NO iphrp_growth_pct (constant across all rows = zero information)
    - NO is_hmo (0.00% importance, inaccurate postcode-level matching)
    - estimated_bedrooms (v3.1.0: derived from habitable rooms)
    - rooms_per_m2 (v3.0.0: space efficiency signal)

    Note: implied_weekly_rent is the training TARGET — it must NEVER
    appear here as a feature.

    Args:
        df: Feature DataFrame.

    Returns:
        List of column names to use as features.
    """
    feature_cols = [
        "floor_area_m2",
        "num_rooms",                 # EPC habitable rooms (NOT bedrooms)
        "estimated_bedrooms",        # v3.1.0: derived from habitable rooms + property type
        "rooms_per_m2",              # v3.0.0: space efficiency
        "energy_rating_ordinal",
        "potential_rating_ordinal",
        "distance_to_town_km",
        "distance_to_uni_km",
        "distance_to_station_km",
        "safety_score",
        "sale_count",
    ]

    # Add one-hot property type columns
    ptype_cols = [c for c in df.columns if c.startswith("ptype_")]
    feature_cols.extend(ptype_cols)

    # Only include columns that exist in the DataFrame
    return [c for c in feature_cols if c in df.columns]


def train_model(df: pd.DataFrame) -> Tuple[Pipeline, Dict[str, float], list]:
    """Train the rent prediction model using XGBoost with log-transformed target.

    Pipeline:
      1. Compute target from implied_weekly_rent
      2. Cap outliers at £OUTLIER_CAP_WEEKLY/wk (remove luxury mansions)
      3. Log-transform: y_train = log1p(target)
      4. Train XGBRegressor on log-space target
      5. Evaluate on original scale: expm1(y_pred) vs y_test

    Args:
        df: Feature DataFrame (output of features.py).

    Returns:
        Tuple of (trained pipeline, metrics dict, feature_cols list).
    """
    logger.info("MODE F: XGBoost + log-transform + outlier cap (version %s)", MODEL_VERSION)

    # ── Add derived features ─────────────────────────────────────────────
    df = df.copy()
    df["rooms_per_m2"] = (df["num_rooms"] / df["floor_area_m2"].clip(lower=10)).round(4)
    df["estimated_bedrooms"] = estimate_bedrooms(df)

    # ── Compute target ─────────────────────────────────────────────────
    target = compute_real_target(df)

    # ── Get features ─────────────────────────────────────────────────────
    feature_cols = get_feature_columns(df)
    X = df[feature_cols].copy()
    y = target

    # Drop rows with NaN in features or target
    valid_mask = X.notna().all(axis=1) & y.notna()
    X = X[valid_mask]
    y = y[valid_mask]

    # ── Cap outliers ─────────────────────────────────────────────────────
    # Remove luxury properties above cap — irrelevant to student housing.
    cap_mask = y <= OUTLIER_CAP_WEEKLY
    n_removed = (~cap_mask).sum()
    X = X[cap_mask]
    y = y[cap_mask]
    logger.info(
        "Outlier cap: removed %d properties > £%.0f/wk (%.1f%%), %d remain",
        n_removed, OUTLIER_CAP_WEEKLY,
        n_removed / (len(y) + n_removed) * 100, len(y),
    )

    # ── Log-transform target ─────────────────────────────────────────────
    # Reduces skewness from ~2.6 to ~0.2 (near-normal distribution).
    # Model trains on log1p(rent), predictions are inverse-transformed
    # with expm1() in predict.py.
    y_log = np.log1p(y)

    logger.info("Training data: %d samples, %d features", len(X), len(feature_cols))
    logger.info("Features: %s", feature_cols)
    logger.info(
        "Target stats (original): mean=%.1f, median=%.1f, std=%.1f, min=%.1f, max=%.1f",
        y.mean(), y.median(), y.std(), y.min(), y.max(),
    )
    logger.info(
        "Target stats (log-space): mean=%.2f, median=%.2f, std=%.2f, skew=%.2f",
        y_log.mean(), y_log.median(), y_log.std(), y_log.skew(),
    )

    # ── Train/test split ─────────────────────────────────────────────────
    X_train, X_test, y_train_log, y_test_log = train_test_split(
        X, y_log, test_size=0.2, random_state=42
    )
    # Keep original-scale test values for metric computation
    y_test_orig = np.expm1(y_test_log)

    logger.info("Train: %d, Test: %d", len(X_train), len(X_test))

    # ── Build pipeline ───────────────────────────────────────────────────
    # StandardScaler kept for consistency, though XGBoost handles unscaled
    # features well. The scaler helps with feature interpretation.
    pipeline = Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "model",
                XGBRegressor(
                    n_estimators=500,
                    max_depth=6,
                    learning_rate=0.05,
                    subsample=0.8,
                    colsample_bytree=0.8,
                    reg_alpha=0.1,        # L1 regularisation
                    reg_lambda=1.0,       # L2 regularisation
                    min_child_weight=5,   # Prevent overfitting on small groups
                    random_state=42,
                    n_jobs=-1,            # Use all CPU cores
                    verbosity=0,          # Suppress XGBoost warnings
                ),
            ),
        ]
    )

    # ── Train on log-space target ────────────────────────────────────────
    logger.info("Training XGBRegressor on log-transformed target...")
    pipeline.fit(X_train, y_train_log)

    # ── Evaluate on original scale ───────────────────────────────────────
    y_pred_log = pipeline.predict(X_test)
    y_pred_orig = np.expm1(y_pred_log)  # Inverse transform

    mae = mean_absolute_error(y_test_orig, y_pred_orig)
    rmse = np.sqrt(mean_squared_error(y_test_orig, y_pred_orig))
    r2 = r2_score(y_test_orig, y_pred_orig)
    mape = np.mean(np.abs((y_test_orig - y_pred_orig) / y_test_orig.clip(lower=1))) * 100

    metrics = {
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "r2": round(r2, 4),
        "mape": round(mape, 2),
        "train_size": len(X_train),
        "test_size": len(X_test),
        "n_features": len(feature_cols),
        "model_version": MODEL_VERSION,
        "outlier_cap": OUTLIER_CAP_WEEKLY,
        "log_target": True,
    }

    logger.info("=" * 60)
    logger.info("MODEL EVALUATION RESULTS (MODE F — v3.2.0)")
    logger.info("=" * 60)
    logger.info("MAE:  £%.2f/week", mae)
    logger.info("RMSE: £%.2f/week", rmse)
    logger.info("R²:   %.4f", r2)
    logger.info("MAPE: %.1f%%", mape)
    logger.info("=" * 60)

    # ── Feature importance ───────────────────────────────────────────────
    xgb_model = pipeline.named_steps["model"]
    importances = sorted(
        zip(feature_cols, xgb_model.feature_importances_),
        key=lambda x: x[1],
        reverse=True,
    )
    logger.info("Top feature importances:")
    for feat, imp in importances[:10]:
        logger.info("  %s: %.4f", feat, imp)

    return pipeline, metrics, feature_cols


def save_model(
    pipeline: Pipeline,
    feature_cols: list,
    metrics: Dict[str, float] = None,
    model_path: Path = MODEL_PATH,
) -> None:
    """Serialize trained model, feature columns, and metadata to disk.

    Args:
        pipeline: Trained sklearn Pipeline.
        feature_cols: List of feature column names used for training.
        metrics: Optional metrics dict with log_target flag.
        model_path: Destination path for the .pkl file.
    """
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, str(model_path))
    logger.info("Model saved to %s", model_path)

    # Save feature columns for predict.py alignment
    columns_path = model_path.parent / "feature_columns.json"
    columns_path.write_text(json.dumps(feature_cols, indent=2))
    logger.info("Feature columns saved to %s (%d columns)", columns_path, len(feature_cols))

    # Save model metadata (log_target flag, outlier cap, etc.)
    if metrics:
        meta = {
            "model_version": metrics.get("model_version", MODEL_VERSION),
            "log_target": metrics.get("log_target", False),
            "outlier_cap": metrics.get("outlier_cap", None),
            "n_features": metrics.get("n_features"),
            "r2": metrics.get("r2"),
            "mae": metrics.get("mae"),
        }
        meta_path = model_path.parent / "model_metadata.json"
        meta_path.write_text(json.dumps(meta, indent=2))
        logger.info("Model metadata saved to %s", meta_path)


def run_training() -> Dict[str, float]:
    """Execute the full training pipeline using MODE F (XGBoost + log-transform).

    Returns:
        Metrics dict with MAE, RMSE, R², MAPE.

    Raises:
        FileNotFoundError: If features.csv or land_registry_guildford.csv is missing.
    """
    logger.info("Starting model training (MODE F — XGBoost + log + cap, v3.2.0)")

    if not LAND_REGISTRY_CSV.exists():
        raise FileNotFoundError(
            f"Land Registry CSV not found at {LAND_REGISTRY_CSV} — "
            "run land_registry_pipeline first"
        )

    if not FEATURES_PATH.exists():
        logger.error("Features file not found at %s — run features.py first", FEATURES_PATH)
        raise FileNotFoundError(f"Features not found: {FEATURES_PATH}")

    df = pd.read_csv(str(FEATURES_PATH))
    logger.info("Loaded feature matrix: shape=%s", df.shape)

    # Train
    pipeline, metrics, feature_cols = train_model(df)

    # Save versioned archive (e.g. rent_model_v3.2.0.pkl)
    versioned_path = MODEL_DIR / f"rent_model_{MODEL_VERSION}.pkl"
    save_model(pipeline, feature_cols, metrics, versioned_path)

    # Also save to the fixed MODEL_PATH so evaluate.py / predict.py always find it
    if versioned_path != MODEL_PATH:
        save_model(pipeline, feature_cols, metrics, MODEL_PATH)

    return metrics


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    metrics = run_training()
    logger.info("Training complete. Metrics: %s", metrics)
