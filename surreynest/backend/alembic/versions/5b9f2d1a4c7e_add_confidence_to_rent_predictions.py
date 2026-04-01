"""add confidence column to rent_predictions

Revision ID: 5b9f2d1a4c7e
Revises: 0c7d5f67a91b
Create Date: 2026-04-01 17:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5b9f2d1a4c7e"
down_revision: Union[str, None] = "0c7d5f67a91b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(
        column["name"] == column_name
        for column in inspector.get_columns(table_name)
    )


def upgrade() -> None:
    if not _has_column("rent_predictions", "confidence"):
        op.add_column(
            "rent_predictions",
            sa.Column("confidence", sa.Float(), nullable=True),
        )


def downgrade() -> None:
    if _has_column("rent_predictions", "confidence"):
        op.drop_column("rent_predictions", "confidence")
