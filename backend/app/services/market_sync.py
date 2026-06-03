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
from app.models.market_cache import MarketDailyBar, MarketSyncState, StockListItem, TradingCalendarDay
from app.services.market import INDEX, MarketDataProvider, STOCK
from app.services.pnl import DEFAULT_BENCHMARKS
from app.services.market_dates import syncable_market_end
from app.services.sentiment import fetch_and_store_market_sentiment, latest_market_date

logger = logging.getLogger("tradingreview.market_sync")

SYNC_PAUSE_SEC = 0.15
# 低于此条数视为该交易日尚未做全市场同步
MIN_ROWS_PER_SYNCED_DAY = 500
# 每只股票全量历史起点（沪市开市日；TuShare 自动只返回该股实际存在的数据）
FULL_HISTORY_START = date(1990, 12, 19)
FULL_HISTORY_KEY = "full_history"
LATEST_SYNC_KEY = "latest_sync"

# 后台全量任务的进程内句柄
_full_history_thread: threading.Thread | None = None
_full_history_cancel = threading.Event()
_full_history_lock = threading.Lock()

# 后台「拉取最新行情」任务的进程内句柄
_latest_sync_thread: threading.Thread | None = None
_latest_sync_lock = threading.Lock()


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


def backfill_stock_daily_range(
    db: Session,
    start: date,
    end: date,
    *,
    pause_sec: float = SYNC_PAUSE_SEC,
    use_local_calendar: bool = False,
) -> tuple[int, list[str]]:
    """按交易日补齐 [start, end] 内缺失的全市场日线。返回 (新同步交易日数, 警告列表)。"""
    provider = MarketDataProvider(db)
    if use_local_calendar:
        trade_dates = provider.trade_cal_no_remote(start, end)
    else:
        provider.ensure_trade_calendar(start, end)
        trade_dates = provider.trade_cal(start, end)

    synced_days = 0
    warnings: list[str] = []
    for trade_date in trade_dates:
        if _is_trade_date_fully_synced(db, trade_date):
            continue
        try:
            if sync_stock_daily_for_trade_date(db, trade_date) > 0:
                synced_days += 1
                logger.info("Synced stock daily %s", trade_date.isoformat())
            else:
                warnings.append(f"{trade_date.isoformat()} 无可用日线（可能尚未发布）")
        except Exception as exc:
            msg = f"{trade_date.isoformat()} 同步失败: {exc}"
            logger.warning("Sync stock daily %s failed: %s", trade_date.isoformat(), exc)
            warnings.append(msg)
        time.sleep(pause_sec)
    return synced_days, warnings


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


def sync_index_daily_incremental(db: Session, end: date | None = None) -> tuple[int, list[str]]:
    """增量补指数日线；限频失败时跳过并记录警告。"""
    end = end or latest_market_date()
    warnings: list[str] = []
    total = 0
    missing_indexes: list[tuple[str, str, date]] = []
    for index_code, name in DEFAULT_BENCHMARKS:
        max_row = _as_date(
            db.query(func.max(MarketDailyBar.trade_date))
            .filter(MarketDailyBar.instrument_type == INDEX, MarketDailyBar.ts_code == index_code)
            .scalar()
        )
        start = (max_row + timedelta(days=1)) if max_row else business_data_start(db)
        if start > end:
            continue
        missing_indexes.append((index_code, name, start))

    # 低积分 TuShare 账号的 index_daily 常见限制是 1次/小时或 5次/天。
    # 一轮只补一个缺口指数，避免成功一个后立刻请求下一只指数，白等 62s 后仍然撞限频。
    if len(missing_indexes) > 1:
        warnings.append("指数日线本轮仅补 1 个基准，剩余基准下次同步继续补齐")

    for index_code, name, start in missing_indexes[:1]:
        try:
            n = MarketDataProvider(db).ingest_index_daily_range(index_code, start, end)
            if n:
                total += n
                logger.info("Synced index %s (%s): %s rows", index_code, name, n)
        except Exception as exc:
            logger.warning("Sync index %s failed: %s", index_code, exc)
            # index_daily 在 120 积分账户为长周期限频（实测「1次/小时」「5次/天」等）：
            # 62s 节流无法规避，本轮拉不到就跳过其余基准（避免逐个再各等 62s），下一周期再补。
            msg = str(exc)
            if "频率超限" in msg and "分钟" not in msg:
                warnings.append("指数日线已达 TuShare 限频（小时/天级），本次跳过，稍后自动补齐")
                break
            warnings.append(f"指数 {name} 更新跳过: {exc}")
        time.sleep(SYNC_PAUSE_SEC)
    return total, warnings


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


