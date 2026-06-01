import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import setup_logging

from app.api.routes import (
    accounts, imports, trades, positions, intents, tags, stats, market, reviews, rules, cash_flows, settings as settings_router
)
from app.services.market_sync import ensure_trade_calendar_bootstrap
from app.services.sentiment import ensure_startup_market_sentiment_snapshot, run_market_sentiment_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    stop_event = asyncio.Event()
    # 行情日线仍由页面按钮触发；启动阶段只在本地交易日历为空时做一次 trade_cal 初始化。
    startup_task = asyncio.create_task(asyncio.to_thread(ensure_startup_market_sentiment_snapshot))
    calendar_bootstrap_task = asyncio.create_task(asyncio.to_thread(ensure_trade_calendar_bootstrap))
    scheduler_task = asyncio.create_task(run_market_sentiment_scheduler(stop_event))
    app.state.market_sentiment_startup_task = startup_task
    app.state.market_calendar_bootstrap_task = calendar_bootstrap_task
    app.state.market_sentiment_scheduler_task = scheduler_task
    yield
    stop_event.set()
    scheduler_task.cancel()
    for task in (startup_task, calendar_bootstrap_task, scheduler_task):
        if not task.done():
            task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass


app = FastAPI(title="TradingReview API", version="0.2.1", lifespan=lifespan)

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
