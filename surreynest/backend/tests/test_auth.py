"""Tests for registration, login, JWT, and protected routes."""


def test_register_with_valid_data_returns_201(client):
    """Register a new user successfully."""
    payload = {"email": "new@surrey.ac.uk", "password": "SecurePass123"}

    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["email"] == "new@surrey.ac.uk"
    assert data["role"] == "student"
    assert "password" not in data
    assert "hashed_password" not in data


def test_register_with_duplicate_email_returns_400(client, test_user):
    """Registering with an existing email should fail."""
    payload = {"email": "testuser@surrey.ac.uk", "password": "AnotherPass123"}

    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_register_with_short_password_returns_422(client):
    """Password too short should fail validation."""
    payload = {"email": "short@surrey.ac.uk", "password": "abc"}

    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 422


def test_login_with_valid_credentials_returns_token(client, test_user):
    """Login with correct credentials returns JWT."""
    response = client.post(
        "/api/auth/login",
        data={"username": "testuser@surrey.ac.uk", "password": "TestPass123"},
    )

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_with_wrong_password_returns_401(client, test_user):
    """Login with wrong password should fail."""
    response = client.post(
        "/api/auth/login",
        data={"username": "testuser@surrey.ac.uk", "password": "WrongPass123"},
    )

    assert response.status_code == 401


def test_protected_endpoint_without_token_returns_401(client, seeded_property):
    """Accessing a protected endpoint without a token should fail."""
    response = client.post(
        "/api/reviews",
        json={
            "uprn": "TEST_UPRN_001",
            "overall_rating": 4,
            "landlord_rating": 3,
            "condition_rating": 4,
            "value_rating": 5,
            "review_text": "x" * 50,
        },
    )

    assert response.status_code == 401


# ── GET /auth/me ──────────────────────────────────────────────────────────────


def test_get_me_with_valid_token_returns_user(client, test_user, user_token):
    """GET /api/auth/me with a valid bearer token returns user profile."""
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {user_token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "testuser@surrey.ac.uk"
    assert data["role"] == "student"
    assert "id" in data
    assert "password" not in data
    assert "hashed_password" not in data


def test_get_me_without_token_returns_401(client):
    """GET /api/auth/me without auth header returns 401."""
    response = client.get("/api/auth/me")

    assert response.status_code == 401


# ── DELETE /auth/me ───────────────────────────────────────────────────────────


def test_delete_me_removes_user_and_anonymises_reviews(
    client, db, test_user, user_token, seeded_property
):
    """DELETE /api/auth/me deletes user and sets review user_id to NULL."""
    from app.models.review import Review
    from app.models.user import User

    # Arrange — create a review by this user
    review = Review(
        user_id=test_user.id,
        uprn="TEST_UPRN_001",
        overall_rating=4,
        landlord_rating=3,
        condition_rating=4,
        value_rating=5,
        review_text="A" * 50,
    )
    db.add(review)
    db.flush()
    review_id = review.id

    # Act — delete the account
    response = client.delete(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {user_token}"},
    )

    # Assert — 204 and user gone
    assert response.status_code == 204
    assert db.query(User).filter(User.id == test_user.id).first() is None

    # Assert — review still exists but user_id is NULL (anonymised)
    db.expire_all()
    anonymised_review = db.query(Review).filter(Review.id == review_id).first()
    assert anonymised_review is not None
    assert anonymised_review.user_id is None


def test_delete_me_without_token_returns_401(client):
    """DELETE /api/auth/me without auth header returns 401."""
    response = client.delete("/api/auth/me")

    assert response.status_code == 401
