"""ML prediction service: load model and predict rent.

Loads the trained sklearn Pipeline and feature column manifest from disk.
predict_rent() extracts features from a property dict and returns
the predicted weekly rent. Called by score_service.py, NOT by routes directly.

Feature columns are loaded dynamically from feature_columns.json
(saved by train.py) to guarantee train/predict alignment.
"""

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional

import joblib
import numpy as np
from geopy.distance import geodesic

from app.config import settings

logger = logging.getLogger(__name__)

# ── Module-level caches ───────────────────────────────────────────────────────
_model = None
_feature_columns: List[str] = []

# ── Guildford reference points ────────────────────────────────────────────────
GUILDFORD_TOWN_CENTRE = (51.2362, -0.5704)
UNIVERSITY_OF_SURREY = (51.2430, -0.5890)

# ── Energy rating ordinal encoding ────────────────────────────────────────────
ENERGY_ORDINAL = {"G": 0, "F": 1, "E": 2, "D": 3, "C": 4, "B": 5, "A": 6}

# ── Sensible defaults for optional features ───────────────────────────────────
FEATURE_DEFAULTS = {
    "num_rooms": 3,
    "energy_rating_ordinal": 3,   # D
    "potential_rating_ordinal": 4, # C
    "distance_to_town_km": 3.0,
    "distance_to_uni_km": 3.0,
    "is_hmo": 0,
    "safety_score": 50.0,
    "area_value_index": 0.5,
}

# ── Validation ranges for input warnings ──────────────────────────────────────
VALIDATION_RANGES = {
    "floor_area_m2": (5.0, 500.0),
    "num_rooms": (1, 20),
    "safety_score": (0.0, 100.0),
    "area_value_index": (0.0, 1.0),
    "distance_to_town_km": (0.0, 50.0),
    "distance_to_uni_km": (0.0, 50.0),
}


def load_model() -> None:
    """Load the trained ML model and feature columns from disk.

    Called once on application startup. Stores the model and feature
    column list in module-level variables.

    Raises:
        FileNotFoundError: If the model pkl or feature_columns.json doesn't exist.
    """
    global _model, _feature_columns

    model_dir = Path(settings.ml_model_path)

    # ── Load model pkl ────────────────────────────────────────────────────
    candidates = [
        model_dir / f"rent_model_{settings.ml_model_version}.pkl",
        model_dir / "rent_model_v1.pkl",
    ]

    model_loaded = False
    for path in candidates:
        if path.exists():
            _model = joblib.load(str(path))
            logger.info("Loaded ML model from %s", path)
            model_loaded = True
            break

    if not model_loaded:
        raise FileNotFoundError(
            f"Model file not found. Tried: {[str(p) for p in candidates]}"
        )

    # ── Load feature columns ──────────────────────────────────────────────
    columns_path = model_dir / "feature_columns.json"
    if columns_path.exists():
        _feature_columns = json.loads(columns_path.read_text())
        logger.info(
            "Loaded %d feature columns from %s", len(_feature_columns), columns_path
        )
    else:
        # Fallback: use the columns the model was trained with
        # (works for models trained before feature_columns.json was introduced)
        logger.warning(
            "feature_columns.json not found at %s — using legacy defaults",
            columns_path,
        )
        _feature_columns = [
            "floor_area_m2",
            "num_rooms",
            "energy_rating_ordinal",
            "potential_rating_ordinal",
            "distance_to_town_km",
            "distance_to_uni_km",
            "is_hmo",
            "safety_score",
            "area_value_index",
            "ptype_Detached",
            "ptype_Flat",
            "ptype_Semi-Detached",
            "ptype_Terraced",
        ]

    # ── Alignment check ───────────────────────────────────────────────────
    if hasattr(_model, "n_features_in_"):
        expected = _model.n_features_in_
        actual = len(_feature_columns)
        if expected != actual:
            raise ValueError(
                f"Feature column mismatch: model expects {expected} features "
                f"but feature_columns.json has {actual}. "
                f"Re-run train.py to regenerate both."
            )


def _validate_feature(name: str, value: float) -> None:
    """Warn if a feature value is outside its expected range.

    Args:
        name: Feature name.
        value: Feature value.
    """
    if name in VALIDATION_RANGES:
        lo, hi = VALIDATION_RANGES[name]
        if value < lo or value > hi:
            logger.warning(
                "Feature '%s' = %.2f is outside expected range [%.1f, %.1f]",
                name, value, lo, hi,
            )


