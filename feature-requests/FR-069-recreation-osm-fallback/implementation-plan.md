# FR-069 — Recreation OSM cost-resilience fallback — Implementation Plan

*Phase 3. Ordered constants → data → template → sources → tests. Mirrors FR-066.*

## Task 1 — constants
- Add `OSM_RECREATION_FILTERS` (5 keys, tag-only) + export. Reuse
  `OSM_POI_RADIUS_M`.

## Task 2 — recreation/data.js
- New imports: `sourceChain`, `searchOSMPOIs`, `placesOsmCache`, `logError`,
  `OSM_RECREATION_FILTERS`, `OSM_POI_RADIUS_M`.
- Module-private `osmRecord(p)` (mirror reachability) + `chainLog(fn, origin)`.
- For each of the 5: rename current body → `findNearestXGoogle`; add
  `findNearestXOSM` (cache → searchOSMPOIs limit 1 → osmRecord); add public
  `findNearestX` = sourceChain([google, osm]) → value or throw.
- Update `module.exports` to add the 5 google + 5 osm impls.

## Task 3 — reachability/template.js `buildAdditionalServicesCardHTML`
- Narrative: branch coffee/park on `isStraightLine` → distance phrase via
  `proximityPhrase`; keep the minutes branches for Google records. Guard
  elementarySchool (unchanged behaviour).
- Civic items: keep the source record (`src`) on each item; render time cell as
  `formatProximity(src)`.
- No class changes; reuse helpers already at the top of the file.

## Task 4 — SOURCES
- Add 5 OSM descriptors; export google/osm impls.

## Task 5 — tests
- `tests/modules/recreation/data.test.js` — mock `searchOSMPOIs` + `placesOsmCache`
  + google client + `getDriveTime` + logger; per amenity: google success →
  no OSM call; google throw → OSM straight-line record; both fail → throws.
  Cache test for one. (Mirror reachability's FR-066 test block.)
- `tests/modules/reachability/template.test.js` — extend
  `buildAdditionalServicesCardHTML`: OSM coffee/park → renders "straight-line" /
  "mi", not "null min"; OSM civic item → "~N mi"; Google records unchanged.

## Task 6 — verify
- `npx jest` full green.
- Keyless live Overpass check of the 5 `findNearestXOSM` across the 5 test
  addresses (space calls for Overpass etiquette) — confirm sane nearest results,
  Jeffersonville returns IN-side POIs.

## Risks / unknowns
- **Rec center tag fuzziness**: `community_center` (Google) ↔ `sports_centre` +
  `community_centre` (OSM). Union both; acceptable proxy for a fallback.
- **Post office** is overwhelmingly `amenity=post_office` in OSM — reliable.
- **Coffee**: Google `cafe` ≈ OSM `amenity=cafe`; the Google path's multi-
  candidate drive-time sort has no OSM analog (no minutes) — OSM just takes the
  nearest, which is the honest straight-line floor.
