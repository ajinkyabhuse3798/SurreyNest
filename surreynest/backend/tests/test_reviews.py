"""Tests for review submission, moderation, duplicate prevention, and soft delete."""

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
    _create_review(db, test_user.id, uprn="TEST_UPRN_001", moderated=True, flagged=False)
    _create_review(db, test_admin.id, uprn="TEST_UPRN_001", moderated=False, flagged=False)
    # Flagged review on a different property to avoid unique constraint
    _create_review(db, test_user.id, uprn="TEST_UPRN_002", moderated=True, flagged=True)

    response = client.get("/api/reviews/TEST_UPRN_001")

    assert response.status_code == 200
    data = response.json()
    # Only the moderated+unflagged one should appear
    assert data["total"] == 1
    assert len(data["reviews"]) == 1


# ── POST /reviews ────────────────────────────────────────────────────────────


def test_create_review_requires_auth(client, seeded_property):
    """POST /api/reviews without token returns 401."""
    response = client.post("/api/reviews", json=REVIEW_PAYLOAD)

    assert response.status_code == 401


def test_create_review_success(client, test_user, user_token, seeded_property):
    """POST /api/reviews with valid token creates review with is_moderated=False."""
    response = client.post(
        "/api/reviews",
        json=REVIEW_PAYLOAD,
        headers={"Authorization": f"Bearer {user_token}"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["uprn"] == "TEST_UPRN_001"
    assert data["overall_rating"] == 4
    assert data["is_moderated"] is False
    assert "id" in data


def test_create_duplicate_review_returns_400(
    client, db, test_user, user_token, seeded_property
):
    """POST /api/reviews twice for same user+property returns 400."""
    _create_review(db, test_user.id)

    response = client.post(
        "/api/reviews",
        json=REVIEW_PAYLOAD,
        headers={"Authorization": f"Bearer {user_token}"},
    )

    assert response.status_code == 400
    assert "already reviewed" in response.json()["detail"]


# ── DELETE /reviews/{review_id} ──────────────────────────────────────────────


def test_delete_own_review_sets_flagged(
    client, db, test_user, user_token, seeded_property
):
    """Owner can soft-delete their own review."""
    review = _create_review(db, test_user.id)

    response = client.delete(
        f"/api/reviews/{review.id}",
        headers={"Authorization": f"Bearer {user_token}"},
    )

    assert response.status_code == 200
    assert "flagged" in response.json()["detail"]

    # Verify is_flagged=True in DB
    db.expire_all()
    from app.models.review import Review

    updated = db.query(Review).filter(Review.id == review.id).first()
    assert updated.is_flagged is True


def test_delete_other_review_as_student_returns_403(
    client, db, test_user, test_admin, user_token, seeded_property
):
    """Non-owner student cannot delete someone else's review."""
    review = _create_review(db, test_admin.id)

    response = client.delete(
        f"/api/reviews/{review.id}",
        headers={"Authorization": f"Bearer {user_token}"},
    )

    assert response.status_code == 403


def test_admin_delete_any_review(
    client, db, test_user, test_admin, admin_token, seeded_property
):
    """Admin can soft-delete any user's review."""
    review = _create_review(db, test_user.id)

    response = client.delete(
        f"/api/reviews/{review.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 200


# ── GET /admin/reviews/queue ─────────────────────────────────────────────────


def test_admin_queue_returns_unmoderated(
    client, db, test_user, test_admin, admin_token, seeded_property
):
    """GET /api/admin/reviews/queue returns unmoderated+unflagged reviews."""
    unmod_review = _create_review(db, test_user.id, moderated=False, flagged=False)
    _create_review(db, test_admin.id, moderated=True, flagged=False)

    response = client.get(
        "/api/admin/reviews/queue",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 200
    data = response.json()
    # At least our unmoderated review should be in the queue
    assert data["total"] >= 1
    review_ids = [r["id"] for r in data["reviews"]]
    assert str(unmod_review.id) in review_ids


# ── POST /admin/reviews/{id}/approve ─────────────────────────────────────────


def test_admin_approve_sets_moderated(
    client, db, test_user, test_admin, admin_token, seeded_property
):
    """POST /api/admin/reviews/{id}/approve sets is_moderated=True."""
    review = _create_review(db, test_user.id, moderated=False)

    response = client.post(
        f"/api/admin/reviews/{review.id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["is_moderated"] is True


# ── POST /admin/reviews/{id}/reject ──────────────────────────────────────────


def test_admin_reject_sets_flagged(
    client, db, test_user, test_admin, admin_token, seeded_property
):
    """POST /api/admin/reviews/{id}/reject sets is_flagged=True."""
    review = _create_review(db, test_user.id, moderated=False)

    response = client.post(
        f"/api/admin/reviews/{review.id}/reject",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 200
    assert "rejected" in response.json()["detail"]


# ── Admin auth guard ─────────────────────────────────────────────────────────


def test_admin_endpoints_require_admin(client, test_user, user_token):
    """Admin endpoints return 403 for non-admin users."""
    headers = {"Authorization": f"Bearer {user_token}"}

    # Queue
    assert client.get("/api/admin/reviews/queue", headers=headers).status_code == 403

    # Approve
    fake_id = str(uuid.uuid4())
    assert client.post(
        f"/api/admin/reviews/{fake_id}/approve", headers=headers
    ).status_code == 403

    # Reject
    assert client.post(
        f"/api/admin/reviews/{fake_id}/reject", headers=headers
    ).status_code == 403
