# FR-033 — Life-at-Address Calculator · Phase 1 Discovery

*Read-only findings. No code changed in this phase.*

## What exists
- **Home chapter:** the "Daily Life" chapter is built in `src/modules/reachability/template.js` (`buildInsightsCardHTML` → a full `<section data-ch="daily">`, chapter 02). Its L3/L4 are structure-only today — room for the calculator at the end of that chapter.
- **Client interactivity already exists.** `public/ui.js` (489 lines) is mostly scroll/reveal/counter animations, **but it already handles interactive tab-switching** (climate/garden tabs respond to clicks). So live-updating inputs are an extension of an existing pattern, not a new paradigm. No bundler/framework — client logic is hand-written vanilla JS.
- **File-backed shared caches** (`src/cache.js`, `Cache` class): geocode (90d), places (7d), drivetime (24h), drivetime_cell (14d), watershed (90d). First request after expiry refreshes; everyone else reads the shared file. This is exactly the "one report fetches, everyone reuses" model for dynamic rates.
- **Optional-API-key convention:** keys read from `process.env` at call time, `null`/fallback if absent, documented in `.env.example` (GOOGLE_MAPS, NOAA_CDO, NREL).
- **FR-032 (unmerged branch)** provides a per-address electric rate (`getElectricData` → `residentialRate`) + `STATE_AVG_ELECTRIC_RATE`. FR-033's EV cost wants $/kWh.

## What's missing
- **No rate constants/values** (IRS mileage, gas price, MPG, maintenance/mi, EV kWh/mi) exist anywhere yet.
- **No employment-center data source** — and there's no clean/free way to identify a user's likely workplace. Decision: commute distance is **user-set**, not auto-detected.
- **No client-side computation layer** — the calculator's live recompute is the first instance.

## Data-source reality
- **Gas price:** real free API — **EIA** (`api.eia.gov` v2, weekly retail gasoline), needs `EIA_API_KEY` (free). Drives the marginal-cost headline.
- **IRS standard mileage rate:** **no clean API** — IRS publishes it on a webpage annually. Decision: best-effort fetch/parse + dated fallback, long TTL.
- **MPG / maintenance$/mi / EV kWh-per-mi:** no API exists — documented, dated modeling assumptions, centralized in the rates module (not scattered).

## Constraint review
- **CONSTRAINT-001 (no scoring):** the calculator outputs miles + dollar figures — factual, not a score/grade. Must avoid any good/bad labeling. OK.
- **CONSTRAINT-008 (no inline styles):** calculator markup uses semantic classes; slider/output CSS in `report.css`.
- **CONSTRAINT-009 (no business rules in template / layer purity):** the canonical driving math lives in a Jest-tested `reachability/logic.js` function; the client mirror is an isolated `public/calculator.js` (a deliberately small, documented duplication of the formula — there's no bundler to share one module across server+browser).
- **CONSTRAINT-011 (tests):** engine + rates parsers fully tested with fixtures; all 5 addresses.
- **CONSTRAINT-015 (graceful degradation):** every live rate fetch has a dated fallback; calculator renders a meaningful default with JS disabled.

## Decisions taken in brainstorming
- **Architecture = "engine + swappable skin":** decouple computation (durable, tested) from presentation (provisional, restyle-able in the frontend phase). This is what delivers Nathan's stated priority — flexibility to change the UI later.
- **Interaction = hybrid:** server-rendered default profile + sliders/presets for live adjustment.
- **Headline = marginal cost** (fuel÷MPG + maintenance); **IRS rate = secondary**; **EV-equivalent = the comparison.**
- **Rates = dynamic, centralized, cached** (your "one report refreshes for everyone" model); nothing hardcoded in the logic layer.
- **Branch off `main`, self-contained:** national-avg electric rate now, one-line seam to adopt FR-032's local rate post-merge.
