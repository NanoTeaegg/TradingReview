"""Assemble review prompt and stream from the configured LLM provider."""
import logging
from datetime import date, datetime
from typing import AsyncGenerator, Optional

import httpx
from sqlalchemy.orm import Session

from app.models.review import ReviewReport
from app.models.trade import Trade
from app.models.intent import TradeIntent
from app.services.llm import LLMConfig, get_llm_config
from app.services.rules import get_current_rule

logger = logging.getLogger("tradingreview.review")


def _build_snapshot(db: Session, scope: str, trade_id: Optional[int], stock_code: Optional[str],
                    period_start: Optional[date], period_end: Optional[date], account_id: int) -> dict:
    trades_q = db.query(Trade).filter(Trade.account_id == account_id)
    intents_q = db.query(TradeIntent).filter(TradeIntent.account_id == account_id)

    if scope == "trade" and trade_id:
        trade = db.query(Trade).filter(Trade.id == trade_id, Trade.account_id == account_id).first()
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

    rule = get_current_rule(db, account_id=account_id)
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
        "tags": [t.name for t in i.tag_objects],
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


async def _stream_ollama(config: LLMConfig, prompt: str) -> AsyncGenerator[str, None]:
    payload = {
        "model": config.model,
        "stream": True,
        "messages": [{"role": "user", "content": prompt}],
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", f"{config.base_url.rstrip('/')}/api/chat", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                token = data.get("message", {}).get("content", "")
                if token:
                    yield token
                if data.get("done"):
                    break


async def _stream_openai_compatible(config: LLMConfig, prompt: str) -> AsyncGenerator[str, None]:
    payload = {
        "model": config.model,
        "stream": True,
        "messages": [{"role": "user", "content": prompt}],
    }
    headers = {"Authorization": f"Bearer {config.api_key}"} if config.api_key else {}
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{config.base_url.rstrip('/')}/chat/completions",
            json=payload,
            headers=headers,
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data:"):
                    continue
                chunk = line.removeprefix("data:").strip()
                if not chunk or chunk == "[DONE]":
                    break
                try:
                    data = json.loads(chunk)
                except json.JSONDecodeError:
                    continue
                choices = data.get("choices") or []
                if not choices:
                    continue
                token = choices[0].get("delta", {}).get("content", "")
                if token:
                    yield token


async def stream_review(
    db: Session,
    scope: str,
    trade_id: Optional[int] = None,
    stock_code: Optional[str] = None,
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
    account_id: Optional[int] = None,
) -> AsyncGenerator[str, None]:
    if account_id is None:
        from app.api.deps import ensure_default_account
        account_id = ensure_default_account(db).id
    snapshot = _build_snapshot(db, scope, trade_id, stock_code, period_start, period_end, account_id)
    prompt = _build_prompt(snapshot)
    rule_version_id = snapshot.get("rule_version_id")
    config = get_llm_config(db)

    full_content = []

    try:
        stream = (
            _stream_ollama(config, prompt)
            if config.provider == "ollama"
            else _stream_openai_compatible(config, prompt)
        )
        async for token in stream:
            full_content.append(token)
            yield f"data: {json.dumps({'token': token}, ensure_ascii=False)}\n\n"
    except Exception as e:
        logger.error(f"LLM stream error: {e}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

    content = "".join(full_content)
    if content:
        q = db.query(ReviewReport).filter(
            ReviewReport.account_id == account_id,
            ReviewReport.scope == scope,
        )
        if scope == "stock":
            q = q.filter(ReviewReport.stock_code == stock_code)
        elif scope == "trade":
            q = q.filter(ReviewReport.trade_id == trade_id)
        elif scope == "period":
            q = q.filter(ReviewReport.period_start == period_start, ReviewReport.period_end == period_end)
        existing = q.first()

        if existing:
            existing.content = content
            existing.provider = config.provider
            existing.model = config.model
            existing.rule_version_id = rule_version_id
            existing.input_snapshot = json.dumps(snapshot, ensure_ascii=False)
            existing.created_at = datetime.utcnow()
        else:
            db.add(ReviewReport(
                account_id=account_id,
                scope=scope,
                trade_id=trade_id,
                stock_code=stock_code,
                period_start=period_start,
                period_end=period_end,
                content=content,
                provider=config.provider,
                model=config.model,
                rule_version_id=rule_version_id,
                input_snapshot=json.dumps(snapshot, ensure_ascii=False),
            ))
        db.commit()

    yield "data: [DONE]\n\n"
