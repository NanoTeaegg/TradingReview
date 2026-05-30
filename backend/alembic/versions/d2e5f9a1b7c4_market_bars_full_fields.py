"""market_daily_bars full tushare fields + drop legacy tables

Revision ID: d2e5f9a1b7c4
Revises: c1d4e8f2a6b3
Create Date: 2026-05-30 19:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d2e5f9a1b7c4"
down_revision: Union[str, Sequence[str], None] = "c1d4e8f2a6b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("market_daily_bars") as batch:
        batch.add_column(sa.Column("change", sa.String(), nullable=True))
        batch.add_column(sa.Column("pct_chg", sa.String(), nullable=True))
        batch.add_column(sa.Column("vol", sa.String(), nullable=True))
        batch.add_column(sa.Column("amount", sa.String(), nullable=True))

    op.drop_table("daily_prices")
    op.drop_table("index_daily_cache")


def downgrade() -> None:
    op.create_table(
        "daily_prices",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("ts_code", sa.String(length=12), nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False),
        sa.Column("close", sa.String(), nullable=False),
        sa.Column("pre_close", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ts_code", "trade_date", name="uq_daily_price"),
    )
    op.create_table(
        "index_daily_cache",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("index_code", sa.String(length=12), nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False),
        sa.Column("close", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("index_code", "trade_date", name="uq_index_daily"),
    )

    with op.batch_alter_table("market_daily_bars") as batch:
        batch.drop_column("amount")
        batch.drop_column("vol")
        batch.drop_column("pct_chg")
        batch.drop_column("change")