def _min_stock_bar_date(db: Session) -> date | None:
    return _as_date(
        db.query(func.min(MarketDailyBar.trade_date))
        .filter(MarketDailyBar.instrument_type == STOCK)
        .scalar()
    )


def _build_sync_message(
    *,
    max_date: date | None,
    target_end: date,
    synced_days: int,
    skip_reason: str | None,
    warnings: list[str],
) -> str:
    latest = max_date.isoformat() if max_date else "—"
    if skip_reason and synced_days > 0:
        return f"{skip_reason}。本地最新日期：{latest}"
    if skip_reason and synced_days == 0 and max_date and max_date >= target_end:
        return f"{skip_reason}。交易数据已是最新（{latest}）"
    if skip_reason:
        return skip_reason
    if synced_days == 0 and max_date and max_date >= target_end:
        return f"交易数据已是最新（最新日期 {latest}）"
    if synced_days > 0:
        return f"已更新 {synced_days} 个交易日，本地最新日期：{latest}"
    if warnings:
        return f"未能更新日线，请稍后重试。本地最新日期：{latest}"
    return f"本地最新日期：{latest}"


# ── 拉取最新行情（按交易日全市场增量） ───────────────────────

def sync_latest(db: Session) -> dict:
    """「拉取最新行情」：先增量更新本地交易日历，再确定最近可同步交易日。

    先增量更新本地交易日历，再计算可同步目标日；
    核心只用 daily(trade_date) 拉全市场 A 股。
    未收盘时目标日回退至上一交易日，并在 message 中说明。
    指数增量可选、限频时跳过不影响股票结果。
    """
    calendar_days = sync_calendar_incremental(db)
    target_end, skip_reason = syncable_market_end(db)
    max_before = _max_stock_bar_date(db)
    start = (max_before + timedelta(days=1)) if max_before else business_data_start(db)

    synced_days = 0
    warnings: list[str] = []
    if start <= target_end:
        synced_days, stock_warnings = backfill_stock_daily_range(
            db, start, target_end, use_local_calendar=True
        )
        warnings.extend(stock_warnings)

    index_rows, index_warnings = sync_index_daily_incremental(db, target_end)
    warnings.extend(index_warnings)

    try:
        fetch_and_store_market_sentiment(db, target_end)
    except Exception as exc:
        logger.warning("Refresh latest sentiment failed: %s", exc)
        warnings.append(f"情绪快照未更新: {exc}")

    min_d = _min_stock_bar_date(db)
    max_d = _max_stock_bar_date(db)
    message = _build_sync_message(
        max_date=max_d,
        target_end=target_end,
        synced_days=synced_days,
        skip_reason=skip_reason,
        warnings=warnings,
    )

    return {
        "ok": synced_days > 0 or (max_d is not None and max_d >= target_end),
        "status": "skipped_today" if skip_reason else ("success" if synced_days > 0 else "up_to_date"),
        "message": message,
        "warnings": warnings,
        "calendar_days": calendar_days,
        "skipped_today": skip_reason is not None,
        "skip_reason": skip_reason,
        "start": start.isoformat(),
        "end": target_end.isoformat(),
        "target_end": target_end.isoformat(),
        "synced_days": synced_days,
        "index_rows": index_rows,
        "min_date": min_d.isoformat() if min_d else None,
        "max_date": max_d.isoformat() if max_d else None,
    }


# ── 「拉取最新行情」后台任务（避免同步阻塞顶穿前端超时） ──────

def _latest_sync_thread_alive() -> bool:
    return _latest_sync_thread is not None and _latest_sync_thread.is_alive()


def is_latest_sync_running() -> bool:
    return _latest_sync_thread_alive()


def get_latest_sync_status(db: Session) -> dict:
    """「拉取最新行情」后台任务进度，供前端轮询。"""
    state = _get_state(db, LATEST_SYNC_KEY)
    raw_status = state.status if state else "idle"
    alive = _latest_sync_thread_alive()
    # running 但线程已死（如服务重启）→ 视为中断，可重新触发
    status = "interrupted" if (raw_status == "running" and not alive) else raw_status

    return {
        "status": status,
        "running": status == "running",
        "message": state.message if state else None,
        "started_at": state.started_at.isoformat() if state and state.started_at else None,
        "finished_at": state.finished_at.isoformat() if state and state.finished_at else None,
    }


