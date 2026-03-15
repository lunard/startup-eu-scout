'use strict';

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const OPUS_MODEL_IDS = ['claude-opus-4-6', 'claude-opus-4.6', 'opus-4-6', 'opus'];
const REQUIRED_MODEL = 'claude-opus-4-6';

function parseVersion(raw) {
  // Extract only the version number/tag from the first line, drop update notices
  const first = raw.split('\n')[0].trim();
  const match = first.match(/[\d]+\.[\d]+\.[\d]+[\w.-]*/);
  return match ? match[0] : first.replace(/run .* to check for updates\.?/gi, '').trim() || 'OK';
}

function resolveCopilotPath(customPath) {
  if (customPath) return customPath;

  // Common install locations
  const candidates = [
    'gh',                                                           // gh copilot extension
    path.join(os.homedir(), '.copilot', 'bin', 'copilot'),
    path.join(os.homedir(), '.local', 'bin', 'copilot'),
    '/usr/local/bin/gh',
    '/opt/homebrew/bin/gh'
  ];

  return candidates[0]; // Default to 'gh', resolved by PATH
}

function runCommand(bin, args, { timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { shell: false });
    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Comando timeout (${timeout}ms): ${bin} ${args.join(' ')}`));
    }, timeout);

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', code => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Errore (exit ${code}): ${stderr || stdout}`));
      }
    });

    proc.on('error', err => {
      clearTimeout(timer);
      reject(new Error(`Impossibile eseguire '${bin}': ${err.message}`));
    });
  });
}

async function healthCheck(customPath) {
  const bin = resolveCopilotPath(customPath);

  try {
    // Try gh copilot first
    const res = await runCommand(bin, ['copilot', '--version'], { timeout: 8000 });
    return { ok: true, version: parseVersion(res.stdout), mode: 'gh-extension' };
  } catch {
    try {
      // Fallback: standalone copilot binary
      const res = await runCommand('copilot', ['--version'], { timeout: 8000 });
      return { ok: true, version: parseVersion(res.stdout), mode: 'standalone' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

async function checkModel(customPath) {
  const bin = resolveCopilotPath(customPath);

  try {
    const res = await runCommand(bin, ['copilot', 'config', 'get', 'model'], { timeout: 8000 });
    const model = res.stdout.trim().toLowerCase();
    const isOpus = OPUS_MODEL_IDS.some(id => model.includes(id));
    return { currentModel: res.stdout.trim(), isOpus, required: REQUIRED_MODEL };
  } catch {
    // Model config might not be queryable this way; return unknown
    return { currentModel: 'unknown', isOpus: null, required: REQUIRED_MODEL };
  }
}

function sendPromptStreaming(bin, prompt, onChunk) {
  return new Promise((resolve, reject) => {
    const isGh = bin === 'gh' || bin.endsWith('/gh');
    const args = isGh
      ? ['copilot', 'suggest', '--target', 'shell', '--model', REQUIRED_MODEL]
      : ['--model', REQUIRED_MODEL];

    const proc = spawn(bin, args, { shell: false });
    let fullOutput = '';
    let stderr = '';

    proc.stdin.write(prompt);
    proc.stdin.end();

    proc.stdout.on('data', chunk => {
      const text = chunk.toString();
      fullOutput += text;
      if (onChunk) onChunk(text);
    });

    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', code => {
      if (code === 0 || fullOutput.length > 0) {
        resolve(fullOutput);
      } else {
        reject(new Error(`Copilot exit ${code}: ${stderr}`));
      }
    });

    proc.on('error', err => reject(new Error(`Spawn error: ${err.message}`)));
  });
}

async function generateSchedaEU(rawProfile, settings = {}) {
  const prompt = buildSchedaPrompt(rawProfile);
  const bin = resolveCopilotPath(settings.copilotPath);

  const chunks = [];
  const onChunk = text => chunks.push(text);

  const result = await sendPromptStreaming(bin, prompt, onChunk);
  return result;
}

async function extractKeywords(schedaEU, settings = {}) {
  const prompt = buildKeywordsPrompt(schedaEU);
  const bin = resolveCopilotPath(settings.copilotPath);

  const result = await sendPromptStreaming(bin, prompt, null);

  // Parse JSON array from output
  const match = result.match(/\[[\s\S]*?\]/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch { /* fall through */ }
  }

  // Fallback: split by commas or newlines
  return result
    .split(/[\n,]+/)
    .map(s => s.trim().replace(/^["'\-•*]+|["']+$/g, ''))
    .filter(s => s.length > 2 && s.length < 60)
    .slice(0, 15);
}

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

Rispondi in italiano con la scheda strutturata.`;
}

function buildKeywordsPrompt(schedaEU) {
  return `Dalla seguente scheda aziendale europea, estrai le 10-15 keyword più rilevanti per cercare bandi EU sul portale Funding & Tenders.
Restituisci SOLO un JSON array di stringhe in inglese, senza altri testi.

Esempio output: ["artificial intelligence", "green technology", "SME", "digitalization"]

SCHEDA:
${schedaEU}

OUTPUT:`;
}

module.exports = { healthCheck, checkModel, generateSchedaEU, extractKeywords, resolveCopilotPath };
