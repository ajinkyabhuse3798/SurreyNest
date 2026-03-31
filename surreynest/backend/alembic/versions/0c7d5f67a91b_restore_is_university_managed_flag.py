"""restore is_university_managed flag

Revision ID: 0c7d5f67a91b
Revises: a3b4c5d6e7f8
Create Date: 2026-03-31 23:20:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0c7d5f67a91b"
down_revision: Union[str, None] = "a3b4c5d6e7f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def _has_index(table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(idx["name"] == index_name for idx in inspector.get_indexes(table_name))


def upgrade() -> None:
    if not _has_column("properties", "is_university_managed"):
        op.add_column(
            "properties",
            sa.Column(
                "is_university_managed",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )

    if not _has_index("properties", "ix_properties_is_university_managed"):
        op.create_index(
            "ix_properties_is_university_managed",
            "properties",
            ["is_university_managed"],
            unique=False,
        )


def downgrade() -> None:
    if _has_index("properties", "ix_properties_is_university_managed"):
        op.drop_index("ix_properties_is_university_managed", table_name="properties")

    if _has_column("properties", "is_university_managed"):
        op.drop_column("properties", "is_university_managed")
