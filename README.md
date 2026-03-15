# EU-Match — Startup EU Scout

AI-powered **Electron desktop app** that automates EU funding discovery for startups by combining business register data, web scraping, and Copilot CLI (Opus 4.6) intelligence.

## Features
- 🏢 **Startup Profiling** — auto-fetches company data from OpenCorporates + scrapes website
- 🤖 **Copilot CLI Integration** — uses Claude Opus 4.6 to generate a structured "Scheda Europea"
- 📋 **Bandi Search** — queries the EU Funding & Tenders API with AI-extracted keywords and shows a Matching Score
- 🔐 **Secure Credentials** — EU Login credentials encrypted via OS Keychain (macOS) / DPAPI (Windows)
- 💾 **Profile Cache** — avoids redundant API calls via `electron-store` local cache

## Requirements
- Node.js ≥ 18
- [GitHub CLI](https://cli.github.com/) + [gh-copilot extension](https://github.com/github/gh-copilot)
- Copilot model set to **claude-opus-4-6**:
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
├── main.js                 # Electron main process + IPC handlers
├── preload.js              # contextBridge API (renderer ↔ main)
├── src/
│   ├── storage.js          # electron-store profile cache + settings
│   ├── credential-manager.js  # safeStorage (Keychain/DPAPI)
│   ├── startup-profiler.js    # OpenCorporates API + cheerio web scraping
│   ├── copilot-bridge.js      # Copilot CLI child_process integration
│   └── eu-search.js           # EU Funding & Tenders API (POST search)
└── renderer/
    ├── index.html          # Multi-tab UI
    ├── app.js              # Renderer logic
    └── styles.css          # EU-branded design system
```

## Tab Overview
| Tab | Description |
|-----|-------------|
| **Profilo Startup** | Enter company name + URL → auto-profile with cache |
| **Scheda EU** | AI-generated European profile + keyword extraction |
| **Bandi** | EU funding results with Matching Score |
| **Impostazioni** | Copilot path config + EU Login credentials |

