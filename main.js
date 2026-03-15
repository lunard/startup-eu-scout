'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

// Modules
const storage = require('./src/storage');
const credManager = require('./src/credential-manager');
const profiler = require('./src/startup-profiler');
const copilot = require('./src/copilot-bridge');
const euSearch = require('./src/eu-search');
const euAuth   = require('./src/eu-auth');

let mainWindow = null;

// ─── App Logger (main → renderer) ─────────────────────────────────────────────
function sendLog(level, message, detail = '') {
  if (mainWindow && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('log:push', { level, message, detail, ts: Date.now() });
  }
}

// ─── Window Setup ──────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1254,
    height: 1040,
    minWidth: 941,
    minHeight: 780,
    title: 'EU-Match — Scouting Finanziamenti Europei',
    icon: path.join(__dirname, 'assets', process.platform === 'darwin' ? 'icon.icns' : 'icon.png'),
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
  if (process.platform === 'darwin') {
    app.dock.setIcon(path.join(__dirname, 'assets', 'icon.png'));
  }
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

ipcMain.handle('storage:update', async (_, { ragioneSociale, data }) => {
  if (!ragioneSociale) return { ok: false };
  storage.saveProfile(ragioneSociale, data);
  return { ok: true };
});

// ─── IPC: Startup Profiler ─────────────────────────────────────────────────────

ipcMain.handle('profiler:build', async (event, { ragioneSociale, url }) => {
  const send = (icon, msg) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('profiler:progress', { icon, msg, ts: Date.now() });
    }
    sendLog('info', `[Profiler] ${msg}`);
  };

  send('⏳', 'Verifica cache locale…');
  const cached = storage.loadProfile(ragioneSociale);
  if (cached && cached.rawText) {
    if (url && url !== cached.url) {
      storage.saveProfile(ragioneSociale, { url });
      cached.url = url;
    }
    send('✅', 'Profilo caricato dalla cache.');
    sendLog('storage', `Profilo "${ragioneSociale}" caricato dalla cache locale.`);
    return { ...cached, fromCache: true };
  }

  try {
    const profile = await profiler.buildProfile(ragioneSociale, url, send);
    storage.saveProfile(ragioneSociale, profile);
    send('✅', 'Profilazione completata e salvata.');
    sendLog('success', `Profilazione "${ragioneSociale}" completata.`, `URL: ${url || '—'}`);
    return { ...profile, fromCache: false };
  } catch (err) {
    send('❌', `Errore: ${err.message}`);
    sendLog('error', `Errore profiler: ${err.message}`);
    throw err;
  }
});

// ─── IPC: Copilot CLI ──────────────────────────────────────────────────────────

ipcMain.handle('copilot:health', async () => {
  const settings = storage.getSettings();
  const result = await copilot.healthCheck(settings.copilotPath);
  sendLog(result.ok ? 'success' : 'warn', `Copilot health check: ${result.version || result.error || '?'}`, result.ok ? '' : result.error);
  return result;
});

ipcMain.handle('copilot:checkModel', async () => {
  const settings = storage.getSettings();
  const result = await copilot.checkModel(settings.copilotPath);
  sendLog('info', `Modello Copilot attivo: ${result.currentModel || '?'} — richiesto: ${result.required || '?'}`);
  return result;
});

ipcMain.handle('copilot:generateScheda', async (event, profile) => {
  const settings = storage.getSettings();
  const sender = event.sender;

  sendLog('copilot', `Avvio generazione Scheda EU per "${profile.ragioneSociale}"…`);

  const onChunk = (text) => {
    if (sender && !sender.isDestroyed()) {
      sender.send('copilot:chunk', text);
    }
  };

  try {
    const scheda = await copilot.generateSchedaEU(profile, settings, onChunk);
    const keywords = await copilot.extractKeywords(scheda, settings);
    storage.saveProfile(profile.ragioneSociale, { schedaEU: scheda, keywords });
    sendLog('success', `Scheda EU generata per "${profile.ragioneSociale}".`, `${keywords.length} keywords estratte: ${keywords.join(', ')}`);
    return { ok: true, schedaEU: scheda, keywords };
  } catch (err) {
    sendLog('error', `Errore generazione Scheda: ${err.message}`);
    return { ok: false, error: err.message };
  }
});

// ─── IPC: EU Search ────────────────────────────────────────────────────────────

ipcMain.handle('eu:search', async (_, { keywords, options }) => {
  sendLog('api', `Ricerca EU API avviata.`, `Keywords: ${keywords.join(', ')}`);
  try {
    const results = await euSearch.searchFunding(keywords, options);
    sendLog('success', `EU API: ${results.total} risultati trovati.`,
      `Payload: ${JSON.stringify(results.payload || {})}`);
    return { ok: true, ...results };
  } catch (err) {
    sendLog('error', `EU API errore: ${err.message}`,
      err.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data).substring(0, 300)}` : '');
    return { ok: false, error: err.message, results: [] };
  }
});

// ─── IPC: EU Auth / Connectivity ───────────────────────────────────────────────

ipcMain.handle('eu:testAuth', async () => {
  sendLog('api', 'Test credenziali EU Login in corso…');
  const creds = credManager.loadCredentials();
  if (!creds) {
    sendLog('warn', 'Nessuna credenziale EU Login salvata.');
    return { ok: false, error: 'Nessuna credenziale salvata. Salvale prima nelle Impostazioni.' };
  }
  const result = await euAuth.testEuLoginCredentials(creds.username, creds.password);
  sendLog(result.ok ? 'success' : 'error',
    result.ok ? `EU Login OK per ${creds.username}` : `EU Login fallito: ${result.error}`);
  return result;
});

ipcMain.handle('eu:testConnectivity', async () => {
  sendLog('api', 'Test connettività EU API in corso…');
  const result = await euAuth.testApiConnectivity();
  sendLog(result.ok ? 'success' : 'error', result.message, `HTTP status: ${result.status}`);
  return result;
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
