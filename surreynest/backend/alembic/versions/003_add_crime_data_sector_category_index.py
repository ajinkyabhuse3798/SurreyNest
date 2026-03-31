"""add_crime_data_sector_category_index

Adds a composite index on (postcode_sector, category) in the crime_data table.
The existing unique constraint covers (sector, category, month) but a dedicated
2-column index is more efficient for queries that group/filter by sector and
category without a month predicate (e.g. score_service, safety_intelligence).

Revision ID: a3b4c5d6e7f8
Revises: f4a1b2c3d5e6
Create Date: 2026-03-24 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "a3b4c5d6e7f8"
down_revision: Union[str, None] = "f4a1b2c3d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_crime_data_sector_category",
        "crime_data",
        ["postcode_sector", "category"],
    )


def downgrade() -> None:
    op.drop_index("ix_crime_data_sector_category", table_name="crime_data")
