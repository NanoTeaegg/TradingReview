import { useState, useCallback } from 'react'
import ReactECharts from 'echarts-for-react'
import { Upload, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, XCircle, X } from 'lucide-react'
import PnlNumber from '@/components/shared/PnlNumber'
import { formatAmount, formatPct, formatDatetime } from '@/lib/format'
import {
  mockPnlSummary,
  mockNetValueSeries,
  mockMarketSentiment,
  mockImportBatches,
} from '@/lib/mock'

/** Perf summary card */
function PerfCard({
  label,
  value,
  sub,
  isPnl = false,
}: {
  label: string
  value: number | null
  sub?: string
  isPnl?: boolean
}) {
  return (
    <div
      className="rounded-lg p-5 flex flex-col gap-2"
      style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
      }}
    >
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
        {label}
      </span>
      {value == null ? (
        <span className="text-3xl font-semibold tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
          —
        </span>
      ) : isPnl ? (
        <PnlNumber value={value} formatter={formatAmount} className="text-3xl font-semibold" />
      ) : (
        <span className="text-3xl font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
          {formatPct(value)}
        </span>
      )}
      {sub && <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{sub}</span>}
    </div>
  )
}

/** Market sentiment badge */
function SentimentBadge({ sentiment }: { sentiment: 'bullish' | 'neutral' | 'bearish' }) {
  const map = {
    bullish: { label: '偏多 🟢', color: 'var(--color-profit)', bg: 'var(--color-profit-bg)' },
    neutral: { label: '中性 ⚪', color: 'var(--color-text-tertiary)', bg: 'var(--color-border-subtle)' },
    bearish: { label: '偏空 🔴', color: 'var(--color-loss)', bg: 'var(--color-loss-bg)' },
  }
  const { label, color, bg } = map[sentiment]
  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ color, background: bg }}>
      {label}
    </span>
  )
}

type UploadState =
  | { type: 'idle' }
  | { type: 'dragging' }
  | { type: 'parsing'; filename: string }
  | { type: 'success'; filename: string; success: number; skipped: number; failed: number }
  | { type: 'duplicate'; filename: string; importedAt: string }
  | { type: 'error'; message: string }

