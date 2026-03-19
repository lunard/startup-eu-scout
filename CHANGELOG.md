# Changelog

## [0.4.0] — 2026-03-19

### Added
- **Opus Deep Analysis** — Phase 3 now uses a single Opus call with web search tools to intensively research each grant: reads Work Programme PDFs, verifies scope, eligibility, budget, TRL, and consortium requirements before ranking.
- **Live Analysis Stream** — new dark terminal panel shows Opus reasoning in real-time during grant analysis (web searches, document reading, evaluation).
- **Editable Keywords** — keyword tags now have × remove buttons and a `+ add keyword` input; changes are persisted immediately.
- **Auto-Resume** — app automatically loads the last selected startup profile on launch.
- **Clickable Grant IDs** — grant identifiers in the Opus stream are clickable links that open in the EU Portal.
- **Formatted Stream Output** — Opus stream shows 🔍 for web searches, 📄 for document reads, 💬 for result summaries instead of raw JSON.

### Changed
- **Ranking strategy** — replaced 15 individual per-grant Copilot calls with a single Opus call that reviews all filtered grants holistically.
- **Result count** — now shows top 15 ranked grants (up from 5).
- **Grant pool** — increased from 60 to 100 grants fed to the analysis pipeline.
- **Search trigger** — grants search only starts on button click (removed auto-search on filter change).
- **Prompt quality** — ranking prompt now instructs Opus to be honest about mismatches and prefer grants where the startup can realistically participate.

### Fixed
- **EIC programme filter** — sub-programme IDs like `HORIZON-EIC-...` now correctly match the EIC filter (was failing because `startsWith("EIC")` didn't match `HORIZON-EIC-...`).

## [0.3.12] and earlier
See git history for previous releases.
