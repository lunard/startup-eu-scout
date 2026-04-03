import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Cpu, Wifi, AlertTriangle, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import type { DeviceCapabilities } from '@/types'
import { detectDeviceCapabilities } from '@/lib/device-detect'
import { useAppStore } from '@/store/appStore'

type CheckState = 'idle' | 'checking' | 'done'

interface CheckItem {
  label: string
  state: 'pending' | 'pass' | 'fail' | 'checking'
  detail?: string
}

export default function DeviceCheckScreen() {
  const { setCapabilities, setScreen } = useAppStore()
  const [checkState, setCheckState] = useState<CheckState>('idle')
  const [items, setItems] = useState<CheckItem[]>([
    { label: 'WebGPU support',            state: 'pending' },
    { label: 'GPU adapter detection',     state: 'pending' },
    { label: 'GPU capability tier',       state: 'pending' },
    { label: 'AI acceleration (NPU/GPU)', state: 'pending' },
  ])
  const [caps, setCaps] = useState<DeviceCapabilities | null>(null)

  const tick = (i: number, state: CheckItem['state'], detail?: string) =>
    setItems(prev => prev.map((x, idx) => idx === i ? { ...x, state, detail } : x))

  async function runChecks() {
    setCheckState('checking')
    setCaps(null)
    setItems(prev => prev.map(x => ({ ...x, state: 'pending', detail: undefined })))

    tick(0, 'checking')
    await delay(300)
    const hasWebGPU = 'gpu' in navigator
    tick(0, hasWebGPU ? 'pass' : 'fail', hasWebGPU ? 'Supported' : 'Not available')
    if (!hasWebGPU) {
      const r: DeviceCapabilities = { supported: false, backend: null, hasWebGPU: false, hasWebNN: false, npuAvailable: false,
        reason: 'WebGPU is not supported. Use Chrome 113+, Edge 113+, or Safari 18+.' }
      setCapabilities(r); setCaps(r); setCheckState('done'); return
    }

    tick(1, 'checking')
    await delay(400)
    let adapter: any = null
    try { adapter = await (navigator as any).gpu.requestAdapter({ powerPreference: 'high-performance' }) }
    catch { /* noop */ }
    tick(1, adapter ? 'pass' : 'fail', adapter ? 'Found' : 'No adapter found')
    if (!adapter) {
      const r: DeviceCapabilities = { supported: false, backend: null, hasWebGPU: true, hasWebNN: false, npuAvailable: false,
        reason: 'No capable GPU found. A recent flagship device is required.' }
      setCapabilities(r); setCaps(r); setCheckState('done'); return
    }

    tick(2, 'checking')
    await delay(500)
    const result = await detectDeviceCapabilities()
    const tierLabel = result.gpuTier === 'high' ? 'High-end ✦' : result.gpuTier === 'mid' ? 'Mid-range' : 'Low-end'
    tick(2, result.gpuTier !== 'low' ? 'pass' : 'fail',
      `${tierLabel}${result.gpuName ? ` — ${result.gpuName}` : ''}`)
    if (!result.supported) {
      setCapabilities(result); setCaps(result); setCheckState('done'); return
    }

    tick(3, 'checking')
    await delay(600)
    tick(3, 'pass', result.npuAvailable ? 'NPU detected 🧠' : 'GPU via WebGPU ⚡')

    setCapabilities(result); setCaps(result); setCheckState('done')
  }

  useEffect(() => { runChecks() }, [])

  return (
    <div className="h-[100dvh] bg-eu-gradient flex flex-col items-center justify-center px-5 py-12 overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center mb-10">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-eu-blue to-eu-sky flex items-center justify-center text-3xl mb-3 shadow-glow-blue">
          🇪🇺
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">EU Scout</h1>
        <p className="text-eu-muted text-sm mt-1">Checking device capabilities…</p>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        className="glass w-full max-w-sm p-5 space-y-4">
        {items.map((item, i) => (
          <motion.div key={item.label}
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 * i }}
            className="flex items-center gap-3">
            <CheckIcon state={item.state} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{item.label}</p>
              {item.detail && <p className="text-xs text-eu-muted mt-0.5 truncate">{item.detail}</p>}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {checkState === 'done' && caps && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }} className="w-full max-w-sm mt-4">
          {caps.supported ? (
            <div className="glass border-green-500/20 p-5">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                <p className="text-sm font-semibold text-green-400">Device ready</p>
              </div>
              <p className="text-xs text-white/60 mb-4">
                {caps.npuAvailable
                  ? 'Your NPU will accelerate on-device AI inference.'
                  : 'Your GPU will power on-device AI inference via WebGPU.'}
              </p>
              <button className="btn-primary w-full" onClick={() => setScreen('disclaimer')}>
                Continue →
              </button>
            </div>
          ) : (
            <div className="glass border-red-500/20 p-5">
              <div className="flex items-center gap-2 mb-1">
                <XCircle size={18} className="text-red-400 shrink-0" />
                <p className="text-sm font-semibold text-red-400">Device not supported</p>
              </div>
              <p className="text-xs text-white/70 mb-3">{caps.reason}</p>
              <div className="bg-white/[0.04] rounded-xl p-3 mb-4 space-y-1">
                <p className="text-xs text-eu-muted font-medium uppercase tracking-wide mb-2">Compatible devices</p>
                {['iPhone 15 / 16', 'iPad Pro M1, M2, M4', 'Samsung Galaxy S23/S24/S25', 'Snapdragon X Elite (Chrome/Edge)', 'Desktop with discrete GPU'].map(d => (
                  <p key={d} className="text-xs text-white/60 flex items-center gap-1.5">
                    <span className="text-eu-gold">·</span>{d}
                  </p>
                ))}
              </div>
              <button className="btn-secondary w-full gap-2" onClick={runChecks}>
                <RefreshCw size={15} /> Recheck
              </button>
            </div>
          )}
        </motion.div>
      )}

      <p className="text-xs text-white/20 mt-8 text-center max-w-xs leading-relaxed">
        All AI processing runs locally on your device.<br />No data ever leaves your browser.
      </p>
    </div>
  )
}

function CheckIcon({ state }: { state: CheckItem['state'] }) {
  if (state === 'checking') return (
    <div className="w-5 h-5 shrink-0 flex items-center justify-center">
      <div className="w-4 h-4 border-2 border-eu-sky/30 border-t-eu-sky rounded-full animate-spin" />
    </div>
  )
  if (state === 'pass') return <CheckCircle2 size={20} className="text-green-400 shrink-0" />
  if (state === 'fail') return <XCircle size={20} className="text-red-400 shrink-0" />
  return <div className="w-5 h-5 rounded-full border border-white/20 shrink-0" />
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }
