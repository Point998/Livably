# FR-087 — Implementation Plan

Tests alongside (CONSTRAINT-011). Pure mapping layer — no API calls, no new deps. Smallest of the rollout
(single finding).

## Task 1 — `src/modules/access/contract.js` (new)
1. `require('../../contract/schema')` → `safeBuild`.
2. `driveTone(mins)`: ≤10 favorable, ≤20 neutral, else caution.
3. `buildAccessContract(input = {}, opts = {})`:
   - `const { highwayRamp } = input || {};`
   - Guard: `!highwayRamp` → return `null` (template parity — section omitted when no highway).
   - `asOf = opts.asOf || new Date().toISOString().slice(0,7)`.
   - Build the single finding:
     ```
     {
       id: 'highway-access',
       bucket: 'consider',
       tone: driveTone(highwayRamp.driveTimeMinutes),
       claim: {
         subject: 'Nearest interstate access',
         measure: { value: highwayRamp.driveTimeMinutes, unit: 'drive_minutes' },
         comparison: null,
         place: { name: highwayRamp.name, address: highwayRamp.address },
       },
       provenance: { source: 'Google geocoding + Distance Matrix', asOf, modeled: false },
       fallbackAction: null,
     }
     ```
     Set `defaultCopy = highwayRamp.note` only when truthy.
   - `provenanceSummary` = single dedup'd entry (reuse the Map reducer for consistency).
   - `safeBuild('access', () => ({ schemaVersion:'1.0', chapterId:'access', findings, degraded:!!opts.degraded, provenanceSummary }))`.
4. `module.exports = { buildAccessContract }`.

**Tests:** `tests/modules/access/contract.test.js` (new) — AC-1..AC-7. Note: there is already a
`tests/modules/access/data.test.js` dir. Fixtures: a highwayRamp WITH a `note`, one without, and a rural
far (>20) case. Assert null on absent; no leaked `location`/`note` keys; snapshots Georgetown/Harlan/Jeffersonville.

## Task 2 — wire into `reportBuilder.js`
1. Import `buildAccessContract`.
2. In `contract.chapters` add:
   ```
   access: highwayRamp
     ? buildAccessContract({ highwayRamp }, { degraded: degradation.total > 0 })
     : null,
   ```
   (`highwayRamp` is already in scope from the top-level destructure.)

## Task 3 — verify
- `npx jest tests/modules/access` then full `npx jest`. Green incl. 5 addresses.
- Review snapshot; confirm note→defaultCopy and no leaked internal keys.

## Risks / unknowns
- Minimal — single finding, no OSM/cross-state/coherence. Main checks: null-on-absent (AC-5) and no
  `location`/`note` key leakage into the claim (the builder reads `note` into defaultCopy but never copies
  the raw record; `.strict()` enforces it).
