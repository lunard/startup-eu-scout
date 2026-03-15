'use strict';

const { safeStorage } = require('electron');
const Store = require('electron-store');

const credStore = new Store({ name: 'eu-match-credentials' });

const CRED_KEY = 'euLogin';

function isEncryptionAvailable() {
  return safeStorage.isEncryptionAvailable();
}

function saveCredentials(username, password) {
  if (!isEncryptionAvailable()) {
    throw new Error('Sistema di cifratura OS non disponibile. Impossibile salvare credenziali.');
  }
  const payload = JSON.stringify({ username, password });
  const encrypted = safeStorage.encryptString(payload);
  credStore.set(CRED_KEY, encrypted.toString('base64'));
}

function loadCredentials() {
  if (!isEncryptionAvailable()) return null;
  const stored = credStore.get(CRED_KEY, null);
  if (!stored) return null;
  try {
    const buffer = Buffer.from(stored, 'base64');
    const decrypted = safeStorage.decryptString(buffer);
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

function clearCredentials() {
  credStore.delete(CRED_KEY);
}

function hasCredentials() {
  return credStore.has(CRED_KEY);
}

module.exports = { saveCredentials, loadCredentials, clearCredentials, hasCredentials, isEncryptionAvailable };
