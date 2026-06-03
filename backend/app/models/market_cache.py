from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import Boolean, Date, DateTime, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.types import Money


class TradingCalendarDay(Base):
    """交易日历缓存：对齐 TuShare trade_cal 全字段，落全部自然日（含休市日）。"""

    __tablename__ = "trading_calendar_days"
    __table_args__ = (
        UniqueConstraint("exchange", "cal_date", name="uq_trading_calendar_day"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    exchange: Mapped[str] = mapped_column(String(8), nullable=False, default="SSE")
    cal_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_open: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)  # 0休市 1交易
    pretrade_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)  # 上一个交易日
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="tushare")
    fetched_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())


class MarketDailyBar(Base):
    __tablename__ = "market_daily_bars"
    __table_args__ = (
        UniqueConstraint("instrument_type", "ts_code", "trade_date", name="uq_market_daily_bar"),
        # 加速「最新交易日」查询：MAX/MIN(trade_date) WHERE instrument_type=... 末尾定位
        Index("ix_market_daily_bars_latest", "instrument_type", "trade_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    instrument_type: Mapped[str] = mapped_column(String(20), nullable=False)
    ts_code: Mapped[str] = mapped_column(String(12), nullable=False)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    open: Mapped[Optional[Decimal]] = mapped_column(Money(4), nullable=True)
    high: Mapped[Optional[Decimal]] = mapped_column(Money(4), nullable=True)
    low: Mapped[Optional[Decimal]] = mapped_column(Money(4), nullable=True)
    close: Mapped[Decimal] = mapped_column(Money(4), nullable=False)
    pre_close: Mapped[Optional[Decimal]] = mapped_column(Money(4), nullable=True)
    # 对齐 TuShare daily 输出字段
    change: Mapped[Optional[Decimal]] = mapped_column(Money(4), nullable=True)  # 涨跌额
    pct_chg: Mapped[Optional[Decimal]] = mapped_column(Money(4), nullable=True)  # 涨跌幅(%)
    vol: Mapped[Optional[Decimal]] = mapped_column(Money(2), nullable=True)  # 成交量(手)
    amount: Mapped[Optional[Decimal]] = mapped_column(Money(2), nullable=True)  # 成交额(千元)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="unknown")
    fetched_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())


class StockListItem(Base):
    """全市场股票清单（来自 TuShare stock_basic），并跟踪逐只全量历史同步进度。"""

    __tablename__ = "stock_list"
    __table_args__ = (
        UniqueConstraint("ts_code", name="uq_stock_list_ts_code"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts_code: Mapped[str] = mapped_column(String(12), nullable=False)
    symbol: Mapped[Optional[str]] = mapped_column(String(12), nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    list_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    list_status: Mapped[str] = mapped_column(String(2), nullable=False, default="L")
    full_history_synced: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_synced_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)  # 该股已落库的最新交易日
    last_error: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)  # 最近一次失败原因
    synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())


class MarketSyncState(Base):
    """单例式同步任务状态（如全量历史初始化），供前端轮询展示进度。"""

    __tablename__ = "market_sync_state"
    __table_args__ = (
        UniqueConstraint("key", name="uq_market_sync_state_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="idle")  # idle/running/complete/error/cancelled
    current_code: Mapped[Optional[str]] = mapped_column(String(12), nullable=True)
    message: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())


class MarketSentimentSnapshot(Base):
    __tablename__ = "market_sentiment_snapshots"
    __table_args__ = (
        UniqueConstraint("trade_date", name="uq_market_sentiment_trade_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_trading_day: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    up_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    down_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    flat_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    limit_up: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    limit_down: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_volume_billion: Mapped[Decimal] = mapped_column(Money(2), nullable=False, default=Decimal("0"))
    sentiment: Mapped[str] = mapped_column(String(20), nullable=False, default="neutral")
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="unknown")
    note: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
