"""Environment variable loading and application configuration.

All secrets and environment-specific settings are read here via python-dotenv.
No other module should read env vars directly — import `settings` from this module.
"""

import logging
import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv(override=True)  # Override Docker env vars so .env always wins

logger = logging.getLogger(__name__)


class Settings:
    """Application settings loaded from environment variables.

    Attributes:
        database_url: PostgreSQL connection string including PostGIS-capable DB.
        secret_key: 64-char hex secret for JWT signing — never hardcode.
        algorithm: JWT signing algorithm (HS256).
        access_token_expire_days: JWT lifetime in days.
        environment: One of "development", "staging", "production".
        allowed_origins: Comma-separated CORS origins.
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

    # ── Auth ────────────────────────────────────────────────────────────────
    secret_key: str = os.getenv("SECRET_KEY", "")
    algorithm: str = os.getenv("ALGORITHM", "HS256")
    access_token_expire_days: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_DAYS", "30"))

    # ── App ─────────────────────────────────────────────────────────────────
    environment: str = os.getenv("ENVIRONMENT", "development")
    allowed_origins: list[str] = os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:5173"
    ).split(",")

    # ── ML Model ───────────────────────────────────────────────────────────
    ml_model_version: str = os.getenv("ML_MODEL_VERSION", "v4.4.0")
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
        _insecure_keys = {"", "CHANGE_ME_IN_PRODUCTION", "changeme", "secret", "dev"}
        if not self.secret_key or self.secret_key.lower() in _insecure_keys:
            if self.environment == "production":
                raise RuntimeError(
                    "SECRET_KEY must be set to a secure value in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
                )
            else:
                logger.warning(
                    "SECRET_KEY is not set or is insecure. "
                    "Set a strong SECRET_KEY before deploying to production."
                )
        logger.info("Settings loaded. environment=%s", self.environment)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached Settings singleton.

    Returns:
        The application Settings instance (created once, reused everywhere).
    """
    return Settings()


# Module-level singleton — import this everywhere instead of calling get_settings()
settings: Settings = get_settings()
