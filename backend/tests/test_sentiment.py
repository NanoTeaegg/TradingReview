import time
import sys
import types

import pytest

from datetime import date
from decimal import Decimal

from app.models.market_cache import MarketDailyBar, MarketSentimentSnapshot
from app.services import sentiment


def test_call_with_timeout_returns_value_before_deadline():
    assert sentiment._call_with_timeout(lambda: 42, 1.0, "fast") == 42


def test_call_with_timeout_propagates_inner_error():
    def boom():
        raise ValueError("inner")

    with pytest.raises(ValueError, match="inner"):
        sentiment._call_with_timeout(boom, 1.0, "boom")


def test_call_with_timeout_raises_on_hang():
    with pytest.raises(TimeoutError):
        sentiment._call_with_timeout(lambda: time.sleep(5), 0.1, "hang")


def test_fetch_limit_counts_degrades_to_zero_when_akshare_hangs(monkeypatch):
    """akshare 涨跌停池挂起时，涨跌停数降级为 0，不拖死调用方。"""
    fake_ak = types.ModuleType("akshare")
    fake_ak.stock_zt_pool_em = lambda date: time.sleep(5)
    fake_ak.stock_dt_pool_em = lambda date: time.sleep(5)
    monkeypatch.setitem(sys.modules, "akshare", fake_ak)
    monkeypatch.setattr(sentiment, "AKSHARE_FETCH_TIMEOUT_SEC", 0.1)

    started = time.monotonic()
    limit_up, limit_down = sentiment._fetch_limit_counts(date(2026, 6, 1))
    elapsed = time.monotonic() - started

    assert (limit_up, limit_down) == (0, 0)
    assert elapsed < 2.0  # 两次 0.1s 超时即放弃，不会等满 10s


def test_tushare_daily_sentiment_uses_shared_retry(monkeypatch):
    """情绪快照的 TuShare daily 也必须走统一限流/重试路径。"""
    fake_ts = types.ModuleType("tushare")
    fake_ts.pro_api = lambda *args, **kwargs: object()
    monkeypatch.setitem(sys.modules, "tushare", fake_ts)
    monkeypatch.setattr(sentiment.settings, "TUSHARE_API_KEY", "token")
    monkeypatch.setattr(sentiment, "_fetch_limit_counts", lambda trade_date: (0, 0))

    calls: list[str] = []

    class FakeSeries:
        def __init__(self, values):
            self.values = values

        def __gt__(self, other):
            return FakeSeries([v > other for v in self.values])

        def __lt__(self, other):
            return FakeSeries([v < other for v in self.values])

        def __eq__(self, other):
            return FakeSeries([v == other for v in self.values])

        def sum(self):
            return sum(self.values)

    class FakeDf:
        empty = False
        columns = ["pct_chg", "amount"]

        def __getitem__(self, key):
            if key == "pct_chg":
                return FakeSeries([1, -1, 0])
            if key == "amount":
                return FakeSeries([100000, 200000, 300000])
            raise KeyError(key)

    def fake_retry(fn, **kwargs):
        calls.append(kwargs["api"])
        return FakeDf()

    monkeypatch.setattr(sentiment, "_retry", fake_retry)

    result = sentiment._fetch_tushare_daily_sentiment(date(2026, 6, 1))

    assert calls == ["daily"]
    assert result["up_count"] == 1
    assert result["down_count"] == 1
    assert result["flat_count"] == 1


def test_tushare_daily_sentiment_fast_mode_disables_backoff(monkeypatch):
    """交互式 fast 模式：daily 仅尝试一次（retries=1），撞限频立即放弃不退避 62s。"""
    fake_ts = types.ModuleType("tushare")
    fake_ts.pro_api = lambda *args, **kwargs: object()
    monkeypatch.setitem(sys.modules, "tushare", fake_ts)
    monkeypatch.setattr(sentiment.settings, "TUSHARE_API_KEY", "token")
    monkeypatch.setattr(sentiment, "_fetch_limit_counts", lambda trade_date: (0, 0))

    seen: dict[str, int] = {}

    def fake_retry(fn, **kwargs):
        seen["retries"] = kwargs.get("retries", 3)
        raise RuntimeError("访问接口(daily)频率超限(500次/分钟)")

    monkeypatch.setattr(sentiment, "_retry", fake_retry)

    # fast=True → retries=1（不退避）；默认 → retries=3
    with pytest.raises(RuntimeError):
        sentiment._fetch_tushare_daily_sentiment(date(2026, 6, 1), fast=True)
    assert seen["retries"] == 1
    with pytest.raises(RuntimeError):
        sentiment._fetch_tushare_daily_sentiment(date(2026, 6, 1))
    assert seen["retries"] == 3


def test_latest_market_date_uses_friday_on_weekends():
    assert sentiment.latest_market_date(date(2026, 5, 30)) == date(2026, 5, 29)
    assert sentiment.latest_market_date(date(2026, 5, 31)) == date(2026, 5, 29)
    assert sentiment.latest_market_date(date(2026, 5, 29)) == date(2026, 5, 29)


def test_get_market_sentiment_returns_cached_snapshot(db, monkeypatch):
    db.add(
        MarketSentimentSnapshot(
            trade_date=date(2026, 5, 29),
            is_trading_day=True,
            up_count=3000,
            down_count=1800,
            flat_count=200,
            limit_up=55,
            limit_down=12,
            total_volume_billion=Decimal("9288.50"),
            sentiment="bullish",
            source="tushare",
        )
    )
    db.commit()

    monkeypatch.setattr(sentiment, "current_market_date", lambda db, now=None: date(2026, 5, 29))
    monkeypatch.setattr(
        sentiment,
        "_fetch_sentiment_payload",
        lambda trade_date: (_ for _ in ()).throw(AssertionError("should not fetch when cached")),
    )

    result = sentiment.get_market_sentiment(db)

    assert result["date"] == "2026-05-29"
    assert result["up_count"] == 3000
    assert result["total_volume_billion"] == 9288.5


