import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.models.intent import Tag, TradeIntent

router = APIRouter(tags=["tags"])


class TagCreate(BaseModel):
    name: str
    color: Optional[str] = None


class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


def _intent_count(tag_name: str, db: Session) -> int:
    intents = db.query(TradeIntent).all()
    count = 0
    for intent in intents:
        tags = json.loads(intent.tags or "[]")
        if tag_name in tags:
            count += 1
    return count


@router.get("/tags")
def list_tags(db: Session = Depends(get_session)):
    tags = db.query(Tag).order_by(Tag.name).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "color": t.color,
            "intent_count": _intent_count(t.name, db),
        }
        for t in tags
    ]


@router.post("/tags")
def create_tag(body: TagCreate, db: Session = Depends(get_session)):
    existing = db.query(Tag).filter(Tag.name == body.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="标签已存在")
    tag = Tag(name=body.name, color=body.color)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return {"id": tag.id, "name": tag.name, "color": tag.color, "intent_count": 0}


@router.put("/tags/{tag_id}")
def update_tag(tag_id: int, body: TagUpdate, db: Session = Depends(get_session)):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    if body.name and body.name != tag.name:
        old_name = tag.name
        tag.name = body.name
        # Sync rename in all intent.tags JSON
        intents = db.query(TradeIntent).all()
        for intent in intents:
            tags = json.loads(intent.tags or "[]")
            if old_name in tags:
                tags = [body.name if t == old_name else t for t in tags]
                intent.tags = json.dumps(tags, ensure_ascii=False)

    if body.color is not None:
        tag.color = body.color

    db.commit()
    db.refresh(tag)
    return {"id": tag.id, "name": tag.name, "color": tag.color, "intent_count": _intent_count(tag.name, db)}


@router.delete("/tags/{tag_id}")
def delete_tag(tag_id: int, db: Session = Depends(get_session)):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    count = _intent_count(tag.name, db)
    if count > 0:
        return {"ok": False, "intent_count": count, "message": f"该标签已关联 {count} 条意图，确认删除?"}
    db.delete(tag)
    db.commit()
    return {"ok": True, "intent_count": 0}


@router.delete("/tags/{tag_id}/force")
def force_delete_tag(tag_id: int, db: Session = Depends(get_session)):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    # Remove from intents
    old_name = tag.name
    intents = db.query(TradeIntent).all()
    for intent in intents:
        tags = json.loads(intent.tags or "[]")
        if old_name in tags:
            tags = [t for t in tags if t != old_name]
            intent.tags = json.dumps(tags, ensure_ascii=False)
    db.delete(tag)
    db.commit()
    return {"ok": True}
