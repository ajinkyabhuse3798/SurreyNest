"""ML prediction service: load model and predict rent.

Loads the trained sklearn Pipeline from disk once on startup.
predict_rent() extracts features from a property dict and returns
the predicted weekly rent. Called by score_service.py, NOT by routes directly.
"""

import logging
import re
from pathlib import Path
from typing import Dict, Optional

import joblib
import numpy as np
from geopy.distance import geodesic

from app.config import settings

logger = logging.getLogger(__name__)

# ── Module-level model cache ──────────────────────────────────────────────────
_model = None

# ── Guildford reference points ────────────────────────────────────────────────
GUILDFORD_TOWN_CENTRE = (51.2362, -0.5704)
UNIVERSITY_OF_SURREY = (51.2430, -0.5890)

# ── Energy rating ordinal encoding ────────────────────────────────────────────
ENERGY_ORDINAL = {"G": 0, "F": 1, "E": 2, "D": 3, "C": 4, "B": 5, "A": 6}

# ── Feature columns (must match train.py exactly) ────────────────────────────
FEATURE_COLUMNS = [
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


def load_model() -> None:
    """Load the trained ML model from disk into memory.

    Called once on application startup. Stores the model in the
    module-level _model variable.

    Raises:
        FileNotFoundError: If the model pkl file doesn't exist.
    """
    global _model

    model_dir = Path(settings.ml_model_path)
    model_file = model_dir / f"rent_model_{settings.ml_model_version.replace('.', '_') if '.' not in 'v1' else settings.ml_model_version.replace('v', 'v')}.pkl"

    # Try the standard naming convention
    candidates = [
        model_dir / f"rent_model_{settings.ml_model_version}.pkl",
        model_dir / "rent_model_v1.pkl",
    ]

    for path in candidates:
        if path.exists():
            _model = joblib.load(str(path))
            logger.info("Loaded ML model from %s", path)
            return

    raise FileNotFoundError(
        f"Model file not found. Tried: {[str(p) for p in candidates]}"
    )


def predict_rent(property_features: Dict) -> Optional[Dict]:
    """Predict weekly rent for a property.

    Args:
        property_features: Dict with property attributes:
            - floor_area_m2 (float)
            - num_rooms (int)
            - energy_rating (str, A-G)
            - potential_rating (str, A-G)
            - property_type (str)
            - lat (float)
            - lng (float)
            - postcode (str)

    Returns:
        Dict with predicted_weekly_rent, or None if prediction fails.
    """
    if _model is None:
        logger.error("ML model not loaded — call load_model() first")
        return None

    try:
        floor_area = property_features.get("floor_area_m2")
        if floor_area is None:
            logger.warning("Cannot predict: floor_area_m2 is None")
            return None

        num_rooms = property_features.get("num_rooms", 3)
        energy_rating = property_features.get("energy_rating", "D")
        potential_rating = property_features.get("potential_rating", "C")
        property_type = property_features.get("property_type", "Flat")
        lat = property_features.get("lat")
        lng = property_features.get("lng")

        # Compute distance features
        if lat is not None and lng is not None:
            distance_to_town = geodesic((lat, lng), GUILDFORD_TOWN_CENTRE).km
            distance_to_uni = geodesic((lat, lng), UNIVERSITY_OF_SURREY).km
        else:
            distance_to_town = 3.0  # sensible default
            distance_to_uni = 3.0

        # Encode energy ratings
        energy_ordinal = ENERGY_ORDINAL.get(str(energy_rating).upper(), 3)
        potential_ordinal = ENERGY_ORDINAL.get(str(potential_rating).upper(), 4)

        # One-hot encode property type
        ptype_detached = 1 if property_type == "Detached" else 0
        ptype_flat = 1 if property_type == "Flat" else 0
        ptype_semi = 1 if property_type == "Semi-Detached" else 0
        ptype_terraced = 1 if property_type == "Terraced" else 0

        # Build feature array in exact column order
        features = np.array([[
            float(floor_area),
            float(num_rooms) if num_rooms is not None else 3.0,
            energy_ordinal,
            potential_ordinal,
            distance_to_town,
            distance_to_uni,
            0,     # is_hmo — default to 0, caller can override
            50.0,  # safety_score — default neutral
            0.5,   # area_value_index — placeholder
            ptype_detached,
            ptype_flat,
            ptype_semi,
            ptype_terraced,
        ]])

        prediction = _model.predict(features)[0]
        predicted_rent = round(float(prediction), 2)

        logger.debug(
            "Predicted rent for %s: £%.2f/week (floor_area=%.0f, type=%s)",
            property_features.get("postcode", "unknown"),
            predicted_rent,
            floor_area,
            property_type,
        )

        return {"predicted_weekly_rent": predicted_rent}

    except Exception:
        logger.error("Prediction failed", exc_info=True)
        return None
