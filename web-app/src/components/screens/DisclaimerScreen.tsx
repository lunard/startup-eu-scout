import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/store/appStore'
import { acceptDisclaimer, acceptCapability } from '@/lib/storage'

export default function DisclaimerScreen() {
  const { setScreen, capabilities } = useAppStore()
  const [accepted, setAccepted] = useState(false)

  function handleContinue() {
    acceptDisclaimer()
    acceptCapability()
    setScreen('app')
  }

  const isNPU = capabilities?.npuAvailable
  const backendLabel = isNPU ? 'NPU' : 'WebGPU'
  const gpuName = capabilities?.gpuName ?? 'your GPU'

  return (
    <div className="h-full bg-eu-gradient flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-8 max-w-md mx-auto w-full flex flex-col gap-5">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
            className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-eu-blue/80 to-eu-sky/50 border border-eu-sky/30 flex items-center justify-center text-2xl mb-3 mx-auto">
              🇪🇺
            </div>
            <h1 className="text-xl font-bold text-white">EU Scout</h1>
            <p className="text-eu-muted text-sm mt-1">AI-powered EU funding scout — runs on your device</p>
          </motion.div>

          {/* Hardware detected */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className={`glass p-4 flex items-center gap-3 border ${isNPU ? 'border-eu-gold/30' : 'border-eu-sky/30'}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0
              ${isNPU ? 'bg-eu-gold/10' : 'bg-eu-sky/10'}`}>
              {isNPU ? '🧠' : '⚡'}
            </div>
            <div>
              <p className={`text-sm font-semibold ${isNPU ? 'text-eu-gold' : 'text-eu-sky'}`}>
                {isNPU ? 'NPU detected' : 'GPU ready'} — {backendLabel} acceleration
              </p>
              <p className="text-xs text-eu-muted truncate">{gpuName}</p>
            </div>
          </motion.div>

          {/* Privacy bullets */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
            className="glass divide-y divide-white/[0.07] overflow-hidden">
            {[
              { emoji: '🔒', title: 'No server, no cloud', body: 'Everything stays in your browser — data is encrypted with AES-256-GCM and never transmitted anywhere.' },
              { emoji: '👁️', title: 'Zero tracking', body: 'No analytics, no cookies, no telemetry. We have no back-end and cannot see you.' },
              { emoji: '🤖', title: 'AI runs on your device', body: 'The LLM runs on your GPU/NPU locally. If you use Claude API, prompts go to Anthropic under their policy — your choice in Settings.' },
              { emoji: '⚠️', title: '"As Is" — no warranty', body: 'Grant data comes from the EU portal and may be incomplete. This is a scouting tool, not legal or financial advice.' },
            ].map((item, i) => (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                <span className="text-base mt-0.5 shrink-0">{item.emoji}</span>
                <div>
                  <p className="text-xs font-semibold text-white mb-0.5">{item.title}</p>
                  <p className="text-xs text-white/50 leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Checkbox + CTA */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="flex flex-col gap-4">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 shrink-0 transition-all duration-150
                  ${accepted ? 'bg-eu-gold border-eu-gold' : 'border-white/30 bg-white/5'}`}
                onClick={() => setAccepted(v => !v)}>
                {accepted && (
                  <svg className="w-3 h-3 text-eu-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <p className="text-sm text-white/70 leading-relaxed" onClick={() => setAccepted(v => !v)}>
                I understand EU Scout is provided "as is", runs locally with no data leaving my device, and is not a substitute for professional advice.
              </p>
            </label>

            <button
              className={`btn-primary w-full transition-all ${!accepted ? 'opacity-40 cursor-not-allowed' : ''}`}
              disabled={!accepted}
              onClick={handleContinue}>
              Let's go 🚀
            </button>
          </motion.div>

        </div>
      </div>
    </div>
  )
}
