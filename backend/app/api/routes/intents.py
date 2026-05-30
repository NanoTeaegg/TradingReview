from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_account_id, get_session
from app.models.intent import Tag, TradeIntent
from app.models.trade import Trade
from app.services.pnl import run_fifo, _load_trades

router = APIRouter(tags=["intents"])


class IntentCreate(BaseModel):
    trade_id: Optional[int] = None
    stock_code: Optional[str] = None
    tags: list[str] = []
    thesis: Optional[str] = None
    confidence: Optional[int] = None


class IntentUpdate(BaseModel):
    tags: Optional[list[str]] = None
    thesis: Optional[str] = None
    confidence: Optional[int] = None


def _resolve_tags(db: Session, account_id: int, tag_names: list[str]) -> list[Tag]:
    """Return Tag objects for the given names, auto-creating any that are missing."""
    result = []
    for name in tag_names:
        tag = db.query(Tag).filter(Tag.account_id == account_id, Tag.name == name).first()
        if tag is None:
            tag = Tag(account_id=account_id, name=name)
            db.add(tag)
            db.flush()
        result.append(tag)
    return result


def _fmt(i: TradeIntent, db: Session, account_id: int) -> dict:
    stock_name = ""
    if i.trade_id:
        trade = db.query(Trade).filter(Trade.id == i.trade_id, Trade.account_id == account_id).first()
        if trade:
            stock_name = trade.stock_name

    return {
        "id": i.id,
        "trade_id": i.trade_id,
        "stock_code": i.stock_code,
        "stock_name": stock_name,
        "tags": [t.name for t in i.tag_objects],
        "confidence": i.confidence,
        "thesis": i.thesis,
        "pnl_realized": None,
        "pnl_float": None,
        "pnl_float_rate": None,
        "created_at": i.created_at.isoformat() if i.created_at else None,
    }


@router.get("/intents")
def list_intents(db: Session = Depends(get_session), account_id: int = Depends(get_current_account_id)):
    intents = db.query(TradeIntent).filter(
        TradeIntent.account_id == account_id
    ).order_by(TradeIntent.created_at.desc()).all()
    return [_fmt(i, db, account_id) for i in intents]


@router.post("/intents")
def create_intent(
    body: IntentCreate,
    db: Session = Depends(get_session),
    account_id: int = Depends(get_current_account_id),
):
    if body.trade_id:
        trade = db.query(Trade).filter(Trade.id == body.trade_id, Trade.account_id == account_id).first()
        if not trade:
            raise HTTPException(status_code=404, detail="Trade not found")
    intent = TradeIntent(
        account_id=account_id,
        trade_id=body.trade_id,
        stock_code=body.stock_code,
        thesis=body.thesis,
        confidence=body.confidence,
    )
    intent.tag_objects = _resolve_tags(db, account_id, body.tags)
    db.add(intent)
    db.commit()
    db.refresh(intent)
    return _fmt(intent, db, account_id)


@router.get("/intents/{intent_id}")
def get_intent(
    intent_id: int,
    db: Session = Depends(get_session),
    account_id: int = Depends(get_current_account_id),
):
    intent = db.query(TradeIntent).filter(
        TradeIntent.id == intent_id,
        TradeIntent.account_id == account_id,
    ).first()
    if not intent:
        raise HTTPException(status_code=404, detail="Intent not found")
    return _fmt(intent, db, account_id)


@router.put("/intents/{intent_id}")
def update_intent(
    intent_id: int,
    body: IntentUpdate,
    db: Session = Depends(get_session),
    account_id: int = Depends(get_current_account_id),
):
    intent = db.query(TradeIntent).filter(
        TradeIntent.id == intent_id,
        TradeIntent.account_id == account_id,
    ).first()
    if not intent:
        raise HTTPException(status_code=404, detail="Intent not found")
    if body.tags is not None:
        intent.tag_objects = _resolve_tags(db, account_id, body.tags)
    if body.thesis is not None:
        intent.thesis = body.thesis
    if body.confidence is not None:
        intent.confidence = body.confidence
    db.commit()
    db.refresh(intent)
    return _fmt(intent, db, account_id)


@router.delete("/intents/{intent_id}")
def delete_intent(
    intent_id: int,
    db: Session = Depends(get_session),
    account_id: int = Depends(get_current_account_id),
):
    intent = db.query(TradeIntent).filter(
        TradeIntent.id == intent_id,
        TradeIntent.account_id == account_id,
    ).first()
    if not intent:
        raise HTTPException(status_code=404, detail="Intent not found")
    db.delete(intent)
    db.commit()
    return {"ok": True}


@router.get("/intents/{intent_id}/detail")
def get_intent_detail(
    intent_id: int,
    db: Session = Depends(get_session),
    account_id: int = Depends(get_current_account_id),
):
    intent = db.query(TradeIntent).filter(
        TradeIntent.id == intent_id,
        TradeIntent.account_id == account_id,
    ).first()
    if not intent:
        raise HTTPException(status_code=404, detail="Intent not found")

    related_trades = []
    if intent.stock_code:
        related_trades = db.query(Trade).filter(
            Trade.account_id == account_id,
            Trade.stock_code == intent.stock_code,
        ).order_by(Trade.trade_date).all()
    elif intent.trade_id:
        t = db.query(Trade).filter(Trade.id == intent.trade_id, Trade.account_id == account_id).first()
        if t:
            related_trades = [t]

    all_trades = _load_trades(db, account_id=account_id)
    lots, round_trips = run_fifo(all_trades)

    code = intent.stock_code or (related_trades[0].stock_code if related_trades else None)
    realized = None
    float_pnl = None

    if code:
        from decimal import Decimal
        realized_total = sum(rt.net_pnl for rt in round_trips if rt.stock_code == code)
        realized = str(realized_total)

        remaining = lots.get(code, [])
        if remaining:
            from app.services.market import MarketDataProvider
            ts_code = next((t.ts_code for t in all_trades if t.stock_code == code), None)
            if ts_code:
                provider = MarketDataProvider(db)
                prices = provider.get_latest_price([ts_code])
                latest_price = prices.get(ts_code, {}).get("price")
                if latest_price:
                    total_qty = sum(l.qty for l in remaining)
                    avg_cost = sum(l.price * l.qty for l in remaining) / Decimal(total_qty)
                    float_pnl = str(((latest_price - avg_cost) * total_qty).quantize(Decimal("0.01")))

    return {
        **_fmt(intent, db, account_id),
        "related_trades": [
            {
                "id": t.id,
                "trade_date": t.trade_date.strftime("%Y%m%d"),
                "side": t.side,
                "price": str(t.price),
                "quantity": t.quantity,
                "amount": str(t.amount),
                "fee": str(t.fee),
            }
            for t in related_trades
        ],
        "pnl_realized": realized,
        "pnl_float": float_pnl,
    }
