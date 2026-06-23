# FR-085 — Reachability chapter → headless report contract (rollout #6) · Summary

**Status:** Complete · **Branch:** `FR-085-reachability-contract` · **Date:** 2026-06-23 · **Schema:** unchanged (1.0)
Migrates the reachability "Daily Conveniences" to the contract — **6 of 14 chapters** now on the headless contract.

## What shipped

- **`src/modules/reachability/contract.js` (new) — `buildReachabilityContract({ grocery, pharmacy, gasStation }, opts)`:**
  - **`nearest-grocery` / `nearest-pharmacy` / `nearest-gas`** (bucket `consider`), via a shared `destFinding` helper:
    - Google record → `place{name,address}` + measure `{value: driveTimeMinutes, unit:'drive_minutes'}`,
      `tone = driveTone` (≤10 favorable / ≤20 neutral / >20 caution), provenance `Google Places` `modeled:false`.
    - OSM straight-line record → measure `{value: distanceMiles, unit:'straight_line_miles'}`, `modeled:true`,
      source `OpenStreetMap`, honest as-the-crow-flies caveat in `defaultCopy`. (`address:null` coerced to a
      sentinel string for `PlaceSchema`.)
    - **Caution overrides** (force `tone:caution` + note): grocery `coherenceWarning` (CONSTRAINT-010) and
      pharmacy `crossStateWarning` (FR-083) — the latter verified in the Jeffersonville snapshot (a 10-min KY
      pharmacy reads `caution`, not its drive-time `neutral`).
    - Missing destination → `nearest-{x}-missing` (check) + Google Maps url fallback (CONSTRAINT-015).
- **`src/services/reportBuilder.js`:** `contract.chapters.reachability` wired additively (grocery/pharmacy/gas
  were already in scope from the top-level destructure).

## Constraint handling

- **CONSTRAINT-001/008:** no score/grade/color — tone derived; a test asserts no `"color"`/`"bandRung"`/
  `"coherenceWarning"`/`"proximitySource"`/`"location"` leak into the serialized contract (the builder
  constructs fresh claim objects, never copies the raw record; `.strict()` enforces it).
- **CONSTRAINT-010 / FR-083:** coherence + cross-state warnings propagate as `caution` + note.
- **CONSTRAINT-015:** missing destinations get actionable url fallbacks; OSM fallback carries an honest caveat.
- **FR-058 honesty:** lifestyle times are the cell-centroid drive minutes the template already renders
  (a documented sub-block approximation; the safety tier is the one that recomputes exact). Surfaced as a
  real `drive_minutes` measure; re-banding is out of scope here.

## Tests (+13, +3 snapshots) — full suite **95 suites / 1767 tests green** (was 94/1754)

- `tests/modules/reachability/contract.test.js` (new): schema-valid; grocery[0] place+measure+modeled;
  `driveTone` tiers; coherence→caution; cross-state pharmacy→caution; OSM straight-line measure + null-address
  coercion; missing→url fallback; no score/grade/leaked-keys; provenance dedupe; per-address snapshots
  (Georgetown full, Harlan OSM+far, **Jeffersonville IN** cross-state pharmacy).

## Notes / follow-on

- Remaining located-facility rollouts: **recreation** (park/coffee/library/rec/post), **access** (highway).
- `defaultCopy` is transitional (FR-078 AC-9) — deleted when the FE owns voice.
