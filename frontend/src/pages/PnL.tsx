import { useState } from 'react'
import PnlNumber from '@/components/shared/PnlNumber'
import { formatAmount, formatPct } from '@/lib/format'
import { mockPnlSummary, mockHoldings } from '@/lib/mock'

type TabKey = 'realized' | 'float'

const mockRealized = [
  {
    id: 1,
    stock_code: '688599',
    stock_name: '天合光能',
    buy_date: '2026-03-10',
    sell_date: '2026-04-15',
    buy_avg: 31.2,
    sell_price: 38.5,
    quantity: 2000,
    pnl: 8400,
    pnl_rate: 0.2340,
    hold_days: 36,
  },
]

export default function PnL() {
  const [tab, setTab] = useState<TabKey>('realized')
  const summary = mockPnlSummary

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-2xl font-medium" style={{ color: 'var(--color-text-primary)' }}>盈亏</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-5">
        {[
          { label: '累计已实现盈亏', value: summary.total_realized },
          { label: '当前浮动盈亏', value: summary.total_float },
          { label: '当日盈亏', value: summary.day_pnl },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg p-5 flex flex-col gap-2" style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
          }}>
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>{label}</span>
            <PnlNumber value={value} formatter={formatAmount} className="text-2xl font-semibold" />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
        {([['realized', '已实现盈亏'], ['float', '浮动盈亏 & 当日盈亏']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-4 py-2.5 text-sm transition-colors duration-[120ms]"
            style={{
              borderBottom: tab === key ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: tab === key ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontWeight: tab === key ? 600 : 400,
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'realized' && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)' }}>
          {mockRealized.length === 0 ? (
            <p className="p-8 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              暂无已平仓成交记录
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-bg-sidebar)' }}>
                  {['股票', '买入均价', '卖出价', '数量', '持仓天数', '已实现盈亏', '盈亏率'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-right first:text-left"
                      style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockRealized.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg-surface)')}>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col">
                        <span style={{ color: 'var(--color-text-primary)' }}>{r.stock_name}</span>
                        <span className="font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{r.stock_code}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{r.buy_avg.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{r.sell_price.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{r.quantity.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{r.hold_days}天</td>
                    <td className="px-4 py-2.5 text-right">
                      <PnlNumber value={r.pnl} formatter={formatAmount} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <PnlNumber value={r.pnl_rate} formatter={formatPct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'float' && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)' }}>
          {mockHoldings.length === 0 ? (
            <p className="p-8 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>暂无持仓数据</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-bg-sidebar)' }}>
                  {['股票', '数量', '均价', '最新价', '浮动盈亏', '盈亏率', '当日盈亏'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-right first:text-left"
                      style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockHoldings.map(h => (
                  <tr key={h.stock_code} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg-surface)')}>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col">
                        <span style={{ color: 'var(--color-text-primary)' }}>{h.stock_name}</span>
                        <span className="font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{h.stock_code}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{h.quantity.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{h.avg_cost.toFixed(3)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{h.latest_price.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right"><PnlNumber value={h.float_pnl} formatter={formatAmount} /></td>
                    <td className="px-4 py-2.5 text-right"><PnlNumber value={h.float_pnl_rate} formatter={formatPct} /></td>
                    <td className="px-4 py-2.5 text-right"><PnlNumber value={h.day_pnl} formatter={formatAmount} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
