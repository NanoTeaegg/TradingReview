"""FIFO P&L engine + positions + equity curve + performance summary."""
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy.orm import Session

from app.models.cash_flow import CashFlow
from app.models.market_cache import MarketDailyBar
from app.models.trade import Trade
from app.services.market import STOCK, MarketDataProvider
from app.services.sentiment import latest_market_date


Q4 = Decimal("0.0001")
Q2 = Decimal("0.01")
ZERO = Decimal("0")


def _latest_local_stock_bar_date(db: Session) -> date | None:
    return (
        db.query(MarketDailyBar.trade_date)
        .filter(MarketDailyBar.instrument_type == STOCK)
        .order_by(MarketDailyBar.trade_date.desc())
        .limit(1)
        .scalar()
    )


@dataclass
class Lot:
    qty: int
    price: Decimal
    fee_total: Decimal
    is_transfer: bool = False


@dataclass
class RoundTrip:
    stock_code: str
    buy_trade_id: Optional[int]
    sell_trade_id: Optional[int]
    qty: int
    buy_cost: Decimal
    buy_fee: Decimal
    sell_amount: Decimal
    sell_fee: Decimal
    net_pnl: Decimal
    open_date: date
    close_date: date
    buy_tags: list[str] = field(default_factory=list)


def _load_trades(db: Session, stock_code: Optional[str] = None, account_id: Optional[int] = None) -> list[Trade]:
    q = db.query(Trade).order_by(Trade.trade_date, Trade.seq, Trade.id)
    if account_id is not None:
        q = q.filter(Trade.account_id == account_id)
    if stock_code:
        q = q.filter(Trade.stock_code == stock_code)
    return q.all()


def _load_cash_flows(db: Session, account_id: Optional[int] = None) -> list[CashFlow]:
    q = db.query(CashFlow).order_by(CashFlow.flow_date, CashFlow.id)
    if account_id is not None:
        q = q.filter(CashFlow.account_id == account_id)
    return q.all()


def _cash_flow_amount(row: CashFlow) -> Decimal:
    return row.amount if row.flow_type == "deposit" else -row.amount


def _net_deposit(rows: list[CashFlow]) -> Decimal:
    return sum((_cash_flow_amount(row) for row in rows), ZERO)


def _funded_cash_and_holdings(
    trades: list[Trade],
    price_for: "callable",
) -> tuple[Decimal, Decimal]:
    """以"出入金本金"口径回放交易，返回 (自有资金现金变动, 自有持仓市值)。

    担保品划入/划出视为无效数据：
    - 划入：仅登记为库存（不占用现金、不计入本金、不计入持仓市值）；
    - 卖出担保品：FIFO 命中划入批次的部分，其现金收入同样剔除（否则会凭空多出钱）；
    - 自有买入/卖出（用本金或融资买的票）正常计入现金与持仓。

    现金可为负数——融资账户允许买入金额超过本金，属正常，不影响以本金为基准的收益率。
    `price_for(ts_code, code_lots)` 返回该票当日收盘价（缺失时由调用方兜底）。
    """
    lots: dict[str, list[Lot]] = defaultdict(list)
    ts_code_of: dict[str, str] = {}
    cash = ZERO

    for t in trades:
        code = t.stock_code
        ts_code_of.setdefault(code, t.ts_code)
        if t.side == "buy":
            cash -= t.amount + t.fee
            lots[code].append(Lot(qty=t.quantity, price=t.price, fee_total=t.fee, is_transfer=False))
        elif t.side == "transfer_in":
            lots[code].append(Lot(qty=t.quantity, price=t.price, fee_total=t.fee, is_transfer=True))
        elif t.side == "transfer_out":
            remaining = t.quantity
            while remaining > 0 and lots[code]:
                lot = lots[code][0]
                consume = min(lot.qty, remaining)
                lot.qty -= consume
                remaining -= consume
                if lot.qty == 0:
                    lots[code].pop(0)
        elif t.side == "sell":
            remaining = t.quantity
            net_proceeds = t.amount - t.fee
            funded_qty = 0
            while remaining > 0 and lots[code]:
                lot = lots[code][0]
                consume = min(lot.qty, remaining)
                if not lot.is_transfer:
                    funded_qty += consume
                lot.qty -= consume
                remaining -= consume
                if lot.qty == 0:
                    lots[code].pop(0)
            # 无对应库存的卖出（罕见）按自有处理
            funded_qty += remaining
            if funded_qty == t.quantity:
                cash += net_proceeds
            elif funded_qty > 0:
                cash += (net_proceeds * Decimal(funded_qty) / Decimal(t.quantity)).quantize(Q4, ROUND_HALF_UP)

    holding_value = ZERO
    for code, code_lots in lots.items():
        real_lots = [l for l in code_lots if not l.is_transfer]
        qty = sum(l.qty for l in real_lots)
        if qty <= 0:
            continue
        close = price_for(ts_code_of.get(code), real_lots)
        holding_value += close * qty

    return cash, holding_value


