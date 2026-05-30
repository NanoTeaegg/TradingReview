from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_account_id, get_session
from app.models.account import Account
from app.services import rules as rules_svc

router = APIRouter(tags=["rules"])


class RuleBody(BaseModel):
    content: str
    summary: Optional[str] = None


@router.get("/rules")
def get_current_rule(db: Session = Depends(get_session), account_id: int = Depends(get_current_account_id)):
    rule = rules_svc.get_current_rule(db, account_id=account_id)
    if not rule:
        return {"id": None, "content": "", "summary": None, "created_at": None}
    return {
        "id": rule.id,
        "content": rule.content,
        "summary": rule.summary,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
    }


@router.put("/rules")
def save_rule(
    body: RuleBody,
    db: Session = Depends(get_session),
    account_id: int = Depends(get_current_account_id),
):
    rule = rules_svc.save_rule(db, content=body.content, summary=body.summary, account_id=account_id)
    return {
        "id": rule.id,
        "content": rule.content,
        "summary": rule.summary,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
    }


@router.get("/rules/versions")
def list_versions(db: Session = Depends(get_session), account_id: int = Depends(get_current_account_id)):
    versions = rules_svc.list_versions(db, account_id=account_id)
    return [
        {
            "id": v.id,
            "summary": v.summary,
            "created_at": v.created_at.isoformat() if v.created_at else None,
            "content_preview": v.content[:100] if v.content else "",
        }
        for v in versions
    ]


@router.post("/rules/versions/{version_id}/restore")
def restore_version(
    version_id: int,
    db: Session = Depends(get_session),
    account_id: int = Depends(get_current_account_id),
):
    try:
        rule = rules_svc.restore_version(db, version_id, account_id=account_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {
        "id": rule.id,
        "content": rule.content,
        "summary": rule.summary,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
    }


@router.post("/rules/copy")
def copy_rule(
    from_account_id: int,
    db: Session = Depends(get_session),
    account_id: int = Depends(get_current_account_id),
):
    if from_account_id == account_id:
        raise HTTPException(status_code=400, detail="来源账本不能与当前账本相同")

    source_account = db.get(Account, from_account_id)
    if not source_account:
        raise HTTPException(status_code=404, detail="Source account not found")

    source_rule = rules_svc.get_current_rule(db, account_id=from_account_id)
    if not source_rule:
        raise HTTPException(status_code=404, detail="来源账本暂无规则")

    rule = rules_svc.save_rule(
        db,
        content=source_rule.content,
        summary=f"复制自 {source_account.name}",
        account_id=account_id,
    )
    return {
        "id": rule.id,
        "content": rule.content,
        "summary": rule.summary,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
    }
