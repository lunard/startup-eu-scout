'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('euMatch', {
  // --- Startup Profiler ---
  buildProfile: (ragioneSociale, url) =>
    ipcRenderer.invoke('profiler:build', { ragioneSociale, url }),

  // --- Storage ---
  loadProfile: (ragioneSociale) =>
    ipcRenderer.invoke('storage:load', { ragioneSociale }),

  listProfiles: () =>
    ipcRenderer.invoke('storage:list'),

  deleteProfile: (ragioneSociale) =>
    ipcRenderer.invoke('storage:delete', { ragioneSociale }),

  updateProfile: (ragioneSociale, data) =>
    ipcRenderer.invoke('storage:update', { ragioneSociale, data }),

  // --- Copilot ---
  copilotHealthCheck: () =>
    ipcRenderer.invoke('copilot:health'),

  copilotCheckModel: () =>
    ipcRenderer.invoke('copilot:checkModel'),

  generateSchedaEU: (profile) =>
    ipcRenderer.invoke('copilot:generateScheda', profile),

  // --- EU Search ---
  searchFunding: (keywords, options) =>
    ipcRenderer.invoke('eu:search', { keywords, options }),

  // --- Credentials ---
  saveCredentials: (username, password) =>
    ipcRenderer.invoke('cred:save', { username, password }),

  loadCredentials: () =>
    ipcRenderer.invoke('cred:load'),

  clearCredentials: () =>
    ipcRenderer.invoke('cred:clear'),

  hasCredentials: () =>
    ipcRenderer.invoke('cred:has'),

  // --- Settings ---
  getSettings: () =>
    ipcRenderer.invoke('settings:get'),

  saveSettings: (settings) =>
    ipcRenderer.invoke('settings:save', settings),

  // --- EU Auth / Connectivity ---
  testEuAuth: () =>
    ipcRenderer.invoke('eu:testAuth'),

  testEuConnectivity: () =>
    ipcRenderer.invoke('eu:testConnectivity'),

  // --- Profiler progress events ---
  onProfileProgress: (callback) => {
    ipcRenderer.on('profiler:progress', (_, data) => callback(data));
  },
  removeProfileProgressListener: () => {
    ipcRenderer.removeAllListeners('profiler:progress');
  },

  // --- Copilot streaming events ---
  onCopilotChunk: (callback) => {
    ipcRenderer.on('copilot:chunk', (_, text) => callback(text));
  },

  removeCopilotChunkListener: () => {
    ipcRenderer.removeAllListeners('copilot:chunk');
  },

  // --- App log events (main → renderer) ---
  onLog: (callback) => {
    ipcRenderer.on('log:push', (_, entry) => callback(entry));
  },
  removeLogListener: () => {
    ipcRenderer.removeAllListeners('log:push');
  }
});
