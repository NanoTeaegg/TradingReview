import { useState, useEffect } from 'react'
import { Check, X, Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronUp, Database, RefreshCw } from 'lucide-react'
import {
  useTags, useCreateTag, useUpdateTag, useDeleteTag,
  useOllamaSettings, useSaveOllamaSettings, usePingOllama,
  useCashFlows, useCreateCashFlow, useDeleteCashFlow, n,
  useFullHistoryStatus, useStartFullHistory, useCancelFullHistory, useSyncLatestMarket,
} from '@/lib/queries'
import { formatAmount, formatTradeDate } from '@/lib/format'

type ConnStatus = 'idle' | 'testing' | 'ok' | 'fail'

export default function Settings() {
  const { data: ollamaSettings } = useOllamaSettings()
  const saveOllamaSettings = useSaveOllamaSettings()
  const pingOllama = usePingOllama()

  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [modelName, setModelName] = useState('qwen2.5:14b')
  const [connStatus, setConnStatus] = useState<ConnStatus>('idle')
  const [pingMsg, setPingMsg] = useState('')
  const [settingsDirty, setSettingsDirty] = useState(false)
  const [cashOpen, setCashOpen] = useState(false)
  const [cashAmount, setCashAmount] = useState('')
  const [cashError, setCashError] = useState('')

  useEffect(() => {
    if (ollamaSettings) {
      setOllamaUrl(ollamaSettings.base_url)
      setModelName(ollamaSettings.model)
    }
  }, [ollamaSettings])

  const { data: tags = [] } = useTags()
  const createTag = useCreateTag()
  const updateTag = useUpdateTag()
  const deleteTag = useDeleteTag()
  const { data: cashFlows } = useCashFlows()
  const createCashFlow = useCreateCashFlow()
  const deleteCashFlow = useDeleteCashFlow()

  const { data: historyStatus } = useFullHistoryStatus()
  const startHistory = useStartFullHistory()
  const cancelHistory = useCancelFullHistory()
  const syncLatest = useSyncLatestMarket()
  const [marketMsg, setMarketMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const running = historyStatus?.running ?? false
  const total = historyStatus?.total ?? 0
  const done = historyStatus?.done ?? 0
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0

  function handleStartHistory() {
    setMarketMsg(null)
    startHistory.mutate()
  }
  function handleCancelHistory() {
    cancelHistory.mutate()
  }
  function handleSyncLatest() {
    setMarketMsg(null)
    syncLatest.mutate(undefined, {
      onSuccess: (res) => setMarketMsg({ ok: true, text: `已更新到 ${res.max_date ?? res.end}` }),
      onError: () => setMarketMsg({ ok: false, text: '拉取失败，请稍后重试' }),
    })
  }

  const [newTagName, setNewTagName] = useState('')
  const [editingTagId, setEditingTagId] = useState<number | null>(null)
  const [editingTagValue, setEditingTagValue] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  async function testConnection() {
    setConnStatus('testing')
    setPingMsg('')
    const result = await pingOllama.mutateAsync()
    if (result.ok) {
      setConnStatus('ok')
      setPingMsg(`连接成功，可用模型：${result.models?.join(', ') || '无'}`)
    } else {
      setConnStatus('fail')
      setPingMsg(result.error || '连接失败')
    }
  }

  async function saveOllama() {
    await saveOllamaSettings.mutateAsync({ base_url: ollamaUrl, model: modelName })
    setSettingsDirty(false)
  }

  function handleOllamaChange() {
    setSettingsDirty(true)
    setConnStatus('idle')
    setPingMsg('')
  }

  async function addTag() {
    const name = newTagName.trim()
    if (!name) return
    await createTag.mutateAsync(name)
    setNewTagName('')
  }

  async function saveTagEdit(id: number) {
    await updateTag.mutateAsync({ id, name: editingTagValue })
    setEditingTagId(null)
  }

  async function handleDeleteTag(id: number) {
    await deleteTag.mutateAsync(id)
    setDeleteConfirm(null)
  }

  async function addCashFlow(flowType: 'deposit' | 'withdraw') {
    const amount = cashAmount.trim()
    if (!amount || Number(amount) <= 0) {
      setCashError('请输入大于 0 的金额')
      return
    }
    setCashError('')
    await createCashFlow.mutateAsync({ flow_type: flowType, amount })
    setCashAmount('')
  }

  const connStatusEl = (() => {
    if (connStatus === 'testing') return (
      <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        <Loader2 size={12} className="animate-spin" /> 测试中...
      </span>
    )
    if (connStatus === 'ok') return (
      <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-success)' }}>
        <Check size={12} /> {pingMsg}
      </span>
    )
    if (connStatus === 'fail') return (
      <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-danger)' }}>
        <X size={12} /> {pingMsg || '连接失败'}
      </span>
    )
    return null
  })()

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <h1
        className="font-serif font-medium"
        style={{ color: 'var(--color-text-primary)', fontSize: 'var(--font-size-page-title)', lineHeight: 1.25 }}
      >
        设置
      </h1>

      {/* Cash flows */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>资金记录</h2>
          <button
            className="flex items-center gap-1 h-8 px-3 rounded-md text-xs transition-colors duration-[120ms]"
            style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' }}
            onClick={() => setCashOpen(v => !v)}
          >
            {cashOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {cashOpen ? '收起' : '展开'}
          </button>
        </div>
        <div className="rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)' }}>
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              累计净入金
            </span>
            <span className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
              {formatAmount(n(cashFlows?.net_deposit))}
            </span>
          </div>

          {cashOpen && (
            <div className="px-4 pb-4 flex flex-col gap-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
              <div className="flex items-center gap-3 pt-4">
                <input
                  className="flex-1 h-9 px-3 rounded-md text-sm outline-none"
                  style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                  placeholder="金额"
                  inputMode="decimal"
                  value={cashAmount}
                  onChange={e => { setCashAmount(e.target.value); setCashError('') }}
                  onKeyDown={e => e.key === 'Enter' && addCashFlow('deposit')}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-focus-ring)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
                />
                <button
                  className="h-9 px-4 rounded-md text-sm font-medium transition-colors duration-[120ms] disabled:opacity-45"
                  style={{ background: 'var(--color-primary)', color: 'var(--color-text-on-brand)' }}
                  disabled={createCashFlow.isPending}
                  onClick={() => addCashFlow('deposit')}
                >
                  入金
                </button>
                <button
                  className="h-9 px-4 rounded-md text-sm font-medium transition-colors duration-[120ms] disabled:opacity-45"
                  style={{ background: 'var(--color-bg-surface-selected)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
                  disabled={createCashFlow.isPending}
                  onClick={() => addCashFlow('withdraw')}
                >
                  出金
                </button>
              </div>
              {cashError && (
                <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{cashError}</p>
              )}
              <div className="flex flex-col">
                {(cashFlows?.items ?? []).map(flow => (
                  <div key={flow.id}
                    className="flex items-center gap-3 py-2.5"
                    style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                    <span className="w-24 text-xs tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
                      {formatTradeDate(flow.flow_date)}
                    </span>
                    <span className="w-12 text-sm" style={{ color: flow.flow_type === 'deposit' ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                      {flow.flow_type === 'deposit' ? '入金' : '出金'}
                    </span>
                    <span className="flex-1 text-sm tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                      {formatAmount(n(flow.amount))}
                    </span>
                    <button
                      className="p-1 rounded transition-colors duration-[120ms] disabled:opacity-45"
                      style={{ color: 'var(--color-text-tertiary)' }}
                      disabled={deleteCashFlow.isPending}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
                      onClick={() => deleteCashFlow.mutate(flow.id)}
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
                {(cashFlows?.items ?? []).length === 0 && (
                  <p className="py-4 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                    暂无出入金记录
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Market data */}
      <section>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>行情数据</h2>
        <div className="rounded-lg p-5 flex flex-col gap-5"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>

          {/* 当前状态 */}
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-6 text-xs">
            <span style={{ color: 'var(--color-text-tertiary)' }}>本地日线区间</span>
            <span className="tabular-nums text-right" style={{ color: 'var(--color-text-primary)' }}>
              {historyStatus?.min_date ? `${historyStatus.min_date} ~ ${historyStatus.max_date}` : '—'}
            </span>
            <span style={{ color: 'var(--color-text-tertiary)' }}>股票数量 / 已完成</span>
            <span className="tabular-nums text-right" style={{ color: 'var(--color-text-primary)' }}>
              {total > 0 ? `${done.toLocaleString()} / ${total.toLocaleString()}` : '—'}
              {(historyStatus?.failed ?? 0) > 0 ? `（失败 ${historyStatus?.failed}）` : ''}
            </span>
            <span style={{ color: 'var(--color-text-tertiary)' }}>日线记录</span>
            <span className="tabular-nums text-right" style={{ color: 'var(--color-text-primary)' }}>
              {(historyStatus?.bar_count ?? 0).toLocaleString()}
            </span>
          </div>

          {/* 进度条 */}
          {running && (
            <div className="flex flex-col gap-1.5">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-surface-selected)' }}>
                <div className="h-full transition-[width] duration-300" style={{ width: `${progressPct}%`, background: 'var(--color-primary)' }} />
              </div>
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                同步中 {progressPct}%{historyStatus?.current_code ? ` · ${historyStatus.current_code}` : ''}
                {historyStatus?.message ? ` · ${historyStatus.message}` : ''}
              </span>
            </div>
          )}

          {/* 初始化 / 修复全量历史 */}
          <div className="flex items-start justify-between gap-4 pt-1" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
            <div className="flex flex-col gap-1 pt-3">
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>初始化 / 修复全量历史</span>
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                按股票代码逐只补齐 23 年历史日线，后台运行可断点续传；首次使用或发现缺口时执行。
                {historyStatus?.status === 'interrupted' ? '（上次中断，可点击继续）' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 pt-3">
              {running ? (
                <button
                  className="inline-flex items-center gap-2 px-4 h-9 rounded-md text-sm font-medium transition-colors duration-[120ms] disabled:opacity-45 whitespace-nowrap"
                  style={{ background: 'var(--color-bg-surface-selected)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
                  disabled={cancelHistory.isPending}
                  onClick={handleCancelHistory}
                >
                  <X size={14} /> 取消
                </button>
              ) : (
                <button
                  className="inline-flex items-center gap-2 px-4 h-9 rounded-md text-sm font-medium transition-colors duration-[120ms] disabled:opacity-45 whitespace-nowrap"
                  style={{ background: 'var(--color-primary)', color: 'var(--color-text-on-brand)' }}
                  disabled={startHistory.isPending}
                  onClick={handleStartHistory}
                >
                  <Database size={14} />
                  {historyStatus?.has_data ? '修复全量历史' : '初始化全量历史'}
                </button>
              )}
            </div>
          </div>

          {/* 拉取最新行情 */}
          <div className="flex items-start justify-between gap-4 pt-1" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
            <div className="flex flex-col gap-1 pt-3">
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>拉取最新行情</span>
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                按最新交易日拉取全市场日线（DB 最新日期 → 今天），适合每天收盘后更新。
              </span>
            </div>
            <button
              className="inline-flex items-center gap-2 px-4 h-9 rounded-md text-sm font-medium transition-colors duration-[120ms] disabled:opacity-45 whitespace-nowrap mt-3"
              style={{ background: 'var(--color-bg-surface-selected)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
              disabled={syncLatest.isPending || running}
              onClick={handleSyncLatest}
            >
              <RefreshCw size={14} className={syncLatest.isPending ? 'animate-spin' : undefined} />
              {syncLatest.isPending ? '拉取中…' : '拉取最新行情'}
            </button>
          </div>

          {marketMsg && (
            <p className="text-xs" style={{ color: marketMsg.ok ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {marketMsg.text}
            </p>
          )}
        </div>
      </section>

      {/* Ollama config */}
      <section>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Ollama 配置</h2>
        <div className="rounded-lg p-5 flex flex-col gap-4"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Ollama Base URL
            </label>
            <input
              className="h-9 px-3 rounded-md text-sm outline-none"
              style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
              value={ollamaUrl}
              onChange={e => { setOllamaUrl(e.target.value); handleOllamaChange() }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-focus-ring)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              模型名称
            </label>
            <input
              className="h-9 px-3 rounded-md text-sm outline-none"
              style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
              value={modelName}
              onChange={e => { setModelName(e.target.value); handleOllamaChange() }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-focus-ring)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
            />
          </div>
          <div className="flex items-center gap-4">
            <button
              className="px-4 h-9 rounded-md text-sm transition-colors duration-[120ms] disabled:opacity-45"
              style={{ background: 'var(--color-bg-surface-selected)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
              onClick={testConnection}
              disabled={connStatus === 'testing'}
            >
              {connStatus === 'testing' ? '测试中...' : '测试连接'}
            </button>
            {connStatusEl}
          </div>
          <div className="flex items-center justify-end">
            <button
              className="px-4 h-9 rounded-md text-sm font-medium transition-colors duration-[120ms] disabled:opacity-45"
              style={{
                background: settingsDirty ? 'var(--color-primary)' : 'var(--color-bg-surface-selected)',
                color: settingsDirty ? 'var(--color-text-on-brand)' : 'var(--color-text-secondary)',
              }}
              disabled={!settingsDirty || saveOllamaSettings.isPending}
              onClick={saveOllama}
            >
              {saveOllamaSettings.isPending ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </section>

      {/* Tag management */}
      <section>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>标签管理</h2>
        <div className="rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)' }}>
          {/* Add new */}
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <input
              className="flex-1 h-8 px-3 rounded text-sm outline-none"
              style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
              placeholder="新标签名称"
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-focus-ring)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
            />
            <button
              className="flex items-center gap-1 px-3 h-8 rounded text-xs font-medium transition-colors duration-[120ms] disabled:opacity-45"
              style={{ background: 'var(--color-primary)', color: 'var(--color-text-on-brand)' }}
              onClick={addTag}
              disabled={createTag.isPending}
            >
              <Plus size={12} /> 新增
            </button>
          </div>

          {/* Tag list */}
          {tags.map(tag => (
            <div key={tag.id}
              className="flex items-center px-4 py-2.5 gap-3"
              style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              {editingTagId === tag.id ? (
                <input
                  autoFocus
                  className="flex-1 h-7 px-2 rounded text-sm outline-none"
                  style={{ border: '1px solid var(--color-focus-ring)', color: 'var(--color-text-primary)' }}
                  value={editingTagValue}
                  onChange={e => setEditingTagValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveTagEdit(tag.id); if (e.key === 'Escape') setEditingTagId(null) }}
                />
              ) : (
                <span className="flex-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>{tag.name}</span>
              )}
              <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
                {tag.intent_count} 条意图
              </span>
              {editingTagId === tag.id ? (
                <button className="p-1 rounded text-xs" style={{ color: 'var(--color-success)' }} onClick={() => saveTagEdit(tag.id)}>
                  <Check size={14} />
                </button>
              ) : (
                <button className="p-1 rounded transition-colors duration-[120ms]"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
                  onClick={() => { setEditingTagId(tag.id); setEditingTagValue(tag.name) }}>
                  <Pencil size={14} strokeWidth={1.5} />
                </button>
              )}
              {deleteConfirm === tag.id ? (
                <div className="flex items-center gap-1 text-xs">
                  <span style={{ color: 'var(--color-text-secondary)' }}>确认删除？</span>
                  <button className="px-2 py-0.5 rounded" style={{ background: 'var(--color-danger)', color: 'white' }}
                    onClick={() => handleDeleteTag(tag.id)}>
                    删除
                  </button>
                  <button className="px-2 py-0.5 rounded" style={{ background: 'var(--color-bg-surface-selected)', color: 'var(--color-text-secondary)' }}
                    onClick={() => setDeleteConfirm(null)}>
                    取消
                  </button>
                </div>
              ) : (
                <button className="p-1 rounded transition-colors duration-[120ms]"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
                  onClick={() => setDeleteConfirm(tag.id)}>
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              )}
            </div>
          ))}

          {tags.length === 0 && (
            <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              暂无标签
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
