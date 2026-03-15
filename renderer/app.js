/// <reference path="./types/eu-match.d.ts" />
'use strict';
const state = {
    currentProfile: null,
    schedaEU: '',
    keywords: [],
    grantResults: [],
    grantAnalyses: {},
    logErrorCount: 0
};
// ─── Helpers ─────────────────────────────────────────────────────────────────
function $(id) {
    return document.getElementById(id);
}
function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }
function toggle(id, visible) { visible ? show(id) : hide(id); }
function setAlert(id, type, text) {
    const el = $(id);
    el.className = `alert alert-${type}`;
    el.innerHTML = text;
    show(id);
}
// ─── App Log ──────────────────────────────────────────────────────────────────
const LOG_ICONS = {
    info: 'ℹ️', success: '✅', warn: '⚠️', error: '❌',
    api: '🌐', copilot: '🤖', storage: '💾'
};
function appLog(level, message, detail = '') {
    const panel = $('appLogPanel');
    const empty = panel.querySelector('.log-empty');
    if (empty)
        empty.remove();
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
window.euMatch.onLog((entry) => {
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
        const ts = el.querySelector('.log-ts')?.textContent ?? '';
        const msg = el.querySelector('.log-msg')?.textContent ?? '';
        const det = el.querySelector('.log-detail')?.textContent ?? '';
        return det ? `${ts} ${msg}\n      ${det}` : `${ts} ${msg}`;
    });
    navigator.clipboard.writeText(lines.join('\n'));
});
function fmtDate(iso) {
    if (!iso)
        return '—';
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
            txt.textContent = 'Copilot CLI non trovato';
            setAlert('copilotHealthStatus', 'error', `❌ Copilot CLI non trovato. Installa con: <code>brew install gh && gh extension install github/gh-copilot</code>`);
            return;
        }
        const model = await window.euMatch.copilotCheckModel();
        dot.className = 'status-dot ok';
        const modelLabel = model.currentModel && model.currentModel !== 'unknown' ? ` — ${model.currentModel}` : '';
        txt.textContent = `Copilot ${health.version}${modelLabel}`;
        setAlert('copilotHealthStatus', 'success', `✅ Copilot CLI rilevato (v${health.version}). Modello attivo: <strong>${model.currentModel !== 'unknown' ? model.currentModel : 'non rilevato'}</strong>`);
        if (model.isOpus === false) {
            const label = $('currentModelLabel');
            if (label)
                label.textContent = model.currentModel || 'sconosciuto';
            show('modelModal');
        }
    }
    catch (err) {
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
            $('ragioneSociale').value = item.dataset.name ?? '';
            loadCachedProfile(item.dataset.name ?? '');
        });
    });
}
function escHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
        $('websiteUrl').value = cached.url ?? '';
        state.currentProfile = cached;
        renderProfileData(cached, true);
    }
}
async function buildProfile(ragioneSociale, url) {
    const logEl = $('liveLog');
    const startTs = Date.now();
    let lineCount = 0;
    function appendLog({ icon, msg }) {
        const elapsed = ((Date.now() - startTs) / 1000).toFixed(1).padStart(5, '0');
        const typeMap = { '✅': 'ok', '⚠️': 'warn', '❌': 'err', '💾': 'save', '⏳': 'info', 'ℹ️': 'info' };
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
    }
    catch (err) {
        appendLog({ icon: '❌', msg: err.message });
    }
    finally {
        window.euMatch.removeProfileProgressListener();
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
    const name = $('ragioneSociale').value.trim();
    if (!name)
        return;
    await window.euMatch.deleteProfile(name);
    hide('profileResult');
    state.currentProfile = null;
    await renderRecentProfiles();
});
// ─── Generate Scheda EU ───────────────────────────────────────────────────────
$('btnGeneraScheda').addEventListener('click', async () => {
    if (!state.currentProfile)
        return;
    switchToTab('scheda');
    const btn = $('btnGeneraScheda');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Generazione in corso…';
    try {
        await generateScheda(state.currentProfile);
    }
    finally {
        btn.disabled = false;
        btn.innerHTML = '<span>🤖</span> Genera Scheda EU con Copilot';
    }
});
async function generateScheda(profile) {
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
    window.euMatch.onCopilotChunk((text) => {
        sourceEl.textContent += text;
        sourceEl.scrollTop = sourceEl.scrollHeight;
    });
    try {
        const result = await window.euMatch.generateSchedaEU(profile);
        if (!result.ok) {
            setAlert('schedaInfo', 'error', `❌ Errore Copilot: ${result.error}`);
            show('schedaInfo');
            hide('schedaSubTabs');
        }
        else {
            renderScheda(result.schedaEU ?? '', result.keywords ?? []);
            state.schedaEU = result.schedaEU ?? '';
            state.keywords = result.keywords ?? [];
        }
    }
    catch (err) {
        setAlert('schedaInfo', 'error', `❌ ${err.message}`);
        show('schedaInfo');
    }
    finally {
        hide('schedaLoading');
        window.euMatch.removeCopilotChunkListener();
    }
}
function renderScheda(schedaText, keywords) {
    hide('schedaInfo');
    const previewEl = $('schedaContent');
    const sourceEl = $('schedaSource');
    previewEl.innerHTML = window.marked ? window.marked.parse(schedaText) : schedaText.replace(/\n/g, '<br>');
    sourceEl.textContent = schedaText;
    show('schedaSubTabs');
    activateSubTab('preview');
    show('btnDownloadMd');
    $('btnDownloadMd').dataset.content = schedaText;
    if (keywords && keywords.length > 0) {
        $('keywordsList').innerHTML = keywords.map(kw => `<span class="keyword-chip">${escHtml(kw)}</span>`).join('');
        show('keywordsCard');
    }
}
// ─── Sub-tab switching ─────────────────────────────────────────────────────────
function activateSubTab(name) {
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.subtab === name);
    });
    toggle('schedaPreviewPanel', name === 'preview');
    toggle('schedaSourcePanel', name === 'source');
}
document.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activateSubTab(btn.dataset.subtab ?? ''));
});
// ─── Download MD ───────────────────────────────────────────────────────────────
$('btnDownloadMd').addEventListener('click', () => {
    const content = $('schedaSource').textContent ?? '';
    const filename = `${(state.currentProfile?.ragioneSociale ?? 'scheda').replace(/\s+/g, '_')}_scheda_eu.md`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
});
// ─── Grant Search ──────────────────────────────────────────────────────────────
$('btnSearchGrants').addEventListener('click', async () => {
    switchToTab('grants');
    await searchGrants();
});
$('btnSearch').addEventListener('click', () => { searchGrants(); });
// Re-search when a filter changes — debounced + guarded against concurrent runs
let _searchDebounce = null;
['programmePeriod', 'grantStatus', 'grantLanguage', 'grantProgramme', 'grantTypeOfAction'].forEach(id => {
    $(id).addEventListener('change', () => {
        if (!state.keywords || state.keywords.length === 0)
            return;
        if (_searchDebounce)
            clearTimeout(_searchDebounce);
        _searchDebounce = setTimeout(() => searchGrants(), 400);
    });
});
function setLoadingMsg(msg) {
    const el = document.getElementById('grantsLoadingMsg');
    if (el)
        el.textContent = msg;
}
let _searchInProgress = false;
async function searchGrants() {
    if (_searchInProgress)
        return; // prevent concurrent runs
    if (!state.keywords || state.keywords.length === 0) {
        show('grantsEmpty');
        return;
    }
    _searchInProgress = true;
    hide('grantsEmpty');
    show('grantsLoading');
    $('grantResults').innerHTML = '';
    $('grantCount').classList.add('hidden');
    const period = $('programmePeriod').value;
    const statusKey = $('grantStatus').value;
    const language = $('grantLanguage').value;
    const programme = $('grantProgramme').value;
    const typeOfAction = $('grantTypeOfAction').value; // 'all' | 'RIA' | 'IA' | …
    const ragioneSociale = state.currentProfile?.ragioneSociale ?? '';
    const isClosed = statusKey === 'closed';
    try {
        // ── Phase 1: Search ────────────────────────────────────────────────
        setLoadingMsg('🔍 Step 1 — Searching EU grants...');
        appLog('api', `Searching grants — status: ${statusKey}, programme: ${programme}, language: ${language}`);
        const res = await window.euMatch.searchFunding(state.keywords, { programmePeriod: period, statusKey, language, programme });
        if (!res.ok || !res.results || res.results.length === 0) {
            hide('grantsLoading');
            $('grantResults').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          ${res.error ? `API Error: ${escHtml(res.error)}` : 'No grants found for the provided keywords.'}
        </div>`;
            return;
        }
        appLog('success', `Found ${res.results.length} grants in analysis pool (from ${res.total?.toLocaleString()} EU total).`);
        // ── Phase 2: Crawl grant homepages ────────────────────────────────
        const stepCount = isClosed ? '2' : '3';
        setLoadingMsg(`📄 Step 2/${stepCount} — Crawling ${res.results.length} grant homepages for full details...`);
        appLog('api', `Crawling ${res.results.length} grant homepages…`);
        const enrichRes = await window.euMatch.enrichGrants(res.results);
        const enriched = enrichRes.ok ? (enrichRes.results ?? res.results) : res.results;
        appLog('success', `Grant details extracted for ${enriched.length} grants.`);
        // ── Exclude grants with a known past deadline (post-crawl, most accurate data) ──
        const now = new Date();
        const activeGrants = isClosed ? enriched : enriched.filter(g => {
            if (!g.deadline)
                return true; // unknown deadline → keep
            const d = new Date(g.deadline);
            return isNaN(d.getTime()) || d >= now; // unparseable or future → keep
        });
        const expiredCount = enriched.length - activeGrants.length;
        if (!isClosed && expiredCount > 0) {
            appLog('info', `Excluded ${expiredCount} grant(s) with past deadlines.`);
        }
        // ── Type of Action filter (applied post-crawl once typeOfAction is known) ──
        // EU API may return full text ("Research and Innovation Action") OR acronym ("RIA").
        // Regex covers both forms; IA is anchored to avoid matching inside "RIA"/"PRIA" etc.
        const TYPE_MATCH = {
            'RIA': /^ria$|research.*innovation.*action/i,
            'IA': /^ia$|^innovation action/i,
            'CSA': /^csa$|coordination.*support.*action/i,
            'EIC': /^eic\b|european innovation council/i,
            'MSCA': /^msca\b|marie\s*sk/i,
            'ERC': /^erc\b|european research council/i,
        };
        const typeRegex = TYPE_MATCH[typeOfAction.toUpperCase()] ?? null;
        const typeFiltered = (typeOfAction === 'all' || !typeRegex)
            ? activeGrants
            : activeGrants.filter(g => g.typeOfAction && typeRegex.test(g.typeOfAction));
        if (typeFiltered.length === 0) {
            hide('grantsLoading');
            $('grantResults').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          ${typeOfAction !== 'all'
                ? `No <strong>${escHtml(typeOfAction)}</strong> grants found matching your keywords. Try "All Types".`
                : 'No active grants found matching your keywords.'}
        </div>`;
            return;
        }
        if (typeOfAction !== 'all') {
            appLog('info', `Type filter applied: ${typeOfAction} — ${typeFiltered.length} of ${activeGrants.length} grants match.`);
        }
        // ── Closed grants: show info + partner list, no Copilot ───────────
        if (isClosed) {
            state.grantResults = typeFiltered;
            hide('grantsLoading');
            renderGrants(typeFiltered, res.total ?? 0, true);
            $('grantCount').textContent = typeFiltered.length.toString();
            $('grantCount').classList.remove('hidden');
            return;
        }
        // ── Phase 3: Copilot — pre-rank by keyword score, analyse top 15, show top 5 ──
        const COPILOT_POOL = 15;
        const TOP_N = 5;
        // Pre-rank by keyword relevance, take top 15 for Copilot analysis
        const sortedByKeyword = [...typeFiltered].sort((a, b) => b.matchingScore - a.matchingScore);
        const analysisPool = sortedByKeyword.slice(0, COPILOT_POOL);
        if (ragioneSociale) {
            state.grantAnalyses = await window.euMatch.loadGrantAnalyses(ragioneSociale);
        }
        const toAnalyze = ragioneSociale ? analysisPool.filter(b => !state.grantAnalyses?.[b.id]) : [];
        const fromCache = analysisPool.length - toAnalyze.length;
        let done = fromCache;
        setLoadingMsg(`🤖 Step 3/3 — Copilot ranking: ${done}/${analysisPool.length} analysed...`);
        appLog('copilot', `Ranking top ${COPILOT_POOL} from pool of ${enriched.length} by keyword score, selecting best ${TOP_N} — ${toAnalyze.length} to analyse, ${fromCache} from cache`);
        const BATCH = 3;
        for (let i = 0; i < toAnalyze.length; i += BATCH) {
            const batch = toAnalyze.slice(i, i + BATCH);
            await Promise.allSettled(batch.map(async (b) => {
                const r = await window.euMatch.analyzeGrant(b, ragioneSociale);
                if (r.ok && r.analysis) {
                    state.grantAnalyses[b.id] = { analysis: r.analysis, savedAt: new Date().toISOString(), fitScore: r.fitScore ?? 0 };
                }
                done++;
                setLoadingMsg(`🤖 Step 3/3 — Copilot ranking: ${done}/${analysisPool.length} analysed...`);
            }));
        }
        appLog('success', `Ranking complete — selecting top ${TOP_N} best-fit grants from ${analysisPool.length} analysed.`);
        // Sort analysis pool by partner score, take top 5
        analysisPool.sort((a, b) => {
            const sa = state.grantAnalyses?.[a.id]?.fitScore ?? 0;
            const sb = state.grantAnalyses?.[b.id]?.fitScore ?? 0;
            return sb - sa;
        });
        const top5 = analysisPool.slice(0, TOP_N);
        state.grantResults = top5;
        hide('grantsLoading');
        renderGrants(top5, res.total ?? 0, false);
        $('grantCount').textContent = TOP_N.toString();
        $('grantCount').classList.remove('hidden');
    }
    catch (err) {
        hide('grantsLoading');
        $('grantResults').innerHTML = `<div class="alert alert-error">❌ ${escHtml(err.message)}</div>`;
        appLog('error', `Search error: ${err.message}`);
    }
    finally {
        _searchInProgress = false;
    }
}
function safeGrantId(id) {
    return id.replace(/[^a-zA-Z0-9_-]/g, '-');
}
function renderGrants(results, total, isClosed = false) {
    const closedBanner = isClosed
        ? `<div class="alert alert-warning" style="margin-bottom:12px">
         📁 You are viewing <strong>expired</strong> grants.
         For expired grants you can see the funded partners via CORDIS.
       </div>`
        : '';
    const header = `
    <div class="results-header">
      ${closedBanner}
      <span class="results-count">Found <strong>${total}</strong> grants — showing ${results.length} ranked by partner fit</span>
    </div>`;
    const cards = results.map((b, rank) => {
        const cached = state.grantAnalyses?.[b.id];
        const fitScore = cached?.fitScore ?? 0;
        const fitClass = fitScore >= 60 ? 'score-high' : fitScore >= 30 ? 'score-mid' : 'score-low';
        const isExpired = isClosed;
        const statusLabel = isExpired ? '📁 Expired' : (b.status || 'N/A');
        const statusClass = isExpired ? 'status-unknown'
            : b.status.toLowerCase().includes('open') ? 'status-open'
                : b.status.toLowerCase().includes('forth') ? 'status-forthcoming' : 'status-unknown';
        const safeId = safeGrantId(b.id);
        const meta = [
            b.programme ? `🏛️ ${escHtml(b.programme)}` : '',
            b.typeOfAction ? `⚗️ ${escHtml(b.typeOfAction)}` : '',
            b.openDate ? `📂 Opens: ${escHtml(fmtDate(b.openDate))}` : '',
            b.deadline ? `📅 Deadline: ${escHtml(fmtDate(b.deadline))}` : '',
            b.duration ? `⏱️ ${escHtml(b.duration)}` : '',
            b.budget ? `💰 ${escHtml(b.budget)}` : '',
        ].filter(Boolean).map(m => `<span>${m}</span>`).join('');
        const beneficiariesBtn = isExpired && b.beneficiariesUrl
            ? `<a class="btn btn-secondary btn-sm" data-href="${escHtml(b.beneficiariesUrl)}" style="text-decoration:none">👥 View Partners on CORDIS</a>`
            : '';
        const analysisHtml = cached
            ? `<div class="analysis-area">
           <div class="analysis-content md-preview">${window.marked ? window.marked.parse(cached.analysis) : escHtml(cached.analysis)}</div>
           <div class="analysis-footer">💾 Saved on ${escHtml(fmtDate(cached.savedAt))}</div>
         </div>`
            : `<div class="analysis-area analysis-na"><em>No startup profile loaded — analysis not available.</em></div>`;
        return `
      <div class="grant-card${isExpired ? ' grant-expired' : ''}" data-grant-id="${escHtml(b.id)}" data-fitscore="${fitScore}">
        <div style="flex:1;min-width:0">
          <div class="grant-title">#${rank + 1} ${escHtml(b.title)}</div>
          <div class="grant-meta">${meta}<span class="status-badge ${statusClass}">${escHtml(statusLabel)}</span></div>
          <div class="grant-actions">
            <a class="btn btn-secondary btn-sm" data-href="${escHtml(b.portalUrl)}" style="text-decoration:none">🔗 Open in EU Portal</a>
            ${beneficiariesBtn}
          </div>
          ${analysisHtml}
        </div>
        <div class="grant-score-box">
          <div class="score-circle ${fitClass}">${fitScore}%</div>
          <div class="score-label">Partner<br>Score</div>
        </div>
      </div>`;
    }).join('');
    $('grantResults').innerHTML = header + cards;
    $('grantResults').querySelectorAll('a[data-href]').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            window.open(a.dataset.href, '_blank');
        });
    });
}
// ─── Settings ─────────────────────────────────────────────────────────────────
async function loadSettings() {
    const s = await window.euMatch.getSettings();
    if (s.copilotPath)
        $('copilotPath').value = s.copilotPath;
}
$('btnSaveSettings').addEventListener('click', async () => {
    const settings = { copilotPath: $('copilotPath').value.trim() };
    await window.euMatch.saveSettings(settings);
    setAlert('copilotHealthStatus', 'success', '✅ Impostazioni salvate.');
    await runHealthCheck();
});
$('btnRecheckCopilot').addEventListener('click', () => { runHealthCheck(); });
// ─── Credentials ──────────────────────────────────────────────────────────────
$('btnSaveCreds').addEventListener('click', async () => {
    const u = $('euUsername').value.trim();
    const p = $('euPassword').value;
    if (!u || !p) {
        setAlert('credStatus', 'warning', '⚠️ Inserisci username e password.');
        return;
    }
    const res = await window.euMatch.saveCredentials(u, p);
    setAlert('credStatus', res.ok ? 'success' : 'error', res.ok ? '🔐 Credenziali salvate in modo sicuro.' : `❌ ${res.error}`);
    $('euPassword').value = '';
});
$('btnLoadCreds').addEventListener('click', async () => {
    const res = await window.euMatch.loadCredentials();
    if (res.ok && res.data) {
        $('euUsername').value = res.data.username;
        $('euPassword').value = '••••••••';
        setAlert('credStatus', 'info', `📂 Credenziali caricate per: ${escHtml(res.data.username)}`);
    }
    else {
        setAlert('credStatus', 'warning', '⚠️ Nessuna credenziale salvata.');
    }
});
$('btnClearCreds').addEventListener('click', async () => {
    await window.euMatch.clearCredentials();
    $('euUsername').value = '';
    $('euPassword').value = '';
    setAlert('credStatus', 'success', '🗑️ Credenziali eliminate.');
    appLog('storage', 'Credenziali EU Login eliminate.');
});
$('btnTestAuth').addEventListener('click', async () => {
    const btn = $('btnTestAuth');
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
        }
        else {
            setAlert('credStatus', conn.ok ? 'warning' : 'error', `${conn.ok ? '✅ API EU raggiungibile.' : '❌ API EU non raggiungibile.'} ${auth.error}`);
            appLog('warn', `EU Login: ${auth.error}`);
        }
        switchToTab('log');
    }
    finally {
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
    const ragioneSociale = $('ragioneSociale').value.trim();
    const url = $('websiteUrl').value.trim();
    if (!ragioneSociale || !url)
        return;
    await window.euMatch.updateProfile(ragioneSociale, { url });
    if (state.currentProfile && state.currentProfile.ragioneSociale === ragioneSociale) {
        state.currentProfile.url = url;
    }
});
// ─── Enter key for profile form ───────────────────────────────────────────────
['ragioneSociale', 'websiteUrl'].forEach(id => {
    $(id).addEventListener('keydown', (e) => {
        if (e.key === 'Enter')
            $('btnProfila').click();
    });
});
// ─── Init ─────────────────────────────────────────────────────────────────────
(async function init() {
    await loadSettings();
    await renderRecentProfiles();
    await runHealthCheck();
})();
