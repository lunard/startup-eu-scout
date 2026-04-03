# 🌐 EU Scout — Mobile Web App

**AI-powered EU funding scout for startups — browser edition.**

[![Deploy](https://github.com/lunard/startup-eu-scout/actions/workflows/deploy-web.yml/badge.svg)](https://github.com/lunard/startup-eu-scout/actions/workflows/deploy-web.yml)
[![Live](https://img.shields.io/badge/live-eu--scout.codethecat.dev-blue?logo=azure-devops)](https://eu-scout.codethecat.dev)
[![version](https://img.shields.io/badge/version-v0.2.0-brightgreen)](./CHANGELOG.md)

A privacy-first **Progressive Web App** that runs entirely in the browser — no backend, no tracking, no cloud. All AI inference runs locally on your device's NPU or GPU.

---

## ✨ Key Features

- **Device gate** — checks WebGPU/WebNN support and GPU tier; blocks unsupported devices with clear guidance
- **Privacy-first** — first-run disclaimer explains no-server/no-tracking; all data stored encrypted locally
- **NPU/GPU AI** — detects your hardware (Snapdragon NPU via WebNN, or GPU via WebGPU) and asks your consent before loading any AI model
- **Startup profiling** — OpenCorporates registry lookup + website scraping
- **EU Summary** — local LLM generates a structured European funding profile with search keywords
- **Grant search** — EU Funding & Tenders Portal API with programme / status / action-type filters
- **AI fit scoring** — local LLM analyses each grant against your startup profile and caches results
- **Encrypted storage** — IndexedDB + AES-256-GCM (Web Crypto API); credentials never stored in plaintext
- **Installable PWA** — works offline after first load; add to home screen on iOS/Android

---

## 📱 Device Requirements

A **cutting-edge device** is required for on-device AI. The app will detect and inform you at startup.

| Device | AI Backend | Notes |
|--------|-----------|-------|
| iPhone 15 / 16 | GPU via WebGPU (A17/A18) | iOS 17.4+; NPU not yet web-accessible |
| iPad Pro M1, M2, M4 | GPU via WebGPU | Best mobile experience |
| Samsung Galaxy S23/S24/S25 | GPU via WebGPU (Adreno) | Chrome recommended |
| Snapdragon X Elite PC | **NPU via WebNN** 🧠 | Chrome/Edge; Hexagon NPU accessible |
| Desktop with discrete GPU | GPU via WebGPU | Chrome 113+ / Edge 113+ |

> On Snapdragon X Elite, the Hexagon NPU (45 TOPS) is reachable via WebNN — the only device where a web app can access the dedicated AI chip today.

---

## 🤖 AI Model Management

### Available models

| Model | Size on disk | RAM during inference | Best for |
|-------|-------------|---------------------|---------|
| **Qwen 2.5 1.5B** *(mobile default)* | ~1.0 GB | ~1.5 GB peak | iPhone, iPad, Android |
| Phi-3.5 Mini 3.8B *(desktop default)* | ~2.2 GB | ~3.0 GB peak | Desktop GPU, iPad Pro M4 |
| Llama 3.2 3B | ~2.0 GB | ~2.8 GB peak | Desktop GPU |

On iPhone/iPad the app automatically suggests **Qwen 2.5 1.5B** and shows a ⚠️ warning if a larger model is selected.

### Where models are stored

Model weights are fetched once by [WebLLM](https://webllm.mlc.ai/) and stored in the **browser's Cache API** (not IndexedDB). This is separate from app data:

- On Chrome/Edge: `chrome://cache` — survives browser restarts, shared across tabs
- On Safari: stored in origin-specific cache — survives app restarts when installed as PWA
- Typical location: the browser's own disk cache, managed by the browser

To clear model weights: **Settings → Safari/Chrome site data → Clear** or use the browser's developer tools to clear Cache Storage for `eu-scout.codethecat.dev`.

### Memory lifecycle

```
User taps "Load model"
  → WebLLM downloads weights (~1–2 GB) to Cache API (one-time, cached)
  → WebGPU compiles shader programs (~5–30s depending on device)
  → Model tensors uploaded to GPU VRAM / unified memory
  → window.__euScoutEngine stored in JS heap (in-memory reference)

During inference (Generate / Analyse)
  → KV-cache allocated per request (tokens × layers × head-dim)
  → Tokens streamed out one-by-one (stream:true) — frees memory earlier
  → max_tokens capped: 900 for summaries, 350 per grant analysis

When the page/tab is closed or killed by iOS
  → JS heap (engine reference) is lost immediately
  → GPU VRAM is released immediately
  → Cache API weights remain on disk (fast re-init on next open)

On next app open (if "Auto-restore on startup" is ON in Settings)
  → WebLLM re-compiles shaders from cached weights (~5–10s, no download)
  → Model is ready without any user action
```

### Why the app can crash on iPhone during generation

iOS Safari enforces a **per-tab memory limit** (approximately 2–4 GB depending on device and iOS version). Running a 2.2 GB model with the KV-cache can exceed this on older devices. Symptoms: Safari silently kills the tab and restarts it.

Mitigations already in place:
- **Streaming output** (`stream: true`) — releases KV-cache memory incrementally
- **Capped `max_tokens`** — limits peak allocation
- **Mobile default model** — Qwen 2.5 1.5B stays comfortably under the limit
- **Auto-restore** — if the tab is killed, re-opening the app restores the model from cache

---

## 🚀 Run Locally

```bash
cd web-app
npm install
npm run dev       # http://localhost:5173
npm run build     # production build → dist/
npm run preview   # preview the production build
```

The Vite dev server proxies EU API calls to avoid CORS — no extra config needed.

---

## 🐳 Docker

```bash
docker build -t eu-scout-web .
docker run -p 8080:80 \
  -e PROXY_EU_API=https://api.tech.ec.europa.eu \
  -e PROXY_OPENCORPORATES_API=https://api.opencorporates.com \
  eu-scout-web
# → http://localhost:8080
```

Final image is **~68 MB** (nginx:stable-alpine serving pre-built static assets).

---

## ☁️ Deploy to Azure Container Apps

Push a semver tag to trigger the full CI/CD pipeline:

```bash
git tag web/x.y.z
git push origin web/x.y.z
```

**Pipeline jobs:**
1. **Build** — `docker buildx` → push `:<sha7>` + `:latest` to ACR
2. **Deploy** — Bicep provisions `eu-scout-web` Container App → binds `eu-scout.codethecat.dev` with Azure-managed TLS
3. **Summary** — posts deployed FQDN + DNS reminder to the Actions run log

See [`infra/main.bicep`](./infra/main.bicep) and [`../.github/workflows/deploy-web.yml`](../.github/workflows/deploy-web.yml).

### Required GitHub Secrets

| Secret | Value |
|--------|-------|
| `AZURE_CLIENT_ID` | Service principal appId |
| `AZURE_CLIENT_SECRET` | Service principal password |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `ACR_REGISTRY` | ACR login server (e.g. `myacr.azurecr.io`) |
| `RESOURCE_GROUP` | Azure resource group name |
| `ACA_ENVIRONMENT` | Container Apps environment name |

---

## 🏗️ Architecture

```
web-app/
├── src/
│   ├── components/
│   │   ├── screens/
│   │   │   ├── DeviceCheckScreen.tsx    # WebGPU/WebNN probe + GPU tier gate
│   │   │   ├── DisclaimerScreen.tsx     # Privacy/AS-IS first-run notice
│   │   │   └── CapabilityScreen.tsx     # NPU/GPU detected — ask to proceed
│   │   ├── tabs/
│   │   │   ├── ProfileTab.tsx           # Startup profiling
│   │   │   ├── SummaryTab.tsx           # AI EU summary + keyword editor
│   │   │   ├── GrantsTab.tsx            # Search · filter · AI fit scores
│   │   │   ├── SettingsTab.tsx          # LLM loader + encrypted API key
│   │   │   └── LogTab.tsx               # Live application log
│   │   └── MainApp.tsx                  # Shell + bottom tab navigation
│   ├── lib/
│   │   ├── device-detect.ts             # WebGPU/WebNN/NPU capability detection
│   │   └── storage.ts                   # Dexie + Web Crypto AES-256-GCM
│   ├── store/appStore.ts                # Zustand global state
│   └── types/index.ts                   # Shared TypeScript types
├── infra/main.bicep                     # Azure Container Apps infrastructure
├── Dockerfile                           # Multi-stage build (node → nginx)
├── nginx.conf                           # SPA fallback + API proxies + COOP/COEP
├── vite.config.ts                       # Vite 6 + PWA plugin + dev proxies
└── CHANGELOG.md
```

---

## 🔒 Security & Privacy

- **No backend** — zero server component; nothing is ever transmitted to us
- **Encrypted storage** — all credentials and profiles stored with AES-256-GCM via the Web Crypto API
- **Local AI** — the LLM model runs on your NPU/GPU; prompts never leave the device (unless you opt in to Claude API)
- **COOP/COEP headers** — required for WebGPU `SharedArrayBuffer` used by WebLLM; set both in nginx and Vite dev server
- **StorageManager** — `navigator.storage.persist()` requested on first run to prevent browser eviction of your data

---

## 🧰 Tech Stack

| | |
|---|---|
| **React 19** + TypeScript + Vite 6 | UI framework |
| **Tailwind CSS v3** | EU navy/gold dark theme |
| **Framer Motion** | Screen transitions + card animations |
| **Zustand** | Global state management |
| **Dexie.js** + **Web Crypto API** | Encrypted IndexedDB storage |
| **@mlc-ai/web-llm** | Local LLM (Phi-3.5-mini · Qwen 2.5 · Llama 3.2) |
| **TanStack Query** | Async data fetching |
| **vite-plugin-pwa** | Service worker + offline support |
| **nginx:stable-alpine** | Production static file server |

---

## 📝 License

Apache 2.0 — see [LICENSE](../LICENSE).
