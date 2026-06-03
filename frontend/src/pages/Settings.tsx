import { useState, useEffect, useMemo, useRef } from 'react'
import { Check, X, Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronUp, Database, RefreshCw, Eye, EyeOff, KeyRound, ListRestart } from 'lucide-react'
import {
  useTags, useCreateTag, useUpdateTag, useDeleteTag,
  useLLMSettings, useSaveLLMSettings, usePingLLM,
  useCashFlows, useCreateCashFlow, useDeleteCashFlow,
  useFeeSettings, useSaveFeeSettings,
  useFullHistoryStatus, useStartFullHistory, useCancelFullHistory, useSyncLatestMarket,
  useLatestSyncStatus, useInvalidateMarketViews,
  useAccounts, useCreateAccount, useDeleteAccount,
  invalidateAccountScopedQueries,
  type LLMProvider,
} from '@/lib/queries'
import { useCurrentAccountId, useSetCurrentAccountId } from '@/lib/account'
import { useQueryClient } from '@tanstack/react-query'
import { formatExactAmount, formatTradeDate } from '@/lib/format'

type ConnStatus = 'idle' | 'testing' | 'ok' | 'fail'
type ModelVendorId = 'ollama' | 'openai' | 'deepseek' | 'moonshot' | 'dashscope' | 'zhipu' | 'openrouter' | 'custom'

interface ModelVendor {
  id: ModelVendorId
  name: string
  provider: LLMProvider
  baseUrl: string
  defaultModel: string
  needsKey: boolean
}

