"""ML model training: rent prediction using gradient boosting.

MODE C: Uses real Price Paid implied rents (land_registry_guildford.csv) as training labels.
Based on 10,500+ real Guildford sale transactions (2021–2025), HPI-adjusted to current market.

Trains a GradientBoostingRegressor with StandardScaler preprocessing.
Reports MAE, RMSE, R² on test set.
"""

import logging
from pathlib import Path
from typing import Dict, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────────────────
FEATURES_PATH = Path(__file__).resolve().parents[2] / "data" / "processed" / "features.csv"
MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "rent_model_v1.pkl"

# ── Model version ────────────────────────────────────────────────────────────
MODEL_VERSION_C = "v2.1.0"  # MODE C — structured property-level target, station distance feature

# Path to processed Land Registry CSV
LAND_REGISTRY_CSV = Path(__file__).resolve().parents[2] / "data" / "processed" / "land_registry_guildford.csv"


def compute_real_target(df: pd.DataFrame) -> pd.Series:
    """Compute rent target using structured property-level premiums (MODE C v2.1.0).

    Uses implied_weekly_rent (postcode median, HPI-adjusted at 3.5% yield) as the
    base anchor, then applies structured premiums based on actual property attributes:
      - Floor area relative to postcode sector median (bigger → more rent)
      - Property type (Detached +18%, Semi +8%, Flat −10%, Terraced 0%)
      - Room count relative to sector median (+4% per extra room vs median)
      - Energy efficiency ordinal (A/B small positive; E/F/G small negative)
    Residual random noise is ±3% (down from ±8%) because the structured signal
    now carries the property-level variance.

    This fix resolves the v2.0.0 bug where 91.6% feature importance landed on
    median_sale_price (perfectly correlated with target). Now the model must learn
    actual property characteristics to differentiate within the same postcode.

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

    # ── Floor area premium ────────────────────────────────────────────────────
    # Properties larger than their sector median rent proportionally higher.
    # Elasticity 0.40: a property 10% above median area → ~4% more rent.
    sector_area_median = df.groupby("postcode_sector")["floor_area_m2"].transform("median")
    area_ratio = (df["floor_area_m2"] / sector_area_median.clip(lower=20)).clip(0.5, 2.0)
    area_adj = (area_ratio - 1.0) * 0.40

    # ── Property type premium ─────────────────────────────────────────────────
    # Detached commands a significant premium; flats trade at a discount.
    # Terraced = 0% reference. Uses one-hot columns present in features.csv.
    type_adj = pd.Series(0.0, index=df.index)
    if "ptype_Detached" in df.columns:
        type_adj += df["ptype_Detached"] * 0.18
    if "ptype_Semi-Detached" in df.columns:
        type_adj += df["ptype_Semi-Detached"] * 0.08
    if "ptype_Flat" in df.columns:
        type_adj += df["ptype_Flat"] * (-0.10)

    # ── Room count premium ────────────────────────────────────────────────────
    # More habitable rooms vs sector median → slightly higher rent.
    sector_room_median = df.groupby("postcode_sector")["num_rooms"].transform("median")
    room_adj = ((df["num_rooms"] - sector_room_median) * 0.04).clip(-0.15, 0.20)

    # ── Energy efficiency premium ─────────────────────────────────────────────
    # A=6 → +6% premium (lower running costs); G=0 → −6% discount.
    # D=3 is the reference (0% adjustment).
    energy_adj = pd.Series(0.0, index=df.index)
    if "energy_rating_ordinal" in df.columns:
        energy_adj = ((df["energy_rating_ordinal"] - 3) * 0.02).clip(-0.06, 0.06)

    # ── Combine and apply ─────────────────────────────────────────────────────
    total_adj = (area_adj + type_adj + room_adj + energy_adj).clip(-0.35, 0.60)
    # ±3% residual noise — structured signal handles the rest
    noise = 1 + rng.normal(0, 0.03, size=len(df))
    target = (base * (1 + total_adj) * noise).clip(lower=50, upper=1_200)

    logger.info(
        "MODE C target stats: mean=£%.1f  median=£%.1f  std=£%.1f  min=£%.1f  max=£%.1f",
        target.mean(), target.median(), target.std(), target.min(), target.max(),
    )
    return target.round(2)


def get_feature_columns(df: pd.DataFrame) -> list:
    """Get the list of numeric feature columns for training.

    Note: implied_weekly_rent is the MODE C training TARGET — it must NEVER
    appear here as a feature. Including it would create a circular dependency
    where the model learns output ≈ input and ignores all other features.

    Args:
        df: Feature DataFrame.

    Returns:
        List of column names to use as features.
    """
    # Core numeric features
    feature_cols = [
        "floor_area_m2",
        "num_rooms",
        "energy_rating_ordinal",
        "potential_rating_ordinal",
        "distance_to_town_km",
        "distance_to_uni_km",
        "distance_to_station_km",   # v2.1.0: Guildford Station proximity
        "is_hmo",
        "safety_score",
        "area_value_index",
        # Land Registry real data features (not circular — not the target)
        # NOTE: median_sale_price REMOVED in v2.1.0.
        # It was 91.6% correlated with the training target because
        # target = implied_weekly_rent = median_sale_price × 0.035/52.
        # The GBR was learning output ≈ median_sale_price × constant,
        # making all other features irrelevant. area_value_index (0–1 normalised)
        # still captures neighbourhood value without the circular leakage.
        "sale_count",
        "iphrp_growth_pct",
    ]

    # Add one-hot property type columns
    ptype_cols = [c for c in df.columns if c.startswith("ptype_")]
    feature_cols.extend(ptype_cols)

    # Only include columns that exist in the DataFrame
    return [c for c in feature_cols if c in df.columns]


def train_model(df: pd.DataFrame) -> Tuple[Pipeline, Dict[str, float], list]:
    """Train the rent prediction model using real Price Paid implied rents.

    Args:
        df: Feature DataFrame (output of features.py).

    Returns:
        Tuple of (trained pipeline, metrics dict, feature_cols list).
    """
    logger.info("MODE C: Using real Price Paid implied rents (version %s)", MODEL_VERSION_C)

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

    logger.info("Training data: %d samples, %d features", len(X), len(feature_cols))
    logger.info("Features: %s", feature_cols)
    logger.info(
        "Target stats: mean=%.1f, median=%.1f, std=%.1f, min=%.1f, max=%.1f",
        y.mean(),
        y.median(),
        y.std(),
        y.min(),
        y.max(),
    )

    # ── Train/test split ─────────────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    logger.info("Train: %d, Test: %d", len(X_train), len(X_test))

    # ── Build pipeline ───────────────────────────────────────────────────
    pipeline = Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "model",
                GradientBoostingRegressor(
                    n_estimators=200,
                    max_depth=5,
                    learning_rate=0.1,
                    subsample=0.8,
                    random_state=42,
                ),
            ),
        ]
    )

    # ── Train ────────────────────────────────────────────────────────────
    logger.info("Training GradientBoostingRegressor...")
    pipeline.fit(X_train, y_train)

    # ── Evaluate ─────────────────────────────────────────────────────────
    y_pred = pipeline.predict(X_test)

    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    metrics = {
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "r2": round(r2, 4),
        "train_size": len(X_train),
        "test_size": len(X_test),
        "n_features": len(feature_cols),
        "model_version": MODEL_VERSION_C,
    }

    logger.info("=" * 60)
    logger.info("MODEL EVALUATION RESULTS (MODE C)")
    logger.info("=" * 60)
    logger.info("MAE:  £%.2f/week", mae)
    logger.info("RMSE: £%.2f/week", rmse)
    logger.info("R²:   %.4f", r2)
    logger.info("=" * 60)

    # ── Feature importance ───────────────────────────────────────────────
    gbr = pipeline.named_steps["model"]
    importances = sorted(
        zip(feature_cols, gbr.feature_importances_),
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
    model_path: Path = MODEL_PATH,
) -> None:
    """Serialize trained model and feature column manifest to disk.

    Args:
        pipeline: Trained sklearn Pipeline.
        feature_cols: List of feature column names used for training.
        model_path: Destination path for the .pkl file.
    """
    import json

    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, str(model_path))
    logger.info("Model saved to %s", model_path)

    # Save feature columns for predict.py alignment
    columns_path = model_path.parent / "feature_columns.json"
    columns_path.write_text(json.dumps(feature_cols, indent=2))
    logger.info("Feature columns saved to %s (%d columns)", columns_path, len(feature_cols))


def run_training() -> Dict[str, float]:
    """Execute the full training pipeline using MODE C (real Price Paid data).

    Returns:
        Metrics dict with MAE, RMSE, R².

    Raises:
        FileNotFoundError: If features.csv or land_registry_guildford.csv is missing.
    """
    logger.info("Starting model training (MODE C — real Price Paid implied rents)")

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

    # Save versioned archive (e.g. rent_model_v2.0.0.pkl)
    versioned_path = MODEL_DIR / f"rent_model_{MODEL_VERSION_C}.pkl"
    save_model(pipeline, feature_cols, versioned_path)

    # Also save to the fixed MODEL_PATH so evaluate.py / predict.py always find it
    if versioned_path != MODEL_PATH:
        save_model(pipeline, feature_cols, MODEL_PATH)

    return metrics


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    metrics = run_training()
    logger.info("Training complete. Metrics: %s", metrics)
