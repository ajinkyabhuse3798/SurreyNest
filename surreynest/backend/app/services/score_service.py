"""Score service: safety score computation and rent fairness scoring.

Safety scores are computed on-the-fly from crime_data table using the same
weighted formula as the pipeline. Rent fairness uses the ML model prediction
and the formula from docs/ml-model.md.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.models.crime_data import CrimeData
from app.models.property import Property
from app.models.rent_prediction import RentPrediction

logger = logging.getLogger(__name__)

# ── Crime category weights (same as features.py) ─────────────────────────────
CATEGORY_WEIGHTS: Dict[str, float] = {
    "violent-crime": 3.0,
    "robbery": 2.5,
    "anti-social-behaviour": 2.0,
    "burglary": 2.0,
    "drugs": 1.5,
    "public-order": 1.5,
    "vehicle-crime": 1.0,
    "theft-from-the-person": 1.0,
}
DEFAULT_WEIGHT = 0.5


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


def get_safety_score(
    postcode_sector: str, db: Session
) -> Optional[Dict]:
    """Compute safety score for a postcode sector from crime data.

    Args:
        postcode_sector: Postcode sector, e.g. "GU2 7".
        db: SQLAlchemy session.

    Returns:
        Dict with safety_score and breakdown, or None if no data.
    """
    # Get crime data for this sector
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

    # Compute weighted sum
    weighted_sum = 0.0
    breakdown = []
    for row in rows:
        weight = CATEGORY_WEIGHTS.get(row.category, DEFAULT_WEIGHT)
        weighted_sum += row.total_count * weight
        breakdown.append({
            "category": row.category,
            "total_count": row.total_count,
        })

    # Get normaliser from all sectors (95th percentile)
    all_sectors = (
        db.query(
            CrimeData.postcode_sector,
            func.sum(CrimeData.count).label("total"),
        )
        .group_by(CrimeData.postcode_sector)
        .all()
    )

    if not all_sectors:
        return {
            "postcode_sector": postcode_sector,
            "safety_score": None,
            "label": "Data not available",
            "available": False,
            "breakdown": [],
        }

    # Compute weighted sums per sector
    sector_weighted = {}
    all_crime = (
        db.query(
            CrimeData.postcode_sector,
            CrimeData.category,
            func.sum(CrimeData.count).label("total_count"),
        )
        .group_by(CrimeData.postcode_sector, CrimeData.category)
        .all()
    )
    for row in all_crime:
        w = CATEGORY_WEIGHTS.get(row.category, DEFAULT_WEIGHT)
        sector_weighted[row.postcode_sector] = (
            sector_weighted.get(row.postcode_sector, 0.0) + row.total_count * w
        )

    weighted_values = sorted(sector_weighted.values())
    idx_95 = int(len(weighted_values) * 0.95)
    normaliser = weighted_values[min(idx_95, len(weighted_values) - 1)]

    if normaliser == 0:
        normaliser = 1.0

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


def get_rent_prediction(uprn: str, db: Session) -> Optional[Dict]:
    """Get rent prediction for a property, using cache first.

    If not cached or stale, runs the ML model and caches the result.

    Args:
        uprn: Property UPRN.
        db: SQLAlchemy session.

    Returns:
        Dict with predicted_weekly_rent, model_version, computed_at; or None.
    """
    # Check cache first
    cached = db.query(RentPrediction).filter(
        RentPrediction.uprn == uprn
    ).first()

    if cached is not None and cached.model_version == settings.ml_model_version:
        return {
            "predicted_weekly_rent": cached.predicted_weekly_rent,
            "model_version": cached.model_version,
            "computed_at": cached.computed_at,
        }

    # Cache miss or stale — run ML model
    prop = db.query(Property).filter(Property.uprn == uprn).first()
    if not prop:
        return None

    try:
        from app.ml.predict import predict_rent

        features = {
            "floor_area_m2": prop.floor_area_m2,
            "num_rooms": prop.num_rooms,
            "energy_rating": prop.energy_rating,
            "potential_rating": prop.potential_rating,
            "property_type": prop.property_type,
            "lat": prop.lat,
            "lng": prop.lng,
            "postcode": prop.postcode,
        }

        result = predict_rent(features)
        if result is None:
            return None

        predicted_rent = result["predicted_weekly_rent"]

        # Cache the prediction
        now = datetime.now(timezone.utc)
        prediction = RentPrediction(
            uprn=uprn,
            predicted_weekly_rent=predicted_rent,
            model_version=settings.ml_model_version,
            computed_at=now,
        )
        db.merge(prediction)
        db.commit()

        return {
            "predicted_weekly_rent": predicted_rent,
            "model_version": settings.ml_model_version,
            "computed_at": now,
        }

    except Exception:
        logger.error("ML prediction failed for UPRN %s", uprn, exc_info=True)
        return None