def _twr_navs(points: list[tuple[Decimal, Decimal]]) -> list[float]:
    """时间加权净值序列（起点归一为 1.0）。

    points: 按日期排序的 [(当日账户权益, 当日出入金净流入)]。
    账户权益 = 累计净入金 + 自有现金变动 + 自有持仓市值（担保品已剔除）。
    每日收益率 r_t = 当日权益 / (前一日权益 + 当日净入金) − 1，
    净值 NAV_t = NAV_{t-1} × (1 + r_t)，从而剔除出入金对收益曲线的扰动；
    单笔入金场景下等价于「账户权益 / 本金」，起点为 1.0。
    """
    navs: list[float] = []
    prev_v: Optional[Decimal] = None
    nav = 1.0
    for value, flow in points:
        if prev_v is None:
            nav = 1.0
        else:
            denom = prev_v + flow
            if denom > ZERO:
                nav *= float(value / denom)
        navs.append(round(nav, 6))
        prev_v = value
    return navs


def run_fifo(trades: list[Trade]) -> tuple[dict[str, list[Lot]], list[RoundTrip]]:
    """Process trades with FIFO matching. Returns (remaining_lots, round_trips)."""
    lots: dict[str, list[Lot]] = defaultdict(list)
    round_trips: list[RoundTrip] = []

    for t in trades:
        code = t.stock_code
        if t.side in ("buy", "transfer_in"):
            lot = Lot(
                qty=t.quantity,
                price=t.price,
                fee_total=t.fee,
                is_transfer=(t.side == "transfer_in"),
            )
            lots[code].append(lot)
        elif t.side == "sell":
            remaining_qty = t.quantity
            sell_amount = t.amount
            sell_fee = t.fee

            while remaining_qty > 0 and lots[code]:
                lot = lots[code][0]
                consume = min(lot.qty, remaining_qty)

                # 担保品（划入批次）属无效数据：卖出时只消耗库存，不产生已实现盈亏
                if not lot.is_transfer:
                    ratio = Decimal(consume) / Decimal(lot.qty)

                    allocated_buy_cost = lot.price * consume
                    allocated_buy_fee = (lot.fee_total * ratio).quantize(Q4, ROUND_HALF_UP)
                    allocated_sell_amount = (sell_amount * Decimal(consume) / Decimal(t.quantity)).quantize(Q4, ROUND_HALF_UP)
                    allocated_sell_fee = (sell_fee * Decimal(consume) / Decimal(t.quantity)).quantize(Q4, ROUND_HALF_UP)

                    net = allocated_sell_amount - allocated_buy_cost - allocated_buy_fee - allocated_sell_fee

                    rt = RoundTrip(
                        stock_code=code,
                        buy_trade_id=None,
                        sell_trade_id=t.id,
                        qty=consume,
                        buy_cost=allocated_buy_cost,
                        buy_fee=allocated_buy_fee,
                        sell_amount=allocated_sell_amount,
                        sell_fee=allocated_sell_fee,
                        net_pnl=net,
                        open_date=t.trade_date,
                        close_date=t.trade_date,
                    )
                    round_trips.append(rt)

                lot.qty -= consume
                remaining_qty -= consume
                if lot.qty == 0:
                    lots[code].pop(0)

    return lots, round_trips


