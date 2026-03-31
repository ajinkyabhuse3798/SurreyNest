"""Prediction calibration and interval utilities for the rent model.

These helpers keep training, evaluation, and inference aligned:
- fit a lightweight linear calibrator on out-of-fold predictions
- learn a shrunk sector-type residual correction for small local segments
- derive conformal-style absolute-error bands
- apply both artifacts consistently at inference time
"""

from __future__ import annotations

from typing import Dict, Iterable, Optional

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

KNOWN_PROPERTY_TYPES = (
    "Flat",
    "Semi-Detached",
    "Terraced",
    "Detached",
    "Other",
)

INTERVAL_ALPHA = 0.2
MIN_TYPE_INTERVAL_SAMPLES = 25
SECTOR_TYPE_MIN_SAMPLES = 6
SECTOR_TYPE_SHRINKAGE = 8.0
PRIOR_POSTCODE_SHRINKAGE = 8.0
PRIOR_SECTOR_SHRINKAGE = 10.0
PRIOR_BLEND_MODEL_WEIGHT = 0.9


def normalise_property_type(property_type: Optional[str]) -> str:
    """Map any property type string to the supported calibration buckets."""
    value = str(property_type or "").strip()
    return value if value in KNOWN_PROPERTY_TYPES[:-1] else "Other"


def property_type_series_from_frame(df: pd.DataFrame) -> pd.Series:
    """Derive a property-type label series from one-hot encoded feature columns."""
    labels = np.full(len(df), "Other", dtype=object)

    label_by_column = {
        "ptype_Flat": "Flat",
        "ptype_Semi-Detached": "Semi-Detached",
        "ptype_Terraced": "Terraced",
        "ptype_Detached": "Detached",
    }
    for column, label in label_by_column.items():
        if column in df.columns:
            mask = df[column].fillna(0).astype(int).eq(1).to_numpy()
            labels[mask] = label

    return pd.Series(labels, index=df.index, dtype="object")


def build_calibration_design(
    raw_predictions: Iterable[float],
    property_types: Iterable[str],
) -> pd.DataFrame:
    """Build the tiny linear-model design matrix used for calibration."""
    pred_arr = np.asarray(list(raw_predictions), dtype=float)
    type_arr = [normalise_property_type(value) for value in property_types]

    data: Dict[str, np.ndarray] = {
        "raw_prediction": pred_arr,
    }
    for label in KNOWN_PROPERTY_TYPES[:-1]:
        column = f"is_{label.lower().replace('-', '_')}"
        mask = np.asarray(
            [1.0 if value == label else 0.0 for value in type_arr], dtype=float
        )
        data[column] = mask
        data[f"raw_x_{column}"] = pred_arr * mask

    return pd.DataFrame(data)


def fit_sector_type_adjustment_artifact(
    base_predictions: Iterable[float],
    y_true: Iterable[float],
    property_types: Iterable[str],
    postcode_sectors: Iterable[str],
    *,
    min_samples: int = SECTOR_TYPE_MIN_SAMPLES,
    shrinkage: float = SECTOR_TYPE_SHRINKAGE,
) -> Dict:
    """Fit a shrunk postcode-sector/type residual correction artifact."""
    frame = pd.DataFrame(
        {
            "postcode_sector": pd.Series(list(postcode_sectors), dtype="object")
            .fillna("")
            .astype(str),
            "property_type": [
                normalise_property_type(value) for value in property_types
            ],
            "residual": np.asarray(list(y_true), dtype=float)
            - np.asarray(list(base_predictions), dtype=float),
        }
    )

    global_mean = float(frame["residual"].mean()) if not frame.empty else 0.0
    type_stats = frame.groupby("property_type")["residual"].agg(["mean", "count"])
    sector_type_stats = frame.groupby(["postcode_sector", "property_type"])[
        "residual"
    ].agg(["mean", "count"])

    by_type = {
        label: {
            "mean": float(row["mean"]),
            "count": int(row["count"]),
        }
        for label, row in type_stats.iterrows()
    }

    by_sector_type: Dict[str, Dict[str, Dict[str, float]]] = {}
    for (sector, label), row in sector_type_stats.iterrows():
        by_sector_type.setdefault(str(sector), {})[str(label)] = {
            "mean": float(row["mean"]),
            "count": int(row["count"]),
        }

    return {
        "method": "shrunk_sector_type_residual",
        "global_mean": global_mean,
        "min_samples": int(min_samples),
        "shrinkage": float(shrinkage),
        "by_type": by_type,
        "by_sector_type": by_sector_type,
    }


