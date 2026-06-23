# FR-086 — Recreation chapter → headless report contract (rollout #7) · Summary

**Status:** Complete · **Branch:** `FR-086-recreation-contract` · **Date:** 2026-06-23 · **Schema:** unchanged (1.0)
Migrates the recreation amenities to the contract — **7 of 14 chapters** now on the headless contract.

## What shipped

- **`src/modules/recreation/contract.js` (new) — `buildRecreationContract({ park, coffeeShop, library, recCenter, postOffice }, opts)`:**
  - One finding per **present** amenity (`nearest-park`, `nearest-coffee`, `nearest-library`,
    `nearest-recreation-center`, `nearest-post-office`), all bucket **`cool`**, via a shared `amenityFinding` helper:
    - Google record → `place{name,address}` + measure `{value: driveTimeMinutes, unit:'drive_minutes'}`,
      `tone = amenityTone` (≤10 favorable, else neutral — **never caution**), provenance `Google Places` `modeled:false`.
    - OSM straight-line record → `{value: distanceMiles, unit:'straight_line_miles'}`, `modeled:true`,
      source `OpenStreetMap`, honest caveat in `defaultCopy` (`address:null` coerced for `PlaceSchema`).
  - **Absent amenities are omitted** (no `*-missing` finding) — discretionary amenities; the template omits
    them too, so nothing empty is rendered (CONSTRAINT-015 satisfied without manufacturing action items).
- **`src/services/reportBuilder.js`:** `contract.chapters.recreation` wired additively.

## Design decisions (vs the FR-085 daily-essentials pattern)

- **Bucket `cool`, never `caution`:** these are "Cool Things to Know" amenities — a distant park is
  informational, not a risk (CONSTRAINT-001 — don't imply far = bad). FR-085's daily essentials
  (grocery/pharmacy/gas) used `consider` + driveTone with caution; recreation deliberately differs.
- **Omit-absent (not `*-missing`):** unlike a missing grocery (a real gap), a missing rec center is not a
  decision item to "check." Faithful to the template, which omits absent amenities.
- **`elementarySchool` excluded:** rendered in the same template card but it's schools-module data
  (already on the contract via FR-081/082). ADR-1 module boundary preserved.

## Tests (+11, +3 snapshots) — full suite **96 suites / 1778 tests green** (was 95/1767)

- `tests/modules/recreation/contract.test.js` (new): schema-valid; 5 cool findings; place+measure+modeled;
  `amenityTone` (favorable/neutral, never caution); OSM straight-line measure + null-address coercion;
  **absent amenity omitted (not flagged missing)**; no score/grade/leaked-keys; provenance dedupe;
  per-address snapshots (Georgetown full, Harlan OSM+absent, **Jeffersonville IN**).

## Notes / follow-on

- Remaining located-facility rollout: **access** (highway on-ramp). Then non-located chapters.
- `defaultCopy` (OSM caveat) is transitional (FR-078 AC-9) — deleted when the FE owns voice.
