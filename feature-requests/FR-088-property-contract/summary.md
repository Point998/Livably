# FR-088 — Property Intelligence chapter → headless report contract (rollout #9) · Summary

**Status:** Complete · **Branch:** `FR-088-property-contract` · **Date:** 2026-06-23 · **Schema:** unchanged (1.0)
Migrates the Property Intelligence chapter (soil + construction era/vintage) to the contract — **9 of 14
chapters**. **First non-located chapter** — findings designed bespoke from `propIntel` (no `place{}`).

## What shipped

- **`src/modules/property/contract.js` (new) — `buildPropertyContract(propIntel, opts)`:**
  - **`construction-era`** (consider): measure `{value: medianYearBuilt, unit:'year_built'}`, tone `neutral`
    (a factual median — NOT a quality judgment; CONSTRAINT-001). Census ACS. defaultCopy = era label.
  - **`era-health-risks`** (check, caution): emitted only when the era has cautions (older homes →
    lead/asbestos/wiring/plumbing); instruction fallback to test/inspect; defaultCopy lists the cautions.
    Omitted for modern construction (faithful to the template).
  - **`soil-drainage`** (check): `tone = toneFromDrainageColor` (green/lightgreen→favorable,
    gold/muted→neutral, orange/red→caution — the color is consumed then dropped); `isHydric` forces
    caution + appends the wetland/foundation note; defaultCopy = `"{label} — {implication}"`. USDA SDA.
  - **`soil-missing`** (check): when no drainage data → url fallback to the point-specific SoilWeb deep
    link (`soilwebUrl`, always present) — CONSTRAINT-015 floor.
  - **`new-construction`** (cool): measure `{value: newConstructionPct, unit:'percent'}`, tone neutral —
    housing-stock fact, not demographic (CONSTRAINT-002 safe).
- **`src/services/reportBuilder.js`:** `contract.chapters.property` wired additively.

## Constraint handling (first non-located chapter)

- **CONSTRAINT-001/008:** no composite score/grade; the drainage `color` derives `tone` then is dropped.
  A test asserts no `"color"`/`"drainagecl"`/`"muname"`/`"context"`/`"hydricrating"` leak; `.strict()` enforces it.
- **CONSTRAINT-002:** only housing-stock facts (year built, new-construction %) — never demographic character.
- **CONSTRAINT-015:** soil always yields a finding (drainage or SoilWeb-url fallback); older homes carry an
  inspection instruction.

## Tests (+13, +3 snapshots) — full suite **98 suites / 1800 tests green** (was 97/1787)

- `tests/modules/property/contract.test.js` (new): schema-valid; construction-era measure/tone;
  era-health-risks emitted-only-when-cautions; drainage tone from color (favorable green / caution
  red+hydric); soil-missing → SoilWeb url; new-construction percent/cool; no score/grade/leaked-keys;
  provenance dedupe; per-address snapshots (Georgetown full, Harlan old+poor-drainage, **Jeffersonville IN** modern).

## Notes / follow-on — DECISION NEEDED before walkability

- **Walkability is blocked on a CONSTRAINT-001 decision.** It emits a 0–100 composite `score` + graded
  category (Walker's Paradise / Very Walkable / …) — a numerical quality rating the constraint forbids. The
  contract schema has no `score` field, and `{value: 72, unit:'walk_score'}` would surface exactly that
  banned composite. Options: (a) omit the score, surface only the underlying destination counts (grocery/
  transit/park/etc. within walking distance) as factual measures; (b) omit walkability from the contract
  entirely; (c) revisit whether Walk-Score-style proxies are exempt as an external standard metric. **Needs
  Nathan's call.** Recommend (a) — it preserves the signal as facts without a composite rating.
- Other clean non-located candidates next: **environment** (FEMA flood zone, EPA air — factual/categorical),
  **growth**, **garden**. `defaultCopy` is transitional (FR-078 AC-9).
