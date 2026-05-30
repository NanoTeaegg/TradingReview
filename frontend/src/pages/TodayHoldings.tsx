import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, Bot, AlertTriangle } from 'lucide-react'
import PnlNumber from '@/components/shared/PnlNumber'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAmount, formatPct } from '@/lib/format'
import { mockHoldings, mockMarketSentiment } from '@/lib/mock'

type SortKey = 'float_pnl' | 'market_value' | 'float_pnl_rate'
const NOTE_KEY = 'trading_note_tomorrow'

// ── 盘面解析 ──────────────────────────────────────────────────

function SentimentBadge({ sentiment }: { sentiment: 'bullish' | 'neutral' | 'bearish' }) {
  const map = {
    bullish: { label: '偏多', color: 'var(--color-profit)', bg: 'var(--color-profit-bg)' },
    neutral: { label: '中性', color: 'var(--color-text-tertiary)', bg: 'var(--color-border-subtle)' },
    bearish: { label: '偏空', color: 'var(--color-loss)', bg: 'var(--color-loss-bg)' },
  }
  const { label, color, bg } = map[sentiment]
  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ color, background: bg }}>
      {label}
    </span>
  )
}

function StatRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span className="text-sm font-semibold tabular-nums" style={{ color: color ?? 'var(--color-text-primary)' }}>
        {value}
      </span>
    </div>
  )
}

function MarketSection() {
  const s = mockMarketSentiment
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>盘面解析</h2>
      <div className="grid grid-cols-3 gap-5">
        <div
          className="rounded-lg p-5 flex flex-col gap-1"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>市场情绪</span>
            <SentimentBadge sentiment={s.sentiment} />
          </div>
          {!s.is_trading_day ? (
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>今日休市</p>
          ) : (
            <>
              <StatRow label="上涨家数" value={s.up_count.toLocaleString()} color="var(--color-profit)" />
              <StatRow label="下跌家数" value={s.down_count.toLocaleString()} color="var(--color-loss)" />
              <StatRow label="平盘家数" value={s.flat_count.toLocaleString()} />
            </>
          )}
        </div>

        <div
          className="rounded-lg p-5 flex flex-col gap-1"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}
        >
          <span className="text-base font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>涨跌停统计</span>
          <StatRow label="涨停家数" value={s.limit_up} color="var(--color-profit)" />
          <StatRow label="跌停家数" value={s.limit_down} color="var(--color-loss)" />
          <StatRow label="涨跌停比" value={`${s.limit_up} : ${s.limit_down}`} />
        </div>

        <div
          className="rounded-lg p-5 flex flex-col gap-1"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}
        >
          <span className="text-base font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>资金概况</span>
          <StatRow label="全市场成交额" value={`${s.total_volume_billion.toLocaleString()} 亿`} />
          <StatRow label="数据日期" value={s.date} />
          <StatRow
            label="交易状态"
            value={s.is_trading_day ? '交易日' : '休市'}
            color={s.is_trading_day ? 'var(--color-profit)' : 'var(--color-text-tertiary)'}
          />
        </div>
      </div>
    </section>
  )
}

// ── 当日持仓 ──────────────────────────────────────────────────

export default function TodayHoldings() {
  const navigate = useNavigate()
  const [sortKey, setSortKey] = useState<SortKey>('market_value')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [note, setNote] = useState(() => localStorage.getItem(NOTE_KEY) ?? '')
  const [noteSaved, setNoteSaved] = useState(false)
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
    else { setSortKey(key); setSortDir('desc') }
  }

  function saveNote() {
    localStorage.setItem(NOTE_KEY, note)
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 1800)
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

  return (
    <div className="flex flex-col gap-8">
      <h1
        className="font-serif font-medium"
        style={{ color: 'var(--color-text-primary)', fontSize: 'var(--font-size-page-title)', lineHeight: 1.25 }}
      >
        当日持仓
      </h1>

      <MarketSection />

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>持仓明细</h2>
          <div className="flex gap-6 text-sm">
            <div>
              <span style={{ color: 'var(--color-text-tertiary)' }}>总持仓市值 </span>
              <span className="font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                {formatAmount(totalMarketValue)}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-tertiary)' }}>总浮动盈亏 </span>
              <PnlNumber value={totalFloatPnl} formatter={formatAmount} className="font-semibold" />
            </div>
            <div>
              <span style={{ color: 'var(--color-text-tertiary)' }}>股票数 </span>
              <span className="font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                {holdings.length}
              </span>
            </div>
          </div>
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

        {holdings.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-lg py-20 gap-3"
            style={{ border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)' }}
          >
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              暂无持仓数据。导入成交记录后，持仓将自动计算。
            </p>
          </div>
        ) : (
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
                    className="transition-colors duration-[120ms]"
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
        )}
      </section>

      {/* Tomorrow's trading note */}
      <div
        className="rounded-lg p-5 flex flex-col gap-3"
        style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            明日操作思路
          </span>
          <button
            onClick={saveNote}
            className="px-3 py-1 rounded text-xs font-medium transition-colors duration-[120ms]"
            style={{
              background: noteSaved ? 'var(--color-success-bg, rgba(34,197,94,0.1))' : 'var(--color-bg-surface-selected)',
              color: noteSaved ? 'var(--color-success, #16a34a)' : 'var(--color-text-primary)',
              border: '1px solid var(--color-border-default)',
            }}
          >
            {noteSaved ? '已保存' : '保存'}
          </button>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="记录明日计划：关注标的、止盈止损位、仓位调整思路…"
          rows={5}
          className="w-full resize-y rounded-lg px-3 py-2.5 text-sm outline-none transition-colors duration-[120ms]"
          style={{
            background: 'var(--color-bg-app)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-primary)',
            lineHeight: 1.6,
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-focus, var(--color-primary))')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-subtle)')}
        />
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          内容暂存于本地，后续版本将同步到服务端。
        </p>
      </div>
    </div>
  )
}
