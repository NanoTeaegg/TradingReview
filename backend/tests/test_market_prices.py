from datetime import date
from decimal import Decimal

from app.models.market_cache import MarketDailyBar
from app.services.market import MarketDataProvider


def test_get_prices_on_date_uses_cached_daily_price(db, monkeypatch):
    db.add(
        MarketDailyBar(
            instrument_type="stock",
            ts_code="000001.SZ",
            trade_date=date(2026, 5, 29),
            close=Decimal("12.34"),
            pre_close=Decimal("12.00"),
            source="test",
        )
    )
    db.commit()
    provider = MarketDataProvider(db)

    result = provider.get_prices_on_date(["000001.SZ"], date(2026, 5, 29))

    assert result["000001.SZ"]["price"] == Decimal("12.3400")
    assert result["000001.SZ"]["pre_close"] == Decimal("12.0000")


def test_get_prices_on_date_local_only_when_missing(db):
    """读路径只查本地，不存在则返回空，不触发任何外部拉取。"""
    provider = MarketDataProvider(db)

    result = provider.get_prices_on_date(["000002.SZ"], date(2026, 5, 29))

    assert result == {}


def test_get_latest_price_reads_local_latest_bar(db):
    for d, close in ((date(2026, 5, 28), "10.0"), (date(2026, 5, 29), "11.0")):
        db.add(
            MarketDailyBar(
                instrument_type="stock",
                ts_code="000001.SZ",
                trade_date=d,
                close=Decimal(close),
                pre_close=Decimal("9.9"),
                source="test",
            )
        )
    db.commit()
    provider = MarketDataProvider(db)

    result = provider.get_latest_price(["000001.SZ"])

    assert result["000001.SZ"]["price"] == Decimal("11.0")
