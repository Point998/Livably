# FR-091 — Growth & Development chapter → headless report contract (rollout #12) · Summary

**Status:** Complete · **Branch:** `FR-091-growth-contract` · **Date:** 2026-06-23 · **Schema:** unchanged (1.0)
Migrates Growth & Development to the contract — **12 of 14 chapters**.

## What shipped

- **`src/modules/growth/contract.js` (new) — `buildGrowthContract(growth, opts)`:**
  - **`permit-trend`** (consider, **neutral**): measure `{value: current, unit:'building_permits'}`;
    defaultCopy = current year + YoY change + trend direction in plain language. Census BPS. Absent →
    `permit-trend-missing` (check) + county-planning-office instruction fallback.
  - **`development-activity`** (cool, neutral) when establishments present: `{value: count, unit:'count'}`;
    up to 3 names+labels in copy; provenance by source (Google Places / OpenStreetMap `modeled:true`).
  - **`named-projects`** (cool, neutral) when pipeline news present: `{value: count, unit:'count'}`;
    project names + status in copy. Google News.
- **`src/services/reportBuilder.js`:** `contract.chapters.growth` wired additively.

## The CONSTRAINT-001 trap (roadmap-flagged), handled

Growth is **value-neutral context** for a buyer — rising permits could mean appreciation *or*
construction noise/change. The permit `trend` (rising/declining/stable) is a **directional fact, not a
quality score**, so **every growth finding uses tone `neutral`**; none implies growth is good or bad. The
trend direction lives in `defaultCopy`, never as a favorable/caution signal. A test asserts all tones are
neutral and that the raw `trend`/`label`/`source` fields don't leak into the claim.

`newConstruction` is intentionally omitted — the same metric is already surfaced by the property contract
(`new-construction`, FR-088); a test asserts no `newConstructionPct` appears.

## Tests (+12, +3 snapshots) — full suite **101 suites / 1839 tests green** (was 100/1827)

- `tests/modules/growth/contract.test.js` (new): permit-trend measure/copy; missing→instruction fallback;
  development-activity count + OSM modeled:true; named-projects names+status; newConstruction ignored;
  all-neutral + no-score/leak assertions; per-address snapshots (Georgetown rising, Harlan sparse,
  **Jeffersonville IN** declining).

## Notes / follow-on

- **12 of 14 chapters.** Remaining: **garden**, **costs**, multi-source **climate**, plus the deferred
  sensory **ambiance** items (airports/rail/light). Watch costs/climate for external-index vs composite
  distinctions (FR-090 principle).
- `defaultCopy` transitional (FR-078 AC-9).
