from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.services import stats

router = APIRouter(tags=["stats"])


@router.get("/stats/win-rate")
def win_rate(tag: Optional[str] = Query(None), db: Session = Depends(get_session)):
    return stats.get_win_rate(db, tag=tag)


@router.get("/stats/discipline")
def discipline(db: Session = Depends(get_session)):
    return stats.get_discipline(db)


@router.get("/stats/turnover")
def turnover(db: Session = Depends(get_session)):
    return stats.get_turnover(db)


@router.get("/stats/tag-performance")
def tag_performance(db: Session = Depends(get_session)):
    return stats.get_tag_performance(db)
