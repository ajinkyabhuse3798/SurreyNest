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
from typing import Dict, Optional, Tuple

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
MODEL_VERSION = "v1.0.0"  # MODE A — synthetic target
MODEL_VERSION_B = "v1.1.0"  # MODE B — real ONS/VOA data from voa_pipeline

# ── VOA Rent Bands (Guildford median weekly rent by bedroom count) ────────────
# Source: docs/ml-model.md (from VOA Private Rental Market Statistics)
# These are the anchor — adjustments are layered on top
VOA_RENT_BANDS = {
    1: 173,   # £/week median for 1-bed Guildford
    2: 230,   # £/week median for 2-bed
    3: 290,   # £/week median for 3-bed
    4: 375,   # £/week median for 4-bed
    5: 460,   # £/week median for 5+ bed
}

# Approximate median floor area by bedroom count (from EPC data analysis)
MEDIAN_AREA_BY_ROOMS = {
    1: 40.0,
    2: 60.0,
    3: 80.0,
    4: 110.0,
    5: 140.0,
}

# Property type per-m² price multipliers (mild adjustments)
PROPERTY_TYPE_MULTIPLIERS = {
    "ptype_Flat": 1.05,       # flats: higher per-m² rent
    "ptype_Terraced": 0.97,
    "ptype_Semi-Detached": 0.93,
    "ptype_Detached": 0.90,   # detached: lower per-m²
    "ptype_Other": 0.95,
}

# Noise level: ±12% Gaussian spread (matches real market variation)
TARGET_NOISE_STD = 0.12


def compute_temporary_target(df: pd.DataFrame) -> pd.Series:
    """Compute VOA-band-based rent target for MODE A training.

    Anchors on VOA median weekly rent by bedroom count, then applies
    mild adjustments for property characteristics and adds realistic
    noise. This gives the model non-trivial relationships to learn
    while staying grounded in real market data.

    Adjustments (all multiplicative, order-independent):
        - floor_area: ±20% vs median for bedroom count
        - property_type: ±5-10% (Flat premium, Detached discount)
        - distance_to_uni: ±10% student proximity premium
        - safety_score: ±5% (safer areas slightly higher)
        - area_value_index: ±10% (pricier areas higher)

    Args:
        df: Feature DataFrame.

    Returns:
        Series of estimated weekly rent in £.
    """
    rng = np.random.RandomState(42)  # reproducible noise

    # ── 1. VOA band base (anchor by bedroom count) ───────────────────────
    rooms = df["num_rooms"].clip(1, 5).astype(int)
    base_rent = rooms.map(VOA_RENT_BANDS)

    # ── 2. Floor area adjustment (±20% vs median for room count) ─────────
    median_area = rooms.map(MEDIAN_AREA_BY_ROOMS)
    area_ratio = (df["floor_area_m2"] - median_area) / median_area
    area_adj = 1 + 0.20 * area_ratio.clip(-1, 1)

    # ── 3. Property type adjustment (±5-10%) ─────────────────────────────
    type_adj = pd.Series(1.0, index=df.index)
    for col, mult in PROPERTY_TYPE_MULTIPLIERS.items():
        if col in df.columns:
            type_adj = type_adj.where(df[col] != 1, mult)

    # ── 4. University distance adjustment (±10%) ────────────────────────
    if "distance_to_uni_km" in df.columns:
        uni_adj = (1.10 - 0.02 * df["distance_to_uni_km"]).clip(0.90, 1.10)
    else:
        uni_adj = 1.0

    # ── 5. Safety score adjustment (±5%) ─────────────────────────────────
    if "safety_score" in df.columns:
        safety_adj = 1 + 0.05 * (df["safety_score"] - 50) / 50
    else:
        safety_adj = 1.0

    # ── 6. Area value index adjustment (±10%) ────────────────────────────
    if "area_value_index" in df.columns:
        avi_adj = 1 + 0.10 * (df["area_value_index"] - 0.5)
    else:
        avi_adj = 1.0

    # ── Combine ──────────────────────────────────────────────────────────
    rent = base_rent * area_adj * type_adj * uni_adj * safety_adj * avi_adj

    # ── Add realistic noise (±12% Gaussian) ──────────────────────────────
    noise = 1 + rng.normal(0, TARGET_NOISE_STD, size=len(df))
    rent = rent * noise

    # Clamp to reasonable bounds
    rent = rent.clip(lower=50, upper=900)

    return rent.round(2)


def load_voa_bands_from_csv() -> Optional[Dict[int, float]]:
    """Load VOA weekly rent bands from the pipeline-generated slim CSV.

    Reads ``VOA_PATH`` (``data/raw/voa_rental_stats_2024.csv``) which is
    written by ``voa_pipeline.py``.  The file has two columns:
    ``bedroom_count`` and ``weekly_rent``.

    Returns:
        Dict mapping bedroom count → weekly rent (£), or ``None`` if the
        file is missing or cannot be parsed.
    """
    if not VOA_PATH.exists():
        return None
    try:
        df = pd.read_csv(str(VOA_PATH))
        bands = {
            int(row["bedroom_count"]): float(row["weekly_rent"])
            for _, row in df.iterrows()
        }
        logger.info("Loaded %d VOA bands from %s: %s", len(bands), VOA_PATH, bands)
        return bands
    except Exception:
        logger.warning(
            "Failed to load VOA bands from %s", VOA_PATH, exc_info=True
        )
        return None


