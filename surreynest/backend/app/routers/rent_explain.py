"""Rent explainability (XAI) router.

Provides per-prediction feature contributions using XGBoost tree SHAP,
with human-readable plain English explanations.

Endpoint:
    GET /api/rent/explain/{uprn}

Returns feature-level contributions that explain WHY the model predicts
a specific rent for a property.
"""

import logging

import numpy as np
import pandas as pd
import xgboost as xgb_lib
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.rate_limit import limiter
from app.models import Property
from app.models.area_value import AreaValue
from app.services.score_service import get_safety_score

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Feature metadata for human-readable explanations ─────────────────────────

FEATURE_META = {
    "floor_area_m2": {
        "label": "Floor area",
        "unit": "m²",
        "icon": "📐",
        "explain_up": "Bigger properties cost more. This property is larger than average.",
        "explain_down": "This is a more compact property, which keeps the rent lower.",
        "explain_neutral": "This property is an average size for Guildford.",
    },
    "num_rooms": {
        "label": "Number of rooms",
        "unit": "rooms",
        "icon": "🚪",
        "explain_up": "More rooms means more space to live, which pushes rent up.",
        "explain_down": "Fewer rooms means a smaller property, so rent is lower.",
        "explain_neutral": "A typical number of rooms for this type of property.",
    },
    "estimated_bedrooms": {
        "label": "Bedrooms (estimated)",
        "unit": "beds",
        "icon": "🛏️",
        "explain_up": "More bedrooms allow more occupants, increasing the rent.",
        "explain_down": "Fewer bedrooms keep the rent down.",
        "explain_neutral": "Standard number of bedrooms for this property type.",
    },
    "rooms_per_m2": {
        "label": "Room density",
        "unit": "ratio",
        "icon": "📊",
        "explain_up": "Many rooms packed into a smaller space, typical of shared houses.",
        "explain_down": "Spacious rooms with generous floor area per room.",
        "explain_neutral": "Average room density for this type of property.",
    },
    "energy_rating_ordinal": {
        "label": "Energy rating",
        "unit": "EPC",
        "icon": "⚡",
        "explain_up": "A better energy rating (A/B) means lower bills, making the property more desirable.",
        "explain_down": "A lower energy rating (E/F/G) means higher energy bills, which can reduce demand.",
        "explain_neutral": "Average energy efficiency (C/D) for Guildford properties.",
    },
    "potential_rating_ordinal": {
        "label": "Potential energy rating",
        "unit": "EPC",
        "icon": "🔋",
        "explain_up": "High improvement potential suggests landlords could invest in better insulation.",
        "explain_down": "Limited room for energy efficiency improvement.",
        "explain_neutral": "Typical improvement potential.",
    },
    "distance_to_town_km": {
        "label": "Distance to town centre",
        "unit": "km",
        "icon": "🏙️",
        "explain_up": "Very close to Guildford town centre, walkable to shops and nightlife.",
        "explain_down": "Further from town, which reduces demand and lowers rent.",
        "explain_neutral": "Average distance to Guildford town centre.",
    },
    "distance_to_uni_km": {
        "label": "Distance to University of Surrey",
        "unit": "km",
        "icon": "🎓",
        "explain_up": "Very close to campus, highly desirable for students, pushing rent up.",
        "explain_down": "Further from uni, which means less student demand.",
        "explain_neutral": "Moderate distance to the University of Surrey.",
    },
    "distance_to_station_km": {
        "label": "Distance to train station",
        "unit": "km",
        "icon": "🚂",
        "explain_up": "Close to Guildford or London Road station, great for commuters.",
        "explain_down": "Further from train stations, so less convenient for commuters.",
        "explain_neutral": "Average distance to the nearest train station.",
    },
    "safety_score": {
        "label": "Area safety",
        "unit": "/100",
        "icon": "🛡️",
        "explain_up": "Very safe area with low crime. People pay more to live in safe neighbourhoods.",
        "explain_down": "Higher crime in this area reduces demand slightly.",
        "explain_neutral": "Average safety for Guildford.",
    },
    "sale_count": {
        "label": "Market activity nearby",
        "unit": "sales",
        "icon": "📈",
        "explain_up": "Lots of property sales in this area, an active, in-demand market.",
        "explain_down": "Fewer sales nearby, a quieter property market.",
        "explain_neutral": "Average market activity for this area.",
    },
    "ptype_Flat": {
        "label": "Property type: Flat",
        "unit": "",
        "icon": "🏢",
        "explain_up": "Flats make up the majority of student rental properties in Guildford.",
        "explain_down": "Not a flat, houses tend to have different pricing patterns.",
        "explain_neutral": "Property type factored into the prediction.",
    },
    "ptype_Detached": {
        "label": "Property type: Detached house",
        "unit": "",
        "icon": "🏠",
        "explain_up": "Detached houses are larger and more private, commanding higher rent.",
        "explain_down": "Not a detached house.",
        "explain_neutral": "Property type factored into the prediction.",
    },
    "ptype_Semi-Detached": {
        "label": "Property type: Semi-detached",
        "unit": "",
        "icon": "🏘️",
        "explain_up": "Semi-detached houses offer a balance of space and affordability.",
        "explain_down": "Not a semi-detached house.",
        "explain_neutral": "Property type factored into the prediction.",
    },
    "ptype_Terraced": {
        "label": "Property type: Terraced house",
        "unit": "",
        "icon": "🏗️",
        "explain_up": "Terraced houses are popular in central Guildford.",
        "explain_down": "Not a terraced house.",
        "explain_neutral": "Property type factored into the prediction.",
    },
}

