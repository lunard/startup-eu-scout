/**
 * Manual mock for the 'electron' module used in Jest tests.
 * Replaces Electron-specific APIs with controlled test doubles.
 */

const safeStorage = {
  isEncryptionAvailable: jest.fn(() => true),
  encryptString: jest.fn((str: string): Buffer => Buffer.from(`encrypted:${str}`)),
  decryptString: jest.fn((buf: Buffer): string => buf.toString().replace(/^encrypted:/, '')),
};

const app = {
  getPath: jest.fn((name: string) => `/tmp/test-userData-${name}`),
  quit: jest.fn(),
  whenReady: jest.fn(() => Promise.resolve()),
  on: jest.fn(),
};

const ipcMain = {
  handle: jest.fn(),
};

const BrowserWindowInstance = {
  loadFile: jest.fn(),
  once: jest.fn(),
  on: jest.fn(),
  show: jest.fn(),
};

const BrowserWindow = Object.assign(jest.fn().mockImplementation(() => BrowserWindowInstance), {
  getAllWindows: jest.fn(() => []),
});

const dialog = {
  showErrorBox: jest.fn(),
  showMessageBox: jest.fn(() => Promise.resolve({ response: 0 })),
};

module.exports = {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
  dialog,
};
