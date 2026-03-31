"""Score service: safety score computation and rent fairness scoring.

Safety scores are computed on-the-fly from crime_data table using the same
weighted formula as the pipeline. Rent fairness uses the ML model prediction
and the formula from docs/ml-model.md.
"""

import logging
from statistics import median
from datetime import datetime, timezone
from typing import Dict, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.crime_data import CrimeData
from app.models.hmo_record import HmoRecord
from app.models.pipeline_config import PipelineConfig
from app.models.property import Property
from app.models.rent_prediction import RentPrediction
from app.models.area_value import AreaValue
from app.utils.safety_weights import CATEGORY_WEIGHTS, DEFAULT_WEIGHT

logger = logging.getLogger(__name__)
_RENT_POSTPROCESS_VERSION = "lc1"

# Default fallback, only used if the pipeline_config table has no row yet
_IPHRP_FALLBACK = 6.0


def _get_latest_iphrp_growth(db: Session) -> float:
    """Read the latest IPHRP growth % from the pipeline_config table.

    The features pipeline writes this value every time it runs,
    so it always reflects the latest ONS data without needing a
    backend restart.

    Args:
        db: Active SQLAlchemy session (reuses the request's session).

    Returns:
        Latest South East IPHRP annual % (e.g. 6.005659).
        Falls back to 6.0 if the row doesn't exist yet.
    """
    try:
        row = (
            db.query(PipelineConfig)
            .filter(PipelineConfig.key == "iphrp_growth_pct")
            .first()
        )
        if row is not None:
            return float(row.value)
    except Exception as e:
        logger.warning("Could not read IPHRP from pipeline_config: %s", e)

    logger.warning("Using fallback IPHRP growth: %.1f%%", _IPHRP_FALLBACK)
    return _IPHRP_FALLBACK


def _safety_label(score: float) -> str:
    """Convert a numeric safety score to a human-readable label.

    Args:
        score: Safety score 0-100 (higher = safer).

    Returns:
        Label string: Very Safe / Safe / Moderate / Concerning / High Crime Area.
    """
    if score >= 80:
        return "Very Safe"
    if score >= 60:
        return "Safe"
    if score >= 40:
        return "Moderate"
    if score >= 20:
        return "Concerning"
    return "High Crime Area"


# ── Cached normaliser for safety score ────────────────────────────────────────
# The 95th-percentile normaliser is identical across all sectors and only changes
# when the crime pipeline runs (monthly). We cache it in Redis so the value
# is shared across all Uvicorn workers.

_NORMALISER_TTL = 600  # 10 minutes
_NORMALISER_CACHE_KEY = "safety:normaliser_p95"


def _get_safety_normaliser(db: Session) -> float:
    """Read the 95th-percentile normaliser, with Redis cache.

    Priority:
    1. Redis cache (shared across workers, 10-min TTL)
    2. pipeline_config table (written by crime_pipeline)
    3. Fallback: compute on-the-fly (first run only, before pipeline has run)

    Args:
        db: SQLAlchemy session.

    Returns:
        The normaliser value (positive float, never zero).
    """
    from app.cache import get_json, set_json

    # 1. Redis cache
    cached = get_json(_NORMALISER_CACHE_KEY)
    if cached is not None:
        return float(cached)

    # 2. pipeline_config table
    try:
        row = (
            db.query(PipelineConfig)
            .filter(PipelineConfig.key == "safety_normaliser_p95")
            .first()
        )
        if row is not None:
            val = float(row.value)
            if val > 0:
                set_json(_NORMALISER_CACHE_KEY, val, _NORMALISER_TTL)
                return val
    except Exception as e:
        logger.warning("Could not read safety_normaliser_p95: %s", e)

    # 3. Fallback: compute once on-the-fly (only needed before first pipeline run)
    logger.warning("safety_normaliser_p95 not in pipeline_config, computing on-the-fly")
    all_crime = (
        db.query(
            CrimeData.postcode_sector,
            CrimeData.category,
            func.sum(CrimeData.count).label("total_count"),
        )
        .group_by(CrimeData.postcode_sector, CrimeData.category)
        .all()
    )
    sector_weighted: Dict[str, float] = {}
    for row in all_crime:
        w = CATEGORY_WEIGHTS.get(row.category, DEFAULT_WEIGHT)
        sector_weighted[row.postcode_sector] = (
            sector_weighted.get(row.postcode_sector, 0.0) + row.total_count * w
        )
    if not sector_weighted:
        return 1.0

    weighted_values = sorted(sector_weighted.values())
    idx_95 = int(len(weighted_values) * 0.95)
    normaliser = weighted_values[min(idx_95, len(weighted_values) - 1)]
    if normaliser == 0:
        normaliser = 1.0

    set_json(_NORMALISER_CACHE_KEY, normaliser, _NORMALISER_TTL)
    return normaliser


