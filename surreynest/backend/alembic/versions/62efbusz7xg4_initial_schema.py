"""Initial schema — create all SurreyNest tables.

Revision ID: 62efbusz7xg4
Revises:
Create Date: 2026-02-20 00:00:00.000000

Tables created:
    users, properties, hmo_records, crime_data, reviews,
    postcode_cache, rent_predictions, pipeline_runs

PostGIS:
    The `postgis` extension is enabled first.
    A GIST spatial index is added on properties(lat, lng) for ST_DWithin queries.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "62efbusz7xg4"
down_revision: str | None = None
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    """Create all tables and indexes."""

    # ── PostGIS extension ────────────────────────────────────────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    # ── users ────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="student"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("last_login", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # ── properties ───────────────────────────────────────────────────────────
    op.create_table(
        "properties",
        sa.Column("uprn", sa.String(20), primary_key=True, nullable=False),
        sa.Column("address", sa.String(500), nullable=False),
        sa.Column("postcode", sa.String(10), nullable=False),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("property_type", sa.String(50), nullable=True),
        sa.Column("built_form", sa.String(50), nullable=True),
        sa.Column("floor_area_m2", sa.Float(), nullable=True),
        sa.Column("num_rooms", sa.Integer(), nullable=True),
        sa.Column("energy_rating", sa.String(1), nullable=True),
        sa.Column("potential_rating", sa.String(1), nullable=True),
        sa.Column("epc_date", sa.Date(), nullable=True),
        sa.Column("tenure", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_properties_postcode", "properties", ["postcode"])
    # Standard composite index for lat/lng (used alongside PostGIS GIST index below)
    op.create_index("ix_properties_lat_lng", "properties", ["lat", "lng"])
    # PostGIS GIST spatial index for ST_DWithin radius queries
    op.execute(
        "CREATE INDEX ix_properties_geom ON properties "
        "USING GIST (ST_Point(lng, lat)) WHERE lat IS NOT NULL AND lng IS NOT NULL;"
    )

    # ── hmo_records ──────────────────────────────────────────────────────────
    op.create_table(
        "hmo_records",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("uprn", sa.String(20), sa.ForeignKey("properties.uprn", ondelete="SET NULL"), nullable=True),
        sa.Column("raw_address", sa.String(500), nullable=False),
        sa.Column("postcode", sa.String(10), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("licence_number", sa.String(100), nullable=True),
        sa.Column("max_occupants", sa.Integer(), nullable=True),
        sa.Column("licence_holder", sa.String(255), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("last_updated", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_hmo_records_uprn", "hmo_records", ["uprn"])
    op.create_index("ix_hmo_records_postcode", "hmo_records", ["postcode"])

    # ── crime_data ───────────────────────────────────────────────────────────
    op.create_table(
        "crime_data",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("postcode_sector", sa.String(10), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("month", sa.Date(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_crime_data_postcode_sector", "crime_data", ["postcode_sector"])
    op.create_index(
        "ix_crime_data_sector_category_month",
        "crime_data",
        ["postcode_sector", "category", "month"],
    )

    # ── reviews ──────────────────────────────────────────────────────────────
    op.create_table(
        "reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("uprn", sa.String(20), sa.ForeignKey("properties.uprn", ondelete="CASCADE"), nullable=False),
        sa.Column("overall_rating", sa.Integer(), nullable=False),
        sa.Column("landlord_rating", sa.Integer(), nullable=False),
        sa.Column("condition_rating", sa.Integer(), nullable=False),
        sa.Column("value_rating", sa.Integer(), nullable=False),
        sa.Column("weekly_rent_paid", sa.Float(), nullable=True),
        sa.Column("move_in_year", sa.Integer(), nullable=True),
        sa.Column("review_text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("is_moderated", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_flagged", sa.Boolean(), nullable=False, server_default="false"),
        sa.UniqueConstraint("user_id", "uprn", name="uq_reviews_user_uprn"),
        sa.CheckConstraint("overall_rating >= 1 AND overall_rating <= 5", name="ck_overall_rating"),
        sa.CheckConstraint("landlord_rating >= 1 AND landlord_rating <= 5", name="ck_landlord_rating"),
        sa.CheckConstraint("condition_rating >= 1 AND condition_rating <= 5", name="ck_condition_rating"),
        sa.CheckConstraint("value_rating >= 1 AND value_rating <= 5", name="ck_value_rating"),
    )
    op.create_index("ix_reviews_user_id", "reviews", ["user_id"])
    op.create_index("ix_reviews_uprn", "reviews", ["uprn"])

    # ── postcode_cache ───────────────────────────────────────────────────────
    op.create_table(
        "postcode_cache",
        sa.Column("postcode", sa.String(10), primary_key=True, nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("ward", sa.String(100), nullable=True),
        sa.Column("district", sa.String(100), nullable=True),
        sa.Column("is_valid", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("cached_at", sa.DateTime(), nullable=False),
    )

    # ── rent_predictions ─────────────────────────────────────────────────────
    op.create_table(
        "rent_predictions",
        sa.Column("uprn", sa.String(20), sa.ForeignKey("properties.uprn", ondelete="CASCADE"), primary_key=True, nullable=False),
        sa.Column("predicted_weekly_rent", sa.Float(), nullable=False),
        sa.Column("confidence_low", sa.Float(), nullable=True),
        sa.Column("confidence_high", sa.Float(), nullable=True),
        sa.Column("model_version", sa.String(20), nullable=False),
        sa.Column("computed_at", sa.DateTime(), nullable=False),
    )

    # ── pipeline_runs ────────────────────────────────────────────────────────
    op.create_table(
        "pipeline_runs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("pipeline_name", sa.String(100), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="running"),
        sa.Column("rows_processed", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
    )
    op.create_index("ix_pipeline_runs_pipeline_name", "pipeline_runs", ["pipeline_name"])


def downgrade() -> None:
    """Drop all tables in reverse dependency order."""
    op.drop_table("pipeline_runs")
    op.drop_table("rent_predictions")
    op.drop_table("postcode_cache")
    op.drop_table("reviews")
    op.drop_table("crime_data")
    op.drop_table("hmo_records")
    op.drop_table("properties")
    op.drop_table("users")