def predict_rent(property_features: Dict) -> Optional[Dict]:
    """Predict weekly rent for a property.

    Feature columns are loaded dynamically from feature_columns.json.
    Caller can override any feature via the property_features dict;
    sensible defaults are used for missing values.

    Args:
        property_features: Dict with property attributes:
            - floor_area_m2 (float, required)
            - num_rooms (int)
            - energy_rating (str, A-G)
            - potential_rating (str, A-G)
            - property_type (str)
            - lat (float)
            - lng (float)
            - postcode (str)
            - is_hmo (int, 0 or 1)
            - safety_score (float, 0-100)
            - area_value_index (float, 0-1)

    Returns:
        Dict with predicted_weekly_rent, or None if prediction fails.
    """
    if _model is None:
        logger.error("ML model not loaded — call load_model() first")
        return None

    if not _feature_columns:
        logger.error("Feature columns not loaded — call load_model() first")
        return None

    try:
        # ── Required: floor_area_m2 ──────────────────────────────────────
        floor_area = property_features.get("floor_area_m2")
        if floor_area is None:
            logger.warning("Cannot predict: floor_area_m2 is None")
            return None

        # ── Compute derived features ─────────────────────────────────────
        lat = property_features.get("lat")
        lng = property_features.get("lng")

        if lat is not None and lng is not None:
            distance_to_town = geodesic((lat, lng), GUILDFORD_TOWN_CENTRE).km
            distance_to_uni = geodesic((lat, lng), UNIVERSITY_OF_SURREY).km
        else:
            distance_to_town = FEATURE_DEFAULTS["distance_to_town_km"]
            distance_to_uni = FEATURE_DEFAULTS["distance_to_uni_km"]

        energy_rating = property_features.get("energy_rating", "D")
        potential_rating = property_features.get("potential_rating", "C")
        energy_ordinal = ENERGY_ORDINAL.get(str(energy_rating).upper(), 3)
        potential_ordinal = ENERGY_ORDINAL.get(str(potential_rating).upper(), 4)

        property_type = property_features.get("property_type", "Flat")
        num_rooms = property_features.get("num_rooms", FEATURE_DEFAULTS["num_rooms"])

        # ── Build feature dict with all computed values ───────────────────
        computed = {
            "floor_area_m2": float(floor_area),
            "num_rooms": float(num_rooms) if num_rooms is not None else float(FEATURE_DEFAULTS["num_rooms"]),
            "energy_rating_ordinal": energy_ordinal,
            "potential_rating_ordinal": potential_ordinal,
            "distance_to_town_km": distance_to_town,
            "distance_to_uni_km": distance_to_uni,
            "is_hmo": int(property_features.get("is_hmo", FEATURE_DEFAULTS["is_hmo"])),
            "safety_score": float(property_features.get("safety_score", FEATURE_DEFAULTS["safety_score"])),
            "area_value_index": float(property_features.get("area_value_index", FEATURE_DEFAULTS["area_value_index"])),
        }

        # Dynamic one-hot encoding: set the right ptype column to 1
        ptype_cols = [c for c in _feature_columns if c.startswith("ptype_")]
        for col in ptype_cols:
            ptype_name = col.replace("ptype_", "")
            computed[col] = 1 if property_type == ptype_name else 0

        # ── Validate inputs ──────────────────────────────────────────────
        for name, value in computed.items():
            _validate_feature(name, float(value))

        # ── Assemble feature array in trained column order ───────────────
        feature_values = []
        for col in _feature_columns:
            if col in computed:
                feature_values.append(float(computed[col]))
            else:
                default = FEATURE_DEFAULTS.get(col, 0.0)
                logger.debug("Feature '%s' not in computed — using default %.2f", col, default)
                feature_values.append(float(default))

        features = np.array([feature_values])

        # ── Predict ──────────────────────────────────────────────────────
        prediction = _model.predict(features)[0]
        predicted_rent = round(float(prediction), 2)

        logger.debug(
            "Predicted rent for %s: £%.2f/week (floor_area=%.0f, type=%s, "
            "is_hmo=%d, safety=%.0f, avi=%.2f)",
            property_features.get("postcode", "unknown"),
            predicted_rent,
            floor_area,
            property_type,
            computed["is_hmo"],
            computed["safety_score"],
            computed["area_value_index"],
        )

        return {"predicted_weekly_rent": predicted_rent}

    except Exception:
        logger.error("Prediction failed", exc_info=True)
        return None
