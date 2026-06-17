# FR-070 — Sensory Airport OSM cost-resilience fallback — Implementation Plan

*Phase 3. Ordered constants → data → template → sources → tests. Mirrors FR-069,
simpler (no narrative rewrite — airports are already straight-line miles).*

## Task 1 — constants (`src/utils/constants.js`)
- Add `OSM_AIRPORT_FILTERS` (single tag-only clause; excludes private-type/
  private-access aerodromes; keeps military). Export it.
- Reuse existing `AIRPORT_SEARCH_RADIUS_M` (32000) and `AIRPORT_MAX_DISTANCE_MILES`
  (20) — already exported.

## Task 2 — `src/modules/sensory/data.js`
- New imports: `sourceChain` (`../../shared/sourceChain`), `searchOSMPOIs`
  (`../../shared/osmPlaces`), `logError` (`../../logger`), `OSM_AIRPORT_FILTERS`
  (added to the existing constants destructure).
- Add module-private `chainLog(fn, origin)` adapter (verbatim from
  `recreation/data.js:37`).
- Rename current `getAirportData` body → **`getAirportDataGoogle(lat, lng)`**
  (unchanged logic: placesNearby `type:'airport'`, regex filter, distance cap,
  sort; throws on Places error, null on legit-empty).
- Add **`getAirportDataOSM(lat, lng)`**: `searchOSMPOIs(lat, lng, { filters:
  OSM_AIRPORT_FILTERS, radiusM: AIRPORT_SEARCH_RADIUS_M, limit: 5 })` → map to
  `{ name, distanceMiles, lat, lng, source: 'osm' }` → filter `<=
  AIRPORT_MAX_DISTANCE_MILES` → sort ascending → return array or `null` if empty.
- Add public **`getAirportData(lat, lng)`** = `sourceChain([{name:'google',
  run, isValid:nullOrArray}, {name:'osm', run, isValid:nullOrArray}], null,
  { label:'sensory-airport', log: chainLog('getAirportData', \`${lat},${lng}\`) })`;
  return `picked ? picked.value : null`. (`nullOrArray = (r) => r === null ||
  Array.isArray(r)`.)
- `getEnvironmentalData` still calls `getAirportData(lat, lng)` at `:23` — no
  change there.
- `module.exports`: add `getAirportDataGoogle`, `getAirportDataOSM` (keep
  `getAirportData`).

## Task 3 — SOURCES (`src/modules/sensory/data.js`)
- Repoint `google-places-airports.run` → `getAirportDataGoogle(ctx.lat, ctx.lng)`
  (was `getAirportData`). Keep label, probe, isValid.
- Add `osm-airport-fallback` descriptor: provider `osm`, coverage `some`,
  `run: (ctx) => getAirportDataOSM(ctx.lat, ctx.lng)`, `isValid: nullOrArray`,
  no probe. Insert right after the Google airports descriptor.

## Task 4 — template (`src/modules/sensory/template.js`)
- Add helper near the top: `function airportSourceLabel(airports) { return
  airports?.[0]?.source === 'osm' ? 'OpenStreetMap' : 'Google Places'; }`.
- `:144` research-table source cell: `<td>${airportSourceLabel(airports)}</td>`
  (was `Google Places`).
- `:366` sources list: `airports && \`${airportSourceLabel(airports)} (airports)\``
  (was `'Google Places (airports)'`).
- No other template change — narrative/glance/takeaway read shape-identical data.
- No CSS, no class changes (CONSTRAINT-008).

## Task 5 — tests (`tests/modules/sensory/data.test.js`)
- Add top-of-file mocks: `jest.mock('../../../src/shared/osmPlaces', ...)` with a
  `mockSearchOSMPOIs`, and `jest.mock('../../../src/logger', () => ({ logError:
  jest.fn() }))`. Add `OSM_AIRPORT_FILTERS` — but the file imports the real
  constants today; **do not** mock the whole constants module (other tests rely on
  it). `searchOSMPOIs` is mocked, so the filter value is irrelevant to the mock.
- Import `getAirportData`, `getAirportDataGoogle`, `getAirportDataOSM`.
- New `describe('getAirportData (Google→OSM chain)')`:
  1. Google returns airports array → result is that array, **`searchOSMPOIs` not
     called**, no `source` field.
  2. Google returns empty (`{data:{results:[]}}`) → null, **OSM not called**
     (legit-empty short-circuit), no degradation.
  3. Google throws (placesNearby rejects) + OSM has aerodrome → array with each
     record `{name, distanceMiles, lat, lng, source:'osm'}`, sorted, capped ≤ 20.
  4. Google throws + OSM empty → null.
  5. `getAirportDataOSM` unit: sort ascending; record shape; cap at 20 mi;
     empty → null.
  6. Private/excluded handled by filter — assert the filter string passed to
     `searchOSMPOIs` contains `aeroway=aerodrome` and the private exclusions
     (tag-only, CONSTRAINT-004 guard).
- Keep existing `getEnvironmentalData` tests green (Google empty → airports null,
  unchanged).

## Task 6 — template test (`tests/modules/sensory/template.test.js`)
- Confirm the existing airport-narrative tests still pass.
- Add: research-table / sources-list render "OpenStreetMap" when
  `airports[0].source === 'osm'`, "Google Places" otherwise. (Check whichever
  builder the existing tests already exercise to avoid new harness wiring.)

## Task 7 — verify (Phase 4 close)
- `npx jest` full green (target ~1,575 + new).
- Keyless live Overpass check of `getAirportDataOSM` across the 5 test addresses
  (space the calls — Overpass etiquette): sane nearest aerodromes; **Jeffersonville
  IN** returns sensible results (Louisville-area airports are legitimately closest
  here and cross-state is acceptable for *airports* — CONSTRAINT-006 governs
  schools/hospitals/urgent-care/pharmacy, not airports; the narrative already
  reports whatever is nearest by distance).
- Live Google path unchanged (spot-check one address end-to-end if key present).

## Risks / unknowns
- **Aerodrome centroid vs Google point:** OSM aerodromes are polygons; `out center`
  centroid may differ slightly from Google's labeled point → sub-mile distance
  delta. Acceptable for a degraded fallback (honest-provenance labeled OSM).
- **Sparse OSM aerodrome coverage** in remote areas (Harlan KY) → OSM may return
  null where Google would have found a regional strip. Acceptable: fallback only
  fires during a Google outage, and null → the same "no airports" narrative that a
  real no-result produces. No worse than the status quo (which is *nothing*).
- **`searchOSMPOIs` limit 5** vs template showing up to 3 — fine; extra are
  ignored by `.slice(1,3)`.
