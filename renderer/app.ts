/// <reference path="./types/eu-match.d.ts" />
'use strict';

// ─── State ───────────────────────────────────────────────────────────────────
interface AppState {
  currentProfile: ProfileData | null;
  schedaEU: string;
  keywords: string[];
  bandiResults: SearchResult[];
  bandoAnalyses: Record<string, { analysis: string; savedAt: string }>;
  logErrorCount: number;
}

const state: AppState = {
  currentProfile: null,
  schedaEU: '',
  keywords: [],
  bandiResults: [],
  bandoAnalyses: {},
  logErrorCount: 0
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}
function show(id: string): void { $(id).classList.remove('hidden'); }
function hide(id: string): void { $(id).classList.add('hidden'); }
function toggle(id: string, visible: boolean): void { visible ? show(id) : hide(id); }
function setAlert(id: string, type: string, text: string): void {
  const el = $(id);
  el.className = `alert alert-${type}`;
  el.innerHTML = text;
  show(id);
}

// ─── App Log ──────────────────────────────────────────────────────────────────
const LOG_ICONS: Record<string, string> = {
  info: 'ℹ️', success: '✅', warn: '⚠️', error: '❌',
  api: '🌐', copilot: '🤖', storage: '💾'
};

function appLog(level: string, message: string, detail = ''): void {
  const panel = $('appLogPanel');
  const empty = panel.querySelector('.log-empty');
  if (empty) empty.remove();

  const ts = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const icon = LOG_ICONS[level] || 'ℹ️';

  const entry = document.createElement('div');
  entry.className = `log-entry level-${level}`;
  entry.innerHTML = `
    <span class="log-ts">${ts}</span>
    <span class="log-icon">${icon}</span>
    <span class="log-msg">${escHtml(message)}</span>
    ${detail ? `<span class="log-detail">${escHtml(detail)}</span>` : ''}
  `;
  panel.appendChild(entry);
  panel.scrollTop = panel.scrollHeight;

  if (level === 'error') {
    state.logErrorCount++;
    const badge = $('logErrorCount');
    badge.textContent = state.logErrorCount.toString();
    badge.classList.remove('hidden');
  }
}

window.euMatch.onLog((entry: LogEntry) => {
  appLog(entry.level, entry.message, entry.detail ?? '');
});

$('btnClearLog').addEventListener('click', () => {
  $('appLogPanel').innerHTML = '<div class="log-empty">Log pulito.</div>';
  state.logErrorCount = 0;
  $('logErrorCount').textContent = '0';
  $('logErrorCount').classList.add('hidden');
});

$('btnCopyLog').addEventListener('click', () => {
  const lines = [...$('appLogPanel').querySelectorAll('.log-entry')].map(el => {
    const ts  = el.querySelector('.log-ts')?.textContent ?? '';
    const msg = el.querySelector('.log-msg')?.textContent ?? '';
    const det = el.querySelector('.log-detail')?.textContent ?? '';
    return det ? `${ts} ${msg}\n      ${det}` : `${ts} ${msg}`;
  });
  navigator.clipboard.writeText(lines.join('\n'));
});

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = (btn as HTMLElement).dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(`tab-${tab}`).classList.add('active');
  });
});

function switchToTab(name: string): void {
  document.querySelectorAll('.tab-btn').forEach(b => {
    (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset.tab === name);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === `tab-${name}`);
  });
}

// ─── Boot: Copilot Health Check ───────────────────────────────────────────────
async function runHealthCheck(): Promise<void> {
  const dot = $('statusDot');
  const txt = $('statusText');

  try {
    const health = await window.euMatch.copilotHealthCheck();
    if (!health.ok) {
      dot.className = 'status-dot err';
      txt.textContent = 'Copilot CLI non trovato';
      setAlert('copilotHealthStatus', 'error',
        `❌ Copilot CLI non trovato. Installa con: <code>brew install gh && gh extension install github/gh-copilot</code>`);
      return;
    }

    const model = await window.euMatch.copilotCheckModel();
    dot.className = 'status-dot ok';
    const modelLabel = model.currentModel && model.currentModel !== 'unknown' ? ` — ${model.currentModel}` : '';
    txt.textContent = `Copilot ${health.version}${modelLabel}`;
    setAlert('copilotHealthStatus', 'success',
      `✅ Copilot CLI rilevato (v${health.version}). Modello attivo: <strong>${model.currentModel !== 'unknown' ? model.currentModel : 'non rilevato'}</strong>`);

    if (model.isOpus === false) {
      const label = $('currentModelLabel');
      if (label) label.textContent = model.currentModel || 'sconosciuto';
      show('modelModal');
    }
  } catch (err) {
    dot.className = 'status-dot err';
    txt.textContent = 'Errore verifica Copilot';
    setAlert('copilotHealthStatus', 'error', `❌ ${(err as Error).message}`);
  }
}

