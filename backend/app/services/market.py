import logging
import threading
import time
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.market_cache import MarketDailyBar, StockListItem, TradingCalendarDay

logger = logging.getLogger("tradingreview.market")

_ts_initialized = False
STOCK = "stock"
INDEX = "index"
_cal_sync_lock = threading.Lock()


def _init_tushare():
    global _ts_initialized
    if _ts_initialized:
        return
    if not settings.TUSHARE_API_KEY:
        return
    try:
        import tushare as ts
        ts.set_token(settings.TUSHARE_API_KEY)
        _ts_initialized = True
    except Exception as e:
        logger.warning(f"TuShare init failed: {e}")


def _retry(fn, retries: int = 3, delay: float = 1.0, *, api: str = "default"):
    from app.services.tushare_limiter import sleep_after_rate_limit, wait_for_slot

    last_exc = None
    for i in range(retries):
        try:
            wait_for_slot(api)
            return fn()
        except Exception as e:
            last_exc = e
            msg = str(e)
            if "频率超限" in msg:
                # 每分钟限频：等过当前分钟再重试；按小时/天等长周期限频：62s 后必然再超限，
                # 短时重试无意义，直接放弃（后台任务据此快速收尾，下一周期再补）。
                if "分钟" in msg and i < retries - 1:
                    sleep_after_rate_limit(e)
                    continue
                break
            if i < retries - 1:
                time.sleep(delay)
    raise last_exc


def _dec(value) -> Optional[Decimal]:
    """Safely convert a TuShare cell (float/str/NaN/None) to Decimal."""
    if value is None:
        return None
    try:
        text = str(value).strip()
        if text == "" or text.lower() == "nan":
            return None
        return Decimal(text)
    except Exception:
        return None


def _parse_yyyymmdd(value) -> Optional[date]:
    """Parse a TuShare YYYYMMDD cell into date; tolerate None/NaN/empty."""
    if value is None:
        return None
    text = str(value).strip()
    if len(text) < 8 or text.lower() == "nan":
        return None
    try:
        return date(int(text[:4]), int(text[4:6]), int(text[6:8]))
    except Exception:
        return None