ENERGY_LABELS = {0: "G", 1: "F", 2: "E", 3: "D", 4: "C", 5: "B", 6: "A"}


def _get_explanation(feature_name: str, contribution: float) -> str:
    """Get a plain-English explanation for a feature contribution direction."""
    meta = FEATURE_META.get(feature_name, {})
    if abs(contribution) < 0.005:
        return meta.get(
            "explain_neutral", "This feature has a minimal effect on the prediction."
        )
    elif contribution > 0:
        return meta.get("explain_up", "This pushes the rent higher.")
    else:
        return meta.get("explain_down", "This lowers the rent.")


def _format_feature_value(feature_name: str, raw_value: float) -> str:
    """Format a feature value for human display."""
    if feature_name == "floor_area_m2":
        return f"{raw_value:.0f} m²"
    elif feature_name in ("num_rooms", "estimated_bedrooms"):
        return f"{int(raw_value)}"
    elif feature_name == "rooms_per_m2":
        return f"{raw_value:.3f}"
    elif feature_name.startswith("energy_") or feature_name.startswith("potential_"):
        return ENERGY_LABELS.get(int(raw_value), str(int(raw_value)))
    elif feature_name.startswith("distance_"):
        return f"{raw_value:.1f} km"
    elif feature_name == "safety_score":
        return f"{raw_value:.0f}/100"
    elif feature_name == "sale_count":
        return f"{int(raw_value)} recent sales"
    elif feature_name.startswith("ptype_"):
        return "Yes" if raw_value > 0.5 else "No"
    return f"{raw_value:.2f}"


