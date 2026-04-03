// ─── Domain Types ────────────────────────────────────────────────────────────

export interface StartupProfile {
  id: string
  ragioneSociale: string
  url?: string
  piva?: string
  jurisdiction?: string
  incorporatedOn?: string
  registryUrl?: string
  pageTitle?: string
  description?: string
  rawText?: string
  schedaEU?: string
  keywords?: string[]
  lastUpdated?: string
}

export interface GrantResult {
  id: string
  title: string
  status: 'open' | 'forthcoming' | 'closed'
  deadline?: string
  openDate?: string
  programme: string
  budget?: string
  description: string
  fullDescription?: string
  duration?: string
  typeOfAction?: string
  portalUrl: string
  detailUrl?: string
  matchingScore: number
  fitScore?: number
  fitExplanation?: string
  cachedAt?: string
}

export interface GrantAnalysis {
  grantId: string
  profileId: string
  analysis: string
  fitScore?: number
  savedAt: string
}

export interface AppSettings {
  claudeApiKey?: string
  openCorporatesKey?: string
  useLlm: 'local' | 'claude' | 'none'
  defaultModel: string
}

// ─── Device Capability Types ─────────────────────────────────────────────────

export type InferenceBackend = 'npu' | 'gpu' | 'cpu-wasm'

export interface DeviceCapabilities {
  supported: boolean
  backend: InferenceBackend | null
  gpuName?: string
  gpuTier?: 'high' | 'mid' | 'low'
  hasWebGPU: boolean
  hasWebNN: boolean
  npuAvailable: boolean
  deviceMemoryGB?: number
  reason?: string
}

// ─── App State ────────────────────────────────────────────────────────────────

export type AppScreen = 'device-check' | 'disclaimer' | 'capability' | 'app'

export interface LogEntry {
  id: string
  type: 'info' | 'success' | 'warn' | 'error' | 'api' | 'llm' | 'storage'
  message: string
  timestamp: Date
}

// ─── LLM Types ────────────────────────────────────────────────────────────────

export interface LlmLoadProgress {
  stage: 'fetching' | 'loading' | 'ready'
  progress: number
  text: string
}
