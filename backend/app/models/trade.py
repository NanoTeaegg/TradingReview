from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Integer, Date, DateTime, ForeignKey, UniqueConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.types import Money


class Trade(Base):
    __tablename__ = "trades"
    __table_args__ = (
        UniqueConstraint(
            "trade_date", "stock_code", "side", "price", "quantity", "amount",
            name="uq_trade_identity"
        ),
        Index("ix_trades_stock_code", "stock_code"),
        Index("ix_trades_trade_date", "trade_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    seq: Mapped[int] = mapped_column(Integer, default=0)
    ts_code: Mapped[str] = mapped_column(String(12), nullable=False)
    stock_code: Mapped[str] = mapped_column(String(10), nullable=False)
    stock_name: Mapped[str] = mapped_column(String(50), nullable=False)
    side: Mapped[str] = mapped_column(String(20), nullable=False)  # buy/sell/transfer_in
    price: Mapped[Decimal] = mapped_column(Money(4), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Money(4), nullable=False)
    fee: Mapped[Decimal] = mapped_column(Money(4), default=Decimal("0"))
    market: Mapped[str] = mapped_column(String(4), nullable=False)  # SZ/SH
    source: Mapped[str] = mapped_column(String(20), default="ths_xls")
    remark: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    raw_row_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("raw_import_rows.id", ondelete="SET NULL"), nullable=True
    )
    import_batch_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("import_batches.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    intents: Mapped[list["TradeIntent"]] = relationship(
        "TradeIntent", back_populates="trade", cascade="all, delete-orphan"
    )
