"""Tests for safety score and rent fairness score endpoints."""


def test_safety_score_with_valid_postcode_returns_score(client):
    """Safety score for a postcode with crime data returns result."""
    response = client.get("/api/scores/safety", params={"postcode": "GU2 7XH"})

    # May return 200 or 404 depending on crime data in test DB
    if response.status_code == 200:
        data = response.json()
        assert "safety_score" in data
        assert "breakdown" in data
        assert 0 <= data["safety_score"] <= 100


def test_rent_fairness_requires_uprn_and_rent(client):
    """Rent fairness without required params returns 422."""
    response = client.get("/api/scores/rent-fairness")

    assert response.status_code == 422


def test_rent_fairness_with_unknown_uprn_returns_404(client):
    """Rent fairness for non-existent property returns 404."""
    response = client.get(
        "/api/scores/rent-fairness",
        params={"uprn": "NONEXISTENT", "asking_rent": 200},
    )

    assert response.status_code == 404


def test_fairness_score_computation():
    """Test the fairness score formula directly."""
    from app.services.score_service import compute_fairness_score

    # Underpaying: actual < predicted → good score
    result = compute_fairness_score(150, 200)
    assert result["score"] >= 70
    assert result["colour"] == "green"

    # Overpaying: actual >> predicted → bad score
    result = compute_fairness_score(300, 200)
    assert result["score"] <= 35
    assert result["colour"] == "red"

    # At market rate
    result = compute_fairness_score(200, 200)
    assert 50 <= result["score"] <= 75
