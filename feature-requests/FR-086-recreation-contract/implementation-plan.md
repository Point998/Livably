# FR-086 — Implementation Plan

Tests alongside (CONSTRAINT-011). Pure mapping layer — no API calls, no new deps. Closely mirrors FR-085.

## Task 1 — `src/modules/recreation/contract.js` (new)
1. `require('../../contract/schema')` → `safeBuild`.
2. `amenityTone(mins)`: ≤10 favorable, else neutral. (Never caution.)
3. `isOSM(r)` → `r?.proximitySource === 'osm-straightline'`.
4. `placeOf(r)` → `{ name: r.name, address: r.address || 'Location approximate (OpenStreetMap)' }`.
5. `amenityFinding(record, { id, subject }, asOf)`:
   - `!record` → return `null` (omit; caller skips).
   - OSM → measure `{value: distanceMiles, unit:'straight_line_miles'}`, tone `neutral`,
     provenance `{source:'OpenStreetMap', asOf, modeled:true}`, place, defaultCopy = straight-line caveat.
   - Google → measure `{value: driveTimeMinutes, unit:'drive_minutes'}`, tone `amenityTone`,
     provenance `{source:'Google Places', asOf, modeled:false}`, place.
   - bucket `cool`, `fallbackAction: null`. Returns `{ finding, copy }`.
6. `buildRecreationContract(input = {}, opts = {})`:
   - `{ park, coffeeShop, library, recCenter, postOffice }`.
   - Guard: all absent → `null`.
   - asOf default `YYYY-MM`. `push({finding, copy})` sets defaultCopy; skip when builder returns null.
   - ids/subjects: `nearest-park`/'Nearest park', `nearest-coffee`/'Nearest coffee shop',
     `nearest-library`/'Nearest public library', `nearest-recreation-center`/'Nearest recreation center',
     `nearest-post-office`/'Nearest post office'.
   - provenanceSummary dedupe by `source|asOf`.
   - `safeBuild('recreation', () => ({ schemaVersion:'1.0', chapterId:'recreation', findings,
     degraded:!!opts.degraded, provenanceSummary }))`.
7. `module.exports = { buildRecreationContract }`.

**Tests:** `tests/modules/recreation/contract.test.js` (new) — AC-1..AC-8. Fixtures: Google records,
an OSM straight-line record (distanceMiles + null-address coercion + no leaked keys), and an absent
amenity (assert omitted). Snapshots: Georgetown full, Harlan (one OSM + one absent), Jeffersonville IN.

## Task 2 — wire into `reportBuilder.js`
1. Import `buildRecreationContract`.
2. In `contract.chapters` add:
   ```
   recreation: (park || coffeeShop || library || recCenter || postOffice)
     ? buildRecreationContract({ park, coffeeShop, library, recCenter, postOffice }, { degraded: degradation.total > 0 })
     : null,
   ```
   (`park/coffeeShop/library/recCenter/postOffice` are already in scope from the top-level destructure.)

## Task 3 — verify
- `npx jest tests/modules/recreation` then full `npx jest`. Green incl. 5 addresses.
- Review snapshots; confirm omitted-absent behavior and no leaked internal keys.

## Risks / unknowns
- OSM `address:null` vs required `PlaceSchema.address` → `placeOf` coercion (assert in a test).
- Don't emit a `*-missing` finding — absent amenities are simply skipped (AC-5 guards this).
- `recreation` has no `tests/modules/recreation/` dir yet — create it.
