from decimal import Decimal
from datetime import date
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.db import Base
from app.models.market_cache import MarketDailyBar
from app.models.trade import Trade
from app.services.pnl import get_positions, run_fifo


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def make_trade(id, code, side, price, qty, amount, date_=date(2026, 1, 1), seq=0, fee=Decimal("0")):
    t = Trade(
        id=id,
        trade_date=date_,
        seq=seq,
        ts_code=f"{code}.SZ",
        stock_code=code,
        stock_name=code,
        side=side,
        price=Decimal(str(price)),
        quantity=qty,
        amount=Decimal(str(amount)),
        fee=Decimal(str(fee)),
        market="SZ",
        source="test",
    )
    return t


def test_simple_round_trip():
    """Buy 100 @ 10, sell 100 @ 12: net = 200 - fees"""
    buy_fee = Decimal("5.00")
    sell_fee = Decimal("6.00")
    trades = [
        make_trade(1, "000001", "buy", 10.0, 100, 1000.0, fee=buy_fee),
        make_trade(2, "000001", "sell", 12.0, 100, 1200.0, date_=date(2026, 1, 2), fee=sell_fee),
    ]
    _, rts = run_fifo(trades)
    assert len(rts) == 1
    rt = rts[0]
    # net = sell_amount - buy_cost - buy_fee - sell_fee
    expected = Decimal("1200") - Decimal("1000") - buy_fee - sell_fee
    assert rt.net_pnl == expected, f"{rt.net_pnl} != {expected}"


def test_fifo_order():
    """Two buy lots, partial sell should consume first lot first."""
    trades = [
        make_trade(1, "000001", "buy", 10.0, 100, 1000.0, seq=0),
        make_trade(2, "000001", "buy", 15.0, 100, 1500.0, seq=1),
        make_trade(3, "000001", "sell", 20.0, 100, 2000.0, date_=date(2026, 1, 2)),
    ]
    lots, rts = run_fifo(trades)
    assert len(rts) == 1
    # Should consume first lot (price=10)
    rt = rts[0]
    assert rt.buy_cost == Decimal("1000")  # 100 * 10
    remaining = lots.get("000001", [])
    assert len(remaining) == 1
    assert remaining[0].price == Decimal("15.0000")


def test_transfer_in_no_pnl():
    """担保品划入视为无效数据：卖出担保品不产生已实现盈亏，仅消耗库存。"""
    trades = [
        make_trade(1, "000001", "transfer_in", 10.0, 100, 1000.0),
        make_trade(2, "000001", "sell", 12.0, 100, 1200.0, date_=date(2026, 1, 2)),
    ]
    lots, rts = run_fifo(trades)
    # 担保品卖出不计入 round-trip 已实现盈亏
    assert rts == []
    # 库存被消耗干净，无剩余自有持仓
    assert sum(l.qty for l in lots.get("000001", [])) == 0


def test_decimal_precision():
    """Net PnL must be computed exactly in Decimal, no float error."""
    buy_fee = Decimal("21.19")
    sell_fee = Decimal("71.05")
    trades = [
        make_trade(1, "000001", "buy", "264.618", 400, "105847.20", fee=buy_fee),
        make_trade(2, "000001", "sell", "274.0", 400, "109600.0", date_=date(2026, 1, 2), fee=sell_fee),
    ]
    _, rts = run_fifo(trades)
    rt = rts[0]
    expected = Decimal("109600.0") - Decimal("105847.20") - buy_fee - sell_fee
    # Must match exactly
    assert rt.net_pnl == expected


def test_positions_use_holding_date_and_latest_price_date(db, monkeypatch):
    monkeypatch.setattr("app.services.pnl.latest_market_date", lambda: date(2026, 5, 29))

    trade = make_trade(1, "000001", "buy", "10.0", 100, "1000.0", date_=date(2026, 5, 28))
    db.add(trade)
    db.add_all([
            MarketDailyBar(
                instrument_type="stock",
                ts_code="000001.SZ",
                trade_date=date(2026, 5, 28),
                close=Decimal("11.00"),
                pre_close=Decimal("10.50"),
                source="test",
            ),
            MarketDailyBar(
                instrument_type="stock",
                ts_code="000001.SZ",
                trade_date=date(2026, 5, 29),
                close=Decimal("12.00"),
                pre_close=Decimal("11.00"),
                source="test",
            ),
    ])
    db.commit()

    positions = get_positions(db)

    assert len(positions) == 1
    assert positions[0]["as_of_date"] == "2026-05-28"
    assert positions[0]["price_date"] == "2026-05-29"
    assert positions[0]["latest_price"] == "12.0000"
    assert positions[0]["market_value"] == "1200.00"