// ─── Recent Profiles ──────────────────────────────────────────────────────────
async function renderRecentProfiles(): Promise<void> {
  const list = await window.euMatch.listProfiles();
  const el = $('recentList');
  if (!list || list.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div>Nessun profilo salvato.</div>`;
    return;
  }
  el.innerHTML = `<div class="recent-list">${list.map(p => `
    <div class="recent-item" data-name="${escHtml(p.ragioneSociale)}">
      <span class="recent-name">${escHtml(p.ragioneSociale)}</span>
      <span class="recent-date">${fmtDate(p.lastUpdated)}</span>
    </div>
  `).join('')}</div>`;

  el.querySelectorAll('.recent-item').forEach(item => {
    item.addEventListener('click', () => {
      ($('ragioneSociale') as HTMLInputElement).value = (item as HTMLElement).dataset.name ?? '';
      loadCachedProfile((item as HTMLElement).dataset.name ?? '');
    });
  });
}

function escHtml(str: string | undefined | null): string {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Profile Build ────────────────────────────────────────────────────────────
$('btnProfila').addEventListener('click', async () => {
  const ragioneSociale = ($('ragioneSociale') as HTMLInputElement).value.trim();
  if (!ragioneSociale) {
    $('ragioneSociale').focus();
    return;
  }
  const url = ($('websiteUrl') as HTMLInputElement).value.trim();
  await buildProfile(ragioneSociale, url);
});

async function loadCachedProfile(ragioneSociale: string): Promise<void> {
  const cached = await window.euMatch.loadProfile(ragioneSociale);
  if (cached) {
    ($('websiteUrl') as HTMLInputElement).value = cached.url ?? '';
    state.currentProfile = cached;
    renderProfileData(cached, true);
  }
}

async function buildProfile(ragioneSociale: string, url: string): Promise<void> {
  const logEl = $('liveLog');
  const startTs = Date.now();
  let lineCount = 0;

  function appendLog({ icon, msg }: { icon: string; msg: string }): void {
    const elapsed = ((Date.now() - startTs) / 1000).toFixed(1).padStart(5, '0');
    const typeMap: Record<string, string> = { '✅': 'ok', '⚠️': 'warn', '❌': 'err', '💾': 'save', '⏳': 'info', 'ℹ️': 'info' };
    const cls = typeMap[icon] || 'info';

    logEl.querySelectorAll('.log-cursor').forEach(c => c.remove());

    const line = document.createElement('div');
    line.className = `log-line ${cls}`;
    line.innerHTML = `<span class="log-ts">${elapsed}s</span><span class="log-msg">${icon} ${escHtml(msg)}<span class="log-cursor"></span></span>`;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
    lineCount++;
  }

  logEl.innerHTML = '';
  $('profileLoadingText').textContent = 'Profilazione in corso…';
  show('profileLoading');
  hide('profileResult');

  window.euMatch.onProfileProgress(appendLog);

  try {
    const profile = await window.euMatch.buildProfile(ragioneSociale, url);
    logEl.querySelectorAll('.log-cursor').forEach(c => c.remove());
    state.currentProfile = profile;
    renderProfileData(profile, profile.fromCache);
    await renderRecentProfiles();
  } catch (err) {
    appendLog({ icon: '❌', msg: (err as Error).message });
  } finally {
    window.euMatch.removeProfileProgressListener();
    hide('profileLoading');
  }
}

function renderProfileData(profile: ProfileData, fromCache: boolean): void {
  const fields: Array<{ label: string; value: string; full?: boolean }> = [
    { label: 'Ragione Sociale', value: profile.ragioneSociale },
    { label: 'P.IVA / Numero', value: profile.piva || '—' },
    { label: 'Giurisdizione', value: (profile.jurisdiction || 'IT').toUpperCase() },
    { label: 'Costituita il', value: fmtDate(profile.incorporatedOn) },
    { label: 'Sito Web', value: profile.url || '—' },
    { label: 'Aggiornato', value: fmtDate(profile.lastUpdated ?? profile.scrapedAt) },
    { label: 'Titolo Pagina', value: profile.pageTitle || '—', full: true },
    { label: 'Descrizione', value: profile.description || '—', full: true }
  ];

  $('profileGrid').innerHTML = fields.map(f => `
    <div class="data-item${f.full ? ' full' : ''}" style="${f.full ? 'grid-column:1/-1' : ''}">
      <div class="data-label">${f.label}</div>
      <div class="data-value${!f.value || f.value === '—' ? ' empty' : ''}">${escHtml(f.value)}</div>
    </div>
  `).join('');

  toggle('fromCacheBadge', fromCache);
  show('profileResult');

  if (profile.schedaEU) {
    state.schedaEU = profile.schedaEU;
    state.keywords = profile.keywords ?? [];
    renderScheda(profile.schedaEU, profile.keywords ?? []);
  }
}

// ─── Clear Cache ──────────────────────────────────────────────────────────────
$('btnClearProfile').addEventListener('click', async () => {
  const name = ($('ragioneSociale') as HTMLInputElement).value.trim();
  if (!name) return;
  await window.euMatch.deleteProfile(name);
  hide('profileResult');
  state.currentProfile = null;
  await renderRecentProfiles();
});

// ─── Generate Scheda EU ───────────────────────────────────────────────────────
$('btnGeneraScheda').addEventListener('click', async () => {
  if (!state.currentProfile) return;

  switchToTab('scheda');

  const btn = $('btnGeneraScheda') as HTMLButtonElement;
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Generazione in corso…';

  try {
    await generateScheda(state.currentProfile);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>🤖</span> Genera Scheda EU con Copilot';
  }
});

async function generateScheda(profile: ProfileData): Promise<void> {
  show('schedaLoading');
  hide('schedaInfo');
  hide('keywordsCard');
  hide('schedaSubTabs');
  hide('schedaPreviewPanel');
  hide('schedaSourcePanel');
  hide('btnDownloadMd');

  appLog('copilot', `Generazione Scheda EU per "${profile.ragioneSociale}"…`);

  const sourceEl = $('schedaSource');
  const previewEl = $('schedaContent');
  sourceEl.textContent = '';
  previewEl.innerHTML = '';
  show('schedaSubTabs');
  activateSubTab('source');

  window.euMatch.onCopilotChunk((text: string) => {
    sourceEl.textContent += text;
    sourceEl.scrollTop = sourceEl.scrollHeight;
  });

  try {
    const result = await window.euMatch.generateSchedaEU(profile);

    if (!result.ok) {
      setAlert('schedaInfo', 'error', `❌ Errore Copilot: ${result.error}`);
      show('schedaInfo');
      hide('schedaSubTabs');
    } else {
      renderScheda(result.schedaEU ?? '', result.keywords ?? []);
      state.schedaEU = result.schedaEU ?? '';
      state.keywords = result.keywords ?? [];
    }
  } catch (err) {
    setAlert('schedaInfo', 'error', `❌ ${(err as Error).message}`);
    show('schedaInfo');
  } finally {
    hide('schedaLoading');
    window.euMatch.removeCopilotChunkListener();
  }
}

function renderScheda(schedaText: string, keywords: string[]): void {
  hide('schedaInfo');

  const previewEl = $('schedaContent');
  const sourceEl  = $('schedaSource');

  previewEl.innerHTML = window.marked ? window.marked.parse(schedaText) : schedaText.replace(/\n/g, '<br>');
  sourceEl.textContent = schedaText;

  show('schedaSubTabs');
  activateSubTab('preview');
  show('btnDownloadMd');

  ($('btnDownloadMd') as HTMLElement).dataset.content = schedaText;

  if (keywords && keywords.length > 0) {
    $('keywordsList').innerHTML = keywords.map(kw =>
      `<span class="keyword-chip">${escHtml(kw)}</span>`
    ).join('');
    show('keywordsCard');
  }
}

// ─── Sub-tab switching ─────────────────────────────────────────────────────────
function activateSubTab(name: string): void {
  document.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.subtab === name);
  });
  toggle('schedaPreviewPanel', name === 'preview');
  toggle('schedaSourcePanel', name === 'source');
}

document.querySelectorAll('.sub-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => activateSubTab((btn as HTMLElement).dataset.subtab ?? ''));
});

// ─── Download MD ───────────────────────────────────────────────────────────────
$('btnDownloadMd').addEventListener('click', () => {
  const content  = $('schedaSource').textContent ?? '';
  const filename = `${(state.currentProfile?.ragioneSociale ?? 'scheda').replace(/\s+/g, '_')}_scheda_eu.md`;
  const blob = new Blob([content], { type: 'text/markdown' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
});

// ─── Search Bandi ─────────────────────────────────────────────────────────────
$('btnCercaBandi').addEventListener('click', async () => {
  switchToTab('bandi');
  await searchBandi();
});

$('btnSearch').addEventListener('click', () => { searchBandi(); });

// Re-search automatically when any filter changes
['programmePeriod', 'bandiStatus', 'bandiLanguage', 'bandiProgramme'].forEach(id => {
  $(id).addEventListener('change', () => {
    if (state.keywords && state.keywords.length > 0) searchBandi();
  });
});

async function searchBandi(): Promise<void> {
  if (!state.keywords || state.keywords.length === 0) {
    show('bandiEmpty');
    return;
  }

  hide('bandiEmpty');
  show('bandiLoading');
  $('bandiResults').innerHTML = '';

  const period    = ($('programmePeriod') as HTMLSelectElement).value;
  const statusKey = ($('bandiStatus') as HTMLSelectElement).value;
  const language  = ($('bandiLanguage') as HTMLSelectElement).value;
  const programme = ($('bandiProgramme') as HTMLSelectElement).value;

  appLog('api', `Ricerca bandi — stato: ${statusKey}, programma: ${programme}, lingua: ${language}`);

  try {
    const res = await window.euMatch.searchFunding(state.keywords, {
      programmePeriod: period,
      statusKey,
      language,
      programme
    });

    hide('bandiLoading');

    if (!res.ok || !res.results || res.results.length === 0) {
      $('bandiResults').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          ${res.error ? `Errore API: ${escHtml(res.error)}` : 'Nessun bando trovato per le keyword fornite.'}
        </div>`;
      return;
    }

    state.bandiResults = res.results;
    const ragioneSociale = state.currentProfile?.ragioneSociale ?? '';
    if (ragioneSociale) {
      state.bandoAnalyses = await window.euMatch.loadBandoAnalyses(ragioneSociale);
    }
    renderBandi(res.results, res.total ?? 0, res.isClosed ?? false);
    $('bandiCount').textContent = res.results.length.toString();
    $('bandiCount').classList.remove('hidden');
  } catch (err) {
    hide('bandiLoading');
    $('bandiResults').innerHTML = `<div class="alert alert-error">❌ ${escHtml((err as Error).message)}</div>`;
  }
}

