# EU Scout Web App — Changelog

All notable changes to the **web-app** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.2.0] — 2026-04-03

### Added
- **Docker support** — multi-stage `Dockerfile` (node:20-slim build → nginx:stable-alpine serve, ~68 MB final image)
- **nginx configuration** — SPA fallback, CORS proxies for EU Funding & Tenders API and OpenCorporates, COOP/COEP headers for WebGPU `SharedArrayBuffer` (required by WebLLM), `/healthz` liveness endpoint, 1-year immutable cache on fingerprinted assets
- **Azure infrastructure** — `infra/main.bicep` provisions `eu-scout-web` Container App in the shared `aca-env-identityserver` environment; 0.25 CPU / 0.5 Gi, 1–2 replicas with HTTP scaling, liveness + readiness probes
- **CI/CD pipeline** — `.github/workflows/deploy-web.yml`: builds & pushes Docker image to ACR on semver tag `web/x.y.z`, deploys via Bicep, binds custom domain `eu-scout.codethecat.dev` with Azure-managed TLS (CNAME validation, idempotent)
- **`.env.example`** — reference file for local development; no secrets committed
- **`.dockerignore`** — excludes `node_modules`, `dist`, `.env*`, logs from build context

### Security
- All CI/CD secrets stored exclusively in GitHub Secrets — no sensitive data in repository
- Dedicated `eu-scout-web-github` SP credential (appended to existing SP, papercomp credential untouched)
- nginx strips `Authorization` header on API proxy requests

---

## [0.1.0] — 2026-04-03

### Added
- Initial React 19 + Vite 6 + TypeScript PWA scaffolding
- **Device gate** (`DeviceCheckScreen`) — WebGPU adapter check + GPU tier scoring; unsupported devices see clear requirements list
- **Disclaimer screen** (`DisclaimerScreen`) — privacy/no-server/AS-IS notice with expandable sections and mandatory acceptance checkbox; shown once on first run
- **Capability screen** (`CapabilityScreen`) — detects NPU (WebNN) vs GPU (WebGPU), displays hardware badge, asks user to proceed before any AI model loads
- **Encrypted storage** — Dexie (IndexedDB) + Web Crypto API AES-256-GCM for credentials and profiles; `StorageManager.persist()` requested on init
- **Profile tab** — startup profiling via OpenCorporates API + website scraping; recent profiles list with quick-load
- **EU Summary tab** — local LLM-powered EU summary generation with Markdown preview/source toggle, keyword chip editor, export to `.md`
- **Grants tab** — EU Funding & Tenders API search with programme/status/action-type filters, grant accordion with checkboxes, local LLM fit-score analysis per grant, analysis cached in IndexedDB
- **Settings tab** — WebLLM model loader (Phi-3.5-mini, Qwen 2.5, Llama 3.2) with download progress, encrypted Claude API key storage
- **Log tab** — live application log with type icons, copy to clipboard, error badge counter
- **Local LLM** — `@mlc-ai/web-llm` integration; model loaded on demand, runs on NPU (Snapdragon X Elite via WebNN) or GPU (iPhone/iPad/Android via WebGPU)
- **Mobile-first UI** — EU navy/gold dark theme, glassmorphism cards, Framer Motion screen transitions, bottom tab bar with iOS safe-area support
- Zustand global state, TanStack Query for async data, vite-plugin-pwa for offline PWA
