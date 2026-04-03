# Changelog

## [0.9.0] — 2026-03-19

### Added
- **Windows NSIS installer** — `npm run build:win` produces a full installer (`x64`) with custom install directory, desktop shortcut, and uninstaller.
- **Linux AppImage** — `npm run build:linux` produces a portable AppImage (`x64`), no installation required.
- **Windows ICO icon** — generated multi-size `.ico` (16–256px) for NSIS installer.
- All `dist` scripts now run `npm run build` automatically before packaging.

## [0.8.0] — 2026-03-19

### Added
- **Delete startup from history** — each profile in the "Profili Recenti" list now has a 🗑️ delete button (appears on hover). Deleting the active profile also resets all fields.
- **"Nuova Startup" button** — clears all form fields, search filters, results, and state for a fresh start.
- **Copy grant ID** — 📋 button in the accordion row copies the grant ID to clipboard with visual ✅ feedback.
- **Formatted descriptions** — grant descriptions in the accordion preserve HTML formatting (paragraphs, bullet lists, bold headings like "Expected Outcome:" / "Scope:") instead of showing a flat wall of text.

### Changed
- **Model constraint relaxed** — Claude Opus 4.6 is now _recommended_ instead of _required_. The app works with any Copilot model; a friendly suggestion modal appears when a non-Opus model is detected. The active model from Copilot config is used automatically.
- **Smart "Profila Startup"** — when the entered company name already exists in history, the button loads the cached profile instead of re-scraping. A new/unknown name triggers a fresh build.

### Fixed
- **HTML-safe descriptions** — EU grant HTML (`descriptionByte`) is sanitized to keep safe tags (`<p>`, `<ul>`, `<li>`, `<strong>`, etc.) and strip unsafe ones, converting EU-specific `<span class="topicdescriptionkind">` into bold headings.
- **Search highlighting in HTML** — text search in the accordion now highlights matches inside formatted HTML without breaking tags.

## [0.7.0] — 2026-03-19

### Fixed
- **Grant descriptions** — full descriptions now extracted from `descriptionByte` metadata field (Expected Outcome + Scope, 3000–6000+ chars), instead of relying on the short 300-char `description` or the often-empty `content` field.
- **Crawl endpoint** — grant detail crawl now uses the correct JSON data URL (`/data/topicDetails/{id}.json`) instead of the HTML portal page URL that returned unparseable responses.
- **Description merging** — enrichment keeps the longer of crawl vs metadata descriptions, so no data is lost.
- **Accordion dates** — formatted as human-readable dates instead of raw ISO timestamps.

### Added
- **Duration** field shown in accordion grant details.
- Accordion text filter now searches across the full description.

## [0.6.0] — 2026-03-19

### Added
- **Selectable Grant Accordion** — after API search, grants are shown in a checklist with checkboxes (all selected by default). Users can select/deselect individual grants or use "Select all" / "Deselect all" buttons (scope-aware: operates on filtered results when a text filter is active).
- **Confirm before Opus** — Opus deep analysis only starts when user clicks "🚀 Start Opus Deep Analysis on N grants". Shows live count of checked grants.
- **Collapsible Filter Card** — the search filters card auto-collapses when search starts, click to re-open.
- **Text filter with highlight** — search filter in accordion highlights matching text in yellow across ID, title, and description.
- **Expandable grant rows** — click any row to see full title, description, dates, budget, programme, and EU Portal link.

### Changed
- Accordion now renders above the Opus stream panel (in `grantAccordionArea`).
- Direct Grant ID mode skips the accordion confirm flow and analyses immediately.

## [0.5.0] — 2026-03-19

### Added
- **Direct Grant ID Analysis** — new textbox to paste a specific grant ID (e.g. `HORIZON-CL2-2026-01-DEMOCRACY-05`), skipping all filters and running Opus deep analysis on that single grant. Shows a warning disclaimer when active; quick-clear with ✕ button.
- **Grant Accordion** — collapsible list of all grants entering the Opus analysis phase, showing ID (clickable EU Portal link) and first 100 chars of title. Includes a live text filter to search by ID, title, or description.
- **Formatted Opus Stream** — live output now shows 🔍 for web searches, 📄 for document reads, 💬 for result summaries with clickable grant ID links, instead of raw JSON.
- **Search-only-on-click** — grants search now only triggers on button click (removed auto-search on filter change).

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
