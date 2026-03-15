import axios from 'axios';
import type { SearchResult, SearchResponse } from './types';

const EU_SEARCH_BASE  = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search';
const EU_TENDERS_BASE = 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-search';
const DEFAULT_PAGE_SIZE = 60;

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

// Programme-browse texts: broader queries to surface all grants of a programme
const PROGRAMME_BROWSE: Record<string, string> = {
  'HORIZON': 'Horizon Europe Horizon-CL Horizon-EIC Horizon-MSCA Horizon-ERC Horizon-HLTH Horizon-WIDERA Horizon-INFRA Horizon-JU Horizon-KDT',
  'EIC':     'EIC Accelerator EIC Pathfinder EIC Transition European Innovation Council',
  'DIGITAL': 'Digital Europe DIGITAL Programme digital infrastructure cloud',
  'COSME':   'COSME SMP Single Market Programme SME entrepreneurship',
  'EIT':     'EIT KIC knowledge innovation community',
  'LIFE':    'LIFE programme environment climate biodiversity',
};

export async function searchFunding(keywords: string[], options: SearchOptions = {}): Promise<SearchResponse> {
  if (!keywords || keywords.length === 0) {
    throw new Error('No keywords provided for search.');
  }

  const {
    pageSize   = DEFAULT_PAGE_SIZE,
    language   = 'en',
    statusKey  = 'open-forthcoming',
    programme  = 'all'
  } = options;

  const boost      = programme !== 'all' ? (PROGRAMME_BOOST[programme.toUpperCase()] ?? programme) : '';
  const keywordText = [...keywords, boost].filter(Boolean).join(' ');

  const FETCH_PER_PAGE = 100;

  // ── Primary search: keyword-relevance (5 pages) ───────────────────────────
  const primaryFetches = Array.from({ length: 5 }, (_, i) =>
    axios.post<ApiResponse>(EU_SEARCH_BASE, {}, {
      params: { apiKey: 'SEDIA', text: keywordText, pageSize: FETCH_PER_PAGE, pageNumber: i + 1 },
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'EU-Match/0.2' },
      timeout: 25000
    }).catch(() => null)
  );

  // ── Secondary search: programme-browse (20 pages) — only when programme selected ──
  // This catches grants that don't rank highly for the startup's keywords
  // but belong to the selected programme (e.g. IHI Joint Undertakings, niche calls)
  const browseText = programme !== 'all' ? (PROGRAMME_BROWSE[programme.toUpperCase()] ?? programme) : null;
  const secondaryFetches = browseText
    ? Array.from({ length: 20 }, (_, i) =>
        axios.post<ApiResponse>(EU_SEARCH_BASE, {}, {
          params: { apiKey: 'SEDIA', text: browseText, pageSize: FETCH_PER_PAGE, pageNumber: i + 1 },
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'EU-Match/0.2' },
          timeout: 25000
        }).catch(() => null)
      )
    : [];

  // Run both in parallel
  const [primaryPages, secondaryPages] = await Promise.all([
    Promise.all(primaryFetches),
    Promise.all(secondaryFetches)
  ]);

  const hits         = [...primaryPages, ...secondaryPages].flatMap(r => r?.data?.results ?? []);
  const totalResults = primaryPages.find(p => p)?.data?.totalResults ?? hits.length;

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

    // Status filter — combine API status codes with deadline-date fallback
    // The EU API often returns missing/unrecognised codes for old grants;
    // if the deadline has passed we treat the grant as effectively closed.
    const meta         = item.metadata ?? {};
    const itemStatuses = meta.status ?? [];
    const isClosed      = itemStatuses.some(s => s === '31094503' || s === '3' || s.toLowerCase().includes('closed'));
    const isOpen        = itemStatuses.some(s => s === '31094501' || s === '1' || s.toLowerCase().includes('open'));
    const isForthcoming = itemStatuses.some(s => s === '31094502' || s === '2' || s.toLowerCase().includes('forthcoming'));

    // Deadline-date fallback: only trust actual deadline/closingDate metadata fields.
    // es_SortDate is an ES publication/index date — NOT the submission deadline — so
    // we never use it here (it would incorrectly mark every grant as past-deadline).
    const deadlineRaw = (meta.deadline ?? meta.closingDate ?? [])[0];
    const deadlineDate = deadlineRaw ? new Date(deadlineRaw) : null;
    const now = new Date();
    const isDeadlinePast = deadlineDate && !isNaN(deadlineDate.getTime()) && deadlineDate < now;

    // effectivelyClosed = positively closed by API code OR deadline has passed
    const effectivelyClosed = isClosed || !!isDeadlinePast;

    if (statusKey === 'closed') {
      // Only include grants we can positively identify as closed
      if (!effectivelyClosed) continue;
    } else {
      // For all active modes: exclude anything with a past deadline
      if (effectivelyClosed) continue;
      if (statusKey === 'open' && isForthcoming) continue;
      if (statusKey === 'forthcoming' && isOpen) continue;
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
    total:      totalResults,
    rawFetched: hits.length,
    uniqueFound: unique.length,
    results:    top.map(item => normalizeResult(item, keywords, isClosedView)),
    pageSize,
    pageNumber: 1,
    requestText: keywordText,
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

  const detailUrl = item.url ?? '';

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
    detailUrl,
    portalUrl,
    beneficiariesUrl,
    matchingScore: computeMatchingScore(title + ' ' + metaKws.join(' '), queryKeywords)
  };
}

