import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, TrendingUp, Clock } from 'lucide-react'
import { formatDatetime } from '@/lib/format'
import { mockReviews } from '@/lib/mock'

const scopeIcon = { stock: TrendingUp, trade: FileText, period: Clock }
const scopeLabel = { stock: '单股', trade: '单笔', period: '时段' }

export default function Reviews() {
  const navigate = useNavigate()
  const [showNewPeriod, setShowNewPeriod] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  function handleNewPeriod() {
    if (!fromDate || !toDate) return
    navigate(`/reviews/period?from=${fromDate}&to=${toDate}`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-medium" style={{ color: 'var(--color-text-primary)' }}>复盘报告</h1>
        <button
          className="flex items-center gap-2 px-4 h-9 rounded-md text-sm font-medium transition-colors duration-[120ms]"
          style={{ background: 'var(--color-bg-surface-selected)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
          onClick={() => setShowNewPeriod(!showNewPeriod)}
        >
          <Plus size={14} /> 新建时间段复盘
        </button>
      </div>

      {showNewPeriod && (
        <div className="flex items-center gap-3 p-4 rounded-lg" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>从</span>
          <input type="date" className="h-9 px-3 rounded-md text-sm outline-none"
            style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
            value={fromDate} onChange={e => setFromDate(e.target.value)}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-focus-ring)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
          />
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>至</span>
          <input type="date" className="h-9 px-3 rounded-md text-sm outline-none"
            style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
            value={toDate} onChange={e => setToDate(e.target.value)}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-focus-ring)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
          />
          <button
            className="px-4 h-9 rounded-md text-sm font-medium transition-colors duration-[120ms]"
            style={{ background: 'var(--color-primary)', color: 'var(--color-text-on-brand)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-primary-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-primary)')}
            onClick={handleNewPeriod}
          >
            确认
          </button>
        </div>
      )}

      {mockReviews.length === 0 ? (
        <div className="flex flex-col items-center py-24 gap-3">
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            还没有复盘报告。从持仓页或流水页触发第一次 AI 复盘。
          </p>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)' }}>
          {mockReviews.map((r, i) => {
            const Icon = scopeIcon[r.scope as keyof typeof scopeIcon] ?? FileText
            return (
              <div key={r.id}
                className="flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors duration-[120ms]"
                style={{
                  background: 'var(--color-bg-surface)',
                  borderBottom: i < mockReviews.length - 1 ? '1px solid var(--color-border-subtle)' : undefined,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg-surface)')}
                onClick={() => {
                  if (r.scope === 'trade' && r.trade_id) navigate(`/reviews/trade/${r.trade_id}`)
                  else if (r.scope === 'stock' && r.stock_code) navigate(`/reviews/stock/${r.stock_code}`)
                }}
              >
                <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: 'var(--color-primary-subtle)' }}>
                  <Icon size={16} style={{ color: 'var(--color-primary)' }} strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {r.scope_desc}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    {scopeLabel[r.scope as keyof typeof scopeLabel]} · {r.model} · {formatDatetime(r.created_at)}
                  </p>
                </div>
                <button
                  className="px-3 h-8 rounded text-xs transition-colors duration-[120ms]"
                  style={{ background: 'var(--color-bg-surface-selected)', color: 'var(--color-text-primary)' }}
                >
                  查看
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
