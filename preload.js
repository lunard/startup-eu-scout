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

  // --- Copilot streaming events ---
  onCopilotChunk: (callback) => {
    ipcRenderer.on('copilot:chunk', (_, text) => callback(text));
  },

  removeCopilotChunkListener: () => {
    ipcRenderer.removeAllListeners('copilot:chunk');
  }
});
