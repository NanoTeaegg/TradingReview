from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import ensure_default_account, get_session
from app.models.account import Account

router = APIRouter(tags=["accounts"])


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    kind: Literal["live", "demo"] = "live"


class AccountUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    kind: Optional[Literal["live", "demo"]] = None
    is_default: Optional[bool] = None
    sort_order: Optional[int] = None


class AccountDeleteConfirm(BaseModel):
    name: str


def _serialize(account: Account) -> dict:
    return {
        "id": account.id,
        "name": account.name,
        "kind": account.kind,
        "is_default": account.is_default,
        "sort_order": account.sort_order,
        "created_at": account.created_at.isoformat() if account.created_at else None,
    }


@router.get("/accounts")
def list_accounts(db: Session = Depends(get_session)):
    ensure_default_account(db)
    rows = db.query(Account).order_by(Account.sort_order, Account.id).all()
    return [_serialize(row) for row in rows]


@router.post("/accounts")
def create_account(body: AccountCreate, db: Session = Depends(get_session)):
    ensure_default_account(db)
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="账本名不能为空")
    if db.query(Account).filter(Account.name == name).first():
        raise HTTPException(status_code=400, detail="账本名已存在")

    next_order = (db.query(func.max(Account.sort_order)).scalar() or 0) + 1
    account = Account(name=name, kind=body.kind, is_default=False, sort_order=next_order)
    db.add(account)
    db.commit()
    db.refresh(account)
    return _serialize(account)


@router.patch("/accounts/{account_id}")
def update_account(account_id: int, body: AccountUpdate, db: Session = Depends(get_session)):
    account = db.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="账本名不能为空")
        existing = db.query(Account).filter(Account.name == name, Account.id != account_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="账本名已存在")
        account.name = name
    if body.kind is not None:
        account.kind = body.kind
    if body.sort_order is not None:
        account.sort_order = body.sort_order
    if body.is_default is True:
        db.query(Account).filter(Account.id != account_id).update({"is_default": False})
        account.is_default = True

    db.commit()
    db.refresh(account)
    return _serialize(account)


@router.delete("/accounts/{account_id}")
def delete_account(account_id: int, body: AccountDeleteConfirm, db: Session = Depends(get_session)):
    account = db.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    total = db.query(func.count(Account.id)).scalar() or 0
    if total <= 1:
        raise HTTPException(status_code=409, detail="最后一个账本不可删除")
    if body.name != account.name:
        raise HTTPException(status_code=400, detail="请输入完全一致的账本名以确认删除")

    was_default = account.is_default
    db.delete(account)
    db.flush()
    if was_default:
        next_default = db.query(Account).order_by(Account.sort_order, Account.id).first()
        if next_default:
            next_default.is_default = True
    db.commit()
    return {"ok": True}
