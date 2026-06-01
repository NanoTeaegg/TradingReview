from datetime import date
from decimal import Decimal

from app.models.trade import Trade
from app.services import stats


def month_start(months_ago: int) -> date:
    today = date.today()
    month = (today.month - months_ago - 1) % 12 + 1
    year = today.year + (today.month - months_ago - 1) // 12
    return date(year, month, 1)


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

    assert len(rows) == 6
    assert all(row["volume"] == "0.00" for row in rows)
    assert all(row["start_value"] == "0.00" for row in rows)
    assert all(row["turnover_rate"] is None for row in rows)


def test_turnover_handles_closed_historical_positions(db):
    db.add_all([
        make_trade(1, "buy", month_start(5)),
        make_trade(2, "sell", month_start(5), price="12.00", amount="1200.00"),
    ])
    db.commit()

    rows = stats.get_turnover(db, account_id=1)

    assert len(rows) == 6
    assert rows[-1]["start_value"] == "0.00"
    assert rows[-1]["turnover_rate"] is None
