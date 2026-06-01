from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.models.market_cache import TradingCalendarDay
from app.services.market_dates import current_market_date, is_before_market_data_ready, syncable_market_end

CN_TZ = ZoneInfo("Asia/Shanghai")


def test_is_before_market_data_ready_on_morning():
    now = datetime(2026, 6, 1, 9, 30, tzinfo=CN_TZ)
    assert is_before_market_data_ready(now) is True


def test_is_before_market_data_ready_after_close():
    now = datetime(2026, 6, 1, 16, 30, tzinfo=CN_TZ)
    assert is_before_market_data_ready(now) is False


def test_syncable_market_end_before_close(db):
    now = datetime(2026, 6, 1, 9, 30, tzinfo=CN_TZ)
    end, reason = syncable_market_end(db, now)
    assert end == date(2026, 5, 29)
    assert reason is not None
    assert "尚未收盘" in reason
    assert "2026-05-29" in reason


def test_syncable_market_end_after_close(db):
    now = datetime(2026, 6, 1, 17, 0, tzinfo=CN_TZ)
    end, reason = syncable_market_end(db, now)
    assert end == date(2026, 6, 1)
    assert reason is None


def test_syncable_market_end_weekend(db):
    now = datetime(2026, 5, 30, 10, 0, tzinfo=CN_TZ)
    end, reason = syncable_market_end(db, now)
    assert end == date(2026, 5, 29)
    assert reason is not None
    assert "今日休市" in reason


def test_syncable_market_end_holiday(db):
    db.add(
        TradingCalendarDay(
            exchange="SSE",
            cal_date=date(2026, 10, 1),
            is_open=False,
            source="test",
        )
    )
    db.add(
        TradingCalendarDay(
            exchange="SSE",
            cal_date=date(2026, 9, 30),
            is_open=True,
            source="test",
        )
    )
    db.commit()

    now = datetime(2026, 10, 1, 18, 0, tzinfo=CN_TZ)
    end, reason = syncable_market_end(db, now)
    assert end == date(2026, 9, 30)
    assert reason is not None
    assert "今日休市" in reason


def test_current_market_date_uses_today_before_close(db):
    now = datetime(2026, 6, 1, 9, 30, tzinfo=CN_TZ)
    assert current_market_date(db, now) == date(2026, 6, 1)


def test_current_market_date_uses_previous_day_on_holiday(db):
    db.add(
        TradingCalendarDay(
            exchange="SSE",
            cal_date=date(2026, 10, 1),
            is_open=False,
            source="test",
        )
    )
    db.add(
        TradingCalendarDay(
            exchange="SSE",
            cal_date=date(2026, 9, 30),
            is_open=True,
            source="test",
        )
    )
    db.commit()

    now = datetime(2026, 10, 1, 9, 30, tzinfo=CN_TZ)
    assert current_market_date(db, now) == date(2026, 9, 30)
