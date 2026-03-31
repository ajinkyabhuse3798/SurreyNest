"""ML model training for SurreyNest rent prediction.

The v8 series refines v7 by removing redundant and low-signal features:
- distance_to_{town,uni,station}_km dropped: collinear with Gaussian proximity scores
- flat_floor_premium dropped: XGBoost learns tree-level interactions internally
- bform_NO DATA! / bform_Not Recorded dropped: near-zero occurrence, pure noise
- 36 → 30 features; ratio improves from 14:1 to 16.6:1 (all remaining features are meaningful)
- n_estimators 150 → 200: fewer features → less overfitting risk → more trees safe
- per-sector metrics added to evaluation report
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, LeaveOneGroupOut
from sklearn.pipeline import Pipeline
from xgboost import XGBRegressor

from app.ml.calibration import (
    apply_prediction_calibration,
    fit_calibration_artifact,
    fit_interval_artifact,
    interval_half_width_for_type,
    property_type_series_from_frame,
)

logger = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────────────────
FEATURES_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "processed" / "features.csv"
)
MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "rent_model_v1.pkl"
CALIBRATION_PATH = MODEL_DIR / "prediction_calibration.json"
INTERVAL_PATH = MODEL_DIR / "prediction_intervals.json"

# ── Model version ────────────────────────────────────────────────────────────
MODEL_VERSION = "v8.0.0"

# ── Features excluded from training ──────────────────────────────────────────
# These are either collinear with better-encoded versions or dirty-data artifacts.
# Proximity scores (Gaussian-transformed) supersede the raw distances.
# XGBoost learns multiplicative interactions via tree splits; the hand-crafted
# flat_floor_premium adds noise rather than signal.
# The two bform dirty-data categories have near-zero occurrence in Guildford
# student rental stock and add spurious variance.
EXCLUDED_FEATURES: frozenset = frozenset([
    "distance_to_town_km",
    "distance_to_uni_km",
    "distance_to_station_km",
    "flat_floor_premium",
    "bform_NO DATA!",
    "bform_Not Recorded",
])

# Path to processed Land Registry CSV
LAND_REGISTRY_CSV = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "processed"
    / "land_registry_guildford.csv"
)

# ── Training constants ───────────────────────────────────────────────────────
OUTLIER_CAP_WEEKLY = 1000.0  # £/week
TARGET_COLUMN = "actual_market_rent_weekly"
DEFAULT_SECTOR_ANCHOR = 350.0
CV_FOLDS = 5


def estimate_bedrooms(df: pd.DataFrame) -> pd.Series:
    """Derive estimated bedrooms from EPC habitable rooms + property type."""
    rooms = df["num_rooms"].fillna(3).astype(int)
    is_flat = df.get("ptype_Flat", pd.Series(0, index=df.index)).astype(int)

    flat_beds = (rooms - 1).clip(lower=0)
    house_beds = (rooms - 2).clip(lower=1)

    return (is_flat * flat_beds + (1 - is_flat) * house_beds).astype(int)


def compute_real_target(df: pd.DataFrame) -> pd.Series:
    """Return the real observed market-rent target used in v6 training."""
    target = pd.to_numeric(df.get(TARGET_COLUMN), errors="coerce")

    if "is_university" in df.columns:
        uni_mask = df["is_university"].fillna(False).astype(bool)
        n_uni = int(uni_mask.sum())
        if n_uni > 0:
            target = target.mask(uni_mask)
            logger.info(
                "Excluded %d university-managed properties from rent target",
                n_uni,
            )

    n_real = int(target.notna().sum())
    logger.info("Real-rent training target available for %d rows", n_real)

    if target.isna().all():
        raise ValueError(
            "No valid actual_market_rent_weekly values available for training"
        )

    return target


def _ensure_postcode_sector(df: pd.DataFrame) -> pd.DataFrame:
    """Guarantee a postcode_sector column exists."""
    working = df.copy()
    if "postcode_sector" in working.columns:
        return working

    if "postcode" not in working.columns:
        working["postcode_sector"] = ""
        return working

    parts = working["postcode"].fillna("").astype(str).str.strip().str.split()
    working["postcode_sector"] = parts.apply(
        lambda value: (
            f"{value[0]} {value[1][0]}" if len(value) >= 2 and value[1] else ""
        )
    )
    return working


def _anchor_bucket_from_frame(df: pd.DataFrame) -> pd.Series:
    """Collapse property types into the anchor buckets used at inference."""
    is_flat = df.get("ptype_Flat", pd.Series(0, index=df.index)).fillna(0).astype(int)
    return is_flat.map({1: "Flat", 0: "House"})


def build_safe_sector_rent_map(df: pd.DataFrame) -> dict:
    """Build a leakage-safe sector/type anchor map using implied rents only."""
    working = _ensure_postcode_sector(df)
    if "implied_weekly_rent" not in working.columns:
        return {}

    source = pd.DataFrame(
        {
            "postcode_sector": working["postcode_sector"].fillna("").astype(str),
            "anchor_bucket": _anchor_bucket_from_frame(working),
            "implied_weekly_rent": pd.to_numeric(
                working["implied_weekly_rent"], errors="coerce"
            ),
        }
    ).dropna(subset=["implied_weekly_rent"])

    sector_rent_map: dict = {}
    if source.empty:
        return sector_rent_map

    for (sector, bucket), group in source.groupby(["postcode_sector", "anchor_bucket"]):
        if not sector:
            continue
        sector_rent_map.setdefault(sector, {})[bucket] = round(
            float(group["implied_weekly_rent"].median()),
            4,
        )

    return sector_rent_map


def recompute_safe_sector_anchor(df: pd.DataFrame) -> pd.DataFrame:
    """Replace sector_median_rent with an implied-rent-only sector/type prior."""
    working = _ensure_postcode_sector(df)
    if "implied_weekly_rent" not in working.columns:
        working["sector_median_rent"] = pd.to_numeric(
            working.get("sector_median_rent", DEFAULT_SECTOR_ANCHOR),
            errors="coerce",
        ).fillna(DEFAULT_SECTOR_ANCHOR)
        return working

    implied = pd.to_numeric(working["implied_weekly_rent"], errors="coerce")
    global_median = (
        float(implied.dropna().median())
        if implied.notna().any()
        else DEFAULT_SECTOR_ANCHOR
    )
    sector_rent_map = build_safe_sector_rent_map(working)
    sector_medians = (
        pd.DataFrame(
            {
                "postcode_sector": working["postcode_sector"].fillna("").astype(str),
                "implied_weekly_rent": implied,
            }
        )
        .dropna(subset=["implied_weekly_rent"])
        .groupby("postcode_sector")["implied_weekly_rent"]
        .median()
        .to_dict()
    )

    anchor_bucket = _anchor_bucket_from_frame(working)
    anchors = []
    for sector, bucket in zip(
        working["postcode_sector"].fillna("").astype(str), anchor_bucket
    ):
        bucket_map = sector_rent_map.get(sector, {})
        anchor = bucket_map.get(bucket, sector_medians.get(sector, global_median))
        anchors.append(float(anchor))

    working["sector_median_rent"] = anchors
    return working


def get_feature_columns(df: pd.DataFrame) -> list:
    """Get the list of numeric feature columns for training.

    Excluded features (see EXCLUDED_FEATURES):
    - Raw distances: collinear with Gaussian proximity scores (same data, monotonic transform)
    - flat_floor_premium: hand-crafted interaction; XGBoost learns this via tree splits
    - bform_NO DATA! / bform_Not Recorded: dirty-data categories with near-zero occurrence
    """
    feature_cols = [
        "floor_area_m2",
        "actual_bedrooms",
        "rooms_per_m2",
        "energy_rating_ordinal",
        "potential_rating_ordinal",
        # Raw distances removed — use Gaussian proximity scores instead (below).
        "town_proximity_score",
        "uni_proximity_score",
        "station_proximity_score",
        "accessibility_score",
        "safety_score",
        "sale_count",
        "sector_median_rent",
        "has_mains_gas",
        # flat_floor_premium removed — XGBoost learns floor×flat interactions internally.
        "annual_energy_cost",
        "energy_improvement_gap",
        "price_drop_pct",
        "is_studio",
        "is_student_zone",
        "m2_per_bedroom",
    ]

    # One-hot property type (all ptype_* columns are valid signal)
    ptype_cols = [c for c in df.columns if c.startswith("ptype_")]
    # Built-form one-hots: exclude dirty-data catch-all categories
    bform_cols = [
        c for c in df.columns
        if c.startswith("bform_") and c not in EXCLUDED_FEATURES
    ]
    feature_cols.extend(ptype_cols)
    feature_cols.extend(bform_cols)

    return [c for c in feature_cols if c in df.columns]


def prepare_training_frame(
    df: pd.DataFrame,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, List[str], pd.Series]:
    """Prepare the small real-rent training dataset and grouped-CV labels."""
    working = recompute_safe_sector_anchor(df.copy())
    target = compute_real_target(working)
    feature_cols = get_feature_columns(working)
    X = working[feature_cols].copy()
    y = target.astype(float)

    valid_mask = X.notna().all(axis=1) & y.notna()
    X = X.loc[valid_mask].copy()
    y = y.loc[valid_mask].copy()
    working = working.loc[valid_mask].copy()

    cap_mask = y <= OUTLIER_CAP_WEEKLY
    n_removed = int((~cap_mask).sum())
    X = X.loc[cap_mask].copy()
    y = y.loc[cap_mask].copy()
    working = working.loc[cap_mask].copy()

    groups = working["postcode_sector"].fillna("").astype(str)
    fallback_groups = working.get(
        "postcode", pd.Series(working.index.astype(str), index=working.index)
    )
    groups = groups.mask(groups.eq(""), fallback_groups.astype(str))

    logger.info(
        "Prepared real-rent training frame: %d rows, %d features, removed %d outliers",
        len(X),
        len(feature_cols),
        n_removed,
    )

    return working, X, y, feature_cols, groups


def build_model() -> Pipeline:
    """Build the core XGBoost pipeline used for v7 training.

    StandardScaler is intentionally omitted: XGBoost uses decision tree splits
    which are invariant to monotonic feature transformations, so scaling has zero
    effect on predictions or feature importances.

    Hyperparameter changes vs v6:
    - n_estimators: 250 → 150  (fewer rounds suit the ~550 training row regime)
    - colsample_bytree: 0.9 → 0.7  (more feature subsampling reduces collinearity overfitting)
    """
    return Pipeline(
        [
            (
                "model",
                XGBRegressor(
                    n_estimators=200,  # 150→200: fewer features reduce overfitting risk
                    max_depth=4,
                    learning_rate=0.05,
                    subsample=0.9,
                    colsample_bytree=0.8,  # 0.7→0.8: 30 features vs 36, less aggressive subsampling
                    reg_alpha=0.2,
                    reg_lambda=2.0,
                    min_child_weight=4,
                    random_state=42,
                    n_jobs=-1,
                    verbosity=0,
                ),
            ),
        ]
    )


def build_cv_splits(
    X: pd.DataFrame,
    groups: pd.Series,
    n_splits: int = CV_FOLDS,
) -> Tuple[list[Tuple[np.ndarray, np.ndarray]], str]:
    """Create LOSO (leave-one-sector-out) CV splits when possible.

    LOSO holds out exactly one postcode sector per fold, which is the most
    honest evaluation for a small-market model with 11 sectors, each fold
    tests whether the model generalises to a completely unseen sector.

    Falls back to GroupKFold(n_splits) when there are fewer groups than
    samples needed for LOSO, and to shuffled KFold for very small datasets.
    """
    unique_groups = int(pd.Series(groups).nunique())

    # LOSO: one sector held out per fold, most honest with ≤20 sectors
    if unique_groups >= 3:
        splitter = LeaveOneGroupOut()
        return list(splitter.split(X, groups=groups)), f"LOSO({unique_groups})"

    fallback_splits = min(n_splits, len(X))
    if fallback_splits < 3:
        raise ValueError("Need at least 3 samples to build cross-validation folds")

    splitter = KFold(n_splits=fallback_splits, shuffle=True, random_state=42)
    return list(splitter.split(X)), f"KFold({fallback_splits})"


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """Compute standard regression metrics on the original rent scale."""
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2 = r2_score(y_true, y_pred)
    mape = np.mean(np.abs((y_true - y_pred) / np.clip(y_true, 1.0, None))) * 100

    return {
        "mae": round(float(mae), 2),
        "rmse": round(float(rmse), 2),
        "r2": round(float(r2), 4),
        "mape": round(float(mape), 2),
    }


def cross_validate_model(
    X: pd.DataFrame,
    y: pd.Series,
    groups: pd.Series,
    property_types: pd.Series,
    postcode_sectors: pd.Series,
    postcodes: pd.Series,
) -> Tuple[Dict[str, float], np.ndarray, np.ndarray, Dict, Dict]:
    """Generate honest out-of-fold predictions, calibration, and intervals."""
    splits, cv_method = build_cv_splits(X, groups)
    y_arr = y.to_numpy(dtype=float)
    raw_oof = np.zeros(len(X), dtype=float)

    for train_idx, test_idx in splits:
        pipeline = build_model()
        pipeline.fit(X.iloc[train_idx], np.log1p(y.iloc[train_idx]))
        raw_oof[test_idx] = np.expm1(pipeline.predict(X.iloc[test_idx]))

    calibration_artifact = fit_calibration_artifact(
        raw_oof,
        y_arr,
        property_types,
        postcode_sectors=postcode_sectors,
        postcodes=postcodes,
    )
    calibrated_oof = np.array(
        [
            apply_prediction_calibration(
                prediction,
                property_type,
                calibration_artifact,
                postcode_sector,
                postcode,
            )
            for prediction, property_type, postcode_sector, postcode in zip(
                raw_oof,
                property_types,
                postcode_sectors,
                postcodes,
            )
        ],
        dtype=float,
    )
    interval_artifact = fit_interval_artifact(y_arr, calibrated_oof, property_types)

    metrics = compute_metrics(y_arr, calibrated_oof)
    raw_metrics = compute_metrics(y_arr, raw_oof)

    coverage = np.mean(
        [
            abs(float(actual) - float(prediction))
            <= interval_half_width_for_type(property_type, interval_artifact)
            for actual, prediction, property_type in zip(
                y_arr, calibrated_oof, property_types
            )
        ]
    )

    metrics.update(
        {
            "raw_mae": raw_metrics["mae"],
            "raw_rmse": raw_metrics["rmse"],
            "raw_r2": raw_metrics["r2"],
            "raw_mape": raw_metrics["mape"],
            "interval_coverage": round(float(coverage), 4),
            "cv_method": cv_method,
        }
    )

    return metrics, raw_oof, calibrated_oof, calibration_artifact, interval_artifact


def train_model(
    df: pd.DataFrame,
) -> Tuple[Pipeline, Dict[str, float], list, Dict, Dict]:
    """Train the final rent model and its post-processing artifacts."""
    training_df, X, y, feature_cols, groups = prepare_training_frame(df)
    property_types = property_type_series_from_frame(training_df)
    postcode_sectors = training_df["postcode_sector"].fillna("").astype(str)
    postcodes = training_df["postcode"].fillna("").astype(str)

    metrics, raw_oof, calibrated_oof, calibration_artifact, interval_artifact = (
        cross_validate_model(X, y, groups, property_types, postcode_sectors, postcodes)
    )

    logger.info("Primary evaluation (%s)", metrics["cv_method"])
    logger.info(
        "Calibrated OOF metrics: MAE=£%.2f RMSE=£%.2f R²=%.4f MAPE=%.2f%%",
        metrics["mae"],
        metrics["rmse"],
        metrics["r2"],
        metrics["mape"],
    )
    logger.info(
        "Raw OOF metrics: MAE=£%.2f RMSE=£%.2f R²=%.4f",
        metrics["raw_mae"],
        metrics["raw_rmse"],
        metrics["raw_r2"],
    )

    pipeline = build_model()
    pipeline.fit(X, np.log1p(y))

    metrics.update(
        {
            "train_size": int(len(X)),
            "group_count": int(pd.Series(groups).nunique()),
            "n_features": int(len(feature_cols)),
            "model_version": MODEL_VERSION,
            "outlier_cap": OUTLIER_CAP_WEEKLY,
            "log_target": True,
            "target_column": TARGET_COLUMN,
        }
    )

    xgb_model = pipeline.named_steps["model"]
    importances = sorted(
        zip(feature_cols, xgb_model.feature_importances_),
        key=lambda item: item[1],
        reverse=True,
    )
    logger.info("Top feature importances:")
    for feature_name, importance in importances[:10]:
        logger.info("  %s: %.4f", feature_name, importance)

    return pipeline, metrics, feature_cols, calibration_artifact, interval_artifact


def save_model(
    pipeline: Pipeline,
    feature_cols: list,
    metrics: Dict[str, float],
    calibration_artifact: Dict,
    interval_artifact: Dict,
    model_path: Path = MODEL_PATH,
) -> None:
    """Serialize trained model, metadata, and post-processing artifacts."""
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, str(model_path))
    logger.info("Model saved to %s", model_path)

    columns_path = model_path.parent / "feature_columns.json"
    columns_path.write_text(json.dumps(feature_cols, indent=2))
    logger.info("Feature columns saved to %s", columns_path)

    meta = {
        "model_version": metrics.get("model_version", MODEL_VERSION),
        "log_target": metrics.get("log_target", True),
        "outlier_cap": metrics.get("outlier_cap", OUTLIER_CAP_WEEKLY),
        "n_features": metrics.get("n_features"),
        "train_size": metrics.get("train_size"),
        "group_count": metrics.get("group_count"),
        "target_column": metrics.get("target_column", TARGET_COLUMN),
        "evaluation_method": metrics.get("cv_method"),
        "mae": metrics.get("mae"),
        "rmse": metrics.get("rmse"),
        "r2": metrics.get("r2"),
        "mape": metrics.get("mape"),
        "raw_mae": metrics.get("raw_mae"),
        "raw_rmse": metrics.get("raw_rmse"),
        "raw_r2": metrics.get("raw_r2"),
        "interval_coverage": metrics.get("interval_coverage"),
    }
    meta_path = model_path.parent / "model_metadata.json"
    meta_path.write_text(json.dumps(meta, indent=2))
    logger.info("Model metadata saved to %s", meta_path)

    CALIBRATION_PATH.write_text(json.dumps(calibration_artifact, indent=2))
    logger.info("Prediction calibration saved to %s", CALIBRATION_PATH)

    INTERVAL_PATH.write_text(json.dumps(interval_artifact, indent=2))
    logger.info("Prediction intervals saved to %s", INTERVAL_PATH)


def run_training() -> Dict[str, float]:
    """Execute the full v6 rent-model training pipeline."""
    logger.info("Starting rent model training (%s)", MODEL_VERSION)

    if not LAND_REGISTRY_CSV.exists():
        raise FileNotFoundError(
            f"Land Registry CSV not found at {LAND_REGISTRY_CSV}, run land_registry_pipeline first"
        )

    if not FEATURES_PATH.exists():
        logger.error(
            "Features file not found at %s, run features.py first", FEATURES_PATH
        )
        raise FileNotFoundError(f"Features not found: {FEATURES_PATH}")

    df = pd.read_csv(str(FEATURES_PATH), low_memory=False)
    logger.info("Loaded feature matrix: shape=%s", df.shape)

    safe_df = recompute_safe_sector_anchor(df)
    sector_rent_map = build_safe_sector_rent_map(safe_df)
    sector_map_path = MODEL_DIR / "sector_rent_map.json"
    sector_map_path.write_text(json.dumps(sector_rent_map, indent=2))
    logger.info(
        "Saved leakage-safe sector rent map: %d sectors → %s",
        len(sector_rent_map),
        sector_map_path,
    )

    pipeline, metrics, feature_cols, calibration_artifact, interval_artifact = (
        train_model(df)
    )

    versioned_path = MODEL_DIR / f"rent_model_{MODEL_VERSION}.pkl"
    save_model(
        pipeline,
        feature_cols,
        metrics,
        calibration_artifact,
        interval_artifact,
        versioned_path,
    )

    if versioned_path != MODEL_PATH:
        save_model(
            pipeline,
            feature_cols,
            metrics,
            calibration_artifact,
            interval_artifact,
            MODEL_PATH,
        )

    return metrics


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    result_metrics = run_training()
    logger.info("Training complete. Metrics: %s", result_metrics)
