# FR-093 — Costs chapter → headless report contract (rollout #14) · Summary

**Status:** Complete · **Date:** 2026-06-24 · **Schema:** unchanged (1.0)
Migrates the **costs** chapter ("Property Costs & Market") to the contract — **14 of 14 numbered chapters**.
(Climate remains a separate, still-uncontracted chapter — out of scope here.) Built via the 4-phase
workflow with TDD (RED → GREEN on both new files).

## What shipped

- **`src/modules/costs/logic.js` (new) — pure `computeCosts(propertyData)`:** the chapter's first real logic
  layer (costs previously did data+logic+template inline in `template.js`). Returns
  `{ taxRate, state, referencePrice, monthly:{tax,insurance,utilities,total}, taxComparison:{direction,deltaPct,referenceValue} }`.
  No HTML, no API (CONSTRAINT-009) — the `STATE_*` lookups already happened upstream in `getPropertyData`.
- **`src/modules/costs/contract.js` (new) — `buildCostsContract(propertyData, opts)`** emits 5 findings:
  - **`property-tax-rate`** — the one finding using `comparison`: measure `{value, unit:'percent_effective'}`
    + `{basis:'national_average', referenceValue:1.0, direction, deltaPct, region:state}`. Bucket/tone from
    the band: `below→cool/favorable`, `near→consider/neutral`, `above→check/caution`. Lincoln Institute, modeled.
  - **`insurance-estimate`** / **`utilities-estimate`** (consider/neutral) — `usd_per_month` measures; NAIC / EIA, modeled.
  - **`carrying-cost-estimate`** (consider/neutral) — the transparent component **sum** at the $300k
    reference (`unit:'usd_per_month_at_300k_ref'`); a budgeting input, **not** a score (CONSTRAINT-001).
  - **`homestead-exemption`** (cool/favorable) — emitted **only when** `homesteadNote` present (KY/TX/…);
    `defaultCopy = note`; State homestead statute, `modeled:false`.
- **`src/utils/constants.js`:** `NATIONAL_AVG_PROPERTY_TAX_RATE = 1.0` (Lincoln Institute ≈1.0% national
  effective; equals the existing `getPropertyData` default) — the named `comparison.referenceValue`.
- **`src/services/reportBuilder.js`:** `contract.chapters.costs` wired additively (guarded on `chapters.propertyData`).
- **`costs/template.js`: byte-unchanged** (`git diff --stat` confirms only logic/contract/constants/reportBuilder/tests).

## Constraint & feel handling

- **CONSTRAINT-001 (no scoring):** component costs as factual measures; the carrying total is a transparent
  sum, never a verdict/grade. A test asserts no `score`/`grade`/`rating`/`affordab` token (word-boundary so
  the legitimate `degraded` field doesn't false-positive) and no `score`/`grade`/`rating` keys on findings.
- **CONSTRAINT-002 (Fair Housing):** the **only** comparison basis is `national_average` (a tax-RATE
  comparison, never income/economic class); no income finding; a test asserts no income/wealth/class string.
- **CONSTRAINT-015 (graceful degradation):** every modeled estimate carries an actionable "get your real
  number" instruction (assessor lookup, 3 quotes, 12 months of bills, mortgage math).
- **Honest provenance:** all four estimates `modeled:true` (state averages, not parcel-specific); homestead
  `modeled:false` (documented statute). The $300k reference anchor is baked into the carrying-cost unit token
  so the FE can never render it as an address-specific quote.
- **Non-goal:** no home-value estimate (Census lags 3–5 yrs); the SSR template keeps its Zillow/Redfin/CMA redirect.

## Tests (+21, +4 snapshots) — full suite **104 suites / 1873 tests green** (was 102/1852)

- `tests/modules/costs/logic.test.js` (new, 8): null→null; $300k anchor; KY monthly math (208/140/190/538);
  purity (plain object, no `<`, no functions); bands below/near/above incl. edges (0.9→below, 1.1→above).
- `tests/modules/costs/contract.test.js` (new, 13 + 4 snapshots): schema-valid + chapterId/version; tax
  measure+comparison + all three buckets/tones; the three estimates + carrying sum (usd_per_month*, all
  modeled, each with a fallback); carrying = tax+ins+util; homestead present/absent toggle; CONSTRAINT-001
  leak guard; CONSTRAINT-002 basis/vocabulary guard. Snapshots: Georgetown KY (homestead), Bozeman MT,
  **Jeffersonville IN**, synthetic NJ high-tax (above-branch — no live test address is above national avg).

## Notes / follow-on

- `defaultCopy` is transitional (FR-078 AC-9) — FE owns voice later.
- **`// shortcut:` logged in `costs/logic.js`:** the SSR `template.js` still computes carrying costs inline in
  ~4 places; `logic.js` is the new single source for the contract but the template was intentionally not
  refactored onto it (surgical scope, matches rollouts #1–13). Revisit when the template is next touched.
- **Contract rollout is now complete for all 14 numbered chapters.** Remaining contract work: **climate**
  (separate real chapter, still off the contract) and the deferred sensory-ambiance additive FR (airports/rail/light).
