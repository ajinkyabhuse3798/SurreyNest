"""add_implied_rent_sale_count_to_area_values

Revision ID: 9181c84b6aa9
Revises: e2f3a4b5c6d7
Create Date: 2026-03-02 17:16:59.557582

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '9181c84b6aa9'
down_revision: Union[str, None] = 'e2f3a4b5c6d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('area_values', sa.Column('implied_weekly_rent', sa.Float(), nullable=True))
    op.add_column('area_values', sa.Column('sale_count', sa.Float(), nullable=True))
    op.alter_column('area_values', 'median_sale_price',
               existing_type=sa.Float(),
               nullable=True)


def downgrade() -> None:
    op.alter_column('area_values', 'median_sale_price',
               existing_type=sa.Float(),
               nullable=False)
    op.drop_column('area_values', 'sale_count')
    op.drop_column('area_values', 'implied_weekly_rent')
