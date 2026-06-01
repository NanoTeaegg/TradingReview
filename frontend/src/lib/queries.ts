import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './api'
import { useCurrentAccountId, useSetCurrentAccountId } from './account'

// ── helpers ──────────────────────────────────────────────────
export const n = (v: string | number | null | undefined): number =>
  v == null ? 0 : Number(v)

// ── types ────────────────────────────────────────────────────

export interface Trade {
  id: number
  trade_date: string
  stock_code: string
  stock_name: string
  ts_code: string
  side: string
  price: string
  quantity: number
  amount: string
  fee: string
  market: string
  remark: string | null
  intent_tags: string[]
  intent_confidence: number | null
  intent_thesis: string | null
}

export interface Position {
  stock_code: string
  stock_name: string
  ts_code: string
  as_of_date?: string
  price_date?: string
  quantity: number
  avg_cost: string // 持仓均价（摊薄成本）：净投入现金 / 持仓股数，已实现盈亏折进剩余股成本
  latest_price: string
  market_value: string
  float_pnl: string // 持仓盈亏：数量 ×(现价 − 持仓均价)，含该票内部已实现
  float_pnl_rate: number // 持仓盈亏 / 净投入
  day_pnl: string
}

export interface Summary {
  total_realized: string // 仅已清仓股票的已实现盈亏（持仓中股票的已实现已折进 total_float）
  total_float: string // 当前持仓盈亏合计（含持仓中股票的已实现）
  total_pnl: string // 账户累计盈亏，与收益率走势「累计收益」（全部区间）一致；手续费单列
  day_pnl: string
  total_return_rate: number | null
  max_drawdown: number | null
  total_fee: string
  net_deposit: string
}

export interface BenchmarkSeries {
  code: string
  name: string
  nav: (number | null)[]
}

export interface EquityFlow {
  date: string
  amount: number
}

export interface EquityCurve {
  /** 交易日 ISO 列表 */
  dates: string[]
  /** 时间加权净值，起点 1.0（本金口径 = 累计净入金） */
  nav: number[]
  /** 当日账户总资产（自有口径，担保品已剔除） */
  total_assets: number[]
  /** 区间内出入金流水（入金为正、出金为负） */
  flows: EquityFlow[]
  /** 多基准指数（起点归一，前端按所选区间二次归一） */
  benchmarks: BenchmarkSeries[]
}

export interface Sentiment {
  date: string
  is_trading_day: boolean
  update_available?: boolean
  update_target_date?: string
  up_count: number
  down_count: number
  flat_count: number
  limit_up: number
  limit_down: number
  total_volume_billion: number
  sentiment: 'bullish' | 'neutral' | 'bearish'
  note?: string
}

export interface Intent {
  id: number
  trade_id: number | null
  stock_code: string | null
  stock_name: string
  tags: string[]
  confidence: number | null
  thesis: string | null
  pnl_realized: string | null
  pnl_float: string | null
  pnl_float_rate: number | null
  created_at: string
}

export interface Tag {
  id: number
  name: string
  color: string | null
  intent_count: number
}

export interface Review {
  id: number
  scope: string
  scope_desc: string
  model: string
  created_at: string
  trade_id: number | null
  stock_code: string | null
}

export interface WinRate {
  total: number
  win_count: number
  loss_count: number
  win_rate: number
  avg_win: string
  avg_loss: string
  pnl_ratio: number | null
}

export interface Discipline {
  tagged_count: number
  total_count: number
  discipline_rate: number
  warning: boolean
}

export interface TurnoverItem {
  month: string
  volume: string
  start_value: string
  turnover_rate: number | null
  warning: boolean
}

export interface TagPerf {
  tag: string
  count: number
  win_rate: number
  avg_pnl: string
  avg_hold_days: number
}

export type LLMProvider = 'ollama' | 'openai_compatible'

export interface LLMSettings {
  provider: LLMProvider
  base_url: string
  model: string
  api_key?: string | null
  api_key_masked?: string | null
  has_api_key?: boolean
}