function renderBandi(results: SearchResult[], total: number, isClosed = false): void {
  const sorted = [...results].sort((a, b) => b.matchingScore - a.matchingScore);
  const cached = state.bandoAnalyses ?? {};

  const closedBanner = isClosed
    ? `<div class="alert alert-warning" style="margin-bottom:12px">
         📁 Stai visualizzando bandi <strong>scaduti</strong>.
         Per i bandi scaduti puoi vedere i partner che hanno partecipato tramite CORDIS.
       </div>`
    : '';

  const header = `
    <div class="results-header">
      ${closedBanner}
      <span class="results-count">Trovati <strong>${total}</strong> bandi — mostrati ${sorted.length} per rilevanza</span>
    </div>`;

  const cards = sorted.map((b, i) => {
    const score = b.matchingScore;
    const scoreClass  = score >= 60 ? 'score-high' : score >= 30 ? 'score-mid' : 'score-low';
    const isExpired   = isClosed;
    const statusLabel = isExpired ? '📁 Scaduto' : (b.status || 'N/D');
    const statusClass = isExpired ? 'status-unknown'
      : b.status.includes('31094501') ? 'status-open'
      : b.status.includes('31094502') ? 'status-forthcoming' : 'status-unknown';
    const hasCached   = !!(cached[b.id]);
    const btnLabel    = hasCached ? '📋 Mostra Analisi Salvata' : '🤖 Analizza per la mia startup';
    const savedBadge  = hasCached ? '<span class="analysis-cached-badge">💾 Salvata</span>' : '';

    const beneficiariesBtn = isExpired && b.beneficiariesUrl
      ? `<a class="btn btn-secondary btn-sm" data-href="${escHtml(b.beneficiariesUrl)}" style="text-decoration:none">
           👥 Vedi Partner su CORDIS
         </a>`
      : '';

    const analysisHtml = hasCached
      ? `<div class="bando-analysis" id="bando-analysis-${i}" data-done="1">
           <div class="analysis-content md-preview">${window.marked ? window.marked.parse(cached[b.id].analysis) : escHtml(cached[b.id].analysis)}</div>
           <div class="analysis-footer">💾 Salvata il ${escHtml(fmtDate(cached[b.id].savedAt))}</div>
         </div>`
      : `<div class="bando-analysis hidden" id="bando-analysis-${i}"></div>`;

    return `
      <div class="bando-card${isExpired ? ' bando-expired' : ''}" id="bando-card-${i}">
        <div style="flex:1;min-width:0">
          <div class="bando-title">${escHtml(b.title)}</div>
          <div class="bando-meta">
            <span>🏛️ ${escHtml(b.programme || 'N/D')}</span>
            ${b.deadline ? `<span>📅 ${escHtml(fmtDate(b.deadline))}</span>` : ''}
            ${b.budget   ? `<span>💰 ${escHtml(b.budget)}</span>` : ''}
            <span class="status-badge ${statusClass}">${escHtml(statusLabel)}</span>
            ${savedBadge}
          </div>
          ${b.description ? `<div class="bando-desc">${escHtml(b.description)}…</div>` : ''}
          <div class="bando-actions">
            <a class="btn btn-secondary btn-sm" data-href="${escHtml(b.portalUrl)}" style="text-decoration:none">
              🔗 Apri nel Portale EU
            </a>
            ${beneficiariesBtn}
            <button class="btn btn-primary btn-sm btn-analizza" data-idx="${i}">${btnLabel}</button>
          </div>
          ${analysisHtml}
        </div>
        <div class="bando-score-box">
          <div class="score-circle ${scoreClass}">${score}%</div>
          <div class="score-label">Match<br>Score</div>
        </div>
      </div>`;
  }).join('');

  $('bandiResults').innerHTML = header + cards;

  $('bandiResults').querySelectorAll('a[data-href]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      window.open((a as HTMLElement).dataset.href, '_blank');
    });
  });

  $('bandiResults').querySelectorAll('.btn-analizza').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx   = parseInt((btn as HTMLElement).dataset.idx ?? '0');
      const bando = sorted[idx];
      runBandoAnalysis(btn as HTMLButtonElement, idx, bando);
    });
  });
}

