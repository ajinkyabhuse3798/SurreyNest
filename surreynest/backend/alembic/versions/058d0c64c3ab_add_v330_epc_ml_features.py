"""add_v330_epc_ml_features

Revision ID: 058d0c64c3ab
Revises: c3d8e5f7a2b1
Create Date: 2026-03-09 19:02:49.509247

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "058d0c64c3ab"
down_revision: Union[str, None] = "c3d8e5f7a2b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # v3.3.0: Add 4 new EPC-derived columns for ML features
    op.add_column(
        "properties",
        sa.Column("construction_age_band", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "properties", sa.Column("mains_gas_flag", sa.Integer(), nullable=True)
    )
    op.add_column("properties", sa.Column("floor_level", sa.Integer(), nullable=True))
    op.add_column(
        "properties", sa.Column("annual_energy_cost", sa.Float(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("properties", "annual_energy_cost")
    op.drop_column("properties", "floor_level")
    op.drop_column("properties", "mains_gas_flag")
    op.drop_column("properties", "construction_age_band")
