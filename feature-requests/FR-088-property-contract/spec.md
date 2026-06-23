# FR-088 — Property Intelligence chapter → headless report contract (rollout #9)

**Status:** Spec · **Module:** `src/modules/property/contract.js` (new) + wiring in `reportBuilder.js`
**Origin:** contract rollout (FR-078) · **Date:** 2026-06-23 · **Schema:** no change (1.0)

## Problem / goal

Migrate the **Property Intelligence** chapter (soil + construction era/vintage) to the headless report
contract. This is the **first non-located chapter** — no `place{}`; findings are designed bespoke from the
`propIntel` logic output (factual measures, qualitative classifications, actionable checks). Added
additively as `contract.chapters.property`. **9 of 14 chapters** after this.

ADR-1 boundary: scope is `getPropertyIntelligence` output (`chapters.propIntel`). The tax/insurance/
utilities `propertyData` is rendered by the **costs** module and belongs to a future costs contract.

## Inputs

`buildPropertyContract(propIntel, opts)` where `propIntel` (or `null`) =
`{ soil, soilwebUrl, era, housingAgeBands, locationInfo }`:
- `soil`: `{ muname, drainagecl, hydricrating, isHydric, drainageCategory: {label, color, implication}|null }` or `null`.
- `soilwebUrl`: always present when `propIntel` exists (point-specific SoilWeb deep link).
- `era`: `{ medianYearBuilt, newConstructionPct, context: { era, cautions: string[] } }` or `null`.
- `opts = { asOf?, degraded? }`.

Returns `null` when `propIntel` is absent.

## Findings produced

1. **`construction-era`** (bucket `consider`) when `era?.medianYearBuilt` is finite:
   - measure `{ value: medianYearBuilt, unit: 'year_built' }`, `comparison: null`, `tone: 'neutral'`
     (a factual median — NOT a quality judgment; CONSTRAINT-001). provenance Census ACS.
   - `defaultCopy = era.context.era` (the era label) when present.
2. **`era-health-risks`** (bucket `check`) when `era?.context?.cautions` is non-empty:
   - no measure, `tone: 'caution'`, provenance Census ACS (era-derived). `defaultCopy` = the cautions joined.
   - `fallbackAction`: instruction to test/inspect (lead/asbestos/wiring/plumbing per era). CONSTRAINT-015.
   - Omitted for modern construction (empty cautions) — faithful to the template (`buildEraHealthRisks`
     returns '' for `medianYear >= 2000`).
3. **`soil-drainage`** (bucket `check`) when `soil?.drainageCategory` present:
   - no measure (USDA drainage is a qualitative classification, not a number), `tone =
     toneFromDrainageColor(color)` (green/lightgreen→favorable, gold/muted→neutral, orange/red→caution).
   - `defaultCopy = "{label} — {implication}"`. If `soil.isHydric`, force `tone:'caution'` and append the
     hydric/wetland-foundation note. provenance USDA Soil Data Access (SDA).
   - **Else `soil-missing`** (bucket `check`, tone `neutral`): no measure, `fallbackAction` = url to
     `soilwebUrl` (the point-specific SoilWeb survey) — CONSTRAINT-015 floor (always available).
4. **`new-construction`** (bucket `cool`) when `era?.newConstructionPct` is finite:
   - measure `{ value: newConstructionPct, unit: 'percent' }`, `tone: 'neutral'`, provenance Census ACS.
   - `defaultCopy` = "share of homes built since 2010" framing. (Housing-stock age, not demographics —
     CONSTRAINT-002 safe.)

`toneFromDrainageColor(color)`: green|lightgreen→favorable, orange|red→caution, else neutral.

## Edge cases & constraints

- **CONSTRAINT-001/008:** no composite score/grade; the drainage `color` is dropped and tone derived;
  `.strict()` rejects stray `color`/`drainagecl`/`muname`/`context` keys. Tests assert no `"color"` leak.
- **CONSTRAINT-002:** only housing-stock facts (year built, new-construction %) — never demographic character.
- **CONSTRAINT-015:** soil always yields a finding (drainage or SoilWeb-url fallback); era-health-risks
  carries an inspection instruction.
- Honest provenance: all measures `modeled:false` (Census ACS / USDA SDA measured data).

## Acceptance criteria

- AC-1: full input → schema-valid, `chapterId:'property'`, `schemaVersion:'1.0'`.
- AC-2: `construction-era` → `{value: medianYearBuilt, unit:'year_built'}`, bucket consider, tone neutral.
- AC-3: `era-health-risks` emitted only when cautions non-empty; bucket check, tone caution, instruction fallback.
- AC-4: `soil-drainage` tone derives from drainage color; `isHydric` forces caution + hydric note.
- AC-5: soil absent / no drainageCategory → `soil-missing` (check) with `soilwebUrl` url fallback.
- AC-6: `new-construction` → `{value, unit:'percent'}`, bucket cool, when newConstructionPct finite.
- AC-7: no `score`/`grade`/`rating`; serialized contract has no `"color"`/`"drainagecl"`/`"muname"` keys.
- AC-8: `propIntel` absent → `null`.
- AC-9: per-address snapshots incl. **Jeffersonville IN**, Georgetown (full), Harlan (older era + poor drainage).
- AC-10: wired additively into `reportBuilder` as `chapters.property`; full suite green incl. 5 addresses.

## Notes

- **Walkability is NOT a clean follow-on:** it emits a 0–100 composite `score` + graded category — a
  numerical quality rating CONSTRAINT-001 forbids. Surfacing it (or its band) needs a product decision
  (omit the score / surface only destination counts / omit walkability from the contract). Flagged for
  Nathan; not started here.
- `defaultCopy` is transitional (FR-078 AC-9) — deleted when the FE owns voice.
