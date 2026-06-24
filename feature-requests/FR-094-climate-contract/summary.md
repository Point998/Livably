# FR-094 — Climate chapter → headless report contract (rollout #15) · Summary

**Status:** Complete · **Date:** 2026-06-24 · **Schema:** unchanged (1.0)
Migrates the **climate** chapter ("Climate & Weather Risks") to the contract — the genuinely **last chapter**
(climate was a roadmap recount miss, separate from the 14 numbered chapters). Built via the 4-phase workflow
with TDD (RED→GREEN on both the logic export and the contract).

## What shipped

- **`src/modules/climate/logic.js`:** `getTornadoTier(state)` moved here (pure `TORNADO_TIER` lookup, was in
  `template.js`) and exported — a business rule now lives in the logic layer.
- **`src/modules/climate/contract.js` (new) — `buildClimateContract(climateHistory, opts)`** emits up to 8
  findings from the already-processed `climateHistory` (clean mapping layer — no recompute):
  - **`seismic-hazard`** (when seismic present) — `pga` as a factual measure (`g_pga`); tone/bucket from band
    (low/very-low→cool/favorable, moderate+→check/caution); narrative→`defaultCopy`. **No graded
    `band`/`label`/`color`/`promote` emitted** (CONSTRAINT-001).
  - **`hot-days`** / **`cold-days`** (cool/neutral) — `days_per_year` from NOAA `annual` normals; provenance
    `modeled:false` for NOAA, `modeled:true` for the Open-Meteo fallback (`normalsSource`).
  - **`disaster-history`** (always) — FEMA weather-declaration count; `0`→cool/favorable, `>0`→consider/neutral
    (+ last significant event in copy).
  - **`tornado-frequency`** — state tier (High→check/caution, Moderate→consider/neutral, Low→cool/favorable);
    omitted when state absent/Unknown; `modeled:true` (regional/state-level). Categorical copy, no numeric score.
  - **`topographic-position`** — lowpoint→check/caution + ask-seller instruction (CONSTRAINT-015), uphill→
    cool/favorable, midslope omitted.
  - **`named-watershed`** (cool/neutral) and **`emergency-alerts`** (always; check/neutral; tier-1 official URL
    vs tier-2 search URL — CONSTRAINT-015).
- **`src/services/reportBuilder.js`:** `contract.chapters.climate` wired additively (guarded on
  `chapters.climateHistory`; `state`/`county` threaded from `locationInfo`).
- **`climate/template.js`: byte-unchanged** (`git diff --stat` confirms only logic/contract/reportBuilder/tests).

## Constraint & feel handling

- **CONSTRAINT-001/008:** no composite climate score; seismic `pga` is an external-index measure with tone
  derived from band and **no graded label field**; tornado tier is categorical copy. Tests assert no
  `score`/`grade`/`rating` (word-boundary) and no leaked `band`/`color`/`promote`/`ss`/`sds`/`s1` keys nor the
  graded "seismic hazard" label text.
- **CONSTRAINT-016:** NOAA station validity is enforced upstream in `data.js`; the contract surfaces honest
  provenance — Open-Meteo fallback → `modeled:true` with the modeled source name.
- **CONSTRAINT-015:** `emergency-alerts` always carries a registration URL; lowpoint carries an ask-seller instruction.
- **Scope discipline:** flood / AQI / radon / noise / water / hazard are **environment-owned (FR-090)** and
  not re-emitted; a test asserts no `floodrisk`/`aqi`/`radon` leakage.
- **Value-neutral** (per growth FR-091): heat/cold days, disaster count, watershed are neutral; cautions only
  for high seismic, lowpoint drainage, high tornado.

## Tests (+17, +4 snapshots) — full suite **105 suites / 1890 tests green** (was 104/1873)

- `tests/modules/climate/logic.test.js` (+3): `getTornadoTier` High (KY/IN), Moderate (MT), Low (CA),
  Unknown (''/'ZZ'); pure shape.
- `tests/modules/climate/contract.test.js` (new, 11 + 4 snapshots): schema-valid + chapterId/version; seismic
  measure/tone + no graded-label leak (+ high-pga branch); hot/cold-days + modeled flag (NOAA vs Open-Meteo);
  disaster 0 vs >0; tornado bands + Unknown/no-state omitted; topographic lowpoint/uphill/midslope; alerts
  tier-1 vs tier-2 URL; CONSTRAINT-001 + env-leakage guards. Snapshots: Georgetown KY, **Jeffersonville IN**
  (high tornado), **Bozeman MT** (moderate tornado, different climate), synthetic **CA low-tornado +
  very-high seismic** (no live test address is low-tornado or high-seismic).

## Notes / follow-on

- `defaultCopy` transitional (FR-078 AC-9).
- **`// shortcut:` logged in `climate/logic.js`:** `getTornadoTier` is also defined inline in
  `climate/template.js`; logic.js is now the contract's source but the SSR template copy was left in place
  (surgical, matches rollouts #1–14). Collapse onto the logic.js export when the template is next touched.
- **Contract rollout is now complete for ALL chapters** (14 numbered + climate). The only remaining contract
  work is the deferred sensory **ambiance** items (airports/rail/light) — a small additive FR to `sensory/contract.js`.
