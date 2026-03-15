import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import type { ProfileData, AppSettings, HealthCheckResult, ModelCheckResult, SearchResult } from './types';

const OPUS_MODEL_IDS = ['claude-opus-4.6', 'claude-opus-4.6-fast', 'claude-opus-4.5'];
const REQUIRED_MODEL = 'claude-opus-4.6';
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
    return { currentModel, isOpus, required: REQUIRED_MODEL };
  } catch {
    return { currentModel: 'unknown', isOpus: null, required: REQUIRED_MODEL };
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
      else reject(new Error(`Copilot exit ${code}: ${stderr.trim().substring(0, 300) || 'nessun output'}`));
    });
    proc.on('error', (err: Error) => reject(new Error(`Impossibile avviare copilot: ${err.message}`)));
  });
}

export async function generateSchedaEU(rawProfile: ProfileData, settings: AppSettings, onChunk: (text: string) => void): Promise<string> {
  const bin = resolveCopilotBin(settings?.copilotPath);
  return spawnPrompt(bin, buildSchedaPrompt(rawProfile), REQUIRED_MODEL, onChunk);
}

export async function extractKeywords(schedaEU: string, settings: AppSettings): Promise<string[]> {
  const bin = resolveCopilotBin(settings?.copilotPath);
  const result = await spawnPrompt(bin, buildKeywordsPrompt(schedaEU), REQUIRED_MODEL, null);
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
  return `Sei un esperto di finanziamenti europei. Analizza il seguente profilo aziendale e genera una "Scheda Riassuntiva Europea" strutturata in italiano.

La scheda deve includere:
1. **Descrizione sintetica** dell'azienda (max 150 parole)
2. **Tecnologie chiave** (lista puntata)
3. **Mercato target**
4. **Programmi EU potenzialmente rilevanti** (Horizon Europe, Digital Europe, EIC Accelerator, COSME, ecc.)
5. **Punti di forza per i bandi europei**
6. **Keywords per ricerca bandi** (10-15 termini in inglese, formato JSON array)

---
PROFILO AZIENDALE:
Ragione Sociale: ${profile.ragioneSociale}
Sito web: ${profile.url ?? 'N/D'}
Descrizione: ${profile.description ?? 'N/D'}
Testo estratto dal sito:
${profile.rawText ?? 'N/D'}
---

Rispondi SOLO con la scheda strutturata, senza preamboli.`;
}

function buildKeywordsPrompt(schedaEU: string): string {
  return `Dalla seguente scheda aziendale europea, estrai le 10-15 keyword piu rilevanti per cercare bandi EU sul portale Funding & Tenders.
Restituisci SOLO un JSON array di stringhe in inglese, senza altri testi.
Esempio: ["artificial intelligence", "green technology", "SME", "digitalization"]

SCHEDA:
${schedaEU}

OUTPUT:`;
}

function buildBandoAnalysisPrompt(profile: ProfileData | null, schedaEU: string, bando: SearchResult): string {
  const ragioneSociale = profile?.ragioneSociale ?? 'N/D';
  return `Sei un esperto di finanziamenti europei. Analizza la compatibilità tra la startup e il bando EU indicato.

## Profilo Startup
Ragione Sociale: ${ragioneSociale}
${schedaEU ? `\nScheda EU:\n${schedaEU.substring(0, 1500)}` : ''}

## Bando EU
Titolo: ${bando.title}
Programma: ${bando.programme || 'N/D'}
Stato: ${bando.status || 'N/D'}
${bando.deadline ? `Scadenza: ${bando.deadline}` : ''}
${bando.budget ? `Budget: ${bando.budget}` : ''}
${bando.description ? `Descrizione: ${bando.description}` : ''}
URL: ${bando.portalUrl}

## Analisi richiesta (in italiano, formato Markdown)
1. **Compatibilità** — Quanto è adatto questo bando alla startup? (Alta/Media/Bassa + spiegazione)
2. **Ruolo del partner** — Come potrebbe partecipare la startup (capofila, partner tecnico, ecc.)?
3. **Modalità di finanziamento** — Contributo a fondo perduto, loan, equity?
4. **Durata e tempistiche** — Stima di durata progetto e scadenza candidatura
5. **Informazioni chiave** — 3-5 bullet point con i requisiti/vincoli più importanti

Rispondi SOLO con l'analisi strutturata in Markdown, senza preamboli.`;
}

export async function analyzeBando(
  profile: ProfileData | null,
  schedaEU: string,
  bando: SearchResult,
  settings: AppSettings
): Promise<string> {
  const bin = resolveCopilotBin(settings?.copilotPath);
  return spawnPrompt(bin, buildBandoAnalysisPrompt(profile, schedaEU, bando), REQUIRED_MODEL, null);
}
