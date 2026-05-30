from datetime import date
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Integer, Date, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.types import Money


class DailyPrice(Base):
    __tablename__ = "daily_prices"
    __table_args__ = (
        UniqueConstraint("ts_code", "trade_date", name="uq_daily_price"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts_code: Mapped[str] = mapped_column(String(12), nullable=False)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    close: Mapped[Decimal] = mapped_column(Money(4), nullable=False)
    pre_close: Mapped[Optional[Decimal]] = mapped_column(Money(4), nullable=True)


class IndexDailyCache(Base):
    __tablename__ = "index_daily_cache"
    __table_args__ = (
        UniqueConstraint("index_code", "trade_date", name="uq_index_daily"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    index_code: Mapped[str] = mapped_column(String(12), nullable=False)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    close: Mapped[Decimal] = mapped_column(Money(4), nullable=False)