async function runBandoAnalysis(btn: HTMLButtonElement, idx: number, bando: SearchResult): Promise<void> {
  const analysisEl = $(`bando-analysis-${idx}`);

  // Cached — toggle visibility
  if ((analysisEl as HTMLElement & { dataset: DOMStringMap }).dataset.done === '1') {
    analysisEl.classList.toggle('hidden');
    btn.textContent = analysisEl.classList.contains('hidden') ? '📋 Mostra Analisi Salvata' : '📋 Nascondi Analisi';
    return;
  }

  const ragioneSociale = state.currentProfile?.ragioneSociale ?? '';
  btn.disabled = true;
  btn.textContent = '⏳ Analisi in corso…';
  show(`bando-analysis-${idx}`);
  analysisEl.innerHTML = '<div class="analysis-loading"><div class="spinner"></div><span>Copilot sta analizzando il bando…</span></div>';
  appLog('copilot', `Analisi bando: "${bando.title.substring(0, 60)}…"`);

  const res = await window.euMatch.analyzeBando(bando, ragioneSociale);

  if (res.ok && res.analysis) {
    const html = window.marked ? window.marked.parse(res.analysis) : escHtml(res.analysis);
    analysisEl.innerHTML = `
      <div class="analysis-content md-preview">${html}</div>
      <div class="analysis-footer">💾 Salvata ora — ricaricata automaticamente per questa startup</div>`;
    (analysisEl as HTMLElement & { dataset: DOMStringMap }).dataset.done = '1';
    state.bandoAnalyses[bando.id] = { analysis: res.analysis, savedAt: new Date().toISOString() };
    btn.textContent = '📋 Nascondi Analisi';
    appLog('success', `Analisi bando salvata: ${bando.id}`);
  } else {
    analysisEl.innerHTML = `<div class="alert alert-error">❌ ${escHtml(res.error ?? 'Errore sconosciuto')}</div>`;
    btn.textContent = '🤖 Riprova Analisi';
    appLog('error', `Errore analisi bando: ${res.error}`);
  }
  btn.disabled = false;
}

