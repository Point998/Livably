# FR-090 — Environment chapter → headless report contract (rollout #11)

**Status:** Spec · **Module:** `src/modules/sensory/contract.js` (new) + wiring in `reportBuilder.js`
**Origin:** contract rollout (FR-078) · **Date:** 2026-06-23 · **Schema:** no change (1.0)

## Problem / goal

Migrate the **environmental** data (`getEnvironmentalData`, in the sensory module; rendered within the
climate chapter) to the contract. Scope = the **environmental health & safety** findings; the sensory
**ambiance** items (airports / rail / light pollution) are deferred to a documented follow-on. Added
additively as `contract.chapters.environment`. **11 of 14 chapters** after this.

## Principle established here (applies to all remaining chapters)

**External standard indices are factual data, NOT Livably composite scores.** EPA AQI, FEMA flood zone,
EPA radon zone, EPA EJSCREEN percentile, FHWA DNL noise level are external, standardized measurements —
surfaced as `measure`s with tone derived from their published category (the graded label + color is
dropped — CONSTRAINT-008). This is categorically different from walkability's **Livably-computed composite
score** (FR-089), which was banned by CONSTRAINT-001 and reduced to underlying counts. Precedent: the FEMA
flood zone and ISO PPC rating are already surfaced as external facts (safety contract, data standards).

## Inputs

`buildEnvironmentContract(environment, opts)` where `environment` (`chapters.environment`, or `null`) =
`{ airQuality, floodRisk, roadNoise, waterQuality, radon, ejscreen, airports, rail, lightPollution, ... }`:
- `airQuality`: `{ aqi, category:{label,color}, primaryPollutant }` | null (EPA AirNow).
- `floodRisk`: `{ zone, risk('Minimal'|'Moderate'|'High'|'Very High'|'Unknown'), insuranceRequired, description }` | null (FEMA NFHL).
- `roadNoise`: `{ dnl, source, category:{label,color,hint}, nearestRoad }` | null (BTS/FHWA; `source` includes 'estimated' when modeled).
- `waterQuality`: `{ systemName, pwsId?, violations:[] }` | null (EPA SDWIS).
- `radon`: `{ zone: 1|2|3 }` | null (EPA radon zones, **by state** — coarse → modeled).
- `ejscreen`: `{ superfundPct, rmpPct, tsdfPct, flagged }` | null (EPA EJSCREEN — **hazard proximity only**, no demographics).
- `opts = { asOf?, degraded? }`. Returns `null` when all six health/safety inputs are absent.

## Findings produced (6, health & safety scope)

1. **`flood-risk`** (check): categorical (no measure); `tone = floodTone(risk)` (Minimal→favorable,
   Moderate→neutral, High/Very High→caution); defaultCopy = `"Zone {zone}: {description}"` + insurance note.
   FEMA NFHL, modeled:false. Absent → `flood-risk-missing` (check) + FEMA MSC url fallback.
2. **`air-quality`** (consider): measure `{value: aqi, unit:'aqi'}`; `tone = toneFromColor(category.color)`;
   defaultCopy = primary pollutant + category description. EPA AirNow, modeled:false. Absent →
   `air-quality-missing` (check) + AirNow url.
3. **`road-noise`** (consider): measure `{value: dnl, unit:'dnl_db'}`; `tone = toneFromColor(category.color)`;
   defaultCopy = category hint (+ "estimated" caveat when modeled). `modeled = /estimated/i.test(source)`.
4. **`water-quality`** (check): measure `{value: violations.length, unit:'violation_count'}`; `tone` =
   caution if any violations, else favorable; defaultCopy = system name + violation summary. EPA SDWIS,
   modeled:false. Absent → `water-quality-missing` (check) + EPA ECHO/SDWIS url fallback.
5. **`radon`** (check): categorical EPA zone (no measure); `tone = radonTone(zone)` (1→caution, 2→neutral,
   3→favorable); **modeled:true** (state-level), defaultCopy notes the coarse zone + recommends an
   address-specific radon test (cheap, always worth it — actionable). EPA Radon Zones.
6. **`hazard-proximity`** (check): EJSCREEN hazard-proximity (no demographics); `tone` = caution if
   `flagged`, else neutral; no measure; defaultCopy = which percentile(s) elevated (Superfund/RMP/TSDF) or
   "below 75th pct on all"; `fallbackAction` = EPA ECHO url (specific facilities). EPA EJSCREEN, modeled:false.

`toneFromColor(c)`: green|lightgreen→favorable, orange|red→caution, else neutral.

## Edge cases & constraints

- **CONSTRAINT-001/008:** external indices are factual measures; the graded category `label`/`color` are
  dropped (tone derived). No Livably composite score. A test asserts no `"color"`/`"category"` leak.
- **CONSTRAINT-002 (Fair Housing):** EJSCREEN is surfaced as **hazard proximity only** (Superfund/RMP/TSDF
  facility percentiles) — never demographic indices (the data layer already extracts only these). Described
  as documented industrial/hazard-site proximity, never demographic character.
- **CONSTRAINT-015:** flood/air/water carry url fallbacks when absent; radon always recommends a test;
  hazard always points to EPA ECHO.
- **Honest provenance:** radon (state-level) and estimated road noise are `modeled:true`; the rest measured.
- **Deferred (documented):** airports / rail / light pollution (sensory ambiance) — a smaller follow-on FR.

## Acceptance criteria

- AC-1: full input → schema-valid, `chapterId:'environment'`, `schemaVersion:'1.0'`.
- AC-2: flood-risk tone derives from risk; insurance + zone in defaultCopy; absent → FEMA url fallback.
- AC-3: air-quality `{value: aqi, unit:'aqi'}`, tone from category color (good→favorable, unhealthy→caution).
- AC-4: road-noise `{value: dnl, unit:'dnl_db'}`, `modeled:true` when source is estimated.
- AC-5: water-quality violations count drives tone (0→favorable, >0→caution).
- AC-6: radon tone from zone (1→caution, 3→favorable), `modeled:true`, test recommendation in defaultCopy.
- AC-7: hazard-proximity caution when `flagged`; EPA ECHO url fallback; **no demographic content**.
- AC-8: no `score`/`grade`/`rating`; serialized contract has no `"color"`/`"category"` keys.
- AC-9: all six absent → `null`.
- AC-10: per-address snapshots incl. **Jeffersonville IN**, Georgetown, Harlan (high radon / rural).
- AC-11: wired additively into `reportBuilder` as `chapters.environment`; full suite green incl. 5 addresses.

## Notes

- `defaultCopy` transitional (FR-078 AC-9). Deferred ambiance items tracked for a follow-on.
