"""行情同步：所有拉取由页面按钮触发，业务层只读本地。

- 「拉取最新行情」→ sync_latest：按交易日 daily(trade_date) 增量补全市场当日（DB 最新日期 → 今天）
- 「全量历史初始化」→ start_full_history：后台逐只 daily(ts_code) 拉 23 年历史，
  全部股票落完才算「拥有全量历史」；带进度、可断点续传、可取消。
- 不做启动自动同步、不做 16:10 定时、不做导入自动预拉。
"""
from __future__ import annotations

import logging
import threading
import time
from datetime import date, datetime, timedelta

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.models.market_cache import MarketDailyBar, MarketSyncState, StockListItem
from app.services.market import INDEX, MarketDataProvider, STOCK
from app.services.pnl import DEFAULT_BENCHMARKS
from app.services.sentiment import fetch_and_store_market_sentiment, latest_market_date

logger = logging.getLogger("tradingreview.market_sync")

SYNC_PAUSE_SEC = 0.15
# 低于此条数视为该交易日尚未做全市场同步
MIN_ROWS_PER_SYNCED_DAY = 500
# 每只股票全量历史起点（沪市开市日；TuShare 自动只返回该股实际存在的数据）
FULL_HISTORY_START = date(1990, 12, 19)
FULL_HISTORY_KEY = "full_history"

# 后台全量任务的进程内句柄
_full_history_thread: threading.Thread | None = None
_full_history_cancel = threading.Event()
_full_history_lock = threading.Lock()


# ── 工具 ────────────────────────────────────────────────────

def _as_date(value) -> date | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _max_stock_bar_date(db: Session) -> date | None:
    return _as_date(
        db.query(func.max(MarketDailyBar.trade_date))
        .filter(MarketDailyBar.instrument_type == STOCK)
        .scalar()
    )


def _is_trade_date_fully_synced(db: Session, trade_date: date) -> bool:
    cnt = (
        db.query(func.count(MarketDailyBar.id))
        .filter(
            MarketDailyBar.instrument_type == STOCK,
            MarketDailyBar.trade_date == trade_date,
        )
        .scalar()
        or 0
    )
    return cnt >= MIN_ROWS_PER_SYNCED_DAY


def business_data_start(db: Session) -> date:
    """全量历史起点 = 最早成交日；无成交则回退近 1 年。"""
    min_trade = _as_date(db.execute(text("SELECT MIN(trade_date) FROM trades")).scalar())
    min_flow = _as_date(db.execute(text("SELECT MIN(flow_date) FROM cash_flows")).scalar())
    candidates = [d for d in (min_trade, min_flow) if d]
    if candidates:
        return min(candidates)
    return date.today() - timedelta(days=365)


# ── 股票日线 ─────────────────────────────────────────────────

def sync_stock_daily_for_trade_date(db: Session, trade_date: date) -> int:
    if _is_trade_date_fully_synced(db, trade_date):
        return 0
    return MarketDataProvider(db).ingest_stock_daily_by_trade_date(trade_date)


def backfill_stock_daily_range(db: Session, start: date, end: date, *, pause_sec: float = SYNC_PAUSE_SEC) -> int:
    """按交易日补齐 [start, end] 内缺失的全市场日线。返回新同步交易日数。"""
    provider = MarketDataProvider(db)
    provider.ensure_trade_calendar(start, end)
    synced_days = 0
    for trade_date in provider.trade_cal(start, end):
        if _is_trade_date_fully_synced(db, trade_date):
            continue
        try:
            if sync_stock_daily_for_trade_date(db, trade_date) > 0:
                synced_days += 1
                logger.info("Synced stock daily %s", trade_date.isoformat())
        except Exception as exc:
            logger.warning("Sync stock daily %s failed: %s", trade_date.isoformat(), exc)
        time.sleep(pause_sec)
    return synced_days


# ── 指数日线 ─────────────────────────────────────────────────

def sync_index_daily_range(db: Session, start: date, end: date) -> int:
    provider = MarketDataProvider(db)
    total = 0
    for index_code, name in DEFAULT_BENCHMARKS:
        try:
            n = provider.ingest_index_daily_range(index_code, start, end)
            if n:
                total += n
                logger.info("Synced index %s (%s): %s rows", index_code, name, n)
        except Exception as exc:
            logger.warning("Sync index %s failed: %s", index_code, exc)
        time.sleep(SYNC_PAUSE_SEC)
    return total


