import { useState, useCallback, useRef } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  Upload,
  History,
  Settings,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { mockImportBatches } from '@/lib/mock'
import { formatDatetime } from '@/lib/format'

type UploadState =
  | { type: 'idle' }
  | { type: 'parsing'; filename: string }
  | { type: 'success'; filename: string; success: number; skipped: number; failed: number }
  | { type: 'duplicate'; filename: string; importedAt: string }
  | { type: 'error'; message: string }

const navItems: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: '交易总览', end: true },
  { to: '/holdings', label: '当日持仓' },
  { to: '/intents', label: '交易意图' },
  { to: '/reviews', label: '复盘报告' },
  { to: '/rules', label: '交易规则' },
]

export default function Topbar() {
  const [uploadState, setUploadState] = useState<UploadState>({ type: 'idle' })
  const [showUploadResult, setShowUploadResult] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const batches = mockImportBatches

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.match(/\.(xls|csv)$/i)) {
      setUploadState({ type: 'error', message: '仅支持 .xls 或 .csv 文件' })
      setShowUploadResult(true)
      e.target.value = ''
      return
    }
    setUploadState({ type: 'parsing', filename: file.name })
    setShowUploadResult(true)
    setTimeout(() => {
      setUploadState({ type: 'success', filename: file.name, success: 248, skipped: 12, failed: 2 })
    }, 1500)
    e.target.value = ''
  }, [])

  const closeUploadResult = () => {
    setShowUploadResult(false)
    setUploadState({ type: 'idle' })
  }

  const actionClass =
    'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[15px] font-medium whitespace-nowrap transition-colors duration-[120ms]'

  return (
    <header
      className="fixed top-0 left-0 right-0"
      style={{
        height: 'var(--topbar-height)',
        background: 'var(--color-bg-app)',
        borderBottom: '1px solid var(--color-border-subtle)',
        zIndex: 'var(--z-sticky)',
      }}
    >
      <div
        className="mx-auto flex h-[68px] items-center gap-5"
        style={{
          maxWidth: 'var(--topbar-primary-max-width)',
          paddingLeft: 'var(--content-padding-x)',
          paddingRight: 'var(--content-padding-x)',
        }}
      >
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img
            src="/tradingbull.svg"
            alt="TradingReview logo"
            style={{ height: 'calc(var(--font-size-brand-wordmark) * 1.5)', width: 'auto' }}
          />
          <span
            style={{
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-family-serif)',
              fontSize: 'var(--font-size-brand-wordmark)',
              fontWeight: 500,
              letterSpacing: 0,
              lineHeight: 1,
            }}
          >
            Trading Review
          </span>
        </Link>

        <div className="flex-1" />

        {/* Upload button */}
        <button
          onClick={handleUploadClick}
          className={actionClass}
          style={{ color: 'var(--color-text-secondary)', background: 'var(--color-bg-surface)' }}
        >
          <Upload size={16} strokeWidth={1.8} />
          上传文件
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xls,.csv"
          className="hidden"
          onChange={handleFileInput}
        />

        {/* Import history button */}
        <button
          onClick={() => setShowHistory(true)}
          className={actionClass}
          style={{ color: 'var(--color-text-secondary)', background: 'var(--color-bg-surface)' }}
        >
          <History size={16} strokeWidth={1.8} />
          导入历史
        </button>

        {/* Settings */}
        <NavLink
          to="/settings"
          className={actionClass}
          style={{ color: '#faf9f5', background: '#141413' }}
        >
          <Settings size={16} strokeWidth={1.8} />
          设置
        </NavLink>
      </div>

      <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
        <nav
          className="mx-auto flex h-[47px] items-center"
          style={{
            maxWidth: 'var(--topbar-secondary-max-width)',
            paddingLeft: 'var(--content-padding-x)',
            paddingRight: 'var(--content-padding-x)',
          }}
        >
          {navItems.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className="relative flex h-full items-center px-4 text-sm whitespace-nowrap transition-colors duration-[120ms]"
              style={({ isActive }) => ({
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: isActive ? 600 : 400,
              })}
            >
              {({ isActive }) => (
                <>
                  <span>{label}</span>
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0"
                      style={{ height: 2, background: 'var(--color-primary)' }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Upload result dialog */}
      <Dialog open={showUploadResult} onOpenChange={(open) => { if (!open) closeUploadResult() }}>
        <DialogContent
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 12,
            maxWidth: 480,
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-serif)' }}>
              文件导入
            </DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            {uploadState.type === 'parsing' && (
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                  style={{ borderColor: 'var(--color-primary)' }}
                />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  正在解析 {uploadState.filename}...
                </span>
              </div>
            )}
            {uploadState.type === 'success' && (
              <div className="flex items-start gap-3">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-success)' }} />
                <div className="text-sm">
                  <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>导入完成</p>
                  <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                    成功入库：{uploadState.success} 行 &nbsp;·&nbsp; 跳过重复：{uploadState.skipped} 行 &nbsp;·&nbsp; 失败：{uploadState.failed} 行
                  </p>
                </div>
              </div>
            )}
            {uploadState.type === 'duplicate' && (
              <div className="flex items-center gap-3">
                <AlertCircle size={16} className="shrink-0" style={{ color: 'var(--color-warning)' }} />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  该文件已于 {uploadState.importedAt} 导入过，已阻止重复入库
                </span>
              </div>
            )}
            {uploadState.type === 'error' && (
              <div className="flex items-center gap-3">
                <XCircle size={16} className="shrink-0" style={{ color: 'var(--color-danger)' }} />
                <span className="text-sm" style={{ color: 'var(--color-danger)' }}>{uploadState.message}</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Import history dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 12,
            maxWidth: 860,
            width: '90vw',
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-serif)' }}>
              导入历史
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {batches.length === 0 ? (
              <p className="py-6 text-sm text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                暂无导入记录
              </p>
            ) : (
              <div
                className="rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--color-border-subtle)' }}
              >
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col style={{ width: '40%' }} />
                    <col style={{ width: '28%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '20%' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-sidebar)' }}>
                      {['文件名', '覆盖日期', '入库行数', '导入时间'].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-xs font-medium"
                          style={{
                            color: 'var(--color-text-secondary)',
                            borderBottom: '1px solid var(--color-border-subtle)',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b) => (
                      <tr
                        key={b.id}
                        style={{
                          background: 'var(--color-bg-surface)',
                          borderBottom: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <td className="px-4 py-3 font-mono text-xs truncate" style={{ color: 'var(--color-text-primary)' }}>
                          {b.filename}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {b.period_start} ~ {b.period_end}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-sm" style={{ color: 'var(--color-text-primary)' }}>
                          {b.row_count}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                          {formatDatetime(b.imported_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  )
}
