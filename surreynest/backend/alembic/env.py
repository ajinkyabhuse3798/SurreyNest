"""Alembic environment configuration.

Wires our SQLAlchemy models and settings into Alembic so that:
- `alembic revision --autogenerate` detects schema changes automatically
- `alembic upgrade head` runs against the DATABASE_URL from our .env file
"""

import sys
import os
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

# ── Make the backend/ package importable from here ───────────────────────────
# alembic is run from backend/ so we add it to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# ── Load our app config (reads from .env) ────────────────────────────────────
from app.config import settings  # noqa: E402

# ── Import all models so autogenerate can see them ───────────────────────────
import app.models  # noqa: F401 — side effect: registers all models on Base.metadata

from app.database import Base  # noqa: E402

# ── Alembic Config object ─────────────────────────────────────────────────────
config = context.config

# Override the sqlalchemy.url in alembic.ini with our env var
config.set_main_option("sqlalchemy.url", settings.database_url)

# Set up logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata for autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no live DB connection required).

    Useful for generating SQL scripts to review before running.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (live DB connection).

    Used by `alembic upgrade head` in normal operation.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
