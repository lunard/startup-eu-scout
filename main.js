'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

// Modules
const storage = require('./src/storage');
const credManager = require('./src/credential-manager');
const profiler = require('./src/startup-profiler');
const copilot = require('./src/copilot-bridge');
const euSearch = require('./src/eu-search');

let mainWindow = null;

// ─── Window Setup ──────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'EU-Match — Scouting Finanziamenti Europei',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC: Storage ──────────────────────────────────────────────────────────────

ipcMain.handle('storage:load', async (_, { ragioneSociale }) => {
  return storage.loadProfile(ragioneSociale);
});

ipcMain.handle('storage:list', async () => {
  return storage.listProfiles();
});

ipcMain.handle('storage:delete', async (_, { ragioneSociale }) => {
  storage.deleteProfile(ragioneSociale);
  return { ok: true };
});

// ─── IPC: Startup Profiler ─────────────────────────────────────────────────────

ipcMain.handle('profiler:build', async (_, { ragioneSociale, url }) => {
  // Check cache first
  const cached = storage.loadProfile(ragioneSociale);
  if (cached && cached.rawText) {
    return { ...cached, fromCache: true };
  }

  const profile = await profiler.buildProfile(ragioneSociale, url);
  storage.saveProfile(ragioneSociale, profile);
  return { ...profile, fromCache: false };
});

// ─── IPC: Copilot CLI ──────────────────────────────────────────────────────────

ipcMain.handle('copilot:health', async () => {
  const settings = storage.getSettings();
  return copilot.healthCheck(settings.copilotPath);
});

ipcMain.handle('copilot:checkModel', async () => {
  const settings = storage.getSettings();
  return copilot.checkModel(settings.copilotPath);
});

ipcMain.handle('copilot:generateScheda', async (event, profile) => {
  const settings = storage.getSettings();
  const sender = event.sender;

  const onChunk = (text) => {
    if (sender && !sender.isDestroyed()) {
      sender.send('copilot:chunk', text);
    }
  };

  try {
    const scheda = await copilot.generateSchedaEU(profile, settings);
    const keywords = await copilot.extractKeywords(scheda, settings);

    // Persist scheda + keywords into profile
    storage.saveProfile(profile.ragioneSociale, { schedaEU: scheda, keywords });

    return { ok: true, schedaEU: scheda, keywords };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ─── IPC: EU Search ────────────────────────────────────────────────────────────

ipcMain.handle('eu:search', async (_, { keywords, options }) => {
  try {
    const results = await euSearch.searchFunding(keywords, options);
    return { ok: true, ...results };
  } catch (err) {
    return { ok: false, error: err.message, results: [] };
  }
});

// ─── IPC: Credentials ─────────────────────────────────────────────────────────

ipcMain.handle('cred:save', async (_, { username, password }) => {
  try {
    credManager.saveCredentials(username, password);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('cred:load', async () => {
  try {
    return { ok: true, data: credManager.loadCredentials() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('cred:clear', async () => {
  credManager.clearCredentials();
  return { ok: true };
});

ipcMain.handle('cred:has', async () => {
  return { ok: true, has: credManager.hasCredentials() };
});

// ─── IPC: Settings ─────────────────────────────────────────────────────────────

ipcMain.handle('settings:get', async () => {
  return storage.getSettings();
});

ipcMain.handle('settings:save', async (_, settings) => {
  storage.saveSettings(settings);
  return { ok: true };
});
