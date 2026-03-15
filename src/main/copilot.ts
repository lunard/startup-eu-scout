import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** The Copilot CLI model identifier required by EU Startup Nexus. */
const REQUIRED_MODEL = 'opus-4.6';
/** Lowercase tokens used to validate the active model from CLI output. */
const REQUIRED_MODEL_TOKENS = ['opus', '4.6'] as const;

export interface EuropeanSummaryCard {
  companyName: string;
  vatNumber: string;
  naceCodes: string[];
  missionStatement: string;
  coreTechnologies: string[];
  targetMarkets: string[];
  keywords: string[];
  eligibilitySummary: string;
}

/**
 * Runs `copilot --version` to verify the CLI is available and reachable.
 * Returns true if the CLI responds without error, false otherwise.
 */
export async function checkCopilotHealth(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('copilot --version', { timeout: 10000 });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Validates that the active Copilot CLI model is Opus 4.6.
 * The CLI is queried for its current model configuration.
 * Returns true if Opus 4.6 is active, false otherwise.
 */
export async function validateOpusModel(): Promise<boolean> {
  const outputContainsModel = (output: string): boolean => {
    const lower = output.toLowerCase();
    return REQUIRED_MODEL_TOKENS.every((token) => lower.includes(token));
  };

  try {
    const { stdout } = await execAsync('copilot model list --active', { timeout: 10000 });
    return outputContainsModel(stdout);
  } catch {
    try {
      const { stdout } = await execAsync('copilot model', { timeout: 10000 });
      return outputContainsModel(stdout);
    } catch {
      return false;
    }
  }
}

/**
 * Sends raw startup profile data to Copilot CLI and returns a structured
 * European Summary Card mapped to EU funding eligibility criteria.
 *
 * @param rawProfileData - Combined data from business register and web scraping
 * @returns Parsed European Summary Card or null on failure
 */
export async function generateEuropeanSummaryCard(
  rawProfileData: Record<string, unknown>
): Promise<EuropeanSummaryCard | null> {
  const prompt = buildSummaryCardPrompt(rawProfileData);

  return new Promise((resolve) => {
    const proc = spawn('copilot', ['chat', '--model', REQUIRED_MODEL, '--format', 'json'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('Copilot CLI exited with code', code, stderr);
        resolve(null);
        return;
      }

      try {
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error('No JSON found in Copilot CLI output');
          resolve(null);
          return;
        }
        const card = JSON.parse(jsonMatch[0]) as EuropeanSummaryCard;
        resolve(card);
      } catch (err) {
        console.error('Failed to parse Copilot CLI output:', err);
        resolve(null);
      }
    });

    proc.on('error', (err) => {
      console.error('Failed to spawn Copilot CLI:', err);
      resolve(null);
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

function buildSummaryCardPrompt(rawData: Record<string, unknown>): string {
  return (
    'You are an EU funding eligibility expert. Based on the following startup profile data, ' +
    'generate a structured European Summary Card as a JSON object with these fields:\n' +
    '- companyName: string\n' +
    '- vatNumber: string\n' +
    '- naceCodes: string[]\n' +
    '- missionStatement: string (concise, 1-2 sentences)\n' +
    '- coreTechnologies: string[]\n' +
    '- targetMarkets: string[]\n' +
    '- keywords: string[] (5-10 optimized keywords for EU funding search)\n' +
    '- eligibilitySummary: string (2-3 sentences on EU funding eligibility)\n\n' +
    'Raw profile data:\n' +
    JSON.stringify(rawData, null, 2) +
    '\n\nRespond with ONLY the JSON object, no additional text.'
  );
}
