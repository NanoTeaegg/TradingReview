"""Statistics: win-rate, discipline, turnover, tag performance."""
import json
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy.orm import Session

from app.models.trade import Trade
from app.models.intent import TradeIntent
from app.services.pnl import run_fifo, _load_trades, RoundTrip, ZERO, Q2


def get_win_rate(db: Session, tag: Optional[str] = None) -> dict:
    trades = _load_trades(db)
    _, round_trips = run_fifo(trades)

    if tag:
        intents = db.query(TradeIntent).all()
        tagged_trade_ids: set[int] = set()
        for intent in intents:
            tags = json.loads(intent.tags or "[]")
            if tag in tags and intent.trade_id:
                tagged_trade_ids.add(intent.trade_id)
        round_trips = [rt for rt in round_trips if rt.sell_trade_id in tagged_trade_ids]

    wins = [rt for rt in round_trips if rt.net_pnl > ZERO]
    losses = [rt for rt in round_trips if rt.net_pnl <= ZERO]
    total = len(round_trips)

    win_rate = len(wins) / total if total > 0 else 0.0
    avg_win = sum(rt.net_pnl for rt in wins) / len(wins) if wins else ZERO
    avg_loss = sum(rt.net_pnl for rt in losses) / len(losses) if losses else ZERO
    pnl_ratio = float(abs(avg_win) / abs(avg_loss)) if avg_loss != ZERO else None

    return {
        "total": total,
        "win_count": len(wins),
        "loss_count": len(losses),
        "win_rate": round(win_rate, 4),
        "avg_win": str(avg_win.quantize(Q2, ROUND_HALF_UP)),
        "avg_loss": str(avg_loss.quantize(Q2, ROUND_HALF_UP)),
        "pnl_ratio": round(pnl_ratio, 4) if pnl_ratio is not None else None,
    }


def get_discipline(db: Session) -> dict:
    total = db.query(Trade).filter(Trade.side.in_(["buy", "sell"])).count()
    if total == 0:
        return {"tagged_count": 0, "total_count": 0, "discipline_rate": 0.0, "warning": False}

    intents = db.query(TradeIntent).filter(TradeIntent.trade_id.isnot(None)).all()
    tagged_ids = {i.trade_id for i in intents}
    tagged = db.query(Trade).filter(
        Trade.side.in_(["buy", "sell"]),
        Trade.id.in_(tagged_ids)
    ).count()

    rate = tagged / total
    return {
        "tagged_count": tagged,
        "total_count": total,
        "discipline_rate": round(rate, 4),
        "warning": rate < 0.6,
    }


def get_turnover(db: Session) -> list[dict]:
    """Monthly turnover for last 6 months."""
    from app.services.pnl import get_positions
    today = date.today()
    months = []
    for i in range(5, -1, -1):
        first = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
        # build proper month offset
        month = (today.month - i - 1) % 12 + 1
        year = today.year + (today.month - i - 2) // 12
        months.append(date(year, month, 1))

    results = []
    for month_start in months:
        # Month end
        if month_start.month == 12:
            month_end = date(month_start.year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = date(month_start.year, month_start.month + 1, 1) - timedelta(days=1)

        month_str = month_start.strftime("%Y-%m")

        monthly_volume = db.query(Trade).filter(
            Trade.trade_date >= month_start,
            Trade.trade_date <= month_end,
            Trade.side.in_(["buy", "sell"]),
        ).with_entities(Trade.amount).all()

        total_amount = sum(Decimal(str(r[0])) for r in monthly_volume)

        # Month-start holdings value (approximate)
        trades_before = db.query(Trade).filter(Trade.trade_date < month_start).all()
        if trades_before:
            lots, _ = run_fifo(trades_before)
            start_value = sum(
                lot.price * lot.qty
                for code_lots in lots.values()
                for lot in code_lots
            )
        else:
            start_value = ZERO

        turnover = float(total_amount / start_value) if start_value > ZERO else None
        results.append({
            "month": month_str,
            "volume": str(total_amount.quantize(Q2, ROUND_HALF_UP)),
            "start_value": str(start_value.quantize(Q2, ROUND_HALF_UP)),
            "turnover_rate": round(turnover, 4) if turnover is not None else None,
            "warning": (turnover is not None and turnover > 2.0),
        })

    return results


def get_tag_performance(db: Session) -> list[dict]:
    """Per-tag stats: count, win_rate, avg_pnl, avg_hold_days."""
    trades = _load_trades(db)
    _, round_trips = run_fifo(trades)
    trade_date_map = {t.id: t.trade_date for t in trades}

    intents = db.query(TradeIntent).all()
    trade_intent_map: dict[int, list[str]] = {}
    for intent in intents:
        if intent.trade_id:
            tags = json.loads(intent.tags or "[]")
            trade_intent_map.setdefault(intent.trade_id, []).extend(tags)

    tag_rts: dict[str, list[RoundTrip]] = {}
    for rt in round_trips:
        sell_id = rt.sell_trade_id
        tags = trade_intent_map.get(sell_id, [])
        for tag in tags:
            tag_rts.setdefault(tag, []).append(rt)

    all_tags = db.query(
        __import__("app.models.intent", fromlist=["Tag"]).Tag
    ).all()

    results = []
    for tag_obj in all_tags:
        tag_name = tag_obj.name
        rts = tag_rts.get(tag_name, [])
        wins = [rt for rt in rts if rt.net_pnl > ZERO]
        win_rate = len(wins) / len(rts) if rts else 0.0
        avg_pnl = sum(rt.net_pnl for rt in rts) / len(rts) if rts else ZERO
        avg_hold = (
            sum((rt.close_date - rt.open_date).days for rt in rts) / len(rts)
            if rts else 0.0
        )
        results.append({
            "tag": tag_name,
            "count": len(rts),
            "win_rate": round(win_rate, 4),
            "avg_pnl": str(avg_pnl.quantize(Q2, ROUND_HALF_UP)),
            "avg_hold_days": round(avg_hold, 1),
        })

    return results
