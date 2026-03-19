# EU-Match — Startup EU Scout

AI-powered **Electron desktop app** that automates EU funding discovery for startups by combining business register data, web scraping, and Copilot CLI intelligence.

## Features
- 🏢 **Startup Profiling** — auto-fetches company data from OpenCorporates + scrapes website
- 🤖 **Opus Deep Analysis** — Claude Opus 4.6 (recommended) performs intensive web research on each grant (work programme PDFs, scope, eligibility, TRL, budget) before ranking
- 📋 **Smart Grant Ranking** — single Opus call analyses all filtered grants and returns the top 15 best-fit opportunities with ratings and explanations
- 🔍 **Live Analysis Stream** — watch Opus reasoning in real-time as it searches work programmes and evaluates grants
- 🎯 **Direct Grant Analysis** — paste a specific grant ID to skip all filters and run Opus deep analysis on that single grant
- 📋 **Grant Accordion** — collapsible checklist with formatted descriptions (Expected Outcome, Scope…), copy-ID button, select/deselect, text filter with highlighting, expandable details
- 🏷️ **Editable Keywords** — add/remove search keywords extracted from the AI-generated EU profile
- 💾 **Auto-Resume** — automatically loads your last selected startup on launch
- ✨ **Profile Management** — delete profiles from history, "Nuova Startup" reset button, smart name detection (new vs existing)
- 🔐 **Secure Credentials** — EU Login credentials encrypted via OS Keychain (macOS) / DPAPI (Windows)
- 💾 **Profile Cache** — avoids redundant API calls via `electron-store` local cache

## Requirements
- Node.js ≥ 18
- [GitHub CLI](https://cli.github.com/) + [gh-copilot extension](https://github.com/github/gh-copilot)
- Copilot model — **claude-opus-4.6 recommended** (any model works, but Opus gives the best deep-research results):
  ```
  gh copilot config set model claude-opus-4-6
  ```

## Setup & Run
```bash
npm install
npm start
```

## Build
```bash
npm run build:mac   # macOS DMG
npm run build:win   # Windows NSIS installer
```

## Project Structure
```
├── src/
│   ├── main.ts                # Electron main process + IPC handlers
│   ├── preload.ts             # contextBridge API (renderer ↔ main)
│   ├── types.ts               # Shared TypeScript interfaces
│   ├── storage.ts             # electron-store profile cache + settings
│   ├── credential-manager.ts  # safeStorage (Keychain/DPAPI)
│   ├── startup-profiler.ts    # OpenCorporates API + cheerio web scraping
│   ├── copilot-bridge.ts      # Copilot CLI integration (scheda, ranking, analysis)
│   ├── eu-search.ts           # EU Funding & Tenders API (POST search + crawl)
│   └── eu-auth.ts             # EU Login credential testing
└── renderer/
    ├── index.html             # Multi-tab UI
    ├── app.ts                 # Renderer logic
    ├── styles.css             # EU-branded design system
    └── types/eu-match.d.ts    # Renderer type declarations
```

## Tab Overview
| Tab | Description |
|-----|-------------|
| **Profilo Startup** | Enter company name + URL → auto-profile with cache, delete profiles, reset for new startup |
| **Scheda EU** | AI-generated European profile + editable keyword tags |
| **Bandi** | EU grants ranked by Opus deep analysis with live streaming, direct grant ID analysis, and filterable grant accordion |
| **Impostazioni** | Copilot path config + EU Login credentials |
| **Log** | Real-time event stream with color-coded levels |

