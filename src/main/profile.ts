import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface BusinessRegistryData {
  companyName: string;
  vatNumber: string;
  naceCodes: string[];
  registrationDate?: string;
  registeredAddress?: string;
  legalForm?: string;
}

export interface WebIntelligenceData {
  missionStatement: string;
  coreTechnologies: string[];
  targetMarkets: string[];
  description: string;
}

export interface StartupProfile {
  businessName: string;
  registryData: BusinessRegistryData;
  webData: WebIntelligenceData;
  profileUrl?: string;
  lastUpdated: string;
}

/**
 * Retrieves the path to the userData directory for storing profile files.
 */
function getUserDataPath(): string {
  return app.getPath('userData');
}

/**
 * Returns the file path for a startup profile JSON cache file.
 */
function getProfileFilePath(businessName: string): string {
  const safeFileName = businessName.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
  return path.join(getUserDataPath(), `${safeFileName}.json`);
}

/**
 * Loads a cached startup profile from disk if it exists.
 * Returns null if no cache file is found.
 */
export function loadCachedProfile(businessName: string): StartupProfile | null {
  const filePath = getProfileFilePath(businessName);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as StartupProfile;
    }
  } catch (err) {
    console.error('Failed to load cached profile:', err);
  }
  return null;
}

/**
 * Persists a startup profile to disk as a JSON file in the userData directory.
 */
export function saveProfileToCache(profile: StartupProfile): void {
  const filePath = getProfileFilePath(profile.businessName);
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save profile cache:', err);
  }
}

/**
 * Queries the OpenCorporates API to retrieve business registry data.
 * Falls back to a minimal structure if the API is unavailable.
 *
 * @param businessName - The registered business name to search for
 */
export async function fetchBusinessRegistryData(
  businessName: string
): Promise<BusinessRegistryData> {
  try {
    const url = `https://api.opencorporates.com/v0.4/companies/search`;
    const response = await axios.get(url, {
      params: {
        q: businessName,
        jurisdiction_code: 'eu',
        per_page: 1,
      },
      timeout: 15000,
    });

    const companies = response.data?.results?.companies;
    if (!companies || companies.length === 0) {
      return buildEmptyRegistryData(businessName);
    }

    const company = companies[0].company;
    return {
      companyName: company.name || businessName,
      vatNumber: company.company_number || '',
      naceCodes: extractNaceCodes(company),
      registrationDate: company.incorporation_date || undefined,
      registeredAddress: formatAddress(company.registered_address),
      legalForm: company.company_type || undefined,
    };
  } catch (err) {
    console.warn('OpenCorporates API unavailable, using empty registry data:', err);
    return buildEmptyRegistryData(businessName);
  }
}

/**
 * Scrapes the startup's website to extract mission statement, core technologies,
 * and target markets.
 *
 * @param websiteUrl - The URL of the startup's website
 */
export async function scrapeWebIntelligence(websiteUrl: string): Promise<WebIntelligenceData> {
  try {
    const response = await axios.get(websiteUrl, {
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; EUStartupNexus/1.0; +https://github.com/lunard/startup-eu-scout)',
      },
    });

    const $ = cheerio.load(response.data as string);

    const description =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      $('p').first().text().trim() ||
      '';

    const missionStatement = extractMission($) || description.slice(0, 300);
    const coreTechnologies = extractTechnologies($);
    const targetMarkets = extractMarkets($);

    return {
      missionStatement,
      coreTechnologies,
      targetMarkets,
      description: description.slice(0, 500),
    };
  } catch (err) {
    console.warn('Web intelligence scraping failed:', err);
    return {
      missionStatement: '',
      coreTechnologies: [],
      targetMarkets: [],
      description: '',
    };
  }
}

/**
 * Main entry point for startup profiling.
 * Checks the cache first; if the business name has changed or no cache exists,
 * triggers a fresh profiling routine.
 *
 * @param businessName - The registered business name
 * @param profileUrl - Optional URL for web intelligence scraping
 */
export async function getStartupProfile(
  businessName: string,
  profileUrl?: string
): Promise<StartupProfile> {
  const cached = loadCachedProfile(businessName);
  if (cached) {
    return cached;
  }

  const [registryData, webData] = await Promise.all([
    fetchBusinessRegistryData(businessName),
    profileUrl ? scrapeWebIntelligence(profileUrl) : Promise.resolve(emptyWebData()),
  ]);

  const profile: StartupProfile = {
    businessName,
    registryData,
    webData,
    profileUrl,
    lastUpdated: new Date().toISOString(),
  };

  saveProfileToCache(profile);
  return profile;
}

function buildEmptyRegistryData(businessName: string): BusinessRegistryData {
  return {
    companyName: businessName,
    vatNumber: '',
    naceCodes: [],
  };
}

function emptyWebData(): WebIntelligenceData {
  return {
    missionStatement: '',
    coreTechnologies: [],
    targetMarkets: [],
    description: '',
  };
}

function formatAddress(address: Record<string, string> | null | undefined): string | undefined {
  if (!address) return undefined;
  return [address.street_address, address.locality, address.country]
    .filter(Boolean)
    .join(', ');
}

function extractNaceCodes(company: Record<string, unknown>): string[] {
  const sic = company.sic_codes;
  if (Array.isArray(sic)) return sic.map(String);
  return [];
}

function extractMission($: ReturnType<typeof cheerio.load>): string {
  const selectors = [
    '[class*="mission"]',
    '[id*="mission"]',
    '[class*="about"]',
    '[id*="about"]',
    'h1',
    'h2',
  ];

  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    if (text.length > 20) {
      return text.slice(0, 300);
    }
  }
  return '';
}

function extractTechnologies($: ReturnType<typeof cheerio.load>): string[] {
  const technologyKeywords = [
    'AI',
    'machine learning',
    'blockchain',
    'IoT',
    'cloud',
    'SaaS',
    'API',
    'data analytics',
    'cybersecurity',
    'automation',
    'robotics',
    'fintech',
    'medtech',
    'cleantech',
    'deep tech',
    'AR',
    'VR',
    'edge computing',
    'quantum',
  ];

  const pageText = $('body').text().toLowerCase();
  return technologyKeywords.filter((tech) => pageText.includes(tech.toLowerCase()));
}

function extractMarkets($: ReturnType<typeof cheerio.load>): string[] {
  const euMarkets = [
    'Europe',
    'EU',
    'Germany',
    'France',
    'Italy',
    'Spain',
    'Netherlands',
    'Belgium',
    'Poland',
    'Sweden',
    'Denmark',
    'Finland',
    'Austria',
    'Portugal',
    'Czech Republic',
    'Romania',
    'Hungary',
    'Greece',
    'Slovakia',
    'Ireland',
  ];

  const pageText = $('body').text();
  return euMarkets.filter((market) => pageText.includes(market));
}
