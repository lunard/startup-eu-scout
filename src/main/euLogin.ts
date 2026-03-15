import { safeStorage } from 'electron';
import Store from 'electron-store';

interface StoreSchema {
  euLoginEmail: string;
  euLoginPasswordEncrypted: string;
}

const store = new Store<StoreSchema>();

const EU_LOGIN_EMAIL_KEY = 'euLoginEmail';
const EU_LOGIN_PASSWORD_KEY = 'euLoginPasswordEncrypted';

/**
 * Saves EU Login credentials to secure, OS-native encrypted storage.
 * Passwords are encrypted using Electron's safeStorage (Keychain on macOS,
 * DPAPI on Windows) and stored as base64-encoded encrypted buffers.
 * Plain-text credential storage is strictly prohibited.
 *
 * @param email - The EU Login account email address
 * @param password - The plain-text password to encrypt and store
 */
export function saveEuLoginCredentials(email: string, password: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'OS-level encryption is not available on this system. ' +
        'Cannot securely store EU Login credentials.'
    );
  }

  const encryptedBuffer = safeStorage.encryptString(password);
  const encryptedBase64 = encryptedBuffer.toString('base64');

  store.set(EU_LOGIN_EMAIL_KEY, email);
  store.set(EU_LOGIN_PASSWORD_KEY, encryptedBase64);
}

/**
 * Retrieves stored EU Login credentials, decrypting the password using
 * OS-native APIs.
 *
 * @returns Object with email and decrypted password, or null if no credentials stored
 */
export function getEuLoginCredentials(): { email: string; password: string } | null {
  const email = store.get(EU_LOGIN_EMAIL_KEY) as string | undefined;
  const encryptedBase64 = store.get(EU_LOGIN_PASSWORD_KEY) as string | undefined;

  if (!email || !encryptedBase64) {
    return null;
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'OS-level encryption is not available on this system. ' +
        'Cannot decrypt EU Login credentials.'
    );
  }

  const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');
  const password = safeStorage.decryptString(encryptedBuffer);

  return { email, password };
}

/**
 * Checks whether EU Login credentials have been stored.
 */
export function hasEuLoginCredentials(): boolean {
  return store.has(EU_LOGIN_EMAIL_KEY) && store.has(EU_LOGIN_PASSWORD_KEY);
}

/**
 * Removes stored EU Login credentials from both encrypted and general storage.
 */
export function clearEuLoginCredentials(): void {
  store.delete(EU_LOGIN_EMAIL_KEY);
  store.delete(EU_LOGIN_PASSWORD_KEY);
}
