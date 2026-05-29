/** Static mock data for development — replace with API calls when backend is ready */

export const mockHoldings = [
  {
    stock_code: '600519',
    stock_name: '贵州茅台',
    ts_code: '600519.SH',
    quantity: 100,
    avg_cost: 1523.0,
    latest_price: 1687.5,
    market_value: 168750,
    float_pnl: 16450,
    float_pnl_rate: 0.108,
    day_pnl: 3200,
  },
  {
    stock_code: '001309',
    stock_name: '德明利',
    ts_code: '001309.SZ',
    quantity: 400,
    avg_cost: 661.545,
    latest_price: 598.0,
    market_value: 239200,
    float_pnl: -25418,
    float_pnl_rate: -0.0961,
    day_pnl: -2800,
  },
  {
    stock_code: '300604',
    stock_name: '长川科技',
    ts_code: '300604.SZ',
    quantity: 1000,
    avg_cost: 219.01,
    latest_price: 245.5,
    market_value: 245500,
    float_pnl: 26490,
    float_pnl_rate: 0.1209,
    day_pnl: 5100,
  },
  {
    stock_code: '601138',
    stock_name: '工业富联',
    ts_code: '601138.SH',
    quantity: 3200,
    avg_cost: 72.394,
    latest_price: 78.2,
    market_value: 250240,
    float_pnl: 18579.2,
    float_pnl_rate: 0.0803,
    day_pnl: 6400,
  },
]

export const mockTrades = [
  {
    id: 1,
    trade_date: '20260528',
    stock_code: '001309',
    stock_name: '德明利',
    side: 'buy',
    price: 661.545,
    quantity: 400,
    amount: 264618.0,
    fee: 0,
    market: 'SZ',
    intent_tags: ['突破', '高位'],
    intent_confidence: 4,
    intent_thesis: '突破前高，成交量放量，计划持仓至目标价',
  },
  {
    id: 2,
    trade_date: '20260528',
    stock_code: '300604',
    stock_name: '长川科技',
    side: 'buy',
    price: 219.01,
    quantity: 1000,
    amount: 219010.0,
    fee: 0,
    market: 'SZ',
    intent_tags: [],
    intent_confidence: null,
    intent_thesis: '',
  },
  {
    id: 3,
    trade_date: '20260528',
    stock_code: '601138',
    stock_name: '工业富联',
    side: 'buy',
    price: 72.394,
    quantity: 3200,
    amount: 231662.0,
    fee: 0,
    market: 'SH',
    intent_tags: ['补仓'],
    intent_confidence: 3,
    intent_thesis: '',
  },
  {
    id: 4,
    trade_date: '20260421',
    stock_code: '600519',
    stock_name: '贵州茅台',
    side: 'buy',
    price: 1523.0,
    quantity: 100,
    amount: 152300.0,
    fee: 0,
    market: 'SH',
    intent_tags: ['突破', '消费白马'],
    intent_confidence: 5,
    intent_thesis: '业绩增长稳定，长期持有，趋势向上',
  },
  {
    id: 5,
    trade_date: '20260415',
    stock_code: '688599',
    stock_name: '天合光能',
    side: 'sell',
    price: 38.5,
    quantity: 2000,
    amount: 77000.0,
    fee: 0,
    market: 'SH',
    intent_tags: ['止盈'],
    intent_confidence: 4,
    intent_thesis: '达到止盈目标，减仓锁定收益',
  },
]

export const mockIntents = [
  {
    id: 1,
    trade_id: 1,
    stock_code: '001309',
    stock_name: '德明利',
    tags: ['突破', '高位'],
    confidence: 4,
    thesis: '突破前高，成交量放量，计划持仓至目标价',
    pnl_realized: null,
    pnl_float: -25418,
    pnl_float_rate: -0.0961,
    created_at: '2026-05-28T09:32:00Z',
  },
  {
    id: 2,
    trade_id: 4,
    stock_code: '600519',
    stock_name: '贵州茅台',
    tags: ['突破', '消费白马'],
    confidence: 5,
    thesis: '业绩增长稳定，长期持有，趋势向上',
    pnl_realized: null,
    pnl_float: 16450,
    pnl_float_rate: 0.108,
    created_at: '2026-04-21T10:15:00Z',
  },
  {
    id: 3,
    trade_id: 5,
    stock_code: '688599',
    stock_name: '天合光能',
    tags: ['止盈'],
    confidence: 4,
    thesis: '达到止盈目标，减仓锁定收益',
    pnl_realized: 8400,
    pnl_realized_rate: 0.122,
    pnl_float: null,
    pnl_float_rate: null,
    created_at: '2026-04-15T14:20:00Z',
  },
]

export const mockReviews = [
  {
    id: 1,
    scope: 'stock',
    scope_desc: '贵州茅台 600519 — 全程复盘',
    model: 'qwen2.5:14b',
    created_at: '2026-05-27T16:30:00Z',
    trade_id: null,
    stock_code: '600519',
  },
  {
    id: 2,
    scope: 'trade',
    scope_desc: '天合光能 688599 — 2026-04-15 卖出',
    model: 'qwen2.5:14b',
    created_at: '2026-04-20T10:00:00Z',
    trade_id: 5,
    stock_code: '688599',
  },
]

export const mockImportBatches = [
  {
    id: 1,
    filename: '20260421_20260528_Atrading.xls',
    period_start: '2026-04-21',
    period_end: '2026-05-28',
    row_count: 5,
    imported_at: '2026-05-29T08:00:00Z',
  },
]

export const mockPnlSummary = {
  total_realized: 8400,
  total_float: 36101.2,
  day_pnl: 11900,
  total_return_rate: 0.082,
  max_drawdown: -0.096,
}

export const mockTags = [
  { id: 1, name: '突破', intent_count: 3 },
  { id: 2, name: '补仓', intent_count: 1 },
  { id: 3, name: '止损', intent_count: 0 },
  { id: 4, name: '止盈', intent_count: 1 },
  { id: 5, name: '消费白马', intent_count: 1 },
  { id: 6, name: '高位', intent_count: 1 },
]

export const mockMarketSentiment = {
  date: '2026-05-29',
  is_trading_day: true,
  up_count: 2456,
  down_count: 1893,
  flat_count: 287,
  limit_up: 42,
  limit_down: 8,
  total_volume_billion: 8934,
  sentiment: 'bullish' as 'bullish' | 'neutral' | 'bearish',
}

/** Net value chart mock data */
export const mockNetValueSeries = (() => {
  const dates = []
  const portfolio = []
  const index = []
  let pv = 1.0
  let iv = 1.0
  const start = new Date('2026-04-21')
  for (let i = 0; i < 28; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    // skip weekends
    if (d.getDay() === 0 || d.getDay() === 6) continue
    const pr = (Math.random() - 0.47) * 0.02
    const ir = (Math.random() - 0.48) * 0.015
    pv = +(pv * (1 + pr)).toFixed(4)
    iv = +(iv * (1 + ir)).toFixed(4)
    dates.push(d.toISOString().slice(0, 10))
    portfolio.push(pv)
    index.push(iv)
  }
  return { dates, portfolio, index }
})()