def get_safety_score(postcode_sector: str, db: Session) -> Optional[Dict]:
    """Compute safety score for a postcode sector from crime data.

    Performance: O(1) per call. Queries only the target sector's crimes,
    not the entire crime_data table. The normaliser is read from a cached
    pipeline_config value (written monthly by crime_pipeline).

    Args:
        postcode_sector: Postcode sector, e.g. "GU2 7".
        db: SQLAlchemy session.

    Returns:
        Dict with safety_score and breakdown, or None if no data.
    """
    # Get crime data for this sector only
    rows = (
        db.query(
            CrimeData.category,
            func.sum(CrimeData.count).label("total_count"),
        )
        .filter(CrimeData.postcode_sector == postcode_sector)
        .group_by(CrimeData.category)
        .all()
    )

    if not rows:
        return {
            "postcode_sector": postcode_sector,
            "safety_score": None,
            "label": "Data not available",
            "available": False,
            "breakdown": [],
        }

    # Compute weighted sum for this sector
    weighted_sum = 0.0
    breakdown = []
    for row in rows:
        weight = CATEGORY_WEIGHTS.get(row.category, DEFAULT_WEIGHT)
        weighted_sum += row.total_count * weight
        breakdown.append(
            {
                "category": row.category,
                "total_count": row.total_count,
            }
        )

    # Read cached normaliser (O(1), no full-table scan)
    normaliser = _get_safety_normaliser(db)

    safety_score = max(0.0, min(100.0, 100.0 - (weighted_sum / normaliser * 100.0)))

    return {
        "postcode_sector": postcode_sector,
        "safety_score": round(safety_score, 1),
        "label": _safety_label(safety_score),
        "available": True,
        "breakdown": sorted(breakdown, key=lambda x: x["total_count"], reverse=True),
    }


def compute_fairness_score(actual_rent: float, predicted_rent: float) -> Dict:
    """Convert rent deviation into a 0-100 fairness score.

    Uses the formula from docs/ml-model.md.

    Args:
        actual_rent: Weekly rent in £ as submitted by tenant.
        predicted_rent: Model's predicted fair weekly rent for this property.

    Returns:
        Dict with score, label, colour, ratio, and rent comparison details.
    """
    if predicted_rent <= 0:
        return {
            "score": 50,
            "label": "Unable to compute",
            "colour": "amber",
            "ratio": 0.0,
            "predicted_rent": 0.0,
            "actual_rent": actual_rent,
            "difference_pounds": 0.0,
            "difference_percent": 0.0,
        }

    ratio = actual_rent / predicted_rent

    if ratio <= 0.85:
        score = 90 + int((0.85 - ratio) / 0.15 * 10)
        label = "Excellent deal"
        colour = "green"
    elif ratio <= 1.00:
        score = 70 + int((1.00 - ratio) / 0.15 * 20)
        label = "Below market"
        colour = "green"
    elif ratio <= 1.10:
        score = 55 + int((1.10 - ratio) / 0.10 * 15)
        label = "At market rate"
        colour = "amber"
    elif ratio <= 1.25:
        score = 35 + int((1.25 - ratio) / 0.15 * 20)
        label = "Slightly above market"
        colour = "amber"
    elif ratio <= 1.40:
        score = 15 + int((1.40 - ratio) / 0.15 * 20)
        label = "Above market"
        colour = "red"
    else:
        score = max(0, 15 - int((ratio - 1.40) / 0.20 * 15))
        label = "Significantly overpriced"
        colour = "red"

    score = max(0, min(100, score))

    return {
        "score": score,
        "label": label,
        "colour": colour,
        "ratio": round(ratio, 2),
        "predicted_rent": round(predicted_rent, 2),
        "actual_rent": actual_rent,
        "difference_pounds": round(actual_rent - predicted_rent, 2),
        "difference_percent": round((ratio - 1) * 100, 1),
    }


