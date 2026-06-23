# FR-084 — Safety chapter → headless report contract (rollout #5)

**Status:** Spec · **Module:** `src/modules/safety/contract.js` (new) + wiring in `src/services/reportBuilder.js`
**Origin:** contract rollout (FR-078 initiative) · **Date:** 2026-06-23 · **Schema:** no change (1.0)

## Problem / goal

Migrate the **safety** chapter (police/fire emergency response + crime research + ISO note) to the
headless report contract, following the proven per-module `contract.js` pattern (utilities, community,
health, schools). Safety is a located-facility chapter → **reuses the `place{}` primitive** (FR-080),
no schema evolution. Output is added additively to `contract.chapters.safety`.

## Inputs

`buildSafetyContract(input, opts)` where:
- `input = { emergency, safetyLocation }`
  - `emergency = { police, fire }`, each station: `{ name, address, distanceMiles, driveTimeMinutes,
    response: { estimate, category } }` (or `null`).
  - `safetyLocation = { state, city, county }` (or `null`).
- `opts = { asOf?, degraded? }` (matches the other builders).

## Findings produced

1. **`police-response`** (bucket `consider`) when `emergency.police` present:
   - `claim.place = {name,address}`, `claim.measure = { value: response.estimate, unit: 'response_minutes' }`.
   - `tone` derived via `responseTone(mins)` (see below). `provenance.modeled = true` (estimate is modeled
     from distance ÷ dispatch speed). Source: `'Google Places + dispatch model'`.
   - Else **`police-response-missing`** (bucket `check`, tone `caution`) with an actionable
     `instruction` fallback (call local non-emergency line / search department).
2. **`fire-response`** (bucket `consider`) when `emergency.fire` present — same shape as police.
   - Else **`fire-response-missing`** (bucket `check`, tone `caution`) with instruction fallback.
3. **`iso-ppc`** (bucket `check`, tone `neutral`) — **always emitted**. No measure. Actionable
   `instruction` fallback: ask your insurer for the address-specific ISO PPC rating (affects premium).
   Provenance source `'ISO Public Protection Classification'`, modeled `false`.
4. **`crime-research`** (bucket `check`, tone `neutral`) — **always emitted**. **No measure, no
   comparison** (CONSTRAINT-002 — the chapter fetches no crime data and must not characterize the area).
   Actionable `url` fallback to a neighborhood crime map (CrimeMapping.com); `defaultCopy` carries the
   "combine 2–3 sources, look at block level" framing. Provenance source `'Local law enforcement / CrimeMapping.com'`.

`buildSafetyContract` returns `null` when `emergency?.police`, `emergency?.fire`, and `safetyLocation`
are all absent (mirrors health's all-absent guard) — i.e. nothing to say.

## Tone mapping (faithful to the template's existing narrative tiers)

`responseTone(mins)`: `mins <= 8 → favorable`, `mins <= 12 → neutral`, else `caution`.
(The template treats ≤5/≤8 as positive, ≤12 as "average", >12/>20 as increasingly cautionary; this
collapses those tiers into the contract's 3-level tone. Used for both police and fire.)

## Edge cases & constraints

- **CONSTRAINT-001:** drop `response.category` (`Excellent/Good/Fair/Delayed`) and its color entirely —
  derive `tone` instead. The `.strict()` schema would reject a stray `color`/`label`/`score` anyway.
- **CONSTRAINT-002:** crime finding carries no measure/comparison; never characterizes the area.
- **CONSTRAINT-015:** every missing/absent datum yields an actionable fallback (no silent gaps). The
  ISO and crime-research findings are themselves actionable pointers, always present.
- **Honest provenance:** response-estimate measures are `modeled: true`; station identity is measured.
- **No drive-time coherence / cross-state needed here:** police/fire are nearest-by-distance civic
  infrastructure within the origin jurisdiction; they are not in CONSTRAINT-006's named list and the
  chapter does not present them as a destination to drive to. (Confirmed in discovery.)

## Acceptance criteria

- AC-1: full input → schema-valid (`ChapterContractSchema.safeParse` ok), `chapterId: 'safety'`, `schemaVersion: '1.0'`.
- AC-2: `police-response` / `fire-response` carry `place` + `{value, unit:'response_minutes'}` measure, `provenance.modeled === true`.
- AC-3: `responseTone` derives favorable/neutral/caution across the tiers (≤8 / ≤12 / >12) for both stations.
- AC-4: missing police → `police-response-missing` (check, caution, instruction fallback); same for fire.
- AC-5: `iso-ppc` always present, bucket check, instruction fallback, no measure.
- AC-6: `crime-research` always present, no measure/comparison, url fallback (CONSTRAINT-002 + 015).
- AC-7: no finding carries `score`/`grade`/`rating`; serialized contract contains no `"color"` (CONSTRAINT-001/008).
- AC-8: all-absent input → returns `null`.
- AC-9: per-address snapshots incl. **Jeffersonville IN** (CONSTRAINT-011), plus Georgetown + Harlan (rural far response).
- AC-10: wired additively into `reportBuilder` envelope as `chapters.safety`; full suite green incl. all 5 addresses.

## Notes

- Reachability remains the other near-term located-facility rollout; tracked separately.
- When the FE owns voice, `defaultCopy` on the ISO/crime findings is deleted (FR-078 AC-9, transitional).
