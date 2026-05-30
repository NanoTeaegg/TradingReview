import asyncio
import logging
import pathlib
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import setup_logging

from app.api.routes import (
    accounts, imports, trades, positions, intents, tags, stats, market, reviews, rules, cash_flows, settings as settings_router
)
from app.services.sentiment import ensure_startup_market_sentiment_snapshot, run_market_sentiment_scheduler

logger = logging.getLogger(__name__)

_DEMO_XLS = pathlib.Path(__file__).parent.parent.parent / "demo" / "20260421_20260528_demo.xls"


def _seed_demo_if_empty() -> None:
    """如果「模拟数据」账本没有交易记录，自动导入演示数据。"""
    if not _DEMO_XLS.exists():
        return
    try:
        from app.core.db import SessionLocal
        from app.models.account import Account
        from app.models.trade import Trade
        from app.services.importer import import_file

        db = SessionLocal()
        try:
            demo = db.query(Account).filter(Account.name == "模拟数据").first()
            if not demo:
                return
            count = db.query(Trade).filter(Trade.account_id == demo.id).count()
            if count > 0:
                return
            content = _DEMO_XLS.read_bytes()
            result = import_file(db, _DEMO_XLS.name, content, account_id=demo.id)
            logger.info("auto-seeded demo account with %d trades", result.inserted)
        finally:
            db.close()
    except Exception:
        logger.exception("auto-seed demo data failed (non-fatal)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    stop_event = asyncio.Event()
    # 行情数据不在启动时自动拉取，改为页面按钮触发（首页「拉取最新」/设置「全量历史」）。
    await asyncio.to_thread(_seed_demo_if_empty)
    startup_task = asyncio.create_task(asyncio.to_thread(ensure_startup_market_sentiment_snapshot))
    scheduler_task = asyncio.create_task(run_market_sentiment_scheduler(stop_event))
    app.state.market_sentiment_startup_task = startup_task
    app.state.market_sentiment_scheduler_task = scheduler_task
    yield
    stop_event.set()
    scheduler_task.cancel()
    for task in (startup_task, scheduler_task):
        if not task.done():
            task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass


app = FastAPI(title="TradingReview API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    from sqlalchemy import text
    from app.core.db import SessionLocal
    db = SessionLocal()
    try:
        result = db.execute(text("PRAGMA journal_mode")).fetchone()
        return {"status": "ok", "journal_mode": result[0] if result else "unknown"}
    finally:
        db.close()


app.include_router(imports.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(trades.router, prefix="/api")
app.include_router(positions.router, prefix="/api")
app.include_router(intents.router, prefix="/api")
app.include_router(tags.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(market.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(rules.router, prefix="/api")
app.include_router(cash_flows.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
