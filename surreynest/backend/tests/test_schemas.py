"""Tests for Pydantic schema validation — pure validation, no DB required."""

import pytest
from pydantic import ValidationError

from app.schemas.user import UserCreate
from app.schemas.property import PropertySearchParams
from app.schemas.review import ReviewCreate
from app.schemas.score import SafetyScoreResponse, RentFairnessResponse


# ── UserCreate ────────────────────────────────────────────────────────────────


class TestUserCreate:
    """Tests for user registration schema validation."""

    def test_user_create_valid_data(self) -> None:
        """Valid email and password creates successfully."""
        user = UserCreate(email="student@surrey.ac.uk", password="SecurePass123")
        assert user.email == "student@surrey.ac.uk"
        assert user.password == "SecurePass123"

    def test_user_create_short_password_raises(self) -> None:
        """Password shorter than 8 characters is rejected."""
        with pytest.raises(ValidationError, match="at least 8 characters"):
            UserCreate(email="student@surrey.ac.uk", password="short")

    def test_user_create_lowercases_email(self) -> None:
        """Email is normalised to lowercase."""
        user = UserCreate(email="STUDENT@Surrey.AC.UK", password="SecurePass123")
        assert user.email == "student@surrey.ac.uk"

    def test_user_create_invalid_email_raises(self) -> None:
        """Non-email string is rejected."""
        with pytest.raises(ValidationError):
            UserCreate(email="not-an-email", password="SecurePass123")


# ── ReviewCreate ──────────────────────────────────────────────────────────────


class TestReviewCreate:
    """Tests for review submission schema validation."""

    def test_review_create_text_too_short_raises(self) -> None:
        """Review text shorter than 50 characters is rejected."""
        with pytest.raises(ValidationError):
            ReviewCreate(
                uprn="TEST_001",
                overall_rating=4,
                landlord_rating=3,
                condition_rating=4,
                value_rating=3,
                review_text="Too short",
            )

    def test_review_create_text_too_long_raises(self) -> None:
        """Review text longer than 1000 characters is rejected."""
        with pytest.raises(ValidationError):
            ReviewCreate(
                uprn="TEST_001",
                overall_rating=4,
                landlord_rating=3,
                condition_rating=4,
                value_rating=3,
                review_text="x" * 1001,
            )

    def test_review_create_rating_out_of_range_raises(self) -> None:
        """Rating outside 1-5 range is rejected."""
        valid_text = "A" * 60
        with pytest.raises(ValidationError):
            ReviewCreate(
                uprn="TEST_001",
                overall_rating=6,
                landlord_rating=3,
                condition_rating=4,
                value_rating=3,
                review_text=valid_text,
            )

    def test_review_create_valid_data(self) -> None:
        """Valid review with all fields creates successfully."""
        review = ReviewCreate(
            uprn="TEST_001",
            overall_rating=4,
            landlord_rating=3,
            condition_rating=5,
            value_rating=2,
            weekly_rent_paid=150.0,
            move_in_year=2024,
            review_text="A" * 60,
        )
        assert review.overall_rating == 4
        assert review.weekly_rent_paid == 150.0


# ── PropertySearchParams ─────────────────────────────────────────────────────


class TestPropertySearchParams:
    """Tests for property search parameter validation."""

    def test_property_search_params_invalid_radius_raises(self) -> None:
        """Radius not in allowed list [250, 500, 1000, 2000] is rejected."""
        with pytest.raises(ValidationError, match="Radius must be one of"):
            PropertySearchParams(postcode="GU2 7XH", radius=750)

    @pytest.mark.parametrize("radius", [250, 500, 1000, 2000])
    def test_property_search_params_valid_radius(self, radius: int) -> None:
        """Each allowed radius value is accepted."""
        params = PropertySearchParams(postcode="GU2 7XH", radius=radius)
        assert params.radius == radius

    def test_property_search_params_defaults(self) -> None:
        """Default values are applied when only postcode is given."""
        params = PropertySearchParams(postcode="GU2 7XH")
        assert params.radius == 1000
        assert params.page == 1
        assert params.per_page == 20


# ── SafetyScoreResponse ──────────────────────────────────────────────────────


class TestSafetyScoreResponse:
    """Tests for safety score schema."""

    def test_safety_score_response_null_score(self) -> None:
        """Graceful null: safety_score=None, available=False when no data."""
        response = SafetyScoreResponse(
            postcode_sector="GU2 7",
            safety_score=None,
            label="Data loading",
            available=False,
            breakdown=[],
        )
        assert response.safety_score is None
        assert response.available is False
        assert response.label == "Data loading"

    def test_safety_score_response_with_score(self) -> None:
        """Valid safety score with breakdown."""
        response = SafetyScoreResponse(
            postcode_sector="GU2 7",
            safety_score=78.5,
            label="Safe",
            available=True,
            breakdown=[{"category": "burglary", "total_count": 12}],
        )
        assert response.safety_score == 78.5
        assert response.available is True


# ── RentFairnessResponse ─────────────────────────────────────────────────────


class TestRentFairnessResponse:
    """Tests for rent fairness score schema."""

    def test_rent_fairness_response_valid(self) -> None:
        """Valid fairness response with all fields."""
        response = RentFairnessResponse(
            score=75,
            label="Below market",
            colour="green",
            ratio=0.92,
            predicted_rent=165.0,
            actual_rent=152.0,
            difference_pounds=-13.0,
            difference_percent=-7.88,
        )
        assert response.score == 75
        assert response.colour == "green"
        assert response.ratio == 0.92
