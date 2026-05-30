"""add_market_daily_bars

Revision ID: 4b8f0c2a7d91
Revises: 2f7b6a1c9d34
Create Date: 2026-05-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from app.models.types import Money


# revision identifiers, used by Alembic.
revision: str = "4b8f0c2a7d91"
down_revision: Union[str, Sequence[str], None] = "2f7b6a1c9d34"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "market_daily_bars",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("instrument_type", sa.String(length=20), nullable=False),
        sa.Column("ts_code", sa.String(length=12), nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False),
        sa.Column("open", Money(4), nullable=True),
        sa.Column("high", Money(4), nullable=True),
        sa.Column("low", Money(4), nullable=True),
        sa.Column("close", Money(4), nullable=False),
        sa.Column("pre_close", Money(4), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="migration"),
        sa.Column("fetched_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("instrument_type", "ts_code", "trade_date", name="uq_market_daily_bar"),
    )
    op.create_index("ix_market_daily_bars_lookup", "market_daily_bars", ["instrument_type", "ts_code", "trade_date"], unique=False)

    op.execute(
        """
        INSERT OR IGNORE INTO market_daily_bars
            (instrument_type, ts_code, trade_date, close, pre_close, source, fetched_at)
        SELECT 'stock', ts_code, trade_date, close, pre_close, 'migration', CURRENT_TIMESTAMP
        FROM daily_prices
        """
    )
    op.execute(
        """
        INSERT OR IGNORE INTO market_daily_bars
            (instrument_type, ts_code, trade_date, close, pre_close, source, fetched_at)
        SELECT 'index', index_code, trade_date, close, NULL, 'migration', CURRENT_TIMESTAMP
        FROM index_daily_cache
        """
    )


def downgrade() -> None:
    op.drop_index("ix_market_daily_bars_lookup", table_name="market_daily_bars")
    op.drop_table("market_daily_bars")
