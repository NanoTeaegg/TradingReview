"""market_daily_bars: swap redundant lookup index for (instrument_type, trade_date)

把与唯一约束自动索引完全重复的 ix_market_daily_bars_lookup 删除，
换成 (instrument_type, trade_date) 索引，使 MAX(trade_date) WHERE instrument_type=...
从全分区扫描（1500 万+行）变为 O(log n) 末尾定位。索引数量不变、磁盘近净零。

Revision ID: d8b3f1a629c5
Revises: 8f2c6a9d4b1e
Create Date: 2026-06-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "d8b3f1a629c5"
down_revision: Union[str, Sequence[str], None] = "8f2c6a9d4b1e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 删除冗余索引：与唯一约束 uq_market_daily_bar 的自动索引列序完全相同，删之不丢任何查找能力
    op.drop_index("ix_market_daily_bars_lookup", table_name="market_daily_bars")
    # 新增「最新交易日」专用索引：加速 MAX/MIN(trade_date) 按 instrument_type 的边缘定位
    op.create_index(
        "ix_market_daily_bars_latest",
        "market_daily_bars",
        ["instrument_type", "trade_date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_market_daily_bars_latest", table_name="market_daily_bars")
    op.create_index(
        "ix_market_daily_bars_lookup",
        "market_daily_bars",
        ["instrument_type", "ts_code", "trade_date"],
        unique=False,
    )