def _is_similar_size(target_area: Optional[float], comp_area: Optional[float]) -> bool:
    """Return True when a comparable property's size is close to the target."""
    if target_area is None or comp_area is None:
        return True

    target = float(target_area)
    comp = float(comp_area)
    tolerance = max(10.0, target * 0.15)
    return abs(target - comp) <= tolerance


def _blend_with_local_rent_comps(
    *,
    prop: Property,
    predicted_rent: Optional[float],
    rent_low: Optional[float],
    rent_high: Optional[float],
    db: Session,
) -> tuple[Optional[float], Optional[float], Optional[float]]:
    """Ground a model prediction with strong exact-postcode observed-rent comps.

    This only applies when SurreyNest already has real rented comparables at the
    same postcode, for the same property type, and with matching bedrooms / size.
    """
    if predicted_rent is None or not prop.postcode or not prop.property_type:
        return predicted_rent, rent_low, rent_high

    exact_rows = (
        db.query(Property)
        .filter(Property.uprn != prop.uprn)
        .filter(Property.actual_market_rent_weekly.isnot(None))
        .filter(Property.property_type == prop.property_type)
        .filter(Property.postcode == prop.postcode)
        .all()
    )

    strong_exact = []
    for row in exact_rows:
        if prop.actual_bedrooms is not None and row.actual_bedrooms not in (
            None,
            prop.actual_bedrooms,
        ):
            continue
        if not _is_similar_size(prop.floor_area_m2, row.floor_area_m2):
            continue
        strong_exact.append(float(row.actual_market_rent_weekly))

    if not strong_exact:
        return predicted_rent, rent_low, rent_high

    comp_anchor = float(median(strong_exact))
    blended_rent = round((float(predicted_rent) * 0.35) + (comp_anchor * 0.65), 2)
    delta = blended_rent - float(predicted_rent)

    adjusted_low = round(
        max(
            (float(rent_low) if rent_low is not None else float(predicted_rent))
            + delta,
            0.0,
        ),
        2,
    )
    adjusted_high = round(
        max(
            (float(rent_high) if rent_high is not None else float(predicted_rent))
            + delta,
            0.0,
        ),
        2,
    )

    return blended_rent, adjusted_low, adjusted_high


