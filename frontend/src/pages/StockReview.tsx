import { useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Bot, AlertCircle, RefreshCw } from 'lucide-react'
import { formatAmount, formatTradeDate } from '@/lib/format'
import { useTrades, useIntents, useReviews, useReviewDetail, n } from '@/lib/queries'
import { getStoredAccountId } from '@/lib/account.tsx'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'

export default function StockReview() {
  const { stockCode } = useParams<{ stockCode: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [generating, setGenerating] = useState(false)
  const [liveText, setLiveText] = useState('')
  const [hasLive, setHasLive] = useState(false)
  const [streamDone, setStreamDone] = useState(false)
  const [ollamaError, setOllamaError] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const { data: trades = [], isLoading } = useTrades({ stock: stockCode })
  const { data: intents = [] } = useIntents(stockCode)
  const { data: reviews = [] } = useReviews()

  const stockName = trades[0]?.stock_name || intents[0]?.stock_name || stockCode || ''
  const stockIntent = intents.find(i => i.stock_code === stockCode)
  const title = `${stockName} 复盘`

  const latestReview = reviews.find(r => r.stock_code === stockCode && r.scope === 'stock') ?? null
  const { data: savedReport } = useReviewDetail(latestReview?.id ?? null)

  const hasReport = hasLive || !!savedReport
  const reportContent = hasLive ? liveText : (savedReport?.content ?? '')
  const showSaved = !!savedReport && !generating

  async function triggerReview() {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setGenerating(true)
    setLiveText('')
    setHasLive(true)
    setStreamDone(false)
    setOllamaError(false)

    const accountId = getStoredAccountId()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accountId != null) headers['X-Account-Id'] = String(accountId)

    try {
      const resp = await fetch(`${API_BASE}/api/reviews`, {
        method: 'POST',
        headers,
        signal: ctrl.signal,
        body: JSON.stringify({ scope: 'stock', stock_code: stockCode }),
      })

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`)
      }

      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (payload === '[DONE]') {
            setStreamDone(true)
            setGenerating(false)
            qc.invalidateQueries({ queryKey: ['reviews'] })
            return
          }
          try {
            const data = JSON.parse(payload) as { token?: string; error?: string }
            if (data.error) {
              setOllamaError(true)
              setGenerating(false)
              return
            }
            if (data.token) {
              setLiveText(prev => prev + data.token)
            }
          } catch { /* ignore malformed chunk */ }
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return
      setOllamaError(true)
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
        <Link to="/intents" style={{ color: 'var(--color-text-secondary)' }} className="hover:underline">
          交易复盘
        </Link>
        <ChevronRight size={14} />
        <span style={{ color: 'var(--color-text-primary)' }}>{title}</span>
      </nav>

      <h1
        className="font-serif font-medium"
        style={{ color: 'var(--color-text-primary)', fontSize: 'var(--font-size-page-title)', lineHeight: 1.25 }}
      >
        {title}
      </h1>

      {/* Buy/sell nodes */}
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)' }}>
        <div
          className="px-4 py-3"
          style={{ borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-sidebar)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            买卖节点
          </h2>
        </div>
        {isLoading ? (
          <div className="px-4 py-8 text-sm text-center" style={{ color: 'var(--color-text-tertiary)' }}>
            加载中...
          </div>
        ) : trades.length === 0 ? (
          <div className="px-4 py-8 text-sm text-center" style={{ color: 'var(--color-text-tertiary)' }}>
            暂无成交记录
          </div>
        ) : (
          trades.map((trade, i) => (
            <div
              key={trade.id}
              className="px-4 py-3 flex items-center gap-4"
              style={{
                background: 'var(--color-bg-surface)',
                borderBottom: i < trades.length - 1 ? '1px solid var(--color-border-subtle)' : undefined,
              }}
            >
              <div className="w-14 shrink-0">
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium"
                  style={{
                    background: trade.side === 'buy' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    color: trade.side === 'buy' ? 'var(--color-profit)' : 'var(--color-loss)',
                  }}
                >
                  {trade.side === 'buy' ? '买入' : '卖出'}
                </span>
              </div>
              <div className="flex-1 flex items-center gap-6 text-sm flex-wrap">
                <span className="tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
                  {formatTradeDate(trade.trade_date)}
                </span>
                <span className="tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                  ¥{Number(trade.price).toFixed(3)}
                </span>
                <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                  {trade.quantity.toLocaleString()} 股
                </span>
                <span className="tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                  {formatAmount(n(trade.amount))}
                </span>
              </div>
              {trade.intent_tags && trade.intent_tags.length > 0 && (
                <div className="flex gap-1 shrink-0">
                  {trade.intent_tags.slice(0, 2).map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-xs text-xs"
                      style={{ background: 'var(--color-bg-tag)', color: 'var(--color-text-secondary)' }}
                    >
                      {tag}
                    </span>
                  ))}
                  {trade.intent_tags.length > 2 && (
                    <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      +{trade.intent_tags.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Intent info */}
      {stockIntent && (stockIntent.tags.length > 0 || stockIntent.thesis) && (
        <div
          className="rounded-lg p-5"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}
        >
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            交易意图
          </h2>
          <div className="flex flex-col gap-3 text-sm">
            {stockIntent.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {stockIntent.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-xs text-xs"
                    style={{ background: 'var(--color-bg-tag)', color: 'var(--color-text-secondary)' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {stockIntent.confidence != null && (
              <p style={{ color: 'var(--color-text-secondary)' }}>
                信心度：{'★'.repeat(stockIntent.confidence)}{'☆'.repeat(5 - stockIntent.confidence)}
              </p>
            )}
            {stockIntent.thesis && (
              <p style={{ color: 'var(--color-text-primary)' }}>{stockIntent.thesis}</p>
            )}
          </div>
        </div>
      )}

      {/* AI Review */}
      <div
        className="rounded-lg p-5"
        style={{ background: 'var(--color-bg-app)', border: '1px solid var(--color-border-subtle)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            AI 复盘报告
          </h2>
          {hasReport && (
            <div className="flex items-center gap-3">
              {showSaved && (
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  已保存
                </span>
              )}
              {streamDone && !savedReport && (
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  已保存
                </span>
              )}
              {!generating && (
                <button
                  className="flex items-center gap-1.5 px-3 h-8 rounded text-xs transition-colors duration-[120ms]"
                  style={{
                    background: 'var(--color-bg-surface-selected)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-default)',
                  }}
                  onClick={triggerReview}
                >
                  <RefreshCw size={12} /> 重新复盘
                </button>
              )}
            </div>
          )}
        </div>

        {ollamaError && (
          <div
            className="flex items-start gap-3 px-4 py-3 rounded-lg mb-4"
            style={{ background: 'rgba(181,51,51,0.06)', borderLeft: '4px solid var(--color-danger)' }}
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--color-danger)' }} />
            <div className="text-sm">
              <p style={{ color: 'var(--color-text-primary)' }}>
                LLM 连接失败，请检查设置页的模型配置
              </p>
              <button
                className="mt-1 underline text-xs"
                style={{ color: 'var(--color-primary)' }}
                onClick={() => navigate('/settings')}
              >
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
              {reportContent}
            </div>
            {generating && (
              <div className="flex items-center gap-2 mt-4 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                <div
                  className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: 'var(--color-primary)' }}
                />
                生成中...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
