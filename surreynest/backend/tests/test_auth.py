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
