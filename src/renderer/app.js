/**
 * EU Startup Nexus – Renderer process application script.
 *
 * Communicates with the main process via the contextBridge API
 * exposed in window.euStartupNexus.
 */

/** @type {import('../main/profile').StartupProfile | null} */
let currentProfile = null;

/** @type {import('../main/copilot').EuropeanSummaryCard | null} */
let currentSummaryCard = null;

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
document.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const view = link.getAttribute('data-view');
    if (view) navigateTo(view);
  });
});

document.querySelectorAll('[data-nav]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.getAttribute('data-nav');
    if (view) navigateTo(view);
  });
});

function navigateTo(viewName) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'));

  const view = document.getElementById(`view-${viewName}`);
  if (view) view.classList.add('active');

  const link = document.querySelector(`[data-view="${viewName}"]`);
  if (link) link.classList.add('active');
}

// ---------------------------------------------------------------------------
// Profile Form
// ---------------------------------------------------------------------------
const profileForm = document.getElementById('profile-form');
const fetchBtn = document.getElementById('fetch-profile-btn');

profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const businessName = document.getElementById('business-name').value.trim();
  const profileUrl = document.getElementById('profile-url').value.trim();

  if (!businessName) {
    showToast('Please enter a business name.', 'error');
    return;
  }

  setButtonLoading(fetchBtn, true);

  try {
    const profile = await window.euStartupNexus.getProfile(businessName, profileUrl || undefined);
    currentProfile = profile;
    renderProfileResult(profile);
    document.getElementById('profile-result').classList.remove('hidden');
  } catch (err) {
    showToast(`Failed to fetch profile: ${err.message}`, 'error');
  } finally {
    setButtonLoading(fetchBtn, false);
  }
});

