"""Add match_confidence column to hmo_records.

Revision ID: a7b3c9d2e1f4
Revises: 62efbusz7xg4
Create Date: 2026-02-24 20:50:00.000000

Stores the confidence level of the UPRN match:
    'exact' — normalised address exact match
    'fuzzy' — street name + house number match with minor formatting differences
    NULL    — no match found
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7b3c9d2e1f4"
down_revision: str = "62efbusz7xg4"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    """Add match_confidence column to hmo_records."""
    op.add_column(
        "hmo_records",
        sa.Column("match_confidence", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    """Remove match_confidence column from hmo_records."""
    op.drop_column("hmo_records", "match_confidence")
