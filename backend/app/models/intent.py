from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class TradeIntent(Base):
    __tablename__ = "trade_intents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trade_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("trades.id", ondelete="SET NULL"), nullable=True
    )
    stock_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    tags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array string
    thesis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1-5
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    trade: Mapped[Optional["Trade"]] = relationship("Trade", back_populates="intents")
