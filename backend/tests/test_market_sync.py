from datetime import date
from decimal import Decimal
import sys
import types

import pytest

from app.models.market_cache import MarketDailyBar, StockListItem
from app.services.market import MarketDataProvider, _retry
from app.services import market_sync
from app.services.market_sync import (
    MIN_ROWS_PER_SYNCED_DAY,
    _build_index_pending_note,
    _has_complete_full_history,
    _is_trade_date_fully_synced,
    _pending_benchmark_names,
    _run_latest_sync,
    get_full_history_status,
    get_latest_sync_status,
    sync_index_daily_incremental,
    sync_stock_daily_for_trade_date,
)
from app.services.pnl import DEFAULT_BENCHMARKS


class _SessionContext:
    def __init__(self, db):
        self.db = db

    def __enter__(self):
        return self.db

    def __exit__(self, exc_type, exc, tb):
        return False


def _install_fake_tushare(monkeypatch):
    fake_ts = types.ModuleType("tushare")
    fake_ts.pro_api = lambda *a, **k: object()
    monkeypatch.setitem(sys.modules, "tushare", fake_ts)
    return fake_ts


def test_default_benchmarks_use_selected_four_indexes():
    assert DEFAULT_BENCHMARKS == [
        ("000001.SH", "上证综指"),
        ("000300.SH", "沪深300"),
        ("399006.SZ", "创业板指"),
        ("000688.SH", "科创50"),
    ]


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

    _install_fake_tushare(monkeypatch)
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

    _install_fake_tushare(monkeypatch)
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


def test_index_incremental_attempts_only_one_missing_index_per_run(db, monkeypatch):
    """低积分账号下 index_daily 一轮只补一个缺口指数，避免成功后下一只撞小时限频。"""
    calls: list[str] = []

    def ingest_one(self, index_code, start, end):
        calls.append(index_code)
        return 1

    monkeypatch.setattr(
        "app.services.market_sync.MarketDataProvider.ingest_index_daily_range",
        ingest_one,
    )
    monkeypatch.setattr(market_sync.time, "sleep", lambda *_: None)

    index_rows, warnings = sync_index_daily_incremental(db, date(2026, 6, 1))

    assert index_rows == 1
    assert calls == [DEFAULT_BENCHMARKS[0][0]]
    assert any("本轮仅补 1 个基准" in w for w in warnings)


def test_retry_fast_fails_on_hourly_rate_limit(monkeypatch):
    """按小时限频不应进入 62s 退避重试，直接放弃。"""
    calls = {"n": 0}

    def hourly_limited():
        calls["n"] += 1
        raise RuntimeError("抱歉，您访问接口(index_daily)频率超限(1次/小时)")

    slept = {"n": 0}
    monkeypatch.setattr("app.services.tushare_limiter.sleep_after_rate_limit", lambda e: slept.__setitem__("n", slept["n"] + 1))
    monkeypatch.setattr("app.services.tushare_limiter.wait_for_slot", lambda api="default": None)

    with pytest.raises(RuntimeError, match="频率超限"):
        _retry(hourly_limited, api="index_daily")

    assert calls["n"] == 1       # 只调用一次，不重试
    assert slept["n"] == 0       # 不触发 62s 退避


def test_retry_backs_off_on_per_minute_rate_limit(monkeypatch):
    """每分钟限频应等过当前分钟后重试。"""
    calls = {"n": 0}

    def minute_limited():
        calls["n"] += 1
        raise RuntimeError("抱歉，您访问接口(daily)频率超限(500次/分钟)")

    slept = {"n": 0}
    monkeypatch.setattr("app.services.tushare_limiter.sleep_after_rate_limit", lambda e: slept.__setitem__("n", slept["n"] + 1))
    monkeypatch.setattr("app.services.tushare_limiter.wait_for_slot", lambda api="default": None)

    with pytest.raises(RuntimeError, match="频率超限"):
        _retry(minute_limited, retries=3, api="daily")

    assert calls["n"] == 3       # 重试满 3 次
    assert slept["n"] == 2       # 前两次失败各退避一次


