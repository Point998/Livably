# FR-059 — Seismic Risk (Climate enhancement) · Phase 1 Discovery

*Read-only findings. No code changed in this phase.*

## Why this is an enhancement, not a new chapter
Per the "fit new data into the chapter where it belongs" principle: a buyer's earthquake risk is a *natural hazard of the address* — the same bucket as flood/tornado/winter that the **Climate** chapter ("the risks that come with the address, not just the house") already owns. It belongs inside Climate, not in a standalone chapter.

This direction emerged after discovery ruled out two redundant new-chapter ideas:
- **Emergency Preparedness** ≈ Climate already pulls **OpenFEMA disaster declarations** (`climate/data.js#getFEMADeclarations`, 20-yr) + a preparedness tab (alerts, 72-hr kit, evac/road-priority).
- **Environmental Hazards** ≈ Sensory already pulls **EPA EJSCREEN** (Superfund/RMP/TSDF percentiles), EPA water-system violations, and radon.
- **Cell signal** — spiked and dropped: FCC mobile coverage is **bulk-download only** (per-state/provider H3-hex / shapefiles), no clean free point-query.

## Data source — verified live
**USGS Seismic Design Web Service** (ASCE 7-16): `https://earthquake.usgs.gov/ws/designmaps/asce7-16.json?latitude=&longitude=&riskCategory=II&siteClass=D&title=`. Free, no key, point-query. Live spike results:
- **Bozeman MT** → `pga 0.30, ss 0.68, s1 0.213, sds 0.569` (seismic country)
- **Georgetown KY** → `pga 0.084, ss 0.168, s1 0.082, sds 0.179` (quiet)

~4× contrast — genuinely differentiating. `response.data` carries `pga, ss, s1, sds` (and sometimes `sdc`, which can be `null` — derive the layperson band from `pga`, not `sdc`). Spatially stable + the hazard model updates only every ~6 years → **cell-cacheable, long TTL** (like the watershed cache).

## Where it fits in the Climate module (current structure)
`src/modules/climate/`:
- `data.js#getClimateHistoryData(lat,lng,locationInfo,fips)` — a `Promise.allSettled` over storm/FEMA/normals/watershed fetchers; composes the returned `climateHistory` object; already imports + calls `./logic` helpers (`getEmergencySystem`, etc.). **Add `getSeismicHazard` here, compose `seismic` via `getSeismicContext`.**
- `template.js#buildClimateChapterHTML(environment, climateHistory, locationInfo)`:
  - **L2 body** (`leftHTML`): has a `prem-climate-row` tornado row (the exact model for a promoted seismic row) + flood narrative + FEMA count + action checklist + key-takeaway.
  - **L3 deep-dive**: `buildClimateDeepDiveHTML` builds a 6-tab `climate-tab` panel (flood/tornado/winter/heat/prepared/calendar). **Add a 7th "Seismic" tab.**
  - **L4 research**: `buildClimateResearchHTML` (watershed context + storm-log + normals tables). **Add a seismic design-values table.**
- `logic.js` — pure helpers (categorization). **Add `getSeismicContext`.**

## Constraints in play
- **CONSTRAINT-001 (no scoring):** express risk as a descriptive **band** (very-low…very-high), exactly like the existing flood-zone risk labels and tornado tiers — never a numeric score.
- **CONSTRAINT-009 / three-layer:** `data.js` fetch only; `logic.js#getSeismicContext` does the band/narrative; `template.js` renders.
- **CONSTRAINT-015:** `null` → actionable USGS lookup fallback (no silent gap).
- **Cost (FR-058 alignment):** cell-cached, long TTL — neighbors share one fetch.
- **CONSTRAINT-011:** tests for bands (Bozeman=high, Georgetown=low), null path, all 5 addresses.

## Adaptive placement (the key design decision)
Most US addresses (incl. 4 of 5 test addresses) are low-seismic. To avoid making the chapter shout about a non-issue ("no laundry list"):
- **L3 Seismic tab:** always present when data resolves.
- **L2 promoted row:** only when band ≥ **moderate** (e.g., Bozeman). Low/very-low stays tucked in L3.
- **L4:** raw design values + USGS source always (when data resolves).