def test_get_market_sentiment_uses_latest_local_snapshot(db, monkeypatch):
    db.add(
        MarketSentimentSnapshot(
            trade_date=date(2026, 5, 28),
            is_trading_day=True,
            up_count=50,
            down_count=40,
            flat_count=10,
            limit_up=1,
            limit_down=0,
            total_volume_billion=Decimal("100.00"),
            sentiment="neutral",
            source="test",
        )
    )
    db.add(
        MarketSentimentSnapshot(
            trade_date=date(2026, 5, 29),
            is_trading_day=True,
            up_count=100,
            down_count=80,
            flat_count=20,
            limit_up=3,
            limit_down=1,
            total_volume_billion=Decimal("1234.56"),
            sentiment="neutral",
            source="test",
        )
    )
    db.commit()

    monkeypatch.setattr(sentiment, "current_market_date", lambda db, now=None: date(2026, 5, 29))
    monkeypatch.setattr(
        sentiment,
        "_fetch_sentiment_payload",
        lambda trade_date: (_ for _ in ()).throw(AssertionError("should not fetch from read path")),
    )

    result = sentiment.get_market_sentiment(db)

    assert result["date"] == "2026-05-29"
    assert result["up_count"] == 100


def test_get_market_sentiment_returns_empty_local_payload(db, monkeypatch):
    monkeypatch.setattr(sentiment, "current_market_date", lambda db, now=None: date(2026, 5, 29))
    monkeypatch.setattr(
        sentiment,
        "_fetch_sentiment_payload",
        lambda trade_date: (_ for _ in ()).throw(AssertionError("should not fetch from read path")),
    )

    result = sentiment.get_market_sentiment(db)

    assert result["date"] == "2026-05-29"
    assert result["update_available"] is True
    assert "暂无本地盘面数据" in result["note"]
    assert db.query(MarketSentimentSnapshot).filter_by(trade_date=date(2026, 5, 29)).count() == 0


def test_get_market_sentiment_marks_update_available_for_new_trade_date(db, monkeypatch):
    db.add(
        MarketSentimentSnapshot(
            trade_date=date(2026, 5, 29),
            is_trading_day=True,
            up_count=2500,
            down_count=1700,
            flat_count=200,
            limit_up=60,
            limit_down=15,
            total_volume_billion=Decimal("10000.00"),
            sentiment="bullish",
            source="tushare",
        )
    )
    db.add(
        MarketDailyBar(
            instrument_type="stock",
            ts_code="000001.SZ",
            trade_date=date(2026, 5, 29),
            close=Decimal("10"),
            source="test",
        )
    )
    db.commit()

    monkeypatch.setattr(sentiment, "current_market_date", lambda db, now=None: date(2026, 6, 1))
    result = sentiment.get_market_sentiment(db)
    assert result["date"] == "2026-05-29"
    assert result["is_trading_day"] is True
    assert result["update_available"] is True
    assert result["update_target_date"] == "2026-06-01"
    assert "拉取最新数据" in (result.get("note") or "")


class _SessionContext:
    def __init__(self, db):
        self.db = db

    def __enter__(self):
        return self.db

    def __exit__(self, exc_type, exc, tb):
        return False


def test_startup_sentiment_initialization_skips_when_any_snapshot_exists(db, monkeypatch):
    db.add(
        MarketSentimentSnapshot(
            trade_date=date(2026, 5, 28),
            is_trading_day=True,
            up_count=1000,
            down_count=900,
            flat_count=100,
            limit_up=20,
            limit_down=5,
            total_volume_billion=Decimal("8000.00"),
            sentiment="neutral",
            source="test",
        )
    )
    db.commit()

    monkeypatch.setattr(sentiment, "SessionLocal", lambda: _SessionContext(db))
    monkeypatch.setattr(sentiment, "latest_market_date", lambda today=None: date(2026, 5, 29))
    monkeypatch.setattr(
        sentiment,
        "fetch_and_store_market_sentiment",
        lambda db, trade_date: (_ for _ in ()).throw(AssertionError("should not fetch on startup when cached")),
    )

    sentiment.ensure_startup_market_sentiment_snapshot()


def test_startup_sentiment_initialization_fetches_current_date_for_empty_cache(db, monkeypatch):
    fetched_dates = []

    def fake_fetch(db, trade_date):
        fetched_dates.append(trade_date)
        snapshot = MarketSentimentSnapshot(
            trade_date=trade_date,
            is_trading_day=True,
            up_count=1200,
            down_count=800,
            flat_count=50,
            limit_up=30,
            limit_down=4,
            total_volume_billion=Decimal("9000.00"),
            sentiment="bullish",
            source="test",
        )
        db.add(snapshot)
        return snapshot

    monkeypatch.setattr(sentiment, "SessionLocal", lambda: _SessionContext(db))
    monkeypatch.setattr(sentiment, "latest_market_date", lambda today=None: date(2026, 5, 29))
    monkeypatch.setattr(sentiment, "fetch_and_store_market_sentiment", fake_fetch)

    sentiment.ensure_startup_market_sentiment_snapshot()

    assert fetched_dates == [date(2026, 5, 29)]
    assert db.query(MarketSentimentSnapshot).filter_by(trade_date=date(2026, 5, 29)).count() == 1
