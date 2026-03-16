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
from app.data_pipelines.epc_pipeline import AGE_BAND_ORDINAL

logger = logging.getLogger(__name__)

# ── Module-level caches ───────────────────────────────────────────────────────
_model = None
_feature_columns: List[str] = []
_log_target: bool = False  # v3.2.0: whether model was trained on log1p(target)
_sector_rent_map: Dict = {}  # v4.3.0: postcode_sector → sector_median_rent

# ── Guildford reference points ────────────────────────────────────────────────
GUILDFORD_TOWN_CENTRE = (51.2362, -0.5704)
UNIVERSITY_OF_SURREY = (51.2430, -0.5890)
GUILDFORD_STATION = (51.2372, -0.5617)       # London Road station forecourt

# ── Location score Gaussian bandwidth ────────────────────────────────────────
_LOCATION_SIGMA_KM = 1.5  # v4.3.0: Gaussian decay σ=1.5km for proximity scores

# ── Energy rating ordinal encoding ────────────────────────────────────────────
ENERGY_ORDINAL = {"G": 0, "F": 1, "E": 2, "D": 3, "C": 4, "B": 5, "A": 6}

# ── Sensible defaults for optional features ───────────────────────────────
FEATURE_DEFAULTS = {
    "num_rooms": 3,
    "actual_bedrooms": 2,              # v4.1.0: Real/Classifier-predicted bedrooms
    "rooms_per_m2": 0.05,              # 3 rooms / 60m² typical
    "energy_rating_ordinal": 3,        # D
    "potential_rating_ordinal": 4,     # C
    "distance_to_town_km": 3.0,
    "distance_to_uni_km": 3.0,
    "distance_to_station_km": 2.5,     # Guildford median from EDA
    "safety_score": 50.0,
    "sale_count": 4.0,                 # Guildford median postcodes from EDA
    # v3.3.0: new EPC-derived features
    # v5.1.0: defaults updated to match training data medians from features.csv
    # (features.py fills NaN with dataset median; predict.py must use the same value)
    "age_band_ordinal": 3,             # 1950-1966 (training dataset median, was 6=1983-1990)
    "has_mains_gas": 1,                # Most properties have mains gas
    "floor_level_ordinal": 0,          # Ground floor default
    "annual_energy_cost": 880.0,       # £880/yr training median (was £1,500 — wrong default)
    "energy_improvement_gap": 1,       # 1 band improvement potential (typical)
    "price_drop_pct": 0.0,             # v4.0.0: No historical price drop usually
    "location_score": 0.30,            # v4.3.0: ~2.5km from town/uni (outer Guildford)
    "town_proximity_score": 0.30,      # v4.4.0: split from location_score
    "uni_proximity_score": 0.30,       # v4.4.0: split from location_score
    "sector_median_rent": 350.0,       # v4.3.0: Guildford all-sector median £/week
    "is_studio": 0,                    # v4.5.0: explicit studio flag (0 = not a studio)
    "station_proximity_score": 0.30,   # v4.6.0: Gaussian proximity to station, σ=1.5km
    "accessibility_score": 0.30,       # v4.6.0: max(town, uni, station) [0,1]
    "is_student_zone": 0,              # v4.6.0: GU1/GU2=1 (student market), else 0
    "m2_per_bedroom": 30.0,            # v4.6.0: floor_area_m2 / actual_bedrooms (60m²/2beds)
    "flat_floor_premium": 0.0,         # v4.6.0: floor_level_ordinal × ptype_Flat
}

# ── Validation ranges for input warnings ──────────────────────────────────
VALIDATION_RANGES = {
    "floor_area_m2": (5.0, 500.0),
    "num_rooms": (1, 20),
    "actual_bedrooms": (0, 15),         # v4.1.0: studios have 0 bedrooms
    "rooms_per_m2": (0.005, 0.5),
    "safety_score": (0.0, 100.0),
    "distance_to_town_km": (0.0, 50.0),
    "distance_to_uni_km": (0.0, 50.0),
    "distance_to_station_km": (0.0, 50.0),
    # v3.3.0 new features
    "age_band_ordinal": (0, 11),
    "has_mains_gas": (0, 1),
    "floor_level_ordinal": (-1, 10),
    "annual_energy_cost": (100.0, 10000.0),
    "energy_improvement_gap": (-3, 6),
    "price_drop_pct": (0.0, 1.0),
    "location_score": (0.0, 1.0),
    "town_proximity_score": (0.0, 1.0),
    "uni_proximity_score": (0.0, 1.0),
    "sector_median_rent": (50.0, 2000.0),
    "is_studio": (0, 1),
    "station_proximity_score": (0.0, 1.0),
    "accessibility_score": (0.0, 1.0),
    "is_student_zone": (0, 1),
    "m2_per_bedroom": (5.0, 300.0),
    "flat_floor_premium": (-1, 10),
}


