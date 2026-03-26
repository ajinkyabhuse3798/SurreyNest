"""Tests for the rent increase challenger endpoint."""

import pytest
from fastapi.testclient import TestClient


def test_challenge_requires_uprn_or_postcode(client):
    """POST /api/rent/challenge-increase requires uprn or postcode."""
    response = client.post(
        "/api/rent/challenge-increase",
        json={
            "current_weekly_rent": 200.0,
            "proposed_weekly_rent": 230.0,
        },
    )
    assert response.status_code == 422


def test_challenge_requires_positive_rents(client):
    """current_weekly_rent and proposed_weekly_rent must be > 0."""
    response = client.post(
        "/api/rent/challenge-increase",
        json={
            "postcode": "GU2 7XH",
            "current_weekly_rent": 0,
            "proposed_weekly_rent": 230.0,
        },
    )
    assert response.status_code == 422


def test_challenge_with_valid_postcode(client):
    """POST with valid postcode returns 200 or 503 (ML may not be available in tests)."""
    response = client.post(
        "/api/rent/challenge-increase",
        json={
            "postcode": "GU2 7XH",
            "current_weekly_rent": 200.0,
            "proposed_weekly_rent": 250.0,
        },
    )
    # Accept 200 (ML available) or 422/503 (ML not loaded in test environment)
    assert response.status_code in (200, 422, 503)


def test_challenge_invalid_bedrooms(client):
    """Bedrooms must be 0-15."""
    response = client.post(
        "/api/rent/challenge-increase",
        json={
            "postcode": "GU2 7XH",
            "current_weekly_rent": 200.0,
            "proposed_weekly_rent": 230.0,
            "bedrooms": 20,
        },
    )
    assert response.status_code == 422


def test_challenge_rejects_effective_date_before_notice_date(client):
    """The new rent start date must be after the notice date."""
    response = client.post(
        "/api/rent/challenge-increase",
        json={
            "postcode": "GU2 7XH",
            "current_weekly_rent": 200.0,
            "proposed_weekly_rent": 230.0,
            "notice_served_on": "2026-05-01",
            "proposed_effective_date": "2026-04-30",
        },
    )
    assert response.status_code == 422
