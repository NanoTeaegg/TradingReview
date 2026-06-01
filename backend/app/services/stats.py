"""Statistics: win-rate, discipline, turnover, tag performance."""
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy.orm import Session

from app.models.market_cache import MarketDailyBar
from app.models.trade import Trade
from app.services.market import STOCK
from app.models.intent import Tag, TradeIntent, intent_tag_link
from app.services.pnl import run_fifo, _load_trades, RoundTrip, ZERO, Q2, _funded_cash_and_holdings


LOW_TURNOVER_THRESHOLD = 0.8
HIGH_TURNOVER_THRESHOLD = 1.5


def get_win_rate(db: Session, tag: Optional[str] = None, account_id: Optional[int] = None) -> dict:
    trades = _load_trades(db, account_id=account_id)
    _, round_trips = run_fifo(trades)

    if tag:
        # Find all trade_ids linked to the named tag via the join table
        q = (
            db.query(TradeIntent.trade_id)
            .join(intent_tag_link, intent_tag_link.c.intent_id == TradeIntent.id)
            .join(Tag, Tag.id == intent_tag_link.c.tag_id)
            .filter(Tag.name == tag, TradeIntent.trade_id.isnot(None))
        )
        if account_id is not None:
            q = q.filter(TradeIntent.account_id == account_id)
        tagged_trade_ids = {row[0] for row in q.all()}
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


