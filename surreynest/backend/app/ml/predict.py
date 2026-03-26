"""ML prediction service: load the trained rent model and serve predictions."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from geopy.distance import geodesic

from app.config import settings
from app.ml.calibration import (
    apply_prediction_calibration,
    interval_half_width_for_type,
    normalise_property_type,
)
from app.utils.postcode import extract_postcode_sector

logger = logging.getLogger(__name__)
_BACKEND_ROOT = Path(__file__).resolve().parents[2]

# ── Module-level caches ───────────────────────────────────────────────────────
_model = None
_feature_columns: List[str] = []
_log_target: bool = False
_sector_rent_map: Dict = {}
_calibration_artifact: Optional[Dict] = None
_interval_artifact: Optional[Dict] = None
_loaded_model_version: str = settings.ml_model_version
_model_metadata: Dict = {}

# ── Guildford reference points ────────────────────────────────────────────────
GUILDFORD_TOWN_CENTRE = (51.2362, -0.5704)
UNIVERSITY_OF_SURREY = (51.2430, -0.5890)
GUILDFORD_STATION = (51.2364, -0.5797)

_LOCATION_SIGMA_KM = 1.5
ENERGY_ORDINAL = {"G": 0, "F": 1, "E": 2, "D": 3, "C": 4, "B": 5, "A": 6}

FEATURE_DEFAULTS = {
    "num_rooms": 3,
    "actual_bedrooms": 2,
    "rooms_per_m2": 0.05,
    "energy_rating_ordinal": 3,
    "potential_rating_ordinal": 4,
    "distance_to_town_km": 3.0,
    "distance_to_uni_km": 3.0,
    "distance_to_station_km": 2.5,
    "safety_score": 50.0,
    "sale_count": 4.0,
    "has_mains_gas": 1,
    "floor_level_ordinal": 0,
    "annual_energy_cost": 880.0,
    "energy_improvement_gap": 1,
    "price_drop_pct": 0.0,
    "location_score": 0.30,
    "town_proximity_score": 0.30,
    "uni_proximity_score": 0.30,
    "sector_median_rent": 350.0,
    "is_studio": 0,
    "station_proximity_score": 0.30,
    "accessibility_score": 0.30,
    "is_student_zone": 0,
    "m2_per_bedroom": 30.0,
    "flat_floor_premium": 0.0,
}

VALIDATION_RANGES = {
    "floor_area_m2": (5.0, 500.0),
    "num_rooms": (1, 20),
    "actual_bedrooms": (0, 15),
    "rooms_per_m2": (0.005, 0.5),
    "safety_score": (0.0, 100.0),
    "distance_to_town_km": (0.0, 50.0),
    "distance_to_uni_km": (0.0, 50.0),
    "distance_to_station_km": (0.0, 50.0),
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


def get_loaded_model_version() -> str:
    """Return the version declared by the currently loaded model metadata."""
    return _loaded_model_version


def _resolve_model_dir() -> Path:
    configured_model_dir = Path(settings.ml_model_path)
    if configured_model_dir.is_absolute():
        return configured_model_dir

    candidate_dirs = [
        Path.cwd() / configured_model_dir,
        _BACKEND_ROOT / configured_model_dir,
        Path(__file__).resolve().parent / "models",
    ]
    return next((path for path in candidate_dirs if path.exists()), candidate_dirs[1])


def load_model() -> None:
    """Load the trained ML model, metadata, and post-processing artifacts."""
    global _model, _feature_columns, _log_target, _sector_rent_map
    global _calibration_artifact, _interval_artifact, _loaded_model_version
    global _model_metadata

    model_dir = _resolve_model_dir()

    candidates = [
        model_dir / f"rent_model_{settings.ml_model_version}.pkl",
        model_dir / "rent_model_v1.pkl",
    ]

    for path in candidates:
        if path.exists():
            _model = joblib.load(str(path))
            logger.info("Loaded ML model from %s", path)
            break
    else:
        raise FileNotFoundError(
            f"Model file not found. Tried: {[str(path) for path in candidates]}"
        )

    meta_path = model_dir / "model_metadata.json"
    if meta_path.exists():
        _model_metadata = json.loads(meta_path.read_text())
        _log_target = bool(_model_metadata.get("log_target", False))
        _loaded_model_version = str(
            _model_metadata.get("model_version", settings.ml_model_version)
        )
        logger.info(
            "Model metadata: version=%s, log_target=%s, outlier_cap=%s",
            _loaded_model_version,
            _log_target,
            _model_metadata.get("outlier_cap"),
        )
        if _loaded_model_version != settings.ml_model_version:
            # Log loudly but DO NOT raise, the model must finish loading.
            #
            # Why: the cache key in score_service is built from get_loaded_model_version()
            # (the artifact version), not from settings.ml_model_version (the env var).
            # If we abort here, _feature_columns never loads and predict_rent() returns None
            # for every property, total prediction outage until the env var is corrected.
            #
            # Correct behaviour: load fully, let the cache key mismatch naturally invalidate
            # all stale DB predictions (v6.2.0+lc1 ≠ v6.3.0+lc1 → cache miss → recompute).
            # The operator sees this ERROR in logs and should update ML_MODEL_VERSION.
            logger.error(
                "ML_MODEL_VERSION env var ('%s') does not match artifact version ('%s'). "
                "Stale DB predictions will be automatically invalidated via the cache key. "
                "Update ML_MODEL_VERSION=%s in .env to silence this error.",
                settings.ml_model_version,
                _loaded_model_version,
                _loaded_model_version,
            )
    else:
        _log_target = False
        _loaded_model_version = settings.ml_model_version
        _model_metadata = {}
        logger.info("No model_metadata.json, assuming raw target")

    columns_path = model_dir / "feature_columns.json"
    if columns_path.exists():
        _feature_columns = json.loads(columns_path.read_text())
        logger.info("Loaded %d feature columns", len(_feature_columns))
    else:
        raise FileNotFoundError(f"feature_columns.json not found at {columns_path}")

    sector_map_path = model_dir / "sector_rent_map.json"
    if sector_map_path.exists():
        _sector_rent_map = json.loads(sector_map_path.read_text())
        logger.info("Loaded sector rent map: %d sectors", len(_sector_rent_map))
    else:
        _sector_rent_map = {}
        logger.warning("sector_rent_map.json not found, using default sector anchor")

    calibration_path = model_dir / "prediction_calibration.json"
    if calibration_path.exists():
        _calibration_artifact = json.loads(calibration_path.read_text())
        logger.info(
            "Loaded prediction calibration (%s)",
            _calibration_artifact.get("method", "unknown"),
        )
    else:
        _calibration_artifact = None
        logger.warning("prediction_calibration.json not found, serving raw predictions")

    interval_path = model_dir / "prediction_intervals.json"
    if interval_path.exists():
        _interval_artifact = json.loads(interval_path.read_text())
        logger.info(
            "Loaded prediction intervals (%s)",
            _interval_artifact.get("method", "unknown"),
        )
    else:
        _interval_artifact = None
        logger.warning("prediction_intervals.json not found, intervals disabled")

    if hasattr(_model, "n_features_in_"):
        expected = _model.n_features_in_
        actual = len(_feature_columns)
        if expected != actual:
            raise ValueError(
                f"Feature column mismatch: model expects {expected} features "
                f"but feature_columns.json has {actual}"
            )


def get_model_internals() -> Optional[Dict]:
    """Return the loaded model internals for explainability consumers.

    Pipeline step discovery is name-based rather than index-based so that
    adding preprocessing steps (e.g. a feature selector) does not silently
    break XAI consumers.
    """
    if _model is None or not _feature_columns:
        return None

    if not hasattr(_model, "steps"):
        return {
            "model": _model,
            "scaler": None,
            "xgb_model": _model,
            "feature_columns": list(_feature_columns),
            "log_target": _log_target,
            "feature_defaults": dict(FEATURE_DEFAULTS),
            "loaded_model_version": _loaded_model_version,
            "calibration_artifact": _calibration_artifact,
            "interval_artifact": _interval_artifact,
            "model_metadata": dict(_model_metadata),
        }

    # Discover pipeline steps by type rather than hardcoded index
    scaler = None
    xgb_model = None
    for _name, step in _model.steps:
        step_type = type(step).__name__
        if step_type in ("StandardScaler", "RobustScaler", "MinMaxScaler"):
            scaler = step
        elif step_type in ("XGBRegressor", "XGBClassifier", "GradientBoostingRegressor"):
            xgb_model = step

    # Fallback to positional if type detection fails (backwards compat).
    # A single-step pipeline is model-only, so do not masquerade as having a scaler.
    if scaler is None and len(_model.steps) >= 2:
        first_step = _model.steps[0][1]
        if hasattr(first_step, "transform"):
            scaler = first_step
    if xgb_model is None and len(_model.steps) >= 1:
        xgb_model = _model.steps[-1][1]

    return {
        "model": _model,
        "scaler": scaler,
        "xgb_model": xgb_model,
        "feature_columns": list(_feature_columns),
        "log_target": _log_target,
        "feature_defaults": dict(FEATURE_DEFAULTS),
        "loaded_model_version": _loaded_model_version,
        "calibration_artifact": _calibration_artifact,
        "interval_artifact": _interval_artifact,
        "model_metadata": dict(_model_metadata),
    }


def prepare_explainability_input(
    features_frame: pd.DataFrame,
    model=None,
):
    """Apply any preprocessing steps needed before tree-level explainability.

    The v7 pipeline is intentionally model-only, but older artifacts may still
    include preprocessing steps. This helper mirrors Pipeline.predict() up to
    the final estimator so SHAP always receives the estimator's true input.
    """
    pipeline = model or _model
    if pipeline is None or not hasattr(pipeline, "steps"):
        return features_frame

    transformed = features_frame
    for _name, step in pipeline.steps[:-1]:
        if hasattr(step, "transform"):
            transformed = step.transform(transformed)
    return transformed


def _validate_feature(name: str, value: float) -> None:
    """Warn if a feature value is outside its expected range."""
    if name in VALIDATION_RANGES:
        lo, hi = VALIDATION_RANGES[name]
        if value < lo or value > hi:
            logger.warning(
                "Feature '%s' = %.2f is outside expected range [%.1f, %.1f]",
                name,
                value,
                lo,
                hi,
            )


def _compute_location_score(distance_to_town_km: float, distance_to_uni_km: float) -> float:
    """Gaussian proximity score: max(town_proximity, uni_proximity)."""
    import math

    sigma_sq = 2.0 * _LOCATION_SIGMA_KM**2
    town_score = math.exp(-(distance_to_town_km**2) / sigma_sq)
    uni_score = math.exp(-(distance_to_uni_km**2) / sigma_sq)
    return round(max(town_score, uni_score), 4)


def build_prediction_features(
    property_features: Dict,
    feature_columns: List[str],
) -> Optional[Dict]:
    """Build the computed feature dict for ML prediction / XAI."""
    floor_area = property_features.get("floor_area_m2")
    if floor_area is None:
        return None

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

    energy_rating = property_features.get("energy_rating", "D")
    potential_rating = property_features.get("potential_rating", "C")
    energy_ordinal = ENERGY_ORDINAL.get(str(energy_rating).upper(), 3)
    potential_ordinal = ENERGY_ORDINAL.get(str(potential_rating).upper(), 4)

    property_type = normalise_property_type(property_features.get("property_type", "Flat"))
    num_rooms = property_features.get("num_rooms", FEATURE_DEFAULTS["num_rooms"])
    rooms_val = float(num_rooms) if num_rooms is not None else float(FEATURE_DEFAULTS["num_rooms"])
    floor_val = float(floor_area)
    rooms_per_m2 = round(rooms_val / max(floor_val, 10.0), 4)

    actual_beds = property_features.get("actual_bedrooms")
    if actual_beds is None:
        num_rooms_int = int(rooms_val)
        if property_type == "Flat":
            actual_beds = max(0, num_rooms_int - 1)
        else:
            actual_beds = max(1, num_rooms_int - 2)

    import math

    sigma_sq = 2.0 * _LOCATION_SIGMA_KM**2
    town_proximity_score = round(math.exp(-(distance_to_town**2) / sigma_sq), 4)
    uni_proximity_score = round(math.exp(-(distance_to_uni**2) / sigma_sq), 4)
    station_proximity_score = round(math.exp(-(distance_to_station**2) / sigma_sq), 4)
    accessibility_score = round(
        max(town_proximity_score, uni_proximity_score, station_proximity_score),
        4,
    )

    postcode = property_features.get("postcode", "")
    postcode_sector = extract_postcode_sector(postcode) if postcode else ""
    anchor_bucket = "Flat" if property_type == "Flat" else "House"
    sector_entry = _sector_rent_map.get(postcode_sector, FEATURE_DEFAULTS["sector_median_rent"])
    if isinstance(sector_entry, dict):
        sector_median_rent = float(
            sector_entry.get(anchor_bucket, FEATURE_DEFAULTS["sector_median_rent"])
        )
    else:
        sector_median_rent = float(sector_entry)

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
        "sale_count": float(property_features.get("sale_count") or FEATURE_DEFAULTS["sale_count"]),
        "sector_median_rent": sector_median_rent,
    }

    ptype_cols = [column for column in feature_columns if column.startswith("ptype_")]
    for column in ptype_cols:
        ptype_name = column.replace("ptype_", "")
        computed[column] = 1 if property_type == ptype_name else 0

    # built_form one-hot (v7.0.0), same pattern as ptype_*
    raw_built_form = str(property_features.get("built_form") or "").strip()
    bform_cols = [column for column in feature_columns if column.startswith("bform_")]
    for column in bform_cols:
        bform_name = column.replace("bform_", "")
        computed[column] = 1 if raw_built_form == bform_name else 0

    mains_gas = property_features.get("mains_gas_flag")
    computed["has_mains_gas"] = float(
        mains_gas if mains_gas is not None else FEATURE_DEFAULTS["has_mains_gas"]
    )

    floor_lvl = property_features.get("floor_level")
    floor_level_ordinal = float(
        floor_lvl if floor_lvl is not None else FEATURE_DEFAULTS["floor_level_ordinal"]
    )
    is_flat_for_floor = computed.get("ptype_Flat", 0)
    computed["flat_floor_premium"] = floor_level_ordinal * float(is_flat_for_floor)

    energy_cost = property_features.get("annual_energy_cost")
    computed["annual_energy_cost"] = float(
        energy_cost if energy_cost is not None else FEATURE_DEFAULTS["annual_energy_cost"]
    )

    computed["energy_improvement_gap"] = float(max(-3, min(6, potential_ordinal - energy_ordinal)))

    drop_pct = property_features.get("price_drop_pct")
    computed["price_drop_pct"] = float(
        drop_pct if drop_pct is not None else FEATURE_DEFAULTS["price_drop_pct"]
    )

    is_flat = computed.get("ptype_Flat", 0)
    computed["is_studio"] = float(1 if (is_flat == 1 and actual_beds == 0) else 0)

    postcode_district = postcode.strip().split()[0].upper() if postcode else ""
    computed["is_student_zone"] = float(1 if postcode_district in {"GU1", "GU2"} else 0)

    beds_for_ratio = max(float(actual_beds), 1.0)
    computed["m2_per_bedroom"] = round(floor_val / beds_for_ratio, 1)

    return computed


def _compute_prediction_confidence(
    property_features: Dict,
    postcode_sector: str,
    interval_half_width: float,
    predicted_rent: float,
) -> float:
    """Estimate a user-facing data-quality score for the prediction."""
    score = 52.0
    floor_area = property_features.get("floor_area_m2")
    if floor_area is not None and float(floor_area) >= 20:
        score += 14
    if property_features.get("lat") and property_features.get("lng"):
        score += 10
    if postcode_sector and postcode_sector in _sector_rent_map:
        score += 10
    if property_features.get("energy_rating"):
        score += 6

    if predicted_rent > 0 and interval_half_width > 0:
        relative_half_width = interval_half_width / predicted_rent
        score += max(0.0, 12.0 - (relative_half_width * 25.0))

    return float(min(round(score), 80))


def predict_rent(property_features: Dict) -> Optional[Dict]:
    """Predict weekly rent for a property."""
    if _model is None:
        logger.error("ML model not loaded, call load_model() first")
        return None
    if not _feature_columns:
        logger.error("Feature columns not loaded, call load_model() first")
        return None

    try:
        computed = build_prediction_features(property_features, _feature_columns)
        if computed is None:
            logger.warning("Cannot predict: floor_area_m2 is None")
            return None

        for name, value in computed.items():
            _validate_feature(name, float(value))

        feature_values = []
        for column in _feature_columns:
            if column in computed:
                feature_values.append(float(computed[column]))
            else:
                default = FEATURE_DEFAULTS.get(column, 0.0)
                logger.debug("Feature '%s' not in computed, using default %.2f", column, default)
                feature_values.append(float(default))

        features = pd.DataFrame([feature_values], columns=_feature_columns)
        raw_prediction = _model.predict(features)[0]
        raw_rent = float(np.expm1(raw_prediction)) if _log_target else float(raw_prediction)

        property_type = normalise_property_type(property_features.get("property_type"))
        postcode = property_features.get("postcode", "")
        postcode_sector = extract_postcode_sector(postcode) if postcode else ""
        predicted_rent = apply_prediction_calibration(
            raw_rent,
            property_type,
            _calibration_artifact,
            postcode_sector,
            postcode,
        )

        interval_half_width = interval_half_width_for_type(property_type, _interval_artifact)
        rent_low = round(max(predicted_rent - interval_half_width, 0.0), 2)
        rent_high = round(predicted_rent + interval_half_width, 2)

        confidence = _compute_prediction_confidence(
            property_features,
            postcode_sector,
            interval_half_width,
            predicted_rent,
        )

        logger.debug(
            "Predicted rent for %s: raw=£%.2f calibrated=£%.2f [£%.2f to £%.2f] quality=%d",
            property_features.get("postcode", "unknown"),
            raw_rent,
            predicted_rent,
            rent_low,
            rent_high,
            int(confidence),
        )

        return {
            "predicted_weekly_rent": predicted_rent,
            "rent_low": rent_low,
            "rent_high": rent_high,
            "confidence": confidence,
            "model_version": _loaded_model_version,
            "raw_prediction": round(raw_rent, 2),
        }

    except Exception:
        logger.error("Prediction failed", exc_info=True)
        return None
