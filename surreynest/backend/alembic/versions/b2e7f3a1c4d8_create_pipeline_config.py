"""create pipeline_config table

Revision ID: b2e7f3a1c4d8
Revises: 9181c84b6aa9
Create Date: 2026-03-02 23:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2e7f3a1c4d8'
down_revision: Union[str, None] = '9181c84b6aa9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'pipeline_config',
        sa.Column('key', sa.String(100), primary_key=True, nullable=False),
        sa.Column('value', sa.Float, nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('updated_at', sa.DateTime, nullable=False),
        sa.Column('source', sa.String(100), nullable=False, server_default='manual'),
    )

    # Seed with the current known IPHRP value so the app works immediately
    op.execute(
        "INSERT INTO pipeline_config (key, value, description, updated_at, source) "
        "VALUES ("
        "  'iphrp_growth_pct', "
        "  6.005659, "
        "  'South East IPHRP annual rental growth % (ONS)', "
        "  NOW(), "
        "  'migration_seed'"
        ")"
    )


def downgrade() -> None:
    op.drop_table('pipeline_config')
