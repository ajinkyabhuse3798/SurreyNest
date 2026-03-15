"""add_pro_subscription_to_users

Revision ID: f4a1b2c3d5e6
Revises: 123f15f84b6e
Create Date: 2026-03-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f4a1b2c3d5e6'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column(
        'is_pro',
        sa.Boolean(),
        nullable=False,
        server_default='false',
    ))
    op.add_column('users', sa.Column(
        'pro_expires_at',
        sa.DateTime(),
        nullable=True,
    ))


def downgrade() -> None:
    op.drop_column('users', 'pro_expires_at')
    op.drop_column('users', 'is_pro')
