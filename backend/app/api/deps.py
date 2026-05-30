from typing import Generator
from sqlalchemy.orm import Session
from fastapi import Depends, Header, HTTPException, Query

from app.core.db import get_db
from app.models.account import Account


def get_session(db: Session = Depends(get_db)) -> Session:
    return db


def ensure_default_account(db: Session) -> Account:
    account = db.query(Account).filter(Account.is_default.is_(True)).order_by(Account.id).first()
    if account:
        if account.name == "主账户" and not db.query(Account).filter(Account.name == "模拟数据").first():
            account.name = "模拟数据"
            db.commit()
            db.refresh(account)
        return account

    account = db.query(Account).order_by(Account.sort_order, Account.id).first()
    if account:
        account.is_default = True
        db.commit()
        db.refresh(account)
        return account

    account = Account(name="模拟数据", kind="demo", is_default=True, sort_order=0)
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def get_current_account_id(
    db: Session = Depends(get_session),
    x_account_id: int | None = Header(default=None, alias="X-Account-Id"),
    account_id: int | None = Query(default=None),
) -> int:
    requested_id = x_account_id or account_id
    if requested_id is None:
        return ensure_default_account(db).id

    account = db.get(Account, requested_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account.id
