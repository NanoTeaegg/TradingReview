import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowUpDown, Bot } from 'lucide-react'
import PnlNumber from '@/components/shared/PnlNumber'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAmount, formatPct } from '@/lib/format'
import { mockHoldings } from '@/lib/mock'

type SortKey = 'float_pnl' | 'market_value' | 'float_pnl_rate'

export default function HoldingsSection() {
  const navigate = useNavigate()
  const [sortKey, setSortKey] = useState<SortKey>('float_pnl')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const marketLoading = false
  const marketError = false

  const holdings = [...mockHoldings].sort((a, b) => {
    const diff = Math.abs(b[sortKey]) - Math.abs(a[sortKey])
    return sortDir === 'desc' ? diff : -diff
  })

  const totalMarketValue = holdings.reduce((s, h) => s + h.market_value, 0)
  const totalFloatPnl = holdings.reduce((s, h) => s + h.float_pnl, 0)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const ThBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button
      className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide"
      style={{ color: 'var(--color-text-secondary)' }}
      onClick={() => toggleSort(col)}
    >
      {label}
      <ArrowUpDown size={12} />
    </button>
  )

  if (holdings.length === 0) {
    return (
      <section id="holdings-summary" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          当前持仓
        </h2>
        <div className="flex flex-col items-center justify-center rounded-lg py-20 gap-3" style={{ border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>暂无持仓数据。导入成交记录后，持仓将自动计算。</p>
          <a className="text-sm underline" style={{ color: 'var(--color-primary)' }} href="#import-upload">
            去上传成交文件
          </a>
        </div>
      </section>
    )
  }

  return (
    <section id="holdings-summary" className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            当前持仓
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            持仓明细已合并到总览页底部，便于从账户表现一路扫到单票浮盈。
          </p>
        </div>
        {marketLoading && (
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>行情更新中...</span>
        )}
      </div>

      {marketError && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm"
          style={{ background: 'rgba(217,119,6,0.06)', borderLeft: '4px solid var(--color-warning)' }}
        >
          <AlertTriangle size={14} style={{ color: 'var(--color-warning)' }} />
          <span style={{ color: 'var(--color-text-primary)' }}>行情获取失败，市值与浮动盈亏无法计算</span>
        </div>
      )}

      <div className="flex gap-6 text-sm">
        <div>
          <span style={{ color: 'var(--color-text-tertiary)' }}>总持仓市值 </span>
          <span className="font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{formatAmount(totalMarketValue)}</span>
        </div>
        <div>
          <span style={{ color: 'var(--color-text-tertiary)' }}>总浮动盈亏 </span>
          <PnlNumber value={totalFloatPnl} formatter={formatAmount} className="font-semibold" />
        </div>
        <div>
          <span style={{ color: 'var(--color-text-tertiary)' }}>持仓股票数 </span>
          <span className="font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{holdings.length}</span>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-bg-sidebar)' }}>
              {[
                { label: '股票', align: 'left' },
                { label: '持仓数量', align: 'right' },
                { label: '持仓均价', align: 'right' },
                { label: '最新价', align: 'right' },
              ].map(({ label, align }) => (
                <th
                  key={label}
                  className={`px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-${align}`}
                  style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-subtle)' }}
                >
                  {label}
                </th>
              ))}
              <th className="px-4 py-2.5 text-right" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <ThBtn col="market_value" label="市值" />
              </th>
              <th className="px-4 py-2.5 text-right" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <ThBtn col="float_pnl" label="浮动盈亏" />
              </th>
              <th className="px-4 py-2.5 text-right" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <ThBtn col="float_pnl_rate" label="盈亏率" />
              </th>
              <th className="px-4 py-2.5 text-center" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr
                key={h.stock_code}
                className="transition-colors duration-[120ms] group"
                style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-bg-surface)')}
              >
                <td className="px-4" style={{ height: 44 }}>
                  <div className="flex flex-col">
                    <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{h.stock_name}</span>
                    <span className="font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{h.stock_code}</span>
                  </div>
                </td>
                <td className="px-4 text-right tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                  {h.quantity.toLocaleString()}
                </td>
                <td className="px-4 text-right tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                  {marketLoading ? <Skeleton className="h-4 w-16 ml-auto" /> : h.avg_cost.toFixed(3)}
                </td>
                <td className="px-4 text-right tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                  {marketLoading ? <Skeleton className="h-4 w-16 ml-auto" /> : h.latest_price?.toFixed(2) ?? '—'}
                </td>
                <td className="px-4 text-right tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                  {marketLoading ? <Skeleton className="h-4 w-20 ml-auto" /> : formatAmount(h.market_value)}
                </td>
                <td className="px-4 text-right">
                  {marketLoading ? <Skeleton className="h-4 w-20 ml-auto" /> : <PnlNumber value={h.float_pnl} formatter={formatAmount} />}
                </td>
                <td className="px-4 text-right">
                  {marketLoading ? <Skeleton className="h-4 w-14 ml-auto" /> : <PnlNumber value={h.float_pnl_rate} formatter={formatPct} />}
                </td>
                <td className="px-4 text-center">
                  <button
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs mx-auto transition-colors duration-[120ms]"
                    style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}
                    onClick={() => navigate(`/reviews/stock/${h.stock_code}`)}
                  >
                    <Bot size={12} />
                    AI复盘
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
