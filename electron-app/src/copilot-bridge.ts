import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import type { ProfileData, AppSettings, HealthCheckResult, ModelCheckResult, SearchResult, RankingResult } from './types';

const OPUS_MODEL_IDS = ['claude-opus-4.6', 'claude-opus-4.6-fast', 'claude-opus-4.5'];
const RECOMMENDED_MODEL = 'claude-opus-4.6';
const CONFIG_PATH = path.join(os.homedir(), '.copilot', 'config.json');

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, '');
}

function parseVersion(raw: string): string {
  const first = stripAnsi(raw).split('\n')[0].trim();
  const match = first.match(/\d+\.\d+\.\d+[\w.-]*/);
  return match ? match[0] : first.replace(/run .* to check for updates\.?/gi, '').trim() || 'OK';
}

function resolveCopilotBin(customPath?: string): string {
  if (customPath) return customPath;
  const candidates = [
    '/opt/homebrew/bin/copilot',
    path.join(os.homedir(), '.local', 'bin', 'copilot'),
    '/usr/local/bin/copilot',
    'copilot'
  ];
  return candidates.find(p => {
    try { fs.accessSync(p); return true; } catch { return false; }
  }) ?? 'copilot';
}

interface RunResult {
  stdout: string;
  stderr: string;
}

interface RunOptions {
  timeout?: number;
}

function runCommand(bin: string, args: string[], opts?: RunOptions): Promise<RunResult> {
  const timeout = opts?.timeout ?? 10000;
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { shell: false });
    let stdout = '', stderr = '';

    const timer = setTimeout(() => {
      proc.stdin.destroy();
      proc.stdout.destroy();
      reject(new Error('Timeout'));
    }, timeout);

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code: number | null) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`exit ${code}: ${(stderr || stdout).trim().substring(0, 200)}`));
    });
    proc.on('error', (err: Error) => { clearTimeout(timer); reject(new Error(err.message)); });
  });
}

export async function healthCheck(customPath?: string): Promise<HealthCheckResult> {
  const bin = resolveCopilotBin(customPath);
  try {
    const { stdout } = await runCommand(bin, ['--version'], { timeout: 8000 });
    return { ok: true, version: parseVersion(stdout), bin };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function checkModel(customPath?: string): Promise<ModelCheckResult> {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as { model?: string };
    const currentModel = config.model ?? 'unknown';
    const isOpus = OPUS_MODEL_IDS.some(id => currentModel.toLowerCase() === id.toLowerCase());
    return { currentModel, isOpus, recommended: RECOMMENDED_MODEL };
  } catch {
    return { currentModel: 'unknown', isOpus: null, recommended: RECOMMENDED_MODEL };
  }
}

/** Returns the active model from Copilot config, falling back to recommended. */
function resolveModel(): string {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as { model?: string };
    return config.model || RECOMMENDED_MODEL;
  } catch {
    return RECOMMENDED_MODEL;
  }
}

function spawnPrompt(bin: string, prompt: string, model: string, onChunk: ((text: string) => void) | null): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      '--prompt', prompt,
      '--model', model,
      '--allow-all-tools',
      '--output-format', 'text'
    ];
    const proc = spawn(bin, args, {
      shell: false,
      env: { ...process.env, NO_COLOR: '1', TERM: 'dumb' }
    });

    let fullOutput = '', stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      const text = stripAnsi(chunk.toString());
      fullOutput += text;
      if (onChunk) onChunk(text);
    });
    proc.stderr.on('data', (d: Buffer) => { stderr += stripAnsi(d.toString()); });
    proc.on('close', (code: number | null) => {
      const out = fullOutput.trim();
      if (out.length > 0) resolve(out);
      else reject(new Error(`Copilot exit ${code}: ${stderr.trim().substring(0, 300) || 'no output'}`));
    });
    proc.on('error', (err: Error) => reject(new Error(`Failed to start copilot: ${err.message}`)));
  });
}

export async function generateSchedaEU(rawProfile: ProfileData, settings: AppSettings, onChunk: (text: string) => void): Promise<string> {
  const bin = resolveCopilotBin(settings?.copilotPath);
  return spawnPrompt(bin, buildSchedaPrompt(rawProfile), resolveModel(), onChunk);
}

