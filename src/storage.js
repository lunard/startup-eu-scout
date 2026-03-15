'use strict';

const Store = require('electron-store');

const profileSchema = {
  profiles: {
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: {
        ragioneSociale: { type: 'string' },
        piva: { type: 'string' },
        ateco: { type: 'string' },
        url: { type: 'string' },
        mission: { type: 'string' },
        keyTechnologies: { type: 'array', items: { type: 'string' } },
        targetMarket: { type: 'string' },
        schedaEU: { type: 'string' },
        keywords: { type: 'array', items: { type: 'string' } },
        lastUpdated: { type: 'string' }
      }
    },
    default: {}
  },
  settings: {
    type: 'object',
    properties: {
      copilotPath: { type: 'string', default: '' },
      defaultModel: { type: 'string', default: 'claude-opus-4.5' }
    },
    default: {}
  }
};

const store = new Store({ schema: profileSchema, name: 'eu-match-data' });

function profileKey(ragioneSociale) {
  return ragioneSociale.trim().toLowerCase().replace(/\s+/g, '_');
}

function saveProfile(ragioneSociale, data) {
  const key = profileKey(ragioneSociale);
  const existing = store.get(`profiles.${key}`, {});
  store.set(`profiles.${key}`, {
    ...existing,
    ...data,
    ragioneSociale,
    lastUpdated: new Date().toISOString()
  });
}

function loadProfile(ragioneSociale) {
  const key = profileKey(ragioneSociale);
  return store.get(`profiles.${key}`, null);
}

function profileExists(ragioneSociale) {
  return loadProfile(ragioneSociale) !== null;
}

function deleteProfile(ragioneSociale) {
  const key = profileKey(ragioneSociale);
  const profiles = store.get('profiles', {});
  delete profiles[key];
  store.set('profiles', profiles);
}

function listProfiles() {
  const profiles = store.get('profiles', {});
  return Object.values(profiles).map(p => ({
    ragioneSociale: p.ragioneSociale,
    lastUpdated: p.lastUpdated
  }));
}

function getSettings() {
  return store.get('settings', {});
}

function saveSettings(settings) {
  const current = store.get('settings', {});
  store.set('settings', { ...current, ...settings });
}

module.exports = { saveProfile, loadProfile, profileExists, deleteProfile, listProfiles, getSettings, saveSettings };
