"""create_letting_agents

Revision ID: a1b2c3d4e5f6
Revises: 123f15f84b6e
Create Date: 2026-03-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '123f15f84b6e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'letting_agents',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('display_name', sa.String(length=255), nullable=False),
        sa.Column('postcode_sectors', sa.JSON(), nullable=True),
        sa.Column('website', sa.String(length=500), nullable=True),
        sa.Column('is_verified', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_letting_agents_name'), 'letting_agents', ['name'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_letting_agents_name'), table_name='letting_agents')
    op.drop_table('letting_agents')
