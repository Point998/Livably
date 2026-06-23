# FR-084 — Implementation Plan

Tests alongside (CONSTRAINT-011). Pure mapping layer — no API calls, no new deps.

## Task 1 — `src/modules/safety/contract.js` (new)
Mirror `health/contract.js` structure.

1. `require('../../contract/schema')` → `safeBuild`.
2. `responseTone(mins)`: ≤8 favorable, ≤12 neutral, else caution.
3. `placeOf(station)` → `{ name, address }`.
4. `buildSafetyContract(input = {}, opts = {})`:
   - Destructure `{ emergency, safetyLocation }`; `police = emergency?.police`, `fire = emergency?.fire`.
   - Guard: if `!police && !fire && !safetyLocation` → return `null`.
   - `asOf = opts.asOf || new Date().toISOString().slice(0,7)`.
   - Build findings array with a `push(finding, copy?)` helper (sets `defaultCopy` when copy given), as in health.
   - **police-response** / **police-response-missing**; **fire-response** / **fire-response-missing**
     (station findings: bucket consider, measure `{value: response.estimate, unit:'response_minutes'}`,
     place, tone `responseTone`, provenance `{source:'Google Places + dispatch model', asOf, modeled:true}`,
     fallbackAction null). Missing: bucket check, tone caution, no measure, instruction fallback,
     provenance `{source:'Google Places + dispatch model', asOf, modeled:true}` (or modeled:false for the
     missing pointer — use false since no estimate exists). Guard `response?.estimate` is a finite number.
   - **iso-ppc** (always): bucket check, tone neutral, no measure, provenance
     `{source:'ISO Public Protection Classification', asOf, modeled:false}`, instruction fallback +
     defaultCopy (premium framing). Use `safetyLocation` for city/county context in copy if present.
   - **crime-research** (always): bucket check, tone neutral, no measure/comparison, provenance
     `{source:'Local law enforcement / CrimeMapping.com', asOf, modeled:false}`, url fallback
     (`https://www.crimemapping.com/map`) + defaultCopy (combine sources, block-level framing).
   - `provenanceSummary` = dedupe by `source|asOf` (copy health's reducer).
   - `return safeBuild('safety', () => ({ schemaVersion:'1.0', chapterId:'safety', findings, degraded: !!opts.degraded, provenanceSummary }))`.
5. `module.exports = { buildSafetyContract }`.

**Tests:** `tests/modules/safety/contract.test.js` (new) — AC-1..AC-9 + per-address snapshots
(Georgetown full, Harlan rural-far, Jeffersonville IN). Mirror `health/contract.test.js`. Use realistic
station fixtures with `response.category` PRESENT in the input to prove the builder DROPS it
(AC-7: no `"color"` in serialized output).

## Task 2 — wire into `reportBuilder.js`
1. Import `buildSafetyContract`.
2. In the `contract.chapters` object, add:
   ```
   safety: (chapters?.emergency || chapters?.safetyLocation)
     ? buildSafetyContract({ emergency: chapters.emergency, safetyLocation: chapters.safetyLocation }, { degraded: degradation.total > 0 })
     : null,
   ```
**Test:** existing reportBuilder/contract integration tests stay green (no new behavior asserted there
unless one already snapshots the envelope — check and extend if so).

## Task 3 — verify
- `npx jest tests/modules/safety` then full `npx jest`. Green incl. 5 addresses.
- Update snapshot (`-u`) only for the new safety snapshots; confirm no other snapshot changed.

## Risks / unknowns
- `response` may be present but `estimate` non-numeric on degraded data → guard with `Number.isFinite`.
- Confirm no existing test snapshots the full report envelope (would need `safety` added). Check
  `tests/` for an envelope snapshot before running; if present, review the diff rather than blind `-u`.
- Keep ZERO color/label/category leakage — the `.strict()` schema enforces it, but assert it in a test too.