def load_model() -> None:
    """Load the trained ML model and feature columns from disk.

    Called once on application startup. Stores the model and feature
    column list in module-level variables.

    Raises:
        FileNotFoundError: If the model pkl or feature_columns.json doesn't exist.
    """
    global _model, _feature_columns, _log_target

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

    # ── Load model metadata (v3.2.0: log_target flag) ─────────────────────
    meta_path = model_dir / "model_metadata.json"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text())
        _log_target = meta.get("log_target", False)
        logger.info(
            "Model metadata: version=%s, log_target=%s, outlier_cap=%s",
            meta.get("model_version"), _log_target, meta.get("outlier_cap"),
        )
    else:
        _log_target = False
        logger.info("No model_metadata.json — assuming raw target (log_target=False)")

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

    # ── Load sector rent map (v4.3.0) ────────────────────────────────────────
    global _sector_rent_map
    sector_map_path = model_dir / "sector_rent_map.json"
    if sector_map_path.exists():
        _sector_rent_map = json.loads(sector_map_path.read_text())
        logger.info("Loaded sector rent map: %d sectors", len(_sector_rent_map))
    else:
        logger.warning("sector_rent_map.json not found — sector_median_rent will use default")
        _sector_rent_map = {}

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


def get_model_internals() -> Optional[Dict]:
    """Return ML model internals needed by XAI and other consumers.

    Provides controlled access to the trained model components without
    exposing private module variables.  All Pipeline-structure knowledge
    (step indices) is encapsulated here — callers never need to know
    that _model is a sklearn Pipeline or which step is the scaler.

    Returns:
        Dict with keys: model, scaler, xgb_model, feature_columns,
        log_target, feature_defaults.  Returns None if model not loaded.
    """
    if _model is None or not _feature_columns:
        return None

    return {
        "model": _model,
        "scaler": _model.steps[0][1],
        "xgb_model": _model.steps[1][1],
        "feature_columns": list(_feature_columns),  # defensive copy
        "log_target": _log_target,
        "feature_defaults": dict(FEATURE_DEFAULTS),  # defensive copy
    }


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


def _compute_location_score(
    distance_to_town_km: float, distance_to_uni_km: float
) -> float:
    """Gaussian proximity score: max(town_proximity, uni_proximity).

    σ=1.5km — score = 1.0 at distance 0, decays to ~0.1 at 2.6km.
    Single source of truth for location_score at inference time (v4.3.0).

    Args:
        distance_to_town_km: Geodesic km to Guildford High Street.
        distance_to_uni_km: Geodesic km to Surrey Uni Stag Hill.

    Returns:
        location_score in [0.0, 1.0].
    """
    import math
    sigma_sq = 2.0 * _LOCATION_SIGMA_KM ** 2
    town_score = math.exp(-(distance_to_town_km ** 2) / sigma_sq)
    uni_score = math.exp(-(distance_to_uni_km ** 2) / sigma_sq)
    return round(max(town_score, uni_score), 4)


