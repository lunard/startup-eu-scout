import Dexie, { type Table } from 'dexie'
import type { StartupProfile, GrantAnalysis, AppSettings } from '@/types'

// ─── Encrypted Storage via Web Crypto API ────────────────────────────────────

const CRYPTO_KEY_NAME = 'eu-scout-key-v1'

async function getOrCreateKey(): Promise<CryptoKey> {
  const stored = localStorage.getItem(CRYPTO_KEY_NAME)
  if (stored) {
    const raw = Uint8Array.from(atob(stored), c => c.charCodeAt(0))
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const exported = await crypto.subtle.exportKey('raw', key)
  localStorage.setItem(CRYPTO_KEY_NAME, btoa(String.fromCharCode(...new Uint8Array(exported))))
  return key
}

export async function encryptString(value: string): Promise<string> {
  const key = await getOrCreateKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(value))
  const buf = new Uint8Array(iv.byteLength + ciphertext.byteLength)
  buf.set(iv, 0)
  buf.set(new Uint8Array(ciphertext), iv.byteLength)
  return btoa(String.fromCharCode(...buf))
}

export async function decryptString(encoded: string): Promise<string> {
  const key = await getOrCreateKey()
  const buf = Uint8Array.from(atob(encoded), c => c.charCodeAt(0))
  const iv = buf.slice(0, 12)
  const ciphertext = buf.slice(12)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(plain)
}

// ─── Dexie Database ───────────────────────────────────────────────────────────

interface EncryptedCredential {
  id: string
  ciphertext: string
}

interface StoredGrant {
  id: string
  profileId: string
  data: string // JSON-serialised GrantResult[]
  savedAt: string
}

class EuScoutDB extends Dexie {
  profiles!: Table<StartupProfile>
  analyses!: Table<GrantAnalysis>
  credentials!: Table<EncryptedCredential>
  grantCache!: Table<StoredGrant>

  constructor() {
    super('eu-scout-db')
    this.version(1).stores({
      profiles:    'id, ragioneSociale, lastUpdated',
      analyses:    '[grantId+profileId], profileId, savedAt',
      credentials: 'id',
      grantCache:  '[id+profileId], profileId, savedAt',
    })
  }
}

export const db = new EuScoutDB()

// ─── Request persistent storage so browser won't evict data ──────────────────
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage?.persist) {
    return navigator.storage.persist()
  }
  return false
}

// ─── Profile helpers ──────────────────────────────────────────────────────────

export async function saveProfile(profile: StartupProfile): Promise<void> {
  await db.profiles.put({ ...profile, lastUpdated: new Date().toISOString() })
}

export async function getProfile(id: string): Promise<StartupProfile | undefined> {
  return db.profiles.get(id)
}

export async function getAllProfiles(): Promise<StartupProfile[]> {
  return db.profiles.orderBy('lastUpdated').reverse().toArray()
}

export async function deleteProfile(id: string): Promise<void> {
  await db.transaction('rw', [db.profiles, db.analyses, db.grantCache], async () => {
    await db.profiles.delete(id)
    await db.analyses.where('profileId').equals(id).delete()
    await db.grantCache.where('profileId').equals(id).delete()
  })
}

// ─── Grant analysis helpers ───────────────────────────────────────────────────

export async function saveAnalysis(analysis: GrantAnalysis): Promise<void> {
  await db.analyses.put(analysis)
}

export async function getAnalysis(grantId: string, profileId: string): Promise<GrantAnalysis | undefined> {
  return db.analyses.get([grantId, profileId])
}

// ─── Credential helpers (encrypted) ──────────────────────────────────────────

export async function saveCredential(id: string, value: string): Promise<void> {
  const ciphertext = await encryptString(value)
  await db.credentials.put({ id, ciphertext })
}

export async function loadCredential(id: string): Promise<string | null> {
  const row = await db.credentials.get(id)
  if (!row) return null
  try { return await decryptString(row.ciphertext) }
  catch { return null }
}

export async function deleteCredential(id: string): Promise<void> {
  await db.credentials.delete(id)
}

// ─── Settings (unencrypted non-secret prefs) ──────────────────────────────────

const SETTINGS_KEY = 'eu-scout-settings'

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? JSON.parse(raw) : { useLlm: 'local', defaultModel: 'Phi-3.5-mini-instruct-q4f16_1-MLC' }
  } catch {
    return { useLlm: 'local', defaultModel: 'Phi-3.5-mini-instruct-q4f16_1-MLC' }
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

// ─── First-run flag ───────────────────────────────────────────────────────────

export const DISCLAIMER_KEY = 'eu-scout-disclaimer-v1'
export const CAPABILITY_KEY = 'eu-scout-capability-accepted-v1'

export function hasAcceptedDisclaimer(): boolean {
  return localStorage.getItem(DISCLAIMER_KEY) === 'true'
}
export function acceptDisclaimer(): void {
  localStorage.setItem(DISCLAIMER_KEY, 'true')
}
export function hasAcceptedCapability(): boolean {
  return localStorage.getItem(CAPABILITY_KEY) === 'true'
}
export function acceptCapability(): void {
  localStorage.setItem(CAPABILITY_KEY, 'true')
}
