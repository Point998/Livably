# FR-069 — Recreation OSM cost-resilience fallback — Specification

*Phase 2. Module: `recreation`. Pattern: FR-066 reachability (Google nearest →
OSM straight-line single result).*

## Goal

When Google Places is unavailable, the 5 recreation amenities (park, coffee,
library, rec center, post office) fall back to OpenStreetMap straight-line
nearest instead of vanishing — and render honestly (straight-line miles, not
fake minutes).

## Public contract (unchanged signatures)

Each of `findNearestPark / findNearestCoffeeShop / findNearestLibrary /
findNearestRecreationCenter / findNearestPostOffice(originLatLng)` becomes a
`sourceChain`: **Google primary → OSM fallback → throw** (link floor; the
renderer's `buildDestSection` already degrades a thrown→null result to an
actionable "Search Google Maps" note, CONSTRAINT-015).

Record shapes:
- Google (unchanged): `{ name, address, location, driveTimeMinutes }`.
- OSM: `{ name, address: null, location: {lat,lng}, driveTimeMinutes: null,
  distanceMiles, proximitySource: 'osm-straightline' }`.

## Behaviour per amenity

- `findNearestXGoogle(originLatLng)` — today's body verbatim (incl. `isValidPark`
  filter and coffee's candidate drive-time sort), still throwing on no result.
- `findNearestXOSM(originLatLng)` — `placesOsmCache` key `x:osm:${originLatLng}`;
  `searchOSMPOIs(lat, lng, { filters: OSM_RECREATION_FILTERS.x, radiusM:
  OSM_POI_RADIUS_M, limit: 1 })`; `null` if empty, else `osmRecord(pois[0])`.
- `findNearestX(originLatLng)` — `sourceChain([google, osm], null, { label:
  'recreation-x', log: chainLog('findNearestX', originLatLng) })`; `picked` →
  value; else `throw`. Google short-circuits (no Overpass) on success.

## New constants (`utils/constants.js`)

```
OSM_RECREATION_FILTERS = {
  park:       ['["leisure"="park"]'],
  coffee:     ['["amenity"="cafe"]'],
  library:    ['["amenity"="library"]'],
  recCenter:  ['["leisure"="sports_centre"]', '["amenity"="community_centre"]'],
  postOffice: ['["amenity"="post_office"]'],
}
```
Tag-only (CONSTRAINT-004). Radius reuses `OSM_POI_RADIUS_M` (8000).

## Renderer (`reachability/template.js buildAdditionalServicesCardHTML`)

Make the two raw-`driveTimeMinutes` spots straight-line-aware using the existing
helpers (`isStraightLine`, `formatProximity`, `proximityPhrase`):
- **Narrative** (coffee, park): when the record is straight-line, use a distance
  phrase ("`<name>` is about `N` miles away (straight-line)") and skip the
  `<= 5 min` habit framing (we have no minutes). `elementarySchool` branch
  guarded but unchanged in practice (no OSM fallback for schools).
- **Civic items** (library, rec center, post office): carry the source record so
  the time cell uses `formatProximity(record)` → "`~N mi`" when straight-line,
  "`N min`" otherwise.
- `buildDestSection` (park/coffee grid) already handles this — no change.

## SOURCES descriptors

- Keep the existing Google park descriptor.
- Add 5 OSM descriptors (`recreation-park-osm`, …) → each `findNearestXOSM`,
  provider 'osm', coverage 'some', isValid `r != null && typeof r.distanceMiles
  === 'number'`, no probe (mirrors FR-066).
- Export the new google/osm impls (mirror reachability's export shape).

## Edge cases

| Case | Expected |
|---|---|
| Google up | byte-identical to today; no Overpass call |
| Google down, OSM has POI | straight-line record, renders "~N mi (straight-line)" |
| Google down, OSM empty | throws → renderer shows "Search Google Maps" floor |
| Park: OSM returns a non-park-tagged POI | filter is tag-scoped to `leisure=park` so it won't; no `isValidPark` needed on OSM side |
| Fallback fired | FR-068 ledger records it (free, via sourceChain) |

## Acceptance criteria

1. Google up → unchanged behaviour + no Overpass call.
2. Each amenity: Google down + OSM POI → valid straight-line record.
3. Renderer shows straight-line miles (never "null minutes") in narrative + civic
   rows when records are OSM; minutes when Google.
4. Both down → throw → existing actionable "Search Google Maps" floor.
5. No brand names (004); renderer edits use existing classes (008).
6. Tests cover each OSM fn + the straight-line renderer; Jeffersonville IN in the
   live check; all existing suites green.
