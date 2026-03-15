import axios from 'axios';
import type { SearchResult, SearchResponse } from './types';

const EU_SEARCH_BASE  = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search';
const EU_TENDERS_BASE = 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-search';
const DEFAULT_PAGE_SIZE = 20;

const PROGRAMME_BOOST: Record<string, string> = {
  'HORIZON': 'Horizon Europe research innovation',
  'EIC': 'European Innovation Council EIC accelerator',
  'DIGITAL': 'Digital Europe digital transformation',
  'COSME': 'COSME SME entrepreneurship',
  'EIT': 'EIT knowledge innovation community',
  'LIFE': 'LIFE environment climate',
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
  openDate?: string[];
  startDate?: string[];
  totalBudget?: string[];
  budget?: string[];
  keywords?: string[];
  status?: string[];
  title?: string[];
  description?: string[];
  [key: string]: string[] | undefined;
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
    language   = 'en',
    statusKey  = 'open-forthcoming',
    programme  = 'all'
  } = options;

  const boost = programme !== 'all' ? (PROGRAMME_BOOST[programme.toUpperCase()] ?? programme) : '';
  const text = [...keywords, boost].filter(Boolean).join(' ');

  const FETCH_PER_PAGE = 100;
  const PAGES_TO_FETCH = 5;
  const fetches = Array.from({ length: PAGES_TO_FETCH }, (_, i) =>
    axios.post<ApiResponse>(EU_SEARCH_BASE, {}, {
      params: { apiKey: 'SEDIA', text, pageSize: FETCH_PER_PAGE, pageNumber: i + 1 },
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'EU-Match/0.2' },
      timeout: 25000
    }).catch(() => null)
  );
  const pages = await Promise.all(fetches);
  const hits = pages.flatMap(r => r?.data?.results ?? []);
  const totalResults = pages.find(p => p)?.data?.totalResults ?? hits.length;

  const preferred = [language, 'en'];
  const byUrl = new Map<string, RawHit>();

  for (const item of hits) {
    const key = (item.url ?? item.reference ?? '').replace(/\.json$/, '');
    if (!key) continue;

    // Programme filter: check both URL identifier prefix AND metadata.frameworkProgramme
    if (programme !== 'all') {
      const id = (key.split('/').pop() ?? '').toUpperCase();
      const fp = (item.metadata?.frameworkProgramme ?? []).map(s => s.toUpperCase());
      const pUp = programme.toUpperCase();
      if (!id.startsWith(pUp) && !fp.some(f => f.includes(pUp))) continue;
    }

    // Status filter — permissive: only exclude on positive identification
    const meta         = item.metadata ?? {};
    const itemStatuses = meta.status ?? [];
    const isClosed      = itemStatuses.some(s => s === '31094503' || s === '3' || s.toLowerCase().includes('closed'));
    const isOpen        = itemStatuses.some(s => s === '31094501' || s === '1' || s.toLowerCase().includes('open'));
    const isForthcoming = itemStatuses.some(s => s === '31094502' || s === '2' || s.toLowerCase().includes('forthcoming'));

    if (statusKey === 'closed' && !isClosed) continue;
    else if (statusKey === 'open-forthcoming' && isClosed) continue;
    else if (statusKey === 'open' && (isClosed || isForthcoming)) continue;
    else if (statusKey === 'forthcoming' && (isClosed || isOpen)) continue;

    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, item);
    } else {
      const curScore = preferred.indexOf(existing.language ?? '');
      const newScore = preferred.indexOf(item.language ?? '');
      if (newScore >= 0 && (curScore < 0 || newScore < curScore)) byUrl.set(key, item);
    }
  }

  // Sort by deadline ascending (nearest first, nulls last)
  const unique = [...byUrl.values()];
  unique.sort((a, b) => {
    const getDate = (item: RawHit): Date | null => {
      const s = (item.metadata?.deadline ?? item.metadata?.closingDate ?? item.metadata?.es_SortDate ?? [])[0];
      if (!s) return null;
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    };
    const da = getDate(a), db = getDate(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.getTime() - db.getTime();
  });
  const top = unique.slice(0, pageSize);

  const isClosedView = statusKey === 'closed';

  return {
    total: totalResults,
    results: top.map(item => normalizeResult(item, keywords, isClosedView)),
    pageSize,
    pageNumber: 1,
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
  const openDate    = (meta['openDate'] ?? meta['startDate'] ?? meta.es_SortDate ?? [])[0] ?? '';
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
    openDate,
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
