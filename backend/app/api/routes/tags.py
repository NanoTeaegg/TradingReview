from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_account_id, get_session
from app.models.intent import Tag, TradeIntent, intent_tag_link

router = APIRouter(tags=["tags"])


class TagCreate(BaseModel):
    name: str
    color: Optional[str] = None


class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


def _intent_count(tag_id: int, db: Session) -> int:
    return db.execute(
        select(func.count()).where(intent_tag_link.c.tag_id == tag_id)
    ).scalar() or 0


@router.get("/tags")
def list_tags(db: Session = Depends(get_session), account_id: int = Depends(get_current_account_id)):
    tags = db.query(Tag).filter(Tag.account_id == account_id).order_by(Tag.name).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "color": t.color,
            "intent_count": _intent_count(t.id, db),
        }
        for t in tags
    ]


@router.post("/tags")
def create_tag(
    body: TagCreate,
    db: Session = Depends(get_session),
    account_id: int = Depends(get_current_account_id),
):
    existing = db.query(Tag).filter(Tag.account_id == account_id, Tag.name == body.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="标签已存在")
    tag = Tag(account_id=account_id, name=body.name, color=body.color)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return {"id": tag.id, "name": tag.name, "color": tag.color, "intent_count": 0}


@router.put("/tags/{tag_id}")
def update_tag(
    tag_id: int,
    body: TagUpdate,
    db: Session = Depends(get_session),
    account_id: int = Depends(get_current_account_id),
):
    tag = db.query(Tag).filter(Tag.id == tag_id, Tag.account_id == account_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    if body.name and body.name != tag.name:
        existing = db.query(Tag).filter(
            Tag.account_id == account_id,
            Tag.name == body.name,
            Tag.id != tag_id,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="标签已存在")
        tag.name = body.name

    if body.color is not None:
        tag.color = body.color

    db.commit()
    db.refresh(tag)
    return {
        "id": tag.id,
        "name": tag.name,
        "color": tag.color,
        "intent_count": _intent_count(tag.id, db),
    }


@router.delete("/tags/{tag_id}")
def delete_tag(
    tag_id: int,
    db: Session = Depends(get_session),
    account_id: int = Depends(get_current_account_id),
):
    tag = db.query(Tag).filter(Tag.id == tag_id, Tag.account_id == account_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    count = _intent_count(tag.id, db)
    if count > 0:
        return {"ok": False, "intent_count": count, "message": f"该标签已关联 {count} 条意图，确认删除?"}
    db.delete(tag)
    db.commit()
    return {"ok": True, "intent_count": 0}


@router.delete("/tags/{tag_id}/force")
def force_delete_tag(
    tag_id: int,
    db: Session = Depends(get_session),
    account_id: int = Depends(get_current_account_id),
):
    tag = db.query(Tag).filter(Tag.id == tag_id, Tag.account_id == account_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    # CASCADE DELETE on intent_tag_link.tag_id removes all links automatically
    db.delete(tag)
    db.commit()
    return {"ok": True}
