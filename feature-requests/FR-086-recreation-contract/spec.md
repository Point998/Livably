# FR-086 — Recreation chapter → headless report contract (rollout #7)

**Status:** Spec · **Module:** `src/modules/recreation/contract.js` (new) + wiring in `reportBuilder.js`
**Origin:** contract rollout (FR-078) · **Date:** 2026-06-23 · **Schema:** no change (1.0)

## Problem / goal

Migrate the **recreation** chapter's amenities — **park, coffee shop, public library, recreation center,
post office** — to the headless report contract, following the proven per-module pattern (6 done).
Located-facility chapter → reuses `place{}`, no schema change. Added additively as
`contract.chapters.recreation`. **7 of 14 chapters** after this.

ADR-1 boundary: recreation owns these 5 amenities only. `elementarySchool` (rendered alongside them in the
shared template card) is **schools-module** data and is already on the contract (FR-081/082) — excluded here.

## Inputs

`buildRecreationContract(input, opts)` where `input = { park, coffeeShop, library, recCenter, postOffice }`
(each a single record or `null`), `opts = { asOf?, degraded? }`.
- Record (Google): `{ name, address, location, driveTimeMinutes }`.
- Record (OSM fallback): `{ name, address: null, location, driveTimeMinutes: null, distanceMiles,
  proximitySource: 'osm-straightline' }`.

Returns `null` when all five are absent.

## Findings produced

One finding per **present** amenity (`nearest-park`, `nearest-coffee`, `nearest-library`,
`nearest-recreation-center`, `nearest-post-office`), all bucket **`cool`** ("Cool Things to Know" —
discretionary lifestyle amenities), via a shared `amenityFinding` helper:

- **Google record:** `claim.place` + measure `{value: driveTimeMinutes, unit:'drive_minutes'}`,
  `tone = amenityTone(mins)`, provenance `{source:'Google Places', asOf, modeled:false}`, `fallbackAction:null`.
- **OSM straight-line record:** measure `{value: distanceMiles, unit:'straight_line_miles'}`, `tone:'neutral'`,
  provenance `{source:'OpenStreetMap', asOf, modeled:true}`, honest caveat in `defaultCopy`; `address:null`
  coerced to a sentinel string for `PlaceSchema`.

**Absent amenities are omitted** — no `*-missing` finding. Rationale: these are discretionary "cool"
amenities (the template omits absent ones too); the absence of a nearby coffee shop or rec center is not a
decision risk a buyer must "check" — unlike a missing grocery/pharmacy in FR-085. Nothing empty is rendered,
so CONSTRAINT-015 is satisfied without manufacturing action items.

## Tone mapping

`amenityTone(mins)`: `≤10 favorable`, else `neutral`. **Never `caution`** — a far amenity is informational,
not a risk (CONSTRAINT-001: don't imply a distant park is "bad"). OSM straight-line → `neutral`.

## Edge cases & constraints

- **CONSTRAINT-001/008:** no score/grade/color — tone derived; `.strict()` rejects stray fields. No `caution`.
- **CONSTRAINT-015:** absent amenity omitted (not an empty section); present amenities carry real data or an
  honest OSM caveat.
- **No cross-state / coherence:** recreation records carry no such flags (they are not jurisdiction- or
  daily-essential-sensitive). Nothing to propagate.
- **`elementarySchool` excluded** (schools-module boundary).

## Acceptance criteria

- AC-1: full input → schema-valid, `chapterId:'recreation'`, `schemaVersion:'1.0'`.
- AC-2: each present amenity → `place` + `{value, unit:'drive_minutes'}`, bucket `cool`, `modeled:false`.
- AC-3: `amenityTone` → favorable ≤10, neutral >10; never caution.
- AC-4: OSM straight-line → `{value: distanceMiles, unit:'straight_line_miles'}`, `modeled:true`,
  source `'OpenStreetMap'`, caveat in `defaultCopy`; `address:null` coerced to a valid string.
- AC-5: absent amenity → no finding for it (omitted, not `*-missing`).
- AC-6: no `score`/`grade`/`rating`; serialized contract has no `"color"`/`"proximitySource"`/`"location"` keys.
- AC-7: all-absent input → `null`.
- AC-8: per-address snapshots incl. **Jeffersonville IN**, Georgetown (full), Harlan (some OSM/absent).
- AC-9: wired additively into `reportBuilder` as `chapters.recreation`; full suite green incl. 5 addresses.

## Notes

- After this, remaining located-facility rollout: **access** (highway on-ramp). Then non-located chapters.
- `defaultCopy` (OSM caveat) is transitional (FR-078 AC-9) — deleted when the FE owns voice.
