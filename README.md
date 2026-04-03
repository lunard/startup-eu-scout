# 🇪🇺 EU Scout — AI-Powered EU Funding Scout

**Find the EU grants that actually fit your startup — in minutes, not weeks.**

[![Deploy EU Scout Web](https://github.com/lunard/startup-eu-scout/actions/workflows/deploy-web.yml/badge.svg)](https://github.com/lunard/startup-eu-scout/actions/workflows/deploy-web.yml)
[![Web App](https://img.shields.io/badge/web-eu--scout.codethecat.dev-blue?logo=azure-devops)](https://eu-scout.codethecat.dev)
[![Web version](https://img.shields.io/badge/web--app-v0.2.0-brightgreen)](./web-app/CHANGELOG.md)
[![Electron version](https://img.shields.io/badge/electron--app-v0.10.0-blue)](./electron-app/CHANGELOG.md)

---

This monorepo contains two independent apps sharing the same mission — scout EU funding for your startup.

| | [EU-Match](./electron-app/) | [EU Scout Web](./web-app/) |
|---|---|---|
| **Type** | Desktop (Electron) | Mobile PWA |
| **Platform** | Windows · macOS · Linux | iPhone · iPad · Android · any modern browser |
| **AI backend** | Claude Opus via GitHub Copilot CLI | Local LLM on NPU/GPU · or Claude API |
| **Storage** | electron-store + OS Keychain/DPAPI | IndexedDB + AES-256-GCM (Web Crypto) |
| **Offline** | No | Yes (after model download) |
| **Live** | desktop app / local | [eu-scout.codethecat.dev](https://eu-scout.codethecat.dev) |
| **Docs** | [electron-app/README.md](./electron-app/README.md) | [web-app/README.md](./web-app/README.md) |

---

## 📝 License

Apache 2.0 — see [LICENSE](LICENSE).
