"""TuShare 接口调用节流：按接口类型控制最小间隔，避免分钟级限频。"""
from __future__ import annotations

import re
import threading
import time

_lock = threading.Lock()
_last_call: dict[str, float] = {}

# 120 积分常见限额：daily 50/min，trade_cal/index_daily 1/min
MIN_INTERVAL_SEC: dict[str, float] = {
    "daily": 1.3,
    "trade_cal": 62.0,
    "index_daily": 62.0,
    "stock_basic": 62.0,
    "default": 1.3,
}

_RATE_LIMIT_RE = re.compile(r"频率超限\((\d+)次/分钟\)")


def api_kind_from_error(exc: Exception) -> str | None:
    msg = str(exc)
    if "trade_cal" in msg:
        return "trade_cal"
    if "index_daily" in msg:
        return "index_daily"
    if "stock_basic" in msg:
        return "stock_basic"
    if "daily" in msg:
        return "daily"
    return None


def min_interval_for(api: str) -> float:
    return MIN_INTERVAL_SEC.get(api, MIN_INTERVAL_SEC["default"])


def wait_for_slot(api: str = "default") -> None:
    """在发起 TuShare 请求前等待，满足该接口最小间隔。"""
    interval = min_interval_for(api)
    with _lock:
        last = _last_call.get(api, 0.0)
        now = time.monotonic()
        delay = interval - (now - last)
        if delay > 0:
            time.sleep(delay)
        _last_call[api] = time.monotonic()


def sleep_after_rate_limit(exc: Exception) -> float:
    """遇到限频错误时等待；返回实际 sleep 秒数。"""
    msg = str(exc)
    m = _RATE_LIMIT_RE.search(msg)
    if m:
        per_min = int(m.group(1))
        wait = max(62.0, 60.0 / per_min * 1.1)
    else:
        wait = 62.0
    time.sleep(wait)
    return wait