def fit_observed_rent_prior_artifact(
    y_true: Iterable[float],
    property_types: Iterable[str],
    postcodes: Iterable[str],
    postcode_sectors: Iterable[str],
    *,
    postcode_shrinkage: float = PRIOR_POSTCODE_SHRINKAGE,
    sector_shrinkage: float = PRIOR_SECTOR_SHRINKAGE,
    blend_weight_model: float = PRIOR_BLEND_MODEL_WEIGHT,
) -> Dict:
    """Fit a hierarchical observed-rent prior from the real training labels."""
    frame = pd.DataFrame(
        {
            "postcode": pd.Series(list(postcodes), dtype="object")
            .fillna("")
            .astype(str),
            "postcode_sector": pd.Series(list(postcode_sectors), dtype="object")
            .fillna("")
            .astype(str),
            "property_type": [
                normalise_property_type(value) for value in property_types
            ],
            "rent": np.asarray(list(y_true), dtype=float),
        }
    )

    global_median = float(frame["rent"].median()) if not frame.empty else 350.0
    type_stats = frame.groupby("property_type")["rent"].agg(["median", "count"])
    sector_type_stats = frame.groupby(["postcode_sector", "property_type"])["rent"].agg(
        ["median", "count"]
    )
    postcode_type_stats = frame.groupby(["postcode", "property_type"])["rent"].agg(
        ["median", "count"]
    )

    by_type = {
        label: {
            "median": float(row["median"]),
            "count": int(row["count"]),
        }
        for label, row in type_stats.iterrows()
    }

    by_sector_type: Dict[str, Dict[str, Dict[str, float]]] = {}
    for (sector, label), row in sector_type_stats.iterrows():
        by_sector_type.setdefault(str(sector), {})[str(label)] = {
            "median": float(row["median"]),
            "count": int(row["count"]),
        }

    by_postcode_type: Dict[str, Dict[str, Dict[str, float]]] = {}
    for (postcode, label), row in postcode_type_stats.iterrows():
        by_postcode_type.setdefault(str(postcode), {})[str(label)] = {
            "median": float(row["median"]),
            "count": int(row["count"]),
        }

    return {
        "method": "hierarchical_observed_rent_prior",
        "global_median": global_median,
        "postcode_shrinkage": float(postcode_shrinkage),
        "sector_shrinkage": float(sector_shrinkage),
        "blend_weight_model": float(blend_weight_model),
        "by_type": by_type,
        "by_sector_type": by_sector_type,
        "by_postcode_type": by_postcode_type,
    }


def observed_rent_prior_for_prediction(
    postcode: Optional[str],
    postcode_sector: Optional[str],
    property_type: Optional[str],
    artifact: Optional[Dict],
) -> Optional[float]:
    """Return the hierarchical observed-rent prior for this property."""
    if artifact is None:
        return None

    label = normalise_property_type(property_type)
    postcode_value = str(postcode or "").strip()
    sector_value = str(postcode_sector or "").strip()

    global_median = float(artifact.get("global_median", 350.0))
    type_entry = artifact.get("by_type", {}).get(label)
    type_median = (
        float(type_entry.get("median", global_median)) if type_entry else global_median
    )

    sector_entry = artifact.get("by_sector_type", {}).get(sector_value, {}).get(label)
    if sector_entry is not None:
        sector_n = int(sector_entry.get("count", 0))
        sector_median = float(sector_entry.get("median", type_median))
        sector_shrinkage = float(
            artifact.get("sector_shrinkage", PRIOR_SECTOR_SHRINKAGE)
        )
        sector_prior = (sector_n / (sector_n + sector_shrinkage)) * sector_median + (
            sector_shrinkage / (sector_n + sector_shrinkage)
        ) * type_median
    else:
        sector_prior = type_median

    postcode_entry = (
        artifact.get("by_postcode_type", {}).get(postcode_value, {}).get(label)
    )
    if postcode_entry is None:
        return sector_prior

    postcode_n = int(postcode_entry.get("count", 0))
    postcode_median = float(postcode_entry.get("median", sector_prior))
    postcode_shrinkage = float(
        artifact.get("postcode_shrinkage", PRIOR_POSTCODE_SHRINKAGE)
    )
    return (postcode_n / (postcode_n + postcode_shrinkage)) * postcode_median + (
        postcode_shrinkage / (postcode_n + postcode_shrinkage)
    ) * sector_prior


def sector_type_adjustment_for_prediction(
    postcode_sector: Optional[str],
    property_type: Optional[str],
    artifact: Optional[Dict],
) -> float:
    """Return the shrunk residual correction for this sector/type."""
    if artifact is None:
        return 0.0

    label = normalise_property_type(property_type)
    sector = str(postcode_sector or "").strip()
    global_mean = float(artifact.get("global_mean", 0.0))

    type_entry = artifact.get("by_type", {}).get(label)
    parent_mean = (
        float(type_entry.get("mean", global_mean)) if type_entry else global_mean
    )

    sector_entry = artifact.get("by_sector_type", {}).get(sector, {}).get(label)
    if sector_entry is None:
        return parent_mean

    count = int(sector_entry.get("count", 0))
    min_samples = int(artifact.get("min_samples", SECTOR_TYPE_MIN_SAMPLES))
    if count < min_samples:
        return parent_mean

    shrinkage = float(artifact.get("shrinkage", SECTOR_TYPE_SHRINKAGE))
    weight = count / (count + shrinkage) if shrinkage >= 0 else 1.0
    sector_mean = float(sector_entry.get("mean", parent_mean))
    return (weight * sector_mean) + ((1.0 - weight) * parent_mean)


