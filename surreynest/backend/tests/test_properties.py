"""Tests for property search, detail, and 404 handling."""


def test_health_check_returns_ok(client):
    """Health endpoint should return status ok."""
    response = client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "environment" in data


def test_get_property_with_valid_uprn_returns_detail(client, seeded_property):
    """Property detail for a valid UPRN returns full data."""
    response = client.get("/api/properties/TEST_UPRN_001")

    assert response.status_code == 200
    data = response.json()
    assert data["uprn"] == "TEST_UPRN_001"
    assert data["address"] == "1 Test Street, Guildford"
    assert data["postcode"] == "GU1 1AA"
    assert "hmo" in data
    assert "reviews" in data


def test_get_property_with_unknown_uprn_returns_404(client):
    """Property detail for a non-existent UPRN returns 404."""
    response = client.get("/api/properties/NONEXISTENT_UPRN")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


def test_hmo_check_with_valid_uprn_returns_status(client, seeded_property):
    """HMO check for an existing property returns status and record."""
    response = client.get("/api/hmo/check", params={"uprn": "TEST_UPRN_001"})

    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("licensed", "expired", "not_found")
    # No HMO record seeded, so expect not_found
    assert data["status"] == "not_found"
    assert data["record"] is None


def test_hmo_check_with_unknown_uprn_returns_404(client):
    """HMO check for a non-existent UPRN returns 404."""
    response = client.get("/api/hmo/check", params={"uprn": "FAKE_UPRN"})

    assert response.status_code == 404


def test_hmo_check_with_postcode_returns_status(client):
    """HMO check by postcode returns status (not_found when no records)."""
    response = client.get("/api/hmo/check", params={"postcode": "GU1 1AA"})

    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("licensed", "expired", "not_found")


def test_hmo_check_without_params_returns_400(client):
    """HMO check without uprn or postcode returns 400."""
    response = client.get("/api/hmo/check")

    assert response.status_code == 400
    assert "Provide either" in response.json()["detail"]


def test_property_search_without_postcode_returns_422(client):
    """Property search without required postcode param returns 422."""
    response = client.get("/api/properties")

    assert response.status_code == 422


# ── Postcode and radius validation ────────────────────────────────────────────


def test_search_with_invalid_postcode_returns_400(client):
    """Property search with a malformed postcode returns 400."""
    response = client.get(
        "/api/properties", params={"postcode": "BADCODE", "radius": 500}
    )

    assert response.status_code == 400
    assert "Invalid UK postcode" in response.json()["detail"]


def test_search_with_invalid_radius_returns_400(client):
    """Property search with a non-allowed radius returns 400."""
    response = client.get(
        "/api/properties", params={"postcode": "GU2 7XH", "radius": 300}
    )

    assert response.status_code == 400
    assert "Radius must be one of" in response.json()["detail"]


def test_search_with_valid_postcode_format_is_accepted(client):
    """Property search with a valid postcode format passes validation.

    The request may still fail on geocoding (no real DB), but it should
    not fail on postcode format validation — we check for NOT 400.
    """
    response = client.get(
        "/api/properties", params={"postcode": "GU2 7XH", "radius": 500}
    )

    # Should not be a 400 postcode format error (may be 400 geocoding or 500)
    if response.status_code == 400:
        assert "Invalid UK postcode" not in response.json().get("detail", "")
