import Store from 'electron-store';
import type { ProfileData, AppSettings } from './types';

const profileSchema = {
  profiles: {
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: {
        ragioneSociale: { type: 'string' },
        piva: { type: 'string' },
        ateco: { type: 'string' },
        url: { type: 'string' },
        mission: { type: 'string' },
        keyTechnologies: { type: 'array', items: { type: 'string' } },
        targetMarket: { type: 'string' },
        schedaEU: { type: 'string' },
        keywords: { type: 'array', items: { type: 'string' } },
        lastUpdated: { type: 'string' }
      }
    },
    default: {}
  },
  settings: {
    type: 'object',
    properties: {
      copilotPath: { type: 'string', default: '' },
      defaultModel: { type: 'string', default: 'claude-opus-4.6' }
    },
    default: {}
  }
};

// Use a loose type to allow dot-notation string keys for nested access (e.g. 'profiles.key')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = new Store<Record<string, any>>({ schema: profileSchema as any, name: 'eu-match-data' });

function profileKey(ragioneSociale: string): string {
  return ragioneSociale.trim().toLowerCase().replace(/\s+/g, '_');
}

export function saveProfile(ragioneSociale: string, data: Partial<ProfileData>): void {
  const key = profileKey(ragioneSociale);
  const existing = (store.get(`profiles.${key}`, {}) as ProfileData) ?? {};
  store.set(`profiles.${key}`, {
    ...existing,
    ...data,
    ragioneSociale,
    lastUpdated: new Date().toISOString()
  });
}

export function loadProfile(ragioneSociale: string): ProfileData | null {
  const key = profileKey(ragioneSociale);
  return (store.get(`profiles.${key}`, null) as ProfileData | null) ?? null;
}

export function profileExists(ragioneSociale: string): boolean {
  return loadProfile(ragioneSociale) !== null;
}

export function deleteProfile(ragioneSociale: string): void {
  const key = profileKey(ragioneSociale);
  const profiles = store.get('profiles', {}) as Record<string, ProfileData>;
  delete profiles[key];
  store.set('profiles', profiles);
}

export function listProfiles(): Array<{ ragioneSociale: string; lastUpdated: string }> {
  const profiles = store.get('profiles', {}) as Record<string, ProfileData>;
  return Object.values(profiles).map(p => ({
    ragioneSociale: p.ragioneSociale,
    lastUpdated: p.lastUpdated ?? ''
  }));
}

export function getSettings(): AppSettings {
  return store.get('settings', {}) as AppSettings;
}

export function saveSettings(settings: Partial<AppSettings>): void {
  const current = store.get('settings', {}) as AppSettings;
  store.set('settings', { ...current, ...settings });
}

export function saveGrantAnalysis(ragioneSociale: string, grantId: string, analysis: string, fitScore: number): void {
  const key = profileKey(ragioneSociale);
  store.set(`analyses.${key}.${grantId}`, { analysis, savedAt: new Date().toISOString(), fitScore });
}

export function loadGrantAnalyses(ragioneSociale: string): Record<string, { analysis: string; savedAt: string; fitScore?: number }> {
  const key = profileKey(ragioneSociale);
  return (store.get(`analyses.${key}`, {}) as Record<string, { analysis: string; savedAt: string; fitScore?: number }>);
}
