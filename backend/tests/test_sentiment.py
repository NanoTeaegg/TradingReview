from datetime import date
from decimal import Decimal

from app.models.market_cache import MarketSentimentSnapshot
from app.services import sentiment


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

    monkeypatch.setattr(sentiment, "latest_market_date", lambda today=None: date(2026, 5, 29))
    monkeypatch.setattr(
        sentiment,
        "_fetch_sentiment_payload",
        lambda trade_date: (_ for _ in ()).throw(AssertionError("should not fetch when cached")),
    )

    result = sentiment.get_market_sentiment(db)

    assert result["date"] == "2026-05-29"
    assert result["up_count"] == 3000
    assert result["total_volume_billion"] == 9288.5


def test_get_market_sentiment_fetches_and_stores_missing_snapshot(db, monkeypatch):
    monkeypatch.setattr(sentiment, "latest_market_date", lambda today=None: date(2026, 5, 29))
    monkeypatch.setattr(
        sentiment,
        "_fetch_sentiment_payload",
        lambda trade_date: {
            "date": trade_date.isoformat(),
            "is_trading_day": True,
            "up_count": 100,
            "down_count": 80,
            "flat_count": 20,
            "limit_up": 3,
            "limit_down": 1,
            "total_volume_billion": Decimal("1234.56"),
            "sentiment": "neutral",
            "source": "test",
        },
    )

    result = sentiment.get_market_sentiment(db)

    assert result["date"] == "2026-05-29"
    assert result["up_count"] == 100
    assert db.query(MarketSentimentSnapshot).filter_by(trade_date=date(2026, 5, 29)).count() == 1


def test_get_market_sentiment_does_not_store_failed_fetch(db, monkeypatch):
    monkeypatch.setattr(sentiment, "latest_market_date", lambda today=None: date(2026, 5, 29))
    monkeypatch.setattr(
        sentiment,
        "_fetch_sentiment_payload",
        lambda trade_date: {
            "date": trade_date.isoformat(),
            "is_trading_day": False,
            "up_count": 0,
            "down_count": 0,
            "flat_count": 0,
            "limit_up": 0,
            "limit_down": 0,
            "total_volume_billion": Decimal("0.00"),
            "sentiment": "neutral",
            "source": "none",
            "note": "数据获取失败",
        },
    )

    result = sentiment.get_market_sentiment(db)

    assert result["note"] == "数据获取失败"
    assert db.query(MarketSentimentSnapshot).filter_by(trade_date=date(2026, 5, 29)).count() == 0


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
