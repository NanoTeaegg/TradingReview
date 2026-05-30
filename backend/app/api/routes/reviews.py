from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.models.review import ReviewReport
from app.services.review import stream_review

router = APIRouter(tags=["reviews"])


class ReviewRequest(BaseModel):
    scope: str  # trade / stock / period
    trade_id: Optional[int] = None
    stock_code: Optional[str] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None


@router.post("/reviews")
async def create_review(body: ReviewRequest, db: Session = Depends(get_session)):
    if body.scope not in ("trade", "stock", "period"):
        raise HTTPException(status_code=400, detail="scope must be trade/stock/period")

    async def generator():
        async for chunk in stream_review(
            db,
            scope=body.scope,
            trade_id=body.trade_id,
            stock_code=body.stock_code,
            period_start=body.period_start,
            period_end=body.period_end,
        ):
            yield chunk

    return StreamingResponse(generator(), media_type="text/event-stream")


@router.get("/reviews")
def list_reviews(db: Session = Depends(get_session)):
    reports = db.query(ReviewReport).order_by(ReviewReport.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "scope": r.scope,
            "scope_desc": _scope_desc(r),
            "model": r.model,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "trade_id": r.trade_id,
            "stock_code": r.stock_code,
        }
        for r in reports
    ]


@router.get("/reviews/{review_id}")
def get_review(review_id: int, db: Session = Depends(get_session)):
    report = db.query(ReviewReport).filter(ReviewReport.id == review_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Review not found")
    return {
        "id": report.id,
        "scope": report.scope,
        "scope_desc": _scope_desc(report),
        "content": report.content,
        "model": report.model,
        "rule_version_id": report.rule_version_id,
        "input_snapshot": report.input_snapshot,
        "created_at": report.created_at.isoformat() if report.created_at else None,
        "trade_id": report.trade_id,
        "stock_code": report.stock_code,
        "period_start": report.period_start.isoformat() if report.period_start else None,
        "period_end": report.period_end.isoformat() if report.period_end else None,
    }


def _scope_desc(r: ReviewReport) -> str:
    if r.scope == "trade" and r.trade_id:
        return f"单笔交易 #{r.trade_id}"
    elif r.scope == "stock" and r.stock_code:
        return f"{r.stock_code} — 全程复盘"
    elif r.scope == "period" and r.period_start:
        return f"{r.period_start} ~ {r.period_end} 区间复盘"
    return r.scope