class MarketDataProvider:
    def __init__(self, db: Session):
        self.db = db
        _init_tushare()

    def get_latest_price(self, ts_codes: list[str]) -> dict[str, dict]:
        """Return {ts_code: {price, pre_close}} from local market_daily_bars only.

        只读本地落库的日线（最近一条收盘价）。盘中实时价不在此处理。
        """
        unique_codes = list(dict.fromkeys(ts_codes))
        results: dict[str, dict] = {}
        for ts_code in unique_codes:
            row = (
                self.db.query(MarketDailyBar)
                .filter(
                    MarketDailyBar.instrument_type == STOCK,
                    MarketDailyBar.ts_code == ts_code,
                )
                .order_by(MarketDailyBar.trade_date.desc())
                .first()
            )
            if row is not None:
                results[ts_code] = {
                    "price": row.close,
                    "pre_close": row.pre_close or row.close,
                }
        return results

    def get_prices_on_date(
        self,
        ts_codes: list[str],
        trade_date: date,
        allow_realtime_fallback: bool = False,
    ) -> dict[str, dict]:
        """Return cached daily prices for one trade date, fetching only missing codes."""
        unique_codes = list(dict.fromkeys(ts_codes))
        if not unique_codes:
            return {}

        cached_rows = (
            self.db.query(MarketDailyBar)
            .filter(
                MarketDailyBar.instrument_type == STOCK,
                MarketDailyBar.ts_code.in_(unique_codes),
                MarketDailyBar.trade_date == trade_date,
            )
            .all()
        )
        results = {
            row.ts_code: {"price": row.close, "pre_close": row.pre_close or row.close}
            for row in cached_rows
        }

        missing = [code for code in unique_codes if code not in results]
        if missing:
            logger.debug(
                "Local daily price missing for %s on %s (run market sync)",
                missing,
                trade_date.isoformat(),
            )

        return results

    def get_daily(self, ts_code: str, start: date, end: date) -> list[tuple[date, Decimal, Decimal]]:
        """Return [(trade_date, close, pre_close)] from local cache only."""
        rows = (
            self.db.query(MarketDailyBar)
            .filter(
                MarketDailyBar.instrument_type == STOCK,
                MarketDailyBar.ts_code == ts_code,
                MarketDailyBar.trade_date >= start,
                MarketDailyBar.trade_date <= end,
            )
            .order_by(MarketDailyBar.trade_date)
            .all()
        )
        return [(r.trade_date, r.close, r.pre_close) for r in rows]

    def ingest_stock_daily_by_trade_date(self, trade_date: date) -> int:
        """TuShare daily(trade_date=...)：一次拉全市场当日 A 股并落全字段。"""
        try:
            import tushare as ts

            pro = ts.pro_api()
            df = _retry(lambda: pro.daily(trade_date=trade_date.strftime("%Y%m%d")), api="daily")
        except Exception as e:
            logger.warning("TuShare daily by trade_date %s failed: %s", trade_date, e)
            return 0

        if df is None or df.empty:
            return 0

        count = 0
        for _, row in df.iterrows():
            try:
                ts_code = str(row["ts_code"])
                td_raw = str(row["trade_date"])
                td = date(int(td_raw[:4]), int(td_raw[4:6]), int(td_raw[6:8]))
                self._upsert_daily_bar(
                    STOCK,
                    ts_code,
                    td,
                    close=_dec(row.get("close")),
                    pre_close=_dec(row.get("pre_close")),
                    open_=_dec(row.get("open")),
                    high=_dec(row.get("high")),
                    low=_dec(row.get("low")),
                    change=_dec(row.get("change")),
                    pct_chg=_dec(row.get("pct_chg")),
                    vol=_dec(row.get("vol")),
                    amount=_dec(row.get("amount")),
                    source="tushare_daily",
                )
                count += 1
            except Exception:
                pass
        if count:
            self.db.commit()
        return count

    def ingest_stock_basic(self, list_status: str = "L") -> int:
        """TuShare stock_basic：拉全市场股票清单落库 stock_list。返回清单总数。"""
        try:
            import tushare as ts

            pro = ts.pro_api()
            df = _retry(lambda: pro.stock_basic(
                exchange="",
                list_status=list_status,
                fields="ts_code,symbol,name,list_date,list_status",
            ), api="stock_basic")
        except Exception as e:
            logger.warning("TuShare stock_basic failed: %s", e)
            return 0

        if df is None or df.empty:
            return 0

        count = 0
        for _, row in df.iterrows():
            ts_code = str(row.get("ts_code", "")).strip()
            if not ts_code:
                continue
            existing = (
                self.db.query(StockListItem)
                .filter(StockListItem.ts_code == ts_code)
                .first()
            )
            if existing is None:
                self.db.add(
                    StockListItem(
                        ts_code=ts_code,
                        symbol=str(row.get("symbol") or "") or None,
                        name=str(row.get("name") or "") or None,
                        list_date=_parse_yyyymmdd(row.get("list_date")),
                        list_status=str(row.get("list_status") or list_status),
                    )
                )
            else:
                existing.symbol = str(row.get("symbol") or "") or None
                existing.name = str(row.get("name") or "") or None
                existing.list_date = _parse_yyyymmdd(row.get("list_date")) or existing.list_date
                existing.list_status = str(row.get("list_status") or existing.list_status)
            count += 1
        self.db.commit()
        return count

    def ingest_stock_daily_history(self, ts_code: str, start: date, end: date) -> int:
        """TuShare daily(ts_code=...)：拉单只股票区间历史并落全字段。返回落库条数。"""
        try:
            import tushare as ts

            pro = ts.pro_api()
            df = _retry(lambda: pro.daily(
                ts_code=ts_code,
                start_date=start.strftime("%Y%m%d"),
                end_date=end.strftime("%Y%m%d"),
            ), api="daily")
        except Exception as e:
            logger.warning("TuShare daily history for %s failed: %s", ts_code, e)
            raise

        if df is None or df.empty:
            return 0

        count = 0
        for _, row in df.iterrows():
            try:
                td = _parse_yyyymmdd(row.get("trade_date"))
                if td is None:
                    continue
                self._upsert_daily_bar(
                    STOCK,
                    ts_code,
                    td,
                    close=_dec(row.get("close")),
                    pre_close=_dec(row.get("pre_close")),
                    open_=_dec(row.get("open")),
                    high=_dec(row.get("high")),
                    low=_dec(row.get("low")),
                    change=_dec(row.get("change")),
                    pct_chg=_dec(row.get("pct_chg")),
                    vol=_dec(row.get("vol")),
                    amount=_dec(row.get("amount")),
                    source="tushare_daily_hist",
                )
                count += 1
            except Exception:
                pass
        if count:
            self.db.commit()
        return count

    def ingest_index_daily_range(self, index_code: str, start: date, end: date) -> int:
        """同步任务专用：拉取指数区间日线（含 OHLC/量额）并落库。"""
        rows = self._fetch_index_daily(index_code, start, end)
        if not rows:
            return 0
        count = 0
        for r in rows:
            self._upsert_daily_bar(
                INDEX,
                index_code,
                r["trade_date"],
                close=r["close"],
                pre_close=r.get("pre_close"),
                open_=r.get("open"),
                high=r.get("high"),
                low=r.get("low"),
                change=r.get("change"),
                pct_chg=r.get("pct_chg"),
                vol=r.get("vol"),
                amount=r.get("amount"),
                source="index_daily",
            )
            count += 1
        if count:
            self.db.commit()
        return count

    def get_index_daily(self, index_code: str, start: date, end: date) -> list[tuple[date, Decimal]]:
        """Return [(trade_date, close)] from local cache only."""
        rows = (
            self.db.query(MarketDailyBar)
            .filter(
                MarketDailyBar.instrument_type == INDEX,
                MarketDailyBar.ts_code == index_code,
                MarketDailyBar.trade_date >= start,
                MarketDailyBar.trade_date <= end,
            )
            .order_by(MarketDailyBar.trade_date)
            .all()
        )
        return [(r.trade_date, r.close) for r in rows]

    def _upsert_daily_bar(
        self,
        instrument_type: str,
        ts_code: str,
        trade_date: date,
        *,
        close: Decimal,
        pre_close: Decimal | None = None,
        open_: Decimal | None = None,
        high: Decimal | None = None,
        low: Decimal | None = None,
        change: Decimal | None = None,
        pct_chg: Decimal | None = None,
        vol: Decimal | None = None,
        amount: Decimal | None = None,
        source: str = "unknown",
    ) -> MarketDailyBar:
        row = (
            self.db.query(MarketDailyBar)
            .filter(
                MarketDailyBar.instrument_type == instrument_type,
                MarketDailyBar.ts_code == ts_code,
                MarketDailyBar.trade_date == trade_date,
            )
            .first()
        )
        if row is None:
            row = MarketDailyBar(
                instrument_type=instrument_type,
                ts_code=ts_code,
                trade_date=trade_date,
                close=close,
            )
            self.db.add(row)

        row.close = close
        row.pre_close = pre_close
        row.open = open_
        row.high = high
        row.low = low
        row.change = change
        row.pct_chg = pct_chg
        row.vol = vol
        row.amount = amount
        row.source = source
        return row

    def _fetch_index_daily(self, index_code: str, start: date, end: date) -> list[dict]:
        """TuShare 指数日线（含 OHLC/量额）。120 积分可用 index_daily。"""
        try:
            import tushare as ts
            pro = ts.pro_api()
            # index_daily 为小时级限频：撞限频（无论分钟/小时级消息）都立即放弃，
            # 不做 62s 退避——等 62s 后小时级配额仍未恢复，纯属白等并拖住交互式同步。
            df = _retry(
                lambda: pro.index_daily(
                    ts_code=index_code,
                    start_date=start.strftime("%Y%m%d"),
                    end_date=end.strftime("%Y%m%d"),
                ),
                retries=1,
                api="index_daily",
            )
        except Exception as e:
            logger.warning(f"TuShare index daily failed: {e}")
            # 限频异常向上抛出，便于同步任务据此跳过其余基准（避免逐个再等节流间隔）；
            # 其余错误按缺失处理，返回空不影响整体同步。
            if "频率超限" in str(e):
                raise
            return []

        if df is None or df.empty:
            return []

        results: list[dict] = []
        for _, row in df.iterrows():
            try:
                td_raw = str(row["trade_date"])
                td = date(int(td_raw[:4]), int(td_raw[4:6]), int(td_raw[6:8]))
                results.append({
                    "trade_date": td,
                    "close": _dec(row.get("close")),
                    "pre_close": _dec(row.get("pre_close")),
                    "open": _dec(row.get("open")),
                    "high": _dec(row.get("high")),
                    "low": _dec(row.get("low")),
                    "change": _dec(row.get("change")),
                    "pct_chg": _dec(row.get("pct_chg")),
                    "vol": _dec(row.get("vol")),
                    "amount": _dec(row.get("amount")),
                })
            except Exception:
                pass
        return results

    def ensure_trade_calendar(
        self,
        start: date,
        end: date,
        exchange: str = "SSE",
    ) -> None:
        """确保本地已有 [start, end] 交易日历数据（仅本地补种，不触发远程）。"""
        with _cal_sync_lock:
            self._seed_trade_calendar_from_local(start, end, exchange)

    def ingest_trade_calendar_range(
        self,
        start: date,
        end: date,
        exchange: str = "SSE",
    ) -> int:
        """同步任务专用：强制从 TuShare 拉 [start, end] 全部自然日历（含休市日 + pretrade_date）并落库。"""
        with _cal_sync_lock:
            rows = self._fetch_trade_cal_tushare(start, end, exchange)
            changed = False
            for r in rows:
                if self._upsert_calendar_day(
                    exchange, r["cal_date"], r["is_open"], r.get("pretrade_date"), "tushare"
                ):
                    changed = True
            if changed:
                self.db.commit()
            return len(rows)

    def max_calendar_date(self, exchange: str = "SSE") -> date | None:
        from sqlalchemy import func as _func

        value = (
            self.db.query(_func.max(TradingCalendarDay.cal_date))
            .filter(TradingCalendarDay.exchange == exchange)
            .scalar()
        )
        return value

    def trade_cal(self, start: date, end: date, exchange: str = "SSE") -> list[date]:
        """返回区间内交易日（仅本地日历 + 工作日回退，不触发远程）。"""
        return self.trade_cal_no_remote(start, end, exchange)

    def trade_cal_no_remote(self, start: date, end: date, exchange: str = "SSE") -> list[date]:
        """只读本地日历 + 工作日回退，不触发 TuShare trade_cal（用于增量拉取最新）。"""
        self._seed_trade_calendar_from_local(start, end, exchange)
        cached = self._load_trade_cal_from_db(start, end, exchange)
        if cached:
            return cached
        return self._weekday_fallback_trade_days(start, end)

    def _trade_cal_range_cached(self, start: date, end: date, exchange: str) -> bool:
        effective_end = min(end, date.today())
        rows = (
            self.db.query(TradingCalendarDay.cal_date)
            .filter(
                TradingCalendarDay.exchange == exchange,
                TradingCalendarDay.is_open.is_(True),
                TradingCalendarDay.cal_date >= start,
                TradingCalendarDay.cal_date <= effective_end,
            )
            .all()
        )
        if not rows:
            return False
        dates = [r[0] for r in rows]
        min_d, max_d = min(dates), max(dates)
        return min_d <= start and max_d >= effective_end - timedelta(days=7)

    def _load_trade_cal_from_db(self, start: date, end: date, exchange: str) -> list[date]:
        rows = (
            self.db.query(TradingCalendarDay.cal_date)
            .filter(
                TradingCalendarDay.exchange == exchange,
                TradingCalendarDay.is_open.is_(True),
                TradingCalendarDay.cal_date >= start,
                TradingCalendarDay.cal_date <= end,
            )
            .order_by(TradingCalendarDay.cal_date)
            .all()
        )
        return [r[0] for r in rows]

    def _seed_trade_calendar_from_local(self, start: date, end: date, exchange: str) -> None:
        """用本地 market_daily_bars / trades 已有日期回填交易日历，避免空库打 TuShare。"""
        bar_dates = {
            r[0]
            for r in self.db.query(MarketDailyBar.trade_date)
            .filter(
                MarketDailyBar.trade_date >= start,
                MarketDailyBar.trade_date <= end,
            )
            .distinct()
        }
        trade_dates: set[date] = set()
        try:
            from app.models.trade import Trade

            trade_dates = {
                r[0]
                for r in self.db.query(Trade.trade_date)
                .filter(
                    Trade.trade_date >= start,
                    Trade.trade_date <= end,
                )
                .distinct()
            }
        except Exception:
            pass

        all_dates = bar_dates | trade_dates
        if not all_dates:
            return

        changed = False
        for cal_date in sorted(all_dates):
            if self._upsert_calendar_day(exchange, cal_date, True, None, "local_bars"):
                changed = True
        if changed:
            self.db.commit()
            logger.info(
                "Seeded %s trading calendar days from local bars/trades (%s → %s)",
                len(all_dates),
                start.isoformat(),
                end.isoformat(),
            )

    def _sync_trade_cal_from_remote(self, start: date, end: date, exchange: str) -> None:
        try:
            rows = self._fetch_trade_cal_tushare(start, end, exchange)
        except Exception as e:
            logger.warning("TuShare trade_cal sync failed: %s", e)
            return

        if not rows:
            return

        changed = False
        for r in rows:
            if self._upsert_calendar_day(
                exchange, r["cal_date"], r["is_open"], r.get("pretrade_date"), "tushare"
            ):
                changed = True
        if changed:
            self.db.commit()

    def _fetch_trade_cal_tushare(self, start: date, end: date, exchange: str) -> list[dict]:
        """拉取 [start, end] 全部自然日历，对齐 trade_cal 全字段（含休市日与 pretrade_date）。"""
        import tushare as ts

        pro = ts.pro_api()
        df = _retry(lambda: pro.trade_cal(
            exchange=exchange,
            start_date=start.strftime("%Y%m%d"),
            end_date=end.strftime("%Y%m%d"),
        ), api="trade_cal")
        if df is None or df.empty:
            return []
        results: list[dict] = []
        for _, row in df.iterrows():
            cal = _parse_yyyymmdd(row.get("cal_date"))
            if cal is None:
                continue
            results.append({
                "cal_date": cal,
                "is_open": str(row.get("is_open", "0")).strip() == "1",
                "pretrade_date": _parse_yyyymmdd(row.get("pretrade_date")),
            })
        results.sort(key=lambda r: r["cal_date"])
        return results

    def _upsert_calendar_day(
        self,
        exchange: str,
        cal_date: date,
        is_open: bool,
        pretrade_date: date | None,
        source: str,
    ) -> bool:
        row = (
            self.db.query(TradingCalendarDay)
            .filter(
                TradingCalendarDay.exchange == exchange,
                TradingCalendarDay.cal_date == cal_date,
            )
            .first()
        )
        if row:
            # 本地种子(local_bars)不覆盖已有 tushare 全字段记录的 pretrade_date
            new_pre = pretrade_date if pretrade_date is not None else row.pretrade_date
            if row.is_open == is_open and row.pretrade_date == new_pre and row.source == source:
                return False
            row.is_open = is_open
            row.pretrade_date = new_pre
            row.source = source
            return True

        self.db.add(
            TradingCalendarDay(
                exchange=exchange,
                cal_date=cal_date,
                is_open=is_open,
                pretrade_date=pretrade_date,
                source=source,
            )
        )
        return True

    @staticmethod
    def _weekday_fallback_trade_days(start: date, end: date) -> list[date]:
        days: list[date] = []
        cur = start
        while cur <= end:
            if cur.weekday() < 5:
                days.append(cur)
            cur += timedelta(days=1)
        return days
