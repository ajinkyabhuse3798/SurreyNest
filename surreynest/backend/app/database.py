"""SQLAlchemy engine, session factory, declarative Base, and get_db dependency.

Usage:
    from app.database import Base, get_db

    # In models:
    class MyModel(Base):
        ...

    # In route handlers via FastAPI Depends:
    def my_route(db: Session = Depends(get_db)):
        ...
"""

import logging
from collections.abc import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

logger = logging.getLogger(__name__)

# ── Engine ───────────────────────────────────────────────────────────────────
# pool_pre_ping=True reconnects silently after a DB restart
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,                                   # Base connections
    max_overflow=20,                                # Burst capacity (total: 30)
    echo=(settings.environment == "development"),   # Log SQL in dev only
)

# ── Session factory ───────────────────────────────────────────────────────────
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# ── Declarative Base ──────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """Shared declarative base for all SQLAlchemy models.

    All models must inherit from this class so Alembic autogenerate
    can discover them.
    """

    pass


# ── PostGIS extension ─────────────────────────────────────────────────────────
@event.listens_for(engine, "connect")
def _enable_postgis(dbapi_connection, connection_record) -> None:  # type: ignore[type-arg]
    """Ensure PostGIS extension exists whenever a new connection is made.

    This is a no-op if PostGIS is already enabled, so safe to run every time.
    """
    cursor = dbapi_connection.cursor()
    cursor.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
    cursor.close()


# ── FastAPI dependency ────────────────────────────────────────────────────────
def get_db() -> Generator[Session, None, None]:
    """Yield a database session and guarantee it is closed after the request.

    Use as a FastAPI dependency:
        db: Session = Depends(get_db)

    Yields:
        Session: An active SQLAlchemy session bound to the request lifecycle.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_connection() -> bool:
    """Test that the database is reachable.

    Returns:
        True if the database responds to a simple SELECT 1, False otherwise.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection verified.")
        return True
    except Exception as exc:
        logger.error("Database connection failed: %s", exc)
        return False
