"""行情日期口径：同步目标日、上一交易日、未收盘判断。"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models.market_cache import TradingCalendarDay
from app.services.market import MarketDataProvider

CN_TZ = ZoneInfo("Asia/Shanghai")
# 与 sentiment.COLLECT_AT 对齐：TuShare 日线通常在收盘后可用
MARKET_DATA_READY_AT = (16, 10)


def is_before_market_data_ready(now: datetime | None = None) -> bool:
    """当日 A 股日线尚未就绪（未收盘 / 未到采集时间）。"""
    now = now or datetime.now(CN_TZ)
    if now.weekday() >= 5:
        return False
    ready = now.replace(hour=MARKET_DATA_READY_AT[0], minute=MARKET_DATA_READY_AT[1], second=0, microsecond=0)
    return now < ready


def previous_trading_day(db: Session, before: date) -> date:
    """返回 before 之前的最近一个交易日（优先本地日历，回退工作日）。"""
    provider = MarketDataProvider(db)
    lookback_start = before - timedelta(days=14)
    end = before - timedelta(days=1)
    days = provider.trade_cal_no_remote(lookback_start, end)
    if days:
        return days[-1]
    d = end
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


def _calendar_day(db: Session, day: date) -> TradingCalendarDay | None:
    return (
        db.query(TradingCalendarDay)
        .filter(
            TradingCalendarDay.exchange == "SSE",
            TradingCalendarDay.cal_date == day,
        )
        .one_or_none()
    )


def syncable_market_end(db: Session, now: datetime | None = None) -> tuple[date, str | None]:
    """返回 (同步目标日, 跳过今日原因)。

    未收盘时目标日为上一交易日，并给出可读说明。
    周末目标日为最近周五。
    """
    now = now or datetime.now(CN_TZ)
    today = now.date()

    # 先看本地交易日历：若今天已明确休市（节假日/周末），直接回退上一交易日。
    cal = _calendar_day(db, today)
    if cal is not None and not cal.is_open:
        prev = previous_trading_day(db, today)
        reason = f"今日休市，已同步至上一交易日 {prev.isoformat()}"
        return prev, reason

    if today.weekday() >= 5:
        # 周末兜底：最近周五
        friday = today - timedelta(days=today.weekday() - 4)
        reason = f"今日休市，已同步至上一交易日 {friday.isoformat()}"
        return friday, reason

    if is_before_market_data_ready(now):
        prev = previous_trading_day(db, today)
        time_str = now.strftime("%H:%M")
        ready_str = f"{MARKET_DATA_READY_AT[0]:02d}:{MARKET_DATA_READY_AT[1]:02d}"
        reason = (
            f"今日日线数据尚未就绪（A 股 15:00 收盘，数据约 {ready_str} 可下载，当前 {time_str}）；"
            f"已同步至上一交易日 {prev.isoformat()}"
        )
        return prev, reason

    return today, None


def current_market_date(db: Session, now: datetime | None = None) -> date:
    """返回页面应视为“当前交易日”的日期；不按收盘时间回退。"""
    now = now or datetime.now(CN_TZ)
    today = now.date()

    cal = _calendar_day(db, today)
    if cal is not None:
        if cal.is_open:
            return today
        return previous_trading_day(db, today)

    if today.weekday() >= 5:
        return today - timedelta(days=today.weekday() - 4)

    return today
