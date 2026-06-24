# FR-090 — Environment chapter → headless report contract (rollout #11) · Summary

**Status:** Complete · **Branch:** `FR-090-environment-contract` · **Date:** 2026-06-23 · **Schema:** unchanged (1.0)
Migrates the environmental health & safety data to the contract — **11 of 14 chapters**.

## What shipped

- **`src/modules/sensory/contract.js` (new) — `buildEnvironmentContract(environment, opts)`** — 6 findings
  from `getEnvironmentalData`:
  - **`flood-risk`** (check): FEMA zone (categorical), tone from risk (Minimal→favorable, High/Very High→
    caution); zone + insurance in defaultCopy. Absent → `flood-risk-missing` + FEMA MSC url.
  - **`air-quality`** (consider): `{value: aqi, unit:'aqi'}`, tone from AQI category color. Absent → AirNow url.
  - **`road-noise`** (consider): `{value: dnl, unit:'dnl_db'}`, tone from DNL category; `modeled:true` when
    source is estimated (+ "visit at rush hour" caveat).
  - **`water-quality`** (check): `{value: violations.length, unit:'violation_count'}`, caution when >0 (+ECHO url).
  - **`radon`** (check): EPA zone tone (1→caution, 3→favorable), **`modeled:true`** (state-level) + an
    address-specific-test instruction (CONSTRAINT-015).
  - **`hazard-proximity`** (check): EPA EJSCREEN **hazard proximity only** — caution when `flagged`, EPA ECHO
    url; describes Superfund/RMP/TSDF facility proximity, never demographics (CONSTRAINT-002).
- **`src/services/reportBuilder.js`:** `contract.chapters.environment` wired additively.

## Principle established (applies to the remaining chapters)

**External standard indices are factual data, not Livably composite scores.** EPA AQI, FEMA flood zone,
EPA radon zone, EPA EJSCREEN percentile, FHWA DNL are external standardized measurements → surfaced as
measures with tone derived from their published category (the graded label + color dropped — CONSTRAINT-008).
This differs from walkability's **Livably-computed composite** score (FR-089), which CONSTRAINT-001 banned.
Precedent: FEMA flood zone and ISO PPC were already surfaced as external facts.

## Constraint handling

- **CONSTRAINT-001/008:** external indices as factual measures; graded category label/color dropped (tone
  derived). A test asserts no `"color"`/`"category"` leak; `.strict()` enforces it.
- **CONSTRAINT-002 (Fair Housing):** EJSCREEN surfaced as hazard proximity only — a test asserts no
  `minority`/`income`/`race`/`demographic`/`poverty` terms appear in the serialized contract.
- **CONSTRAINT-015:** flood/air/water carry url fallbacks; radon always recommends a test; hazard → EPA ECHO.
- **Honest provenance:** state-level radon and estimated road noise are `modeled:true`; the rest measured.

## Tests (+13, +3 snapshots) — full suite **100 suites / 1827 tests green** (was 99/1814)

- `tests/modules/sensory/contract.test.js` (new): schema-valid; flood/air/noise/water/radon/hazard tone
  derivations; modeled flags; violations-count tone; no-demographics assertion; no score/color/category
  leak; provenance dedupe; per-address snapshots (Georgetown clean, Harlan high-radon, **Jeffersonville IN**
  flood+hazard).

## Notes / follow-on

- **11 of 14 chapters.** Deferred (documented): sensory **ambiance** items — airports, rail proximity, light
  pollution (Bortle) — a smaller follow-on FR. Remaining chapters: **growth**, **garden**, **costs**,
  multi-source **climate** (heat/seismic indices — apply the external-index principle), plus the deferred ambiance.
- `defaultCopy` transitional (FR-078 AC-9).
