import Store from 'electron-store';
import type { ProfileData, AppSettings } from './types';

interface StoreSchema {
  profiles: Record<string, ProfileData>;
  settings: AppSettings;
}

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

const store = new Store<StoreSchema>({ schema: profileSchema as Store.Schema<StoreSchema>, name: 'eu-match-data' });

function profileKey(ragioneSociale: string): string {
  return ragioneSociale.trim().toLowerCase().replace(/\s+/g, '_');
}

export function saveProfile(ragioneSociale: string, data: Partial<ProfileData>): void {
  const key = profileKey(ragioneSociale);
  const existing = (store.get(`profiles.${key}` as keyof StoreSchema, {} as ProfileData) ?? {}) as ProfileData;
  store.set(`profiles.${key}` as keyof StoreSchema, {
    ...existing,
    ...data,
    ragioneSociale,
    lastUpdated: new Date().toISOString()
  } as ProfileData);
}

export function loadProfile(ragioneSociale: string): ProfileData | null {
  const key = profileKey(ragioneSociale);
  return (store.get(`profiles.${key}` as keyof StoreSchema, null as unknown as ProfileData) ?? null) as ProfileData | null;
}

export function profileExists(ragioneSociale: string): boolean {
  return loadProfile(ragioneSociale) !== null;
}

export function deleteProfile(ragioneSociale: string): void {
  const key = profileKey(ragioneSociale);
  const profiles = (store.get('profiles', {} as Record<string, ProfileData>)) as Record<string, ProfileData>;
  delete profiles[key];
  store.set('profiles', profiles);
}

export function listProfiles(): Array<{ ragioneSociale: string; lastUpdated: string }> {
  const profiles = (store.get('profiles', {} as Record<string, ProfileData>)) as Record<string, ProfileData>;
  return Object.values(profiles).map(p => ({
    ragioneSociale: p.ragioneSociale,
    lastUpdated: p.lastUpdated ?? ''
  }));
}

export function getSettings(): AppSettings {
  return (store.get('settings', {} as AppSettings)) as AppSettings;
}

export function saveSettings(settings: Partial<AppSettings>): void {
  const current = (store.get('settings', {} as AppSettings)) as AppSettings;
  store.set('settings', { ...current, ...settings });
}