def compute_voa_target(df: pd.DataFrame) -> pd.Series:
    """Compute rent target using real ONS/VOA median bands (MODE B).

    Applies the SAME multiplicative adjustment stack as
    ``compute_temporary_target`` — floor area, property type, university
    distance, safety score, area value index, and ±12 % Gaussian noise.
    The only difference is that the base rent comes from real ONS data
    rather than the hardcoded ``VOA_RENT_BANDS`` dict.

    Falls back gracefully:
    - Per-bedroom: if a specific bedroom count is absent from the CSV,
      uses the nearest available band.
    - Entirely: if the CSV is missing or unreadable, delegates to
      ``compute_temporary_target()``.

    Args:
        df: Feature DataFrame.

    Returns:
        Series of estimated weekly rents in £, rounded to 2 d.p.
    """
    voa_bands = load_voa_bands_from_csv()
    if voa_bands is None:
        logger.warning(
            "VOA bands unavailable — falling back to MODE A (compute_temporary_target)"
        )
        return compute_temporary_target(df)

    rng = np.random.RandomState(42)
    rooms = df["num_rooms"].clip(1, 5).astype(int)

    def _get_base_rent(r: int) -> float:
        """Return weekly rent for bedroom count r, falling back to nearest band."""
        if r in voa_bands:
            return voa_bands[r]
        available = sorted(voa_bands.keys())
        if not available:
            return float(VOA_RENT_BANDS.get(r, 230))
        closest = min(available, key=lambda k: abs(k - r))
        logger.warning(
            "VOA band missing for %d beds — using %d beds (£%.2f/week)",
            r,
            closest,
            voa_bands[closest],
        )
        return voa_bands[closest]

    base_rent = rooms.map(_get_base_rent)

    # ── Same adjustment stack as compute_temporary_target ────────────────

    # Floor area adjustment (±20 % vs median for bedroom count)
    median_area = rooms.map(MEDIAN_AREA_BY_ROOMS)
    area_ratio = (df["floor_area_m2"] - median_area) / median_area
    area_adj = 1 + 0.20 * area_ratio.clip(-1, 1)

    # Property type adjustment (±5-10 %)
    type_adj = pd.Series(1.0, index=df.index)
    for col, mult in PROPERTY_TYPE_MULTIPLIERS.items():
        if col in df.columns:
            type_adj = type_adj.where(df[col] != 1, mult)

    # University distance adjustment (±10 %)
    if "distance_to_uni_km" in df.columns:
        uni_adj = (1.10 - 0.02 * df["distance_to_uni_km"]).clip(0.90, 1.10)
    else:
        uni_adj = 1.0

    # Safety score adjustment (±5 %)
    if "safety_score" in df.columns:
        safety_adj = 1 + 0.05 * (df["safety_score"] - 50) / 50
    else:
        safety_adj = 1.0

    # Area value index adjustment (±10 %)
    if "area_value_index" in df.columns:
        avi_adj = 1 + 0.10 * (df["area_value_index"] - 0.5)
    else:
        avi_adj = 1.0

    rent = base_rent * area_adj * type_adj * uni_adj * safety_adj * avi_adj

    # Add realistic noise (±12 % Gaussian)
    noise = 1 + rng.normal(0, TARGET_NOISE_STD, size=len(df))
    rent = rent * noise
    rent = rent.clip(lower=50, upper=900)

    logger.info(
        "VOA target (MODE B): mean=£%.1f  median=£%.1f  std=£%.1f",
        rent.mean(),
        rent.median(),
        rent.std(),
    )
    return rent.round(2)


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
    effective_version = (
        MODEL_VERSION_B if (mode == "B" and VOA_PATH.exists()) else MODEL_VERSION
    )
    if mode == "B":
        if VOA_PATH.exists():
            logger.info(
                "MODE B: Using real ONS/VOA rent bands (version %s)", MODEL_VERSION_B
            )
            target = compute_voa_target(df)
        else:
            logger.warning("MODE B: VOA_PATH not found — falling back to MODE A")
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
        "model_version": effective_version,
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
    pipeline, metrics, feature_cols = train_model(df, mode=mode)

    # Save versioned archive (e.g. rent_model_v1.1.0.pkl)
    effective_version = metrics["model_version"]
    versioned_path = MODEL_DIR / f"rent_model_{effective_version}.pkl"
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

    # Determine mode based on VOA data availability
    mode = "B" if VOA_PATH.exists() else "A"
    metrics = run_training(mode=mode)

    logger.info("Training complete. Metrics: %s", metrics)