@pytest.mark.parametrize("limit_msg", ["1次/小时", "5次/天"])
def test_index_incremental_skips_remaining_on_long_period_rate_limit(db, monkeypatch, limit_msg):
    """index_daily 命中小时/天级限频时，跳过其余基准、只调用一次。"""
    calls = {"n": 0}

    def limited(self, index_code, start, end):
        calls["n"] += 1
        raise RuntimeError(f"访问接口(index_daily)频率超限({limit_msg})")

    monkeypatch.setattr(
        "app.services.market_sync.MarketDataProvider.ingest_index_daily_range",
        limited,
    )
    monkeypatch.setattr(market_sync.time, "sleep", lambda *_: None)

    total, warnings = sync_index_daily_incremental(db, date(2026, 6, 1))

    assert total == 0
    assert calls["n"] == 1  # 只试一个基准就跳出
    assert any("限频" in w for w in warnings)


def test_pending_benchmark_names_lists_only_lagging_indexes(db):
    """只有落后/缺失的基准才进入待补列表；已最新的不计入。"""
    target = date(2026, 6, 3)
    # 第一个基准补到目标日（最新），其余缺失
    current_code = DEFAULT_BENCHMARKS[0][0]
    db.add(
        MarketDailyBar(
            instrument_type="index", ts_code=current_code, trade_date=target,
            close=Decimal("1"), pre_close=Decimal("1"), source="test",
        )
    )
    db.commit()

    pending = _pending_benchmark_names(db, target)
    names = [name for code, name in DEFAULT_BENCHMARKS]
    assert DEFAULT_BENCHMARKS[0][1] not in pending  # 已最新的不在待补里
    assert pending == names[1:]                      # 其余按顺序待补


def test_build_index_pending_note_messaging():
    assert _build_index_pending_note([], False) == ""
    rate = _build_index_pending_note(["创业板指", "科创50"], True)
    assert "创业板指" in rate and "科创50" in rate
    assert "限频" in rate and "1 小时" in rate
    soft = _build_index_pending_note(["科创50"], False)
    assert "科创50" in soft and "1次/小时" in soft
    assert "限频" not in soft


def test_fetch_index_daily_reraises_rate_limit_but_swallows_others(db, monkeypatch):
    """限频异常需向上抛出（供同步任务跳过其余基准）；其余错误按缺失返回空。"""
    provider = MarketDataProvider(db)
    _install_fake_tushare(monkeypatch)

    seen_kw: dict = {}

    def rate_limited(fn, **kw):
        seen_kw.update(kw)
        raise RuntimeError("访问接口(index_daily)频率超限(1次/小时)")

    monkeypatch.setattr("app.services.market._retry", rate_limited)
    with pytest.raises(RuntimeError, match="频率超限"):
        provider._fetch_index_daily("000300.SH", date(2026, 1, 1), date(2026, 6, 1))
    # index_daily 必须 retries=1：撞限频（含分钟级消息）立即放弃，不做 62s 退避
    assert seen_kw.get("retries") == 1

    def other_error(fn, **kw):
        raise RuntimeError("网络抖动")

    monkeypatch.setattr("app.services.market._retry", other_error)
    assert provider._fetch_index_daily("000300.SH", date(2026, 1, 1), date(2026, 6, 1)) == []


def test_latest_sync_status_idle_without_state(db):
    status = get_latest_sync_status(db)
    assert status["status"] == "idle"
    assert status["running"] is False


def test_run_latest_sync_records_complete_status(db, monkeypatch):
    """后台任务跑完后写入 complete 状态与同步结果文案。"""
    monkeypatch.setattr(market_sync, "SessionLocal", lambda: _SessionContext(db))
    monkeypatch.setattr(
        market_sync, "sync_latest",
        lambda _db: {"ok": True, "message": "已更新至 2026-06-01", "max_date": "2026-06-01"},
    )

    _run_latest_sync()

    status = get_latest_sync_status(db)
    assert status["status"] == "complete"
    assert status["running"] is False
    assert status["message"] == "已更新至 2026-06-01"
    assert status["finished_at"] is not None


def test_run_latest_sync_records_error_on_failure(db, monkeypatch):
    monkeypatch.setattr(market_sync, "SessionLocal", lambda: _SessionContext(db))

    def boom(_db):
        raise RuntimeError("tushare down")

    monkeypatch.setattr(market_sync, "sync_latest", boom)

    _run_latest_sync()

    status = get_latest_sync_status(db)
    assert status["status"] == "error"
    assert "tushare down" in (status["message"] or "")