export interface LLMPingResult {
  ok: boolean
  provider: LLMProvider
  models?: string[]
  base_url: string
  error?: string
}

export interface CashFlow {
  id: number
  flow_date: string
  flow_type: 'deposit' | 'withdraw'
  amount: string
  created_at: string | null
}

export interface CashFlowList {
  items: CashFlow[]
  net_deposit: string
}

export interface ImportBatch {
  id: number
  filename: string
  period_start: string | null
  period_end: string | null
  row_count: number
  imported_at: string | null
}

export type AccountKind = 'live' | 'demo'

export interface Account {
  id: number
  name: string
  kind: AccountKind
  is_default: boolean
  sort_order: number
  created_at: string | null
}

function useAccountScopedKey(key: unknown[]) {
  const accountId = useCurrentAccountId()
  return { accountId, queryKey: [...key, accountId] as const }
}

export function invalidateAccountScopedQueries(qc: ReturnType<typeof useQueryClient>) {
  for (const key of [
    'trades',
    'positions',
    'summary',
    'equity-curve',
    'intents',
    'tags',
    'win-rate',
    'discipline',
    'turnover',
    'tag-performance',
    'reviews',
    'cash-flows',
    'imports',
    'rules',
    'rule-versions',
  ]) {
    qc.invalidateQueries({ queryKey: [key] })
  }
}

// ── accounts ─────────────────────────────────────────────────

export function useAccounts() {
  return useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/api/accounts').then(r => r.data),
  })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  const setCurrentAccountId = useSetCurrentAccountId()
  return useMutation({
    mutationFn: (data: { name: string; kind?: AccountKind }) =>
      api.post('/api/accounts', data).then(r => r.data as Account),
    onSuccess: (account) => {
      setCurrentAccountId(account.id)
      qc.invalidateQueries({ queryKey: ['accounts'] })
      invalidateAccountScopedQueries(qc)
    },
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Pick<Account, 'name' | 'kind' | 'is_default' | 'sort_order'>> }) =>
      api.patch(`/api/accounts/${id}`, data).then(r => r.data as Account),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  const accountId = useCurrentAccountId()
  const setCurrentAccountId = useSetCurrentAccountId()
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.delete(`/api/accounts/${id}`, { data: { name } }).then(r => r.data),
    onSuccess: (_, vars) => {
      if (accountId === vars.id) setCurrentAccountId(null)
      qc.invalidateQueries({ queryKey: ['accounts'] })
      invalidateAccountScopedQueries(qc)
    },
  })
}

export function useCopyRuleToCurrentAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fromAccountId: number) =>
      api.post(`/api/rules/copy?from_account_id=${fromAccountId}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rules'] })
      qc.invalidateQueries({ queryKey: ['rule-versions'] })
    },
  })
}

// ── trades ───────────────────────────────────────────────────

export function useTrades(params?: { stock?: string; side?: string; start?: string; end?: string }) {
  const { queryKey } = useAccountScopedKey(['trades', params])
  const query = new URLSearchParams()
  if (params?.stock) query.set('stock', params.stock)
  if (params?.side && params.side !== 'all') query.set('side', params.side)
  if (params?.start) query.set('start', params.start)
  if (params?.end) query.set('end', params.end)
  return useQuery<Trade[]>({
    queryKey,
    queryFn: () => api.get(`/api/trades?${query}`).then(r => r.data),
  })
}

// ── positions ────────────────────────────────────────────────

export function usePositions() {
  const { queryKey } = useAccountScopedKey(['positions'])
  return useQuery<Position[]>({
    queryKey,
    queryFn: () => api.get('/api/positions').then(r => r.data),
  })
}

const HEAVY_QUERY_OPTS = {
  staleTime: 5 * 60 * 1000,
  refetchOnWindowFocus: false,
} as const

export function useSummary() {
  const { queryKey } = useAccountScopedKey(['summary'])
  return useQuery<Summary>({
    queryKey,
    queryFn: () => api.get('/api/positions/summary').then(r => r.data),
    ...HEAVY_QUERY_OPTS,
  })
}

export function useEquityCurve() {
  const { queryKey } = useAccountScopedKey(['equity-curve'])
  return useQuery<EquityCurve>({
    queryKey,
    queryFn: () => api.get('/api/positions/equity-curve').then(r => r.data),
    ...HEAVY_QUERY_OPTS,
  })
}

// ── market ───────────────────────────────────────────────────

export function useSentiment() {
  return useQuery<Sentiment>({
    queryKey: ['sentiment'],
    queryFn: () => api.get('/api/market/sentiment').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
}

export interface MarketSyncResult {
  ok: boolean
  status?: 'success' | 'skipped_today' | 'up_to_date' | 'partial'
  message?: string
  warnings?: string[]
  skipped_today?: boolean
  skip_reason?: string | null
  start: string
  end: string
  target_end?: string
  synced_days: number
  index_rows: number
  min_date?: string | null
  max_date?: string | null
}

export type FullHistoryStatusValue =
  | 'idle' | 'running' | 'complete' | 'error' | 'cancelled' | 'interrupted'

export interface FullHistoryStatus {
  has_data: boolean
  status: FullHistoryStatusValue
  running: boolean
  total: number
  done: number
  failed: number
  current_code: string | null
  message: string | null
  min_date: string | null
  max_date: string | null
}

/** 行情数据落库后，刷新所有依赖行情的视图。 */
function invalidateMarketDependentQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['positions'] })
  qc.invalidateQueries({ queryKey: ['summary'] })
  qc.invalidateQueries({ queryKey: ['equity-curve'] })
  qc.invalidateQueries({ queryKey: ['sentiment'] })
  qc.invalidateQueries({ queryKey: ['intents'] })
}

/** 「拉取最新行情」：按交易日全市场增量。 */
export function useSyncLatestMarket() {
  const qc = useQueryClient()
  return useMutation<MarketSyncResult>({
    mutationFn: () => api.post('/api/market/sync', {}, { timeout: 120_000 }).then(r => r.data),
    onSuccess: () => {
      invalidateMarketDependentQueries(qc)
      qc.invalidateQueries({ queryKey: ['market-history'] })
    },
  })
}

/** 全量历史进度；任务运行中时自动轮询。 */
export function useFullHistoryStatus() {
  return useQuery<FullHistoryStatus>({
    queryKey: ['market-history'],
    queryFn: () => api.get('/api/market/history').then(r => r.data),
    refetchInterval: (query) => (query.state.data?.running ? 2000 : false),
  })
}

/** 启动「初始化/修复全量历史」后台任务。 */
export function useStartFullHistory() {
  const qc = useQueryClient()
  return useMutation<FullHistoryStatus>({
    mutationFn: () => api.post('/api/market/history').then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['market-history'] }),
  })
}

/** 取消全量历史后台任务。 */
export function useCancelFullHistory() {
  const qc = useQueryClient()
  return useMutation<FullHistoryStatus>({
    mutationFn: () => api.post('/api/market/history/cancel').then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['market-history'] }),
  })
}

// ── intents ──────────────────────────────────────────────────

export function useIntents(filterCode?: string) {
  const { queryKey } = useAccountScopedKey(['intents'])
  return useQuery<Intent[]>({
    queryKey,
    queryFn: () => api.get('/api/intents').then(r => r.data),
    select: data =>
      filterCode
        ? data.filter(i => i.stock_code?.includes(filterCode) || i.stock_name?.includes(filterCode))
        : data,
  })
}

export function useSaveIntent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { tags: string[]; thesis: string; confidence: number } }) =>
      api.put(`/api/intents/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intents'] }),
  })
}

export function useCreateIntent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { trade_id?: number; stock_code?: string; tags: string[]; thesis?: string; confidence?: number }) =>
      api.post('/api/intents', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['intents'] }); qc.invalidateQueries({ queryKey: ['trades'] }) },
  })
}

// ── tags ─────────────────────────────────────────────────────

export function useTags() {
  const { queryKey } = useAccountScopedKey(['tags'])
  return useQuery<Tag[]>({
    queryKey,
    queryFn: () => api.get('/api/tags').then(r => r.data),
  })
}

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.post('/api/tags', { name }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  })
}