// ─── Settings ─────────────────────────────────────────────────────────────────
async function loadSettings(): Promise<void> {
  const s = await window.euMatch.getSettings();
  if (s.copilotPath) ($('copilotPath') as HTMLInputElement).value = s.copilotPath;
}

$('btnSaveSettings').addEventListener('click', async () => {
  const settings = { copilotPath: ($('copilotPath') as HTMLInputElement).value.trim() };
  await window.euMatch.saveSettings(settings);
  setAlert('copilotHealthStatus', 'success', '✅ Impostazioni salvate.');
  await runHealthCheck();
});

$('btnRecheckCopilot').addEventListener('click', () => { runHealthCheck(); });

// ─── Credentials ──────────────────────────────────────────────────────────────
$('btnSaveCreds').addEventListener('click', async () => {
  const u = ($('euUsername') as HTMLInputElement).value.trim();
  const p = ($('euPassword') as HTMLInputElement).value;
  if (!u || !p) {
    setAlert('credStatus', 'warning', '⚠️ Inserisci username e password.');
    return;
  }
  const res = await window.euMatch.saveCredentials(u, p);
  setAlert('credStatus', res.ok ? 'success' : 'error',
    res.ok ? '🔐 Credenziali salvate in modo sicuro.' : `❌ ${res.error}`);
  ($('euPassword') as HTMLInputElement).value = '';
});

