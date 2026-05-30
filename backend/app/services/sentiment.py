import asyncio
import logging
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import SessionLocal
from app.models.market_cache import MarketSentimentSnapshot

logger = logging.getLogger("tradingreview.sentiment")

CN_TZ = ZoneInfo("Asia/Shanghai")
COLLECT_AT = time(16, 10)
STARTUP_BACKFILL_DAYS = 30


def get_market_sentiment(db: Session) -> dict:
    """Return the latest target sentiment snapshot, filling it when missing."""
    target_date = latest_market_date()
    snapshot = _get_snapshot(db, target_date)
    if snapshot is None:
        snapshot = fetch_and_store_market_sentiment(db, target_date)
    return _snapshot_to_dict(snapshot)


def latest_market_date(today: date | None = None) -> date:
    """Return the market date the UI should display.

    Weekends show the most recent Friday. Holiday handling can be added later
    through the exchange calendar already wrapped by MarketDataProvider.
    """
    current = today or datetime.now(CN_TZ).date()
    if current.weekday() == 5:
        return current - timedelta(days=1)
    if current.weekday() == 6:
        return current - timedelta(days=2)
    return current


def ensure_startup_market_sentiment_snapshot() -> None:
    """Initialize sentiment once for an empty cache.

    Local development restarts should not spend market data API quota when the
    snapshot table already has data. The scheduled collector remains
    responsible for refreshing future dates while the server is running.
    """
    target_date = latest_market_date()
    with SessionLocal() as db:
        if _has_any_snapshot(db):
            return
        try:
            fetch_and_store_market_sentiment(db, target_date)
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.warning("Startup market sentiment initialization failed: %s", exc)


def ensure_recent_market_sentiment_snapshots(days: int = STARTUP_BACKFILL_DAYS) -> None:
    """Best-effort date range backfill.

    Historical breadth is fetched through TuShare when available. Without a
    TuShare token, only the current target date is safe to fill via akshare's
    realtime snapshot; older dates are left missing rather than mislabeling
    realtime data as history.
    """
    today = datetime.now(CN_TZ).date()
    start = today - timedelta(days=days)
    dates = _business_days(start, latest_market_date(today))
    with SessionLocal() as db:
        for trade_date in dates:
            if _get_snapshot(db, trade_date) is not None:
                continue
            if not settings.TUSHARE_API_KEY and trade_date != latest_market_date(today):
                continue
            try:
                fetch_and_store_market_sentiment(db, trade_date)
                db.commit()
            except Exception as exc:
                db.rollback()
                logger.warning("Backfill market sentiment for %s failed: %s", trade_date, exc)


def fetch_and_store_market_sentiment(db: Session, trade_date: date) -> MarketSentimentSnapshot:
    existing = _get_snapshot(db, trade_date)
    if existing is not None:
        return existing

    payload = _fetch_sentiment_payload(trade_date)
    snapshot = MarketSentimentSnapshot(
        trade_date=trade_date,
        is_trading_day=payload["is_trading_day"],
        up_count=payload["up_count"],
        down_count=payload["down_count"],
        flat_count=payload["flat_count"],
        limit_up=payload["limit_up"],
        limit_down=payload["limit_down"],
        total_volume_billion=payload["total_volume_billion"],
        sentiment=payload["sentiment"],
        source=payload["source"],
        note=payload.get("note"),
    )
    if payload["source"] == "none":
        return snapshot
    db.add(snapshot)
    db.flush()
    db.commit()
    return snapshot


async def run_market_sentiment_scheduler(stop_event: asyncio.Event) -> None:
    """Run an in-process daily collector while FastAPI is alive."""
    while not stop_event.is_set():
        now = datetime.now(CN_TZ)
        next_run = datetime.combine(now.date(), COLLECT_AT, tzinfo=CN_TZ)
        if now >= next_run:
            next_run += timedelta(days=1)
        wait_seconds = max((next_run - now).total_seconds(), 1)
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=wait_seconds)
        except asyncio.TimeoutError:
            if latest_market_date() != datetime.now(CN_TZ).date():
                continue
            try:
                ensure_recent_market_sentiment_snapshots(days=1)
            except Exception as exc:
                logger.warning("Scheduled market sentiment collection failed: %s", exc)


def _fetch_sentiment_payload(trade_date: date) -> dict:
    # 涨跌家数/成交额属落库数据，统一走 TuShare daily；不再用 akshare 实时回退。
    try:
        return _fetch_tushare_daily_sentiment(trade_date)
    except Exception as exc:
        logger.warning("TuShare sentiment fetch for %s failed: %s", trade_date, exc)

    return _empty_sentiment(trade_date, "数据获取失败")


