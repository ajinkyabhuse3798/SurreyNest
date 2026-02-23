"""Unit tests for auth_service — pure service layer, no HTTP/routers required."""

import uuid
from datetime import datetime, timezone

import pytest
from jose import jwt

from app.config import settings
from app.services.auth_service import (
    create_access_token,
    hash_password,
    verify_password,
)


# ── Password hashing ─────────────────────────────────────────────────────────


class TestPasswordHashing:
    """Tests for bcrypt password hashing and verification."""

    def test_hash_password_returns_bcrypt_hash(self) -> None:
        """Hash output should be a valid bcrypt string starting with $2b$."""
        hashed = hash_password("SecurePass123")
        assert hashed.startswith("$2b$")
        assert len(hashed) == 60  # bcrypt hashes are always 60 chars

    def test_verify_password_correct_returns_true(self) -> None:
        """Verifying the correct plain password against its hash returns True."""
        plain = "SecurePass123"
        hashed = hash_password(plain)
        assert verify_password(plain, hashed) is True

    def test_verify_password_wrong_returns_false(self) -> None:
        """Verifying an incorrect password returns False."""
        hashed = hash_password("CorrectPassword")
        assert verify_password("WrongPassword", hashed) is False

    def test_hash_password_produces_unique_hashes(self) -> None:
        """Two calls with the same password produce different hashes (unique salt)."""
        hash1 = hash_password("SamePassword")
        hash2 = hash_password("SamePassword")
        assert hash1 != hash2  # bcrypt salts should differ


# ── JWT token creation ────────────────────────────────────────────────────────


class TestCreateAccessToken:
    """Tests for JWT access token creation."""

    def test_create_access_token_returns_valid_jwt(self) -> None:
        """Token should be decodable with the configured secret and algorithm."""
        user_id = uuid.uuid4()
        token = create_access_token(user_id, "student")

        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        assert payload["sub"] == str(user_id)

    def test_create_access_token_contains_correct_user_id(self) -> None:
        """The 'sub' claim should match the provided user_id."""
        user_id = uuid.uuid4()
        token = create_access_token(user_id, "landlord")

        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        assert payload["sub"] == str(user_id)

    def test_create_access_token_contains_correct_role(self) -> None:
        """The 'role' claim should match the provided role."""
        user_id = uuid.uuid4()
        token = create_access_token(user_id, "admin")

        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        assert payload["role"] == "admin"

    def test_create_access_token_has_expiry(self) -> None:
        """The 'exp' claim should exist and be in the future."""
        user_id = uuid.uuid4()
        token = create_access_token(user_id, "student")

        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        assert "exp" in payload
        # exp is a Unix timestamp — should be in the future
        assert payload["exp"] > datetime.now(tz=timezone.utc).timestamp()