@router.get(
    "/rent/explain/{uprn}",
    summary="Explain rent prediction for a property (XAI)",
)
@limiter.limit("30/minute")
async def explain_rent_prediction(
    request: Request,
    uprn: str,
    db: Session = Depends(get_db),
):
    """Get a detailed explanation of how the ML model predicted rent.

    Uses XGBoost tree SHAP to compute per-prediction feature contributions,
    then wraps each with human-readable plain English explanations.
    """
    # ── 1. Load property ────────────────────────────────────────────────
    prop = db.query(Property).filter(Property.uprn == uprn).first()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Property not found"
        )

    # ── 3. Build features (shared with predict_rent) ──────────────────
    from app.ml.predict import (
        build_prediction_features,
        get_model_internals,
        prepare_explainability_input,
    )

    internals = get_model_internals()
    if internals is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML model not loaded",
        )

    model_pipeline = internals["model"]
    xgb_model = internals["xgb_model"]
    feature_columns = internals["feature_columns"]
    log_target = internals["log_target"]
    feature_defaults = internals["feature_defaults"]
    calibration_artifact = internals.get("calibration_artifact")
    loaded_model_version = internals.get(
        "loaded_model_version", settings.ml_model_version
    )
    model_metadata = internals.get("model_metadata", {})

    floor_area = prop.floor_area_m2
    if floor_area is None:
        raise HTTPException(status_code=400, detail="Property missing floor area")

    # Gather raw property attributes for the shared feature builder
    safety_score = 50.0
    postcode_parts = str(prop.postcode or "").strip().split()
    if len(postcode_parts) >= 2:
        sector = f"{postcode_parts[0]} {postcode_parts[1][0]}"
        safety_info = get_safety_score(sector, db)
        if safety_info and safety_info.get("safety_score") is not None:
            safety_score = safety_info["safety_score"]

    area_val = db.query(AreaValue).filter(AreaValue.postcode == prop.postcode).first()
    sale_count = int(area_val.sale_count) if area_val and area_val.sale_count else 1
    property_type = prop.property_type or "Flat"
    num_rooms = prop.num_rooms or feature_defaults["num_rooms"]

    raw_features = {
        "floor_area_m2": prop.floor_area_m2,
        "num_rooms": num_rooms,
        "energy_rating": prop.energy_rating,
        "potential_rating": prop.potential_rating,
        "property_type": property_type,
        "lat": prop.lat,
        "lng": prop.lng,
        "postcode": prop.postcode,
        "safety_score": safety_score,
        "sale_count": sale_count,
    }

    computed = build_prediction_features(raw_features, feature_columns)
    if computed is None:
        raise HTTPException(status_code=400, detail="Property missing floor area")

    est_beds = int(computed.get("actual_bedrooms", 0))

    # ── 4. Assemble feature vector ─────────────────────────────────────
    feature_values = []
    for col in feature_columns:
        feature_values.append(float(computed.get(col, feature_defaults.get(col, 0.0))))

    features_frame = pd.DataFrame([feature_values], columns=feature_columns)
    model_input = prepare_explainability_input(features_frame, model_pipeline)

    if xgb_model is None or not hasattr(xgb_model, "get_booster"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Rent explainability is unavailable for the loaded ML artifact",
        )

    # ── 5. Get prediction ──────────────────────────────────────────────
    pred_log = model_pipeline.predict(features_frame)[0]
    raw_predicted_rent = (
        round(float(np.expm1(pred_log)), 2) if log_target else round(float(pred_log), 2)
    )
    from app.ml.calibration import apply_prediction_calibration

    postcode_parts = str(prop.postcode or "").strip().split()
    postcode_sector = (
        f"{postcode_parts[0]} {postcode_parts[1][0]}"
        if len(postcode_parts) >= 2 and postcode_parts[1]
        else ""
    )

    predicted_rent = apply_prediction_calibration(
        raw_predicted_rent,
        property_type,
        calibration_artifact,
        postcode_sector,
        prop.postcode,
    )

    # ── 6. Get SHAP contributions ──────────────────────────────────────
    dmat = xgb_lib.DMatrix(model_input, feature_names=feature_columns)
    contribs = xgb_model.get_booster().predict(dmat, pred_contribs=True)[0]

    # contribs has len(features) + 1 entries (last = bias/intercept term)
    feature_contribs = contribs[:-1]

    # Convert SHAP values from log-space to approximate % of final rent
    total_abs = sum(abs(float(c)) for c in feature_contribs)
    if total_abs == 0:
        total_abs = 1.0

    # ── 7. Build response ──────────────────────────────────────────────
    contributions = []
    for i, col in enumerate(feature_columns):
        raw_contrib = float(feature_contribs[i])
        pct = round((abs(raw_contrib) / total_abs) * 100, 1)
        direction = (
            "up" if raw_contrib > 0 else "down" if raw_contrib < 0 else "neutral"
        )
        meta = FEATURE_META.get(col, {})

        contributions.append(
            {
                "feature": col,
                "label": meta.get("label", col),
                "icon": meta.get("icon", "📋"),
                "value": computed.get(col, 0.0),
                "value_display": _format_feature_value(col, computed.get(col, 0.0)),
                "contribution_pct": pct,
                "raw_shap": round(raw_contrib, 4),
                "direction": direction,
                "explanation": _get_explanation(col, raw_contrib),
            }
        )

    # Sort by absolute contribution (biggest first)
    contributions.sort(key=lambda x: x["contribution_pct"], reverse=True)

    # Global feature importance from model
    global_importance = []
    importances = xgb_model.feature_importances_
    for col, imp in sorted(zip(feature_columns, importances), key=lambda x: -x[1]):
        meta = FEATURE_META.get(col, {})
        global_importance.append(
            {
                "feature": col,
                "label": meta.get("label", col),
                "importance_pct": round(float(imp) * 100, 1),
            }
        )

    # ── 8. Rent comparison (sector median) ─────────────────────────────
    # Use rent_predictions table to get sector median
    from app.models.rent_prediction import RentPrediction

    sector_str = ""
    if len(postcode_parts) >= 2:
        sector_str = f"{postcode_parts[0]} {postcode_parts[1][0]}"

    # Get sector median from cached predictions
    sector_preds = (
        db.query(RentPrediction.predicted_weekly_rent)
        .join(Property, Property.uprn == RentPrediction.uprn)
        .filter(
            Property.postcode.ilike(f"{sector_str}%"),
            RentPrediction.model_version == loaded_model_version,
        )
        .all()
    )
    sector_rents = [p[0] for p in sector_preds if p[0]]
    sector_median = round(float(np.median(sector_rents)), 2) if sector_rents else None

    # Guildford median
    all_preds = (
        db.query(RentPrediction.predicted_weekly_rent)
        .filter(RentPrediction.model_version == loaded_model_version)
        .all()
    )
    all_rents = [p[0] for p in all_preds if p[0]]
    guildford_median = round(float(np.median(all_rents)), 2) if all_rents else None

    rent_comparison = {
        "sector": sector_str,
        "sector_median": sector_median,
        "guildford_median": guildford_median,
    }
    if sector_median and predicted_rent:
        diff_pct = round((predicted_rent - sector_median) / sector_median * 100, 1)
        rent_comparison["vs_sector_pct"] = diff_pct
    if guildford_median and predicted_rent:
        diff_pct = round(
            (predicted_rent - guildford_median) / guildford_median * 100, 1
        )
        rent_comparison["vs_guildford_pct"] = diff_pct

    return {
        "predicted_weekly_rent": predicted_rent,
        "model_version": loaded_model_version,
        "property": {
            "uprn": prop.uprn,
            "address": prop.address or "",
            "postcode": prop.postcode,
            "property_type": property_type,
            "floor_area_m2": float(floor_area),
            "num_rooms": int(num_rooms),
            "energy_rating": prop.energy_rating,
            "estimated_bedrooms": est_beds,
        },
        "feature_contributions": contributions,
        "global_feature_importance": global_importance,
        "rent_comparison": rent_comparison,
        "model_info": {
            "algorithm": "XGBoost (Gradient Boosted Trees)",
            "training_properties": model_metadata.get("train_size"),
            "log_transform": log_target,
            "feature_count": len(feature_columns),
        },
    }
