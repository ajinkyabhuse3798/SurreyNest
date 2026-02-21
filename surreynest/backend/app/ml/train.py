"""ML model training: rent prediction using gradient boosting.

Two modes of operation:
- MODE A (current): Uses rule-based TEMPORARY_TARGET as training labels.
  Base: floor_area_m2 × £18/m²/month, adjusted for property_type and distance_to_uni_km.
  This is a rough proxy to let us train and test the pipeline end to end.

- MODE B (when VOA data arrives): Reads from voa_rental_stats_2024.csv,
  replaces TEMPORARY_TARGET with real VOA median rents. Model version bumps to v1.1.0.
  # TODO: Implement MODE B when VOA data is available.

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
VOA_PATH = Path(__file__).resolve().parents[2] / "data" / "raw" / "voa_rental_stats_2024.csv"

# ── Model version ────────────────────────────────────────────────────────────
MODEL_VERSION = "v1.0.0"  # Bumps to v1.1.0 when VOA data is used

# ── TEMPORARY_TARGET adjustments ─────────────────────────────────────────────
# Base rate: £18/m²/month (rough Guildford average)
BASE_RATE_PER_M2 = 18.0

# Property type multipliers
PROPERTY_TYPE_MULTIPLIERS = {
    "ptype_Flat": 1.05,
    "ptype_Terraced": 0.95,
    "ptype_Semi-Detached": 0.90,
    "ptype_Detached": 0.85,
    "ptype_Other": 0.90,
}


def compute_temporary_target(df: pd.DataFrame) -> pd.Series:
    """Compute a rule-based temporary rent target for MODE A training.

    TEMPORARY_TARGET = floor_area_m2 × £18/m²/month, adjusted for:
    - property_type: flats higher per m², detached lower per m²
    - distance_to_uni_km: closer to university = higher rent (student premium)

    Args:
        df: Feature DataFrame.

    Returns:
        Series of estimated monthly rent in £.
    """
    # Base rent from floor area
    rent = df["floor_area_m2"] * BASE_RATE_PER_M2

    # Property type adjustment
    type_multiplier = pd.Series(1.0, index=df.index)
    for col, mult in PROPERTY_TYPE_MULTIPLIERS.items():
        if col in df.columns:
            type_multiplier = type_multiplier.where(df[col] != 1, mult)

    rent = rent * type_multiplier

    # Distance to uni adjustment: closer = higher
    # Formula: multiply by (1.2 - 0.04 × distance_km), clamped to [0.85, 1.25]
    if "distance_to_uni_km" in df.columns:
        uni_factor = (1.2 - 0.04 * df["distance_to_uni_km"]).clip(0.85, 1.25)
        rent = rent * uni_factor

    # Convert monthly to weekly
    weekly_rent = rent / 4.33

    return weekly_rent.round(2)


def get_feature_columns(df: pd.DataFrame) -> list:
    """Get the list of numeric feature columns for training.

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
        "is_hmo",
        "safety_score",
        "area_value_index",
    ]

    # Add one-hot property type columns
    ptype_cols = [c for c in df.columns if c.startswith("ptype_")]
    feature_cols.extend(ptype_cols)

    # Only include columns that exist in the DataFrame
    return [c for c in feature_cols if c in df.columns]


def train_model(
    df: pd.DataFrame,
    mode: str = "A",
) -> Tuple[Pipeline, Dict[str, float]]:
    """Train the rent prediction model.

    Args:
        df: Feature DataFrame (output of features.py).
        mode: "A" for temporary target, "B" for VOA-based target.

    Returns:
        Tuple of (trained pipeline, metrics dict).
    """
    # ── Compute target ───────────────────────────────────────────────────
    if mode == "B" and VOA_PATH.exists():
        logger.info("MODE B: Loading VOA rental statistics")
        # TODO: Implement MODE B when voa_rental_stats_2024.csv is available
        # Read VOA data, map properties to VOA medians by num_rooms and area
        # Replace TEMPORARY_TARGET with real VOA medians
        # For now, fall back to MODE A
        logger.warning("VOA data loading not yet implemented — falling back to MODE A")
        target = compute_temporary_target(df)
    else:
        logger.info("MODE A: Using TEMPORARY_TARGET (rule-based rent estimate)")
        target = compute_temporary_target(df)

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
        "model_version": MODEL_VERSION,
        "mode": mode,
    }

    logger.info("=" * 60)
    logger.info("MODEL EVALUATION RESULTS (MODE %s)", mode)
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

    return pipeline, metrics


def save_model(pipeline: Pipeline, model_path: Path = MODEL_PATH) -> None:
    """Serialize trained model to disk.

    Args:
        pipeline: Trained sklearn Pipeline.
        model_path: Destination path for the .pkl file.
    """
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, str(model_path))
    logger.info("Model saved to %s", model_path)


def run_training(mode: str = "A") -> Dict[str, float]:
    """Execute the full training pipeline.

    Args:
        mode: "A" for temporary target, "B" for VOA target.

    Returns:
        Metrics dict with MAE, RMSE, R².
    """
    logger.info("Starting model training (MODE %s)", mode)

    # Load features
    if not FEATURES_PATH.exists():
        logger.error("Features file not found at %s — run features.py first", FEATURES_PATH)
        raise FileNotFoundError(f"Features not found: {FEATURES_PATH}")

    df = pd.read_csv(str(FEATURES_PATH))
    logger.info("Loaded feature matrix: shape=%s", df.shape)

    # Train
    pipeline, metrics = train_model(df, mode=mode)

    # Save
    save_model(pipeline)

    return metrics


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )

    # Determine mode based on VOA data availability
    mode = "B" if VOA_PATH.exists() else "A"
    metrics = run_training(mode=mode)

    logger.info("Training complete. Metrics: %s", metrics)
