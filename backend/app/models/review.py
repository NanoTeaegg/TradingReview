from datetime import date, datetime
from typing import Optional
from sqlalchemy import String, Integer, Text, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ReviewReport(Base):
    __tablename__ = "review_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scope: Mapped[str] = mapped_column(String(20), nullable=False)  # trade/stock/period
    trade_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("trades.id", ondelete="SET NULL"), nullable=True
    )
    stock_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    period_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    period_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    rule_version_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("rule_versions.id", ondelete="SET NULL"), nullable=True
    )
    input_snapshot: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
