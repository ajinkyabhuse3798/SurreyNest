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
    """HMO check for an existing property returns is_hmo flag."""
    response = client.get("/api/hmo/check", params={"uprn": "TEST_UPRN_001"})

    assert response.status_code == 200
    data = response.json()
    assert "is_hmo" in data
    assert data["uprn"] == "TEST_UPRN_001"


def test_hmo_check_with_unknown_uprn_returns_404(client):
    """HMO check for a non-existent UPRN returns 404."""
    response = client.get("/api/hmo/check", params={"uprn": "FAKE_UPRN"})

    assert response.status_code == 404


def test_property_search_without_postcode_returns_422(client):
    """Property search without required postcode param returns 422."""
    response = client.get("/api/properties")

    assert response.status_code == 422
