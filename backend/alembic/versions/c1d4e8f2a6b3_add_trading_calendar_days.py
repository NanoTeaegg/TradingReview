"""add_trading_calendar_days

Revision ID: c1d4e8f2a6b3
Revises: 4b8f0c2a7d91
Create Date: 2026-05-30 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1d4e8f2a6b3"
down_revision: Union[str, Sequence[str], None] = "4b8f0c2a7d91"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "trading_calendar_days",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("exchange", sa.String(length=8), nullable=False),
        sa.Column("cal_date", sa.Date(), nullable=False),
        sa.Column("is_open", sa.Boolean(), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column(
            "fetched_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("exchange", "cal_date", name="uq_trading_calendar_day"),
    )
    op.create_index(
        "ix_trading_calendar_exchange_date",
        "trading_calendar_days",
        ["exchange", "cal_date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_trading_calendar_exchange_date", table_name="trading_calendar_days")
    op.drop_table("trading_calendar_days")
