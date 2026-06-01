from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.services.market import MarketDataProvider
from app.services.market_sync import (
    cancel_full_history,
    get_full_history_status,
    is_full_history_running,
    start_full_history,
    sync_latest,
)
from app.services.sentiment import get_market_sentiment

router = APIRouter(tags=["market"])


@router.get("/market/quotes")
def get_quotes(codes: str = Query(..., description="逗号分隔的 ts_code 列表"), db: Session = Depends(get_session)):
    ts_codes = [c.strip() for c in codes.split(",") if c.strip()]
    provider = MarketDataProvider(db)
    results = provider.get_latest_price(ts_codes)
    return {
        code: {
            "price": str(info["price"]),
            "pre_close": str(info["pre_close"]),
        }
        for code, info in results.items()
    }


@router.get("/market/sentiment")
def sentiment(db: Session = Depends(get_session)):
    return get_market_sentiment(db)


@router.post("/market/sync")
def sync_latest_market(db: Session = Depends(get_session)):
    """「拉取最新行情」：按交易日 daily(trade_date) 全市场增量（DB 最新日期 → 可同步目标日）。"""
    if is_full_history_running():
        raise HTTPException(status_code=409, detail="全量历史同步进行中，请稍后再试「拉取最新行情」")
    return sync_latest(db)


@router.get("/market/history")
def market_history_status(db: Session = Depends(get_session)):
    """全量历史进度：stock_list 的 done/total 判断是否拥有全量历史。"""
    return get_full_history_status(db)


@router.post("/market/history")
def market_history_start(db: Session = Depends(get_session)):
    """启动后台全量历史任务（逐只 daily(ts_code) 拉 23 年；可续传/修复）。"""
    return start_full_history()


@router.post("/market/history/cancel")
def market_history_cancel(db: Session = Depends(get_session)):
    """请求取消后台全量历史任务（当前股票拉完后停止）。"""
    return cancel_full_history()