def start_latest_sync() -> dict:
    """启动后台「拉取最新行情」任务；已在跑则返回当前状态。

    立即返回，HTTP 请求不再随同步阻塞，避免 TuShare 限频 62s 退避顶穿前端超时。
    """
    global _latest_sync_thread
    with _latest_sync_lock:
        if _latest_sync_thread_alive():
            with SessionLocal() as db:
                return get_latest_sync_status(db)
        with SessionLocal() as db:
            _set_state(db, status="running", message="正在拉取最新行情…",
                       mark_started=True, key=LATEST_SYNC_KEY)
        _latest_sync_thread = threading.Thread(
            target=_run_latest_sync, name="latest-market-sync", daemon=True
        )
        _latest_sync_thread.start()
    with SessionLocal() as db:
        return get_latest_sync_status(db)


def _run_latest_sync() -> None:
    with SessionLocal() as db:
        try:
            result = sync_latest(db)
            status = "error" if result.get("ok") is False else "complete"
            _set_state(db, status=status, message=result.get("message"),
                       mark_finished=True, key=LATEST_SYNC_KEY)
        except Exception as exc:
            logger.exception("Latest market sync run failed")
            try:
                _set_state(db, status="error", message=str(exc)[:200],
                           mark_finished=True, key=LATEST_SYNC_KEY)
            except Exception:
                pass


# ── 全量历史初始化（后台逐只 + 进度 + 续传 + 取消） ───────────

def _get_state(db: Session, key: str = FULL_HISTORY_KEY) -> MarketSyncState | None:
    return (
        db.query(MarketSyncState)
        .filter(MarketSyncState.key == key)
        .one_or_none()
    )


def _set_state(db: Session, *, status: str, current_code: str | None = None,
               message: str | None = None, mark_started: bool = False,
               mark_finished: bool = False, key: str = FULL_HISTORY_KEY) -> None:
    state = _get_state(db, key)
    if state is None:
        state = MarketSyncState(key=key)
        db.add(state)
    state.status = status
    state.current_code = current_code
    state.message = message[:200] if message else message
    state.updated_at = datetime.utcnow()
    if mark_started:
        state.started_at = datetime.utcnow()
        state.finished_at = None
    if mark_finished:
        state.finished_at = datetime.utcnow()
    db.commit()


def _thread_alive() -> bool:
    return _full_history_thread is not None and _full_history_thread.is_alive()


def is_full_history_running() -> bool:
    return _thread_alive()


def _has_complete_full_history(db: Session) -> bool:
    total = db.query(func.count(StockListItem.id)).scalar() or 0
    if total <= 0:
        return False
    done = (
        db.query(func.count(StockListItem.id))
        .filter(StockListItem.full_history_synced.is_(True))
        .scalar()
        or 0
    )
    return done >= total


def ensure_trade_calendar_bootstrap() -> None:
    """启动阶段初始化交易日历：仅当本地日历为空时，从远端全量初始化一次。"""
    with SessionLocal() as db:
        calendar_count = db.query(func.count(TradingCalendarDay.id)).scalar() or 0
        if calendar_count > 0:
            return
        logger.info("Bootstrap trading calendar from TuShare: %s -> %s", FULL_HISTORY_START, date.today())
        sync_calendar_range(db, FULL_HISTORY_START, date.today())


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
    }


def start_full_history() -> dict:
    """启动后台全量历史任务（已在跑则返回当前状态）。"""
    global _full_history_thread
    with _full_history_lock:
        if _thread_alive():
            with SessionLocal() as db:
                return get_full_history_status(db)
        with SessionLocal() as db:
            if _has_complete_full_history(db):
                _set_state(db, status="complete", message="全量历史已完成", mark_finished=True)
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
            if _has_complete_full_history(db):
                _set_state(db, status="complete", message="全量历史已完成", mark_finished=True)
                return

            _set_state(db, status="running", message="刷新股票清单…", mark_started=True)

            # 1) 股票清单：每次刷新 stock_basic（补新股，不回退已完成标记）
            provider = MarketDataProvider(db)
            provider.ingest_stock_basic(list_status="L")

            # 2) 逐只拉历史（断点续传/修复：处理未完成的）
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

            # 3) 指数缺口 + 当日情绪；已有最新数据时跳过，避免 100% 后重复请求 index_daily。
            _set_state(db, status="running", message="补齐指数与情绪…")
            target_end, _ = syncable_market_end(db)
            sync_index_daily_incremental(db, target_end)
            try:
                fetch_and_store_market_sentiment(db, target_end)
            except Exception as exc:
                logger.warning("Refresh final sentiment failed: %s", exc)

            _set_state(db, status="complete", message="全量历史已完成", mark_finished=True)
        except Exception as exc:
            logger.exception("Full history run failed")
            try:
                _set_state(db, status="error", message=str(exc)[:200], mark_finished=True)
            except Exception:
                pass
