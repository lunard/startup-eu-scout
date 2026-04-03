import { motion } from 'framer-motion'
import { Building2, Globe, LayoutList, Settings2, ScrollText } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import ProfileTab from './tabs/ProfileTab'
import SummaryTab from './tabs/SummaryTab'
import GrantsTab from './tabs/GrantsTab'
import SettingsTab from './tabs/SettingsTab'
import LogTab from './tabs/LogTab'

const TABS = [
  { id: 'profile',  label: 'Profile',  icon: Building2 },
  { id: 'summary',  label: 'Summary',  icon: Globe },
  { id: 'grants',   label: 'Grants',   icon: LayoutList },
  { id: 'settings', label: 'Settings', icon: Settings2 },
  { id: 'log',      label: 'Log',      icon: ScrollText },
] as const

export default function MainApp() {
  const { activeTab, setActiveTab, logs } = useAppStore()
  const errorCount = logs.filter(l => l.type === 'error').length

  return (
    // h-full relies on html/body/#root height:100% + overflow:hidden chain.
    // No position:fixed/absolute — iOS 26 Safari regresses those.
    // min-h-0 on main is critical: without it flex children won't shrink below content height.
    <div className="h-full flex flex-col bg-eu-navy">

      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-5 pb-3 bg-eu-navy/90 backdrop-blur-md border-b border-white/[0.06]"
        style={{ paddingTop: `max(env(safe-area-inset-top, 0px), 12px)` }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-eu-blue to-eu-sky flex items-center justify-center text-sm">
            🇪🇺
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">EU Scout</h1>
            <p className="text-[10px] text-eu-muted leading-tight">Startup Funding Scout</p>
          </div>
        </div>
        <LlmStatusBadge />
      </header>

      {/* Scrollable tab content — flex-1 + min-h-0 constrains height, overflow-y-auto scrolls */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}>
          {activeTab === 'profile'  && <ProfileTab />}
          {activeTab === 'summary'  && <SummaryTab />}
          {activeTab === 'grants'   && <GrantsTab />}
          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'log'      && <LogTab />}
        </motion.div>
      </main>

      {/* Bottom tab bar — shrink-0 keeps it always in view */}
      <nav className="shrink-0 tab-bar bg-eu-navy/95 backdrop-blur-xl border-t border-white/[0.06]">
        <div className="flex">
          {TABS.map(tab => {
            const active = activeTab === tab.id
            const Icon = tab.icon
            const showBadge = tab.id === 'log' && errorCount > 0
            return (
              <button key={tab.id}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative
                           active:opacity-70 transition-opacity duration-100 select-none"
                onClick={() => setActiveTab(tab.id as any)}>
                <div className="relative">
                  <Icon size={20} className={`transition-colors duration-200 ${active ? 'text-eu-gold' : 'text-eu-muted'}`} />
                  {showBadge && (
                    <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                      {errorCount > 9 ? '9+' : errorCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-medium transition-colors duration-200 ${active ? 'text-eu-gold' : 'text-eu-muted'}`}>
                  {tab.label}
                </span>
                {active && (
                  <motion.div layoutId="tab-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-eu-gold rounded-full" />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function LlmStatusBadge() {
  const { llmReady, llmLoading, llmProgress, capabilities } = useAppStore()
  if (llmLoading) return (
    <div className="flex items-center gap-1.5 bg-eu-sky/10 border border-eu-sky/20 rounded-full px-2.5 py-1">
      <div className="w-2 h-2 rounded-full bg-eu-sky animate-pulse-slow" />
      <span className="text-[10px] text-eu-sky font-medium">{Math.round(llmProgress)}%</span>
    </div>
  )
  if (llmReady) return (
    <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-1">
      <div className="w-2 h-2 rounded-full bg-green-400" />
      <span className="text-[10px] text-green-400 font-medium">
        {capabilities?.npuAvailable ? 'NPU' : 'GPU'} ready
      </span>
    </div>
  )
  return (
    <div className="flex items-center gap-1.5 bg-white/[0.05] border border-white/10 rounded-full px-2.5 py-1">
      <div className="w-2 h-2 rounded-full bg-white/30" />
      <span className="text-[10px] text-white/40 font-medium">AI offline</span>
    </div>
  )
}
