import { contextBridge, ipcRenderer } from 'electron';
import type { ProfileData, AppSettings, ProgressEvent, LogEntry } from './types';

contextBridge.exposeInMainWorld('euMatch', {
  buildProfile: (ragioneSociale: string, url: string) =>
    ipcRenderer.invoke('profiler:build', { ragioneSociale, url }),

  loadProfile: (ragioneSociale: string) =>
    ipcRenderer.invoke('storage:load', { ragioneSociale }),

  listProfiles: () => ipcRenderer.invoke('storage:list'),

  deleteProfile: (ragioneSociale: string) =>
    ipcRenderer.invoke('storage:delete', { ragioneSociale }),

  updateProfile: (ragioneSociale: string, data: Partial<ProfileData>) =>
    ipcRenderer.invoke('storage:update', { ragioneSociale, data }),

  copilotHealthCheck: () => ipcRenderer.invoke('copilot:health'),

  copilotCheckModel: () => ipcRenderer.invoke('copilot:checkModel'),

  generateSchedaEU: (profile: ProfileData) =>
    ipcRenderer.invoke('copilot:generateScheda', profile),

  searchFunding: (keywords: string[], options?: Record<string, unknown>) =>
    ipcRenderer.invoke('eu:search', { keywords, options }),

  saveCredentials: (username: string, password: string) =>
    ipcRenderer.invoke('cred:save', { username, password }),

  loadCredentials: () => ipcRenderer.invoke('cred:load'),

  clearCredentials: () => ipcRenderer.invoke('cred:clear'),

  hasCredentials: () => ipcRenderer.invoke('cred:has'),

  getSettings: () => ipcRenderer.invoke('settings:get'),

  saveSettings: (settings: AppSettings) =>
    ipcRenderer.invoke('settings:save', settings),

  testEuAuth: () => ipcRenderer.invoke('eu:testAuth'),

  testEuConnectivity: () => ipcRenderer.invoke('eu:testConnectivity'),

  onProfileProgress: (callback: (data: ProgressEvent) => void) => {
    ipcRenderer.on('profiler:progress', (_event, data: ProgressEvent) => callback(data));
  },

  removeProfileProgressListener: () => {
    ipcRenderer.removeAllListeners('profiler:progress');
  },

  onCopilotChunk: (callback: (text: string) => void) => {
    ipcRenderer.on('copilot:chunk', (_event, text: string) => callback(text));
  },

  removeCopilotChunkListener: () => {
    ipcRenderer.removeAllListeners('copilot:chunk');
  },

  onLog: (callback: (entry: LogEntry) => void) => {
    ipcRenderer.on('log:push', (_event, entry: LogEntry) => callback(entry));
  },

  removeLogListener: () => {
    ipcRenderer.removeAllListeners('log:push');
  }
});