export function useUpdateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.put(`/api/tags/${id}`, { name }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }); qc.invalidateQueries({ queryKey: ['intents'] }) },
  })
}

export function useDeleteTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/tags/${id}/force`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }); qc.invalidateQueries({ queryKey: ['intents'] }) },
  })
}

// ── stats ────────────────────────────────────────────────────

export function useWinRate(tag?: string) {
  const { queryKey } = useAccountScopedKey(['win-rate', tag])
  return useQuery<WinRate>({
    queryKey,
    queryFn: () => api.get(`/api/stats/win-rate${tag ? `?tag=${tag}` : ''}`).then(r => r.data),
  })
}

export function useDiscipline() {
  const { queryKey } = useAccountScopedKey(['discipline'])
  return useQuery<Discipline>({
    queryKey,
    queryFn: () => api.get('/api/stats/discipline').then(r => r.data),
  })
}

export function useTurnover() {
  const { queryKey } = useAccountScopedKey(['turnover'])
  return useQuery<TurnoverItem[]>({
    queryKey,
    queryFn: () => api.get('/api/stats/turnover').then(r => r.data),
  })
}

export function useTagPerformance() {
  const { queryKey } = useAccountScopedKey(['tag-performance'])
  return useQuery<TagPerf[]>({
    queryKey,
    queryFn: () => api.get('/api/stats/tag-performance').then(r => r.data),
  })
}

// ── reviews ──────────────────────────────────────────────────

export interface ReviewDetail extends Review {
  content: string
  provider: string
  rule_version_id: number | null
  input_snapshot: string | null
  period_start: string | null
  period_end: string | null
}

export function useReviews() {
  const { queryKey } = useAccountScopedKey(['reviews'])
  return useQuery<Review[]>({
    queryKey,
    queryFn: () => api.get('/api/reviews').then(r => r.data),
  })
}

export function useReviewDetail(id: number | null) {
  return useQuery<ReviewDetail>({
    queryKey: ['reviews', id],
    queryFn: () => api.get(`/api/reviews/${id}`).then(r => r.data),
    enabled: id != null,
  })
}

// ── LLM settings ─────────────────────────────────────────────

export function useLLMSettings() {
  return useQuery<LLMSettings>({
    queryKey: ['llm-settings'],
    queryFn: () => api.get('/api/settings/llm').then(r => r.data),
  })
}

export function useSaveLLMSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: LLMSettings) => api.put('/api/settings/llm', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['llm-settings'] }),
  })
}

export function usePingLLM() {
  return useMutation<LLMPingResult>({
    mutationFn: () => api.post('/api/settings/llm/ping').then(r => r.data),
  })
}

// ── cash flows ───────────────────────────────────────────────

export function useCashFlows() {
  const { queryKey } = useAccountScopedKey(['cash-flows'])
  return useQuery<CashFlowList>({
    queryKey,
    queryFn: () => api.get('/api/cash-flows').then(r => r.data),
  })
}

export function useCreateCashFlow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { flow_type: 'deposit' | 'withdraw'; amount: string }) =>
      api.post('/api/cash-flows', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-flows'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      qc.invalidateQueries({ queryKey: ['equity-curve'] })
    },
  })
}

export function useDeleteCashFlow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/cash-flows/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-flows'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      qc.invalidateQueries({ queryKey: ['equity-curve'] })
    },
  })
}

// ── imports ──────────────────────────────────────────────────

export function useImportBatches() {
  const { queryKey } = useAccountScopedKey(['imports'])
  return useQuery<ImportBatch[]>({
    queryKey,
    queryFn: () => api.get('/api/imports').then(r => r.data),
  })
}

export function useUploadImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api.post('/api/imports', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['imports'] })
      qc.invalidateQueries({ queryKey: ['trades'] })
      qc.invalidateQueries({ queryKey: ['positions'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      qc.invalidateQueries({ queryKey: ['equity-curve'] })
    },
  })
}
