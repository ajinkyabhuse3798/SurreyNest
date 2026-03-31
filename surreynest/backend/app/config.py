"""Environment variable loading and application configuration.

All secrets and environment-specific settings are read here via python-dotenv.
No other module should read env vars directly, import `settings` from this module.
"""

import logging
import os
from functools import lru_cache

from dotenv import load_dotenv

# Keep real environment variables authoritative so Docker / hosting config
# is never silently overridden by a local .env file.
load_dotenv(override=False)

logger = logging.getLogger(__name__)


class Settings:
    """Application settings loaded from environment variables.

    Attributes:
        database_url: PostgreSQL connection string including PostGIS-capable DB.
        environment: One of "development", "staging", "production".
        allowed_origins: Comma-separated CORS origins.
        internal_admin_key: Shared secret for internal moderation/ops endpoints.
    """

    # ── Database ────────────────────────────────────────────────────────────
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://surreynest:surreynest_dev_password@localhost:5432/surreynest",
    )
    test_database_url: str = os.getenv(
        "TEST_DATABASE_URL",
        "postgresql://surreynest:surreynest_dev_password@localhost:5432/surreynest_test",
    )
    # Keep pool_size × worker_count ≤ PostgreSQL max_connections (default 100).
    # With --workers 4: pool_size=5 → 20 connections, max_overflow=5 → burst to 40.
    db_pool_size: int = int(os.getenv("DB_POOL_SIZE", "5"))
    db_max_overflow: int = int(os.getenv("DB_MAX_OVERFLOW", "5"))

    # ── App ─────────────────────────────────────────────────────────────────
    environment: str = os.getenv("ENVIRONMENT", "development")
    allowed_origins: list[str] = os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:5173"
    ).split(",")
    internal_admin_key: str = os.getenv("INTERNAL_ADMIN_KEY", "")

    # ── ML Model ───────────────────────────────────────────────────────────
    ml_model_version: str = os.getenv("ML_MODEL_VERSION", "v7.0.0")
    ml_model_path: str = os.getenv("ML_MODEL_PATH", "app/ml/models")

    # ── Rate Limiting ──────────────────────────────────────────────────────
    rate_limit_search: int = int(os.getenv("RATE_LIMIT_SEARCH", "60"))
    rate_limit_reviews: int = int(os.getenv("RATE_LIMIT_REVIEWS", "5"))

    # ── Redis (shared cache for multi-worker deployment) ──────────────────
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # ── AI / Anthropic ────────────────────────────────────────────────────
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")

    # ── Email (SMTP) ──────────────────────────────────────────────────────
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    smtp_from: str = os.getenv("SMTP_FROM", "SurreyNest <noreply@surreynest.com>")

    # ── Frontend URL (used in email links) ───────────────────────────────
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    def __init__(self) -> None:
        """Validate critical settings on startup."""
        if self.environment == "production" and not self.internal_admin_key:
            raise RuntimeError(
                "INTERNAL_ADMIN_KEY must be set in production for internal ops routes."
            )
        logger.info("Settings loaded. environment=%s", self.environment)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached Settings singleton.

    Returns:
        The application Settings instance (created once, reused everywhere).
    """
    return Settings()


# Module-level singleton, import this everywhere instead of calling get_settings()
settings: Settings = get_settings()
