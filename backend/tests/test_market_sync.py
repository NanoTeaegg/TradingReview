from datetime import date
from decimal import Decimal

from app.models.market_cache import MarketDailyBar, StockListItem
from app.services.market import MarketDataProvider
from app.services.market_sync import (
    MIN_ROWS_PER_SYNCED_DAY,
    _has_complete_full_history,
    _is_trade_date_fully_synced,
    get_full_history_status,
    sync_index_daily_incremental,
    sync_stock_daily_for_trade_date,
)
from app.services.pnl import DEFAULT_BENCHMARKS


def test_ingest_by_trade_date_stores_full_fields(db, monkeypatch):
    provider = MarketDataProvider(db)

    class FakeDf:
        empty = False

        def iterrows(self):
            yield 0, {
                "ts_code": "000001.SZ",
                "trade_date": "20260529",
                "open": 10.1,
                "high": 10.8,
                "low": 10.0,
                "close": 10.5,
                "pre_close": 10.0,
                "change": 0.5,
                "pct_chg": 5.0,
                "vol": 123456.78,
                "amount": 98765.43,
            }

    monkeypatch.setattr("tushare.pro_api", lambda *a, **k: object())
    monkeypatch.setattr("app.services.market._retry", lambda fn, **kw: FakeDf())

    n = provider.ingest_stock_daily_by_trade_date(date(2026, 5, 29))
    assert n == 1
    row = db.query(MarketDailyBar).filter_by(ts_code="000001.SZ", trade_date=date(2026, 5, 29)).one()
    assert row.close == Decimal("10.5")
    assert row.change == Decimal("0.5")
    assert row.pct_chg == Decimal("5.0")
    assert row.vol == Decimal("123456.78")
    assert row.amount == Decimal("98765.43")


def test_full_history_status_requires_all_stocks_done(db):
    # 空清单 → 未拥有全量
    status = get_full_history_status(db)
    assert status["has_data"] is False
    assert status["total"] == 0

    db.add(StockListItem(ts_code="000001.SZ", full_history_synced=True))
    db.add(StockListItem(ts_code="000002.SZ", full_history_synced=False, last_error="timeout"))
    db.commit()

    status = get_full_history_status(db)
    # 仅 1/2 完成 → 不算拥有全量历史
    assert status["has_data"] is False
    assert status["total"] == 2
    assert status["done"] == 1
    assert status["failed"] == 1

    db.query(StockListItem).filter(StockListItem.ts_code == "000002.SZ").update(
        {"full_history_synced": True, "last_error": None}
    )
    db.commit()

    status = get_full_history_status(db)
    assert status["has_data"] is True
    assert status["done"] == 2
    assert status["failed"] == 0


def test_complete_full_history_detection_requires_non_empty_all_done(db):
    assert _has_complete_full_history(db) is False

    db.add(StockListItem(ts_code="000001.SZ", full_history_synced=True))
    db.add(StockListItem(ts_code="000002.SZ", full_history_synced=False))
    db.commit()
    assert _has_complete_full_history(db) is False

    db.query(StockListItem).filter(StockListItem.ts_code == "000002.SZ").update(
        {"full_history_synced": True}
    )
    db.commit()
    assert _has_complete_full_history(db) is True


def test_ingest_stock_daily_history_full_fields(db, monkeypatch):
    provider = MarketDataProvider(db)

    class FakeDf:
        empty = False

        def iterrows(self):
            yield 0, {
                "ts_code": "000001.SZ",
                "trade_date": "20260529",
                "close": 12.0,
                "pre_close": 11.5,
                "vol": 1000.0,
                "amount": 2000.0,
            }

    monkeypatch.setattr("tushare.pro_api", lambda *a, **k: object())
    monkeypatch.setattr("app.services.market._retry", lambda fn, **kw: FakeDf())

    n = provider.ingest_stock_daily_history("000001.SZ", date(2026, 1, 1), date(2026, 5, 29))
    assert n == 1
    row = db.query(MarketDailyBar).filter_by(ts_code="000001.SZ", trade_date=date(2026, 5, 29)).one()
    assert row.close == Decimal("12.0")
    assert row.source == "tushare_daily_hist"


def test_fully_synced_threshold(db):
    d = date(2026, 5, 29)
    assert not _is_trade_date_fully_synced(db, d)
    for i in range(MIN_ROWS_PER_SYNCED_DAY):
        db.add(
            MarketDailyBar(
                instrument_type="stock",
                ts_code=f"{i:06d}.SZ",
                trade_date=d,
                close=Decimal("1"),
                pre_close=Decimal("1"),
                source="test",
            )
        )
    db.commit()
    assert _is_trade_date_fully_synced(db, d)


def test_sync_skips_when_fully_synced(db, monkeypatch):
    d = date(2026, 5, 29)
    for i in range(MIN_ROWS_PER_SYNCED_DAY):
        db.add(
            MarketDailyBar(
                instrument_type="stock",
                ts_code=f"{i:06d}.SZ",
                trade_date=d,
                close=Decimal("1"),
                pre_close=Decimal("1"),
                source="test",
            )
        )
    db.commit()
    monkeypatch.setattr(
        "app.services.market_sync.MarketDataProvider.ingest_stock_daily_by_trade_date",
        lambda *a, **k: (_ for _ in ()).throw(AssertionError("should skip")),
    )
    assert sync_stock_daily_for_trade_date(db, d) == 0


def test_index_incremental_skips_when_all_indexes_are_current(db, monkeypatch):
    target = date(2026, 5, 29)
    for index_code, _ in DEFAULT_BENCHMARKS:
        db.add(
            MarketDailyBar(
                instrument_type="index",
                ts_code=index_code,
                trade_date=target,
                close=Decimal("1"),
                pre_close=Decimal("1"),
                source="test",
            )
        )
    db.commit()

    monkeypatch.setattr(
        "app.services.market_sync.MarketDataProvider.ingest_index_daily_range",
        lambda *a, **k: (_ for _ in ()).throw(AssertionError("should skip")),
    )

    index_rows, warnings = sync_index_daily_incremental(db, target)
    assert index_rows == 0
    assert warnings == []
