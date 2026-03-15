import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import * as storage from './storage';
import * as credManager from './credential-manager';
import * as profiler from './startup-profiler';
import * as copilot from './copilot-bridge';
import * as euSearch from './eu-search';
import * as euAuth from './eu-auth';
import type { ProfileData, AppSettings, SearchResult } from './types';

let mainWindow: BrowserWindow | null = null;

function sendLog(level: string, message: string, detail = ''): void {
  if (mainWindow && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('log:push', { level, message, detail, ts: Date.now() });
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1254,
    height: 1040,
    minWidth: 941,
    minHeight: 780,
    title: 'EU-Match — Scouting Finanziamenti Europei',
    icon: path.join(__dirname, '..', 'assets', process.platform === 'darwin' ? 'icon.icns' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock?.setIcon(path.join(__dirname, '..', 'assets', 'icon.png'));
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('storage:load', async (_event, { ragioneSociale }: { ragioneSociale: string }) =>
  storage.loadProfile(ragioneSociale)
);

ipcMain.handle('storage:list', async () => storage.listProfiles());

ipcMain.handle('storage:delete', async (_event, { ragioneSociale }: { ragioneSociale: string }) => {
  storage.deleteProfile(ragioneSociale);
  return { ok: true };
});

ipcMain.handle('storage:update', async (_event, { ragioneSociale, data }: { ragioneSociale: string; data: Partial<ProfileData> }) => {
  if (!ragioneSociale) return { ok: false };
  storage.saveProfile(ragioneSociale, data);
  return { ok: true };
});

ipcMain.handle('profiler:build', async (event, { ragioneSociale, url }: { ragioneSociale: string; url: string }) => {
  const send = (icon: string, msg: string): void => {
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
    const message = err instanceof Error ? err.message : String(err);
    send('❌', `Errore: ${message}`);
    sendLog('error', `Errore profiler: ${message}`);
    throw err;
  }
});

ipcMain.handle('copilot:health', async () => {
  const settings = storage.getSettings();
  const result = await copilot.healthCheck(settings.copilotPath);
  sendLog(
    result.ok ? 'success' : 'warn',
    `Copilot health check: ${result.version ?? result.error ?? '?'}`,
    result.ok ? '' : (result.error ?? '')
  );
  return result;
});

ipcMain.handle('copilot:checkModel', async () => {
  const settings = storage.getSettings();
  const result = await copilot.checkModel(settings.copilotPath);
  sendLog('info', `Modello Copilot attivo: ${result.currentModel ?? '?'} — richiesto: ${result.required ?? '?'}`);
  return result;
});

ipcMain.handle('copilot:generateScheda', async (event, profile: ProfileData) => {
  const settings = storage.getSettings();
  const sender = event.sender;
  sendLog('copilot', `Avvio generazione Scheda EU per "${profile.ragioneSociale}"…`);

  const onChunk = (text: string): void => {
    if (sender && !sender.isDestroyed()) sender.send('copilot:chunk', text);
  };

  try {
    const scheda = await copilot.generateSchedaEU(profile, settings, onChunk);
    const keywords = await copilot.extractKeywords(scheda, settings);
    storage.saveProfile(profile.ragioneSociale, { schedaEU: scheda, keywords });
    sendLog('success', `Scheda EU generata per "${profile.ragioneSociale}".`, `${keywords.length} keywords: ${keywords.join(', ')}`);
    return { ok: true, schedaEU: scheda, keywords };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendLog('error', `Errore generazione Scheda: ${message}`);
    return { ok: false, error: message };
  }
});

ipcMain.handle('eu:search', async (_event, { keywords, options }: { keywords: string[]; options?: Record<string, unknown> }) => {
  sendLog('api', 'Ricerca EU API avviata.', `Keywords: ${keywords.join(', ')}`);
  try {
    const results = await euSearch.searchFunding(keywords, options);
    sendLog('success', `EU API: ${results.total} risultati trovati.`, `Search: ${results.requestText}`);
    return { ok: true, ...results };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = (err as { response?: { status?: number } }).response?.status;
    sendLog('error', `EU API errore: ${message}`, status ? `HTTP ${status}` : '');
    return { ok: false, error: message, results: [] };
  }
});

ipcMain.handle('eu:testAuth', async () => {
  sendLog('api', 'Test credenziali EU Login in corso…');
  const creds = credManager.loadCredentials();
  if (!creds) {
    sendLog('warn', 'Nessuna credenziale EU Login salvata.');
    return { ok: false, error: 'Nessuna credenziale salvata.' };
  }
  const result = await euAuth.testEuLoginCredentials(creds.username, creds.password);
  sendLog(
    result.ok ? 'success' : 'error',
    result.ok ? `EU Login OK per ${creds.username}` : `EU Login fallito: ${result.error}`
  );
  return result;
});

ipcMain.handle('eu:testConnectivity', async () => {
  sendLog('api', 'Test connettività EU API in corso…');
  const result = await euAuth.testApiConnectivity();
  sendLog(result.ok ? 'success' : 'error', result.message, `HTTP status: ${result.status}`);
  return result;
});

ipcMain.handle('copilot:analyzeBando', async (_event, { bando, ragioneSociale }: { bando: SearchResult; ragioneSociale: string }) => {
  sendLog('copilot', `Analisi bando: "${bando.title.substring(0, 60)}…"`);
  const settings = storage.getSettings();
  const profile = storage.loadProfile(ragioneSociale);
  const schedaEU = profile?.schedaEU ?? '';
  try {
    const { analysis, fitScore } = await copilot.analyzeBando(profile, schedaEU, bando, settings);
    storage.saveBandoAnalysis(ragioneSociale, bando.id, analysis, fitScore);
    sendLog('success', `Analisi bando salvata: ${bando.id}`);
    return { ok: true, analysis, fitScore };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendLog('error', `Errore analisi bando: ${message}`);
    return { ok: false, error: message };
  }
});

ipcMain.handle('bando:loadAnalyses', async (_event, { ragioneSociale }: { ragioneSociale: string }) => {
  return storage.loadBandoAnalyses(ragioneSociale);
});

ipcMain.handle('cred:save', async (_event, { username, password }: { username: string; password: string }) => {
  try {
    credManager.saveCredentials(username, password);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('cred:load', async () => {
  try {
    return { ok: true, data: credManager.loadCredentials() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('cred:clear', async () => { credManager.clearCredentials(); return { ok: true }; });
ipcMain.handle('cred:has', async () => ({ ok: true, has: credManager.hasCredentials() }));

ipcMain.handle('settings:get', async () => storage.getSettings());

ipcMain.handle('settings:save', async (_event, settings: AppSettings) => {
  storage.saveSettings(settings);
  return { ok: true };
});
