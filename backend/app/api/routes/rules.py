from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.services import rules as rules_svc

router = APIRouter(tags=["rules"])


class RuleBody(BaseModel):
    content: str
    summary: Optional[str] = None


@router.get("/rules")
def get_current_rule(db: Session = Depends(get_session)):
    rule = rules_svc.get_current_rule(db)
    if not rule:
        return {"id": None, "content": "", "summary": None, "created_at": None}
    return {
        "id": rule.id,
        "content": rule.content,
        "summary": rule.summary,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
    }


@router.put("/rules")
def save_rule(body: RuleBody, db: Session = Depends(get_session)):
    rule = rules_svc.save_rule(db, content=body.content, summary=body.summary)
    return {
        "id": rule.id,
        "content": rule.content,
        "summary": rule.summary,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
    }


@router.get("/rules/versions")
def list_versions(db: Session = Depends(get_session)):
    versions = rules_svc.list_versions(db)
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
def restore_version(version_id: int, db: Session = Depends(get_session)):
    try:
        rule = rules_svc.restore_version(db, version_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {
        "id": rule.id,
        "content": rule.content,
        "summary": rule.summary,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
    }
