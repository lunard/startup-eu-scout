'use strict';

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  currentProfile: null,
  schedaEU: '',
  keywords: [],
  bandiResults: []
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }
function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }
function toggle(id, visible) { visible ? show(id) : hide(id); }
function setAlert(id, type, text) {
  const el = $(id);
  el.className = `alert alert-${type}`;
  el.innerHTML = text;
  show(id);
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(`tab-${tab}`).classList.add('active');
  });
});

function switchToTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === `tab-${name}`);
  });
}

// ─── Boot: Copilot Health Check ───────────────────────────────────────────────
async function runHealthCheck() {
  const dot = $('statusDot');
  const txt = $('statusText');

  try {
    const health = await window.euMatch.copilotHealthCheck();
    if (!health.ok) {
      dot.className = 'status-dot err';
      txt.textContent = `Copilot CLI non trovato`;
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
      show('modelModal');
    }
  } catch (err) {
    dot.className = 'status-dot err';
    txt.textContent = 'Errore verifica Copilot';
    setAlert('copilotHealthStatus', 'error', `❌ ${err.message}`);
  }
}

// ─── Recent Profiles ──────────────────────────────────────────────────────────
async function renderRecentProfiles() {
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
      $('ragioneSociale').value = item.dataset.name;
      loadCachedProfile(item.dataset.name);
    });
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Profile Build ────────────────────────────────────────────────────────────
$('btnProfila').addEventListener('click', async () => {
  const ragioneSociale = $('ragioneSociale').value.trim();
  if (!ragioneSociale) {
    $('ragioneSociale').focus();
    return;
  }
  const url = $('websiteUrl').value.trim();
  await buildProfile(ragioneSociale, url);
});

async function loadCachedProfile(ragioneSociale) {
  const cached = await window.euMatch.loadProfile(ragioneSociale);
  if (cached) {
    state.currentProfile = cached;
    renderProfileData(cached, true);
  }
}

async function buildProfile(ragioneSociale, url) {
  show('profileLoading');
  $('profileLoadingText').textContent = 'Ricerca nel registro imprese e scraping sito...';
  hide('profileResult');

  try {
    const profile = await window.euMatch.buildProfile(ragioneSociale, url);
    state.currentProfile = profile;
    renderProfileData(profile, profile.fromCache);
    await renderRecentProfiles();
  } catch (err) {
    $('profileLoadingText').textContent = `Errore: ${err.message}`;
  } finally {
    hide('profileLoading');
  }
}

function renderProfileData(profile, fromCache) {
  const fields = [
    { label: 'Ragione Sociale', value: profile.ragioneSociale },
    { label: 'P.IVA / Numero', value: profile.piva || '—' },
    { label: 'Giurisdizione', value: (profile.jurisdiction || 'IT').toUpperCase() },
    { label: 'Costituita il', value: fmtDate(profile.incorporatedOn) },
    { label: 'Sito Web', value: profile.url || '—' },
    { label: 'Aggiornato', value: fmtDate(profile.lastUpdated || profile.scrapedAt) },
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

  // If we have a saved scheda, show it
  if (profile.schedaEU) {
    state.schedaEU = profile.schedaEU;
    state.keywords = profile.keywords || [];
    renderScheda(profile.schedaEU, profile.keywords || []);
  }
}

// ─── Clear Cache ──────────────────────────────────────────────────────────────
$('btnClearProfile').addEventListener('click', async () => {
  const name = $('ragioneSociale').value.trim();
  if (!name) return;
  await window.euMatch.deleteProfile(name);
  hide('profileResult');
  state.currentProfile = null;
  await renderRecentProfiles();
});

// ─── Generate Scheda EU ───────────────────────────────────────────────────────
$('btnGeneraScheda').addEventListener('click', async () => {
  if (!state.currentProfile) return;
  await generateScheda(state.currentProfile);
  switchToTab('scheda');
});

async function generateScheda(profile) {
  show('schedaLoading');
  hide('schedaInfo');
  hide('keywordsCard');

  const contentEl = $('schedaContent');
  contentEl.textContent = '';
  show('schedaContent');
  contentEl.classList.add('streaming');

  // Stream chunks into the UI
  window.euMatch.onCopilotChunk((text) => {
    contentEl.textContent += text;
    contentEl.scrollTop = contentEl.scrollHeight;
  });

  try {
    const result = await window.euMatch.generateSchedaEU(profile);

    if (!result.ok) {
      setAlert('schedaInfo', 'error', `❌ Errore Copilot: ${result.error}`);
      show('schedaInfo');
      hide('schedaContent');
    } else {
      renderScheda(result.schedaEU, result.keywords);
      state.schedaEU = result.schedaEU;
      state.keywords = result.keywords;
    }
  } catch (err) {
    setAlert('schedaInfo', 'error', `❌ ${err.message}`);
    show('schedaInfo');
  } finally {
    hide('schedaLoading');
    contentEl.classList.remove('streaming');
    window.euMatch.removeCopilotChunkListener();
  }
}

function renderScheda(schedaText, keywords) {
  const contentEl = $('schedaContent');
  contentEl.textContent = schedaText;
  show('schedaContent');
  hide('schedaInfo');

  if (keywords && keywords.length > 0) {
    $('keywordsList').innerHTML = keywords.map(kw => `
      <span class="keyword-chip">${escHtml(kw)}</span>
    `).join('');
    show('keywordsCard');
  }
}

// ─── Search Bandi ─────────────────────────────────────────────────────────────
$('btnCercaBandi').addEventListener('click', async () => {
  switchToTab('bandi');
  await searchBandi();
});

$('btnSearch').addEventListener('click', searchBandi);

async function searchBandi() {
  if (!state.keywords || state.keywords.length === 0) {
    show('bandiEmpty');
    return;
  }

  hide('bandiEmpty');
  show('bandiLoading');
  $('bandiResults').innerHTML = '';

  const period = $('programmePeriod').value;
  const statusVal = $('bandiStatus').value;
  const statusMap = {
    'open-forthcoming': ['31094501', '31094502'],
    'open': ['31094501'],
    'forthcoming': ['31094502']
  };

  try {
    const res = await window.euMatch.searchFunding(state.keywords, {
      programmePeriod: period,
      status: statusMap[statusVal] || statusMap['open-forthcoming']
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
    renderBandi(res.results, res.total);

    // Update badge
    $('bandiCount').textContent = res.results.length;
    $('bandiCount').classList.remove('hidden');
  } catch (err) {
    hide('bandiLoading');
    $('bandiResults').innerHTML = `<div class="alert alert-error">❌ ${escHtml(err.message)}</div>`;
  }
}

function renderBandi(results, total) {
  const sorted = [...results].sort((a, b) => b.matchingScore - a.matchingScore);

  const header = `
    <div class="results-header">
      <span class="results-count">Trovati <strong>${total}</strong> bandi — mostrati ${sorted.length} per rilevanza</span>
    </div>`;

  const cards = sorted.map(b => {
    const score = b.matchingScore;
    const scoreClass = score >= 60 ? 'score-high' : score >= 30 ? 'score-mid' : 'score-low';
    const statusClass = b.status.toLowerCase().includes('open') ? 'status-open'
      : b.status.toLowerCase().includes('forth') ? 'status-forthcoming' : 'status-unknown';

    return `
      <div class="bando-card">
        <div>
          <div class="bando-title">${escHtml(b.title)}</div>
          <div class="bando-meta">
            <span>🏛️ ${escHtml(b.programme || 'N/D')}</span>
            ${b.deadline ? `<span>📅 Scadenza: ${escHtml(b.deadline)}</span>` : ''}
            ${b.budget ? `<span>💰 ${escHtml(b.budget)}</span>` : ''}
            <span class="status-badge ${statusClass}">${escHtml(b.status || 'N/D')}</span>
          </div>
          ${b.description ? `<div class="bando-desc">${escHtml(b.description)}…</div>` : ''}
          <div class="bando-actions">
            <a href="${escHtml(b.portalUrl)}" class="btn btn-secondary btn-sm" id="link-${escHtml(b.id)}" style="text-decoration:none">
              🔗 Apri nel Portale EU
            </a>
          </div>
        </div>
        <div class="bando-score-box">
          <div class="score-circle ${scoreClass}">${score}%</div>
          <div class="score-label">Match<br>Score</div>
        </div>
      </div>`;
  }).join('');

  $('bandiResults').innerHTML = header + cards;

  // Handle external links via Electron shell (CSP safe)
  $('bandiResults').querySelectorAll('a[href^="http"]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      // postMessage approach via IPC would be needed for shell.openExternal
      // For now open in default browser via window.open (Electron will handle it)
      window.open(link.href, '_blank');
    });
  });
}

