"""Tests for public review submission and internal moderation controls."""

import uuid


# ── Helper ────────────────────────────────────────────────────────────────────

REVIEW_PAYLOAD = {
    "uprn": "TEST_UPRN_001",
    "overall_rating": 4,
    "landlord_rating": 3,
    "condition_rating": 4,
    "value_rating": 5,
    "review_text": "A" * 50,
}


def _create_review(db, user_id, uprn="TEST_UPRN_001", moderated=False, flagged=False):
    """Insert a review directly via DB for test setup."""
    from app.models.review import Review

    review = Review(
        user_id=user_id,
        uprn=uprn,
        overall_rating=4,
        landlord_rating=3,
        condition_rating=4,
        value_rating=5,
        review_text="A" * 50,
        is_moderated=moderated,
        is_flagged=flagged,
    )
    db.add(review)
    db.flush()
    return review


# ── GET /reviews/{uprn} ──────────────────────────────────────────────────────


def test_get_reviews_returns_only_moderated_unflagged(
    client, db, test_user, test_admin, seeded_property
):
    """GET /api/reviews/{uprn} returns only moderated + unflagged reviews."""
    from app.models.property import Property

    # Create extra properties for unique constraint compliance
    db.add(Property(uprn="TEST_UPRN_002", address="2 Test St", postcode="GU1 1AB"))
    db.add(Property(uprn="TEST_UPRN_003", address="3 Test St", postcode="GU1 1AC"))
    db.flush()

    # 1 moderated+unflagged, 1 unmoderated, 1 flagged — all same UPRN, diff users/uprns
    _create_review(
        db, test_user.id, uprn="TEST_UPRN_001", moderated=True, flagged=False
    )
    _create_review(
        db, test_admin.id, uprn="TEST_UPRN_001", moderated=False, flagged=False
    )
    # Flagged review on a different property to avoid unique constraint
    _create_review(db, test_user.id, uprn="TEST_UPRN_002", moderated=True, flagged=True)

    response = client.get("/api/reviews/TEST_UPRN_001")

    assert response.status_code == 200
    data = response.json()
    # Only the moderated+unflagged one should appear
    assert data["total"] == 1
    assert len(data["reviews"]) == 1


# ── POST /reviews ────────────────────────────────────────────────────────────


def test_create_review_allows_anonymous_submission(client, seeded_property):
    """POST /api/reviews without auth creates an unmoderated anonymous review."""
    response = client.post("/api/reviews", json=REVIEW_PAYLOAD)

    assert response.status_code == 201
    data = response.json()
    assert data["user_id"] is None
    assert data["is_moderated"] is False


def test_anonymous_review_has_no_user_id(client, seeded_property):
    """Unauthenticated review submissions are stored without a user_id."""
    response = client.post(
        "/api/reviews",
        json=REVIEW_PAYLOAD,
    )

    assert response.status_code == 201
    assert response.json()["user_id"] is None


def test_repeat_anonymous_reviews_are_allowed(client, seeded_property):
    """Anonymous reviewers can submit more than once because there is no account binding."""
    response = client.post(
        "/api/reviews",
        json=REVIEW_PAYLOAD,
    )

    assert response.status_code == 201
    second = client.post("/api/reviews", json=REVIEW_PAYLOAD)
    assert second.status_code == 201


# ── DELETE /reviews/{review_id} ──────────────────────────────────────────────


def test_internal_delete_review_sets_flagged(
    client, db, test_user, internal_admin_headers, seeded_property
):
    """Internal admin can hide any review via the delete endpoint."""
    review = _create_review(db, test_user.id)

    response = client.delete(
        f"/api/reviews/{review.id}",
        headers=internal_admin_headers,
    )

    assert response.status_code == 200
    assert "flagged" in response.json()["detail"]

    # Verify is_flagged=True in DB
    db.expire_all()
    from app.models.review import Review

    updated = db.query(Review).filter(Review.id == review.id).first()
    assert updated.is_flagged is True


def test_delete_review_requires_internal_admin_key(
    client, db, test_user, seeded_property
):
    """Delete endpoint rejects requests without the internal admin key."""
    review = _create_review(db, test_user.id)

    response = client.delete(f"/api/reviews/{review.id}")

    assert response.status_code == 401


# ── GET /admin/reviews/queue ─────────────────────────────────────────────────


def test_admin_queue_returns_unmoderated(
    client, db, test_user, test_admin, internal_admin_headers, seeded_property
):
    """GET /api/admin/reviews/queue returns unmoderated+unflagged reviews for internal ops."""
    unmod_review = _create_review(db, test_user.id, moderated=False, flagged=False)
    _create_review(db, test_admin.id, moderated=True, flagged=False)

    response = client.get(
        "/api/admin/reviews/queue",
        headers=internal_admin_headers,
    )

    assert response.status_code == 200
    data = response.json()
    # At least our unmoderated review should be in the queue
    assert data["total"] >= 1
    review_ids = [r["id"] for r in data["reviews"]]
    assert str(unmod_review.id) in review_ids


# ── POST /admin/reviews/{id}/approve ─────────────────────────────────────────


def test_admin_approve_sets_moderated(
    client, db, test_user, test_admin, internal_admin_headers, seeded_property
):
    """POST /api/admin/reviews/{id}/approve sets is_moderated=True for internal ops."""
    review = _create_review(db, test_user.id, moderated=False)

    response = client.post(
        f"/api/admin/reviews/{review.id}/approve",
        headers=internal_admin_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["is_moderated"] is True


# ── POST /admin/reviews/{id}/reject ──────────────────────────────────────────


def test_admin_reject_sets_flagged(
    client, db, test_user, test_admin, internal_admin_headers, seeded_property
):
    """POST /api/admin/reviews/{id}/reject sets is_flagged=True for internal ops."""
    review = _create_review(db, test_user.id, moderated=False)

    response = client.post(
        f"/api/admin/reviews/{review.id}/reject",
        headers=internal_admin_headers,
    )

    assert response.status_code == 200
    assert "rejected" in response.json()["detail"]


# ── Internal admin key guard ─────────────────────────────────────────────────


def test_admin_endpoints_require_internal_admin_key(client):
    """Internal moderation endpoints reject the old bearer-token auth flow."""
    headers = {"Authorization": "Bearer old-auth-token"}

    # Queue
    assert client.get("/api/admin/reviews/queue", headers=headers).status_code == 401

    # Approve
    fake_id = str(uuid.uuid4())
    assert (
        client.post(
            f"/api/admin/reviews/{fake_id}/approve", headers=headers
        ).status_code
        == 401
    )

    # Reject
    assert (
        client.post(f"/api/admin/reviews/{fake_id}/reject", headers=headers).status_code
        == 401
    )
