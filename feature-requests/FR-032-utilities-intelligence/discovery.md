# FR-032 — Utilities Intelligence · Phase 1 Discovery

*Read-only findings. No code changed in this phase.*

## What exists
- **Module pattern is clean and repeatable.** Each chapter = `src/modules/<name>/{data,logic,template}.js`. Data fetches only, logic applies business rules (zero HTML/API), template emits HTML (zero API/business rules). Wired in `src/chapters.js` `getChapterData` (`Promise.allSettled`) and rendered in `buildChaptersHTML`.
- **`utilities/` slot is already reserved** in the Module Map (roadmap line ~163) but not built.
- **Depth slider** (FR-045): every chapter renders via `renderChapterCard(...)` with L1 glance / L2 body / `depth-l3` / `depth-l4`. L3 deep dives use the tabbed `climate-tab` pattern (see `property/template.js`).
- **The Property chapter already ships ISP/broadband** via the FCC National Broadband Map (`property/data.js#getBroadbandData`, rendered in `property/template.js` "Internet Providers" tab). FR-032 must **not** duplicate this — it cross-links instead.
- **API-key convention:** optional keys read from `process.env` at call time; return `null` silently if absent (graceful degradation); documented in `.env.example`. Existing: `GOOGLE_MAPS_API_KEY`, `NOAA_CDO_API_KEY`, `AIRNOW_API_KEY`, `CENSUS_API_KEY`.
- **Rural classification** (CONSTRAINT-007) is computed upstream in `reportBuilder.js` / `validate.js` and density label is available via `community/logic.js#getDensityType`.
- **Drive times** are computed by Google and passed *into* modules (modules never call Google directly), per `getChapterData` signature (`getDriveTime`).

## What's missing / the core constraint
The FR-032 backlog sketch lists nine sub-features; only some have a clean, free, **address-level** source:

| Sub-feature | Data reality |
|---|---|
| Electric provider + residential rate vs state avg | ✅ NREL Utility Rates API v3 (lat/lon → `utility_name` + `residential` $/kWh), free w/ key. State avg via bundled EIA constant. |
| EV charging nearest + cost | ✅ NREL Alternative Fuel Stations API (`fuel_type=ELEC`, nearest L2 + DC-fast) + Google drive time + local rate. |
| Electric utility type (muni/co-op/IOU) | 🟡 Inferred from utility name heuristics; hedged, not authoritative. |
| Outage history (SAIDI/SAIFI) | 🟡 EIA-861 is utility-level + annual, no clean live API. v1 ships **state-average** context, clearly labeled. |
| Gas / water / sewer (municipal vs well/septic/propane) | 🔴 No free address-level source. Inferred from rural mode + density, always paired with a verify-here action. |
| ISP + actual-vs-advertised speeds | ⚠️ Overlaps Property chapter (already shows FCC advertised). v1 **cross-links**, does not rebuild. |

## What could break
- **New API dependency (NREL).** Mitigated: `NREL_API_KEY` optional, `DEMO_KEY` low-volume fallback, `null` → actionable fallback (CONSTRAINT-015).
- **CONSTRAINT-001 (no scoring):** rate/reliability comparisons must be factual deltas ("near / above / below state average"), never a graded "utility score."
- **CONSTRAINT-004 (no hardcoded brands in search/filter):** utility & ISP names are inbound *content* from data sources — allowed. No brand names appear in any query/filter/exclusion.
- **Cross-state (PM-001 class):** utility territories can cross state lines. We report the *named* utility from the API and compare to the **origin state** average with that caveat — no wrong-state primary finding.
- **CONSTRAINT-015:** no silent empty sections — missing NREL key/data → named, actionable fallback (NREL lookup / state PUC).

## Decisions taken in brainstorming
- **Scope:** "Solid core first" — electric (provider + rate vs state avg) and EV charging are the rock-solid core; gas/water/sewer + outage ship as honest inferred/context sections with fallbacks; ISP deferred to Property (cross-link).
- **Outage:** state-average SAIDI/SAIFI context number from bundled EIA-861 data, labeled state-level (not parcel-level).
- **EV boundary:** this chapter = charger locations + cost-per-charge at local rate. Per-commute annual EV cost stays in FR-033 (which consumes this chapter's local rate).
