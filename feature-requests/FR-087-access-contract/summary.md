# FR-087 — Access (highway) chapter → headless report contract (rollout #8) · Summary

**Status:** Complete · **Branch:** `FR-087-access-contract` · **Date:** 2026-06-23 · **Schema:** unchanged (1.0)
Migrates the access chapter to the contract — **8 of 14 chapters**. **Completes the located-facility rollout.**

## What shipped

- **`src/modules/access/contract.js` (new) — `buildAccessContract({ highwayRamp }, opts)`:**
  - A single finding **`highway-access`** (bucket `consider` — a commuting/daily-mobility factor):
    `place{name,address}` + measure `{value: driveTimeMinutes, unit:'drive_minutes'}`, `tone = driveTone`
    (≤10 favorable / ≤20 neutral / >20 caution), provenance `{source:'Google geocoding + Distance Matrix',
    modeled:false}`. `highwayRamp.note` ("Also within 20 minutes: …") → transitional `defaultCopy`.
  - **Returns `null` when `highwayRamp` is absent** — faithful to the template, which omits the "Getting
    Around" section entirely when there's no highway. Omission (not an empty render) satisfies CONSTRAINT-015.
- **`src/services/reportBuilder.js`:** `contract.chapters.access` wired additively.

## Constraint handling

- **CONSTRAINT-005 / PM-002:** highway data is the upstream geocoding-strategy record; this layer only
  serializes — no text-search risk introduced.
- **CONSTRAINT-001/008:** no score/grade/color — tone derived. A test asserts no `"color"`/`"location"`/
  `"note"` keys leak (the claim is built fresh; `note` is read into `defaultCopy`, never the raw record).
- **CONSTRAINT-007 (rural):** a far highway (>20 min) renders as `caution` with the template's
  test-the-drive framing in `defaultCopy` — not a failure message (see the Harlan snapshot).

## Tests (+9, +3 snapshots) — full suite **97 suites / 1787 tests green** (was 96/1778)

- `tests/modules/access/contract.test.js` (new): null-on-absent; schema-valid single finding;
  place+measure+consider+modeled; `driveTone` tiers; note→defaultCopy (and absent); no score/grade/leaked-keys;
  per-address snapshots (Georgetown w/ note, Harlan rural-far → caution, **Jeffersonville IN**).

## Notes / follow-on

- **Located-facility rollout complete (8/14).** Remaining chapters — climate, property, growth, garden,
  environment, walkability, costs, etc. — are non-located with richer/varied data shapes; each needs bespoke
  finding design (measure/comparison patterns, no `place{}` reuse). Next session should pick one and design
  its findings from its logic output rather than copy the located-facility template.
- `defaultCopy` is transitional (FR-078 AC-9) — deleted when the FE owns voice.
