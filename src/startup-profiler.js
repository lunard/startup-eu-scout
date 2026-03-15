'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

const OPENCORPORATES_BASE = 'https://api.opencorporates.com/v0.4';

async function fetchBusinessRegister(ragioneSociale, onStep) {
  onStep('⏳', `Ricerca registro imprese: "${ragioneSociale}"…`);
  try {
    const res = await axios.get(`${OPENCORPORATES_BASE}/companies/search`, {
      params: { q: ragioneSociale, jurisdiction_code: 'it', format: 'json' },
      timeout: 8000,
      signal: AbortSignal.timeout(8000)
    });
    const companies = res.data?.results?.companies;
    if (!companies || companies.length === 0) {
      onStep('⚠️', 'Registro: nessuna azienda trovata con questo nome.');
      return null;
    }
    const best = companies[0].company;
    onStep('✅', `Registro: trovata "${best.name}" — n° ${best.company_number}`);
    return {
      ragioneSociale: best.name,
      jurisdiction: best.jurisdiction_code,
      companyNumber: best.company_number,
      incorporatedOn: best.incorporation_date,
      status: best.current_status,
      registryUrl: best.opencorporates_url
    };
  } catch (err) {
    const reason = err.response?.status === 401
      ? 'API key OpenCorporates non configurata'
      : err.code === 'ECONNABORTED' || err.name === 'AbortError'
        ? 'timeout (8s)'
        : err.message;
    onStep('⚠️', `Registro non disponibile: ${reason}`);
    return null;
  }
}

async function scrapeWebsite(url, onStep) {
  if (!url) {
    onStep('ℹ️', 'Nessun sito web fornito — scraping saltato.');
    return {};
  }
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
  onStep('⏳', `Scraping sito: ${normalizedUrl}…`);

  try {
    const res = await axios.get(normalizedUrl, {
      timeout: 12000,
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EU-Match/0.1)' },
      maxRedirects: 5
    });

    const $ = cheerio.load(res.data);
    $('script, style, nav, footer, header, .cookie-banner, #cookie-banner').remove();

    const title = $('title').text().trim();
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const ogDesc = $('meta[property="og:description"]').attr('content') || '';

    const bodyTexts = [];
    $('h1, h2, h3, p, li').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 20) bodyTexts.push(text);
    });

    const description = metaDesc || ogDesc || title;
    const rawText = bodyTexts.slice(0, 40).join(' ').substring(0, 3000);

    onStep('✅', `Sito analizzato: "${title || normalizedUrl}" — ${bodyTexts.length} blocchi di testo`);
    return { pageTitle: title, description, rawText };
  } catch (err) {
    const reason = err.code === 'ECONNABORTED' || err.name === 'AbortError'
      ? 'timeout (12s)' : err.message;
    onStep('⚠️', `Scraping fallito: ${reason}`);
    return {};
  }
}

async function buildProfile(ragioneSociale, websiteUrl, onStep = () => {}) {
  onStep('⏳', 'Avvio profilazione startup…');

  const [registerData, webData] = await Promise.all([
    fetchBusinessRegister(ragioneSociale, onStep),
    scrapeWebsite(websiteUrl, onStep)
  ]);

  onStep('💾', 'Salvataggio profilo in cache locale…');

  return {
    ragioneSociale,
    url: websiteUrl || '',
    piva: registerData?.companyNumber || '',
    jurisdiction: registerData?.jurisdiction || 'it',
    incorporatedOn: registerData?.incorporatedOn || '',
    registryUrl: registerData?.registryUrl || '',
    pageTitle: webData.pageTitle || '',
    description: webData.description || '',
    rawText: webData.rawText || '',
    scrapedAt: new Date().toISOString()
  };
}

module.exports = { buildProfile, fetchBusinessRegister, scrapeWebsite };

