"""Assemble review prompt and stream from Ollama."""
import json
import logging
from datetime import date
from typing import AsyncGenerator, Optional

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.review import ReviewReport
from app.models.trade import Trade
from app.models.intent import TradeIntent
from app.services.rules import get_current_rule

logger = logging.getLogger("tradingreview.review")


def _build_snapshot(db: Session, scope: str, trade_id: Optional[int], stock_code: Optional[str],
                    period_start: Optional[date], period_end: Optional[date]) -> dict:
    trades_q = db.query(Trade)
    intents_q = db.query(TradeIntent)

    if scope == "trade" and trade_id:
        trade = db.query(Trade).filter(Trade.id == trade_id).first()
        trades_data = [_trade_dict(trade)] if trade else []
        intents = intents_q.filter(TradeIntent.trade_id == trade_id).all()
    elif scope == "stock" and stock_code:
        trades_data = [_trade_dict(t) for t in trades_q.filter(Trade.stock_code == stock_code).order_by(Trade.trade_date).all()]
        intents = intents_q.filter(TradeIntent.stock_code == stock_code).all()
    elif scope == "period" and period_start and period_end:
        trades_data = [_trade_dict(t) for t in trades_q.filter(
            Trade.trade_date >= period_start, Trade.trade_date <= period_end
        ).order_by(Trade.trade_date).all()]
        intents = intents_q.all()
    else:
        trades_data = []
        intents = []

    rule = get_current_rule(db)
    rule_content = rule.content if rule else ""
    rule_version_id = rule.id if rule else None

    return {
        "scope": scope,
        "trades": trades_data,
        "intents": [_intent_dict(i) for i in intents],
        "rule": rule_content,
        "rule_version_id": rule_version_id,
    }


def _trade_dict(t: Trade) -> dict:
    return {
        "id": t.id,
        "trade_date": t.trade_date.isoformat(),
        "stock_code": t.stock_code,
        "stock_name": t.stock_name,
        "side": t.side,
        "price": str(t.price),
        "quantity": t.quantity,
        "amount": str(t.amount),
        "fee": str(t.fee),
        "market": t.market,
    }


def _intent_dict(i: TradeIntent) -> dict:
    return {
        "id": i.id,
        "trade_id": i.trade_id,
        "stock_code": i.stock_code,
        "tags": json.loads(i.tags or "[]"),
        "thesis": i.thesis,
        "confidence": i.confidence,
    }


def _build_prompt(snapshot: dict) -> str:
    rule = snapshot.get("rule", "")
    trades_json = json.dumps(snapshot.get("trades", []), ensure_ascii=False, indent=2)
    intents_json = json.dumps(snapshot.get("intents", []), ensure_ascii=False, indent=2)

    return f"""你是一位专业的交易复盘助手。请根据以下交易数据和交易规则，进行深入的复盘分析。

## 交易规则
{rule or "（未设置交易规则）"}

## 交易记录
{trades_json}

## 交易意图与标签
{intents_json}

## 复盘要求
请从以下维度进行分析：
1. 交易执行是否符合规则
2. 买卖时机是否合理
3. 仓位管理评估
4. 优点与改进建议
5. 总体评分与核心教训

请用中文回答，结构清晰，言简意赅。"""


async def stream_review(
    db: Session,
    scope: str,
    trade_id: Optional[int] = None,
    stock_code: Optional[str] = None,
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
) -> AsyncGenerator[str, None]:
    snapshot = _build_snapshot(db, scope, trade_id, stock_code, period_start, period_end)
    prompt = _build_prompt(snapshot)
    rule_version_id = snapshot.get("rule_version_id")

    ollama_url = f"{settings.OLLAMA_BASE_URL}/api/chat"
    payload = {
        "model": settings.OLLAMA_MODEL,
        "stream": True,
        "messages": [{"role": "user", "content": prompt}],
    }

    full_content = []

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", ollama_url, json=payload) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                        token = data.get("message", {}).get("content", "")
                        if token:
                            full_content.append(token)
                            yield f"data: {json.dumps({'token': token}, ensure_ascii=False)}\n\n"
                        if data.get("done"):
                            break
                    except json.JSONDecodeError:
                        continue
    except Exception as e:
        logger.error(f"Ollama stream error: {e}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

    content = "".join(full_content)
    if content:
        report = ReviewReport(
            scope=scope,
            trade_id=trade_id,
            stock_code=stock_code,
            period_start=period_start,
            period_end=period_end,
            content=content,
            model=settings.OLLAMA_MODEL,
            rule_version_id=rule_version_id,
            input_snapshot=json.dumps(snapshot, ensure_ascii=False),
        )
        db.add(report)
        db.commit()

    yield "data: [DONE]\n\n"
