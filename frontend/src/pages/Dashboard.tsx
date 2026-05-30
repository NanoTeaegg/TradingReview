import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import { Plus, Pencil, Bot, X, Star, Check, Loader2, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import PnlNumber from '@/components/shared/PnlNumber'
import { formatAmount, formatPct, formatTradeDate } from '@/lib/format'
import {
  useTrades, useSummary, useEquityCurve, useTags,
  useCreateIntent, useSaveIntent,
  n, type Trade, type EquityCurve,
} from '@/lib/queries'

// ── Perf cards ────────────────────────────────────────────────

function PerfCard({ label, value, isPnl = false, isAmount = false }: { label: string; value: number | null; isPnl?: boolean; isAmount?: boolean }) {
  return (
    <div
      className="rounded-lg p-5 flex flex-col gap-2"
      style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}
    >
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
        {label}
      </span>
      {value == null ? (
        <span className="text-3xl font-semibold tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>—</span>
      ) : isPnl ? (
        <PnlNumber value={value} formatter={formatAmount} className="text-3xl font-semibold" />
      ) : isAmount ? (
        <span className="text-3xl font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
          {formatAmount(value)}
        </span>
      ) : (
        <span className="text-3xl font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
          {formatPct(value)}
        </span>
      )}
    </div>
  )
}

// ── 流水 sub-components ───────────────────────────────────────

function SideBadge({ side }: { side: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    buy: { label: '买入', bg: 'rgba(22,163,74,0.10)', color: 'var(--color-profit)' },
    sell: { label: '卖出', bg: 'rgba(181,51,51,0.10)', color: 'var(--color-loss)' },
    transfer_in: { label: '划入', bg: 'var(--color-border-subtle)', color: 'var(--color-text-tertiary)' },
  }
  const { label, bg, color } = map[side] ?? map['buy']
  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: bg, color }}>{label}</span>
  )
}

function TagChip({ label, selected, onClick }: { label: string; selected?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 rounded-xs text-xs font-medium transition-colors duration-[120ms]"
      style={{
        background: selected ? 'var(--color-primary)' : 'var(--color-bg-tag)',
        color: selected ? 'var(--color-text-on-brand)' : 'var(--color-text-secondary)',
      }}
    >
      {label}
    </button>
  )
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(num => (
        <button
          key={num}
          onMouseEnter={() => setHovered(num)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(value === num ? 0 : num)}
          className="transition-colors duration-[120ms]"
        >
          <Star
            size={18}
            strokeWidth={1.5}
            fill={(hovered || value) >= num ? 'var(--color-warning)' : 'transparent'}
            style={{ color: (hovered || value) >= num ? 'var(--color-warning)' : 'var(--color-border-default)' }}
          />
        </button>
      ))}
    </div>
  )
}

function IntentDrawer({ trade, onClose }: { trade: Trade; onClose: () => void }) {
  const { data: tags = [] } = useTags()
  const createIntent = useCreateIntent()
  const saveIntent = useSaveIntent()

  const [selectedTags, setSelectedTags] = useState<string[]>(trade.intent_tags ?? [])
  const [confidence, setConfidence] = useState(trade.intent_confidence ?? 0)
  const [thesis, setThesis] = useState(trade.intent_thesis ?? '')
  const [newTagInput, setNewTagInput] = useState('')
  const [showNewTag, setShowNewTag] = useState(false)
  const [saved, setSaved] = useState(false)

  const allTags = [...new Set([...tags.map(t => t.name), ...selectedTags])]
  const saving = createIntent.isPending || saveIntent.isPending

  function toggleTag(tag: string) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  async function handleSave() {
    const payload = { tags: selectedTags, thesis, confidence }
    // Check if intent already exists by looking at trade's intent data
    const existingIntentForTrade = trade.intent_tags !== null
    if (existingIntentForTrade && trade.intent_confidence !== null) {
      // Intent exists – but we don't have the intent id here, so create a new one
      // (idempotent: multiple intents per trade are allowed)
    }
    await createIntent.mutateAsync({ trade_id: trade.id, stock_code: trade.stock_code, ...payload })
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 1000)
  }

  function addNewTag() {
    const tag = newTagInput.trim()
    if (!tag) return
    if (!selectedTags.includes(tag)) setSelectedTags(prev => [...prev, tag])
    setNewTagInput('')
    setShowNewTag(false)
  }

  return (
    <>
      <div
        className="fixed inset-0 transition-opacity duration-[200ms]"
        style={{ background: 'rgba(20,20,19,0.25)', zIndex: 'var(--z-panel)' }}
        onClick={onClose}
      />
      <div
        className="fixed right-0 flex flex-col"
        style={{
          top: 'var(--topbar-height)', bottom: 0,
          width: 'var(--right-panel-width)',
          background: 'var(--color-bg-surface)',
          boxShadow: '-4px 0 24px rgba(20,20,19,0.12)',
          zIndex: 'calc(var(--z-panel) + 1)',
          animation: 'slideInFromRight 200ms ease',
        }}
      >
        <style>{`@keyframes slideInFromRight { from { transform: translateX(400px); } to { transform: translateX(0); } }`}</style>
        <div className="flex items-center justify-between px-4 shrink-0" style={{ height: 52, borderBottom: '1px solid var(--color-border-subtle)' }}>
          <span className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>编辑交易意图</span>
          <button onClick={onClose} className="p-1 rounded transition-colors duration-[120ms]"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}>
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        {saved && (
          <div className="flex items-center gap-2 px-4 py-2 text-sm" style={{ background: 'rgba(22,163,74,0.08)', color: 'var(--color-success)' }}>
            <Check size={14} />已保存
          </div>
        )}
        <div className="px-4 py-3 shrink-0" style={{ background: 'var(--color-bg-sidebar)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
            {trade.stock_name} <span className="font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{trade.stock_code}</span>
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {formatTradeDate(trade.trade_date)} &nbsp;·&nbsp;
            <SideBadge side={trade.side} /> &nbsp;·&nbsp;
            ¥{n(trade.price).toFixed(3)} &nbsp;·&nbsp; {trade.quantity.toLocaleString()}股 &nbsp;·&nbsp; {formatAmount(n(trade.amount))}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>标签（多选）</label>
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <TagChip key={tag} label={tag} selected={selectedTags.includes(tag)} onClick={() => toggleTag(tag)} />
              ))}
              {showNewTag ? (
                <input
                  autoFocus
                  className="px-2 py-0.5 rounded-xs text-xs border outline-none"
                  style={{ borderColor: 'var(--color-focus-ring)', color: 'var(--color-text-primary)', width: 100 }}
                  value={newTagInput}
                  onChange={e => setNewTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addNewTag(); if (e.key === 'Escape') setShowNewTag(false) }}
                  placeholder="输入后回车"
                />
              ) : (
                <button
                  className="flex items-center gap-1 px-2 py-0.5 rounded-xs text-xs"
                  style={{ border: '1px dashed var(--color-border-default)', color: 'var(--color-text-tertiary)' }}
                  onClick={() => setShowNewTag(true)}
                >
                  <Plus size={10} /> 新建
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>信心度（1-5）</label>
            <StarRating value={confidence} onChange={setConfidence} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>交易思路</label>
            <textarea
              className="w-full rounded-md p-3 text-sm resize-none outline-none transition-colors duration-[120ms]"
              style={{ minHeight: 120, border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)' }}
              placeholder="可选，不限字数..."
              value={thesis}
              onChange={e => setThesis(e.target.value)}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-focus-ring)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-4 shrink-0" style={{ height: 64, borderTop: '1px solid var(--color-border-subtle)' }}>
          <button
            className="px-4 h-9 rounded-md text-sm transition-colors duration-[120ms]"
            style={{ background: 'var(--color-bg-surface-selected)', color: 'var(--color-text-primary)' }}
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="px-4 h-9 rounded-md text-sm font-medium transition-colors duration-[120ms] flex items-center gap-2 disabled:opacity-45"
            style={{ background: 'var(--color-primary)', color: 'var(--color-text-on-brand)' }}
            onMouseEnter={e => !saving && (e.currentTarget.style.background = 'var(--color-primary-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-primary)')}
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Dashboard ─────────────────────────────────────────────────

const FILTER_STORAGE_KEY = 'dashboard:tradeFilter'

type TradeFilter = { code: string; side: string; page: number }

function readFilter(): TradeFilter {
  try {
    const raw = sessionStorage.getItem(FILTER_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TradeFilter>
      return {
        code: parsed.code ?? '',
        side: parsed.side ?? 'all',
        page: parsed.page ?? 1,
      }
    }
  } catch {
    // ignore malformed storage
  }
  return { code: '', side: 'all', page: 1 }
}

// ── 收益率走势卡片 ───────────────────────────────────────────

type RangeKey = '1w' | '1m' | 'ytd' | 'all' | 'custom'

const RANGE_TABS: { key: RangeKey; label: string }[] = [
  { key: '1w', label: '近1周' },
  { key: '1m', label: '近1月' },
  { key: 'ytd', label: '年初至今' },
  { key: 'all', label: '全部' },
]

// 基准线配色：账户用品牌主色，基准用中性灰阶，保证账户曲线突出
const BENCH_COLORS: Record<string, string> = {
  '000300.SH': '#5e5d59',
  '000001.SH': '#a07e5a',
  '399001.SZ': '#7d8a6a',
  '399006.SZ': '#9a7aa0',
}
const ACCOUNT_COLOR = '#c96442'

const dayMs = 86400000

function rangeStartDate(range: RangeKey, lastISO: string): Date {
  const last = new Date(lastISO)
  if (range === '1w') return new Date(last.getTime() - 6 * dayMs)
  if (range === '1m') { const d = new Date(last); d.setMonth(d.getMonth() - 1); return d }
  if (range === 'ytd') return new Date(last.getFullYear(), 0, 1)
  return new Date(0)
}

function ReturnTrendCard({ curve, loading, failed }: { curve?: EquityCurve; loading: boolean; failed?: boolean }) {
  const [range, setRange] = useState<RangeKey>('all')
  const [custom, setCustom] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const dates = curve?.dates ?? []

  // 计算所选区间下标 [i0, i1]
  const [i0, i1] = useMemo<[number, number]>(() => {
    if (dates.length === 0) return [0, -1]
    if (range === 'custom') {
      const s = custom.start, e = custom.end
      let lo = 0, hi = dates.length - 1
      if (s) { const idx = dates.findIndex(d => d >= s); lo = idx === -1 ? dates.length - 1 : idx }
      if (e) { for (let k = dates.length - 1; k >= 0; k--) { if (dates[k] <= e) { hi = k; break } } }
      if (hi < lo) hi = lo
      return [lo, hi]
    }
    const startISO = rangeStartDate(range, dates[dates.length - 1]).toISOString().slice(0, 10)
    const idx = dates.findIndex(d => d >= startISO)
    return [idx === -1 ? 0 : idx, dates.length - 1]
  }, [dates, range, custom])

  const view = useMemo(() => {
    if (!curve || i1 < i0 || dates.length === 0) return null
    const nav = curve.nav
    const assets = curve.total_assets
    const winDates = dates.slice(i0, i1 + 1)
    const navBase = nav[i0]

    // 账户累计收益率序列（区间起点归一为 0%）
    const accountSeries = winDates.map((_, k) => navBase ? +(((nav[i0 + k] / navBase) - 1) * 100).toFixed(4) : 0)

    // 基准：区间内首个非空值为基准点
    const benchSeries = curve.benchmarks.map(b => {
      const slice = b.nav.slice(i0, i1 + 1)
      const baseIdx = slice.findIndex(v => v != null)
      const base = baseIdx === -1 ? null : slice[baseIdx]
      const series = slice.map(v => (v == null || base == null) ? null : +(((v / base) - 1) * 100).toFixed(4))
      const lastVal = [...series].reverse().find(v => v != null) ?? null
      return { code: b.code, name: b.name, series, ret: lastVal }
    })

    // 区间净现金流（起点之后发生的出入金）
    const startDate = dates[i0]
    const endDate = dates[i1]
    const netFlow = (curve.flows ?? [])
      .filter(f => f.date > startDate && f.date <= endDate)
      .reduce((s, f) => s + f.amount, 0)
    const vStart = assets[i0]
    const vEnd = assets[i1]
    const profit = (vEnd - vStart) - netFlow

    // 收益率：时间加权（TWR），与曲线同口径
    const rate = navBase ? (nav[i1] / navBase) - 1 : 0

    return { winDates, accountSeries, benchSeries, profit, rate }
  }, [curve, dates, i0, i1])

  const chartOption = useMemo(() => {
    if (!view) return null
    const visibleBench = view.benchSeries.filter(b => !hidden.has(b.code))
    // 计算所有可见序列的最大绝对值 → 让 0% 居中
    let maxAbs = 0
    for (const v of view.accountSeries) maxAbs = Math.max(maxAbs, Math.abs(v))
    for (const b of visibleBench) for (const v of b.series) if (v != null) maxAbs = Math.max(maxAbs, Math.abs(v))
    maxAbs = Math.max(1, Math.ceil(maxAbs * 1.15))

    const fmtAxisDate = (d: string) => d.slice(5)
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#141413', borderColor: 'transparent',
        textStyle: { color: '#faf9f5', fontSize: 12 },
        valueFormatter: (v: number | null) => v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`,
      },
      legend: { show: false },
      grid: { left: 0, right: 8, top: 16, bottom: 24, containLabel: true },
      xAxis: {
        type: 'category', data: view.winDates, boundaryGap: false,
        axisLine: { lineStyle: { color: '#f0eee6' } },
        axisTick: { show: false },
        axisLabel: { color: '#87867f', fontSize: 11, formatter: fmtAxisDate, hideOverlap: true },
      },
      yAxis: {
        type: 'value', min: -maxAbs, max: maxAbs,
        splitLine: { lineStyle: { color: '#f0eee6', type: 'dashed' } },
        axisLabel: { color: '#87867f', fontSize: 11, formatter: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%` },
      },
      series: [
        {
          name: '账户', type: 'line', data: view.accountSeries, smooth: true, symbol: 'none', z: 5,
          lineStyle: { color: ACCOUNT_COLOR, width: 2 },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(201,100,66,0.14)' }, { offset: 1, color: 'rgba(201,100,66,0)' }] } },
          markLine: {
            silent: true, symbol: 'none',
            lineStyle: { color: '#d1cfc5', type: 'solid', width: 1 },
            data: [{ yAxis: 0 }], label: { show: false },
          },
        },
        ...visibleBench.map(b => ({
          name: b.name, type: 'line', data: b.series, smooth: true, symbol: 'none', connectNulls: true,
          lineStyle: { color: BENCH_COLORS[b.code] ?? '#87867f', width: 1.25 },
        })),
      ],
    }
  }, [view, hidden])

  function toggleBench(code: string) {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code); else next.add(code)
      return next
    })
  }

  return (
    <div className="rounded-lg p-5" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
      {/* 时间区间 + 筛选 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {RANGE_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setRange(t.key)}
              className="px-3 py-1 rounded text-xs transition-colors duration-[120ms]"
              style={{
                background: range === t.key ? 'var(--color-bg-surface-selected)' : 'transparent',
                color: range === t.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                border: '1px solid var(--color-border-default)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {range === 'custom' && (
            <div className="flex items-center gap-1">
              <input type="date" value={custom.start} max={custom.end || undefined}
                onChange={e => setCustom(c => ({ ...c, start: e.target.value }))}
                className="h-7 px-2 rounded text-xs outline-none"
                style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)' }} />
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>~</span>
              <input type="date" value={custom.end} min={custom.start || undefined}
                onChange={e => setCustom(c => ({ ...c, end: e.target.value }))}
                className="h-7 px-2 rounded text-xs outline-none"
                style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)' }} />
            </div>
          )}
          <button
            onClick={() => setRange('custom')}
            className="flex items-center gap-1 px-3 py-1 rounded text-xs transition-colors duration-[120ms]"
            style={{
              background: range === 'custom' ? 'var(--color-primary-subtle)' : 'transparent',
              color: range === 'custom' ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
              border: `1px solid ${range === 'custom' ? 'var(--color-primary)' : 'var(--color-border-default)'}`,
            }}
          >
            <SlidersHorizontal size={12} /> 筛选
          </button>
        </div>
      </div>

      <div className="text-base font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>收益率走势</div>

      {/* 累计收益 + 收益率 */}
      <div className="flex items-end justify-between mb-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>累计收益</span>
          {view ? (
            <span className="text-2xl font-semibold tabular-nums"
              style={{ color: view.profit > 0 ? 'var(--color-loss)' : view.profit < 0 ? 'var(--color-profit)' : 'var(--color-text-primary)' }}>
              {view.profit > 0 ? '+' : ''}{formatAmount(view.profit).replace('¥', '¥')}
            </span>
          ) : <span className="text-2xl font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>收益率</span>
          {view ? (
            <span className="text-2xl font-semibold tabular-nums"
              style={{ color: view.rate > 0 ? 'var(--color-loss)' : view.rate < 0 ? 'var(--color-profit)' : 'var(--color-text-primary)' }}>
              {formatPct(view.rate)}
            </span>
          ) : <span className="text-2xl font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
        </div>
      </div>

      {/* 图表 */}
      {loading ? (
        <div className="flex items-center justify-center h-[260px] text-sm" style={{ color: 'var(--color-text-tertiary)' }}>加载中...</div>
      ) : failed ? (
        <div className="flex items-center justify-center h-[260px] text-sm" style={{ color: 'var(--color-loss)' }}>净值曲线加载失败，请稍后重试</div>
      ) : !chartOption ? (
        <div className="flex items-center justify-center h-[260px] text-sm" style={{ color: 'var(--color-text-tertiary)' }}>导入成交数据后显示净值曲线</div>
      ) : (
        <ReactECharts option={chartOption} style={{ height: 260 }} notMerge />
      )}

      {/* 基准对比 chips */}
      {view && view.benchSeries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
          {view.benchSeries.map(b => {
            const off = hidden.has(b.code)
            return (
              <button key={b.code} onClick={() => toggleBench(b.code)} className="flex flex-col gap-0.5 text-left transition-opacity duration-[120ms]"
                style={{ opacity: off ? 0.4 : 1 }}>
                <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  <span className="inline-block rounded-full" style={{ width: 7, height: 7, background: BENCH_COLORS[b.code] ?? '#87867f' }} />
                  {b.name}
                </span>
                <span className="text-sm font-medium tabular-nums"
                  style={{ color: b.ret == null ? 'var(--color-text-tertiary)' : b.ret > 0 ? 'var(--color-loss)' : b.ret < 0 ? 'var(--color-profit)' : 'var(--color-text-secondary)' }}>
                  {b.ret == null ? '—' : formatPct(b.ret)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [activeTrade, setActiveTrade] = useState<Trade | null>(null)

  const [filter, setFilter] = useState<TradeFilter>(readFilter)
  const { code: filterCode, side: filterSide, page } = filter

  function persistFilter(next: TradeFilter) {
    setFilter(next)
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore storage write failure
    }
  }

  function setFilterCode(value: string) {
    persistFilter({ ...filter, code: value, page: 1 })
  }

  function setFilterSide(value: string) {
    persistFilter({ ...filter, side: value, page: 1 })
  }

  function setPage(value: number) {
    persistFilter({ ...filter, page: value })
  }

  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useSummary()
  const { data: curve, isLoading: curveLoading, isError: curveError } = useEquityCurve()
  const { data: allTrades = [], isLoading: tradesLoading, isError: tradesError } = useTrades({ side: filterSide })
  const statsPending = summaryLoading || curveLoading
  const statsFailed = summaryError || curveError
  const trades = allTrades.filter(t => {
    if (!filterCode) return true
    const q = filterCode.toLowerCase()
    return t.stock_code.toLowerCase().startsWith(q) || t.stock_name.toLowerCase().includes(q)
  })

  const PAGE_SIZE = 20
  const totalPages = Math.max(1, Math.ceil(trades.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedTrades = trades.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function getPageNumbers(current: number, total: number): (number | '…')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    if (current <= 4) return [1, 2, 3, 4, 5, '…', total]
    if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total]
    return [1, '…', current - 1, current, current + 1, '…', total]
  }

  return (
    <div className="flex flex-col gap-8">
      <h1
        className="font-serif font-medium"
        style={{ color: 'var(--color-text-primary)', fontSize: 'var(--font-size-page-title)', lineHeight: 1.25 }}
      >
        交易总览
      </h1>

      {statsFailed && (
        <p className="text-sm rounded-md px-4 py-3" style={{ color: 'var(--color-loss)', background: 'rgba(181,51,51,0.08)', border: '1px solid var(--color-border-subtle)' }}>
          汇总数据加载失败（行情接口限频或超时）。请稍后刷新；若持续失败，请检查网络/代理或 TuShare 配额。
        </p>
      )}

      <div className="grid grid-cols-5 gap-5">
        <PerfCard label="总收益率" value={statsPending ? null : (summary?.total_return_rate ?? null)} />
        <PerfCard label="最大回撤" value={statsPending ? null : (summary?.max_drawdown ?? null)} />
        <PerfCard label="总盈亏（不含手续费）" value={statsPending ? null : (summary ? n(summary.total_pnl) : null)} isPnl />
        <PerfCard label="当前持仓盈亏" value={statsPending ? null : (summary ? n(summary.total_float) : null)} isPnl />
        <PerfCard label="累计手续费" value={statsPending ? null : (summary ? n(summary.total_fee) : null)} isAmount />
      </div>

      <ReturnTrendCard curve={curve} loading={curveLoading} failed={curveError} />

      {/* 流水 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>成交流水</h2>

        <div className="flex items-center gap-3">
          <input
            className="h-9 px-3 rounded-md text-sm outline-none transition-colors duration-[120ms]"
            style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)', minWidth: 200, background: 'var(--color-bg-surface)' }}
            placeholder="股票代码 / 名称"
            value={filterCode}
            onChange={e => setFilterCode(e.target.value)}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-focus-ring)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
          />
          <select
            className="h-9 px-3 rounded-md text-sm outline-none"
            style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)' }}
            value={filterSide}
            onChange={e => setFilterSide(e.target.value)}
          >
            <option value="all">全部方向</option>
            <option value="buy">买入</option>
            <option value="sell">卖出</option>
          </select>
        </div>

        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)' }}>
          {tradesLoading ? (
            <p className="p-8 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>加载中...</p>
          ) : tradesError ? (
            <p className="p-8 text-center text-sm" style={{ color: 'var(--color-loss)' }}>成交流水加载失败，请稍后重试</p>
          ) : trades.length === 0 ? (
            <p className="p-8 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>暂无成交记录</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-bg-sidebar)' }}>
                  {['日期', '股票', '方向', '成交价', '数量', '成交金额', '手续费', '意图标签', '操作'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-left"
                      style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedTrades.map(t => (
                  <tr
                    key={t.id}
                    className="transition-colors duration-[120ms] cursor-pointer"
                    style={{
                      borderBottom: '1px solid var(--color-border-subtle)',
                      background: activeTrade?.id === t.id ? 'rgba(201,100,66,0.06)' : 'var(--color-bg-surface)',
                      borderLeft: activeTrade?.id === t.id ? '3px solid var(--color-primary)' : '3px solid transparent',
                    }}
                    onMouseEnter={e => activeTrade?.id !== t.id && (e.currentTarget.style.background = 'var(--color-bg-surface-hover)')}
                    onMouseLeave={e => activeTrade?.id !== t.id && (e.currentTarget.style.background = 'var(--color-bg-surface)')}
                  >
                    <td className="px-4 tabular-nums" style={{ height: 36, color: 'var(--color-text-secondary)', fontSize: 13 }}>
                      {formatTradeDate(t.trade_date)}
                    </td>
                    <td className="px-4">
                      <div className="flex flex-col">
                        <span style={{ color: 'var(--color-text-primary)' }}>{t.stock_name}</span>
                        <span className="font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{t.stock_code}</span>
                      </div>
                    </td>
                    <td className="px-4"><SideBadge side={t.side} /></td>
                    <td className="px-4 tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{n(t.price).toFixed(3)}</td>
                    <td className="px-4 tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{t.quantity.toLocaleString()}</td>
                    <td className="px-4 tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{formatAmount(n(t.amount))}</td>
                    <td className="px-4 tabular-nums text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{formatAmount(n(t.fee))}</td>
                    <td className="px-4">
                      {t.intent_tags && t.intent_tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {t.intent_tags.slice(0, 2).map(tag => <TagChip key={tag} label={tag} />)}
                          {t.intent_tags.length > 2 && (
                            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>+{t.intent_tags.length - 2}</span>
                          )}
                        </div>
                      ) : (
                        <button
                          className="text-xs"
                          style={{ color: 'var(--color-text-tertiary)', textDecoration: 'underline' }}
                          onClick={() => setActiveTrade(t)}
                        >
                          + 添加意图
                        </button>
                      )}
                    </td>
                    <td className="px-4">
                      <div className="flex items-center gap-2">
                        <button
                          className="p-1 rounded transition-colors duration-[120ms]"
                          title="编辑意图"
                          onClick={() => setActiveTrade(t)}
                          style={{ color: 'var(--color-text-tertiary)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
                        >
                          <Pencil size={14} strokeWidth={1.5} />
                        </button>
                        <button
                          className="p-1 rounded transition-colors duration-[120ms]"
                          title="AI复盘"
                          onClick={() => navigate(`/intents/stock/${t.stock_code}`)}
                          style={{ color: 'var(--color-text-tertiary)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
                        >
                          <Bot size={14} strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!tradesLoading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-1">
            <button
              disabled={safePage === 1}
              onClick={() => setPage(safePage - 1)}
              className="flex items-center justify-center w-8 h-8 rounded transition-colors duration-[120ms] disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)', background: 'var(--color-bg-surface)' }}
            >
              <ChevronLeft size={14} />
            </button>

            {getPageNumbers(safePage, totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-xs" style={{ color: 'var(--color-text-tertiary)' }}>…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className="w-8 h-8 rounded text-xs font-medium transition-colors duration-[120ms]"
                  style={{
                    background: safePage === p ? 'var(--color-primary)' : 'var(--color-bg-surface)',
                    color: safePage === p ? '#fff' : 'var(--color-text-secondary)',
                    border: `1px solid ${safePage === p ? 'var(--color-primary)' : 'var(--color-border-default)'}`,
                  }}
                >
                  {p}
                </button>
              )
            )}

            <button
              disabled={safePage === totalPages}
              onClick={() => setPage(safePage + 1)}
              className="flex items-center justify-center w-8 h-8 rounded transition-colors duration-[120ms] disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)', background: 'var(--color-bg-surface)' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </section>

      {activeTrade && <IntentDrawer trade={activeTrade} onClose={() => setActiveTrade(null)} />}
    </div>
  )
}
