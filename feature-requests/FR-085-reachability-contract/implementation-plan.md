# FR-085 — Implementation Plan

Tests alongside (CONSTRAINT-011). Pure mapping layer — no API calls, no new deps.

## Task 1 — `src/modules/reachability/contract.js` (new)
Mirror `health/contract.js` / `safety/contract.js`.

1. `require('../../contract/schema')` → `safeBuild`.
2. `driveTone(mins)`: ≤10 favorable, ≤20 neutral, else caution.
3. `placeOf(r)` → `{ name: r.name, address: r.address || 'Location approximate (OpenStreetMap)' }`
   (coerces OSM null address to satisfy `PlaceSchema`).
4. `isOSM(r)` → `r?.proximitySource === 'osm-straightline'`.
5. `destFinding(record, { id, missingId, subject, fallbackUrl, fallbackLabel })`:
   - `!record` → missing finding: bucket `check`, tone `neutral`, `claim {subject, measure:null,
     comparison:null}`, provenance `{source:'Google Places', asOf, modeled:false}`, url fallbackAction.
   - OSM record → measure `{value: distanceMiles, unit:'straight_line_miles'}`, tone `neutral`,
     provenance `{source:'OpenStreetMap', asOf, modeled:true}`, place, defaultCopy = straight-line caveat.
   - Google record → measure `{value: driveTimeMinutes, unit:'drive_minutes'}`, tone `driveTone`,
     provenance `{source:'Google Places', asOf, modeled:false}`, place.
   - Caution overrides AFTER base tone: if `record.coherenceWarning` → tone `caution`, copy = coherenceReason;
     if `record.crossStateWarning` → tone `caution`, copy = crossStateNote. (Only one applies per type.)
   - Returns `{ finding, copy }`; caller pushes with copy → defaultCopy.
6. `buildReachabilityContract(input = {}, opts = {})`:
   - `{ grocery, pharmacy, gasStation }`; `g0 = Array.isArray(grocery) ? grocery[0] : grocery`.
   - Guard: `!g0 && !pharmacy && !gasStation` → null.
   - asOf default `YYYY-MM`. push helper sets defaultCopy.
   - grocery: id `nearest-grocery` / missing `nearest-grocery-missing`, subject 'Nearest grocery store',
     fallback url `https://www.google.com/maps/search/grocery+store`.
   - pharmacy: `nearest-pharmacy`, subject 'Nearest pharmacy', fallback `.../pharmacy`.
   - gas: `nearest-gas`, subject 'Nearest gas station', fallback `.../gas+station`.
   - provenanceSummary dedupe by `source|asOf`.
   - `safeBuild('reachability', () => ({ schemaVersion:'1.0', chapterId:'reachability', findings,
     degraded:!!opts.degraded, provenanceSummary }))`.
7. `module.exports = { buildReachabilityContract }`.

**Tests:** `tests/modules/reachability/contract.test.js` (new) — AC-1..AC-10. Fixtures incl. a grocery
record WITH `coherenceWarning`, a pharmacy WITH `crossStateWarning`, and an OSM straight-line record
(to prove distanceMiles measure + null-address coercion + no leaked internal keys). Snapshots:
Georgetown full, Harlan (one OSM + one coherence), Jeffersonville IN (cross-state pharmacy).

## Task 2 — wire into `reportBuilder.js`
1. Import `buildReachabilityContract`.
2. In `contract.chapters` add:
   ```
   reachability: (grocery || pharmacy || gasStation)
     ? buildReachabilityContract({ grocery, pharmacy, gasStation }, { degraded: degradation.total > 0 })
     : null,
   ```
   (`grocery/pharmacy/gasStation` are already in scope from the top-level destructure.)

## Task 3 — verify
- `npx jest tests/modules/reachability` then full `npx jest`. Green incl. 5 addresses.
- Review new snapshots; confirm no other snapshot changed and no internal keys (bandRung/mode/
  coherenceWarning/proximitySource/location) leak into the serialized contract.

## Risks / unknowns
- OSM `address:null` vs required `PlaceSchema.address` → handled by `placeOf` coercion (assert in a test).
- `grocery` is an array; everything else is a single record — `g0` normalization handles it.
- Don't leak internal fields — the contract only reads name/address/driveTimeMinutes/distanceMiles +
  the two warning flags; everything else is ignored. `.strict()` guarantees a stray field would throw,
  but the builder never copies the whole record (it constructs fresh claim objects), so this is safe.
