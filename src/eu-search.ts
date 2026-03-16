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
  typesOfAction?: string[];   // e.g. ["Research and Innovation Action"]
  typeOfMGAs?: string[];
  actions?: string[];         // JSON string: [{status,deadlineDates,plannedOpeningDate,...}]
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

// Always-appended keyword boosts — cross-cutting themes that broaden grant coverage.
// All are optional signals (text search is OR-based), so they never filter out results,
// they only help surface grants that mention these topics.
const FIXED_KEYWORD_BOOST = ['ESG', 'inclusion', 'senior', 'disability', 'social innovation', 'accessibility'];

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

  const boost       = programme !== 'all' ? (PROGRAMME_BOOST[programme.toUpperCase()] ?? programme) : '';
  const keywordText = [...keywords, ...FIXED_KEYWORD_BOOST, boost].filter(Boolean).join(' ');

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

  const now = new Date();
  const thisYearStart = new Date(now.getFullYear(), 0, 1);

  // Helper: extract the most authoritative deadline from a raw hit.
  // Tries meta.deadline → meta.closingDate → actions[].deadlineDates.
  // Never uses es_SortDate (that's an ES index date, not a submission deadline).
  function hitDeadline(item: RawHit): Date | null {
    const meta = item.metadata ?? {};
    const direct = (meta.deadline ?? meta.closingDate ?? [])[0];
    if (direct) { const d = new Date(direct); if (!isNaN(d.getTime())) return d; }
    try {
      const actStr = (meta.actions ?? [])[0];
      if (actStr) {
        const acts = JSON.parse(actStr) as Array<{ deadlineDates?: string[] }>;
        const dates = acts.flatMap(a => a.deadlineDates ?? []);
        if (dates.length) { const d = new Date(dates[dates.length - 1]); if (!isNaN(d.getTime())) return d; }
      }
    } catch { /* malformed */ }
    return null;
  }

  // Helper: extract opening date from a raw hit (for staleness check).
  function hitOpenDate(item: RawHit): Date | null {
    const meta = item.metadata ?? {};
    const direct = (meta['openDate'] ?? meta['startDate'] ?? [])[0];
    if (direct) { const d = new Date(direct); if (!isNaN(d.getTime())) return d; }
    try {
      const actStr = (meta.actions ?? [])[0];
      if (actStr) {
        const acts = JSON.parse(actStr) as Array<{ plannedOpeningDate?: string }>;
        const opening = acts[0]?.plannedOpeningDate;
        if (opening) { const d = new Date(opening); if (!isNaN(d.getTime())) return d; }
      }
    } catch { /* malformed */ }
    return null;
  }

  // Pre-filter: for non-closed searches, drop grants that are demonstrably stale
  // BEFORE selecting the top-N so we don't waste the pool on dead calls.
  const filtered = statusKey === 'closed'
    ? [...byUrl.values()]
    : [...byUrl.values()].filter(item => {
        const dl = hitDeadline(item);
        if (dl && dl < now) return false;                       // past deadline
        if (!dl) {
          const od = hitOpenDate(item);
          if (od && od < thisYearStart) return false;           // no deadline + stale open
        }
        return true;
      });

  // Sort by deadline ascending (nearest first, nulls last).
  // Never use es_SortDate — it is the ES index date, always in the past.
  filtered.sort((a, b) => {
    const da = hitDeadline(a), db = hitDeadline(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.getTime() - db.getTime();
  });
  const top = filtered.slice(0, pageSize);

  const isClosedView = statusKey === 'closed';

  return {
    total:       totalResults,
    rawFetched:  hits.length,
    uniqueFound: filtered.length,
    results:     top.map(item => normalizeResult(item, keywords, isClosedView)),
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

  const title        = (meta.title ?? [])[0] || item.summary || (item.content ?? '').replace(/<[^>]+>/g, '') || 'N/D';
  const programme    = (meta.frameworkProgramme ?? [])[0] ?? identifier.split('-')[0] ?? '';
  const budget       = (meta.totalBudget ?? meta.budget ?? [])[0] ?? '';
  const description  = ((meta.description ?? [])[0] || (item.content ?? '').replace(/<[^>]+>/g, '')).substring(0, 300);
  const metaKws      = meta.keywords ?? [];
  // typesOfAction lives in the search metadata — read it here so the type filter
  // works without needing to crawl the individual grant page.
  const typeOfAction = (meta.typesOfAction ?? meta.typeOfMGAs ?? [])[0] ?? '';

  // Parse the 'actions' JSON string — most authoritative source for deadline/openDate.
  // Format: '[{"status":{"abbreviation":"Closed"},"deadlineDates":["09 April 2021"],"plannedOpeningDate":"..."}]'
  let actionsDeadline = '';
  let actionsOpenDate = '';
  try {
    const actionsStr = (meta.actions ?? [])[0];
    if (actionsStr) {
      const acts = JSON.parse(actionsStr) as Array<{ deadlineDates?: string[]; plannedOpeningDate?: string }>;
      const allDeadlines = acts.flatMap(a => a.deadlineDates ?? []);
      if (allDeadlines.length > 0) actionsDeadline = allDeadlines[allDeadlines.length - 1];
      const opening = acts[0]?.plannedOpeningDate ?? '';
      if (opening) actionsOpenDate = opening;
    }
  } catch { /* malformed JSON — ignore */ }

  // Prefer explicit metadata fields, fall back to parsed actions data
  const deadline = (meta.deadline ?? meta.closingDate ?? [])[0] ?? actionsDeadline;
  const openDate = (meta['openDate'] ?? meta['startDate'] ?? [])[0] ?? actionsOpenDate;

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
    typeOfAction,
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
        // Some EU API fields return arrays — take the first non-empty element
        if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string' && v[0].trim()) return v[0].trim();
      }
      return '';
    };

    const title        = str('title') || result.title;
    const fullDesc     = str('objective', 'description').substring(0, 3000);
    const openDate     = str('startDate', 'submissionStartDate', 'openDate') || result.openDate;
    const deadline     = str('deadlineDate', 'deadline0') || result.deadline;
    const duration     = str('projectDuration', 'duration');
    const budget       = str('budgetTopicAction', 'totalBudget', 'budget') || result.budget;
    const programme    = str('frameworkProgramme', 'programmeName') || result.programme;

    // typeOfAction: EU JSON may use singular string, array, or nested object.
    // Try multiple field names and extract the first usable string value.
    const typeOfAction = str('typeOfAction', 'typeOfActions', 'actions', 'actionType', 'legalBasis');

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
