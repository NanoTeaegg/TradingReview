from datetime import date, timedelta
from decimal import Decimal

from app.models.market_cache import MarketDailyBar
from app.models.trade import Trade
from app.services.market import STOCK
from app.services import stats


def week_start(weeks_ago: int) -> date:
    today = date.today()
    return today - timedelta(days=today.weekday(), weeks=weeks_ago)


def make_trade(id, side, trade_date, price="10.00", qty=100, amount="1000.00"):
    return Trade(
        id=id,
        account_id=1,
        trade_date=trade_date,
        seq=id,
        ts_code="000001.SZ",
        stock_code="000001",
        stock_name="平安银行",
        side=side,
        price=Decimal(price),
        quantity=qty,
        amount=Decimal(amount),
        fee=Decimal("0"),
        market="SZ",
        source="test",
    )


def test_turnover_empty_account_returns_zero_rows(db):
    rows = stats.get_turnover(db, account_id=1)

    assert len(rows) == 12
    assert all(row["volume"] == "0.00" for row in rows)
    assert all(row["avg_holding_value"] == "0.00" for row in rows)
    assert all(row["turnover_rate"] is None for row in rows)


def test_turnover_handles_closed_historical_positions(db):
    db.add_all([
        make_trade(1, "buy", week_start(11)),
        make_trade(2, "sell", week_start(11), price="12.00", amount="1200.00"),
    ])
    db.commit()

    rows = stats.get_turnover(db, account_id=1)

    assert len(rows) == 12
    assert rows[-1]["avg_holding_value"] == "0.00"
    assert rows[-1]["turnover_rate"] is None


def test_turnover_uses_weekly_volume_over_average_holding_value(db):
    start = week_start(1)
    db.add_all([
        make_trade(1, "buy", start, price="10.00", qty=100, amount="1000.00"),
        MarketDailyBar(
            instrument_type=STOCK,
            ts_code="000001.SZ",
            trade_date=start,
            close=Decimal("10.00"),
            source="test",
        ),
    ])
    db.commit()

    row = stats.get_turnover(db, account_id=1)[-2]

    assert row["week_start"] == start.isoformat()
    assert row["volume"] == "1000.00"
    assert row["buy_count"] == 1
    assert row["sell_count"] == 0
    assert row["turnover_rate"] == 1.0
    assert row["level"] == "frequent"
