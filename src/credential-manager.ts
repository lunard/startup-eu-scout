import { safeStorage } from 'electron';
import Store from 'electron-store';
import type { CredentialData } from './types';

const credStore = new Store({ name: 'eu-match-credentials' });
const CRED_KEY = 'euLogin';

function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export function saveCredentials(username: string, password: string): void {
  if (!isEncryptionAvailable()) {
    throw new Error('Sistema di cifratura OS non disponibile. Impossibile salvare credenziali.');
  }
  const payload = JSON.stringify({ username, password });
  const encrypted = safeStorage.encryptString(payload);
  credStore.set(CRED_KEY, encrypted.toString('base64'));
}

export function loadCredentials(): CredentialData | null {
  if (!isEncryptionAvailable()) return null;
  const stored = credStore.get(CRED_KEY, null) as string | null;
  if (!stored) return null;
  try {
    const buffer = Buffer.from(stored, 'base64');
    const decrypted = safeStorage.decryptString(buffer);
    return JSON.parse(decrypted) as CredentialData;
  } catch {
    return null;
  }
}

export function clearCredentials(): void {
  credStore.delete(CRED_KEY);
}

export function hasCredentials(): boolean {
  return credStore.has(CRED_KEY);
}

export { isEncryptionAvailable };
