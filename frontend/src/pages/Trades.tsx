import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Bot, X, Star, Check } from 'lucide-react'
import { formatTradeDate, formatAmount } from '@/lib/format'
import { mockTrades, mockTags } from '@/lib/mock'

type Trade = (typeof mockTrades)[0]

function SideBadge({ side }: { side: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    buy: { label: '买入', bg: 'rgba(22,163,74,0.10)', color: 'var(--color-profit)' },
    sell: { label: '卖出', bg: 'rgba(181,51,51,0.10)', color: 'var(--color-loss)' },
    transfer_in: { label: '划入', bg: 'var(--color-border-subtle)', color: 'var(--color-text-tertiary)' },
  }
  const { label, bg, color } = map[side] ?? map['buy']
  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: bg, color }}>
      {label}
    </span>
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

function IntentDrawer({
  trade,
  onClose,
}: {
  trade: Trade
  onClose: () => void
}) {
  const [selectedTags, setSelectedTags] = useState<string[]>(trade.intent_tags ?? [])
  const [confidence, setConfidence] = useState(trade.intent_confidence ?? 0)
  const [thesis, setThesis] = useState(trade.intent_thesis ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newTagInput, setNewTagInput] = useState('')
  const [showNewTag, setShowNewTag] = useState(false)

  const allTags = [...new Set([...mockTags.map(t => t.name), ...selectedTags])]

  function toggleTag(tag: string) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  function handleSave() {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }, 800)
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
      {/* Overlay */}
      <div
        className="fixed inset-0 transition-opacity duration-[200ms]"
        style={{ background: 'rgba(20,20,19,0.25)', zIndex: 'var(--z-panel)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full flex flex-col"
        style={{
          width: 'var(--right-panel-width)',
          background: 'var(--color-bg-surface)',
          boxShadow: 'var(--shadow-panel)',
          zIndex: 'calc(var(--z-panel) + 1)',
          animation: 'slideInFromRight 200ms ease',
        }}
      >
        <style>{`
          @keyframes slideInFromRight {
            from { transform: translateX(400px); }
            to { transform: translateX(0); }
          }
        `}</style>

        {/* Header */}
        <div className="flex items-center justify-between px-4 shrink-0" style={{ height: 52, borderBottom: '1px solid var(--color-border-subtle)' }}>
          <span className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>编辑交易意图</span>
          <button onClick={onClose} className="p-1 rounded transition-colors duration-[120ms]"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}>
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Saved banner */}
        {saved && (
          <div className="flex items-center gap-2 px-4 py-2 text-sm" style={{ background: 'rgba(22,163,74,0.08)', color: 'var(--color-success)' }}>
            <Check size={14} />
            已保存
          </div>
        )}

        {/* Trade summary */}
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

        {/* Form content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
          {/* Tags */}
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

          {/* Confidence */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>信心度（1-5）</label>
            <StarRating value={confidence} onChange={setConfidence} />
          </div>

          {/* Thesis */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>交易思路</label>
            <textarea
              className="w-full rounded-md p-3 text-sm resize-none outline-none transition-colors duration-[120ms]"
              style={{
                minHeight: 120,
                border: '1px solid var(--color-border-default)',
                color: 'var(--color-text-primary)',
                background: 'var(--color-bg-surface)',
              }}
              placeholder="可选，不限字数..."
              value={thesis}
              onChange={e => setThesis(e.target.value)}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-focus-ring)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
            />
          </div>
        </div>

        {/* Footer buttons */}
        <div
          className="flex items-center justify-end gap-3 px-4 shrink-0"
          style={{ height: 64, borderTop: '1px solid var(--color-border-subtle)' }}
        >
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

export default function Trades() {
  const navigate = useNavigate()
  const [filterCode, setFilterCode] = useState('')
  const [filterSide, setFilterSide] = useState('all')
  const [activeTrade, setActiveTrade] = useState<Trade | null>(null)

  const trades = mockTrades.filter(t => {
    if (filterCode && !t.stock_code.includes(filterCode) && !t.stock_name.includes(filterCode)) return false
    if (filterSide !== 'all' && t.side !== filterSide) return false
    return true
  })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-2xl font-medium" style={{ color: 'var(--color-text-primary)' }}>流水</h1>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <input
          className="h-9 px-3 rounded-md text-sm outline-none transition-colors duration-[120ms]"
          style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)', minWidth: 200 }}
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

      {/* Table */}
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
                        {t.intent_tags.slice(0, 2).map(tag => (
                          <TagChip key={tag} label={tag} />
                        ))}
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

      {/* Intent Drawer */}
      {activeTrade && (
        <IntentDrawer trade={activeTrade} onClose={() => setActiveTrade(null)} />
      )}
    </div>
  )
}
