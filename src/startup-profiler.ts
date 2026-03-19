import axios from 'axios';
import * as cheerio from 'cheerio';
import type { ProfileData } from './types';

const OPENCORPORATES_BASE = 'https://api.opencorporates.com/v0.4';

interface RegisterData {
  ragioneSociale: string;
  jurisdiction: string;
  companyNumber: string;
  incorporatedOn: string;
  status: string;
  registryUrl: string;
}

interface WebData {
  pageTitle?: string;
  description?: string;
  rawText?: string;
}

type StepFn = (icon: string, msg: string) => void;

async function fetchBusinessRegister(ragioneSociale: string, onStep: StepFn): Promise<RegisterData | null> {
  onStep('⏳', `Searching business registry: "${ragioneSociale}"…`);
  try {
    const res = await axios.get(`${OPENCORPORATES_BASE}/companies/search`, {
      params: { q: ragioneSociale, jurisdiction_code: 'it', format: 'json' },
      timeout: 8000,
      signal: AbortSignal.timeout(8000)
    });

    const companies = (res.data as { results?: { companies?: Array<{ company: Record<string, string> }> } })?.results?.companies;
    if (!companies || companies.length === 0) {
      onStep('⚠️', 'Registry: no company found with this name.');
      return null;
    }

    const best = companies[0].company;
    onStep('✅', `Registry: found "${best.name}" — no. ${best.company_number}`);
    return {
      ragioneSociale: best.name,
      jurisdiction: best.jurisdiction_code,
      companyNumber: best.company_number,
      incorporatedOn: best.incorporation_date,
      status: best.current_status,
      registryUrl: best.opencorporates_url
    };
  } catch (err) {
    const axiosErr = err as { response?: { status?: number }; code?: string; name?: string; message?: string };
    const reason = axiosErr.response?.status === 401
      ? 'OpenCorporates API key not configured'
      : axiosErr.code === 'ECONNABORTED' || axiosErr.name === 'AbortError'
        ? 'timeout (8s)'
        : axiosErr.message ?? 'unknown error';
    onStep('⚠️', `Registry unavailable: ${reason}`);
    return null;
  }
}

async function scrapeWebsite(url: string | undefined, onStep: StepFn): Promise<WebData> {
  if (!url) {
    onStep('ℹ️', 'No website provided — scraping skipped.');
    return {};
  }

  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
  onStep('⏳', `Scraping website: ${normalizedUrl}…`);

  try {
    const res = await axios.get<string>(normalizedUrl, {
      timeout: 12000,
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EU-Match/0.1)' },
      maxRedirects: 5
    });

    const $ = cheerio.load(res.data);
    $('script, style, nav, footer, header, .cookie-banner, #cookie-banner').remove();

    const title = $('title').text().trim();
    const metaDesc = $('meta[name="description"]').attr('content') ?? '';
    const ogDesc = $('meta[property="og:description"]').attr('content') ?? '';

    const bodyTexts: string[] = [];
    $('h1, h2, h3, p, li').each((_i, el) => {
      const text = $(el).text().trim();
      if (text.length > 20) bodyTexts.push(text);
    });

    const description = metaDesc || ogDesc || title;
    const rawText = bodyTexts.slice(0, 40).join(' ').substring(0, 3000);

    onStep('✅', `Website analysed: "${title || normalizedUrl}" — ${bodyTexts.length} text blocks`);
    return { pageTitle: title, description, rawText };
  } catch (err) {
    const axiosErr = err as { code?: string; name?: string; message?: string };
    const reason = axiosErr.code === 'ECONNABORTED' || axiosErr.name === 'AbortError'
      ? 'timeout (12s)' : (axiosErr.message ?? 'unknown error');
    onStep('⚠️', `Scraping failed: ${reason}`);
    return {};
  }
}

export async function buildProfile(ragioneSociale: string, websiteUrl: string | undefined, onStep: StepFn = () => {}): Promise<ProfileData> {
  onStep('⏳', 'Starting startup profiling…');

  const [registerData, webData] = await Promise.all([
    fetchBusinessRegister(ragioneSociale, onStep),
    scrapeWebsite(websiteUrl, onStep)
  ]);

  onStep('💾', 'Saving profile to local cache…');

  return {
    ragioneSociale,
    url: websiteUrl ?? '',
    piva: registerData?.companyNumber ?? '',
    jurisdiction: registerData?.jurisdiction ?? 'it',
    incorporatedOn: registerData?.incorporatedOn ?? '',
    registryUrl: registerData?.registryUrl ?? '',
    pageTitle: webData.pageTitle ?? '',
    description: webData.description ?? '',
    rawText: webData.rawText ?? '',
    scrapedAt: new Date().toISOString()
  };
}

export { fetchBusinessRegister, scrapeWebsite };
