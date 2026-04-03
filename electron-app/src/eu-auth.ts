import axios from 'axios';
import type { AuthTestResult, ConnectivityResult } from './types';

const CAS_TICKETS_URL = 'https://ecas.ec.europa.eu/cas/v1/tickets';
const EU_API_PING_URL = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search';

export async function testEuLoginCredentials(username: string, password: string): Promise<AuthTestResult> {
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
      validateStatus: () => true
    });

    if (res.status === 201) {
      const tgtUrl = (res.headers['location'] as string | undefined) ?? '';
      return { ok: true, message: 'EU Login credentials valid. TGT obtained.', tgtUrl };
    }

    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return { ok: false, error: `Invalid credentials (HTTP ${res.status}).` };
    }

    return { ok: false, error: `Unexpected response from EU Login (HTTP ${res.status}).` };
  } catch (err) {
    const axiosErr = err as { code?: string; message?: string };
    if (axiosErr.code === 'ECONNREFUSED' || axiosErr.code === 'ENOTFOUND' || axiosErr.code === 'ECONNABORTED') {
      return { ok: false, error: `Cannot reach EU Login: ${axiosErr.code}` };
    }
    return { ok: false, error: axiosErr.message ?? 'Unknown error.' };
  }
}

export async function testApiConnectivity(): Promise<ConnectivityResult> {
  try {
    const res = await axios.post<{ totalResults?: number }>(EU_API_PING_URL, {}, {
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
        ? `EU API reachable — ${res.data?.totalResults ?? '?'} results available`
        : `EU API responded with HTTP ${res.status}`
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, message: `Connection failed: ${message}` };
  }
}
