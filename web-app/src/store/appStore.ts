import { create } from 'zustand'
import type { AppScreen, DeviceCapabilities, LogEntry, StartupProfile, GrantResult, AppSettings } from '@/types'
import { loadSettings, saveSettings, hasAcceptedDisclaimer } from '@/lib/storage'

// ─── App Store ────────────────────────────────────────────────────────────────

interface AppState {
  // Navigation
  screen: AppScreen
  activeTab: 'profile' | 'summary' | 'grants' | 'settings' | 'log'
  setScreen: (s: AppScreen) => void
  setActiveTab: (t: AppState['activeTab']) => void

  // Device capabilities
  capabilities: DeviceCapabilities | null
  setCapabilities: (c: DeviceCapabilities) => void

  // Profile
  profile: StartupProfile | null
  setProfile: (p: StartupProfile | null) => void

  // Grants
  grants: GrantResult[]
  setGrants: (g: GrantResult[]) => void
  selectedGrantIds: Set<string>
  toggleGrantSelection: (id: string) => void
  selectAllGrants: () => void
  deselectAllGrants: () => void

  // LLM loading
  llmReady: boolean
  llmLoading: boolean
  llmProgress: number
  llmStatusText: string
  setLlmStatus: (ready: boolean, loading: boolean, progress: number, text: string) => void

  // Settings
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void

  // Log
  logs: LogEntry[]
  addLog: (type: LogEntry['type'], message: string) => void
  clearLogs: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Start at 'app' immediately if user already accepted disclaimer — no flash through device-check screens
  screen: hasAcceptedDisclaimer() ? 'app' : 'device-check',
  activeTab: 'profile',
  setScreen: (screen) => set({ screen }),
  setActiveTab: (activeTab) => set({ activeTab }),

  capabilities: null,
  setCapabilities: (capabilities) => set({ capabilities }),

  profile: null,
  setProfile: (profile) => set({ profile }),

  grants: [],
  setGrants: (grants) => set({ grants, selectedGrantIds: new Set(grants.map(g => g.id)) }),
  selectedGrantIds: new Set(),
  toggleGrantSelection: (id) => {
    const next = new Set(get().selectedGrantIds)
    next.has(id) ? next.delete(id) : next.add(id)
    set({ selectedGrantIds: next })
  },
  selectAllGrants: () => set({ selectedGrantIds: new Set(get().grants.map(g => g.id)) }),
  deselectAllGrants: () => set({ selectedGrantIds: new Set() }),

  llmReady: false,
  llmLoading: false,
  llmProgress: 0,
  llmStatusText: '',
  setLlmStatus: (llmReady, llmLoading, llmProgress, llmStatusText) =>
    set({ llmReady, llmLoading, llmProgress, llmStatusText }),

  settings: loadSettings(),
  updateSettings: (patch) => {
    const next = { ...get().settings, ...patch }
    saveSettings(next)
    set({ settings: next })
  },

  logs: [],
  addLog: (type, message) => {
    const entry: LogEntry = { id: crypto.randomUUID(), type, message, timestamp: new Date() }
    set(s => ({ logs: [entry, ...s.logs].slice(0, 500) }))
  },
  clearLogs: () => set({ logs: [] }),
}))
