"""Create area_values table for Land Registry area value index.

Revision ID: c9d5e1f4a3b6
Revises: b8c4d0e3f2a5
Create Date: 2026-02-24 21:09:00.000000

Stores median sale price and normalised area_value_index per postcode.
Used as a feature in the rent prediction ML model.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c9d5e1f4a3b6"
down_revision: str = "b8c4d0e3f2a5"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    """Create area_values table."""
    op.create_table(
        "area_values",
        sa.Column("postcode", sa.String(10), primary_key=True, nullable=False),
        sa.Column("median_sale_price", sa.Float(), nullable=False),
        sa.Column("area_value_index", sa.Float(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    """Drop area_values table."""
    op.drop_table("area_values")