def sync_index_daily_incremental(db: Session) -> int:
    end = latest_market_date()
    total = 0
    for index_code, _ in DEFAULT_BENCHMARKS:
        max_row = _as_date(
            db.query(func.max(MarketDailyBar.trade_date))
            .filter(MarketDailyBar.instrument_type == INDEX, MarketDailyBar.ts_code == index_code)
            .scalar()
        )
        start = (max_row + timedelta(days=1)) if max_row else business_data_start(db)
        if start <= end:
            total += sync_index_daily_range(db, start, end)
    return total


# ── 交易日历（与 daily 一致：初始化全量 + 后续增量） ──────────

def sync_calendar_range(db: Session, start: date, end: date, exchange: str = "SSE") -> int:
    """强制拉取 [start, end] 全部自然日历并落库，返回落库自然日数。"""
    try:
        return MarketDataProvider(db).ingest_trade_calendar_range(start, end, exchange)
    except Exception as exc:
        logger.warning("Sync trade calendar %s~%s failed: %s", start, end, exc)
        return 0


def sync_calendar_incremental(db: Session, exchange: str = "SSE") -> int:
    """从本地最大 cal_date 的次日 → 今天 增量补交易日历。"""
    provider = MarketDataProvider(db)
    end = date.today()
    max_cal = provider.max_calendar_date(exchange)
    start = (max_cal + timedelta(days=1)) if max_cal else business_data_start(db)
    if start > end:
        return 0
    return sync_calendar_range(db, start, end, exchange)


# ── 情绪快照（涨跌停仍走 akshare，结果落库） ──────────────────

def _refresh_latest_sentiment(db: Session) -> None:
    try:
        fetch_and_store_market_sentiment(db, latest_market_date())
    except Exception as exc:
        logger.warning("Refresh latest sentiment failed: %s", exc)


# ── 拉取最新行情（按交易日全市场增量） ───────────────────────

def sync_latest(db: Session) -> dict:
    """「拉取最新行情」：DB 最新日期 +1 → 今天 增量同步交易日历 + 股票 + 指数，并刷新当日情绪。"""
    # 交易日历先增量，保证后续按交易日补数走的是真实日历
    calendar_days = sync_calendar_incremental(db)

    end = latest_market_date()
    max_d = _max_stock_bar_date(db)
    start = (max_d + timedelta(days=1)) if max_d else business_data_start(db)

    synced_days = 0
    if start <= end:
        synced_days = backfill_stock_daily_range(db, start, end)
    index_rows = sync_index_daily_incremental(db)
    _refresh_latest_sentiment(db)

    return {
        "ok": True,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "calendar_days": calendar_days,
        "synced_days": synced_days,
        "index_rows": index_rows,
        "max_date": (_max_stock_bar_date(db) or end).isoformat(),
    }


# ── 全量历史初始化（后台逐只 + 进度 + 续传 + 取消） ───────────

def _get_state(db: Session) -> MarketSyncState | None:
    return (
        db.query(MarketSyncState)
        .filter(MarketSyncState.key == FULL_HISTORY_KEY)
        .one_or_none()
    )


def _set_state(db: Session, *, status: str, current_code: str | None = None,
               message: str | None = None, mark_started: bool = False,
               mark_finished: bool = False) -> None:
    state = _get_state(db)
    if state is None:
        state = MarketSyncState(key=FULL_HISTORY_KEY)
        db.add(state)
    state.status = status
    state.current_code = current_code
    state.message = message
    state.updated_at = datetime.utcnow()
    if mark_started:
        state.started_at = datetime.utcnow()
        state.finished_at = None
    if mark_finished:
        state.finished_at = datetime.utcnow()
    db.commit()


def _thread_alive() -> bool:
    return _full_history_thread is not None and _full_history_thread.is_alive()


