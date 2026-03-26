"""Tests for the small-data rent-model helpers."""

import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline

from app.ml.calibration import (
    apply_prediction_calibration,
    fit_calibration_artifact,
    fit_interval_artifact,
    interval_half_width_for_type,
    normalise_property_type,
)
from app.ml import predict as predict_module
from app.ml.train import build_safe_sector_rent_map, recompute_safe_sector_anchor


def test_normalise_property_type_unknown_maps_to_other() -> None:
    """Unexpected property-type labels should not break calibration."""
    assert normalise_property_type("Maisonette") == "Other"
    assert normalise_property_type(None) == "Other"


def test_calibration_artifact_adjusts_raw_predictions() -> None:
    """The saved calibration artifact should be applicable at inference time."""
    raw_predictions = [180.0, 220.0, 260.0, 320.0]
    y_true = [210.0, 245.0, 290.0, 355.0]
    property_types = ["Flat", "Flat", "Terraced", "Detached"]

    artifact = fit_calibration_artifact(raw_predictions, y_true, property_types)
    calibrated = [
        apply_prediction_calibration(pred, ptype, artifact)
        for pred, ptype in zip(raw_predictions, property_types)
    ]

    assert artifact["method"] == "ridge_linear_type_calibration"
    assert max(calibrated) > max(raw_predictions)
    assert calibrated[0] > raw_predictions[0]


def test_calibration_artifact_can_apply_sector_type_adjustment() -> None:
    """Sector/type residual adjustments should nudge local segments separately."""
    raw_predictions = [300.0] * 6 + [300.0] * 6
    y_true = [360.0] * 6 + [240.0] * 6
    property_types = ["Flat"] * 12
    postcode_sectors = ["GU1 3"] * 6 + ["GU2 9"] * 6

    artifact = fit_calibration_artifact(
        raw_predictions,
        y_true,
        property_types,
        postcode_sectors=postcode_sectors,
    )

    gu13 = apply_prediction_calibration(300.0, "Flat", artifact, "GU1 3")
    gu29 = apply_prediction_calibration(300.0, "Flat", artifact, "GU2 9")

    assert artifact["sector_type_adjustment"]["method"] == "shrunk_sector_type_residual"
    assert gu13 > gu29


def test_calibration_artifact_can_blend_local_observed_rent_prior() -> None:
    """A postcode-level observed-rent prior should pull local predictions toward comps."""
    raw_predictions = [300.0] * 8 + [300.0] * 8
    y_true = [420.0] * 8 + [260.0] * 8
    property_types = ["Flat"] * 16
    postcode_sectors = ["GU1 3"] * 8 + ["GU2 9"] * 8
    postcodes = ["GU1 3JT"] * 8 + ["GU2 9AA"] * 8

    artifact = fit_calibration_artifact(
        raw_predictions,
        y_true,
        property_types,
        postcode_sectors=postcode_sectors,
        postcodes=postcodes,
    )

    local_high = apply_prediction_calibration(300.0, "Flat", artifact, "GU1 3", "GU1 3JT")
    local_low = apply_prediction_calibration(300.0, "Flat", artifact, "GU2 9", "GU2 9AA")

    assert artifact["observed_rent_prior"]["method"] == "hierarchical_observed_rent_prior"
    assert local_high > local_low


def test_interval_artifact_uses_type_specific_width_when_enough_samples() -> None:
    """Intervals can specialize by property type while keeping a global fallback."""
    y_true = [200 + i for i in range(60)]
    y_pred = [188 + i for i in range(60)]
    property_types = ["Flat"] * 30 + ["Terraced"] * 30

    artifact = fit_interval_artifact(y_true, y_pred, property_types)

    assert artifact["method"] == "absolute_residual_quantile"
    assert "Flat" in artifact["by_type"]
    assert "Terraced" in artifact["by_type"]
    assert interval_half_width_for_type("Flat", artifact) > 0
    assert interval_half_width_for_type("Maisonette", artifact) == artifact["global_half_width"]


def test_safe_sector_rent_map_is_type_aware_and_implied_only() -> None:
    """Sector anchors should be separated by flat/house and ignore scraped targets."""
    df = pd.DataFrame(
        {
            "postcode_sector": ["GU1 3", "GU1 3", "GU1 3", "GU1 3"],
            "implied_weekly_rent": [300.0, 320.0, 560.0, 580.0],
            "actual_market_rent_weekly": [999.0, 999.0, 999.0, 999.0],
            "ptype_Flat": [1, 1, 0, 0],
        }
    )

    sector_map = build_safe_sector_rent_map(df)

    assert sector_map["GU1 3"]["Flat"] == 310.0
    assert sector_map["GU1 3"]["House"] == 570.0


def test_recompute_safe_sector_anchor_does_not_leak_scraped_rents() -> None:
    """Anchors should stay tied to implied rents even if scraped values are extreme."""
    df = pd.DataFrame(
        {
            "postcode_sector": ["GU2 8", "GU2 8", "GU2 8"],
            "implied_weekly_rent": [340.0, 360.0, 355.0],
            "actual_market_rent_weekly": [900.0, 950.0, 980.0],
            "ptype_Flat": [1, 1, 1],
        }
    )

    anchored = recompute_safe_sector_anchor(df)

    assert anchored["sector_median_rent"].tolist() == [355.0, 355.0, 355.0]


class XGBRegressor:
    """Small stand-in that matches the pipeline step name used in predict.py."""

    def predict(self, X):
        return np.zeros(len(X))


class OffsetTransformer:
    """Simple preprocessor used to verify transform chaining."""

    def __init__(self, amount: float):
        self.amount = amount

    def transform(self, X):
        return X.to_numpy(dtype=float) + self.amount


def test_get_model_internals_keeps_scaler_none_for_model_only_pipeline(monkeypatch) -> None:
    """A single-step pipeline should not masquerade as having a scaler."""
    pipeline = Pipeline([("model", XGBRegressor())])

    monkeypatch.setattr(predict_module, "_model", pipeline)
    monkeypatch.setattr(predict_module, "_feature_columns", ["feature_a"])

    internals = predict_module.get_model_internals()

    assert internals is not None
    assert internals["scaler"] is None
    assert internals["xgb_model"] is pipeline.named_steps["model"]


def test_prepare_explainability_input_skips_missing_scaler(monkeypatch) -> None:
    """Explainability input should stay on the raw feature frame when no scaler exists."""
    feature_frame = pd.DataFrame([[1.5, 2.5]], columns=["feature_a", "feature_b"])
    pipeline = Pipeline([("model", XGBRegressor())])

    monkeypatch.setattr(predict_module, "_model", pipeline)

    transformed = predict_module.prepare_explainability_input(feature_frame)

    assert list(transformed.columns) == ["feature_a", "feature_b"]
    assert transformed.equals(feature_frame)


def test_prepare_explainability_input_applies_preprocessing_steps(monkeypatch) -> None:
    """Explainability input should include any upstream transform steps before XGBoost."""
    feature_frame = pd.DataFrame([[1.0, 2.0]], columns=["feature_a", "feature_b"])
    pipeline = Pipeline(
        [
            ("offset", OffsetTransformer(3.0)),
            ("model", XGBRegressor()),
        ]
    )

    monkeypatch.setattr(predict_module, "_model", pipeline)

    transformed = predict_module.prepare_explainability_input(feature_frame)

    assert transformed.shape == (1, 2)
    assert transformed.tolist() == [[4.0, 5.0]]
