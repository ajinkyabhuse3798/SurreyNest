"""Unit tests for score_service — pure service layer with light DB coverage."""

import pytest

from app.models.property import Property
from app.services.score_service import (
    _safety_label,
    compute_fairness_score,
    get_rent_prediction,
)


# ── Fairness score formula ────────────────────────────────────────────────────


class TestComputeFairnessScore:
    """Tests for the rent fairness score formula."""

    def test_fairness_underpaying_returns_green(self) -> None:
        """Ratio ≤ 0.85 → score 90-100, green, 'Excellent deal'."""
        result = compute_fairness_score(actual_rent=120, predicted_rent=200)
        assert result["score"] >= 90
        assert result["colour"] == "green"
        assert result["label"] == "Excellent deal"

    def test_fairness_below_market_returns_green(self) -> None:
        """Ratio ~0.95 → score 70-89, green, 'Below market'."""
        result = compute_fairness_score(actual_rent=190, predicted_rent=200)
        assert 70 <= result["score"] <= 89
        assert result["colour"] == "green"
        assert result["label"] == "Below market"

    def test_fairness_at_market_returns_amber(self) -> None:
        """Ratio ~1.05 → score 55-69, amber, 'At market rate'."""
        result = compute_fairness_score(actual_rent=210, predicted_rent=200)
        assert 55 <= result["score"] <= 69
        assert result["colour"] == "amber"
        assert result["label"] == "At market rate"

    def test_fairness_slightly_above_returns_amber(self) -> None:
        """Ratio ~1.20 → score 35-54, amber, 'Slightly above market'."""
        result = compute_fairness_score(actual_rent=240, predicted_rent=200)
        assert 35 <= result["score"] <= 54
        assert result["colour"] == "amber"
        assert result["label"] == "Slightly above market"

    def test_fairness_above_market_returns_red(self) -> None:
        """Ratio ~1.35 → score 15-34, red, 'Above market'."""
        result = compute_fairness_score(actual_rent=270, predicted_rent=200)
        assert 15 <= result["score"] <= 34
        assert result["colour"] == "red"
        assert result["label"] == "Above market"

    def test_fairness_overpriced_returns_red(self) -> None:
        """Ratio > 1.40 → score 0-14, red, 'Significantly overpriced'."""
        result = compute_fairness_score(actual_rent=350, predicted_rent=200)
        assert result["score"] <= 14
        assert result["colour"] == "red"
        assert result["label"] == "Significantly overpriced"

    def test_fairness_zero_predicted_returns_unable(self) -> None:
        """Edge case: predicted_rent=0 should not divide by zero."""
        result = compute_fairness_score(actual_rent=150, predicted_rent=0)
        assert result["label"] == "Unable to compute"
        assert result["colour"] == "amber"
        assert result["score"] == 50

    def test_fairness_score_clamped_0_100(self) -> None:
        """Extreme ratios: score stays within 0-100 bounds."""
        # Very cheap
        result_cheap = compute_fairness_score(actual_rent=10, predicted_rent=200)
        assert 0 <= result_cheap["score"] <= 100

        # Very expensive
        result_expensive = compute_fairness_score(actual_rent=1000, predicted_rent=200)
        assert 0 <= result_expensive["score"] <= 100

    def test_fairness_returns_all_required_fields(self) -> None:
        """Response dict must contain all 8 fields matching RentFairnessResponse."""
        result = compute_fairness_score(actual_rent=200, predicted_rent=200)
        required_keys = {
            "score",
            "label",
            "colour",
            "ratio",
            "predicted_rent",
            "actual_rent",
            "difference_pounds",
            "difference_percent",
        }
        assert set(result.keys()) == required_keys


# ── Safety label helper ───────────────────────────────────────────────────────


class TestSafetyLabel:
    """Tests for the _safety_label score-to-text helper."""

    @pytest.mark.parametrize(
        "score,expected",
        [
            (95.0, "Very Safe"),
            (80.0, "Very Safe"),
            (75.0, "Safe"),
            (60.0, "Safe"),
            (50.0, "Moderate"),
            (40.0, "Moderate"),
            (30.0, "Concerning"),
            (20.0, "Concerning"),
            (15.0, "High Crime Area"),
            (0.0, "High Crime Area"),
        ],
    )
    def test_safety_label_bands(self, score: float, expected: str) -> None:
        """Each score band maps to the correct label."""
        assert _safety_label(score) == expected


def test_get_rent_prediction_uses_exact_local_comp_guardrail(db, monkeypatch) -> None:
    """Exact postcode/type/size comps should pull an over-high prediction down."""
    target = Property(
        uprn="TARGET_UPRN_001",
        address="9A Epsom Road",
        postcode="GU1 3JT",
        lat=51.2362,
        lng=-0.5704,
        property_type="Flat",
        floor_area_m2=58.0,
        num_rooms=3,
        actual_bedrooms=2,
        energy_rating="C",
        potential_rating="C",
        annual_energy_cost=559.0,
    )
    exact_comp = Property(
        uprn="COMP_UPRN_001",
        address="Epsom Road, Guildford",
        postcode="GU1 3JT",
        lat=51.2362,
        lng=-0.5704,
        property_type="Flat",
        floor_area_m2=58.0,
        num_rooms=3,
        actual_bedrooms=2,
        actual_market_rent_weekly=358.0,
        energy_rating="C",
        potential_rating="C",
    )
    db.add_all([target, exact_comp])
    db.flush()

    monkeypatch.setattr("app.ml.predict.get_loaded_model_version", lambda: "test-v1")
    monkeypatch.setattr(
        "app.ml.predict.predict_rent",
        lambda features: {
            "predicted_weekly_rent": 505.11,
            "rent_low": 427.29,
            "rent_high": 582.93,
            "confidence": 80.0,
            "model_version": "test-v1",
        },
    )

    result = get_rent_prediction(target.uprn, db)

    assert result is not None
    assert result["model_version"] == "test-v1+lc1"
    assert result["predicted_weekly_rent"] == 409.49
    assert result["rent_low"] == 331.67
    assert result["rent_high"] == 487.31
