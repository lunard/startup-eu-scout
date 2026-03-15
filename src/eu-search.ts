import axios from 'axios';
import type { SearchResult, SearchResponse } from './types';

const EU_SEARCH_BASE  = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search';
const EU_TENDERS_BASE = 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-search';
const DEFAULT_PAGE_SIZE = 20;

// Status codes: 31094501=Open, 31094502=Forthcoming, 31094503=Closed
const STATUS_CODES: Record<string, string[]> = {
  'open':             ['31094501'],
  'forthcoming':      ['31094502'],
  'open-forthcoming': ['31094501', '31094502'],
  'closed':           ['31094503']
};

interface SearchOptions {
  pageSize?: number;
  pageNumber?: number;
  language?: string;
  statusKey?: string;
  programme?: string;
}

interface RawMeta {
  frameworkProgramme?: string[];
  deadline?: string[];
  closingDate?: string[];
  es_SortDate?: string[];
  totalBudget?: string[];
  budget?: string[];
  keywords?: string[];
  status?: string[];
  title?: string[];
  description?: string[];
}

interface RawHit {
  url?: string;
  reference?: string;
  summary?: string;
  content?: string;
  groupById?: string;
  language?: string;
  metadata?: RawMeta;
}

interface ApiResponse {
  totalResults?: number;
  results?: RawHit[];
}

export async function searchFunding(keywords: string[], options: SearchOptions = {}): Promise<SearchResponse> {
  if (!keywords || keywords.length === 0) {
    throw new Error('Nessuna keyword fornita per la ricerca.');
  }

  const {
    pageSize   = DEFAULT_PAGE_SIZE,
    pageNumber  = 1,
    language   = 'en',
    statusKey  = 'open-forthcoming',
    programme  = 'all'
  } = options;

  const text = keywords.join(' ');
  const fetchSize = Math.min(pageSize * 10, 200);

  const response = await axios.post<ApiResponse>(EU_SEARCH_BASE, {}, {
    params: { apiKey: 'SEDIA', text, pageSize: fetchSize, pageNumber },
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'EU-Match/0.2' },
    timeout: 20000
  });

  const data  = response.data;
  const hits  = data.results ?? [];
  const preferred = [language, 'en'];
  const byUrl = new Map<string, RawHit>();

  for (const item of hits) {
    const key = (item.url ?? item.reference ?? '').replace(/\.json$/, '');
    if (!key) continue;

    // Programme filter by identifier prefix
    if (programme !== 'all') {
      const id = key.split('/').pop() ?? '';
      if (!id.toUpperCase().startsWith(programme.toUpperCase())) continue;
    }

    // Status filter
    const meta         = item.metadata ?? {};
    const itemStatuses = meta.status ?? [];
    const isClosed = itemStatuses.includes('31094503');
    const isOpen   = itemStatuses.includes('31094501') || itemStatuses.includes('31094502');
    const hasStatus = itemStatuses.length > 0;

    if (statusKey === 'closed') {
      if (!hasStatus || !isClosed) continue;
    } else if (statusKey === 'open-forthcoming') {
      if (hasStatus && isClosed) continue;
    } else if (statusKey === 'open' || statusKey === 'forthcoming') {
      if (hasStatus && !isOpen) continue;
    }

    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, item);
    } else {
      const curScore = preferred.indexOf(existing.language ?? '');
      const newScore = preferred.indexOf(item.language ?? '');
      if (newScore >= 0 && (curScore < 0 || newScore < curScore)) byUrl.set(key, item);
    }
  }

  const isClosedView = statusKey === 'closed';
  const unique = [...byUrl.values()].slice(0, pageSize);

  return {
    total: data.totalResults ?? hits.length,
    results: unique.map(item => normalizeResult(item, keywords, isClosedView)),
    pageSize,
    pageNumber,
    requestText: text,
    isClosed: isClosedView
  };
}

function extractIdentifier(url?: string): string {
  if (!url) return '';
  return url.replace(/\.json$/, '').split('/').pop() ?? '';
}

function normalizeResult(item: RawHit, queryKeywords: string[], isClosed = false): SearchResult {
  const identifier = extractIdentifier(item.url) || item.reference || '';
  const meta       = item.metadata ?? {};

  const title       = (meta.title ?? [])[0] || item.summary || (item.content ?? '').replace(/<[^>]+>/g, '') || 'N/D';
  const programme   = (meta.frameworkProgramme ?? [])[0] ?? identifier.split('-')[0] ?? '';
  const deadline    = (meta.deadline ?? meta.closingDate ?? meta.es_SortDate ?? [])[0] ?? '';
  const budget      = (meta.totalBudget ?? meta.budget ?? [])[0] ?? '';
  const description = ((meta.description ?? [])[0] || (item.content ?? '').replace(/<[^>]+>/g, '')).substring(0, 300);
  const metaKws     = meta.keywords ?? [];

  const portalUrl = identifier
    ? `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${identifier}`
    : EU_TENDERS_BASE;

  const beneficiariesUrl = isClosed && identifier
    ? `https://cordis.europa.eu/search/result_en?q=contenttype%3Dproject%20AND%20grantDoi%3A${encodeURIComponent(identifier)}`
    : '';

  return {
    id: identifier,
    title,
    status: item.groupById ?? '',
    deadline,
    programme,
    budget,
    description,
    portalUrl,
    beneficiariesUrl,
    matchingScore: computeMatchingScore(title + ' ' + metaKws.join(' '), queryKeywords)
  };
}

function computeMatchingScore(text: string, keywords: string[]): number {
  if (!text || !keywords || keywords.length === 0) return 0;
  const t = text.toLowerCase();
  const matched = keywords.filter(kw => t.includes(kw.toLowerCase()));
  return Math.round((matched.length / keywords.length) * 100);
}
