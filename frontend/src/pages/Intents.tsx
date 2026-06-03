import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, HelpCircle, SlidersHorizontal, X } from 'lucide-react'
import EChart from '@/components/shared/EChart'
import PnlNumber from '@/components/shared/PnlNumber'
import { formatAmount, formatDatetime, formatPct } from '@/lib/format'
import {
  useIntents, useWinRate, useDiscipline, useTurnover, useTagPerformance, useEquityCurve,
  n,
} from '@/lib/queries'

type TabKey = 'list' | 'stats'

function readCssToken(name: string) {
  if (typeof window === 'undefined') return `var(${name})`
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || `var(${name})`
}

export default function Intents() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabKey>('stats')
  const [filterCode, setFilterCode] = useState('')
  const [statsRange, setStatsRange] = useState<'30d' | '90d' | 'all'>('all')
  const [showHelp, setShowHelp] = useState(false)
  const [turnoverRange, setTurnoverRange] = useState<'1m' | 'ytd' | 'all' | 'custom'>('all')
  const [turnoverCustom, setTurnoverCustom] = useState({ start: '', end: '' })

  const { data: intents = [], isLoading: intentsLoading } = useIntents(filterCode || undefined)
  const { data: winRate } = useWinRate()
  const { data: discipline } = useDiscipline()
  const { data: turnover = [] } = useTurnover()
  const { data: tagPerf = [] } = useTagPerformance()
  const { data: curve } = useEquityCurve()

  const overviewReturns = useMemo<(number | null)[]>(() => {
    if (!curve || turnover.length === 0) return []
    const { dates, nav } = curve
    const baseNav = nav[0]
    if (!baseNav) return turnover.map(() => null)
    function overviewReturnAtOrBefore(targetDate: string): number | null {
      let idx = -1
      for (let i = 0; i < dates.length; i++) {
        if (dates[i] <= targetDate) idx = i
        else break
      }
      if (idx < 0) return null
      return +(((nav[idx] / baseNav) - 1) * 100).toFixed(2)
    }
    return turnover.map(item => overviewReturnAtOrBefore(item.week_end))
  }, [curve, turnover])

  const filteredTurnoverData = useMemo(() => {
    if (!turnover.length) return [] as Array<{ item: (typeof turnover)[0]; overviewReturn: number | null }>
    const paired = turnover.map((item, i) => ({ item, overviewReturn: overviewReturns[i] ?? null }))
    if (turnoverRange === 'all') return paired
    if (turnoverRange === '1m') {
      const d = new Date(); d.setMonth(d.getMonth() - 1)
      const cutoff = d.toISOString().slice(0, 10)
      return paired.filter(p => p.item.week_end >= cutoff)
    }
    if (turnoverRange === 'ytd') {
      const ytd = `${new Date().getFullYear()}-01-01`
      return paired.filter(p => p.item.week_start >= ytd)
    }
    return paired.filter(p => {
      const ok1 = !turnoverCustom.start || p.item.week_end >= turnoverCustom.start
      const ok2 = !turnoverCustom.end || p.item.week_start <= turnoverCustom.end
      return ok1 && ok2
    })
  }, [turnover, overviewReturns, turnoverRange, turnoverCustom])

  const taggedRate = discipline?.discipline_rate ?? 0
  const taggedTrades = discipline?.tagged_count ?? 0
  const totalTrades = discipline?.total_count ?? 0
  const chartColors = {
    normal: readCssToken('--color-success'),
    frequent: readCssToken('--color-warning'),
    high: readCssToken('--color-danger'),
    grid: readCssToken('--color-chart-grid'),
    axisLabel: readCssToken('--color-text-tertiary'),
    tooltipBg: readCssToken('--color-text-primary'),
    tooltipText: readCssToken('--color-text-on-dark'),
  }

  const profitColor = readCssToken('--color-profit')
  const lossColor = readCssToken('--color-loss')
  const weekLabels = filteredTurnoverData.map(d => d.item.week)

  function levelColor(level: string) {
    return level === 'high' ? chartColors.high : level === 'frequent' ? chartColors.frequent : chartColors.normal
  }

  const sharedGridOption = { left: 0, right: 28, top: 28, bottom: 24, containLabel: true }
  const sharedXAxis = {
    type: 'category' as const, data: weekLabels, boundaryGap: false,
    axisLabel: { color: chartColors.axisLabel, fontSize: 11 },
    axisLine: { lineStyle: { color: chartColors.grid } },
    axisTick: { show: false },
  }

  const returnChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: chartColors.tooltipBg,
      textStyle: { color: chartColors.tooltipText, fontSize: 12 },
      formatter: (paramsList: Array<{ data?: unknown }>) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = paramsList[0]?.data as any
        const rv: number | null = d?.value ?? null
        const rvColor = rv != null ? (rv >= 0 ? profitColor : lossColor) : chartColors.axisLabel
        const rvText = rv != null ? `<span style="color:${rvColor};font-weight:600">${rv > 0 ? '+' : ''}${rv.toFixed(2)}%</span>` : '—'
        return `<strong>${d?.weekStart ?? ''} ~ ${d?.weekEnd ?? ''}</strong><br/>收益率走势：${rvText}`
      },
    },
    grid: sharedGridOption,
    xAxis: sharedXAxis,
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: chartColors.grid, type: 'dashed' } },
      axisLabel: { color: chartColors.axisLabel, fontSize: 11, formatter: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%` },
      axisLine: { show: false }, axisTick: { show: false },
    },
    series: [{
      name: '收益率走势', type: 'line', smooth: true, connectNulls: false, symbolSize: 7,
      lineStyle: { color: '#c96442', width: 3 },
      itemStyle: { color: '#c96442' },
      label: {
        show: filteredTurnoverData.length <= 24,
        position: 'top',
        color: '#c96442',
        fontSize: 11,
        formatter: (params: { value: number | null }) =>
          params.value == null ? '' : `${(params.value as number) > 0 ? '+' : ''}${(params.value as number).toFixed(1)}%`,
      },
      data: filteredTurnoverData.map(d => ({
        value: d.overviewReturn,
        weekStart: d.item.week_start,
        weekEnd: d.item.week_end,
      })),
    }],
  }

  const turnoverChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: chartColors.tooltipBg,
      textStyle: { color: chartColors.tooltipText, fontSize: 12 },
      formatter: (paramsList: Array<{ data?: unknown }>) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const item = (paramsList[0]?.data as any)?.item as (typeof turnover)[number] | undefined
        if (!item) return ''
        const lc = levelColor(item.level)
        const levelText = item.level === 'high' ? '换手率高度频繁' : item.level === 'frequent' ? '换手率偏频繁' : '换手率正常'
        const pctHtml = item.turnover_rate != null
          ? `<span style="color:${lc};font-weight:700">${formatPct(item.turnover_rate)}</span>`
          : '—'
        return [
          `<strong>${item.week_start} ~ ${item.week_end}</strong>`,
          `周换手率：${pctHtml} <span style="color:${lc}">${levelText}</span>`,
          `成交金额：${formatAmount(Number(item.volume))}`,
          `周平均持仓：${formatAmount(Number(item.avg_holding_value))}`,
          `交易笔数：${item.trade_count} 笔（买 ${item.buy_count} / 卖 ${item.sell_count}）`,
        ].join('<br/>')
      },
    },
    grid: sharedGridOption,
    xAxis: sharedXAxis,
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: chartColors.grid, type: 'dashed' } },
      axisLabel: { color: chartColors.axisLabel, fontSize: 11, formatter: (v: number) => `${(v * 100).toFixed(0)}%` },
      axisLine: { show: false }, axisTick: { show: false },
    },
    visualMap: {
      show: false, dimension: 1, seriesIndex: 0,
      pieces: [
        { lte: 0.8, color: chartColors.normal },
        { gt: 0.8, lte: 1.5, color: chartColors.frequent },
        { gt: 1.5, color: chartColors.high },
      ],
    },
    series: [{
      name: '周换手率', type: 'line', smooth: true, connectNulls: false, symbolSize: 7,
      lineStyle: { width: 3 },
      label: {
        show: filteredTurnoverData.length <= 24,
        position: 'top',
        fontSize: 11,
        fontWeight: 'bold' as const,
        formatter: (params: { value: number | null }) =>
          params.value == null ? '' : `${(params.value * 100).toFixed(0)}%`,
      },
      data: filteredTurnoverData.map(d => ({
        value: d.item.turnover_rate,
        item: d.item,
        label: { color: levelColor(d.item.level) },
      })),
      markLine: {
        symbol: 'none', silent: true,
        label: { color: chartColors.axisLabel, fontSize: 11 },
        lineStyle: { color: chartColors.axisLabel, type: 'dashed', width: 1 },
        data: [{ yAxis: 0.8, name: '换手偏频繁' }, { yAxis: 1.5, name: '操作高度频繁' }],
      },
    }],
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center">
        <h1
          className="font-serif font-medium"
          style={{ color: 'var(--color-text-primary)', fontSize: 'var(--font-size-page-title)', lineHeight: 1.25 }}
        >
          交易复盘
        </h1>
        <button
          onClick={() => setShowHelp(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors duration-[120ms]"
          style={{ color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border-subtle)' }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--color-text-primary)';
            e.currentTarget.style.borderColor = 'var(--color-border-default)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--color-text-tertiary)';
            e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
          }}
        >
          <HelpCircle size={13} strokeWidth={1.5} />
          指标说明
        </button>
      </div>

      {showHelp && (
        <>
          <div
            className="fixed inset-0 transition-opacity duration-[200ms]"
            style={{ background: 'rgba(20,20,19,0.35)', zIndex: 'var(--z-panel)' }}
            onClick={() => setShowHelp(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl flex flex-col"
            style={{
              width: 'min(900px, 92vw)',
              maxHeight: '82vh',
              background: 'var(--color-bg-surface)',
              boxShadow: '0 8px 48px rgba(20,20,19,0.18)',
              zIndex: 'calc(var(--z-panel) + 1)',
              animation: 'fadeInScale 180ms ease',
            }}
          >
            <style>{`@keyframes fadeInScale { from { opacity:0; transform:translate(-50%,-50%) scale(0.96); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }`}</style>
            <div className="flex items-center justify-between px-6 shrink-0" style={{ height: 56, borderBottom: '1px solid var(--color-border-subtle)' }}>
              <span className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>指标说明 · 如何解读复盘统计</span>
              <button onClick={() => setShowHelp(false)} className="p-1 rounded transition-colors duration-[120ms]"
                style={{ color: 'var(--color-text-tertiary)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}>
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5 flex flex-col gap-6">
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                以下指标均基于你已录入的成交数据计算，样本量越大越有统计意义。<strong style={{ color: 'var(--color-text-primary)' }}>建议结合自己的交易风格动态调整阈值判断，而非套用固定标准。</strong>
              </p>

              {([
                {
                  group: '整体胜率与盈亏比',
                  rows: [
                    { name: '总胜率', formula: '盈利笔数 ÷ 总交易笔数（按已平仓回合统计）', purpose: '衡量策略的稳定性。趋势型策略胜率通常低（30–50%），均值回归型通常高（55%+）', note: '胜率高低本身意义有限，需结合盈亏比一起看' },
                    { name: '平均盈利', formula: '所有盈利回合的净盈亏均值', purpose: '反映盈利时平均能赚多少', note: '' },
                    { name: '平均亏损', formula: '所有亏损回合的净盈亏均值（含手续费）', purpose: '反映亏损时平均损失多少', note: '建议控制在账户单笔风险敞口（如总资金1–2%）以内' },
                    { name: '盈亏比', formula: '|平均盈利| ÷ |平均亏损|', purpose: '与胜率共同决定期望收益。盈亏比 > 1 意味着即使胜率低于50%也可盈利', note: '盈亏比 × 胜率 − (1−胜率) > 0 即为正期望' },
                  ]
                },
                {
                  group: '交易系统符合率',
                  rows: [
                    { name: '符合率', formula: '已打标签的成交笔数 ÷ 总成交笔数', purpose: '衡量你记录交易意图的完整度，代理「交易纪律执行率」', note: '低于 60% 会触发警告。建议入场前或入场后立即补录，而非事后回忆' },
                  ]
                },
                {
                  group: '收益率走势 & 换手率趋势',
                  rows: [
                    { name: '收益率走势', formula: '取该周最后一天在交易总览「收益率走势」中的账户收益率值', purpose: '用总览同一条净值曲线观察每周截止点的账户表现，避免在复盘页重复计算出另一套收益率口径', note: '结合周换手率看高频操作后账户收益率位置是否改善' },
                    { name: '周换手率', formula: '本周买卖成交总额 ÷ 本周平均持仓市值', purpose: '量化操作频率。换手率过高通常意味着手续费侵蚀收益、情绪化交易', note: '≤80% 正常 / 80%–150% 偏频繁 / >150% 高度频繁。趋势向上需警惕' },
                  ]
                },
                {
                  group: '标签维度胜率',
                  rows: [
                    { name: '标签胜率', formula: '该标签下盈利回合 ÷ 该标签下总回合', purpose: '识别哪种交易模式（标签）更适合你', note: '样本量 < 5 笔时数据仅供参考，不宜下结论' },
                    { name: '平均盈亏', formula: '该标签所有回合净盈亏的均值', purpose: '综合评估各模式的期望收益', note: '负值标签需重新审视策略逻辑或入场条件' },
                    { name: '平均持仓天数', formula: '该标签所有回合从买入到卖出的持续天数均值', purpose: '了解不同策略的持仓周期特征，判断是否与预期相符', note: '异常偏短（被迫止损）或偏长（被套）均需关注' },
                  ]
                },
              ] as Array<{ group: string; rows: Array<{ name: string; formula: string; purpose: string; note: string }> }>).map(section => (
                <div key={section.group}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>{section.group}</div>
                  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)' }}>
                    <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '25%' }} />
                        <col style={{ width: '36%' }} />
                        <col style={{ width: '28%' }} />
                      </colgroup>
                      <thead>
                        <tr style={{ background: 'var(--color-bg-sidebar)' }}>
                          {['指标', '计算方式', '目的', '调整建议'].map(h => (
                            <th key={h} className="px-4 py-2 text-xs font-medium text-left"
                              style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-subtle)', whiteSpace: 'nowrap' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((row, i) => (
                          <tr key={row.name} style={{ borderBottom: i < section.rows.length - 1 ? '1px solid var(--color-border-subtle)' : undefined }}>
                            <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)', verticalAlign: 'top', wordBreak: 'keep-all' }}>{row.name}</td>
                            <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)', verticalAlign: 'top', fontSize: 12 }}>{row.formula}</td>
                            <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)', verticalAlign: 'top', fontSize: 12 }}>{row.purpose}</td>
                            <td className="px-4 py-3" style={{ color: row.note ? 'var(--color-text-tertiary)' : 'var(--color-border-default)', verticalAlign: 'top', fontSize: 12 }}>{row.note || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              <p className="text-xs px-4 py-3 rounded-lg" style={{ background: 'rgba(201,100,66,0.06)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-subtle)' }}>
                💡 <strong style={{ color: 'var(--color-text-primary)' }}>动态调整提示：</strong>以上阈值（如换手率 80%/150%、符合率 60%）仅为初始参考值。建议在积累 30+ 笔完整交易后，回看自己胜率最高的阶段对应的换手率区间，将个人最优区间作为你的专属基准。
              </p>
            </div>
          </div>
        </>
      )}

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
        {([['stats', '复盘统计'], ['list', '历史交易列表']] as const).map(([key, label]) => (
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

          {intentsLoading ? (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-tertiary)' }}>加载中...</p>
          ) : intents.length === 0 ? (
            <div className="flex flex-col items-center py-24 gap-3">
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                还没有交易记录。在流水页点击任意成交记录开始添加。
              </p>
              <button className="text-sm underline" style={{ color: 'var(--color-primary)' }} onClick={() => navigate('/')}>
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
                  onClick={() => intent.stock_code && navigate(`/intents/stock/${intent.stock_code}`)}
                >
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                        {intent.stock_name || intent.stock_code}
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
                      <PnlNumber value={n(intent.pnl_realized)} formatter={formatAmount} className="text-sm font-semibold" />
                    ) : intent.pnl_float != null ? (
                      <PnlNumber value={n(intent.pnl_float)} formatter={formatAmount} className="text-sm font-semibold" />
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
          {/* Row 1: 整体胜率与盈亏比（左）+ 交易系统符合率（右） */}
          <div className="grid grid-cols-2 gap-5 items-stretch">
            {/* Module A: Win rate */}
            <div className="rounded-lg p-5 flex flex-col" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
              <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>整体胜率与盈亏比</h3>
              <div className="grid grid-cols-3 gap-4 text-sm flex-1">
                <div className="flex flex-col gap-1 justify-center">
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>总胜率</span>
                  <span className="text-2xl font-semibold tabular-nums" style={{ color: (winRate?.win_rate ?? 0) >= 0.5 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                    {((winRate?.win_rate ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex flex-col gap-1 justify-center">
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>平均盈利</span>
                  <span className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--color-profit)' }}>
                    {winRate ? formatAmount(n(winRate.avg_win)) : '—'}
                  </span>
                </div>
                <div className="flex flex-col gap-1 justify-center">
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>平均亏损</span>
                  <span className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--color-loss)' }}>
                    {winRate ? formatAmount(n(winRate.avg_loss)) : '—'}
                  </span>
                </div>
              </div>
              {winRate && winRate.total < 5 && (
                <p className="text-xs mt-3 px-3 py-2 rounded" style={{ background: 'rgba(217,119,6,0.06)', color: 'var(--color-warning)' }}>
                  样本量不足 5 笔，数据仅供参考
                </p>
              )}
            </div>

            {/* Module C: Discipline */}
            <div className="rounded-lg p-5 flex flex-col" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
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
              <div className="flex-1 flex items-center gap-6">
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
          </div>

          {/* Module D: 收益率走势 & 周换手率趋势 */}
          <div className="rounded-lg p-5" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1">
                {([['1m', '近1月'], ['ytd', '年初至今'], ['all', '全部']] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setTurnoverRange(key)}
                    className="px-3 py-1 rounded text-xs transition-colors duration-[120ms]"
                    style={{
                      background: turnoverRange === key ? 'var(--color-bg-surface-selected)' : 'transparent',
                      color: turnoverRange === key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                      border: '1px solid var(--color-border-default)',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {turnoverRange === 'custom' && (
                  <div className="flex items-center gap-1">
                    <input type="date" value={turnoverCustom.start} max={turnoverCustom.end || undefined}
                      onChange={e => setTurnoverCustom(c => ({ ...c, start: e.target.value }))}
                      className="h-7 px-2 rounded text-xs outline-none"
                      style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>~</span>
                    <input type="date" value={turnoverCustom.end} min={turnoverCustom.start || undefined}
                      onChange={e => setTurnoverCustom(c => ({ ...c, end: e.target.value }))}
                      className="h-7 px-2 rounded text-xs outline-none"
                      style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)' }} />
                  </div>
                )}
                <button
                  onClick={() => setTurnoverRange('custom')}
                  className="flex items-center gap-1 px-3 py-1 rounded text-xs transition-colors duration-[120ms]"
                  style={{
                    background: turnoverRange === 'custom' ? 'var(--color-primary-subtle)' : 'transparent',
                    color: turnoverRange === 'custom' ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                    border: `1px solid ${turnoverRange === 'custom' ? 'var(--color-primary)' : 'var(--color-border-default)'}`,
                  }}
                >
                  <SlidersHorizontal size={12} /> 筛选
                </button>
              </div>
            </div>
            {filteredTurnoverData.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-tertiary)' }}>暂无数据</p>
            ) : (
              <div className="flex flex-col gap-2">
                <h3 className="text-base font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>收益率走势</h3>
                <EChart option={returnChartOption} style={{ height: 200 }} notMerge />
                <h3 className="text-base font-semibold mt-6 mb-3" style={{ color: 'var(--color-text-primary)' }}>周换手率</h3>
                <EChart option={turnoverChartOption} style={{ height: 230 }} notMerge />
              </div>
            )}
          </div>

          {/* Module B: Tag win rates（移至底部） */}
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
                {tagPerf.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>暂无数据</td></tr>
                ) : tagPerf.map(t => (
                  <tr key={t.tag} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg-surface)')}>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-xs text-xs" style={{ background: 'var(--color-bg-tag)', color: 'var(--color-text-secondary)' }}>{t.tag}</span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{t.count}</td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: t.win_rate > 0.5 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                      {(t.win_rate * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-2.5"><PnlNumber value={n(t.avg_pnl)} formatter={formatAmount} /></td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{t.avg_hold_days.toFixed(1)}天</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
