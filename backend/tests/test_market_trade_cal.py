from datetime import date, timedelta
from decimal import Decimal

from app.models.market_cache import MarketDailyBar, TradingCalendarDay
from app.services.market import MarketDataProvider


def _seed_trade_days(db, start: date, count: int, exchange: str = "SSE") -> None:
    cur = start
    added = 0
    while added < count:
        if cur.weekday() < 5:
            db.add(
                TradingCalendarDay(
                    exchange=exchange,
                    cal_date=cur,
                    is_open=True,
                    source="test",
                )
            )
            added += 1
        cur += timedelta(days=1)
    db.commit()


def test_trade_cal_reads_local_without_tushare(db, monkeypatch):
    start = date(2026, 4, 21)
    end = date(2026, 5, 28)
    _seed_trade_days(db, start, 30)

    provider = MarketDataProvider(db)
    monkeypatch.setattr(
        provider,
        "_fetch_trade_cal_tushare",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("should not call tushare")),
    )

    days = provider.trade_cal(start, end)
    assert days
    assert min(days) >= start
    assert max(days) <= end


def test_ensure_trade_calendar_skips_remote_when_cached(db, monkeypatch):
    start = date(2026, 1, 1)
    end = date(2026, 5, 30)
    _seed_trade_days(db, start, 120)

    provider = MarketDataProvider(db)
    calls = []
    monkeypatch.setattr(
        provider,
        "_fetch_trade_cal_tushare",
        lambda *a, **k: calls.append(1) or [],
    )

    provider.ensure_trade_calendar(start, end)
    assert calls == []


def test_seed_calendar_from_market_daily_bars_without_tushare(db, monkeypatch):
    start = date(2026, 4, 21)
    end = date(2026, 5, 28)
    for d in (date(2026, 4, 21), date(2026, 4, 22), date(2026, 5, 28)):
        db.add(
            MarketDailyBar(
                instrument_type="stock",
                ts_code="000001.SZ",
                trade_date=d,
                close=Decimal("10"),
                pre_close=Decimal("10"),
                source="test",
            )
        )
    db.commit()

    provider = MarketDataProvider(db)
    calls = []
    monkeypatch.setattr(
        provider,
        "_fetch_trade_cal_tushare",
        lambda *a, **k: calls.append(1) or (_ for _ in ()).throw(AssertionError("no tushare")),
    )

    provider.ensure_trade_calendar(start, end)
    stored = provider._load_trade_cal_from_db(start, end, "SSE")

    assert calls == []
    assert date(2026, 4, 21) in stored
    assert date(2026, 5, 28) in stored


def test_ingest_trade_calendar_range_persists_remote_days(db, monkeypatch):
    start = date(2026, 4, 1)
    end = date(2026, 4, 10)
    # 含休市日（is_open=0）与 pretrade_date，对齐 trade_cal 全字段输出
    remote = [
        {"cal_date": date(2026, 4, 1), "is_open": True, "pretrade_date": date(2026, 3, 31)},
        {"cal_date": date(2026, 4, 2), "is_open": True, "pretrade_date": date(2026, 4, 1)},
        {"cal_date": date(2026, 4, 3), "is_open": True, "pretrade_date": date(2026, 4, 2)},
        {"cal_date": date(2026, 4, 4), "is_open": False, "pretrade_date": date(2026, 4, 3)},
        {"cal_date": date(2026, 4, 5), "is_open": False, "pretrade_date": date(2026, 4, 3)},
    ]

    provider = MarketDataProvider(db)
    monkeypatch.setattr(provider, "_fetch_trade_cal_tushare", lambda *a, **k: remote)

    provider.ingest_trade_calendar_range(start, end)

    # 交易日列表只含 is_open=1
    stored = provider._load_trade_cal_from_db(start, end, "SSE")
    assert stored == [date(2026, 4, 1), date(2026, 4, 2), date(2026, 4, 3)]

    # 休市日也落库，且 pretrade_date 被保存
    holiday = (
        db.query(TradingCalendarDay)
        .filter(TradingCalendarDay.cal_date == date(2026, 4, 4))
        .one()
    )
    assert holiday.is_open is False
    assert holiday.pretrade_date == date(2026, 4, 3)


def test_ingest_trade_calendar_range_force_refresh(db, monkeypatch):
    provider = MarketDataProvider(db)
    remote = [
        {"cal_date": date(2026, 5, 1), "is_open": False, "pretrade_date": date(2026, 4, 30)},
        {"cal_date": date(2026, 5, 6), "is_open": True, "pretrade_date": date(2026, 4, 30)},
    ]
    monkeypatch.setattr(provider, "_fetch_trade_cal_tushare", lambda *a, **k: remote)

    n = provider.ingest_trade_calendar_range(date(2026, 5, 1), date(2026, 5, 6))
    assert n == 2
    rows = db.query(TradingCalendarDay).all()
    assert {r.cal_date for r in rows} == {date(2026, 5, 1), date(2026, 5, 6)}
