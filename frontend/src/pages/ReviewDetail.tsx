import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronRight, Bot, AlertCircle, RefreshCw } from 'lucide-react'
import PnlNumber from '@/components/shared/PnlNumber'
import { formatAmount, formatPct, formatTradeDate } from '@/lib/format'
import { mockTrades, mockHoldings } from '@/lib/mock'

const MOCK_REPORT = `## 复盘总结

本次交易在突破前高时买入，选点较准，顺应了市场强势。

### 优势分析

- 进场节点选择合理，突破放量成功率高
- 仓位控制在合理范围内，风险敞口可控

### 改进点

1. **止损设置** 本次交易未设置明确止损位，建议在买入时同步设置
2. **目标价** 思路中提到"持有至目标价"，但未量化具体位置

### 结论

> 总体而言这是一笔符合交易系统的操作，继续执行即可。注意下次补充量化止损位。`

export default function ReviewDetail() {
  const { tradeId, stockCode } = useParams()
  const navigate = useNavigate()
  const [generating, setGenerating] = useState(false)
  const [reportText, setReportText] = useState('')
  const [hasReport, setHasReport] = useState(false)
  const [streamDone, setStreamDone] = useState(false)
  const [ollamaError, setOllamaError] = useState(false)

  const trade = tradeId ? mockTrades.find(t => t.id === Number(tradeId)) : null
  const holding = stockCode ? mockHoldings.find(h => h.stock_code === stockCode) : null

  const title = trade
    ? `${trade.stock_name} ${trade.stock_code} — 单笔成交复盘`
    : holding
    ? `${holding.stock_name} ${holding.stock_code} — 持仓全程复盘`
    : '时间段复盘'

  function triggerReview() {
    setGenerating(true)
    setReportText('')
    setHasReport(true)
    setStreamDone(false)
    setOllamaError(false)

    // Simulate streaming
    let i = 0
    const interval = setInterval(() => {
      i += 3
      if (i >= MOCK_REPORT.length) {
        setReportText(MOCK_REPORT)
        setGenerating(false)
        setStreamDone(true)
        clearInterval(interval)
      } else {
        setReportText(MOCK_REPORT.slice(0, i))
      }
    }, 30)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
        <Link to="/reviews" style={{ color: 'var(--color-text-secondary)' }} className="hover:underline">复盘报告</Link>
        <ChevronRight size={14} />
        <span style={{ color: 'var(--color-text-primary)' }}>{title}</span>
      </nav>

      <h1
        className="font-serif font-medium"
        style={{ color: 'var(--color-text-primary)', fontSize: 'var(--font-size-page-title)', lineHeight: 1.25 }}
      >
        {title}
      </h1>

      {/* Section 1: Trade summary */}
      {trade && (
        <div className="rounded-lg p-5" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>交易摘要</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {[
              { label: '成交日期', value: formatTradeDate(trade.trade_date) },
              { label: '买卖方向', value: trade.side === 'buy' ? '买入' : '卖出' },
              { label: '成交价', value: `¥${trade.price.toFixed(3)}` },
              { label: '数量', value: `${trade.quantity.toLocaleString()}股` },
              { label: '成交金额', value: formatAmount(trade.amount) },
              { label: '手续费', value: '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>
                <p className="font-medium tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 2: PnL */}
      <div className="rounded-lg p-5" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>盈亏信息</h2>
        {trade || holding ? (
          <div className="flex gap-8 text-sm">
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-tertiary)' }}>当前浮动盈亏</p>
              <PnlNumber
                value={holding?.float_pnl ?? (trade ? 16450 : null)}
                formatter={formatAmount}
                className="text-xl font-semibold"
              />
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-tertiary)' }}>浮动盈亏率</p>
              <PnlNumber
                value={holding?.float_pnl_rate ?? (trade ? 0.108 : null)}
                formatter={formatPct}
                className="text-xl font-semibold"
              />
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>无关联盈亏数据</p>
        )}
      </div>

      {/* Section 3: Intent */}
      {trade && (
        <div className="rounded-lg p-5" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>交易意图</h2>
          {trade.intent_tags && trade.intent_tags.length > 0 ? (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex flex-wrap gap-2">
                {trade.intent_tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded-xs text-xs" style={{ background: 'var(--color-bg-tag)', color: 'var(--color-text-secondary)' }}>
                    {tag}
                  </span>
                ))}
              </div>
              {trade.intent_confidence != null && (
                <p style={{ color: 'var(--color-text-secondary)' }}>信心度：{'★'.repeat(trade.intent_confidence)}{'☆'.repeat(5 - trade.intent_confidence)}</p>
              )}
              {trade.intent_thesis && (
                <p style={{ color: 'var(--color-text-primary)' }}>{trade.intent_thesis}</p>
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>未录入交易意图</p>
          )}
        </div>
      )}

      {/* Section 4: AI Review */}
      <div className="rounded-lg p-5" style={{ background: 'var(--color-bg-app)', border: '1px solid var(--color-border-subtle)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>AI 复盘报告</h2>
          {hasReport && streamDone && (
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>已保存 · 2026-05-29 15:30</span>
              <button
                className="flex items-center gap-1.5 px-3 h-8 rounded text-xs transition-colors duration-[120ms]"
                style={{ background: 'var(--color-bg-surface-selected)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
                onClick={triggerReview}
              >
                <RefreshCw size={12} /> 重新复盘
              </button>
            </div>
          )}
        </div>

        {ollamaError && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg mb-4"
            style={{ background: 'rgba(181,51,51,0.06)', borderLeft: '4px solid var(--color-danger)' }}>
            <AlertCircle size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--color-danger)' }} />
            <div className="text-sm">
              <p style={{ color: 'var(--color-text-primary)' }}>Ollama 连接失败，请检查设置页的 Ollama 地址配置</p>
              <button className="mt-1 underline text-xs" style={{ color: 'var(--color-primary)' }} onClick={() => navigate('/settings')}>
                去设置
              </button>
            </div>
          </div>
        )}

        {!hasReport ? (
          <div className="flex flex-col items-center py-12 gap-4">
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>还没有复盘报告</p>
            <button
              className="flex items-center gap-2 px-5 h-10 rounded-md text-sm font-medium transition-colors duration-[120ms]"
              style={{ background: 'var(--color-primary)', color: 'var(--color-text-on-brand)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-primary-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-primary)')}
              onClick={triggerReview}
            >
              <Bot size={16} strokeWidth={1.5} />
              触发 AI 复盘
            </button>
          </div>
        ) : (
          <div
            className="prose max-w-none"
            style={{
              fontFamily: 'var(--font-family-serif)',
              fontSize: 16,
              lineHeight: 1.75,
              color: 'var(--color-text-primary)',
            }}
          >
            <div
              style={{ whiteSpace: 'pre-wrap' }}
              className={generating && !streamDone ? 'streaming-cursor' : ''}
            >
              {reportText}
            </div>
            {generating && (
              <div className="flex items-center gap-2 mt-4 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)' }} />
                生成中...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
