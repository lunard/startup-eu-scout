import axios from 'axios';
import type { SearchResult, SearchResponse } from './types';

const EU_SEARCH_BASE = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search';
const EU_TENDERS_BASE = 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-search';
const DEFAULT_PAGE_SIZE = 20;

interface SearchOptions {
  pageSize?: number;
  pageNumber?: number;
  programmePeriod?: string;
  status?: string[];
  language?: string;
  [key: string]: unknown;
}

interface RawHit {
  url?: string;
  reference?: string;
  summary?: string;
  content?: string;
  groupById?: string;
  metadata?: {
    frameworkProgramme?: string[];
    deadline?: string[];
    closingDate?: string[];
    es_SortDate?: string[];
    totalBudget?: string[];
    budget?: string[];
    keywords?: string[];
  };
}

interface ApiResponse {
  totalResults?: number;
  results?: RawHit[];
}

export async function searchFunding(keywords: string[], options: SearchOptions = {}): Promise<SearchResponse> {
  if (!keywords || keywords.length === 0) {
    throw new Error('Nessuna keyword fornita per la ricerca.');
  }

  const { pageSize = DEFAULT_PAGE_SIZE, pageNumber = 1, language = 'en' } = options;
  const text = Array.isArray(keywords) ? keywords.join(' ') : keywords;

  // Over-fetch to account for cross-language duplicates (24 EU official languages)
  const fetchSize = Math.min(pageSize * 8, 200);

  const response = await axios.post<ApiResponse>(EU_SEARCH_BASE, {}, {
    params: { apiKey: 'SEDIA', text, pageSize: fetchSize, pageNumber },
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'EU-Match/0.2' },
    timeout: 20000
  });

  const data = response.data;
  const hits = data.results ?? [];

  // Deduplicate by topic URL — keep one entry per topic in preferred language order
  const byUrl = new Map<string, RawHit & { language?: string }>();
  const preferred = [language, 'en'];
  for (const item of hits) {
    const key = ((item.url ?? item.reference ?? '') as string).replace(/\.json$/, '');
    if (!key) continue;
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, item as RawHit & { language?: string });
    } else {
      const curPref = preferred.indexOf((existing.language ?? '') as string);
      const newPref = preferred.indexOf(((item as RawHit & { language?: string }).language ?? '') as string);
      const curScore = curPref === -1 ? 99 : curPref;
      const newScore = newPref === -1 ? 99 : newPref;
      if (newScore < curScore) byUrl.set(key, item as RawHit & { language?: string });
    }
  }

  const unique = [...byUrl.values()].slice(0, pageSize);

  return {
    total: data.totalResults ?? hits.length,
    results: unique.map(item => normalizeResult(item, keywords)),
    pageSize,
    pageNumber,
    requestText: text
  };
}

function extractIdentifier(url?: string): string {
  if (!url) return '';
  return url.replace(/\.json$/, '').split('/').pop() ?? '';
}

function normalizeResult(item: RawHit, queryKeywords: string[]): SearchResult {
  const identifier = extractIdentifier(item.url) || item.reference || '';
  const meta = item.metadata ?? {};

  const title = item.summary || (item.content ?? '').replace(/<[^>]+>/g, '') || 'N/D';
  const programme = (meta.frameworkProgramme ?? [])[0] ?? identifier.split('-')[0] ?? '';
  const deadline = (meta.deadline ?? meta.closingDate ?? meta.es_SortDate ?? [])[0] ?? '';
  const budget = (meta.totalBudget ?? meta.budget ?? [])[0] ?? '';
  const description = (item.content ?? '').replace(/<[^>]+>/g, '').substring(0, 300);
  const metaKws = meta.keywords ?? [];

  const portalUrl = identifier
    ? `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${identifier}`
    : EU_TENDERS_BASE;

  return {
    id: identifier,
    title,
    status: item.groupById ?? '',
    deadline,
    programme,
    budget,
    description,
    portalUrl,
    matchingScore: computeMatchingScore(title + ' ' + metaKws.join(' '), queryKeywords)
  };
}

function computeMatchingScore(text: string, keywords: string[]): number {
  if (!text || !keywords || keywords.length === 0) return 0;
  const t = text.toLowerCase();
  const matched = keywords.filter(kw => t.includes(kw.toLowerCase()));
  return Math.round((matched.length / keywords.length) * 100);
}