$('btnLoadCreds').addEventListener('click', async () => {
  const res = await window.euMatch.loadCredentials();
  if (res.ok && res.data) {
    ($('euUsername') as HTMLInputElement).value = res.data.username;
    ($('euPassword') as HTMLInputElement).value = '••••••••';
    setAlert('credStatus', 'info', `📂 Credenziali caricate per: ${escHtml(res.data.username)}`);
  } else {
    setAlert('credStatus', 'warning', '⚠️ Nessuna credenziale salvata.');
  }
});

$('btnClearCreds').addEventListener('click', async () => {
  await window.euMatch.clearCredentials();
  ($('euUsername') as HTMLInputElement).value = '';
  ($('euPassword') as HTMLInputElement).value = '';
  setAlert('credStatus', 'success', '🗑️ Credenziali eliminate.');
  appLog('storage', 'Credenziali EU Login eliminate.');
});

$('btnTestAuth').addEventListener('click', async () => {
  const btn = $('btnTestAuth') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = '⏳ Test in corso…';
  setAlert('credStatus', 'info', '🔌 Test connessione EU in corso…');
  appLog('api', 'Test connessione EU avviato…');

  try {
    const conn = await window.euMatch.testEuConnectivity();
    appLog(conn.ok ? 'success' : 'error', `API EU pubblica: ${conn.message}`, `HTTP ${conn.status}`);

    const auth = await window.euMatch.testEuAuth();
    if (auth.ok) {
      setAlert('credStatus', 'success', '✅ API EU raggiungibile. Credenziali EU Login valide.');
      appLog('success', 'EU Login: credenziali verificate con successo.');
    } else {
      setAlert('credStatus', conn.ok ? 'warning' : 'error',
        `${conn.ok ? '✅ API EU raggiungibile.' : '❌ API EU non raggiungibile.'} ${auth.error}`);
      appLog('warn', `EU Login: ${auth.error}`);
    }

    switchToTab('log');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔌 Verifica Connessione EU';
  }
});

// ─── Copilot Model Modal ───────────────────────────────────────────────────────
$('btnDismissModal').addEventListener('click', () => hide('modelModal'));
$('btnRecheckModal').addEventListener('click', async () => {
  hide('modelModal');
  await runHealthCheck();
});

// ─── Auto-save URL on blur ────────────────────────────────────────────────────
$('websiteUrl').addEventListener('blur', async () => {
  const ragioneSociale = ($('ragioneSociale') as HTMLInputElement).value.trim();
  const url = ($('websiteUrl') as HTMLInputElement).value.trim();
  if (!ragioneSociale || !url) return;
  await window.euMatch.updateProfile(ragioneSociale, { url });
  if (state.currentProfile && state.currentProfile.ragioneSociale === ragioneSociale) {
    state.currentProfile.url = url;
  }
});

// ─── Enter key for profile form ───────────────────────────────────────────────
['ragioneSociale', 'websiteUrl'].forEach(id => {
  $(id).addEventListener('keydown', (e: Event) => {
    if ((e as KeyboardEvent).key === 'Enter') ($('btnProfila') as HTMLButtonElement).click();
  });
});

// ─── Init ─────────────────────────────────────────────────────────────────────
(async function init(): Promise<void> {
  await loadSettings();
  await renderRecentProfiles();
  await runHealthCheck();
})();
