"""Create rent_history table for RentRadar feature.

Revision ID: c3d8e5f7a2b1
Revises: b2e7f3a1c4d8
Create Date: 2026-03-03
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = "c3d8e5f7a2b1"
down_revision = "b2e7f3a1c4d8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rent_history",
        sa.Column("postcode_sector", sa.String(10), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("median_sale_price", sa.Float(), nullable=False),
        sa.Column("implied_weekly_rent", sa.Float(), nullable=False),
        sa.Column("transaction_count", sa.Integer(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("postcode_sector", "year"),
    )
    # Index for fast sector lookups
    op.create_index(
        "ix_rent_history_sector",
        "rent_history",
        ["postcode_sector"],
    )


def downgrade() -> None:
    op.drop_index("ix_rent_history_sector", table_name="rent_history")
    op.drop_table("rent_history")
