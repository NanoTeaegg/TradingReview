"""account fee settings

Revision ID: 7d1e4f8a2c9b
Revises: b5e9c3a7f2d1
Create Date: 2026-06-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7d1e4f8a2c9b"
down_revision: Union[str, Sequence[str], None] = "b5e9c3a7f2d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("commission_rate", sa.String(), nullable=False, server_default="0.00040000"),
    )
    op.add_column(
        "accounts",
        sa.Column("commission_min_fee_exempt", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )


def downgrade() -> None:
    op.drop_column("accounts", "commission_min_fee_exempt")
    op.drop_column("accounts", "commission_rate")