def _net_invested_by_code(trades: list[Trade]) -> dict[str, Decimal]:
    """每只股票当前持仓的净投入现金（摊薄/保本口径）。

    买入：净投入 += 成交额 + 手续费
    担保品划入：视为无效数据，不计入自有持仓成本
    卖出：净投入 -= 卖出收入(成交额 − 手续费)，已实现盈亏因此留在剩余股的成本里
    清仓（持股归零）：净投入重置为 0，避免历史盈亏带入下一轮新建仓

    保本价 = 净投入 / 持仓股数；浮动盈亏 = 数量 ×(现价 − 保本价) 即含已实现的持仓盈亏。
    """
    shares: dict[str, int] = defaultdict(int)
    invested: dict[str, Decimal] = defaultdict(lambda: ZERO)
    for t in trades:
        code = t.stock_code
        if t.side == "buy":
            shares[code] += t.quantity
            invested[code] += t.amount + t.fee
        elif t.side == "transfer_in":
            # 担保品划入视为无效数据：不计入自有持仓成本
            continue
        elif t.side == "sell":
            shares[code] -= t.quantity
            invested[code] -= (t.amount - t.fee)
            if shares[code] <= 0:
                shares[code] = 0
                invested[code] = ZERO
    return invested


def get_positions(db: Session, account_id: Optional[int] = None) -> list[dict]:
    trades = _load_trades(db, account_id=account_id)
    lots, _ = run_fifo(trades)
    net_invested = _net_invested_by_code(trades)
    as_of_date = trades[-1].trade_date if trades else latest_market_date()
    price_date = _latest_local_stock_bar_date(db) or latest_market_date()

    provider = MarketDataProvider(db)
    ts_codes = list({
        next((t.ts_code for t in trades if t.stock_code == code), f"{code}.SZ")
        for code in lots
        if lots[code]
    })
    prices = {}
    if ts_codes:
        try:
            prices = provider.get_prices_on_date(ts_codes, price_date, allow_realtime_fallback=True)
        except Exception:
            pass

    stock_names = {t.stock_code: t.stock_name for t in trades}

    positions = []
    for code, all_lots in lots.items():
        # 担保品（划入批次）视为无效数据，不计入自有持仓
        code_lots = [l for l in all_lots if not l.is_transfer]
        if not code_lots:
            continue
        total_qty = sum(l.qty for l in code_lots)
        # 保本价（摊薄成本）：该票净投入现金 / 持仓股数，已实现盈亏折进剩余股成本
        invested = net_invested.get(code, ZERO)
        avg_cost = (invested / total_qty).quantize(Q4, ROUND_HALF_UP) if total_qty else ZERO

        ts_code = next((t.ts_code for t in trades if t.stock_code == code), f"{code}.SZ")
        price_info = prices.get(ts_code, {})
        latest_price = price_info.get("price", avg_cost)
        pre_close = price_info.get("pre_close", avg_cost)

        market_value = (latest_price * total_qty).quantize(Q2, ROUND_HALF_UP)
        # 持仓盈亏（含该票内部已实现）：数量 ×(现价 − 保本价)
        float_pnl = ((latest_price - avg_cost) * total_qty).quantize(Q2, ROUND_HALF_UP)
        float_pnl_rate = float(float_pnl / invested) if invested > ZERO else 0.0
        day_pnl = ((latest_price - pre_close) * total_qty).quantize(Q2, ROUND_HALF_UP)

        positions.append({
            "stock_code": code,
            "stock_name": stock_names.get(code, ""),
            "ts_code": ts_code,
            "as_of_date": as_of_date.isoformat(),
            "price_date": price_date.isoformat(),
            "quantity": total_qty,
            "avg_cost": str(avg_cost),
            "latest_price": str(latest_price),
            "market_value": str(market_value),
            "float_pnl": str(float_pnl),
            "float_pnl_rate": round(float_pnl_rate, 6),
            "day_pnl": str(day_pnl),
        })

    return positions


DEFAULT_BENCHMARKS: list[tuple[str, str]] = [
    ("000300.SH", "沪深300"),
    ("000001.SH", "上证综指"),
    ("399001.SZ", "深证成指"),
    ("399006.SZ", "创业板指"),
]


def _make_close_lookup(daily_map: dict[str, dict[date, Decimal]]):
    """返回 close_lookup(ts_code, td)：命中当日收盘价，缺失则顺延最近已知收盘价。"""
    def lookup(ts_code: Optional[str], td: date) -> Optional[Decimal]:
        m = daily_map.get(ts_code or "")
        if not m:
            return None
        close = m.get(td)
        if close is not None:
            return close
        prior = [(d, c) for d, c in m.items() if d <= td]
        if not prior:
            return None
        return max(prior, key=lambda x: x[0])[1]
    return lookup


