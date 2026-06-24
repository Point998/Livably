# FR-091 — Growth & Development chapter → headless report contract (rollout #12)

**Status:** Spec · **Module:** `src/modules/growth/contract.js` (new) + wiring in `reportBuilder.js`
**Origin:** contract rollout (FR-078) · **Date:** 2026-06-23 · **Schema:** no change (1.0)

## Problem / goal

Migrate the **Growth & Development** chapter (building-permit trend + nearby commercial development +
named project pipeline) to the contract. Added additively as `contract.chapters.growth`. **12 of 14
chapters** after this.

## Inputs

`buildGrowthContract(growth, opts)` where `growth` (`chapters.growth`, or `null`) =
`{ permits, newConstruction, establishments, namedProjects, locationInfo }`:
- `permits`: `{ current, currentYear, prior, priorYear, percentChange, trend('rising'|'declining'|'stable') }` | null (Census BPS).
- `establishments`: `[{ name, label, distanceMiles, source('google'|'osm') }]` (recent commercial dev; may be `[]`).
- `namedProjects`: `[{ name, status }]` (development news pipeline; may be `[]`).
- `newConstruction`: **skipped** — the same metric is already surfaced by the property contract
  (`new-construction`, FR-088); avoid double-counting.
- `opts = { asOf?, degraded? }`. Returns `null` when `permits` is null AND `establishments`/`namedProjects` are empty.

## CONSTRAINT-001 note (the roadmap-flagged trap)

The permit `trend` (rising/declining/stable) is a **directional fact, not a quality score** — and "growth"
is value-neutral for a buyer (appreciation vs construction noise/change cut both ways). All growth findings
use **tone `neutral`**; no finding implies growth is good or bad. The trend direction lives in `defaultCopy`,
not as a favorable/caution signal.

## Findings produced

1. **`permit-trend`** (bucket `consider`, tone `neutral`): measure `{value: current, unit:'building_permits'}`;
   `defaultCopy` = the year, prior-year comparison, percentChange, and trend direction in plain language.
   Census Building Permits Survey, modeled:false. **Absent → `permit-trend-missing`** (check, neutral) with an
   instruction fallback (check the county planning/zoning office or Census BPS). CONSTRAINT-015.
2. **`development-activity`** (bucket `cool`, tone `neutral`) when `establishments.length > 0`: measure
   `{value: establishments.length, unit:'count'}`; `defaultCopy` = up to 3 names + category labels.
   Provenance by `establishments[0].source`: `google` → Google Places (modeled:false); `osm` → OpenStreetMap
   (modeled:true, straight-line).
3. **`named-projects`** (bucket `cool`, tone `neutral`) when `namedProjects.length > 0`: measure
   `{value: namedProjects.length, unit:'count'}`; `defaultCopy` = up to 3 project names + status. Google News, modeled:false.

## Edge cases & constraints

- **CONSTRAINT-001/008:** no score/grade; trend is a fact, tone neutral throughout. The permit `trend` string
  and establishment `label`/`source` are read but never emitted verbatim into the claim. Test asserts no
  `"color"`/`"trend"`/`"label"` leak.
- **CONSTRAINT-015:** permit-trend absent → planning-office instruction fallback.
- Honest provenance: OSM-sourced establishments are `modeled:true` (straight-line).

## Acceptance criteria

- AC-1: full input → schema-valid, `chapterId:'growth'`, `schemaVersion:'1.0'`.
- AC-2: `permit-trend` → `{value: current, unit:'building_permits'}`, consider/neutral; percentChange + trend in copy.
- AC-3: permits absent → `permit-trend-missing` (check) with instruction fallback.
- AC-4: `development-activity` count measure, cool/neutral; OSM source → provenance modeled:true.
- AC-5: `named-projects` count measure, cool/neutral; names+status in copy.
- AC-6: no finding implies growth quality (all tones neutral); no `score`/`grade`/`rating`; no `"color"`/`"trend"` leak.
- AC-7: permits null + no establishments + no namedProjects → `null`.
- AC-8: per-address snapshots incl. **Jeffersonville IN**, Georgetown (rising), Harlan (sparse/missing).
- AC-9: wired additively into `reportBuilder` as `chapters.growth`; full suite green incl. 5 addresses.

## Notes

- `defaultCopy` transitional (FR-078 AC-9). `newConstruction` intentionally omitted (property owns it).
