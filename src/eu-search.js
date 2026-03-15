'use strict';

const axios = require('axios');

const EU_SEARCH_BASE   = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search';
const EU_TENDERS_BASE  = 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-search';
const DEFAULT_PAGE_SIZE = 20;

async function searchFunding(keywords, options = {}) {
  if (!keywords || keywords.length === 0) {
    throw new Error('Nessuna keyword fornita per la ricerca.');
  }

  const { pageSize = DEFAULT_PAGE_SIZE, pageNumber = 1, language = 'en' } = options;
  const text = Array.isArray(keywords) ? keywords.join(' ') : keywords;

  // Over-fetch to account for cross-language duplicates (24 EU official languages)
  const fetchSize = Math.min(pageSize * 8, 200);

  const response = await axios.post(EU_SEARCH_BASE, {}, {
    params: { apiKey: 'SEDIA', text, pageSize: fetchSize, pageNumber },
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'EU-Match/0.2' },
    timeout: 20000
  });

  const data = response.data;
  const hits  = data.results || [];

  // Deduplicate by topic URL — keep one entry per topic in preferred language order
  const byUrl = new Map();
  const preferred = [language, 'en'];
  for (const item of hits) {
    const key = (item.url || item.reference || '').replace(/\.json$/, '');
    if (!key) continue;
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, item);
    } else {
      // Replace if current item matches preferred language better
      const curPref  = preferred.indexOf(existing.language ?? '');
      const newPref  = preferred.indexOf(item.language ?? '');
      const curScore = curPref === -1 ? 99 : curPref;
      const newScore = newPref === -1 ? 99 : newPref;
      if (newScore < curScore) byUrl.set(key, item);
    }
  }

  const unique = [...byUrl.values()].slice(0, pageSize);

  return {
    total: data.totalResults || hits.length,
    results: unique.map(item => normalizeResult(item, keywords)),
    pageSize,
    pageNumber,
    requestText: text
  };
}

function extractIdentifier(url) {
  // url = ".../topicDetails/HORIZON-CL4-2025-04-DATA-03.json"
  if (!url) return '';
  return url.replace(/\.json$/, '').split('/').pop() || '';
}

function normalizeResult(item, queryKeywords) {
  const identifier = extractIdentifier(item.url) || item.reference || '';
  const meta       = item.metadata || {};

  const title       = item.summary || item.content?.replace(/<[^>]+>/g, '') || 'N/D';
  const programme   = (meta.frameworkProgramme || [])[0] || identifier.split('-')[0] || '';
  const deadline    = (meta.deadline || meta.closingDate || meta.es_SortDate || [])[0] || '';
  const budget      = (meta.totalBudget || meta.budget || [])[0] || '';
  const description = (item.content || '').replace(/<[^>]+>/g, '').substring(0, 300);
  const metaKws     = meta.keywords || [];

  const portalUrl = identifier
    ? `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${identifier}`
    : EU_TENDERS_BASE;

  return {
    id: identifier,
    title,
    status: item.groupById || '',
    deadline,
    programme,
    budget,
    description,
    portalUrl,
    matchingScore: computeMatchingScore(title + ' ' + metaKws.join(' '), queryKeywords)
  };
}

function computeMatchingScore(text, keywords) {
  if (!text || !keywords || keywords.length === 0) return 0;
  const t = text.toLowerCase();
  const matched = keywords.filter(kw => t.includes(kw.toLowerCase()));
  return Math.round((matched.length / keywords.length) * 100);
}

module.exports = { searchFunding };
