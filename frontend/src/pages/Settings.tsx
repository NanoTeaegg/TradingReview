import { useState } from 'react'
import { Check, X, Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { mockTags } from '@/lib/mock'

type ConnStatus = 'idle' | 'testing' | 'ok' | 'fail_url' | 'fail_model'

export default function Settings() {
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [modelName, setModelName] = useState('qwen2.5:14b')
  const [connStatus, setConnStatus] = useState<ConnStatus>('idle')
  const [settingsSaved, setSettingsSaved] = useState(true)

  const [tags, setTags] = useState(mockTags)
  const [newTagName, setNewTagName] = useState('')
  const [editingTagId, setEditingTagId] = useState<number | null>(null)
  const [editingTagValue, setEditingTagValue] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  function testConnection() {
    setConnStatus('testing')
    setTimeout(() => {
      setConnStatus('ok')
    }, 1200)
  }

  function handleOllamaChange() {
    setSettingsSaved(false)
    setConnStatus('idle')
  }

  function saveOllama() {
    setSettingsSaved(true)
  }

  function addTag() {
    const name = newTagName.trim()
    if (!name) return
    const id = Date.now()
    setTags(prev => [...prev, { id, name, intent_count: 0 }])
    setNewTagName('')
  }

  function deleteTag(id: number) {
    setTags(prev => prev.filter(t => t.id !== id))
    setDeleteConfirm(null)
  }

  function saveTagEdit(id: number) {
    setTags(prev => prev.map(t => t.id === id ? { ...t, name: editingTagValue } : t))
    setEditingTagId(null)
  }

  const connStatusEl = (() => {
    if (connStatus === 'testing') return (
      <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        <Loader2 size={12} className="animate-spin" /> 测试中...
      </span>
    )
    if (connStatus === 'ok') return (
      <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-success)' }}>
        <Check size={12} /> 连接成功，模型可用
      </span>
    )
    if (connStatus === 'fail_url') return (
      <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-danger)' }}>
        <X size={12} /> 无法连接 Ollama，请检查地址
      </span>
    )
    if (connStatus === 'fail_model') return (
      <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-danger)' }}>
        <X size={12} /> Ollama 可连接，但模型 {modelName} 未找到
      </span>
    )
    return null
  })()

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <h1 className="font-serif text-2xl font-medium" style={{ color: 'var(--color-text-primary)' }}>设置</h1>

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
              className="px-4 h-9 rounded-md text-sm transition-colors duration-[120ms]"
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
                background: settingsSaved ? 'var(--color-bg-surface-selected)' : 'var(--color-primary)',
                color: settingsSaved ? 'var(--color-text-secondary)' : 'var(--color-text-on-brand)',
              }}
              disabled={settingsSaved}
              onClick={saveOllama}
            >
              保存
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
              className="flex items-center gap-1 px-3 h-8 rounded text-xs font-medium transition-colors duration-[120ms]"
              style={{ background: 'var(--color-primary)', color: 'var(--color-text-on-brand)' }}
              onClick={addTag}
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
                    onClick={() => deleteTag(tag.id)}>
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
