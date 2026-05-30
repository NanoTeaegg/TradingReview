import { useState, useRef } from 'react'
import { Save, Eye, EyeOff, History } from 'lucide-react'

const PLACEHOLDER = `# 仓位管理

- 单只股票仓位不超过总资金的 30%
- 满仓操作需要特别确认
- 加仓条件：股价在成本价 +5% 以内且趋势向上

# 买入信号

- 突破前高，成交量同步放大（>1.5x 均量）
- 基本面无重大负面变化
- 大盘不处于明显下跌趋势中

# 止损纪律

- 买入后跌幅超过 -8% 无条件止损
- 趋势破坏（跌破关键均线）触发止损
- 止损后同日不再买回

# 持仓管理

- 持仓超过 30 天须重新审视逻辑
- 个股盈利超过 25% 可考虑部分止盈
- 总持仓超过 4 只时严控新增`

function renderMarkdown(text: string): string {
  return text
    .replace(/^# (.+)$/gm, '<h2 style="font-size:18px;font-weight:600;margin:24px 0 8px;color:var(--color-text-primary);font-family:var(--font-family-sans);padding-bottom:8px;border-bottom:1px solid var(--color-border-subtle)">$1</h2>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:16px;font-weight:600;margin:20px 0 6px;color:var(--color-text-primary)">$1</h3>')
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;padding-left:4px;color:var(--color-text-primary)">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/gs, '<ul style="padding-left:20px;margin:8px 0">$&</ul>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br/>')
}

export default function Rules() {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [content, setContent] = useState(PLACEHOLDER)
  const [saved, setSaved] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState('15:23')
  const [showHistory, setShowHistory] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(val: string) {
    setContent(val)
    setSaved(false)
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      silentSave()
    }, 30000)
  }

  function silentSave() {
    setLastSaved(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
    setSaved(true)
  }

  function handleSave() {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      silentSave()
    }, 600)
  }

  // Extract headings for TOC
  const headings = content.match(/^#{1,2} .+/gm)?.map(h => h.replace(/^#+\s/, '')) ?? []

  return (
    <div className="flex flex-col gap-0 h-full">
      <div className="flex items-center justify-between mb-6">
        <h1
          className="font-serif font-medium"
          style={{ color: 'var(--color-text-primary)', fontSize: 'var(--font-size-page-title)', lineHeight: 1.25 }}
        >
          交易规则
        </h1>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 px-3 h-8 rounded text-xs transition-colors duration-[120ms]"
            style={{ background: 'var(--color-bg-surface-selected)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' }}
            onClick={() => setShowHistory(!showHistory)}
          >
            <History size={12} /> 版本历史
          </button>
          <button
            className="flex items-center gap-1.5 px-3 h-8 rounded text-xs transition-colors duration-[120ms]"
            style={{ background: 'var(--color-bg-surface-selected)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' }}
            onClick={() => setMode(m => m === 'edit' ? 'preview' : 'edit')}
          >
            {mode === 'edit' ? <><Eye size={12} /> 预览</> : <><EyeOff size={12} /> 编辑</>}
          </button>
        </div>
      </div>

      <div className="flex gap-5 flex-1 min-h-0">
        {/* TOC sidebar */}
        <div className="w-40 shrink-0 flex flex-col gap-1 sticky top-0">
          {headings.map(h => (
            <button key={h} className="text-left text-xs px-2 py-1 rounded transition-colors duration-[120ms]"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-secondary)')}>
              {h}
            </button>
          ))}
        </div>

        {/* Editor / Preview */}
        <div className="flex-1 flex flex-col gap-0 rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--color-border-subtle)' }}>
          {mode === 'edit' ? (
            <textarea
              className="flex-1 w-full p-6 text-sm outline-none resize-none font-mono"
              style={{
                color: 'var(--color-text-primary)',
                background: 'var(--color-bg-surface)',
                minHeight: '60vh',
                lineHeight: 1.7,
              }}
              value={content}
              onChange={e => handleChange(e.target.value)}
              onFocus={e => (e.currentTarget.style.outline = 'none')}
              placeholder="用 Markdown 编写你的交易规则..."
            />
          ) : (
            <div
              className="flex-1 p-6 overflow-y-auto"
              style={{
                fontFamily: 'var(--font-family-serif)',
                fontSize: 16,
                lineHeight: 1.75,
                color: 'var(--color-text-primary)',
                background: 'var(--color-bg-surface)',
                minHeight: '60vh',
              }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderTop: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-sidebar)' }}>
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {saved ? `最后保存时间：${lastSaved}` : '有未保存的修改'}
            </span>
            <button
              className="flex items-center gap-1.5 px-4 h-8 rounded text-sm font-medium transition-colors duration-[120ms] disabled:opacity-45"
              style={{
                background: saved ? 'var(--color-bg-surface-selected)' : 'var(--color-primary)',
                color: saved ? 'var(--color-text-secondary)' : 'var(--color-text-on-brand)',
              }}
              disabled={saved || saving}
              onClick={handleSave}
              title={saved ? '内容未修改' : undefined}
            >
              {saving ? (
                <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(255,255,255,0.4) white white white' }} />
              ) : (
                <Save size={12} />
              )}
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        {/* Version history panel */}
        {showHistory && (
          <div className="w-52 shrink-0 rounded-lg overflow-hidden flex flex-col"
            style={{ border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)' }}>
            <div className="px-3 py-2.5 text-xs font-semibold"
              style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}>
              版本历史
            </div>
            {[
              { v: 'V2', time: '2026-05-29 15:23' },
              { v: 'V1', time: '2026-05-20 10:01' },
            ].map(({ v, time }) => (
              <div key={v} className="px-3 py-2.5 flex flex-col gap-1 cursor-pointer transition-colors duration-[120ms]"
                style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{v}</span>
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{time}</span>
                <button className="text-xs text-left mt-1 underline" style={{ color: 'var(--color-primary)' }}>
                  恢复此版本
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
