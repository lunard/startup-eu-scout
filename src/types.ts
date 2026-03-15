export interface ProfileData {
  ragioneSociale: string;
  url?: string;
  piva?: string;
  jurisdiction?: string;
  incorporatedOn?: string;
  registryUrl?: string;
  pageTitle?: string;
  description?: string;
  rawText?: string;
  scrapedAt?: string;
  schedaEU?: string;
  keywords?: string[];
  lastUpdated?: string;
  fromCache?: boolean;
}

export interface AppSettings {
  copilotPath?: string;
  defaultModel?: string;
}

export interface HealthCheckResult {
  ok: boolean;
  version?: string;
  bin?: string;
  error?: string;
}

export interface ModelCheckResult {
  currentModel: string;
  isOpus: boolean | null;
  required: string;
}

export interface SearchResult {
  id: string;
  title: string;
  status: string;
  deadline: string;
  programme: string;
  budget: string;
  description: string;
  portalUrl: string;
  matchingScore: number;
}

export interface SearchResponse {
  total: number;
  results: SearchResult[];
  pageSize: number;
  pageNumber: number;
  requestText?: string;
}

export interface CredentialData {
  username: string;
  password: string;
}

export interface AuthTestResult {
  ok: boolean;
  message?: string;
  error?: string;
  tgtUrl?: string;
  status?: number;
}

export interface ConnectivityResult {
  ok: boolean;
  status: number;
  message: string;
}

export interface LogEntry {
  level: string;
  message: string;
  detail?: string;
  ts: number;
}

export interface ProgressEvent {
  icon: string;
  msg: string;
  ts: number;
}