def get_rent_prediction(
    uprn: str, db: Session, bedrooms_override: Optional[int] = None
) -> Optional[Dict]:
    """Get rent prediction for a property, using cache first.

    If not cached or stale, runs the ML model and caches the result.

    Args:
        uprn: Property UPRN.
        db: SQLAlchemy session.

    Returns:
        Dict with predicted_weekly_rent, model_version, computed_at; or None.
    """
    from app.ml.predict import get_loaded_model_version

    active_model_version = f"{get_loaded_model_version()}+{_RENT_POSTPROCESS_VERSION}"

    # Check cache first
    cached = db.query(RentPrediction).filter(RentPrediction.uprn == uprn).first()

    if (
        cached is not None
        and cached.model_version == active_model_version
        and bedrooms_override is None
    ):
        return {
            "predicted_weekly_rent": cached.predicted_weekly_rent,
            "rent_low": cached.confidence_low,
            "rent_high": cached.confidence_high,
            "confidence": cached.confidence,
            "model_version": cached.model_version,
            "computed_at": cached.computed_at,
        }

    # Cache miss or stale, run ML model
    prop = db.query(Property).filter(Property.uprn == uprn).first()
    if not prop:
        return None

    # University-managed accommodation: skip ML prediction
    if prop.is_university:
        return {
            "predicted_weekly_rent": None,
            "is_university_managed": True,
            "message": "University-managed accommodation, bills included in rent",
            "model_version": active_model_version,
            "computed_at": datetime.now(timezone.utc),
        }

    try:
        from app.ml.predict import predict_rent

        # ── Look up Area Value index ────────────────────────────────────
        area_val = (
            db.query(AreaValue).filter(AreaValue.postcode == prop.postcode).first()
        )

        area_value_index = float(area_val.area_value_index) if area_val else 0.5
        sale_count = int(area_val.sale_count) if area_val and area_val.sale_count else 1

        # ── Safety score for this postcode sector ───────────────────────
        postcode_parts = str(prop.postcode or "").strip().split()
        safety_score = 50.0
        if len(postcode_parts) >= 2:
            sector = f"{postcode_parts[0]} {postcode_parts[1][0]}"
            safety_info = get_safety_score(sector, db)
            if safety_info and safety_info.get("safety_score") is not None:
                safety_score = safety_info["safety_score"]

        # ── HMO flag ────────────────────────────────────────────────────
        is_hmo = int(
            db.query(HmoRecord).filter(HmoRecord.postcode == prop.postcode).count() > 0
        )

        # ── IPHRP growth (read from latest pipeline data, not hardcoded) ────
        iphrp_growth_pct = _get_latest_iphrp_growth(db)

        features = {
            "floor_area_m2": prop.floor_area_m2,
            "num_rooms": prop.num_rooms,
            "energy_rating": prop.energy_rating,
            "potential_rating": prop.potential_rating,
            "property_type": prop.property_type,
            "lat": prop.lat,
            "lng": prop.lng,
            "postcode": prop.postcode,
            "is_hmo": is_hmo,
            "safety_score": safety_score,
            "area_value_index": area_value_index,
            "sale_count": sale_count,
            "iphrp_growth_pct": iphrp_growth_pct,
            # v3.3.0: new EPC-derived features
            "construction_age_band": prop.construction_age_band,
            "mains_gas_flag": prop.mains_gas_flag,
            "floor_level": prop.floor_level,
            "annual_energy_cost": prop.annual_energy_cost,
            # v4.0.0: scraped features
            "price_drop_pct": prop.price_drop_pct,
            # v4.1.0: Real/overridden bedrooms
            "actual_bedrooms": (
                bedrooms_override
                if bedrooms_override is not None
                else prop.actual_bedrooms
            ),
        }

        result = predict_rent(features)
        if result is None:
            return None

        predicted_rent = result["predicted_weekly_rent"]
        rent_low = result.get("rent_low")
        rent_high = result.get("rent_high")
        confidence = result.get("confidence")
        result_version = f"{result.get('model_version', active_model_version)}+{_RENT_POSTPROCESS_VERSION}"

        predicted_rent, rent_low, rent_high = _blend_with_local_rent_comps(
            prop=prop,
            predicted_rent=predicted_rent,
            rent_low=rent_low,
            rent_high=rent_high,
            db=db,
        )

        # Cache the prediction
        now = datetime.now(timezone.utc)
        prediction = RentPrediction(
            uprn=uprn,
            predicted_weekly_rent=predicted_rent,
            confidence_low=rent_low,
            confidence_high=rent_high,
            confidence=confidence,
            model_version=result_version,
            computed_at=now,
        )
        db.merge(prediction)
        db.commit()

        return {
            "predicted_weekly_rent": predicted_rent,
            "rent_low": rent_low,
            "rent_high": rent_high,
            "confidence": confidence,
            "model_version": result_version,
            "computed_at": now,
        }

    except Exception:
        logger.error("ML prediction failed for UPRN %s", uprn, exc_info=True)
        return None
