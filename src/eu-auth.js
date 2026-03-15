'use strict';

const axios = require('axios');

// EU Login (ECAS) CAS REST endpoint
const CAS_TICKETS_URL = 'https://ecas.ec.europa.eu/cas/v1/tickets';
const EU_API_PING_URL = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search';

/**
 * Test EU Login credentials via CAS REST protocol.
 * POST to /cas/v1/tickets with form-encoded username+password.
 * 201 = valid TGT issued → credentials OK
 * 400/401 = bad credentials
 */
async function testEuLoginCredentials(username, password) {
  if (!username || !password) {
    return { ok: false, error: 'Username o password mancanti.' };
  }

  const params = new URLSearchParams();
  params.append('username', username);
  params.append('password', password);

  try {
    const res = await axios.post(CAS_TICKETS_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
      validateStatus: () => true // handle all status codes manually
    });

    if (res.status === 201) {
      const tgtUrl = res.headers['location'] || '';
      return { ok: true, message: 'Credenziali EU Login valide. TGT ottenuto.', tgtUrl };
    }

    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return { ok: false, error: `Credenziali non valide (HTTP ${res.status}).` };
    }

    return { ok: false, error: `Risposta inattesa dal server EU Login (HTTP ${res.status}).` };
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ECONNABORTED') {
      return { ok: false, error: `Impossibile raggiungere EU Login: ${err.code}` };
    }
    return { ok: false, error: err.message };
  }
}

/**
 * Test connectivity to the EU Funding & Tenders public API (no credentials needed).
 */
async function testApiConnectivity() {
  try {
    const res = await axios.post(EU_API_PING_URL, {}, {
      params: { apiKey: 'SEDIA', text: 'horizon europe', pageSize: 1, pageNumber: 1 },
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
      validateStatus: () => true
    });
    const ok = res.status >= 200 && res.status < 300;
    return {
      ok,
      status: res.status,
      message: ok
        ? `API EU raggiungibile — ${res.data?.totalResults ?? '?'} risultati disponibili`
        : `API EU ha risposto con HTTP ${res.status}`
    };
  } catch (err) {
    return { ok: false, status: 0, message: `Connessione fallita: ${err.message}` };
  }
}

module.exports = { testEuLoginCredentials, testApiConnectivity };
