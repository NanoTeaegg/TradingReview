from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import setup_logging

from app.api.routes import (
    imports, trades, positions, intents, tags, stats, market, reviews, rules, settings as settings_router
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    yield


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
app.include_router(trades.router, prefix="/api")
app.include_router(positions.router, prefix="/api")
app.include_router(intents.router, prefix="/api")
app.include_router(tags.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(market.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(rules.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