def build_prediction_features(
    property_features: Dict, feature_columns: List[str]
) -> Optional[Dict]:
    """Build the computed feature dict for ML prediction / XAI.

    This is the SINGLE SOURCE OF TRUTH for feature engineering at
    inference time. Both predict_rent() and rent_explain use this.

    Args:
        property_features: Raw property attributes dict (floor_area_m2,
            lat, lng, energy_rating, property_type, num_rooms, etc.).
        feature_columns: Ordered list of feature column names (from
            feature_columns.json).

    Returns:
        Dict mapping feature column name → computed float value,
        or None if floor_area_m2 is missing.
    """
    floor_area = property_features.get("floor_area_m2")
    if floor_area is None:
        return None

    # ── Compute distance features ────────────────────────────────────
    lat = property_features.get("lat")
    lng = property_features.get("lng")

    if lat is not None and lng is not None:
        distance_to_town = geodesic((lat, lng), GUILDFORD_TOWN_CENTRE).km
        distance_to_uni = geodesic((lat, lng), UNIVERSITY_OF_SURREY).km
        distance_to_station = geodesic((lat, lng), GUILDFORD_STATION).km
    else:
        distance_to_town = FEATURE_DEFAULTS["distance_to_town_km"]
        distance_to_uni = FEATURE_DEFAULTS["distance_to_uni_km"]
        distance_to_station = FEATURE_DEFAULTS["distance_to_station_km"]

    # ── Energy rating ordinals ───────────────────────────────────────
    energy_rating = property_features.get("energy_rating", "D")
    potential_rating = property_features.get("potential_rating", "C")
    energy_ordinal = ENERGY_ORDINAL.get(str(energy_rating).upper(), 3)
    potential_ordinal = ENERGY_ORDINAL.get(str(potential_rating).upper(), 4)

    # ── Bedroom integration (v4.1.0) ──────────────────────────────────
    property_type = property_features.get("property_type", "Flat")
    num_rooms = property_features.get("num_rooms", FEATURE_DEFAULTS["num_rooms"])
    rooms_val = float(num_rooms) if num_rooms is not None else float(FEATURE_DEFAULTS["num_rooms"])
    floor_val = float(floor_area)
    rooms_per_m2 = round(rooms_val / max(floor_val, 10.0), 4)

    actual_beds = property_features.get("actual_bedrooms")
    if actual_beds is None:
        # Estimate from EPC habitable rooms — matches features.py null-filling strategy.
        # Flats: max(0, num_rooms - 1); Houses: max(1, num_rooms - 2)
        num_rooms_int = int(rooms_val)
        if property_type == "Flat":
            actual_beds = max(0, num_rooms_int - 1)
        else:
            actual_beds = max(1, num_rooms_int - 2)

    # ── Proximity scores (v4.4.0: disentangled from single location_score) ──
    import math
    sigma_sq = 2.0 * _LOCATION_SIGMA_KM ** 2
    town_proximity_score = round(math.exp(-(distance_to_town ** 2) / sigma_sq), 4)
    uni_proximity_score = round(math.exp(-(distance_to_uni ** 2) / sigma_sq), 4)
    station_proximity_score = round(math.exp(-(distance_to_station ** 2) / sigma_sq), 4)
    accessibility_score = round(max(town_proximity_score, uni_proximity_score, station_proximity_score), 4)

    # ── Sector median rent (v4.3.0) ─────────────────────────────────────
    postcode = property_features.get("postcode", "")
    postcode_sector = (
        " ".join([postcode.strip().split()[0], postcode.strip().split()[1][0]])
        if postcode and len(postcode.strip().split()) >= 2
        else ""
    )
    sector_median_rent = float(
        _sector_rent_map.get(postcode_sector, FEATURE_DEFAULTS["sector_median_rent"])
    )

    # ── Assemble computed dict ────────────────────────────────────────
    computed = {
        "floor_area_m2": floor_val,
        "actual_bedrooms": float(actual_beds),
        "rooms_per_m2": rooms_per_m2,
        "energy_rating_ordinal": energy_ordinal,
        "potential_rating_ordinal": potential_ordinal,
        "distance_to_town_km": distance_to_town,
        "distance_to_uni_km": distance_to_uni,
        "distance_to_station_km": distance_to_station,
        "town_proximity_score": town_proximity_score,
        "uni_proximity_score": uni_proximity_score,
        "station_proximity_score": station_proximity_score,
        "accessibility_score": accessibility_score,
        "safety_score": float(property_features.get("safety_score", FEATURE_DEFAULTS["safety_score"])),
        "sale_count": float(
            property_features.get("sale_count") or FEATURE_DEFAULTS["sale_count"]
        ),
        "sector_median_rent": sector_median_rent,
    }

    # ── Dynamic one-hot encoding for property type ────────────────────
    ptype_cols = [c for c in feature_columns if c.startswith("ptype_")]
    for col in ptype_cols:
        ptype_name = col.replace("ptype_", "")
        computed[col] = 1 if property_type == ptype_name else 0

    # ── v3.3.0: new EPC-derived features ────────────────────────────
    # 1. Construction age band ordinal
    age_band_str = property_features.get("construction_age_band", "")
    if age_band_str:
        age_band_val = AGE_BAND_ORDINAL.get(
            str(age_band_str).lower().strip(),
            FEATURE_DEFAULTS["age_band_ordinal"],
        )
    else:
        age_band_val = FEATURE_DEFAULTS["age_band_ordinal"]
    computed["age_band_ordinal"] = float(age_band_val)

    # 2. Mains gas flag
    mains_gas = property_features.get("mains_gas_flag")
    computed["has_mains_gas"] = float(
        mains_gas if mains_gas is not None else FEATURE_DEFAULTS["has_mains_gas"]
    )

    # 3. Floor level → flat_floor_premium (floor_level_ordinal × ptype_Flat)
    floor_lvl = property_features.get("floor_level")
    floor_level_ordinal = float(
        floor_lvl if floor_lvl is not None else FEATURE_DEFAULTS["floor_level_ordinal"]
    )
    is_flat_for_floor = computed.get("ptype_Flat", 0)
    computed["flat_floor_premium"] = floor_level_ordinal * float(is_flat_for_floor)

    # 4. Annual energy cost
    energy_cost = property_features.get("annual_energy_cost")
    computed["annual_energy_cost"] = float(
        energy_cost if energy_cost is not None else FEATURE_DEFAULTS["annual_energy_cost"]
    )

    # 5. Energy improvement gap (potential - current)
    computed["energy_improvement_gap"] = float(
        max(-3, min(6, potential_ordinal - energy_ordinal))
    )

    # 6. Price drop pct (v4.0.0)
    drop_pct = property_features.get("price_drop_pct")
    computed["price_drop_pct"] = float(
        drop_pct if drop_pct is not None else FEATURE_DEFAULTS["price_drop_pct"]
    )

    # 7. is_studio (v4.5.0): ptype_Flat=1 AND actual_bedrooms=0
    is_flat = computed.get("ptype_Flat", 0)
    computed["is_studio"] = float(1 if (is_flat == 1 and actual_beds == 0) else 0)

    # 8. is_student_zone (v4.6.0): GU1/GU2 postcode districts
    postcode_district = postcode.strip().split()[0].upper() if postcode else ""
    computed["is_student_zone"] = float(1 if postcode_district in {"GU1", "GU2"} else 0)

    # 9. m2_per_bedroom (v4.6.0): floor area per bedroom (studios use full area / 1)
    beds_for_ratio = max(float(actual_beds), 1.0)
    computed["m2_per_bedroom"] = round(floor_val / beds_for_ratio, 1)

    return computed


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
        # ── Build computed features (shared with XAI) ────────────────
        computed = build_prediction_features(property_features, _feature_columns)
        if computed is None:
            logger.warning("Cannot predict: floor_area_m2 is None")
            return None

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

        # v3.2.0: inverse log-transform if model was trained on log1p(target)
        if _log_target:
            predicted_rent = round(float(np.expm1(prediction)), 2)
        else:
            predicted_rent = round(float(prediction), 2)

        # v5.1.0: Post-prediction bias correction (recalibrated).
        # The raw model systematically underestimates 2025 market rents because
        # 97% of training rows are Land Registry implied rents (3.5% yield,
        # conservative estimates). Calibrated as the L1-optimal shift (median
        # residual) across all 510 scraped Rightmove records:
        #   Median(actual - raw_prediction) = +£36 → total correction = 11 + 36 = £47
        # At this correction, predicted = market rent ± £78/wk MAE across all categories.
        # Slight overestimation is safer for tenant-protection: a student should
        # never be told their rent is fair when it is actually above market.
        _BIAS_CORRECTION = 47.0  # £/week (was +11 in v4.4.1)
        predicted_rent = round(predicted_rent + _BIAS_CORRECTION, 2)

        logger.debug(
            "Predicted rent for %s: £%.2f/week (floor_area=%.0f, type=%s, "
            "safety=%.0f, station=%.1fkm)",
            property_features.get("postcode", "unknown"),
            predicted_rent,
            computed["floor_area_m2"],
            property_features.get("property_type", "unknown"),
            computed["safety_score"],
            computed["distance_to_station_km"],
        )

        return {"predicted_weekly_rent": predicted_rent}

    except Exception:
        logger.error("Prediction failed", exc_info=True)
        return None