function renderProfileResult(profile) {
  const container = document.getElementById('profile-data');
  const reg = profile.registryData;
  const web = profile.webData;

  container.innerHTML = `
    <div class="profile-section">
      <h3>Company Name</h3>
      <p>${escapeHtml(reg.companyName)}</p>
    </div>
    ${reg.vatNumber ? `
    <div class="profile-section">
      <h3>VAT / Registration Number</h3>
      <p>${escapeHtml(reg.vatNumber)}</p>
    </div>` : ''}
    ${reg.naceCodes && reg.naceCodes.length > 0 ? `
    <div class="profile-section">
      <h3>NACE Codes</h3>
      <div class="tag-list">${reg.naceCodes.map((c) => `<span class="tag">${escapeHtml(c)}</span>`).join('')}</div>
    </div>` : ''}
    ${reg.legalForm ? `
    <div class="profile-section">
      <h3>Legal Form</h3>
      <p>${escapeHtml(reg.legalForm)}</p>
    </div>` : ''}
    ${reg.registeredAddress ? `
    <div class="profile-section">
      <h3>Registered Address</h3>
      <p>${escapeHtml(reg.registeredAddress)}</p>
    </div>` : ''}
    ${web.missionStatement ? `
    <div class="profile-section">
      <h3>Mission Statement</h3>
      <p>${escapeHtml(web.missionStatement)}</p>
    </div>` : ''}
    ${web.coreTechnologies && web.coreTechnologies.length > 0 ? `
    <div class="profile-section">
      <h3>Core Technologies</h3>
      <div class="tag-list">${web.coreTechnologies.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
    </div>` : ''}
    ${web.targetMarkets && web.targetMarkets.length > 0 ? `
    <div class="profile-section">
      <h3>Target Markets</h3>
      <div class="tag-list">${web.targetMarkets.map((m) => `<span class="tag">${escapeHtml(m)}</span>`).join('')}</div>
    </div>` : ''}
    <p class="profile-section" style="font-size:12px;color:var(--text-muted)">
      Last updated: ${new Date(profile.lastUpdated).toLocaleString()}
    </p>
  `;
}

// ---------------------------------------------------------------------------
// Copilot: Generate European Summary Card
// ---------------------------------------------------------------------------
const generateCardBtn = document.getElementById('generate-card-btn');

generateCardBtn.addEventListener('click', async () => {
  if (!currentProfile) {
    showToast('Fetch a profile first.', 'error');
    return;
  }

  setButtonLoading(generateCardBtn, true);

  try {
    const card = await window.euStartupNexus.generateSummaryCard(currentProfile);
    if (!card) {
      showToast('Copilot CLI did not return a summary card. Check your model configuration.', 'error');
      return;
    }
    currentSummaryCard = card;
    renderSummaryCard(card);
    document.getElementById('summary-card-result').classList.remove('hidden');
    showToast('European Summary Card generated!', 'success');
  } catch (err) {
    showToast(`Failed to generate summary card: ${err.message}`, 'error');
  } finally {
    setButtonLoading(generateCardBtn, false);
  }
});

function renderSummaryCard(card) {
  const container = document.getElementById('summary-card-data');
  container.innerHTML = `
    <div class="profile-section">
      <h3>Mission Statement</h3>
      <p>${escapeHtml(card.missionStatement)}</p>
    </div>
    ${card.coreTechnologies && card.coreTechnologies.length > 0 ? `
    <div class="profile-section">
      <h3>Core Technologies</h3>
      <div class="tag-list">${card.coreTechnologies.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
    </div>` : ''}
    ${card.targetMarkets && card.targetMarkets.length > 0 ? `
    <div class="profile-section">
      <h3>Target Markets</h3>
      <div class="tag-list">${card.targetMarkets.map((m) => `<span class="tag">${escapeHtml(m)}</span>`).join('')}</div>
    </div>` : ''}
    <div class="profile-section">
      <h3>Funding Keywords</h3>
      <div class="tag-list">${card.keywords.map((k) => `<span class="tag">${escapeHtml(k)}</span>`).join('')}</div>
    </div>
    <div class="profile-section">
      <h3>EU Eligibility Summary</h3>
      <p>${escapeHtml(card.eligibilitySummary)}</p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Grant Search
// ---------------------------------------------------------------------------
const searchFromProfileBtn = document.getElementById('search-grants-from-profile-btn');

searchFromProfileBtn.addEventListener('click', async () => {
  if (!currentSummaryCard) {
    showToast('Generate a European Summary Card first.', 'error');
    return;
  }

  setButtonLoading(searchFromProfileBtn, true);

  try {
    const results = await window.euStartupNexus.searchGrants(currentSummaryCard);
    renderGrantResults(results);
    navigateTo('grants');
  } catch (err) {
    showToast(`Grant search failed: ${err.message}`, 'error');
  } finally {
    setButtonLoading(searchFromProfileBtn, false);
  }
});

function renderGrantResults(results) {
  const container = document.getElementById('grants-list');

  if (!results.opportunities || results.opportunities.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No matching grants found for your profile at this time.</p>
        <p style="font-size:12px">Searched keywords: ${escapeHtml(results.keywords.join(', '))}</p>
      </div>
    `;
    return;
  }

  const header = document.createElement('div');
  header.innerHTML = `
    <p style="margin-bottom:16px;color:var(--text-muted);font-size:13px">
      Found <strong>${results.totalHits}</strong> opportunities — showing top ${results.opportunities.length} by match score.
      Searched at ${new Date(results.searchedAt).toLocaleString()}.
    </p>
  `;

  const cards = results.opportunities.map((opp) => {
    const scoreClass = opp.matchScore >= 60 ? 'high' : opp.matchScore >= 30 ? 'medium' : '';
    const statusClass = opp.status.toLowerCase();

    return `
      <div class="grant-card">
        <div class="grant-header">
          <span class="grant-title">${escapeHtml(opp.title)}</span>
          <span class="match-score ${scoreClass}">${opp.matchScore}% match</span>
        </div>
        <div class="grant-meta">
          <span class="status-badge ${statusClass}">${escapeHtml(opp.status)}</span>
          ${opp.programmeCode ? `<span style="font-size:12px;color:var(--text-muted)">${escapeHtml(opp.programmeCode)}</span>` : ''}
          ${opp.closingDate ? `<span style="font-size:12px;color:var(--text-muted)">Deadline: ${escapeHtml(opp.closingDate)}</span>` : ''}
          ${opp.budgetTotal ? `<span style="font-size:12px;color:var(--text-muted)">Budget: €${opp.budgetTotal.toLocaleString()} ${escapeHtml(opp.budgetCurrency || '')}</span>` : ''}
        </div>
        ${opp.description ? `<p class="grant-description">${escapeHtml(opp.description.slice(0, 200))}${opp.description.length > 200 ? '…' : ''}</p>` : ''}
        <div class="grant-footer">
          <a href="${escapeHtml(opp.portalUrl)}" class="portal-link" target="_blank" rel="noopener noreferrer">
            View on EU Funding Portal →
          </a>
        </div>
      </div>
    `;
  });

  container.innerHTML = header.outerHTML + cards.join('');
}

// ---------------------------------------------------------------------------
// EU Login Settings
// ---------------------------------------------------------------------------
const euLoginForm = document.getElementById('eu-login-form');
const clearCredentialsBtn = document.getElementById('clear-credentials-btn');
const credentialsStatus = document.getElementById('credentials-status');

async function loadCredentialStatus() {
  try {
    const has = await window.euStartupNexus.euLogin.has();
    if (has) {
      const creds = await window.euStartupNexus.euLogin.get();
      if (creds) {
        document.getElementById('eu-email').value = creds.email;
        credentialsStatus.textContent = '✓ Credentials are saved and encrypted.';
        credentialsStatus.className = 'status-badge open';
        credentialsStatus.classList.remove('hidden');
      }
    }
  } catch (err) {
    console.error('Failed to load credential status:', err);
  }
}

euLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('eu-email').value.trim();
  const password = document.getElementById('eu-password').value;

  if (!email || !password) {
    showToast('Please enter both email and password.', 'error');
    return;
  }

  try {
    await window.euStartupNexus.euLogin.save(email, password);
    document.getElementById('eu-password').value = '';
    credentialsStatus.textContent = '✓ Credentials saved and encrypted with OS-native storage.';
    credentialsStatus.className = 'status-badge open';
    credentialsStatus.classList.remove('hidden');
    showToast('EU Login credentials saved securely.', 'success');
  } catch (err) {
    showToast(`Failed to save credentials: ${err.message}`, 'error');
  }
});

clearCredentialsBtn.addEventListener('click', async () => {
  try {
    await window.euStartupNexus.euLogin.clear();
    document.getElementById('eu-email').value = '';
    document.getElementById('eu-password').value = '';
    credentialsStatus.textContent = 'Credentials cleared.';
    credentialsStatus.className = 'status-badge closed';
    credentialsStatus.classList.remove('hidden');
    showToast('EU Login credentials cleared.', 'success');
  } catch (err) {
    showToast(`Failed to clear credentials: ${err.message}`, 'error');
  }
});

// Load credential status on start
loadCredentialStatus();

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setButtonLoading(btn, isLoading) {
  const textEl = btn.querySelector('.btn-text');
  const spinnerEl = btn.querySelector('.btn-spinner');
  btn.disabled = isLoading;
  if (textEl) textEl.style.opacity = isLoading ? '0.6' : '1';
  if (spinnerEl) {
    if (isLoading) spinnerEl.classList.remove('hidden');
    else spinnerEl.classList.add('hidden');
  }
}

let toastTimeout;

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast${type ? ` ${type}` : ''}`;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}
