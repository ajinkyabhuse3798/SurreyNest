"""Pytest fixtures: test database session, test client, seeded data."""

import warnings

# Suppress passlib's internal use of the deprecated 'crypt' module.
# This is a third-party library issue — cannot be fixed in our code.
# See: https://github.com/pyca/bcrypt/issues/684
warnings.filterwarnings(
    "ignore",
    message="'crypt' is deprecated",
    category=DeprecationWarning,
    module="passlib",
)

import uuid
from datetime import datetime
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models.property import Property
from app.models.user import User
from app.services.auth_service import create_access_token, hash_password

# ── Test database setup ───────────────────────────────────────────────────────
# Uses the same database but wraps tests in transactions that are rolled back.
engine = create_engine(settings.database_url, pool_pre_ping=True)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db() -> Generator[Session, None, None]:
    """Provide a transactional database session for tests.

    Rolls back all changes after each test.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = TestSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client(db: Session) -> TestClient:
    """Provide a FastAPI test client with the test DB session.

    Overrides the get_db dependency to use the test session.
    """

    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def test_property_data() -> dict:
    """Standard test property data."""
    return {
        "uprn": "TEST_UPRN_001",
        "address": "1 Test Street, Guildford",
        "postcode": "GU1 1AA",
        "lat": 51.2362,
        "lng": -0.5704,
        "property_type": "Flat",
        "floor_area_m2": 45.0,
        "num_rooms": 2,
        "energy_rating": "C",
    }


@pytest.fixture
def seeded_property(db: Session, test_property_data: dict) -> Property:
    """Insert a test property into the database."""
    prop = Property(**test_property_data)
    db.add(prop)
    db.flush()
    return prop


@pytest.fixture
def test_user(db: Session) -> User:
    """Create and return a test user."""
    user = User(
        email="testuser@surrey.ac.uk",
        hashed_password=hash_password("TestPass123"),
        role="student",
    )
    db.add(user)
    db.flush()
    return user


@pytest.fixture
def test_admin(db: Session) -> User:
    """Create and return a test admin user."""
    admin = User(
        email="admin@surrey.ac.uk",
        hashed_password=hash_password("AdminPass123"),
        role="admin",
    )
    db.add(admin)
    db.flush()
    return admin


@pytest.fixture
def user_token(test_user: User) -> str:
    """Generate a JWT token for the test user."""
    return create_access_token(test_user.id, test_user.role)


@pytest.fixture
def admin_token(test_admin: User) -> str:
    """Generate a JWT token for the test admin."""
    return create_access_token(test_admin.id, test_admin.role)
