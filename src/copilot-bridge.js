'use strict';

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const OPUS_MODEL_IDS = ['claude-opus-4.6', 'claude-opus-4.6-fast', 'claude-opus-4.5'];
const REQUIRED_MODEL = 'claude-opus-4.6';
const CONFIG_PATH = path.join(os.homedir(), '.copilot', 'config.json');

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, '');
}

function parseVersion(raw) {
  const first = stripAnsi(raw).split('\n')[0].trim();
  const match = first.match(/\d+\.\d+\.\d+[\w.-]*/);
  return match ? match[0] : first.replace(/run .* to check for updates\.?/gi, '').trim() || 'OK';
}

function resolveCopilotBin(customPath) {
  if (customPath) return customPath;
  const candidates = [
    '/opt/homebrew/bin/copilot',
    path.join(os.homedir(), '.local', 'bin', 'copilot'),
    '/usr/local/bin/copilot',
    'copilot'
  ];
  return candidates.find(p => {
    try { fs.accessSync(p); return true; } catch { return false; }
  }) || 'copilot';
}

function runCommand(bin, args, opts) {
  const timeout = (opts && opts.timeout) || 10000;
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { shell: false });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => {
      proc.stdin.destroy();
      proc.stdout.destroy();
      reject(new Error('Timeout'));
    }, timeout);
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`exit ${code}: ${(stderr || stdout).trim().substring(0, 200)}`));
    });
    proc.on('error', err => { clearTimeout(timer); reject(new Error(err.message)); });
  });
}

// ─── Health Check ──────────────────────────────────────────────────────────────

async function healthCheck(customPath) {
  const bin = resolveCopilotBin(customPath);
  try {
    const { stdout } = await runCommand(bin, ['--version'], { timeout: 8000 });
    return { ok: true, version: parseVersion(stdout), bin };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── Model Check (reads ~/.copilot/config.json) ────────────────────────────────

async function checkModel(customPath) {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const currentModel = config.model || 'unknown';
    const isOpus = OPUS_MODEL_IDS.some(id => currentModel.toLowerCase() === id.toLowerCase());
    return { currentModel, isOpus, required: REQUIRED_MODEL };
  } catch {
    return { currentModel: 'unknown', isOpus: null, required: REQUIRED_MODEL };
  }
}

// ─── Prompt Runner ─────────────────────────────────────────────────────────────
// copilot --prompt "..." --model claude-opus-4.6 --allow-all-tools --output-format text
// --allow-all-tools is required for non-interactive mode (no stdin approval prompts)

function spawnPrompt(bin, prompt, model, onChunk) {
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
    proc.stdout.on('data', chunk => {
      const text = stripAnsi(chunk.toString());
      fullOutput += text;
      if (onChunk) onChunk(text);
    });
    proc.stderr.on('data', d => { stderr += stripAnsi(d.toString()); });
    proc.on('close', code => {
      const out = fullOutput.trim();
      if (out.length > 0) resolve(out);
      else reject(new Error(`Copilot exit ${code}: ${stderr.trim().substring(0, 300) || 'nessun output'}`));
    });
    proc.on('error', err => reject(new Error(`Impossibile avviare copilot: ${err.message}`)));
  });
}

// ─── Public API ────────────────────────────────────────────────────────────────

async function generateSchedaEU(rawProfile, settings, onChunk) {
  const bin = resolveCopilotBin(settings && settings.copilotPath);
  return spawnPrompt(bin, buildSchedaPrompt(rawProfile), REQUIRED_MODEL, onChunk);
}

async function extractKeywords(schedaEU, settings) {
  const bin = resolveCopilotBin(settings && settings.copilotPath);
  const result = await spawnPrompt(bin, buildKeywordsPrompt(schedaEU), REQUIRED_MODEL, null);
  const match = result.match(/\[[\s\S]*?\]/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  return result
    .split(/[\n,]+/)
    .map(s => s.trim().replace(/^["'\-\u2022*\d.]+|["']+$/g, ''))
    .filter(s => s.length > 2 && s.length < 60)
    .slice(0, 15);
}

// ─── Prompts ───────────────────────────────────────────────────────────────────

function buildSchedaPrompt(profile) {
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
Sito web: ${profile.url || 'N/D'}
Descrizione: ${profile.description || 'N/D'}
Testo estratto dal sito:
${profile.rawText || 'N/D'}
---

Rispondi SOLO con la scheda strutturata, senza preamboli.`;
}

function buildKeywordsPrompt(schedaEU) {
  return `Dalla seguente scheda aziendale europea, estrai le 10-15 keyword piu rilevanti per cercare bandi EU sul portale Funding & Tenders.
Restituisci SOLO un JSON array di stringhe in inglese, senza altri testi.
Esempio: ["artificial intelligence", "green technology", "SME", "digitalization"]

SCHEDA:
${schedaEU}

OUTPUT:`;
}

module.exports = { healthCheck, checkModel, generateSchedaEU, extractKeywords };