const MODEL_VENDORS: ModelVendor[] = [
  { id: 'ollama', name: 'Ollama 本地', provider: 'ollama', baseUrl: 'http://localhost:11434', defaultModel: 'qwen2.5:14b', needsKey: false },
  { id: 'openai', name: 'OpenAI', provider: 'openai_compatible', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', needsKey: true },
  { id: 'deepseek', name: 'DeepSeek', provider: 'openai_compatible', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat', needsKey: true },
  { id: 'moonshot', name: 'Moonshot / Kimi', provider: 'openai_compatible', baseUrl: 'https://api.moonshot.ai/v1', defaultModel: 'kimi-k2-0905-preview', needsKey: true },
  { id: 'dashscope', name: '通义千问 DashScope', provider: 'openai_compatible', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus', needsKey: true },
  { id: 'zhipu', name: '智谱 GLM', provider: 'openai_compatible', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4.5', needsKey: true },
  { id: 'openrouter', name: 'OpenRouter', provider: 'openai_compatible', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-4o-mini', needsKey: true },
  { id: 'custom', name: '自定义 OpenAI 兼容', provider: 'openai_compatible', baseUrl: '', defaultModel: '', needsKey: true },
]

function vendorFromSettings(provider: LLMProvider, baseUrl: string): ModelVendorId {
  if (provider === 'ollama') return 'ollama'
  const normalized = baseUrl.replace(/\/$/, '')
  return MODEL_VENDORS.find(v => v.id !== 'custom' && v.baseUrl.replace(/\/$/, '') === normalized)?.id ?? 'custom'
}

export default function Settings() {
  const queryClient = useQueryClient()
  const currentAccountId = useCurrentAccountId()
  const setCurrentAccountId = useSetCurrentAccountId()
  const { data: accounts = [] } = useAccounts()
  const createAccount = useCreateAccount()
  const deleteAccount = useDeleteAccount()
  const { data: llmSettings } = useLLMSettings()
  const saveLLMSettings = useSaveLLMSettings()
  const pingLLM = usePingLLM()

  const [modelVendor, setModelVendor] = useState<ModelVendorId>('ollama')
  const [apiUrl, setApiUrl] = useState('http://localhost:11434')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [modelName, setModelName] = useState('qwen2.5:14b')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [connStatus, setConnStatus] = useState<ConnStatus>('idle')
  const [pingMsg, setPingMsg] = useState('')
  const [settingsDirty, setSettingsDirty] = useState(false)
  const [cashOpen, setCashOpen] = useState(false)
  const [cashAmount, setCashAmount] = useState('')
  const [cashError, setCashError] = useState('')
  const [feeRateInput, setFeeRateInput] = useState('0.04')
  const [feeMinExempt, setFeeMinExempt] = useState(false)
  const [feeMsg, setFeeMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [accountName, setAccountName] = useState('')
  const [accountMsg, setAccountMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [deleteAccountId, setDeleteAccountId] = useState<number | null>(null)
  const [deleteAccountName, setDeleteAccountName] = useState('')

  useEffect(() => {
    if (llmSettings) {
      setModelVendor(vendorFromSettings(llmSettings.provider, llmSettings.base_url))
      setApiUrl(llmSettings.base_url)
      setModelName(llmSettings.model)
      setApiKey('')
    }
  }, [llmSettings])

  const selectedVendor = useMemo(
    () => MODEL_VENDORS.find(v => v.id === modelVendor) ?? MODEL_VENDORS[0],
    [modelVendor],
  )

  const { data: tags = [] } = useTags()
  const createTag = useCreateTag()
  const updateTag = useUpdateTag()
  const deleteTag = useDeleteTag()
  const { data: cashFlows } = useCashFlows()
  const createCashFlow = useCreateCashFlow()
  const deleteCashFlow = useDeleteCashFlow()
  const { data: feeSettings } = useFeeSettings()
  const saveFeeSettings = useSaveFeeSettings()

  const { data: historyStatus, isFetching: historyFetching } = useFullHistoryStatus()
  const startHistory = useStartFullHistory()
  const cancelHistory = useCancelFullHistory()
  const syncLatest = useSyncLatestMarket()
  const { data: syncStatus } = useLatestSyncStatus()
  const invalidateMarketViews = useInvalidateMarketViews()
  const [marketMsg, setMarketMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // 后台「拉取最新行情」完成时刷新依赖行情的视图并展示结果文案
  const wasSyncRunning = useRef(false)
  useEffect(() => {
    if (wasSyncRunning.current && syncStatus && !syncStatus.running) {
      if (syncStatus.status === 'complete') {
        invalidateMarketViews()
        setMarketMsg({ ok: true, text: syncStatus.message ?? '已是最新' })
      } else if (syncStatus.status === 'error') {
        setMarketMsg({ ok: false, text: syncStatus.message ?? '拉取失败，请稍后重试' })
      } else if (syncStatus.status === 'interrupted') {
        setMarketMsg({ ok: false, text: '同步任务被中断（服务可能已重启），请重新拉取' })
      }
    }
    wasSyncRunning.current = syncStatus?.running ?? false
  }, [syncStatus, invalidateMarketViews])

  const syncRunning = (syncStatus?.running ?? false) || syncLatest.isPending
  const running = historyStatus?.running ?? false
  const historyReady = Boolean(historyStatus) && !historyFetching
  const total = historyStatus?.total ?? 0
  const done = historyStatus?.done ?? 0
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0
  const marketActionDisabled = startHistory.isPending || syncRunning || !historyReady
  const marketActionIcon = !historyReady
    ? <Loader2 size={14} className="animate-spin" />
    : historyStatus?.has_data
      ? <RefreshCw size={14} className={syncRunning ? 'animate-spin' : undefined} />
      : <Database size={14} />
  const marketActionLabel = !historyReady
    ? '数据检索中'
    : historyStatus?.has_data
      ? (syncRunning ? '拉取中…' : '拉取最新行情')
      : (startHistory.isPending ? '初始化中…' : '初始化全量历史')

  useEffect(() => {
    if (feeSettings) {
      setFeeRateInput(formatPercentRate(feeSettings.commission_rate))
      setFeeMinExempt(feeSettings.commission_min_fee_exempt)
      setFeeMsg(null)
    }
  }, [feeSettings])

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
      onError: (err) => {
        const serverDetail = (
          typeof err === 'object' &&
          err !== null &&
          'response' in err &&
          typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
        )
          ? (err as { response: { data: { detail: string } } }).response.data.detail
          : null
        setMarketMsg({ ok: false, text: serverDetail ?? '启动拉取失败，请稍后重试' })
      },
    })
  }
  function handleSmartMarketSync() {
    if (running || syncRunning || !historyReady) return
    if (historyStatus?.has_data) {
      handleSyncLatest()
      return
    }
    handleStartHistory()
  }

  function switchAccount(accountId: number) {
    setCurrentAccountId(accountId)
    invalidateAccountScopedQueries(queryClient)
    setAccountMsg({ ok: true, text: '已切换当前账本' })
  }

  async function addAccount() {
    const name = accountName.trim()
    if (!name) {
      setAccountMsg({ ok: false, text: '请输入账本名' })
      return
    }
    try {
      const account = await createAccount.mutateAsync({ name })
      setCurrentAccountId(account.id)
      invalidateAccountScopedQueries(queryClient)
      setAccountName('')
      setAccountMsg({ ok: true, text: '已新建并切换到账本' })
    } catch (error) {
      setAccountMsg({ ok: false, text: error instanceof Error ? error.message : '新建账本失败' })
    }
  }

  async function confirmDeleteAccount(id: number) {
    try {
      await deleteAccount.mutateAsync({ id, name: deleteAccountName })
      setDeleteAccountId(null)
      setDeleteAccountName('')
      setAccountMsg({ ok: true, text: '账本已删除' })
    } catch (error) {
      setAccountMsg({ ok: false, text: error instanceof Error ? error.message : '删除账本失败' })
    }
  }

  const accountLabel = (account: { name: string; is_default: boolean }) =>
    account.is_default ? '模拟数据' : account.name

  const [newTagName, setNewTagName] = useState('')
  const [editingTagId, setEditingTagId] = useState<number | null>(null)
  const [editingTagValue, setEditingTagValue] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  async function testConnection() {
    setConnStatus('testing')
    setPingMsg('')
    if (settingsDirty) {
      await saveLLM()
    }
    const result = await pingLLM.mutateAsync()
    if (result.ok) {
      setConnStatus('ok')
      const models = result.models ?? []
      setAvailableModels(models)
      setPingMsg(models.length > 0 ? `连接成功，已获取 ${models.length} 个模型` : '连接成功，但未返回模型列表')
    } else {
      setConnStatus('fail')
      setPingMsg(result.error || '连接失败')
    }
  }

  async function saveLLM() {
    await saveLLMSettings.mutateAsync({
      provider: selectedVendor.provider,
      base_url: apiUrl,
      model: modelName,
      api_key: apiKey || undefined,
    })
    setSettingsDirty(false)
  }

  function handleLLMChange() {
    setSettingsDirty(true)
    setConnStatus('idle')
    setPingMsg('')
  }

  function handleLLMConnectionChange() {
    setAvailableModels([])
    handleLLMChange()
  }

  function handleVendorChange(vendorId: ModelVendorId) {
    const next = MODEL_VENDORS.find(v => v.id === vendorId) ?? MODEL_VENDORS[0]
    setModelVendor(next.id)
    setApiUrl(next.baseUrl)
    setModelName(next.defaultModel)
    setApiKey('')
    setAvailableModels([])
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

  function formatPercentRate(rate: string | number | null | undefined) {
    const value = Number(rate ?? 0) * 100
    return Number.isFinite(value) ? Number(value.toFixed(5)).toString() : '0'
  }

  function toDecimalRate(percentRate: string) {
    return (Number(percentRate) / 100).toFixed(8)
  }

  async function saveFee() {
    const percentRate = feeRateInput.trim()
    if (!percentRate || Number(percentRate) < 0 || Number.isNaN(Number(percentRate)) || Number(percentRate) > 0.3) {
      setFeeMsg({ ok: false, text: '请输入 0% 到 0.3% 之间的总佣金费率' })
      return
    }
    try {
      const result = await saveFeeSettings.mutateAsync({
        commission_rate: toDecimalRate(percentRate),
        commission_min_fee_exempt: feeMinExempt,
      })
      setFeeMsg({ ok: true, text: `手续费设置已保存，已重算 ${result.recalculated_count ?? 0} 笔历史成交` })
    } catch (error) {
      setFeeMsg({ ok: false, text: error instanceof Error ? error.message : '保存手续费设置失败' })
    }
  }

  const connStatusEl = (() => {
    if (connStatus === 'testing') return (
      <span className="flex min-w-0 items-start gap-1.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        <Loader2 size={12} className="mt-0.5 shrink-0 animate-spin" /> <span className="min-w-0 break-words">测试中...</span>
      </span>
    )
    if (connStatus === 'ok') return (
      <span className="flex min-w-0 items-start gap-1.5 text-xs" style={{ color: 'var(--color-success)' }}>
        <Check size={12} className="mt-0.5 shrink-0" /> <span className="min-w-0 break-words">{pingMsg}</span>
      </span>
    )
    if (connStatus === 'fail') return null
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

      {/* Account management */}
      <section>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>账本管理</h2>
        <div className="rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)' }}>
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <input
              className="flex-1 h-8 px-3 rounded-md text-sm outline-none"
              style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
              placeholder="新账本名称"
              value={accountName}
              onChange={e => { setAccountName(e.target.value); setAccountMsg(null) }}
              onKeyDown={e => e.key === 'Enter' && addAccount()}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-focus-ring)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
            />
            <button
              className="flex items-center gap-1 px-3 h-8 rounded-md text-xs font-medium transition-colors duration-[120ms] disabled:opacity-45"
              style={{ background: 'var(--color-primary)', color: 'var(--color-text-on-brand)' }}
              onClick={addAccount}
              disabled={createAccount.isPending}
            >
              <Plus size={12} /> 新建
            </button>
          </div>

          {accounts.map(account => {
            const isCurrent = account.id === currentAccountId
            const isDeleting = deleteAccountId === account.id
            return (
              <div key={account.id}
                className="flex items-center gap-3 px-4 py-2.5"
                style={{
                  borderBottom: '1px solid var(--color-border-subtle)',
                  background: isCurrent ? 'var(--color-bg-surface-selected)' : 'transparent',
                }}>
                <button className="min-w-0 flex-1 text-left text-sm truncate"
                  style={{ color: 'var(--color-text-primary)' }}
                  onClick={() => switchAccount(account.id)}>
                  {accountLabel(account)}
                </button>
                {isCurrent && (
                  <span className="text-xs" style={{ color: 'var(--color-primary)' }}>当前</span>
                )}
                {isDeleting ? (
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="min-w-0 flex-1 text-xs" style={{ color: 'var(--color-danger)' }}>
                      删除后该账本下成交、出入金、意图、复盘、规则等数据会同步删除。请输入完整账本名确认。
                    </span>
                    <input
                      className="h-7 w-32 px-2 rounded text-xs outline-none"
                      style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                      placeholder={accountLabel(account)}
                      value={deleteAccountName}
                      onChange={e => setDeleteAccountName(e.target.value)}
                    />
                    <button className="h-7 px-2 rounded text-xs disabled:opacity-45"
                      style={{ background: 'var(--color-danger)', color: 'white' }}
                      disabled={accounts.length <= 1 || deleteAccount.isPending}
                      onClick={() => confirmDeleteAccount(account.id)}>
                      删除
                    </button>
                    <button className="h-7 px-2 rounded text-xs" style={{ color: 'var(--color-text-tertiary)' }}
                      onClick={() => { setDeleteAccountId(null); setDeleteAccountName('') }}>
                      取消
                    </button>
                  </div>
                ) : (
                  <button className="p-1 rounded transition-colors duration-[120ms] disabled:opacity-45"
                    style={{ color: 'var(--color-text-tertiary)' }}
                    disabled={accounts.length <= 1 || account.is_default}
                    title={account.is_default ? '默认模拟数据账本不可删除' : undefined}
                    onClick={() => { setDeleteAccountId(account.id); setDeleteAccountName('') }}>
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        {accountMsg && (
          <p className="mt-2 text-xs" style={{ color: accountMsg.ok ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {accountMsg.text}
          </p>
        )}
      </section>

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
              {formatExactAmount(cashFlows?.net_deposit)}
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
                      {formatExactAmount(flow.amount)}
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

      {/* Fee settings */}
      <section>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>手续费设置</h2>
        <div className="rounded-lg p-5 flex flex-col gap-5"
          style={{ border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)' }}>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>总佣金费率（%）</span>
              <div className="flex h-9 min-w-0 items-center overflow-hidden rounded-md"
                style={{ border: '1px solid var(--color-border-default)', background: 'var(--color-bg-canvas)' }}>
                <input
                  className="min-w-0 flex-1 bg-transparent px-3 text-sm tabular-nums outline-none"
                  style={{ color: 'var(--color-text-primary)' }}
                  inputMode="decimal"
                  value={feeRateInput}
                  onChange={e => { setFeeRateInput(e.target.value); setFeeMsg(null) }}
                />
                <span className="px-3 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>%</span>
              </div>
            </label>
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors duration-[120ms] disabled:opacity-45"
              style={{ background: 'var(--color-primary)', color: 'var(--color-text-on-brand)' }}
              disabled={saveFeeSettings.isPending}
              onClick={saveFee}
            >
              {saveFeeSettings.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              保存
            </button>
          </div>

          <label className="flex items-start gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <input
              className="mt-0.5"
              type="checkbox"
              checked={feeMinExempt}
              onChange={e => { setFeeMinExempt(e.target.checked); setFeeMsg(null) }}
            />
            <span>免 5（不启用「总佣金最低 5 元」）</span>
          </label>

          <p className="text-xs leading-6" style={{ color: 'var(--color-text-tertiary)' }}>
            「佣金」一栏填写总佣金费率即可，已包含券商净佣金与 A 股规费（证管费 0.002%、经手费 0.00341%、过户费 0.001%），无需另算；印花税按卖出 0.05% 单独计收。
          </p>

          {feeMsg && (
            <p className="text-xs" style={{ color: feeMsg.ok ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {feeMsg.text}
            </p>
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
              {historyStatus?.min_date
                ? `${historyStatus.min_date} ~ ${historyStatus.max_date}（最新 ${historyStatus.max_date}）`
                : '—'}
            </span>
            <span style={{ color: 'var(--color-text-tertiary)' }}>股票数量 / 已完成</span>
            <span className="tabular-nums text-right" style={{ color: 'var(--color-text-primary)' }}>
              {total > 0 ? `${done.toLocaleString()} / ${total.toLocaleString()}` : '—'}
              {(historyStatus?.failed ?? 0) > 0 ? `（失败 ${historyStatus?.failed}）` : ''}
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

          {/* 智能同步 */}
          <div className="flex items-start justify-between gap-4 pt-1" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
            <div className="flex flex-col gap-1 pt-3">
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>行情同步</span>
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                无全量历史时自动执行初始化（按股票补齐 23 年）；已有全量后自动执行按交易日增量（`daily(trade_date)`）。
                未收盘时自动同步至上一交易日。
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
                  disabled={marketActionDisabled}
                  onClick={handleSmartMarketSync}
                >
                  {marketActionIcon}
                  {marketActionLabel}
                </button>
              )}
            </div>
          </div>

          {marketMsg && (
            <p className="text-xs" style={{ color: marketMsg.ok ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {marketMsg.text}
            </p>
          )}
        </div>
      </section>

      {/* LLM config */}
      <section>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>大模型配置</h2>
        <div className="rounded-lg p-5 flex flex-col gap-4"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              模型厂商
            </label>
            <select
              className="h-9 px-3 rounded-md text-sm outline-none"
              style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)' }}
              value={modelVendor}
              onChange={e => handleVendorChange(e.target.value as ModelVendorId)}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-focus-ring)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
            >
              {MODEL_VENDORS.map(vendor => (
                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              API 地址
            </label>
            <input
              className="h-9 px-3 rounded-md text-sm outline-none"
              style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
              value={apiUrl}
              onChange={e => { setApiUrl(e.target.value); handleLLMConnectionChange() }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-focus-ring)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
              placeholder={selectedVendor.provider === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com/v1'}
            />
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {selectedVendor.provider === 'ollama'
                ? 'Ollama 使用本地地址，通过 /api/tags 获取模型。'
                : '填写 OpenAI 兼容 Base URL，系统会拼接 /models 与 /chat/completions。'}
            </span>
          </div>
          {selectedVendor.needsKey && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                API 密钥
              </label>
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-tertiary)' }} />
                  <input
                    className="w-full h-9 pl-9 pr-10 rounded-md text-sm outline-none"
                    style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={e => { setApiKey(e.target.value); handleLLMConnectionChange() }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-focus-ring)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
                    placeholder={llmSettings?.has_api_key ? `已保存：${llmSettings.api_key_masked}` : '粘贴 API Key'}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors duration-[120ms]"
                    style={{ color: 'var(--color-text-tertiary)' }}
                    onClick={() => setShowApiKey(v => !v)}
                    aria-label={showApiKey ? '隐藏 API 密钥' : '显示 API 密钥'}
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  type="button"
                  className="h-9 w-20 shrink-0 rounded-md text-sm transition-colors duration-[120ms] disabled:opacity-45"
                  style={{ background: 'var(--color-bg-surface-selected)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
                  onClick={testConnection}
                  disabled={connStatus === 'testing' || saveLLMSettings.isPending}
                >
                  {connStatus === 'testing' ? '检测中' : '检测'}
                </button>
              </div>
              {llmSettings?.has_api_key && !apiKey && (
                <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  <EyeOff size={12} /> 已保存密钥
                </span>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              模型
            </label>
            <div className="flex items-center gap-2">
              <input
                className="min-w-0 flex-1 h-9 px-3 rounded-md text-sm outline-none"
                style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                value={modelName}
                onChange={e => { setModelName(e.target.value); handleLLMChange() }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-focus-ring)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
                placeholder={selectedVendor.defaultModel || '输入模型 ID'}
              />
              <button
                type="button"
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 px-3 rounded-md text-sm transition-colors duration-[120ms] disabled:opacity-45"
                style={{ background: 'var(--color-bg-surface-selected)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
                onClick={testConnection}
                disabled={connStatus === 'testing' || saveLLMSettings.isPending}
              >
                {connStatus === 'testing' ? <Loader2 size={14} className="animate-spin" /> : <ListRestart size={14} />}
                <span>{connStatus === 'testing' ? '获取中' : '获取模型'}</span>
              </button>
            </div>
            {connStatusEl && <div>{connStatusEl}</div>}
            {availableModels.length > 0 && (
              <div className="flex flex-col rounded-md overflow-y-auto" style={{ border: '1px solid var(--color-border-subtle)', maxHeight: '180px' }}>
                {availableModels.map(model => (
                  <button
                    key={model}
                    type="button"
                    className="flex items-center justify-between px-3 py-2 text-left text-xs transition-colors duration-[120ms]"
                    style={{
                      borderBottom: '1px solid var(--color-border-subtle)',
                      color: model === modelName ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      background: model === modelName ? 'var(--color-bg-surface-selected)' : 'transparent',
                    }}
                    onClick={() => { setModelName(model); handleLLMChange() }}
                  >
                    <span className="font-mono">{model}</span>
                    {model === modelName && <Check size={12} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          {connStatus === 'fail' && (
            <div className="flex flex-col gap-1 px-3 py-2.5 rounded-md text-xs" style={{ background: 'rgba(181,51,51,0.06)', border: '1px solid var(--color-danger)' }}>
              <span className="font-medium" style={{ color: 'var(--color-danger)' }}>连接失败，无法获取模型列表</span>
              {pingMsg && (
                <span className="font-mono break-all" style={{ color: 'var(--color-text-secondary)' }}>{pingMsg}</span>
              )}
              <span style={{ color: 'var(--color-text-tertiary)' }}>
                {selectedVendor.provider === 'ollama'
                  ? '请确认 Ollama 服务已启动（ollama serve），且 API 地址填写正确。'
                  : '请检查 API 地址格式是否正确，以及 API Key 是否有效。'}
              </span>
            </div>
          )}
          <div className="flex items-center justify-end">
            <button
              className="px-4 h-9 rounded-md text-sm font-medium transition-colors duration-[120ms] disabled:opacity-45"
              style={{
                background: settingsDirty ? 'var(--color-primary)' : 'var(--color-bg-surface-selected)',
                color: settingsDirty ? 'var(--color-text-on-brand)' : 'var(--color-text-secondary)',
              }}
              disabled={!settingsDirty || saveLLMSettings.isPending}
              onClick={saveLLM}
            >
              {saveLLMSettings.isPending ? '保存中...' : '保存'}
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
              className="flex-1 h-8 px-3 rounded-md text-sm outline-none"
              style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
              placeholder="新标签名称"
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-focus-ring)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
            />
            <button
              className="flex items-center gap-1 px-3 h-8 rounded-md text-xs font-medium transition-colors duration-[120ms] disabled:opacity-45"
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
