"""add_agent_name_to_reviews

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-12 00:01:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "reviews", sa.Column("agent_name", sa.String(length=255), nullable=True)
    )
    op.create_index(
        op.f("ix_reviews_agent_name"), "reviews", ["agent_name"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_reviews_agent_name"), table_name="reviews")
    op.drop_column("reviews", "agent_name")
