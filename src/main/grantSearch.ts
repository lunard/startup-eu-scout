import axios from 'axios';
import type { EuropeanSummaryCard } from './copilot';

const EU_SEARCH_API_ENDPOINT =
  'https://api.tech.ec.europa.eu/search-api/prod/rest/search';

const PROGRAMME_PERIOD = '2021-2027';

export interface GrantOpportunity {
  id: string;
  title: string;
  programmeCode: string;
  status: 'Open' | 'Forthcoming' | 'Closed';
  openingDate?: string;
  closingDate?: string;
  budgetTotal?: number;
  budgetCurrency?: string;
  description: string;
  portalUrl: string;
  matchScore: number;
}

export interface GrantSearchResult {
  opportunities: GrantOpportunity[];
  totalHits: number;
  searchedAt: string;
  keywords: string[];
}

interface EuSearchApiHit {
  id?: string;
  title?: string;
  metadata?: {
    programmeCode?: string[];
    status?: string[];
    openingDate?: string[];
    closingDate?: string[];
    budgetTotal?: string[];
    budgetCurrency?: string[];
  };
  summary?: string;
  url?: string;
  score?: number;
}

interface EuSearchApiResponse {
  results?: EuSearchApiHit[];
  totalResults?: number;
}

/**
 * Searches the EU Funding & Tenders Portal for open and forthcoming grant
 * opportunities that match a startup's European Summary Card profile.
 *
 * Endpoint: POST https://api.tech.ec.europa.eu/search-api/prod/rest/search
 *
 * @param summaryCard - The AI-generated European Summary Card from Copilot
 * @returns A structured list of matching funding opportunities with match scores
 */
export async function searchGrants(
  summaryCard: EuropeanSummaryCard
): Promise<GrantSearchResult> {
  const keywords = summaryCard.keywords;
  const searchedAt = new Date().toISOString();

  const [openResults, forthcomingResults] = await Promise.all([
    queryEuSearchApi(keywords, 'Open'),
    queryEuSearchApi(keywords, 'Forthcoming'),
  ]);

  const allHits = [...(openResults.results ?? []), ...(forthcomingResults.results ?? [])];
  const totalHits = (openResults.totalResults ?? 0) + (forthcomingResults.totalResults ?? 0);

  const opportunities = allHits.map((hit) => mapHitToOpportunity(hit, summaryCard));

  opportunities.sort((a, b) => b.matchScore - a.matchScore);

  return {
    opportunities,
    totalHits,
    searchedAt,
    keywords,
  };
}

/**
 * Queries the EU Search API for grants with a given status.
 */
async function queryEuSearchApi(
  keywords: string[],
  status: 'Open' | 'Forthcoming'
): Promise<EuSearchApiResponse> {
  const payload = {
    query: keywords.join(' OR '),
    filters: {
      programmePeriod: PROGRAMME_PERIOD,
      status: status,
    },
    languages: ['en'],
    pageSize: 50,
    pageNumber: 1,
    sort: 'relevance',
  };

  try {
    const response = await axios.post<EuSearchApiResponse>(EU_SEARCH_API_ENDPOINT, payload, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 30000,
    });
    return response.data;
  } catch (err) {
    console.error(`EU Search API query failed for status=${status}:`, err);
    return { results: [], totalResults: 0 };
  }
}

/**
 * Maps a raw EU Search API hit to a GrantOpportunity with an AI-calculated match score.
 */
function mapHitToOpportunity(hit: EuSearchApiHit, summaryCard: EuropeanSummaryCard): GrantOpportunity {
  const status = normalizeStatus(hit.metadata?.status?.[0]);
  const rawScore = hit.score ?? 0;
  const matchScore = calculateMatchScore(hit, summaryCard, rawScore);

  return {
    id: hit.id ?? 'unknown',
    title: hit.title ?? 'Untitled Opportunity',
    programmeCode: hit.metadata?.programmeCode?.[0] ?? '',
    status,
    openingDate: hit.metadata?.openingDate?.[0],
    closingDate: hit.metadata?.closingDate?.[0],
    budgetTotal: hit.metadata?.budgetTotal?.[0]
      ? parseFloat(hit.metadata.budgetTotal[0])
      : undefined,
    budgetCurrency: hit.metadata?.budgetCurrency?.[0],
    description: hit.summary ?? '',
    portalUrl: hit.url ?? `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${hit.id}`,
    matchScore,
  };
}

/**
 * Calculates a match score (0-100) for a grant opportunity relative to the
 * startup's European Summary Card.
 *
 * Score factors:
 * - Keyword overlap between grant description and startup keywords
 * - Technology alignment with startup's core technologies
 * - Market relevance for startup's target markets
 * - Base API relevance score from the search engine
 */
function calculateMatchScore(
  hit: EuSearchApiHit,
  summaryCard: EuropeanSummaryCard,
  apiScore: number
): number {
  const grantText = `${hit.title ?? ''} ${hit.summary ?? ''}`.toLowerCase();

  const keywordMatches = summaryCard.keywords.filter((kw) =>
    grantText.includes(kw.toLowerCase())
  ).length;

  const techMatches = summaryCard.coreTechnologies.filter((tech) =>
    grantText.includes(tech.toLowerCase())
  ).length;

  const marketMatches = summaryCard.targetMarkets.filter((market) =>
    grantText.includes(market.toLowerCase())
  ).length;

  const keywordScore = Math.min(40, (keywordMatches / Math.max(summaryCard.keywords.length, 1)) * 40);
  const techScore = Math.min(30, (techMatches / Math.max(summaryCard.coreTechnologies.length, 1)) * 30);
  const marketScore = Math.min(15, (marketMatches / Math.max(summaryCard.targetMarkets.length, 1)) * 15);
  const apiRelevanceScore = Math.min(15, (apiScore / 100) * 15);

  return Math.round(keywordScore + techScore + marketScore + apiRelevanceScore);
}

function normalizeStatus(raw: string | undefined): 'Open' | 'Forthcoming' | 'Closed' {
  if (!raw) return 'Closed';
  const lower = raw.toLowerCase();
  if (lower === 'open') return 'Open';
  if (lower === 'forthcoming') return 'Forthcoming';
  return 'Closed';
}