def _build_daily_nav(
    trades: list[Trade],
    cash_flows: list[CashFlow],
    days: list[date],
    close_lookup,
) -> tuple[list[str], list[float], list[Decimal]]:
    """逐日构建时间加权净值序列（最佳实践：账户净值法）。

    每个交易日：账户总资产 = 累计净入金 + 自有现金变动 + 自有持仓市值（担保品已剔除）。
    持仓数量按累计买卖得到（与买卖顺序无关，无需 FIFO 成本配对）。
    净值采用时间加权（TWR），剔除出入金扰动，本金口径为累计净入金。
    返回 (日期 ISO 列表, 净值列表起点 1.0, 当日账户总资产列表)。
    """
    dates_out: list[str] = []
    assets_out: list[Decimal] = []
    points: list[tuple[Decimal, Decimal]] = []

    for td in days:
        trades_up_to = [t for t in trades if t.trade_date <= td]
        net_deposit = _net_deposit([f for f in cash_flows if f.flow_date <= td])
        if net_deposit <= ZERO:
            continue

        def price_for(ts_code, real_lots, _td=td):
            close = close_lookup(ts_code, _td)
            if close is not None:
                return close
            qty = sum(l.qty for l in real_lots)
            cost = sum((l.price * l.qty for l in real_lots), ZERO)
            return (cost / qty).quantize(Q4, ROUND_HALF_UP) if qty else ZERO

        cash_delta, holding_value = _funded_cash_and_holdings(trades_up_to, price_for)
        total_assets = net_deposit + cash_delta + holding_value
        flow_today = sum((_cash_flow_amount(f) for f in cash_flows if f.flow_date == td), ZERO)

        dates_out.append(td.isoformat())
        assets_out.append(total_assets)
        points.append((total_assets, flow_today))

    navs = _twr_navs(points)
    return dates_out, navs, assets_out


def _compute_equity_series(
    db: Session,
    trades: list[Trade],
    cash_flows: list[CashFlow],
) -> tuple[list[str], list[float], list[Decimal]]:
    """构建与净值曲线 API 一致的 (日期, TWR 净值, 当日总资产) 序列。"""
    if not cash_flows:
        return [], [], []

    first_trade_date = trades[0].trade_date if trades else None
    first_flow_date = cash_flows[0].flow_date if cash_flows else None
    first_date = min(d for d in (first_trade_date, first_flow_date) if d is not None)
    today = date.today()

    provider = MarketDataProvider(db)
    trade_days = provider.trade_cal(first_date, today)
    if not trade_days:
        return [], [], []

    all_codes = list({t.ts_code for t in trades})
    daily_map: dict[str, dict[date, Decimal]] = {}
    for ts_code in all_codes:
        rows = provider.get_daily(ts_code, first_date, today)
        daily_map[ts_code] = {td: close for td, close, _ in rows}

    return _build_daily_nav(trades, cash_flows, trade_days, _make_close_lookup(daily_map))


def _account_cumulative_profit(
    assets: list[Decimal],
    dates: list[str],
    cash_flows: list[CashFlow],
) -> Decimal:
    """账户累计盈亏（金额），与前端收益率走势「累计收益」在「全部」区间口径一致。

    期末总资产 − 期初总资产 − 区间内净出入金；手续费已体现在现金与持仓市值中，不单独扣减。
    """
    if not assets or not dates:
        return ZERO
    start, end = dates[0], dates[-1]
    net_flow = sum(
        (_cash_flow_amount(f) for f in cash_flows if start < f.flow_date.isoformat() <= end),
        ZERO,
    )
    return assets[-1] - assets[0] - net_flow


