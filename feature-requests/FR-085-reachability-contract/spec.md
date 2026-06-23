# FR-085 — Reachability chapter → headless report contract (rollout #6)

**Status:** Spec · **Module:** `src/modules/reachability/contract.js` (new) + wiring in `reportBuilder.js`
**Origin:** contract rollout (FR-078) · **Date:** 2026-06-23 · **Schema:** no change (1.0)

## Problem / goal

Migrate the **reachability** chapter's "Daily Conveniences" — **grocery, pharmacy, gas station** — to
the headless report contract, following the proven per-module `contract.js` pattern (5 chapters done).
Located-facility chapter → reuses the `place{}` primitive, no schema evolution. Added additively as
`contract.chapters.reachability`. **6 of 14 chapters** after this.

ADR-1 boundary: reachability owns grocery/pharmacy/gas only. Civic items (park/coffee/library/rec/post)
are the **recreation** module; highway is **access**; hospital/ER is **health** — each its own contract.

## Inputs

`buildReachabilityContract(input, opts)` where:
- `input = { grocery, pharmacy, gasStation }`
  - `grocery`: array of up to 3 records (nearest-first) or `null`. Primary finding uses `grocery[0]`.
  - `pharmacy`, `gasStation`: single record or `null`.
  - Record (Google): `{ name, address, location, driveTimeMinutes, bandRung?, mode?, centroidDriveMinutes? }`;
    grocery may carry `coherenceWarning`/`coherenceReason` (CONSTRAINT-010); pharmacy may carry
    `crossStateWarning`/`crossStateNote` (FR-083).
  - Record (OSM fallback): `{ name, address: null, location, driveTimeMinutes: null, distanceMiles,
    proximitySource: 'osm-straightline' }`.
- `opts = { asOf?, degraded? }`.

Returns `null` when grocery, pharmacy, and gasStation are all absent.

## Findings produced

One finding per destination (`nearest-grocery`, `nearest-pharmacy`, `nearest-gas`), each bucket
`consider`, via a shared `destFinding` helper:

- **Google record (has `driveTimeMinutes`):** `claim.place` + `measure { value: driveTimeMinutes,
  unit: 'drive_minutes' }`, `tone = driveTone(mins)`, provenance `{source:'Google Places', asOf,
  modeled:false}`, `fallbackAction: null`.
- **OSM straight-line record (`proximitySource:'osm-straightline'`):** `measure { value: distanceMiles,
  unit: 'straight_line_miles' }`, `tone:'neutral'` (no road time to assess), provenance
  `{source:'OpenStreetMap', asOf, modeled:true}`, `defaultCopy` = honest straight-line caveat.
- **Per-finding caution overrides (force `tone:'caution'` + note in `defaultCopy`):**
  - grocery `coherenceWarning` → `coherenceReason` (CONSTRAINT-010: an implausibly far daily destination).
  - pharmacy `crossStateWarning` → `crossStateNote` (FR-083 / CONSTRAINT-006).
- **Missing destination →** `nearest-{x}-missing` (bucket `check`, tone `neutral`, no measure) with an
  actionable `url` fallback (Google Maps search for that category). CONSTRAINT-015.

`placeOf(r)` coerces the OSM `address: null` to a sentinel string (`'Location approximate (OpenStreetMap)'`)
so it satisfies `PlaceSchema.address` (required string).

## Tone mapping (faithful to the template's daily-conveniences framing)

`driveTone(mins)`: `≤10 favorable`, `≤20 neutral`, `>20 caution`. (Mirrors the health ER tiers and the
narrative's "effortless / accessible / plan-ahead" framing.)

## Edge cases & constraints

- **FR-058 banding honesty:** lifestyle drive times are cell-centroid-based (shared across the cell),
  a documented sub-block approximation — the displayed value the template already renders. Surfaced as a
  real `drive_minutes` measure (`modeled:false`); the centroid nuance is a known property of the lifestyle
  tier (vs the safety tier's exact recompute), not a fabrication. Out of scope to re-band here.
- **CONSTRAINT-001/008:** no score/grade/color — tone derived; the `.strict()` schema enforces it.
- **CONSTRAINT-010 / FR-083:** coherence + cross-state warnings propagate as `caution` + note (above).
- **CONSTRAINT-015:** missing destination → actionable url fallback. OSM fallback already carries an
  honest caveat.
- **No cross-state filtering added here:** pharmacy already carries its FR-083 flag upstream; this layer
  only serializes it (CONSTRAINT-014 — coherence stays in validate.js/upstream).

## Acceptance criteria

- AC-1: full input → schema-valid, `chapterId:'reachability'`, `schemaVersion:'1.0'`.
- AC-2: `nearest-grocery` uses `grocery[0]`; carries `place` + `{value, unit:'drive_minutes'}`, `modeled:false`.
- AC-3: `driveTone` derives favorable/neutral/caution across ≤10 / ≤20 / >20 for each destination.
- AC-4: grocery `coherenceWarning` → tone `caution` + `coherenceReason` in `defaultCopy`.
- AC-5: pharmacy `crossStateWarning` → tone `caution` + `crossStateNote` in `defaultCopy` (FR-083).
- AC-6: OSM straight-line record → `{value: distanceMiles, unit:'straight_line_miles'}`, `modeled:true`,
  source `'OpenStreetMap'`, honest caveat in `defaultCopy`; OSM `address:null` coerced to a valid string.
- AC-7: missing destination → `nearest-{x}-missing` (check) with url fallback (CONSTRAINT-015).
- AC-8: no `score`/`grade`/`rating`; serialized contract has no `"color"`/`"bandRung"`/`"coherenceWarning"` keys.
- AC-9: all-absent input → `null`.
- AC-10: per-address snapshots incl. **Jeffersonville IN** (cross-state pharmacy), plus Georgetown (full)
  and Harlan (rural, possible coherence/OSM).
- AC-11: wired additively into `reportBuilder` as `chapters.reachability`; full suite green incl. 5 addresses.

## Notes

- `defaultCopy` is transitional (FR-078 AC-9) — deleted when the FE owns voice.
- After this, remaining located-facility rollout: **recreation** (park/coffee/civic), **access** (highway).
