"""Tests for the listing checker and wording compliance scan."""


def test_listing_check_uses_manual_text_without_fetch(
    client, seeded_property, monkeypatch
):
    """Manual postcode + pasted wording should avoid network fetches."""

    def _boom(*args, **kwargs):  # pragma: no cover - only called on regression
        raise AssertionError(
            "requests.get should not be called when postcode and listing text are provided"
        )

    monkeypatch.setattr("requests.get", _boom)
    monkeypatch.setattr(
        "app.routers.listings.get_safety_score",
        lambda sector, db: {"safety_score": 72.0, "label": "Safe"},
    )
    monkeypatch.setattr(
        "app.routers.listings.get_rent_prediction",
        lambda uprn, db: {"predicted_weekly_rent": 310.0},
    )

    response = client.post(
        "/api/listings/check",
        json={
            "postcode": "GU1 1AA",
            "listing_text": "No DSS. 6 months rent upfront if no guarantor. Sorry, no pets.",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["postcode"] == "GU1 1AA"
    assert data["safety_score"] == 72.0
    assert data["compliance_report"]["status"] == "HIGH_RISK"
    assert data["compliance_report"]["analysed_text_source"] == "manual_text"
    issue_ids = {issue["id"] for issue in data["compliance_report"]["issues"]}
    assert "benefits_discrimination" in issue_ids
    assert "pets" in issue_ids


def test_listing_check_requires_manual_postcode(
    client, seeded_property, monkeypatch
):
    """The listing checker should reject requests that omit a manual postcode."""

    def _boom(*args, **kwargs):  # pragma: no cover - only called on regression
        raise AssertionError(
            "requests.get should not be called when manual postcode is required"
        )

    monkeypatch.setattr("requests.get", _boom)

    response = client.post(
        "/api/listings/check",
        json={
            "listing_text": "Pets welcome. Families welcome.",
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Please enter the Guildford postcode manually to analyse this listing."
    }


def test_listing_check_returns_not_available_without_listing_text(
    client, seeded_property, monkeypatch
):
    """Manual postcode without pasted wording should skip compliance scanning."""

    def _boom(*args, **kwargs):  # pragma: no cover - only called on regression
        raise AssertionError(
            "requests.get should not be called for manual-only listing checks"
        )

    monkeypatch.setattr("requests.get", _boom)
    monkeypatch.setattr(
        "app.routers.listings.get_safety_score",
        lambda sector, db: {"safety_score": 81.0, "label": "Very Safe"},
    )
    monkeypatch.setattr(
        "app.routers.listings.get_rent_prediction",
        lambda uprn, db: {"predicted_weekly_rent": 280.0},
    )

    response = client.post(
        "/api/listings/check",
        json={
            "postcode": "GU1 1AA",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["postcode"] == "GU1 1AA"
    assert data["compliance_report"]["status"] == "NOT_AVAILABLE"
    assert data["compliance_report"]["analysed_text_source"] is None
    assert data["compliance_report"]["issues"] == []
    assert data["compliance_report"]["positives"] == []
