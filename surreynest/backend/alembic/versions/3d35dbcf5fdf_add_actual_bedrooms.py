"""add_actual_bedrooms

Revision ID: 3d35dbcf5fdf
Revises: 62939b3d1c0f
Create Date: 2026-03-09 20:07:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '3d35dbcf5fdf'
down_revision: Union[str, None] = '62939b3d1c0f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('properties', sa.Column('actual_bedrooms', sa.Integer(), nullable=True))

def downgrade() -> None:
    op.drop_column('properties', 'actual_bedrooms')
