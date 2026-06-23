# FR-087 — Access (highway) chapter → headless report contract (rollout #8)

**Status:** Spec · **Module:** `src/modules/access/contract.js` (new) + wiring in `reportBuilder.js`
**Origin:** contract rollout (FR-078) · **Date:** 2026-06-23 · **Schema:** no change (1.0)

## Problem / goal

Migrate the **access** chapter (nearest interstate highway on-ramp — the "Getting Around" narrative) to the
headless report contract. This is the **last located-facility chapter** → reuses `place{}`, no schema
change. Added additively as `contract.chapters.access`. **8 of 14 chapters** after this.

ADR-1 boundary: access owns highway access only.

## Inputs

`buildAccessContract(input, opts)` where `input = { highwayRamp }`, `opts = { asOf?, degraded? }`.
- `highwayRamp` (from `findNearestHighwayOnRamp`, geocoding strategy — CONSTRAINT-005/PM-002):
  `{ name (e.g. 'I-75'), address, location, driveTimeMinutes, note (string | null) }`, or `null`.
  No OSM fallback exists for highways; no cross-state/coherence flags.

Returns `null` when `highwayRamp` is absent (the template omits the "Getting Around" section entirely when
there is no highway, so omission — not an empty render — is the faithful, CONSTRAINT-015-compliant behavior).

## Findings produced

A single finding **`highway-access`** (bucket `consider` — a commuting / daily-mobility factor):
- `claim.place = {name, address}`, `claim.measure = { value: driveTimeMinutes, unit:'drive_minutes' }`,
  `claim.comparison = null`.
- `tone = driveTone(driveTimeMinutes)`.
- `provenance = { source: 'Google geocoding + Distance Matrix', asOf, modeled: false }`.
- `fallbackAction = null`.
- `defaultCopy = highwayRamp.note` when present (the "Also within 20 minutes: …" secondary-routes note;
  transitional — FR-078 AC-9).

## Tone mapping (faithful to the template's "Getting Around" tiers)

`driveTone(mins)`: `≤10 favorable`, `≤20 neutral`, `>20 caution`. (Template: <5 immediate / <10 close →
favorable; <20 buffer → neutral; ≥20 "test the drive at actual rush hour before committing" → caution.)

## Edge cases & constraints

- **CONSTRAINT-005 / PM-002:** highway data comes from the geocoding strategy upstream — this layer only
  serializes; no text-search risk introduced.
- **CONSTRAINT-001/008:** no score/grade/color — tone derived; `.strict()` rejects stray fields. The input
  record's `location`/`note` are not copied verbatim into the claim (fresh objects only).
- **CONSTRAINT-015:** absent highway → chapter omitted (template parity), not an empty section.
- **CONSTRAINT-007 (rural):** a far highway (>20 min, rural pattern) renders as `caution` + the template's
  rush-hour-test framing — not a failure message. (Carried in `defaultCopy` if FE wants the cue; the
  drive-time measure speaks for itself.)

## Acceptance criteria

- AC-1: full input → schema-valid, `chapterId:'access'`, `schemaVersion:'1.0'`, exactly one finding.
- AC-2: `highway-access` carries `place{name,address}` + `{value, unit:'drive_minutes'}`, bucket `consider`,
  `modeled:false`, source `'Google geocoding + Distance Matrix'`.
- AC-3: `driveTone` → favorable ≤10, neutral ≤20, caution >20.
- AC-4: `highwayRamp.note` present → `defaultCopy` carries it; absent → no `defaultCopy`.
- AC-5: `highwayRamp` absent → `buildAccessContract` returns `null`.
- AC-6: no `score`/`grade`/`rating`; serialized contract has no `"color"`/`"location"`/`"note"` keys.
- AC-7: per-address snapshots incl. **Jeffersonville IN**, Georgetown (with note), Harlan (rural far → caution).
- AC-8: wired additively into `reportBuilder` as `chapters.access`; full suite green incl. 5 addresses.

## Notes

- This completes the **located-facility** rollout (8/14). Remaining chapters (climate, property, growth,
  garden, environment, walkability, costs…) are non-located with richer/varied data — each needs bespoke
  finding design; no `place{}` reuse.
- `defaultCopy` is transitional (FR-078 AC-9) — deleted when the FE owns voice.
