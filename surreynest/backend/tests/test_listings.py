"""Tests for the listing checker and wording compliance scan."""

from types import SimpleNamespace


def test_listing_check_uses_manual_text_without_fetch(
    client, seeded_property, monkeypatch
):
    """Manual postcode + pasted wording should avoid network fetches."""

    def _boom(*args, **kwargs):  # pragma: no cover - only called on regression
        raise AssertionError(
            "requests.get should not be called when postcode and listing text are provided"
        )

    monkeypatch.setattr("app.routers.listings.http_requests.get", _boom)
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
            "url": "https://www.rightmove.co.uk/properties/123456",
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


def test_listing_check_scrapes_page_text_for_compliance(
    client, seeded_property, monkeypatch
):
    """If listing text is not supplied, the checker should analyse scraped page text."""

    html = """
        <html>
            <body>
                <h1>Lovely flat in Guildford</h1>
                <p>Postcode GU1 1AA</p>
                <p>Pets welcome. Families welcome.</p>
            </body>
        </html>
    """

    monkeypatch.setattr(
        "app.routers.listings.http_requests.get",
        lambda *args, **kwargs: SimpleNamespace(
            text=html, raise_for_status=lambda: None
        ),
    )
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
            "url": "https://www.openrent.co.uk/property-to-rent/guildford/abc",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["postcode"] == "GU1 1AA"
    assert data["compliance_report"]["status"] == "CLEAR"
    assert data["compliance_report"]["analysed_text_source"] == "scraped_page"
    positive_ids = {item["id"] for item in data["compliance_report"]["positives"]}
    assert "pets_welcome" in positive_ids
    assert "inclusive_renters" in positive_ids