export default function Dashboard() {
  const summary = mockPnlSummary
  const { dates, portfolio, index } = mockNetValueSeries
  const sentiment = mockMarketSentiment
  const batches = mockImportBatches

  const [uploadState, setUploadState] = useState<UploadState>({ type: 'idle' })
  const [showHistory, setShowHistory] = useState(false)
  const [indexType, setIndexType] = useState<'hs300' | 'sh'>('hs300')

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setUploadState({ type: 'dragging' })
  }, [])

  const handleDragLeave = useCallback(() => {
    setUploadState({ type: 'idle' })
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (!file.name.match(/\.(xls|csv)$/i)) {
      setUploadState({ type: 'error', message: '仅支持 .xls 或 .csv 文件' })
      setTimeout(() => setUploadState({ type: 'idle' }), 3000)
      return
    }
    simulateParsing(file.name)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    simulateParsing(file.name)
    e.target.value = ''
  }, [])

  function simulateParsing(filename: string) {
    setUploadState({ type: 'parsing', filename })
    setTimeout(() => {
      setUploadState({ type: 'success', filename, success: 248, skipped: 12, failed: 2 })
    }, 1500)
  }

  const chartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#141413',
      borderColor: 'transparent',
      textStyle: { color: '#faf9f5', fontSize: 12 },
      formatter: (params: { seriesName: string; value: number; axisValue: string }[]) =>
        `<div style="padding:4px 0"><b>${params[0].axisValue}</b></div>` +
        params
          .map(
            (p) =>
              `<div style="display:flex;gap:12px;justify-content:space-between"><span>${p.seriesName}</span><b>${p.value.toFixed(4)}</b></div>`
          )
          .join(''),
    },
    legend: {
      data: ['账户净值', indexType === 'hs300' ? '沪深300' : '上证综指'],
      right: 0,
      top: 0,
      textStyle: { color: '#87867f', fontSize: 12 },
    },
    grid: { left: 0, right: 0, top: 32, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category',
      data: dates,
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
        name: '账户净值',
        type: 'line',
        data: portfolio,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#c96442', width: 2 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(201,100,66,0.12)' }, { offset: 1, color: 'rgba(201,100,66,0)' }] } },
      },
      {
        name: indexType === 'hs300' ? '沪深300' : '上证综指',
        type: 'line',
        data: index,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#5e5d59', width: 1.5, type: 'dashed' },
      },
    ],
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-2xl font-medium" style={{ color: 'var(--color-text-primary)' }}>
        持仓总览
      </h1>

      {/* Perf summary cards */}
      <div className="grid grid-cols-4 gap-5">
        <PerfCard label="总收益率" value={summary.total_return_rate} />
        <PerfCard label="最大回撤" value={summary.max_drawdown} />
        <PerfCard label="累计已实现盈亏" value={summary.total_realized} isPnl />
        <PerfCard label="当前浮动盈亏" value={summary.total_float} isPnl />
      </div>

      {/* Chart + Sentiment */}
      <div className="grid grid-cols-12 gap-5">
        {/* Net value chart */}
        <div
          className="col-span-8 rounded-lg p-5"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              账户净值 vs 基准
            </span>
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
            <ReactECharts option={chartOption} style={{ height: 260 }} />
          )}
        </div>

        {/* Market sentiment */}
        <div
          className="col-span-4 rounded-lg p-5 flex flex-col gap-4"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              大盘情绪
            </span>
            <SentimentBadge sentiment={sentiment.sentiment} />
          </div>
          {!sentiment.is_trading_day ? (
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              今日休市
            </p>
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              {[
                { label: '上涨', value: sentiment.up_count, color: 'var(--color-profit)' },
                { label: '下跌', value: sentiment.down_count, color: 'var(--color-loss)' },
                { label: '平盘', value: sentiment.flat_count, color: 'var(--color-text-tertiary)' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center">
                  <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                  <span className="font-semibold tabular-nums" style={{ color }}>{value.toLocaleString()}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 8, marginTop: 4 }} className="flex flex-col gap-2">
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--color-text-secondary)' }}>涨停</span>
                  <span className="tabular-nums font-medium" style={{ color: 'var(--color-profit)' }}>{sentiment.limit_up}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--color-text-secondary)' }}>跌停</span>
                  <span className="tabular-nums font-medium" style={{ color: 'var(--color-loss)' }}>{sentiment.limit_down}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--color-text-secondary)' }}>成交额</span>
                  <span className="tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{sentiment.total_volume_billion.toLocaleString()}亿</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload area */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)' }}
      >
        <div
          className="relative p-4"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: uploadState.type === 'dragging' ? '2px dashed var(--color-focus-ring)' : '2px dashed transparent',
            borderRadius: 8,
            background: uploadState.type === 'dragging' ? 'rgba(56,152,236,0.04)' : undefined,
            transition: 'all var(--motion-fast)',
          }}
        >
          {uploadState.type === 'idle' || uploadState.type === 'dragging' ? (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <Upload size={16} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                拖拽 .xls 文件到此处，或{' '}
                <span style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>点击选择文件</span>
              </span>
              <input type="file" accept=".xls,.csv" className="hidden" onChange={handleFileInput} />
            </label>
          ) : uploadState.type === 'parsing' ? (
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)' }} />
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                正在解析 {uploadState.filename}...
              </span>
            </div>
          ) : uploadState.type === 'success' ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-success)' }} />
              <div className="flex-1 text-sm">
                <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>导入完成</p>
                <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  成功入库：{uploadState.success} 行 &nbsp;·&nbsp; 跳过重复：{uploadState.skipped} 行 &nbsp;·&nbsp; 失败：{uploadState.failed} 行
                </p>
              </div>
              <button onClick={() => setUploadState({ type: 'idle' })}>
                <X size={14} style={{ color: 'var(--color-text-tertiary)' }} />
              </button>
            </div>
          ) : uploadState.type === 'duplicate' ? (
            <div className="flex items-center gap-3">
              <AlertCircle size={16} style={{ color: 'var(--color-warning)' }} />
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                该文件已于 {uploadState.importedAt} 导入过，已阻止重复入库
              </span>
            </div>
          ) : uploadState.type === 'error' ? (
            <div className="flex items-center gap-3">
              <XCircle size={16} style={{ color: 'var(--color-danger)' }} />
              <span className="text-sm" style={{ color: 'var(--color-danger)' }}>{uploadState.message}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Import history */}
      <div>
        <button
          className="flex items-center gap-2 text-sm mb-3"
          style={{ color: 'var(--color-text-secondary)' }}
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          导入历史
        </button>
        {showHistory && (
          <div
            className="rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--color-border-subtle)' }}
          >
            {batches.length === 0 ? (
              <p className="p-4 text-sm text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                暂无导入记录
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--color-bg-sidebar)' }}>
                    {['文件名', '覆盖日期', '入库行数', '导入时间'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} style={{ background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--color-text-primary)' }}>{b.filename}</td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--color-text-secondary)' }}>{b.period_start} ~ {b.period_end}</td>
                      <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{b.row_count}</td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--color-text-tertiary)' }}>{formatDatetime(b.imported_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
