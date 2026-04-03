import { motion } from 'framer-motion'
import { Cpu, Zap, BrainCircuit, ChevronRight, Info } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { acceptCapability } from '@/lib/storage'
import { getBackendLabel } from '@/lib/device-detect'

export default function CapabilityScreen() {
  const { capabilities, setScreen } = useAppStore()
  const caps = capabilities!

  function handleProceed() {
    acceptCapability()
    setScreen('app')
  }

  const isNPU = caps.npuAvailable
  const backendLabel = getBackendLabel(caps)

  const features = [
    {
      icon: isNPU ? '🧠' : '⚡',
      title: isNPU ? 'NPU-powered inference' : 'WebGPU-accelerated inference',
      desc: isNPU
        ? 'Your device\'s Neural Processing Unit will handle AI computations — purpose-built for ML, extremely efficient and fast.'
        : 'Your GPU will be used for AI via WebGPU — near-native performance with hardware acceleration.',
    },
    {
      icon: '🔒',
      title: 'Fully private',
      desc: 'The AI model runs locally. No prompts, no startup data, no results ever leave your device.',
    },
    {
      icon: '⚡',
      title: 'One-time download',
      desc: 'The model (~1.5 GB) is downloaded once and cached. All subsequent analyses work offline.',
    },
    {
      icon: '🇪🇺',
      title: 'EU grant matching',
      desc: 'The local LLM will analyse your startup profile and rank EU funding opportunities by fit score.',
    },
  ]

  return (
    <div className="min-h-screen bg-npu-gradient flex flex-col px-5 py-12 overflow-y-auto">
      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">

        {/* Hero */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="relative flex flex-col items-center mb-8">
          {/* Glow ring */}
          <div className={`absolute w-24 h-24 rounded-full blur-2xl ${isNPU ? 'bg-eu-gold/20' : 'bg-eu-sky/20'}`} />
          <div className={`relative w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-4
            ${isNPU
              ? 'bg-gradient-to-br from-eu-gold/20 to-yellow-500/10 border border-eu-gold/30 shadow-glow-gold'
              : 'bg-gradient-to-br from-eu-sky/20 to-eu-blue/10 border border-eu-sky/30 shadow-glow-blue'}`}>
            {isNPU ? '🧠' : '⚡'}
          </div>
          <h1 className="text-xl font-bold text-white text-center">
            {isNPU ? 'NPU Detected' : 'GPU Ready'}
          </h1>
          <p className="text-eu-muted text-sm mt-1 text-center">
            {caps.gpuName || 'Hardware accelerator'}
          </p>
        </motion.div>

        {/* Hardware badge */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full border mb-8 text-sm font-medium
            ${isNPU
              ? 'bg-eu-gold/10 border-eu-gold/30 text-eu-gold'
              : 'bg-eu-sky/10 border-eu-sky/30 text-eu-sky'}`}>
          <BrainCircuit size={16} />
          <span>{backendLabel}</span>
          {caps.gpuTier === 'high' && <span className="text-xs opacity-70">· High-end tier</span>}
          {caps.deviceMemoryGB && <span className="text-xs opacity-70">· {caps.deviceMemoryGB} GB RAM</span>}
        </motion.div>

        {/* Features */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="glass w-full divide-y divide-white/[0.06] mb-6 overflow-hidden">
          {features.map((f, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + 0.07 * i }}
              className="flex items-start gap-3 px-4 py-4">
              <span className="text-lg mt-0.5 shrink-0">{f.icon}</span>
              <div>
                <p className="text-sm font-medium text-white">{f.title}</p>
                <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Info note */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
          className="flex gap-2.5 w-full bg-white/[0.04] rounded-xl p-3.5 mb-6">
          <Info size={15} className="text-eu-muted shrink-0 mt-0.5" />
          <p className="text-xs text-white/50 leading-relaxed">
            On first use, the AI model will be downloaded (~1.5 GB). This may take a few minutes depending on your connection. After that, everything works offline.
            You can also skip local AI and use the Claude API — configure it in Settings.
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="w-full space-y-3">
          <button className="btn-primary w-full" onClick={handleProceed}>
            Use {isNPU ? 'NPU' : 'GPU'} for AI matching <ChevronRight size={16} />
          </button>
          <button className="btn-ghost w-full text-sm" onClick={handleProceed}>
            Configure API key instead →
          </button>
        </motion.div>
      </div>
    </div>
  )
}
