jest.mock('axios');

// We mock the fs module with controllable functions before importing anything
// that depends on fs, so that tests can configure behavior per-test.
const fsMocks = {
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
};

jest.mock('fs', () => fsMocks);

import axios from 'axios';
import {
  loadCachedProfile,
  saveProfileToCache,
  fetchBusinessRegistryData,
  scrapeWebIntelligence,
  getStartupProfile,
  type StartupProfile,
} from '../src/main/profile';

const mockAxios = axios as jest.Mocked<typeof axios>;

const SAMPLE_PROFILE: StartupProfile = {
  businessName: 'Acme Technologies GmbH',
  registryData: {
    companyName: 'Acme Technologies GmbH',
    vatNumber: 'DE123456789',
    naceCodes: ['62.01'],
    legalForm: 'GmbH',
  },
  webData: {
    missionStatement: 'We build AI tools for EU businesses.',
    coreTechnologies: ['AI', 'cloud'],
    targetMarkets: ['Germany', 'France'],
    description: 'AI tools for European businesses.',
  },
  lastUpdated: '2026-01-01T00:00:00.000Z',
};

describe('loadCachedProfile', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns null when no cache file exists', () => {
    fsMocks.existsSync.mockReturnValue(false);
    const result = loadCachedProfile('Acme Technologies GmbH');
    expect(result).toBeNull();
  });

  it('returns parsed profile when cache file exists', () => {
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockReturnValue(JSON.stringify(SAMPLE_PROFILE));
    const result = loadCachedProfile('Acme Technologies GmbH');
    expect(result).not.toBeNull();
    expect(result?.businessName).toBe('Acme Technologies GmbH');
    expect(result?.registryData.vatNumber).toBe('DE123456789');
  });

  it('returns null when cache file contains invalid JSON', () => {
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockReturnValue('NOT VALID JSON');
    const result = loadCachedProfile('Acme Technologies GmbH');
    expect(result).toBeNull();
  });
});

describe('saveProfileToCache', () => {
  afterEach(() => jest.clearAllMocks());

  it('writes the profile as JSON to the expected file path', () => {
    fsMocks.mkdirSync.mockReturnValue(undefined);
    fsMocks.writeFileSync.mockReturnValue(undefined);

    saveProfileToCache(SAMPLE_PROFILE);

    expect(fsMocks.writeFileSync).toHaveBeenCalledTimes(1);

    const writeCall = fsMocks.writeFileSync.mock.calls[0];
    const writtenContent = JSON.parse(writeCall[1] as string);
    expect(writtenContent.businessName).toBe('Acme Technologies GmbH');
  });

  it('writes to a path containing the sanitised business name', () => {
    fsMocks.mkdirSync.mockReturnValue(undefined);
    fsMocks.writeFileSync.mockReturnValue(undefined);

    saveProfileToCache(SAMPLE_PROFILE);

    const filePath = fsMocks.writeFileSync.mock.calls[0][0] as string;
    expect(filePath).toMatch(/acme_technologies_gmbh\.json$/);
  });
});

describe('fetchBusinessRegistryData', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns company data from OpenCorporates API on success', async () => {
    mockAxios.get = jest.fn().mockResolvedValue({
      data: {
        results: {
          companies: [
            {
              company: {
                name: 'Acme Technologies GmbH',
                company_number: 'DE123456789',
                company_type: 'GmbH',
                incorporation_date: '2020-01-15',
                sic_codes: ['62.01'],
                registered_address: {
                  street_address: 'Musterstraße 1',
                  locality: 'Berlin',
                  country: 'Germany',
                },
              },
            },
          ],
        },
      },
    });

    const result = await fetchBusinessRegistryData('Acme Technologies GmbH');
    expect(result.companyName).toBe('Acme Technologies GmbH');
    expect(result.vatNumber).toBe('DE123456789');
    expect(result.naceCodes).toContain('62.01');
    expect(result.legalForm).toBe('GmbH');
  });

  it('returns empty registry data when API returns no companies', async () => {
    mockAxios.get = jest.fn().mockResolvedValue({
      data: { results: { companies: [] } },
    });

    const result = await fetchBusinessRegistryData('Unknown Corp');
    expect(result.companyName).toBe('Unknown Corp');
    expect(result.vatNumber).toBe('');
    expect(result.naceCodes).toEqual([]);
  });

  it('returns empty registry data when API throws an error', async () => {
    mockAxios.get = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchBusinessRegistryData('Unknown Corp');
    expect(result.companyName).toBe('Unknown Corp');
    expect(result.vatNumber).toBe('');
  });
});

describe('scrapeWebIntelligence', () => {
  afterEach(() => jest.clearAllMocks());

  it('extracts description from meta tag', async () => {
    const htmlContent = `
      <html>
        <head>
          <meta name="description" content="We build AI tools for European businesses." />
        </head>
        <body>
          <h1>Welcome to Acme</h1>
          <p>We specialize in AI, machine learning, and cloud services.</p>
        </body>
      </html>
    `;

    mockAxios.get = jest.fn().mockResolvedValue({ data: htmlContent });

    const result = await scrapeWebIntelligence('https://example.com');
    expect(result.description).toContain('AI tools for European businesses');
    expect(result.coreTechnologies).toContain('AI');
    expect(result.coreTechnologies).toContain('cloud');
  });

  it('returns empty web data on network error', async () => {
    mockAxios.get = jest.fn().mockRejectedValue(new Error('Connection refused'));

    const result = await scrapeWebIntelligence('https://unreachable.example.com');
    expect(result.missionStatement).toBe('');
    expect(result.coreTechnologies).toEqual([]);
    expect(result.targetMarkets).toEqual([]);
  });

  it('detects EU target markets from page content', async () => {
    const htmlContent = `
      <html><body>
        <p>We serve customers in Germany, France, Italy, and the Netherlands.</p>
      </body></html>
    `;
    mockAxios.get = jest.fn().mockResolvedValue({ data: htmlContent });

    const result = await scrapeWebIntelligence('https://example.com');
    expect(result.targetMarkets).toContain('Germany');
    expect(result.targetMarkets).toContain('France');
    expect(result.targetMarkets).toContain('Italy');
  });
});

describe('getStartupProfile', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns cached profile when cache file exists', async () => {
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockReturnValue(JSON.stringify(SAMPLE_PROFILE));

    const result = await getStartupProfile('Acme Technologies GmbH');
    expect(result.businessName).toBe('Acme Technologies GmbH');
    expect(mockAxios.get).not.toHaveBeenCalled();
  });

  it('fetches and saves profile when no cache exists', async () => {
    fsMocks.existsSync.mockReturnValue(false);
    fsMocks.mkdirSync.mockReturnValue(undefined);
    fsMocks.writeFileSync.mockReturnValue(undefined);

    mockAxios.get = jest.fn().mockResolvedValue({
      data: { results: { companies: [] } },
    });

    const result = await getStartupProfile('New Startup Inc');
    expect(result.businessName).toBe('New Startup Inc');
    expect(fsMocks.writeFileSync).toHaveBeenCalled();
  });
});