def get_discipline(db: Session, account_id: Optional[int] = None) -> dict:
    trades_q = db.query(Trade).filter(Trade.side.in_(["buy", "sell"]))
    intents_q = db.query(TradeIntent).filter(TradeIntent.trade_id.isnot(None))
    if account_id is not None:
        trades_q = trades_q.filter(Trade.account_id == account_id)
        intents_q = intents_q.filter(TradeIntent.account_id == account_id)

    total = trades_q.count()
    if total == 0:
        return {"tagged_count": 0, "total_count": 0, "discipline_rate": 0.0, "warning": False}

    intents = intents_q.all()
    tagged_ids = {i.trade_id for i in intents}
    tagged = trades_q.filter(
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


def get_turnover(db: Session, account_id: Optional[int] = None) -> list[dict]:
    """Weekly turnover trend from the first trade to today.

    周换手率 = 本周买卖成交额 / 本周平均持仓市值。
    持仓市值优先取本地日线收盘价；缺失时回退到持仓成本价，避免行情缺口导致趋势断裂。
    """
    today = date.today()
    current_week_start = today - timedelta(days=today.weekday())

    q = db.query(Trade).order_by(Trade.trade_date, Trade.seq, Trade.id)
    if account_id is not None:
        q = q.filter(Trade.account_id == account_id)
    all_trades = q.all()

    if not all_trades:
        fallback_weeks = [current_week_start - timedelta(weeks=i) for i in range(11, -1, -1)]
        return [_empty_week_turnover(ws, min(ws + timedelta(days=6), today)) for ws in fallback_weeks]

    # Generate all weeks from the first trade's week to the current week
    first_date = all_trades[0].trade_date
    first_week_start = first_date - timedelta(days=first_date.weekday())
    weeks = []
    w = first_week_start
    while w <= current_week_start:
        weeks.append(w)
        w += timedelta(weeks=1)

    first_day = weeks[0]
    bar_rows = (
        db.query(MarketDailyBar)
        .filter(
            MarketDailyBar.instrument_type == STOCK,
            MarketDailyBar.trade_date >= first_day - timedelta(days=10),
            MarketDailyBar.trade_date <= today,
        )
        .order_by(MarketDailyBar.ts_code, MarketDailyBar.trade_date)
        .all()
    )
    prices_by_code: dict[str, list[tuple[date, Decimal]]] = defaultdict(list)
    for row in bar_rows:
        prices_by_code[row.ts_code].append((row.trade_date, row.close))

    results = []
    for week_start in weeks:
        week_end = min(week_start + timedelta(days=6), today)
        week_trades = [
            t for t in all_trades
            if week_start <= t.trade_date <= week_end and t.side in ("buy", "sell")
        ]

        buy_trades = [t for t in week_trades if t.side == "buy"]
        sell_trades = [t for t in week_trades if t.side == "sell"]
        buy_amount = sum((t.amount for t in buy_trades), ZERO)
        sell_amount = sum((t.amount for t in sell_trades), ZERO)
        total_amount = buy_amount + sell_amount

        daily_values = []
        for offset in range((week_end - week_start).days + 1):
            day = week_start + timedelta(days=offset)
            trades_up_to = [t for t in all_trades if t.trade_date <= day]

            def price_for(ts_code, real_lots, _day=day):
                close = _latest_close_on_or_before(prices_by_code.get(ts_code or "", []), _day)
                if close is not None:
                    return close
                qty = sum(l.qty for l in real_lots)
                cost = sum((l.price * l.qty for l in real_lots), ZERO)
                return (cost / qty).quantize(Q2, ROUND_HALF_UP) if qty else ZERO

            _, holding_value = _funded_cash_and_holdings(trades_up_to, price_for)
            daily_values.append(holding_value)

        avg_holding_value = (
            sum(daily_values, ZERO) / Decimal(len(daily_values))
            if daily_values else ZERO
        )
        turnover = float(total_amount / avg_holding_value) if avg_holding_value > ZERO else None
        level = _turnover_level(turnover)

        results.append({
            "week": f"{week_start.isocalendar().year}-W{week_start.isocalendar().week:02d}",
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "volume": str(total_amount.quantize(Q2, ROUND_HALF_UP)),
            "avg_holding_value": str(avg_holding_value.quantize(Q2, ROUND_HALF_UP)),
            "buy_amount": str(buy_amount.quantize(Q2, ROUND_HALF_UP)),
            "sell_amount": str(sell_amount.quantize(Q2, ROUND_HALF_UP)),
            "buy_count": len(buy_trades),
            "sell_count": len(sell_trades),
            "trade_count": len(week_trades),
            "turnover_rate": round(turnover, 4) if turnover is not None else None,
            "level": level,
            "warning": level in ("frequent", "high"),
        })

    return results


def _empty_week_turnover(week_start: date, week_end: date) -> dict:
    return {
        "week": f"{week_start.isocalendar().year}-W{week_start.isocalendar().week:02d}",
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "volume": "0.00",
        "avg_holding_value": "0.00",
        "buy_amount": "0.00",
        "sell_amount": "0.00",
        "buy_count": 0,
        "sell_count": 0,
        "trade_count": 0,
        "turnover_rate": None,
        "level": "none",
        "warning": False,
    }


def _latest_close_on_or_before(prices: list[tuple[date, Decimal]], target: date) -> Decimal | None:
    latest = None
    for trade_date, close in prices:
        if trade_date > target:
            break
        latest = close
    return latest


def _turnover_level(turnover: float | None) -> str:
    if turnover is None:
        return "none"
    if turnover >= HIGH_TURNOVER_THRESHOLD:
        return "high"
    if turnover >= LOW_TURNOVER_THRESHOLD:
        return "frequent"
    return "normal"


def get_tag_performance(db: Session, account_id: Optional[int] = None) -> list[dict]:
    """Per-tag stats: count, win_rate, avg_pnl, avg_hold_days."""
    trades = _load_trades(db, account_id=account_id)
    _, round_trips = run_fifo(trades)
    trade_date_map = {t.id: t.trade_date for t in trades}

    # Build trade_id → tag names map via the join table
    rows = (
        db.query(TradeIntent.trade_id, Tag.name)
        .join(intent_tag_link, intent_tag_link.c.intent_id == TradeIntent.id)
        .join(Tag, Tag.id == intent_tag_link.c.tag_id)
        .filter(TradeIntent.trade_id.isnot(None))
    )
    if account_id is not None:
        rows = rows.filter(TradeIntent.account_id == account_id)
    trade_intent_map: dict[int, list[str]] = {}
    for trade_id, tag_name in rows.all():
        trade_intent_map.setdefault(trade_id, []).append(tag_name)

    tag_rts: dict[str, list[RoundTrip]] = {}
    for rt in round_trips:
        for tag_name in trade_intent_map.get(rt.sell_trade_id, []):
            tag_rts.setdefault(tag_name, []).append(rt)

    tags_q = db.query(Tag)
    if account_id is not None:
        tags_q = tags_q.filter(Tag.account_id == account_id)
    all_tags = tags_q.all()

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