// ─── Grant detail crawler ────────────────────────────────────────────────────

interface GrantDetailJson {
  title?:              string;
  objective?:          string;
  description?:        string;
  startDate?:          string;
  submissionStartDate?: string;
  openDate?:           string;
  deadlineDate?:       string;
  deadline0?:          string;
  projectDuration?:    string;
  duration?:           string;
  typeOfAction?:       string;
  budgetTopicAction?:  string;
  totalBudget?:        string;
  budget?:             string;
  frameworkProgramme?: string;
  programmeName?:      string;
  [key: string]: unknown;
}

/** Fetches each grant's detail JSON (the data powering its portal homepage). */
export async function enrichGrantDetails(results: SearchResult[]): Promise<SearchResult[]> {
  const BATCH = 6;
  const enriched = [...results];

  for (let i = 0; i < enriched.length; i += BATCH) {
    const slice = enriched.slice(i, i + BATCH);
    const details = await Promise.all(slice.map(r => crawlGrantPage(r)));
    for (let j = 0; j < slice.length; j++) {
      enriched[i + j] = { ...enriched[i + j], ...details[j] };
    }
  }
  return enriched;
}

async function crawlGrantPage(result: SearchResult): Promise<Partial<SearchResult>> {
  const url = result.detailUrl;
  if (!url) return {};
  try {
    const res = await axios.get<GrantDetailJson>(url, {
      timeout: 12000,
      headers: { 'Accept': 'application/json', 'User-Agent': 'EU-Match/0.2' }
    });
    const d = res.data;

    const str = (...keys: string[]): string => {
      for (const k of keys) {
        const v = d[k];
        if (v && typeof v === 'string' && v.trim()) return v.trim();
      }
      return '';
    };

    const title         = str('title') || result.title;
    const fullDesc      = str('objective', 'description').substring(0, 3000);
    const openDate      = str('startDate', 'submissionStartDate', 'openDate') || result.openDate;
    const deadline      = str('deadlineDate', 'deadline0') || result.deadline;
    const duration      = str('projectDuration', 'duration');
    const typeOfAction  = str('typeOfAction');
    const budget        = str('budgetTopicAction', 'totalBudget', 'budget') || result.budget;
    const programme     = str('frameworkProgramme', 'programmeName') || result.programme;

    return { title, fullDescription: fullDesc, openDate, deadline, duration, typeOfAction, budget, programme };
  } catch {
    return {};
  }
}

function computeMatchingScore(text: string, keywords: string[]): number {
  if (!text || !keywords || keywords.length === 0) return 0;
  const t = text.toLowerCase();
  const matched = keywords.filter(kw => t.includes(kw.toLowerCase()));
  return Math.round((matched.length / keywords.length) * 100);
}
