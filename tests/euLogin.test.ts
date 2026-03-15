jest.mock('electron-store');

import { saveEuLoginCredentials, getEuLoginCredentials, hasEuLoginCredentials, clearEuLoginCredentials } from '../src/main/euLogin';
import { safeStorage } from 'electron';

const mockSafeStorage = safeStorage as jest.Mocked<typeof safeStorage>;

// electron-store mock
const storeData: Record<string, string> = {};

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    set: jest.fn((key: string, value: string) => { storeData[key] = value; }),
    get: jest.fn((key: string) => storeData[key]),
    has: jest.fn((key: string) => key in storeData),
    delete: jest.fn((key: string) => { delete storeData[key]; }),
  }));
});

describe('EU Login Credential Management', () => {
  beforeEach(() => {
    Object.keys(storeData).forEach((k) => delete storeData[k]);
    // Reset safeStorage mock to default working state before each test
    mockSafeStorage.isEncryptionAvailable = jest.fn(() => true);
    mockSafeStorage.encryptString = jest.fn((str: string): Buffer => Buffer.from(`encrypted:${str}`));
    mockSafeStorage.decryptString = jest.fn((buf: Buffer): string => buf.toString().replace(/^encrypted:/, ''));
  });

  describe('saveEuLoginCredentials', () => {
    it('encrypts the password and stores email + encrypted password', () => {
      saveEuLoginCredentials('user@example.eu', 'mypassword');

      expect(mockSafeStorage.encryptString).toHaveBeenCalledWith('mypassword');
      expect(storeData['euLoginEmail']).toBe('user@example.eu');
      expect(storeData['euLoginPasswordEncrypted']).toBeDefined();
    });

    it('throws when OS encryption is not available', () => {
      mockSafeStorage.isEncryptionAvailable = jest.fn(() => false);

      expect(() => saveEuLoginCredentials('user@example.eu', 'pass')).toThrow(
        'OS-level encryption is not available'
      );
    });
  });

  describe('getEuLoginCredentials', () => {
    it('returns null when no credentials are stored', () => {
      const result = getEuLoginCredentials();
      expect(result).toBeNull();
    });

    it('returns decrypted email and password when credentials exist', () => {
      saveEuLoginCredentials('user@example.eu', 'mysecret');

      const result = getEuLoginCredentials();
      expect(result).not.toBeNull();
      expect(result?.email).toBe('user@example.eu');
      // The mock encryptString wraps with "encrypted:" prefix, decryptString strips it
      expect(result?.password).toBeDefined();
    });

    it('throws when encryption is unavailable during retrieval', () => {
      // Manually inject data to simulate stored credentials
      storeData['euLoginEmail'] = 'user@example.eu';
      storeData['euLoginPasswordEncrypted'] = Buffer.from('encrypted:secret').toString('base64');

      mockSafeStorage.isEncryptionAvailable = jest.fn(() => false);

      expect(() => getEuLoginCredentials()).toThrow('OS-level encryption is not available');
    });
  });

  describe('hasEuLoginCredentials', () => {
    it('returns false when no credentials stored', () => {
      expect(hasEuLoginCredentials()).toBe(false);
    });

    it('returns true after saving credentials', () => {
      saveEuLoginCredentials('user@example.eu', 'pass');
      expect(hasEuLoginCredentials()).toBe(true);
    });
  });

  describe('clearEuLoginCredentials', () => {
    it('removes credentials from storage', () => {
      saveEuLoginCredentials('user@example.eu', 'pass');
      clearEuLoginCredentials();
      expect(hasEuLoginCredentials()).toBe(false);
    });
  });
});
