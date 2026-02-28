"""Create voa_rent_bands table for ONS/VOA median rental statistics.

Revision ID: d1e2f3a4b5c6
Revises: c9d5e1f4a3b6
Create Date: 2026-02-26 10:00:00.000000

Stores ONS Private Rental Market Summary Statistics by local authority
and bedroom count.  Used in MODE B ML training as a ground-truth anchor
in place of the hardcoded VOA_RENT_BANDS dict.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d1e2f3a4b5c6"
down_revision: str = "c9d5e1f4a3b6"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    """Create voa_rent_bands table with unique constraint and index."""
    op.create_table(
        "voa_rent_bands",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("local_authority_code", sa.String(20), nullable=False),
        sa.Column("local_authority_name", sa.String(100), nullable=False),
        sa.Column("bedroom_count", sa.Integer(), nullable=False),
        sa.Column("monthly_rent", sa.Float(), nullable=False),
        sa.Column("weekly_rent", sa.Float(), nullable=False),
        sa.Column("source_sheet", sa.String(50), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "local_authority_code",
            "bedroom_count",
            name="uq_voa_la_bedroom",
        ),
    )
    op.create_index(
        "ix_voa_rent_bands_local_authority_code",
        "voa_rent_bands",
        ["local_authority_code"],
    )


def downgrade() -> None:
    """Drop voa_rent_bands table."""
    op.drop_index(
        "ix_voa_rent_bands_local_authority_code",
        table_name="voa_rent_bands",
    )
    op.drop_table("voa_rent_bands")
