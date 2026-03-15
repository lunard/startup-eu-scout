'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

const OPENCORPORATES_BASE = 'https://api.opencorporates.com/v0.4';

async function fetchBusinessRegister(ragioneSociale, country = 'it') {
  try {
    const res = await axios.get(`${OPENCORPORATES_BASE}/companies/search`, {
      params: {
        q: ragioneSociale,
        jurisdiction_code: country,
        format: 'json'
      },
      timeout: 10000
    });

    const companies = res.data?.results?.companies;
    if (!companies || companies.length === 0) return null;

    const best = companies[0].company;
    return {
      ragioneSociale: best.name,
      jurisdiction: best.jurisdiction_code,
      companyNumber: best.company_number,
      incorporatedOn: best.incorporation_date,
      status: best.current_status,
      registryUrl: best.opencorporates_url
    };
  } catch (err) {
    console.warn('[startup-profiler] OpenCorporates lookup failed:', err.message);
    return null;
  }
}

async function scrapeWebsite(url) {
  if (!url) return {};
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

  try {
    const res = await axios.get(normalizedUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EU-Match/0.1; +https://github.com/eu-match)'
      },
      maxRedirects: 5
    });

    const $ = cheerio.load(res.data);

    // Remove noise elements
    $('script, style, nav, footer, header, .cookie-banner, #cookie-banner').remove();

    const title = $('title').text().trim();
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const ogDesc = $('meta[property="og:description"]').attr('content') || '';

    // Collect visible text from meaningful elements
    const bodyTexts = [];
    $('h1, h2, h3, p, li').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 20) bodyTexts.push(text);
    });

    const fullText = bodyTexts.slice(0, 40).join(' ');
    const description = metaDesc || ogDesc || title;

    return {
      pageTitle: title,
      description,
      rawText: fullText.substring(0, 3000)
    };
  } catch (err) {
    console.warn('[startup-profiler] Web scraping failed:', err.message);
    return {};
  }
}

async function buildProfile(ragioneSociale, websiteUrl) {
  const [registerData, webData] = await Promise.all([
    fetchBusinessRegister(ragioneSociale),
    scrapeWebsite(websiteUrl)
  ]);

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
