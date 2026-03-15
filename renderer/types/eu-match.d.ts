// Type declarations for the contextBridge-exposed euMatch API and marked global.

declare global {
  interface ProfileData {
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

  interface AppSettings {
    copilotPath?: string;
    defaultModel?: string;
  }

  interface SearchResult {
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

  interface ProgressEvent {
    icon: string;
    msg: string;
    ts: number;
  }

  interface LogEntry {
    level: string;
    message: string;
    detail?: string;
    ts: number;
  }

  interface EuMatchAPI {
    buildProfile(ragioneSociale: string, url: string): Promise<ProfileData & { fromCache: boolean }>;
    loadProfile(ragioneSociale: string): Promise<ProfileData | null>;
    listProfiles(): Promise<Array<{ ragioneSociale: string; lastUpdated: string }>>;
    deleteProfile(ragioneSociale: string): Promise<{ ok: boolean }>;
    updateProfile(ragioneSociale: string, data: Partial<ProfileData>): Promise<{ ok: boolean }>;
    copilotHealthCheck(): Promise<{ ok: boolean; version?: string; error?: string }>;
    copilotCheckModel(): Promise<{ currentModel: string; isOpus: boolean | null; required: string }>;
    generateSchedaEU(profile: ProfileData): Promise<{ ok: boolean; schedaEU?: string; keywords?: string[]; error?: string }>;
    searchFunding(keywords: string[], options?: Record<string, unknown>): Promise<{ ok: boolean; total?: number; results?: SearchResult[]; error?: string }>;
    analyzeBando(bando: SearchResult, ragioneSociale: string): Promise<{ ok: boolean; analysis?: string; error?: string }>;
    loadBandoAnalyses(ragioneSociale: string): Promise<Record<string, { analysis: string; savedAt: string }>>;
    saveCredentials(username: string, password: string): Promise<{ ok: boolean; error?: string }>;
    loadCredentials(): Promise<{ ok: boolean; data?: { username: string } | null }>;
    clearCredentials(): Promise<{ ok: boolean }>;
    hasCredentials(): Promise<{ ok: boolean; has: boolean }>;
    getSettings(): Promise<AppSettings>;
    saveSettings(settings: AppSettings): Promise<{ ok: boolean }>;
    testEuAuth(): Promise<{ ok: boolean; error?: string; message?: string }>;
    testEuConnectivity(): Promise<{ ok: boolean; status: number; message: string }>;
    onProfileProgress(callback: (data: ProgressEvent) => void): void;
    removeProfileProgressListener(): void;
    onCopilotChunk(callback: (text: string) => void): void;
    removeCopilotChunkListener(): void;
    onLog(callback: (entry: LogEntry) => void): void;
    removeLogListener(): void;
  }

  interface Window {
    euMatch: EuMatchAPI;
    marked?: { parse(src: string): string };
  }
}

export {};
