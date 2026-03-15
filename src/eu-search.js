'use strict';

const axios = require('axios');

const EU_SEARCH_ENDPOINT = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search';
const EU_TENDERS_BASE = 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-search';

const DEFAULT_PAGE_SIZE = 20;

function buildSearchPayload(keywords, options = {}) {
  const {
    programmePeriod = '2021-2027',
    status = ['31094501', '31094502'], // 31094501=Open, 31094502=Forthcoming
    pageSize = DEFAULT_PAGE_SIZE,
    pageNumber = 1
  } = options;

  const keywordString = Array.isArray(keywords) ? keywords.join(' OR ') : keywords;

  return {
    query: keywordString,
    pageSize,
    pageNumber,
    sortBy: 'RELEVANCE',
    language: 'en',
    freeTextFilter: {
      keywords: Array.isArray(keywords) ? keywords : [keywords]
    },
    programmePeriod,
    status
  };
}

async function searchFunding(keywords, options = {}) {
  if (!keywords || keywords.length === 0) {
    throw new Error('Nessuna keyword fornita per la ricerca.');
  }

  const payload = buildSearchPayload(keywords, options);

  const response = await axios.post(EU_SEARCH_ENDPOINT, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'EU-Match/0.1'
    },
    timeout: 20000
  });

  const data = response.data;

  if (!data || (!data.results && !data.hits)) {
    return { total: 0, results: [], raw: data };
  }

  const hits = data.results || data.hits || [];
  const results = hits.map(item => normalizeResult(item, keywords));

  return {
    total: data.totalCount || data.total || hits.length,
    results,
    pageSize: payload.pageSize,
    pageNumber: payload.pageNumber
  };
}

function normalizeResult(item, queryKeywords) {
  const fields = item.fields || item;

  const title = fields.title?.[0] || fields.name?.[0] || item.title || 'N/D';
  const identifier = fields.identifier?.[0] || fields.ccm2Id?.[0] || item.id || '';
  const status = fields.status?.[0] || '';
  const deadline = fields.deadline?.[0] || fields.deadlineDate?.[0] || '';
  const programme = fields.frameworkProgramme?.[0] || fields.programme?.[0] || '';
  const budget = fields.budgetOverviewEuFundingMax?.[0] || '';
  const description = fields.description?.[0] || '';

  const portalUrl = identifier
    ? `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${identifier}`
    : EU_TENDERS_BASE;

  return {
    id: identifier,
    title,
    status,
    deadline,
    programme,
    budget,
    description: description.substring(0, 300),
    portalUrl,
    matchingScore: computeMatchingScore(title + ' ' + description, queryKeywords)
  };
}

function computeMatchingScore(text, keywords) {
  if (!text || !keywords || keywords.length === 0) return 0;
  const normalizedText = text.toLowerCase();
  const matched = keywords.filter(kw => normalizedText.includes(kw.toLowerCase()));
  return Math.round((matched.length / keywords.length) * 100);
}

module.exports = { searchFunding, buildSearchPayload };
