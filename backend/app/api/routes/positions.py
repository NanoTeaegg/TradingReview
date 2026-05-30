from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_account_id, get_session
from app.services import pnl

router = APIRouter(tags=["positions"])


@router.get("/positions")
def get_positions(db: Session = Depends(get_session), account_id: int = Depends(get_current_account_id)):
    return pnl.get_positions(db, account_id=account_id)


@router.get("/positions/equity-curve")
def get_equity_curve(db: Session = Depends(get_session), account_id: int = Depends(get_current_account_id)):
    """账户收益率走势：时间加权净值 + 多基准（沪深300/上证/深证/创业板）。"""
    return pnl.get_equity_curve(db, account_id=account_id)


@router.get("/positions/summary")
def get_summary(db: Session = Depends(get_session), account_id: int = Depends(get_current_account_id)):
    return pnl.get_performance_summary(db, account_id=account_id)
