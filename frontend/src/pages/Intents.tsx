import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import { AlertTriangle } from 'lucide-react'
import PnlNumber from '@/components/shared/PnlNumber'
import { formatAmount, formatDatetime } from '@/lib/format'
import { mockIntents } from '@/lib/mock'

type TabKey = 'list' | 'stats'

const tagStats = [
  { tag: '突破', count: 3, winRate: 0.667, avgPnl: 8400, avgDays: 28 },
  { tag: '止盈', count: 1, winRate: 1.0, avgPnl: 8400, avgDays: 36 },
  { tag: '补仓', count: 1, winRate: 0, avgPnl: -25418, avgDays: 1 },
  { tag: '消费白马', count: 1, winRate: 0, avgPnl: 16450, avgDays: 38 },
  { tag: '高位', count: 1, winRate: 0, avgPnl: -25418, avgDays: 1 },
]

const monthlyTurnover = [
  { month: '2025-12', rate: 95 },
  { month: '2026-01', rate: 130 },
  { month: '2026-02', rate: 85 },
  { month: '2026-03', rate: 210 },
  { month: '2026-04', rate: 175 },
  { month: '2026-05', rate: 145 },
]

export default function Intents() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabKey>('list')
  const [filterCode, setFilterCode] = useState('')
  const [statsRange, setStatsRange] = useState<'30d' | '90d' | 'all'>('all')

  const intents = mockIntents.filter(i =>
    !filterCode || i.stock_code.includes(filterCode) || i.stock_name.includes(filterCode)
  )

  const totalTrades = 5
  const taggedTrades = 4
  const taggedRate = taggedTrades / totalTrades

  const turnoverChartOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#141413', textStyle: { color: '#faf9f5', fontSize: 12 } },
    grid: { left: 0, right: 0, top: 12, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category',
      data: monthlyTurnover.map(m => m.month),
      axisLabel: { color: '#87867f', fontSize: 11 },
      axisLine: { lineStyle: { color: '#f0eee6' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#f0eee6', type: 'dashed' } },
      axisLabel: { color: '#87867f', fontSize: 11, formatter: (v: number) => `${v}%` },
    },
    series: [{
      type: 'bar',
      data: monthlyTurnover.map(m => ({
        value: m.rate,
        itemStyle: { color: m.rate > 200 ? 'var(--color-loss)' : 'var(--color-primary)', borderRadius: [4, 4, 0, 0] },
      })),
    }],
  }

  return (
    <div className="flex flex-col gap-6">
      <h1
        className="font-serif font-medium"
        style={{ color: 'var(--color-text-primary)', fontSize: 'var(--font-size-page-title)', lineHeight: 1.25 }}
      >
        交易意图
      </h1>

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
        {([['list', '意图列表'], ['stats', '复盘统计']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className="px-4 py-2.5 text-sm transition-colors duration-[120ms]"
            style={{
              borderBottom: tab === key ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: tab === key ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontWeight: tab === key ? 600 : 400,
              marginBottom: -1,
            }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <>
          <div className="flex items-center gap-3">
            <input
              className="h-9 px-3 rounded-md text-sm outline-none"
              style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)', minWidth: 200 }}
              placeholder="股票代码 / 名称"
              value={filterCode}
              onChange={e => setFilterCode(e.target.value)}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-focus-ring)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
            />
          </div>

          {intents.length === 0 ? (
            <div className="flex flex-col items-center py-24 gap-3">
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                还没有意图记录。在流水页点击任意成交记录开始添加。
              </p>
              <button className="text-sm underline" style={{ color: 'var(--color-primary)' }} onClick={() => navigate('/trades')}>
                去流水页
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-0 rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)' }}>
              {intents.map((intent, i) => (
                <div
                  key={intent.id}
                  className="px-4 py-3 flex items-start gap-4 transition-colors duration-[120ms] cursor-pointer"
                  style={{
                    borderBottom: i < intents.length - 1 ? '1px solid var(--color-border-subtle)' : undefined,
                    background: 'var(--color-bg-surface)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg-surface)')}
                  onClick={() => navigate(`/reviews/trade/${intent.trade_id}`)}
                >
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                        {intent.stock_name}
                      </span>
                      <span className="font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                        {intent.stock_code}
                      </span>
                    </div>
                    {intent.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {intent.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-xs text-xs" style={{ background: 'var(--color-bg-tag)', color: 'var(--color-text-secondary)' }}>
                            {tag}
                          </span>
                        ))}
                        {intent.tags.length > 3 && (
                          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>+{intent.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                    {intent.thesis && (
                      <p className="text-xs line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
                        {intent.thesis}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {intent.pnl_realized != null ? (
                      <PnlNumber value={intent.pnl_realized} formatter={formatAmount} className="text-sm font-semibold" />
                    ) : intent.pnl_float != null ? (
                      <PnlNumber value={intent.pnl_float} formatter={formatAmount} className="text-sm font-semibold" />
                    ) : null}
                    <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      {formatDatetime(intent.created_at).slice(0, 10)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'stats' && (
        <div className="flex flex-col gap-6">
          {/* Module A: Win rate */}
          <div className="rounded-lg p-5" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
            <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>整体胜率与盈亏比</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {[
                { label: '总胜率', value: '66.7%', color: 'var(--color-profit)' },
                { label: '平均盈利幅度', value: '+18.2%', color: 'var(--color-profit)' },
                { label: '平均亏损幅度', value: '-9.6%', color: 'var(--color-loss)' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex flex-col gap-1">
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{label}</span>
                  <span className="text-2xl font-semibold tabular-nums" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
            <p className="text-xs mt-3 px-3 py-2 rounded" style={{ background: 'rgba(217,119,6,0.06)', color: 'var(--color-warning)' }}>
              样本量不足 5 笔，数据仅供参考
            </p>
          </div>

          {/* Module B: Tag win rates */}
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-sidebar)' }}>
              <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>标签维度胜率</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['标签', '交易次数', '胜率', '平均盈亏', '平均持仓天数'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-left"
                      style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tagStats.map(t => (
                  <tr key={t.tag} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg-surface)')}>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-xs text-xs" style={{ background: 'var(--color-bg-tag)', color: 'var(--color-text-secondary)' }}>{t.tag}</span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{t.count}</td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: t.winRate > 0.5 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                      {(t.winRate * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-2.5"><PnlNumber value={t.avgPnl} formatter={formatAmount} /></td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{t.avgDays}天</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Module C: Discipline */}
          <div className="rounded-lg p-5" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>交易系统符合率</h3>
              <div className="flex gap-1">
                {(['30d', '90d', 'all'] as const).map(r => (
                  <button key={r} onClick={() => setStatsRange(r)}
                    className="px-3 py-1 rounded text-xs transition-colors duration-[120ms]"
                    style={{
                      background: statsRange === r ? 'var(--color-bg-surface-selected)' : 'transparent',
                      color: statsRange === r ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                      border: '1px solid var(--color-border-default)',
                    }}>
                    {r === '30d' ? '近30天' : r === '90d' ? '近90天' : '全部'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
                <svg width={80} height={80} className="-rotate-90">
                  <circle cx={40} cy={40} r={32} fill="none" stroke="var(--color-border-default)" strokeWidth={8} />
                  <circle cx={40} cy={40} r={32} fill="none"
                    stroke={taggedRate < 0.6 ? 'var(--color-warning)' : 'var(--color-profit)'}
                    strokeWidth={8}
                    strokeDasharray={`${taggedRate * 2 * Math.PI * 32} ${2 * Math.PI * 32}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-base font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                  {(taggedRate * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  {taggedTrades} / {totalTrades} 笔成交已打标签
                </p>
                {taggedRate < 0.6 && (
                  <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-warning)' }}>
                    <AlertTriangle size={12} />
                    交易纪律执行偏低，建议及时补录意图
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Module D: Monthly turnover */}
          <div className="rounded-lg p-5" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
            <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>月换手率趋势</h3>
            <ReactECharts option={turnoverChartOption} style={{ height: 200 }} />
          </div>
        </div>
      )}
    </div>
  )
}
