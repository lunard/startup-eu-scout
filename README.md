# 🇪🇺 EU-Match — AI-Powered EU Funding Scout

**Find the EU grants that actually fit your startup — in minutes, not weeks.**

EU-Match is a desktop app that combines company profiling, the official EU Funding & Tenders API, and AI deep-research to discover, filter, and rank the best European funding opportunities for your startup.

> **How it works:** Enter your company name → the app builds a European profile → searches hundreds of EU grants → an AI agent reads work programme documents, checks eligibility, and ranks the top 15 best-fit opportunities with detailed explanations.

<!-- screenshots -->

---

## ✨ Key Features

### 🏢 Automatic Startup Profiling
Enter your company name and website. EU-Match fetches data from public business registers (OpenCorporates) and scrapes your website to build a structured company profile — sector, technologies, target market, and mission.

### 🤖 AI Deep Analysis
The app uses [GitHub Copilot CLI](https://github.com/github/gh-copilot) (Claude Opus recommended) to:
- Generate a **European profile** summarising your startup's fit for EU programmes
- Extract **search keywords** tailored to EU funding taxonomy
- **Research each grant** — reading work programme PDFs, verifying scope, eligibility, TRL levels, budget, and consortium requirements
- **Rank the top 15** best-fit grants with a score (0–100) and a plain-language explanation of why your startup is a good match

### 📋 Smart Grant Discovery
- Searches the official **EU Funding & Tenders Portal API** (Horizon Europe, EIC, Digital Europe, COSME, LIFE, EIT…)
- Fetches up to **100 grants** per search across keyword-relevance and programme-browse queries
- Enriches each grant with full descriptions (Expected Outcome, Scope), dates, budget, and type of action
- **Filter by** programme, status (open/forthcoming/closed), type of action, and language

### 🎯 Interactive Grant Selection
Before the AI analysis starts, you see all found grants in a **checklist accordion** where you can:
- Read the full formatted description (paragraphs, bullet lists, bold headings)
- Filter grants by text search (with live highlighting)
- Select/deselect which grants to analyse
- Copy any grant ID with one click (📋)
- Open any grant directly in the EU Portal

### 🔍 Live Analysis Stream
Watch the AI reasoning in real-time in a dark terminal panel — see which work programmes it's searching, which documents it's reading, and how it evaluates each grant.

### 🎯 Direct Grant ID Lookup
Already know a grant ID? Paste it (e.g. `HORIZON-CL2-2026-01-DEMOCRACY-05`) and skip all filters — the AI runs a deep analysis on that single grant.

### 💾 Profile Management
- Profiles are cached locally — switch between startups instantly
- Auto-resumes your last selected startup on launch
- Delete profiles from history with a single click
- "Nuova Startup" button resets everything for a fresh start

---

## 🚀 Getting Started

### Prerequisites

1. **Node.js ≥ 18** — [download](https://nodejs.org/)
2. **GitHub CLI** with the Copilot extension:
   ```bash
   # Install GitHub CLI: https://cli.github.com/
   gh auth login
   gh extension install github/gh-copilot
   ```
3. **Set your Copilot model** (Opus recommended for best results):
   ```bash
   gh copilot config set model claude-opus-4-6
   ```
   > Any Copilot model works, but Claude Opus 4.6 gives the most accurate deep-research results.

### Install & Run

```bash
git clone https://github.com/lunard/startup-eu-scout.git
cd startup-eu-scout
npm install
npm start
```

### Download Pre-Built Releases

Go to [**Releases**](https://github.com/lunard/startup-eu-scout/releases) and download the installer for your platform:

| Platform | File | Notes |
|----------|------|-------|
| 🪟 Windows | `eu-match-*-win-x64.exe` | NSIS installer with Start Menu shortcut |
| 🐧 Linux | `eu-match-*-linux-x86_64.AppImage` | Portable — `chmod +x` and run |
| 🍎 macOS | `eu-match-*-mac-*.dmg` | Drag to Applications |

---

## 📖 How to Use

### Step 1 — Profile Your Startup
1. Open the **Profilo Startup** tab
2. Enter your **Ragione Sociale** (company name) and optionally a website URL
3. Click **🔍 Profila Startup** — the app fetches public data and caches it

### Step 2 — Generate the EU Profile
1. Switch to the **Scheda EU** tab
2. Click **🤖 Genera Scheda EU con Copilot**
3. The AI generates a structured European profile and extracts search keywords
4. Edit keywords if needed — add or remove tags to fine-tune the search

### Step 3 — Search & Rank Grants
1. Go to the **Grants** tab
2. Set your filters (programme, status, type of action)
3. Click **🔍 Search Grants** — the app queries the EU API and enriches results
4. Review the grant accordion — select which grants to analyse
5. Click **🚀 Start Opus Deep Analysis** — watch the AI research and rank grants in real-time
6. The top 15 results appear with ratings, explanations, and direct links to the EU Portal

---

## 🛠️ Development

### Build from Source
```bash
npm run build          # Compile TypeScript
npm start              # Build + launch Electron
```

### Package for Distribution
```bash
npm run build:linux    # Linux AppImage (x64)
npm run build:win      # Windows NSIS installer (x64)
npm run build:mac      # macOS DMG
```
Output goes to `release/`.

### CI/CD
Every tagged release (`v*`) triggers a [GitHub Actions workflow](.github/workflows/release.yml) that builds all three platforms in parallel and publishes a GitHub Release with the artifacts.

### Project Structure
```
src/
├── main.ts                # Electron main process + IPC handlers
├── preload.ts             # contextBridge API (renderer ↔ main)
├── types.ts               # Shared TypeScript interfaces
├── storage.ts             # electron-store profile cache + settings
├── credential-manager.ts  # safeStorage (Keychain/DPAPI)
├── startup-profiler.ts    # OpenCorporates API + cheerio web scraping
├── copilot-bridge.ts      # Copilot CLI integration (scheda, ranking, analysis)
├── eu-search.ts           # EU Funding & Tenders API (search + crawl)
└── eu-auth.ts             # EU Login credential testing
renderer/
├── index.html             # Multi-tab UI
├── app.ts                 # Renderer logic
├── styles.css             # EU-branded design system
└── types/eu-match.d.ts    # Renderer type declarations
```

---

## 📝 License

MIT — see [LICENSE](LICENSE).

