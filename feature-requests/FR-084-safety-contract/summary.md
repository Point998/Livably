# FR-084 — Safety chapter → headless report contract (rollout #5) · Summary

**Status:** Complete · **Branch:** `FR-084-safety-contract` · **Date:** 2026-06-23 · **Schema:** unchanged (1.0)
Migrates the **safety** chapter to the contract — **5 of 14 chapters** now on the headless contract.

## What shipped

- **`src/modules/safety/contract.js` (new) — `buildSafetyContract({ emergency, safetyLocation }, opts)`:**
  - **`police-response` / `fire-response`** (bucket `consider`): `place{name,address}` + measure
    `{value: response.estimate, unit:'response_minutes'}`, `tone` derived via `responseTone` (≤8 favorable /
    ≤12 neutral / >12 caution — faithful to the template's tiers). Provenance `modeled: true` (the estimate
    is distance ÷ dispatch speed). Missing station → `*-response-missing` (check/caution + instruction fallback).
  - **`iso-ppc`** (check, always): no measure; actionable instruction to pull the address-specific ISO PPC
    rating from the insurer (premium-relevant).
  - **`crime-research`** (check, always): **no measure/comparison** — pointer only; url fallback to a
    neighborhood crime map. CONSTRAINT-002: never characterizes the area.
- **`src/services/reportBuilder.js`:** `contract.chapters.safety` wired additively.

## Constraint handling (the two traps)

- **CONSTRAINT-001/008:** the input stations carry a graded `response.category` (`Excellent/Good/Fair/Delayed`
  + color). The builder **drops it entirely** and derives `tone` instead. Tests assert the serialized contract
  contains no `"color"` and no `"category"`; the schema's `.strict()` would reject either anyway.
- **CONSTRAINT-002 (Fair Housing):** the chapter fetches no crime data, so the crime finding carries no
  measure/comparison — a pure actionable pointer.
- **CONSTRAINT-015:** every absent datum (missing station) and the always-on ISO/crime findings carry an
  actionable fallback. Honest provenance: response measures flagged `modeled`.

## Tests (+13, +3 snapshots) — full suite **94 suites / 1754 tests green** (was 93/1741)

- `tests/modules/safety/contract.test.js` (new): schema-valid; place+measure+modeled; `responseTone`
  tiers for both stations; missing-station fallbacks; always-on iso/crime; no score/grade/color/category;
  provenance dedupe; safetyLocation-only still yields iso+crime; per-address snapshots
  (Georgetown full, Harlan rural-far → caution, **Jeffersonville IN**).

## Notes / follow-on

- ADR-1 boundary preserved: safety = police/fire/crime/ISO only; the hospital/urgent-care half of the visual
  "Health & Safety" chapter stays in the health contract — the FE composes the two.
- Next located-facility rollout: **reachability** (the other one named in the session-7/8 hand-off).
- `defaultCopy` on iso/crime is transitional (FR-078 AC-9) — deleted when the FE owns voice.