def get_full_history_status(db: Session) -> dict:
    """全量历史进度：以 stock_list 的 done/total 判断是否拥有全量历史。"""
    total = db.query(func.count(StockListItem.id)).scalar() or 0
    done = (
        db.query(func.count(StockListItem.id))
        .filter(StockListItem.full_history_synced.is_(True))
        .scalar()
        or 0
    )
    min_d = _as_date(
        db.query(func.min(MarketDailyBar.trade_date))
        .filter(MarketDailyBar.instrument_type == STOCK)
        .scalar()
    )
    max_d = _max_stock_bar_date(db)
    bar_count = (
        db.query(func.count(MarketDailyBar.id))
        .filter(MarketDailyBar.instrument_type == STOCK)
        .scalar()
        or 0
    )

    failed = (
        db.query(func.count(StockListItem.id))
        .filter(
            StockListItem.full_history_synced.is_(False),
            StockListItem.last_error.isnot(None),
        )
        .scalar()
        or 0
    )

    state = _get_state(db)
    raw_status = state.status if state else "idle"
    alive = _thread_alive()
    # running 但线程已死（如服务重启）→ 视为中断，可续传
    if raw_status == "running" and not alive:
        status = "interrupted"
    else:
        status = raw_status

    has_data = total > 0 and done >= total and status not in ("running", "interrupted")

    return {
        "has_data": has_data,
        "status": status,
        "running": status == "running",
        "total": int(total),
        "done": int(done),
        "failed": int(failed),
        "current_code": state.current_code if state else None,
        "message": state.message if state else None,
        "min_date": min_d.isoformat() if min_d else None,
        "max_date": max_d.isoformat() if max_d else None,
        "bar_count": int(bar_count),
    }


def start_full_history() -> dict:
    """启动后台全量历史任务（已在跑则返回当前状态）。"""
    global _full_history_thread
    with _full_history_lock:
        if _thread_alive():
            with SessionLocal() as db:
                return get_full_history_status(db)
        _full_history_cancel.clear()
        _full_history_thread = threading.Thread(
            target=_run_full_history, name="full-history-sync", daemon=True
        )
        _full_history_thread.start()
    with SessionLocal() as db:
        return get_full_history_status(db)


def cancel_full_history() -> dict:
    """请求取消后台全量历史任务（当前股票拉完后停止，已完成的不回退）。"""
    _full_history_cancel.set()
    with SessionLocal() as db:
        return get_full_history_status(db)


def _run_full_history() -> None:
    with SessionLocal() as db:
        try:
            _set_state(db, status="running", message="刷新股票清单…", mark_started=True)

            # 1) 股票清单：每次刷新 stock_basic（补新股，不回退已完成标记）
            provider = MarketDataProvider(db)
            provider.ingest_stock_basic(list_status="L")

            # 2) 交易日历全量（一次调用覆盖全历史）
            _set_state(db, status="running", message="同步交易日历…")
            sync_calendar_range(db, FULL_HISTORY_START, date.today())

            # 3) 逐只拉历史（断点续传/修复：处理未完成的）
            pending = [
                r[0]
                for r in db.query(StockListItem.ts_code)
                .filter(StockListItem.full_history_synced.is_(False))
                .order_by(StockListItem.ts_code)
                .all()
            ]
            for ts_code in pending:
                if _full_history_cancel.is_set():
                    _set_state(db, status="cancelled", message="已取消，可继续", mark_finished=True)
                    return
                item = (
                    db.query(StockListItem)
                    .filter(StockListItem.ts_code == ts_code)
                    .first()
                )
                try:
                    provider.ingest_stock_daily_history(ts_code, FULL_HISTORY_START, date.today())
                    if item:
                        item.full_history_synced = True
                        item.last_error = None
                        item.last_synced_date = date.today()
                        item.synced_at = datetime.utcnow()
                        db.commit()
                    _set_state(db, status="running", current_code=ts_code, message=None)
                except Exception as exc:
                    db.rollback()
                    logger.warning("Full history for %s failed: %s", ts_code, exc)
                    if item:
                        item.last_error = str(exc)[:300]
                        db.commit()
                time.sleep(SYNC_PAUSE_SEC)

            # 4) 指数全量 + 当日情绪
            _set_state(db, status="running", message="同步指数与情绪…")
            sync_index_daily_range(db, FULL_HISTORY_START, date.today())
            _refresh_latest_sentiment(db)

            _set_state(db, status="complete", message="全量历史已完成", mark_finished=True)
        except Exception as exc:
            logger.exception("Full history run failed")
            try:
                _set_state(db, status="error", message=str(exc)[:200], mark_finished=True)
            except Exception:
                pass
