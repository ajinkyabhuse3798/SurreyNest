"""Add flood_risk table.

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-02-28 19:40:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e2f3a4b5c6d7"
down_revision = "d1e2f3a4b5c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create flood_risk table."""
    op.create_table(
        "flood_risk",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("postcode", sa.String(length=10), nullable=False),
        sa.Column("area_code", sa.String(length=50), nullable=False),
        sa.Column("label", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("county", sa.String(length=100), nullable=True),
        sa.Column("river_or_sea", sa.String(length=200), nullable=True),
        sa.Column("area_lat", sa.Float(), nullable=True),
        sa.Column("area_lng", sa.Float(), nullable=True),
        sa.Column("distance_km", sa.Float(), nullable=True),
        sa.Column("current_severity", sa.Integer(), nullable=True),
        sa.Column("severity_label", sa.String(length=50), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column(
            "last_updated",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_flood_risk_postcode"), "flood_risk", ["postcode"])


def downgrade() -> None:
    """Drop flood_risk table."""
    op.drop_index(op.f("ix_flood_risk_postcode"), table_name="flood_risk")
    op.drop_table("flood_risk")
