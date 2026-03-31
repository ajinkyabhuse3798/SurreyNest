"""Add unique constraint to crime_data (postcode_sector, category, month).

Revision ID: b8c4d0e3f2a5
Revises: a7b3c9d2e1f4
Create Date: 2026-02-24 21:00:00.000000

Replaces the non-unique composite index with a unique constraint.
Deduplicates any existing rows first (keeps the one with highest count).
Enables PostgreSQL ON CONFLICT DO UPDATE for bulk upserts.
"""

from __future__ import annotations


from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b8c4d0e3f2a5"
down_revision: str = "a7b3c9d2e1f4"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    """Deduplicate crime_data and add unique constraint."""
    # Step 1: Remove duplicate rows (keep the one with highest id per group,
    # which will be the most recent insert)
    op.execute(
        """
        DELETE FROM crime_data a
        USING crime_data b
        WHERE a.id < b.id
          AND a.postcode_sector = b.postcode_sector
          AND a.category = b.category
          AND a.month = b.month
    """
    )

    # Step 2: Drop the old non-unique composite index
    op.execute("DROP INDEX IF EXISTS ix_crime_data_sector_category_month")

    # Step 3: Add unique constraint (implicitly creates a unique index)
    op.create_unique_constraint(
        "uq_crime_sector_category_month",
        "crime_data",
        ["postcode_sector", "category", "month"],
    )


def downgrade() -> None:
    """Remove unique constraint and restore non-unique index."""
    op.drop_constraint(
        "uq_crime_sector_category_month",
        "crime_data",
        type_="unique",
    )
    op.create_index(
        "ix_crime_data_sector_category_month",
        "crime_data",
        ["postcode_sector", "category", "month"],
    )
