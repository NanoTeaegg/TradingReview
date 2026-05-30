import json
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.models.trade import Trade
from app.models.intent import TradeIntent

router = APIRouter(tags=["trades"])


@router.get("/trades")
def list_trades(
    stock: Optional[str] = Query(None),
    side: Optional[str] = Query(None),
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    db: Session = Depends(get_session),
):
    q = db.query(Trade).order_by(Trade.trade_date.desc(), Trade.seq.desc(), Trade.id.desc())
    if stock:
        q = q.filter(or_(Trade.stock_code.like(f"{stock}%"), Trade.stock_name.like(f"%{stock}%")))
    if side:
        q = q.filter(Trade.side == side)
    if start:
        q = q.filter(Trade.trade_date >= start)
    if end:
        q = q.filter(Trade.trade_date <= end)

    trades = q.all()

    intent_map: dict[int, TradeIntent] = {}
    for intent in db.query(TradeIntent).filter(TradeIntent.trade_id.isnot(None)).all():
        if intent.trade_id:
            intent_map[intent.trade_id] = intent

    return [
        {
            "id": t.id,
            "trade_date": t.trade_date.strftime("%Y%m%d"),
            "stock_code": t.stock_code,
            "stock_name": t.stock_name,
            "ts_code": t.ts_code,
            "side": t.side,
            "price": str(t.price),
            "quantity": t.quantity,
            "amount": str(t.amount),
            "fee": str(t.fee),
            "market": t.market,
            "remark": t.remark,
            "intent_tags": json.loads(intent_map[t.id].tags or "[]") if t.id in intent_map else [],
            "intent_confidence": intent_map[t.id].confidence if t.id in intent_map else None,
            "intent_thesis": intent_map[t.id].thesis if t.id in intent_map else "",
        }
        for t in trades
    ]