def _fetch_tushare_daily_sentiment(trade_date: date) -> dict:
    if not settings.TUSHARE_API_KEY:
        raise RuntimeError("TUSHARE_API_KEY is not configured")

    import tushare as ts

    pro = ts.pro_api(settings.TUSHARE_API_KEY)
    df = pro.daily(trade_date=trade_date.strftime("%Y%m%d"))
    if df is None or df.empty:
        raise RuntimeError("empty TuShare daily result")

    change_col = "pct_chg" if "pct_chg" in df.columns else "change"
    up = int((df[change_col] > 0).sum()) if change_col in df.columns else 0
    down = int((df[change_col] < 0).sum()) if change_col in df.columns else 0
    flat = int((df[change_col] == 0).sum()) if change_col in df.columns else 0

    total_vol = Decimal("0")
    if "amount" in df.columns:
        total_vol = Decimal(str(df["amount"].sum())) / Decimal("100000")

    limit_up, limit_down = _fetch_limit_counts(trade_date)
    return _build_payload(
        trade_date=trade_date,
        up=up,
        down=down,
        flat=flat,
        limit_up=limit_up,
        limit_down=limit_down,
        total_volume_billion=total_vol,
        source="tushare",
    )


def _fetch_limit_counts(trade_date: date) -> tuple[int, int]:
    # 涨停/跌停榜单 TuShare 需 5000 积分，120 积分账户无法调用，
    # 经确认此项保留 akshare（结果仍落库到情绪快照）。
    import akshare as ak

    trade_date_text = trade_date.strftime("%Y%m%d")
    limit_up = 0
    limit_down = 0
    try:
        limit_up_df = ak.stock_zt_pool_em(date=trade_date_text)
        if limit_up_df is not None:
            limit_up = len(limit_up_df)
    except Exception as exc:
        logger.warning("akshare limit-up fetch for %s failed: %s", trade_date, exc)

    try:
        limit_down_df = ak.stock_dt_pool_em(date=trade_date_text)
        if limit_down_df is not None:
            limit_down = len(limit_down_df)
    except Exception as exc:
        logger.warning("akshare limit-down fetch for %s failed: %s", trade_date, exc)

    return limit_up, limit_down


def _build_payload(
    *,
    trade_date: date,
    up: int,
    down: int,
    flat: int,
    limit_up: int,
    limit_down: int,
    total_volume_billion: Decimal,
    source: str,
) -> dict:
    ratio = up / down if down > 0 else float("inf")
    if ratio > 1.5:
        sentiment = "bullish"
    elif ratio < 0.7:
        sentiment = "bearish"
    else:
        sentiment = "neutral"

    return {
        "date": trade_date.isoformat(),
        "is_trading_day": True,
        "up_count": up,
        "down_count": down,
        "flat_count": flat,
        "limit_up": limit_up,
        "limit_down": limit_down,
        "total_volume_billion": total_volume_billion.quantize(Decimal("0.01")),
        "sentiment": sentiment,
        "source": source,
    }


def _empty_sentiment(trade_date: date, note: str) -> dict:
    return {
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
        "note": note,
    }


def _get_snapshot(db: Session, trade_date: date) -> MarketSentimentSnapshot | None:
    return (
        db.query(MarketSentimentSnapshot)
        .filter(MarketSentimentSnapshot.trade_date == trade_date)
        .one_or_none()
    )


def _has_any_snapshot(db: Session) -> bool:
    return db.query(MarketSentimentSnapshot.id).first() is not None


def _snapshot_to_dict(snapshot: MarketSentimentSnapshot) -> dict:
    return {
        "date": snapshot.trade_date.isoformat(),
        "is_trading_day": snapshot.is_trading_day,
        "up_count": snapshot.up_count,
        "down_count": snapshot.down_count,
        "flat_count": snapshot.flat_count,
        "limit_up": snapshot.limit_up,
        "limit_down": snapshot.limit_down,
        "total_volume_billion": float(snapshot.total_volume_billion),
        "sentiment": snapshot.sentiment,
        "note": snapshot.note,
    }


def _business_days(start: date, end: date) -> list[date]:
    days = []
    cur = start
    while cur <= end:
        if cur.weekday() < 5:
            days.append(cur)
        cur += timedelta(days=1)
    return days