def get_equity_curve(
    db: Session,
    benchmarks: Optional[list[tuple[str, str]]] = None,
    account_id: Optional[int] = None,
) -> dict:
    """账户收益率走势：时间加权净值 + 多基准 + 当日总资产 + 出入金流水。

    收益率口径以累计净入金（出入金）为本金；担保品划入/划出视为无效数据剔除。
    前端按所选区间对净值/指数二次归一（区间起点为 0%）。
    """
    benchmarks = benchmarks or DEFAULT_BENCHMARKS
    empty = {"dates": [], "nav": [], "total_assets": [], "flows": [], "benchmarks": []}

    trades = _load_trades(db, account_id=account_id)
    cash_flows = _load_cash_flows(db, account_id=account_id)
    if not cash_flows:
        return empty

    first_trade_date = trades[0].trade_date if trades else None
    first_flow_date = cash_flows[0].flow_date if cash_flows else None
    first_date = min(d for d in (first_trade_date, first_flow_date) if d is not None)
    today = date.today()

    dates_out, navs, assets = _compute_equity_series(db, trades, cash_flows)
    if not dates_out:
        return empty

    date_set = [date.fromisoformat(d) for d in dates_out]

    provider = MarketDataProvider(db)
    benchmarks_out = []
    for code, name in benchmarks:
        try:
            index_rows = provider.get_index_daily(code, first_date, today)
        except Exception:
            index_rows = []
        index_map = {td: close for td, close in index_rows}
        index_lookup = _make_close_lookup({code: index_map})
        nav_series: list[Optional[float]] = []
        base = None
        for d in date_set:
            close = index_lookup(code, d)
            if close is None or close <= ZERO:
                nav_series.append(None)
                continue
            if base is None:
                base = close
            nav_series.append(round(float(close / base), 6))
        benchmarks_out.append({"code": code, "name": name, "nav": nav_series})

    flows_out = [
        {"date": f.flow_date.isoformat(), "amount": float(_cash_flow_amount(f))}
        for f in cash_flows
        if first_date <= f.flow_date <= today
    ]

    return {
        "dates": dates_out,
        "nav": navs,
        "total_assets": [float(v) for v in assets],
        "flows": flows_out,
        "benchmarks": benchmarks_out,
    }


def get_performance_summary(db: Session, account_id: Optional[int] = None) -> dict:
    trades = _load_trades(db, account_id=account_id)
    cash_flows = _load_cash_flows(db, account_id=account_id)
    if not trades:
        net_deposit = _net_deposit(cash_flows)
        return {
            "total_realized": "0",
            "total_float": "0",
            "total_pnl": "0",
            "day_pnl": "0",
            "total_return_rate": 0.0 if net_deposit > ZERO else None,
            "max_drawdown": 0.0 if net_deposit > ZERO else None,
            "total_fee": "0",
            "net_deposit": str(net_deposit.quantize(Q2, ROUND_HALF_UP)),
        }

    _, round_trips = run_fifo(trades)

    positions = get_positions(db, account_id=account_id)
    held_codes = {p["stock_code"] for p in positions}
    # 保本价口径下，持仓中股票的已实现盈亏已折进保本价（计入 total_float），
    # 故累计已实现盈亏只统计已清仓股票，避免与持仓盈亏重复计算。
    total_realized = sum(
        (rt.net_pnl for rt in round_trips if rt.stock_code not in held_codes),
        ZERO,
    )
    total_float = sum((Decimal(p["float_pnl"]) for p in positions), ZERO)
    day_pnl = sum((Decimal(p["day_pnl"]) for p in positions), ZERO)

    total_fee = sum((t.fee for t in trades), ZERO)

    net_deposit = _net_deposit(cash_flows)
    # 总收益率、最大回撤、总盈亏与净值曲线 API 共用同一套逐日权益序列
    dates_out, navs, assets = _compute_equity_series(db, trades, cash_flows)
    total_return_rate = (navs[-1] - 1.0) if navs else (0.0 if net_deposit > ZERO else None)
    max_drawdown = _calc_max_drawdown(navs) if navs else None
    total_pnl = _account_cumulative_profit(assets, dates_out, cash_flows)

    return {
        "total_realized": str(total_realized.quantize(Q2, ROUND_HALF_UP)),
        "total_float": str(total_float.quantize(Q2, ROUND_HALF_UP)),
        "total_pnl": str(total_pnl.quantize(Q2, ROUND_HALF_UP)),
        "day_pnl": str(day_pnl.quantize(Q2, ROUND_HALF_UP)),
        "total_return_rate": round(total_return_rate, 6) if total_return_rate is not None else None,
        "max_drawdown": round(max_drawdown, 6) if max_drawdown is not None else None,
        "total_fee": str(total_fee.quantize(Q2, ROUND_HALF_UP)),
        "net_deposit": str(net_deposit.quantize(Q2, ROUND_HALF_UP)),
    }


def _calc_max_drawdown(navs: list[float]) -> float:
    if not navs:
        return 0.0
    peak = navs[0]
    max_dd = 0.0
    for v in navs:
        if v > peak:
            peak = v
        dd = (peak - v) / peak if peak > 0 else 0.0
        if dd > max_dd:
            max_dd = dd
    return -max_dd