export async function extractKeywords(schedaEU: string, settings: AppSettings): Promise<string[]> {
  const bin = resolveCopilotBin(settings?.copilotPath);
  const result = await spawnPrompt(bin, buildKeywordsPrompt(schedaEU), resolveModel(), null);
  const match = result.match(/\[[\s\S]*?\]/);
  if (match) {
    try { return JSON.parse(match[0]) as string[]; } catch {}
  }
  return result
    .split(/[\n,]+/)
    .map(s => s.trim().replace(/^["'\-\u2022*\d.]+|["']+$/g, ''))
    .filter(s => s.length > 2 && s.length < 60)
    .slice(0, 15);
}

function buildSchedaPrompt(profile: ProfileData): string {
  return `You are an expert in European funding programmes. Analyse the following company profile and generate a structured "EU Summary Sheet" in English.

The sheet must include:
1. **Company Overview** (max 150 words)
2. **Key Technologies** (bullet list)
3. **Target Market**
4. **Potentially Relevant EU Programmes** (Horizon Europe, Digital Europe, EIC Accelerator, COSME, etc.)
5. **Strengths for EU Calls**
6. **Search Keywords for Grants** (10-15 terms in English, JSON array format)

---
COMPANY PROFILE:
Company Name: ${profile.ragioneSociale}
Website: ${profile.url ?? 'N/A'}
Description: ${profile.description ?? 'N/A'}
Extracted website text:
${profile.rawText ?? 'N/A'}
---

Respond ONLY with the structured sheet, no preamble. Always respond in English.`;
}

function buildKeywordsPrompt(schedaEU: string): string {
  return `From the following EU company summary sheet, extract the 10-15 most relevant keywords for searching EU grants on the Funding & Tenders portal.
Return ONLY a JSON array of English strings, no other text.
Example: ["artificial intelligence", "green technology", "SME", "digitalization"]

SUMMARY SHEET:
${schedaEU}

OUTPUT:`;
}

function buildGrantAnalysisPrompt(profile: ProfileData | null, schedaEU: string, bando: SearchResult): string {
  const ragioneSociale = profile?.ragioneSociale ?? 'N/D';
  const description = bando.fullDescription || bando.description || '';
  return `You are a European funding expert. Analyse the compatibility between the startup and the EU grant below.

## Startup Profile
Company: ${ragioneSociale}
${schedaEU ? `\nEU Summary Sheet:\n${schedaEU.substring(0, 1800)}` : ''}

## EU Grant
Title: ${bando.title}
Programme: ${bando.programme || 'N/A'}
Type of Action: ${bando.typeOfAction || 'N/A'}
${bando.openDate  ? `Opening Date: ${bando.openDate}` : ''}
${bando.deadline  ? `Deadline: ${bando.deadline}` : ''}
${bando.duration  ? `Project Duration: ${bando.duration}` : ''}
${bando.budget    ? `Budget: ${bando.budget}` : ''}
${description     ? `\nObjective / Description:\n${description}` : ''}
Portal URL: ${bando.portalUrl}

## Required Analysis (English, Markdown format)
1. **Fit Rationale** — Why is (or isn't) this grant a good fit for the startup? (High/Medium/Low + explanation)
2. **Partner Role** — How could the startup participate (coordinator, technical partner, SME, etc.)?
3. **Funding Modality** — Grant, loan, equity? Max EU contribution rate?
4. **Duration & Timeline** — Estimated project duration and application deadline
5. **Key Requirements** — 3–5 bullet points with the most important eligibility conditions or constraints

Reply ONLY with the structured Markdown analysis, no preamble.

At the very end, on a separate line, write EXACTLY:
PUNTEGGIO_PARTNER: XX
(where XX is an integer 0–100 representing how well this startup fits as a partner for this grant)`;
}

function buildRankingPrompt(profile: ProfileData | null, schedaEU: string, grants: SearchResult[]): string {
  const ragioneSociale = profile?.ragioneSociale ?? 'N/D';

  const grantSummaries = grants.map((g, i) => {
    const desc = (g.fullDescription || g.description || '').substring(0, 600);
    return `[${i + 1}] ID: ${g.id}
Title: ${g.title}
Programme: ${g.programme || 'N/A'} | Type: ${g.typeOfAction || 'N/A'}
Deadline: ${g.deadline || 'N/A'} | Budget: ${g.budget || 'N/A'}
Portal: ${g.portalUrl}
Description: ${desc}`;
  }).join('\n\n');

  return `You are a senior European funding consultant performing an in-depth grant scouting analysis.

## Startup Profile
Company: ${ragioneSociale}
${schedaEU ? `\nEU Summary Sheet:\n${schedaEU.substring(0, 2500)}` : ''}

## Available Grant Opportunities (${grants.length} total)
${grantSummaries}

## Your Task — INTENSIVE ANALYSIS

You have access to web search tools. Use them.

### Step 1 — Quick screening
Quickly scan all ${grants.length} grants above. Discard those that are clearly irrelevant to the startup. Identify the ~20-25 most promising candidates.

### Step 2 — Deep research (CRITICAL)
For each promising candidate, **use web search** to:
- Find and read the official **Work Programme PDF** or **topic page** on the EU Portal / Horizon Europe NCP Portal
- Extract the **full scope**, **expected outcomes**, and **eligibility conditions**
- Verify the **budget per project**, **number of projects funded**, **type of action** (RIA/IA/CSA/EIC)
- Check if the startup's profile, size (SME), technology, and sector genuinely match the call requirements
- Look for specific requirements (consortium size, geographic spread, TRL level, mandatory partners)

### Step 3 — Final ranking
From your deep research, select the TOP 15 grants that are the BEST fit for "${ragioneSociale}".

For each grant provide:
- **rating**: integer 0–100 based on real eligibility and scope match (not just keyword overlap)
- **explanation**: 3-4 sentences with CONCRETE evidence from the work programme. Mention specific scope elements that match the startup's capabilities. Flag any risks or conditions.

After your analysis, output a JSON array of exactly 15 objects, ordered from best to worst fit:
\`\`\`json
[
  { "id": "GRANT-ID-HERE", "title": "Grant title", "rating": 85, "explanation": "..." },
  ...
]
\`\`\`

IMPORTANT:
- Use the exact grant IDs from the list above
- The JSON array must be the LAST thing you output, after all your analysis
- Be HONEST: if a grant looks good on keywords but the actual scope doesn't match, rate it low
- Prefer grants where the startup can realistically participate (correct TRL, sector, consortium role)`;
}

export async function rankOpportunities(
  profile: ProfileData | null,
  schedaEU: string,
  grants: SearchResult[],
  settings: AppSettings,
  onChunk?: ((text: string) => void) | null
): Promise<RankingResult> {
  const bin = resolveCopilotBin(settings?.copilotPath);
  const prompt = buildRankingPrompt(profile, schedaEU, grants);
  const raw = await spawnPrompt(bin, prompt, resolveModel(), onChunk ?? null);

  // Extract JSON array from response (may be wrapped in ```json ... ```)
  const jsonMatch = raw.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (!jsonMatch) {
    return { rankings: [], rawResponse: raw };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      id?: string;
      title?: string;
      rating?: number;
      explanation?: string;
    }>;

    const rankings = parsed
      .filter(item => item.id && typeof item.rating === 'number')
      .slice(0, 15)
      .map(item => ({
        id: item.id!,
        title: item.title ?? '',
        rating: Math.min(100, Math.max(0, item.rating!)),
        explanation: item.explanation ?? ''
      }));

    return { rankings, rawResponse: raw };
  } catch {
    return { rankings: [], rawResponse: raw };
  }
}

export async function analyzeGrant(
  profile: ProfileData | null,
  schedaEU: string,
  grant: SearchResult,
  settings: AppSettings
): Promise<{ analysis: string; fitScore: number }> {
  const bin = resolveCopilotBin(settings?.copilotPath);
  const raw = await spawnPrompt(bin, buildGrantAnalysisPrompt(profile, schedaEU, grant), resolveModel(), null);
  const match = raw.match(/PUNTEGGIO_PARTNER:\s*(\d+)/);
  const fitScore = match ? Math.min(100, parseInt(match[1])) : 50;
  const analysis = raw.replace(/\nPUNTEGGIO_PARTNER:\s*\d+\s*$/, '').trimEnd();
  return { analysis, fitScore };
}