// ─── Settings ─────────────────────────────────────────────────────────────────
async function loadSettings() {
  const s = await window.euMatch.getSettings();
  if (s.copilotPath) $('copilotPath').value = s.copilotPath;
}

$('btnSaveSettings').addEventListener('click', async () => {
  const settings = { copilotPath: $('copilotPath').value.trim() };
  await window.euMatch.saveSettings(settings);
  setAlert('copilotHealthStatus', 'success', '✅ Impostazioni salvate.');
  await runHealthCheck();
});

$('btnRecheckCopilot').addEventListener('click', runHealthCheck);

// ─── Credentials ──────────────────────────────────────────────────────────────
$('btnSaveCreds').addEventListener('click', async () => {
  const u = $('euUsername').value.trim();
  const p = $('euPassword').value;
  if (!u || !p) {
    setAlert('credStatus', 'warning', '⚠️ Inserisci username e password.');
    return;
  }
  const res = await window.euMatch.saveCredentials(u, p);
  setAlert('credStatus', res.ok ? 'success' : 'error',
    res.ok ? '🔐 Credenziali salvate in modo sicuro.' : `❌ ${res.error}`);
  $('euPassword').value = '';
});

$('btnLoadCreds').addEventListener('click', async () => {
  const res = await window.euMatch.loadCredentials();
  if (res.ok && res.data) {
    $('euUsername').value = res.data.username;
    $('euPassword').value = '••••••••';
    setAlert('credStatus', 'info', `📂 Credenziali caricate per: ${escHtml(res.data.username)}`);
  } else {
    setAlert('credStatus', 'warning', '⚠️ Nessuna credenziale salvata.');
  }
});

$('btnClearCreds').addEventListener('click', async () => {
  await window.euMatch.clearCredentials();
  $('euUsername').value = '';
  $('euPassword').value = '';
  setAlert('credStatus', 'success', '🗑️ Credenziali eliminate.');
});

// ─── Copilot Model Modal ───────────────────────────────────────────────────────
$('btnDismissModal').addEventListener('click', () => hide('modelModal'));
$('btnRecheckModal').addEventListener('click', async () => {
  hide('modelModal');
  await runHealthCheck();
});

// ─── Enter key for profile form ───────────────────────────────────────────────
['ragioneSociale', 'websiteUrl'].forEach(id => {
  $(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') $('btnProfila').click();
  });
});

// ─── Init ─────────────────────────────────────────────────────────────────────
(async function init() {
  await loadSettings();
  await renderRecentProfiles();
  await runHealthCheck();
})();
