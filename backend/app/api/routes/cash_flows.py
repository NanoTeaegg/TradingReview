from datetime import date
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_account_id, get_session
from app.models.cash_flow import CashFlow
from app.models.trade import Trade

router = APIRouter(tags=["cash_flows"])


class CashFlowCreate(BaseModel):
    flow_type: str
    amount: str


def _serialize(row: CashFlow) -> dict:
    return {
        "id": row.id,
        "flow_date": row.flow_date.isoformat(),
        "flow_type": row.flow_type,
        "amount": str(row.amount),
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _net_deposit(db: Session, account_id: int) -> Decimal:
    rows = db.query(CashFlow).filter(CashFlow.account_id == account_id).all()
    total = Decimal("0")
    for row in rows:
        total += row.amount if row.flow_type == "deposit" else -row.amount
    return total


@router.get("/cash-flows")
def list_cash_flows(db: Session = Depends(get_session), account_id: int = Depends(get_current_account_id)):
    rows = db.query(CashFlow).filter(
        CashFlow.account_id == account_id
    ).order_by(CashFlow.flow_date.desc(), CashFlow.id.desc()).all()
    return {
        "items": [_serialize(row) for row in rows],
        "net_deposit": str(_net_deposit(db, account_id)),
    }


@router.post("/cash-flows")
def create_cash_flow(
    body: CashFlowCreate,
    db: Session = Depends(get_session),
    account_id: int = Depends(get_current_account_id),
):
    if body.flow_type not in {"deposit", "withdraw"}:
        raise HTTPException(status_code=400, detail="flow_type must be deposit or withdraw")

    try:
        amount = Decimal(body.amount)
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=400, detail="amount must be a valid number")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be greater than 0")

    existing_count = db.query(func.count(CashFlow.id)).filter(CashFlow.account_id == account_id).scalar() or 0
    first_trade_date = db.query(func.min(Trade.trade_date)).filter(Trade.account_id == account_id).scalar()
    flow_date = first_trade_date if existing_count == 0 and first_trade_date else date.today()

    row = CashFlow(account_id=account_id, flow_date=flow_date, flow_type=body.flow_type, amount=amount)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.delete("/cash-flows/{flow_id}")
def delete_cash_flow(
    flow_id: int,
    db: Session = Depends(get_session),
    account_id: int = Depends(get_current_account_id),
):
    row = db.query(CashFlow).filter(CashFlow.id == flow_id, CashFlow.account_id == account_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="cash flow not found")
    db.delete(row)
    db.commit()
    return {"ok": True}