def fit_calibration_artifact(
    raw_predictions: Iterable[float],
    y_true: Iterable[float],
    property_types: Iterable[str],
    postcode_sectors: Optional[Iterable[str]] = None,
    postcodes: Optional[Iterable[str]] = None,
) -> Dict:
    """Fit a small Ridge calibrator on out-of-fold predictions."""
    X = build_calibration_design(raw_predictions, property_types)
    y = np.asarray(list(y_true), dtype=float)

    model = Ridge(alpha=1.0)
    model.fit(X, y)

    base_predictions = model.predict(X)

    artifact = {
        "method": "ridge_linear_type_calibration",
        "intercept": float(model.intercept_),
        "coefficients": {
            column: float(coef) for column, coef in zip(X.columns, model.coef_)
        },
    }

    if postcode_sectors is not None:
        artifact["sector_type_adjustment"] = fit_sector_type_adjustment_artifact(
            base_predictions,
            y,
            property_types,
            postcode_sectors,
        )
    if postcodes is not None and postcode_sectors is not None:
        artifact["observed_rent_prior"] = fit_observed_rent_prior_artifact(
            y,
            property_types,
            postcodes,
            postcode_sectors,
        )

    return artifact


def apply_prediction_calibration(
    raw_prediction: float,
    property_type: Optional[str],
    artifact: Optional[Dict],
    postcode_sector: Optional[str] = None,
    postcode: Optional[str] = None,
) -> float:
    """Apply a saved calibration artifact to a raw model prediction."""
    if artifact is None:
        return round(max(float(raw_prediction), 0.0), 2)

    features = build_calibration_design([raw_prediction], [property_type]).iloc[0]
    calibrated = float(artifact.get("intercept", 0.0))
    for column, value in features.items():
        calibrated += float(artifact.get("coefficients", {}).get(column, 0.0)) * float(
            value
        )

    calibrated += sector_type_adjustment_for_prediction(
        postcode_sector,
        property_type,
        artifact.get("sector_type_adjustment"),
    )

    prior_artifact = artifact.get("observed_rent_prior")
    prior = observed_rent_prior_for_prediction(
        postcode,
        postcode_sector,
        property_type,
        prior_artifact,
    )
    if prior is not None:
        blend_weight_model = float(
            prior_artifact.get("blend_weight_model", PRIOR_BLEND_MODEL_WEIGHT)
        )
        calibrated = (blend_weight_model * calibrated) + (
            (1.0 - blend_weight_model) * prior
        )

    return round(max(calibrated, 0.0), 2)


def fit_interval_artifact(
    y_true: Iterable[float],
    calibrated_predictions: Iterable[float],
    property_types: Iterable[str],
    alpha: float = INTERVAL_ALPHA,
    min_type_samples: int = MIN_TYPE_INTERVAL_SAMPLES,
) -> Dict:
    """Fit absolute-error intervals globally, with optional type overrides."""
    y_arr = np.asarray(list(y_true), dtype=float)
    pred_arr = np.asarray(list(calibrated_predictions), dtype=float)
    residuals = np.abs(y_arr - pred_arr)
    type_arr = np.asarray(
        [normalise_property_type(value) for value in property_types], dtype=object
    )

    quantile = min(max(1.0 - alpha, 0.5), 0.99)
    global_half_width = float(np.quantile(residuals, quantile))

    by_type: Dict[str, Dict[str, float]] = {}
    for label in KNOWN_PROPERTY_TYPES:
        mask = type_arr == label
        count = int(mask.sum())
        if count >= min_type_samples:
            by_type[label] = {
                "n": count,
                "half_width": float(np.quantile(residuals[mask], quantile)),
            }

    return {
        "method": "absolute_residual_quantile",
        "alpha": float(alpha),
        "global_half_width": global_half_width,
        "min_type_samples": int(min_type_samples),
        "by_type": by_type,
    }


def interval_half_width_for_type(
    property_type: Optional[str], artifact: Optional[Dict]
) -> float:
    """Return the saved half-width for the given property type."""
    if artifact is None:
        return 0.0

    label = normalise_property_type(property_type)
    by_type = artifact.get("by_type", {})
    if label in by_type:
        return float(by_type[label]["half_width"])
    return float(artifact.get("global_half_width", 0.0))
