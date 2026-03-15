jest.mock('axios');

import axios from 'axios';
import { searchGrants, type GrantOpportunity } from '../src/main/grantSearch';
import type { EuropeanSummaryCard } from '../src/main/copilot';

const mockAxios = axios as jest.Mocked<typeof axios>;

const SAMPLE_SUMMARY_CARD: EuropeanSummaryCard = {
  companyName: 'GreenTech Solutions SRL',
  vatNumber: 'IT12345678901',
  naceCodes: ['72.19', '71.12'],
  missionStatement: 'We develop AI-driven cleantech solutions for the European market.',
  coreTechnologies: ['AI', 'machine learning', 'IoT', 'cleantech'],
  targetMarkets: ['Italy', 'Germany', 'France'],
  keywords: ['AI', 'cleantech', 'sustainable energy', 'digital innovation', 'green hydrogen'],
  eligibilitySummary:
    'Eligible for Horizon Europe and LIFE programme funding due to deep tech and cleantech focus.',
};

const SAMPLE_API_RESPONSE = {
  results: [
    {
      id: 'HORIZON-CL5-2024-D3-01',
      title: 'AI-driven clean energy solutions',
      metadata: {
        programmeCode: ['HORIZON'],
        status: ['Open'],
        openingDate: ['2024-01-15'],
        closingDate: ['2024-09-12'],
        budgetTotal: ['5000000'],
        budgetCurrency: ['EUR'],
      },
      summary: 'Funding for AI and cleantech innovation in sustainable energy.',
      url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-CL5-2024-D3-01',
      score: 85,
    },
    {
      id: 'LIFE-2024-SAP-NAT',
      title: 'LIFE Nature & Biodiversity',
      metadata: {
        programmeCode: ['LIFE'],
        status: ['Forthcoming'],
        openingDate: ['2024-03-01'],
        closingDate: ['2024-10-31'],
        budgetTotal: ['2000000'],
        budgetCurrency: ['EUR'],
      },
      summary: 'Nature and biodiversity protection projects.',
      url: 'https://ec.europa.eu/info/funding-tenders/LIFE-2024-SAP-NAT',
      score: 30,
    },
  ],
  totalResults: 2,
};

describe('searchGrants', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns grant opportunities with correct structure', async () => {
    mockAxios.post = jest.fn().mockResolvedValue({ data: SAMPLE_API_RESPONSE });

    const result = await searchGrants(SAMPLE_SUMMARY_CARD);

    expect(result.opportunities).toBeDefined();
    expect(result.opportunities.length).toBeGreaterThan(0);
    expect(result.searchedAt).toBeDefined();
    expect(result.keywords).toEqual(SAMPLE_SUMMARY_CARD.keywords);
  });

  it('calls the EU Search API endpoint with correct payload', async () => {
    mockAxios.post = jest.fn().mockResolvedValue({ data: SAMPLE_API_RESPONSE });

    await searchGrants(SAMPLE_SUMMARY_CARD);

    expect(mockAxios.post).toHaveBeenCalledWith(
      'https://api.tech.ec.europa.eu/search-api/prod/rest/search',
      expect.objectContaining({
        filters: expect.objectContaining({
          programmePeriod: '2021-2027',
        }),
      }),
      expect.any(Object)
    );
  });

  it('queries for both Open and Forthcoming status', async () => {
    mockAxios.post = jest.fn().mockResolvedValue({ data: { results: [], totalResults: 0 } });

    await searchGrants(SAMPLE_SUMMARY_CARD);

    expect(mockAxios.post).toHaveBeenCalledTimes(2);

    const calls = (mockAxios.post as jest.Mock).mock.calls;
    const statuses = calls.map((call) => call[1].filters.status);
    expect(statuses).toContain('Open');
    expect(statuses).toContain('Forthcoming');
  });

  it('assigns higher match score to grants with more keyword overlap', async () => {
    mockAxios.post = jest.fn().mockResolvedValue({ data: SAMPLE_API_RESPONSE });

    const result = await searchGrants(SAMPLE_SUMMARY_CARD);

    // The first result should have a higher match score (mentions AI, cleantech)
    // than the second (nature/biodiversity - no keyword overlap)
    expect(result.opportunities[0].matchScore).toBeGreaterThanOrEqual(
      result.opportunities[result.opportunities.length - 1].matchScore
    );
  });

  it('returns match scores between 0 and 100', async () => {
    mockAxios.post = jest.fn().mockResolvedValue({ data: SAMPLE_API_RESPONSE });

    const result = await searchGrants(SAMPLE_SUMMARY_CARD);

    result.opportunities.forEach((opp) => {
      expect(opp.matchScore).toBeGreaterThanOrEqual(0);
      expect(opp.matchScore).toBeLessThanOrEqual(100);
    });
  });

  it('maps grant status correctly to Open/Forthcoming/Closed', async () => {
    mockAxios.post = jest.fn().mockResolvedValue({ data: SAMPLE_API_RESPONSE });

    const result = await searchGrants(SAMPLE_SUMMARY_CARD);
    const statuses = result.opportunities.map((o) => o.status);

    statuses.forEach((s) => {
      expect(['Open', 'Forthcoming', 'Closed']).toContain(s);
    });
  });

  it('returns empty opportunities when API call fails', async () => {
    mockAxios.post = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await searchGrants(SAMPLE_SUMMARY_CARD);
    expect(result.opportunities).toEqual([]);
    expect(result.totalHits).toBe(0);
  });

  it('includes portal links in each opportunity', async () => {
    mockAxios.post = jest.fn().mockResolvedValue({ data: SAMPLE_API_RESPONSE });

    const result = await searchGrants(SAMPLE_SUMMARY_CARD);

    result.opportunities.forEach((opp) => {
      expect(opp.portalUrl).toBeTruthy();
      expect(opp.portalUrl).toMatch(/^https?:\/\//);
    });
  });

  it('sorts opportunities by match score in descending order', async () => {
    mockAxios.post = jest.fn().mockResolvedValue({ data: SAMPLE_API_RESPONSE });

    const result = await searchGrants(SAMPLE_SUMMARY_CARD);

    for (let i = 0; i < result.opportunities.length - 1; i++) {
      expect(result.opportunities[i].matchScore).toBeGreaterThanOrEqual(
        result.opportunities[i + 1].matchScore
      );
    }
  });
});
