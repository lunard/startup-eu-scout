import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Eye, Server, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { acceptDisclaimer } from '@/lib/storage'

export default function DisclaimerScreen() {
  const { setScreen } = useAppStore()
  const [expanded, setExpanded] = useState<number | null>(null)
  const [accepted, setAccepted] = useState(false)

  function handleContinue() {
    acceptDisclaimer()
    setScreen('capability')
  }

  const sections = [
    {
      icon: <Server size={18} className="text-eu-sky" />,
      title: 'No server — no cloud',
      body: 'EU Scout runs entirely in your browser. Your startup data, API keys, and grant analyses are stored exclusively in your device\'s encrypted IndexedDB using the Web Crypto API (AES-256-GCM). Nothing is ever transmitted to any server operated by us.',
    },
    {
      icon: <Eye size={18} className="text-eu-sky" />,
      title: 'Zero tracking',
      body: 'We have no analytics, no telemetry, no cookies, no tracking pixels. There is no back-end, no account, no registration. We literally cannot see you.',
    },
    {
      icon: <Shield size={18} className="text-eu-sky" />,
      title: 'AI runs on your device',
      body: 'When using the local LLM feature, the AI model is downloaded once and runs entirely on your GPU/NPU. If you choose to use the Claude API, your prompts go to Anthropic\'s servers under their privacy policy — you control that choice in Settings.',
    },
    {
      icon: <AlertTriangle size={18} className="text-yellow-400" />,
      title: '"AS IS" — no warranty',
      body: 'EU Scout is provided "as is" without warranty of any kind. Grant information is sourced from the EU Funding & Tenders Portal and may be outdated or incomplete. Always verify eligibility directly on the official EU portal before applying. This app is a scouting tool, not legal or financial advice.',
    },
  ]

  return (
    <div className="min-h-screen bg-eu-gradient flex flex-col px-5 py-safe overflow-y-auto">
      <div className="flex-1 flex flex-col items-center justify-center py-10 max-w-md mx-auto w-full">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-eu-blue/80 to-eu-sky/50 border border-eu-sky/30 flex items-center justify-center text-2xl mb-4 mx-auto">
            🔒
          </div>
          <h1 className="text-xl font-bold text-white">Before you start</h1>
          <p className="text-eu-muted text-sm mt-2 leading-relaxed">
            Please read how EU Scout handles your data — it's short and important.
          </p>
        </motion.div>

        {/* Sections */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="glass w-full divide-y divide-white/[0.07] overflow-hidden mb-6">
          {sections.map((s, i) => (
            <div key={i}>
              <button
                className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-white/5 transition-colors"
                onClick={() => setExpanded(expanded === i ? null : i)}>
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                  {s.icon}
                </div>
                <p className="flex-1 text-sm font-medium text-white">{s.title}</p>
                {expanded === i
                  ? <ChevronUp size={16} className="text-eu-muted shrink-0" />
                  : <ChevronDown size={16} className="text-eu-muted shrink-0" />}
              </button>
              <AnimatePresence>
                {expanded === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden">
                    <p className="px-4 pb-4 text-xs text-white/60 leading-relaxed">
                      {s.body}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </motion.div>

        {/* Acceptance checkbox */}
        <motion.label
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="flex items-start gap-3 w-full cursor-pointer mb-6 select-none">
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 shrink-0 transition-all duration-150
            ${accepted ? 'bg-eu-gold border-eu-gold' : 'border-white/30 bg-white/5'}`}
            onClick={() => setAccepted(!accepted)}>
            {accepted && <svg className="w-3 h-3 text-eu-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>}
          </div>
          <p className="text-sm text-white/70 leading-relaxed" onClick={() => setAccepted(!accepted)}>
            I understand that EU Scout is provided "as is", runs locally with no data leaving my device, and is not a substitute for professional legal or financial advice.
          </p>
        </motion.label>

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="w-full">
          <button
            className={`btn-primary w-full transition-all ${!accepted ? 'opacity-40 cursor-not-allowed' : ''}`}
            disabled={!accepted}
            onClick={handleContinue}>
            I understand — let's go 🚀
          </button>
        </motion.div>
      </div>
    </div>
  )
}
