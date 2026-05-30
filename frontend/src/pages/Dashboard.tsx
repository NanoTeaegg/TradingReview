import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import { Plus, Pencil, Bot, X, Star, Check } from 'lucide-react'
import PnlNumber from '@/components/shared/PnlNumber'
import { formatAmount, formatPct, formatTradeDate } from '@/lib/format'
import { mockPnlSummary, mockNetValueSeries, mockTrades, mockTags } from '@/lib/mock'

type Trade = (typeof mockTrades)[0]

// ── Perf cards ────────────────────────────────────────────────

function PerfCard({ label, value, isPnl = false }: { label: string; value: number | null; isPnl?: boolean }) {
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
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(value === n ? 0 : n)}
          className="transition-colors duration-[120ms]"
        >
          <Star
            size={18}
            strokeWidth={1.5}
            fill={(hovered || value) >= n ? 'var(--color-warning)' : 'transparent'}
            style={{ color: (hovered || value) >= n ? 'var(--color-warning)' : 'var(--color-border-default)' }}
          />
        </button>
      ))}
    </div>
  )
}

function IntentDrawer({ trade, onClose }: { trade: Trade; onClose: () => void }) {
  const [selectedTags, setSelectedTags] = useState<string[]>(trade.intent_tags ?? [])
  const [confidence, setConfidence] = useState(trade.intent_confidence ?? 0)
  const [thesis, setThesis] = useState(trade.intent_thesis ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newTagInput, setNewTagInput] = useState('')
  const [showNewTag, setShowNewTag] = useState(false)

  const allTags = [...new Set([...mockTags.map(t => t.name), ...selectedTags])]

  function toggleTag(tag: string) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  function handleSave() {
    setSaving(true)
    setTimeout(() => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 1500) }, 800)
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
            ¥{trade.price.toFixed(3)} &nbsp;·&nbsp; {trade.quantity.toLocaleString()}股 &nbsp;·&nbsp; {formatAmount(trade.amount)}
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
            {saving && <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(255,255,255,0.4) var(--color-text-on-brand) var(--color-text-on-brand) var(--color-text-on-brand)' }} />}
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Dashboard ─────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const summary = mockPnlSummary
  const { dates, portfolio, index } = mockNetValueSeries

  const [indexType, setIndexType] = useState<'hs300' | 'sh'>('hs300')
  const [filterCode, setFilterCode] = useState('')
  const [filterSide, setFilterSide] = useState('all')
  const [activeTrade, setActiveTrade] = useState<Trade | null>(null)

  const trades = mockTrades.filter(t => {
    if (filterCode && !t.stock_code.includes(filterCode) && !t.stock_name.includes(filterCode)) return false
    if (filterSide !== 'all' && t.side !== filterSide) return false
    return true
  })

  const chartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#141413',
      borderColor: 'transparent',
      textStyle: { color: '#faf9f5', fontSize: 12 },
      formatter: (params: { seriesName: string; value: number; axisValue: string }[]) =>
        `<div style="padding:4px 0"><b>${params[0].axisValue}</b></div>` +
        params.map(p => `<div style="display:flex;gap:12px;justify-content:space-between"><span>${p.seriesName}</span><b>${p.value.toFixed(4)}</b></div>`).join(''),
    },
    legend: {
      data: ['账户净值', indexType === 'hs300' ? '沪深300' : '上证综指'],
      right: 0, top: 0,
      textStyle: { color: '#87867f', fontSize: 12 },
    },
    grid: { left: 0, right: 0, top: 32, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category', data: dates,
      axisLine: { lineStyle: { color: '#f0eee6' } },
      axisTick: { show: false },
      axisLabel: { color: '#87867f', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#f0eee6', type: 'dashed' } },
      axisLabel: { color: '#87867f', fontSize: 11, formatter: (v: number) => v.toFixed(3) },
    },
    series: [
      {
        name: '账户净值', type: 'line', data: portfolio, smooth: true, symbol: 'none',
        lineStyle: { color: '#c96442', width: 2 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(201,100,66,0.12)' }, { offset: 1, color: 'rgba(201,100,66,0)' }] } },
      },
      {
        name: indexType === 'hs300' ? '沪深300' : '上证综指', type: 'line', data: index, smooth: true, symbol: 'none',
        lineStyle: { color: '#5e5d59', width: 1.5, type: 'dashed' },
      },
    ],
  }

  return (
    <div className="flex flex-col gap-8">
      <h1
        className="font-serif font-medium"
        style={{ color: 'var(--color-text-primary)', fontSize: 'var(--font-size-page-title)', lineHeight: 1.25 }}
      >
        交易总览
      </h1>

      <div className="grid grid-cols-4 gap-5">
        <PerfCard label="总收益率" value={summary.total_return_rate} />
        <PerfCard label="最大回撤" value={summary.max_drawdown} />
        <PerfCard label="累计已实现盈亏" value={summary.total_realized} isPnl />
        <PerfCard label="当前浮动盈亏" value={summary.total_float} isPnl />
      </div>

      <div
        className="rounded-lg p-5"
        style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>账户净值 vs 基准</span>
          <div className="flex gap-1">
            {(['hs300', 'sh'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setIndexType(t)}
                className="px-3 py-1 rounded text-xs transition-colors duration-[120ms]"
                style={{
                  background: indexType === t ? 'var(--color-bg-surface-selected)' : 'transparent',
                  color: indexType === t ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                  border: '1px solid var(--color-border-default)',
                }}
              >
                {t === 'hs300' ? '沪深300' : '上证综指'}
              </button>
            ))}
          </div>
        </div>
        {dates.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            导入成交数据后显示净值曲线
          </div>
        ) : (
          <ReactECharts option={chartOption} style={{ height: 280 }} />
        )}
      </div>

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
            <option value="transfer_in">担保品划入</option>
          </select>
        </div>

        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)' }}>
          {trades.length === 0 ? (
            <p className="p-8 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>暂无成交记录</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-bg-sidebar)' }}>
                  {['日期', '股票', '方向', '成交价', '数量', '成交金额', '意图标签', '操作'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-left"
                      style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
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
                    <td className="px-4 tabular-nums text-right" style={{ color: 'var(--color-text-secondary)' }}>{t.price.toFixed(3)}</td>
                    <td className="px-4 tabular-nums text-right" style={{ color: 'var(--color-text-primary)' }}>{t.quantity.toLocaleString()}</td>
                    <td className="px-4 tabular-nums text-right" style={{ color: 'var(--color-text-primary)' }}>{formatAmount(t.amount)}</td>
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
                          onClick={() => navigate(`/reviews/trade/${t.id}`)}
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
      </section>

      {activeTrade && <IntentDrawer trade={activeTrade} onClose={() => setActiveTrade(null)} />}
    </div>
  )
}
