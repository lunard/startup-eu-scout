import { useState } from 'react'
import { motion } from 'framer-motion'
import { Key, Brain, BrainCircuit, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { saveCredential, loadCredential, deleteCredential } from '@/lib/storage'

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

const MODELS = [
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',  label: 'Phi-3.5 Mini (3.8B)', size: '~2.2 GB', rec: !isMobile },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',  label: 'Qwen 2.5 1.5B',       size: '~1.0 GB', rec: isMobile, note: isMobile ? 'Best for mobile' : undefined },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',  label: 'Llama 3.2 3B',        size: '~2.0 GB' },
]

export default function SettingsTab() {
  const { capabilities, llmReady, llmLoading, llmProgress, llmStatusText, setLlmStatus, settings, updateSettings, addLog } = useAppStore()

  const [claudeKey, setClaudeKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [keySaved, setKeySaved] = useState(false)
  const [selectedModel, setSelectedModel] = useState(() => {
    if (settings.defaultModel) return settings.defaultModel
    return isMobile ? 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC' : 'Phi-3.5-mini-instruct-q4f16_1-MLC'
  })
  const [modelOpen, setModelOpen] = useState(false)

  async function saveClaudeKey() {
    if (!claudeKey.trim()) return
    setSavingKey(true)
    await saveCredential('claude-api-key', claudeKey.trim())
    updateSettings({ useLlm: 'claude' })
    addLog('storage', 'Claude API key saved (encrypted)')
    setSavingKey(false); setKeySaved(true); setClaudeKey('')
    setTimeout(() => setKeySaved(false), 3000)
  }

  async function clearClaudeKey() {
    await deleteCredential('claude-api-key')
    updateSettings({ useLlm: 'local' })
    addLog('storage', 'Claude API key cleared')
  }

  async function loadLocalLLM() {
    if (llmLoading || llmReady) return
    addLog('llm', `Loading model: ${selectedModel}…`)
    setLlmStatus(false, true, 0, 'Initialising…')
    try {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm')
      const engine = await CreateMLCEngine(selectedModel, {
        initProgressCallback: (p: any) => {
          const pct = Math.round((p.progress ?? 0) * 100)
          setLlmStatus(false, true, pct, p.text ?? `Loading… ${pct}%`)
          addLog('llm', p.text ?? `${pct}%`)
        },
      });
      (window as any).__euScoutEngine = engine
      setLlmStatus(true, false, 100, 'Ready')
      // Enable auto-restore on next startup
      updateSettings({ useLlm: 'local', defaultModel: selectedModel, autoLoadModel: true })
      addLog('success', `${selectedModel} loaded — ${capabilities?.npuAvailable ? 'NPU' : 'GPU'} backend active`)
    } catch (e) {
      setLlmStatus(false, false, 0, '')
      addLog('error', `LLM load failed: ${(e as Error).message}`)
    }
  }

  const selectedModelInfo = MODELS.find(m => m.id === selectedModel)

  return (
    <div className="px-4 py-5 space-y-5 pb-4">

      {/* Hardware info */}
      {capabilities && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass p-4">
          <div className="flex items-center gap-2 mb-3">
            <BrainCircuit size={15} className="text-eu-sky" />
            <p className="text-sm font-semibold text-white">AI Hardware</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Backend',     value: capabilities.npuAvailable ? 'NPU 🧠' : 'GPU ⚡' },
              { label: 'WebGPU',      value: capabilities.hasWebGPU ? '✅' : '❌' },
              { label: 'WebNN',       value: capabilities.hasWebNN ? '✅' : '❌' },
              { label: 'GPU Tier',    value: capabilities.gpuTier ?? 'N/A' },
            ].map(r => (
              <div key={r.label} className="bg-white/[0.04] rounded-lg px-3 py-2">
                <p className="text-[10px] text-eu-muted uppercase tracking-wide">{r.label}</p>
                <p className="text-xs text-white font-medium mt-0.5">{r.value}</p>
              </div>
            ))}
          </div>
          {capabilities.gpuName && (
            <p className="text-xs text-eu-muted mt-2 truncate">🖥 {capabilities.gpuName}</p>
          )}
        </motion.div>
      )}

      {/* Local LLM */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain size={15} className="text-eu-sky" />
          <p className="text-sm font-semibold text-white">Local AI Model</p>
          {llmReady && <span className="ml-auto badge-open">Ready</span>}
        </div>

        {/* Model selector */}
        <div className="mb-3">
          <p className="input-label">Model</p>
          <button className="w-full flex items-center justify-between bg-white/[0.06] border border-white/[0.12] rounded-xl px-4 py-3 text-sm"
            onClick={() => setModelOpen(!modelOpen)}>
            <div className="text-left">
              <p className="text-white font-medium">{selectedModelInfo?.label}</p>
              <p className="text-xs text-eu-muted">{selectedModelInfo?.size}</p>
            </div>
            {modelOpen ? <ChevronDown size={15} className="text-eu-muted" /> : <ChevronRight size={15} className="text-eu-muted" />}
          </button>
          {modelOpen && (
            <div className="mt-1 glass overflow-hidden">
              {MODELS.map(m => (
                <button key={m.id}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left active:bg-white/5 border-b border-white/[0.06] last:border-0
                    ${selectedModel === m.id ? 'bg-eu-blue/10' : ''}`}
                  onClick={() => { setSelectedModel(m.id); setModelOpen(false) }}>
                  <div>
                    <p className="text-sm text-white">{m.label}
                      {m.rec && <span className="ml-2 text-[10px] text-eu-gold">Recommended</span>}
                      {m.note && !m.rec && <span className="ml-2 text-[10px] text-eu-sky">{m.note}</span>}
                    </p>
                    <p className="text-xs text-eu-muted">{m.size}</p>
                  </div>
                  {selectedModel === m.id && <CheckCircle2 size={15} className="text-eu-sky" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Load progress */}
        {llmLoading && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-eu-muted truncate flex-1">{llmStatusText}</p>
              <p className="text-xs text-eu-sky ml-2">{llmProgress}%</p>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-eu-blue to-eu-sky rounded-full"
                animate={{ width: `${llmProgress}%` }} transition={{ duration: 0.3 }} />
            </div>
          </div>
        )}

        {isMobile && selectedModel !== 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC' && !llmReady && (
          <div className="mb-3 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <p className="text-xs text-yellow-400">⚠️ Large model on mobile — may crash. <button className="underline" onClick={() => setSelectedModel('Qwen2.5-1.5B-Instruct-q4f16_1-MLC')}>Switch to 1.5B</button></p>
          </div>
        )}

        <button className={`btn-primary w-full ${llmReady ? 'opacity-50 cursor-default' : ''}`}
          disabled={llmLoading || llmReady} onClick={loadLocalLLM}>
          {llmLoading ? <><Loader2 size={15} className="animate-spin" /> Loading…</>
          : llmReady    ? <><CheckCircle2 size={15} /> Model loaded</>
          :               <><Brain size={15} /> Load model ({selectedModelInfo?.size})</>}
        </button>
        <p className="text-xs text-eu-muted mt-2 text-center leading-relaxed">
          Downloaded once and cached offline. Model runs locally — never leaves your device.
        </p>

        {/* Auto-restore toggle — shown only after first successful load */}
        {settings.autoLoadModel !== undefined && settings.defaultModel && (
          <button
            className="mt-3 w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] active:opacity-70"
            onClick={() => updateSettings({ autoLoadModel: !settings.autoLoadModel })}>
            <div className="text-left">
              <p className="text-xs font-medium text-white">Auto-restore on startup</p>
              <p className="text-[10px] text-eu-muted mt-0.5">Reload model from cache when app opens</p>
            </div>
            <div className={`w-9 h-5 rounded-full transition-colors duration-200 flex items-center px-0.5 shrink-0 ml-3
              ${settings.autoLoadModel ? 'bg-eu-sky' : 'bg-white/20'}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
                ${settings.autoLoadModel ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </button>
        )}
      </motion.div>

      {/* Claude API key */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <Key size={15} className="text-eu-sky" />
          <p className="text-sm font-semibold text-white">Claude API Key</p>
          <span className="ml-auto text-xs text-eu-muted">(optional)</span>
        </div>
        <p className="text-xs text-white/40 leading-relaxed mb-3">
          Stored encrypted in your browser (AES-256). Never sent to our servers.
        </p>
        <div className="relative mb-3">
          <input className="input pr-10"
            type={showKey ? 'text' : 'password'}
            placeholder="sk-ant-api03-…"
            value={claudeKey} onChange={e => setClaudeKey(e.target.value)} />
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-eu-muted"
            onClick={() => setShowKey(!showKey)}>
            {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={saveClaudeKey} disabled={!claudeKey.trim() || savingKey}>
            {savingKey ? <Loader2 size={14} className="animate-spin" /> : keySaved ? <CheckCircle2 size={14} className="text-green-400" /> : 'Save encrypted'}
          </button>
          <button className="btn-danger px-4" onClick={clearClaudeKey}>
            <Trash2 size={14} />
          </button>
        </div>
      </motion.div>
    </div>
  )
}
