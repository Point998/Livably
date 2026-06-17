# FR-066 — Implementation Plan (Phase 3)

*Ordered by layer, shared-helpers first. TDD: tests alongside each unit (CONSTRAINT-011). No code in this phase. Builds on `spec.md`.*

## Confirmed in planning (de-risks the spec)

- **Overpass reachable + shape confirmed.** `nwr(around:R,lat,lng)["shop"~"supermarket|grocery"]; out center tags;` near Georgetown KY returned named supermarkets (Kroger, Walmart Supercenter, Save-A-Lot) with `name` / `shop` / `center`. Nodes carry `lat`/`lon`; ways/relations carry `center.{lat,lon}` — parser must read both.
- **Multi-endpoint failover is load-bearing.** In the probe the `.de` endpoint returned an HTML rate-limit page and `kumi` was unreachable (HTTP 000); `openstreetmap.fr` succeeded. `fetchOverpass` already rotates endpoints on failure — reuse it as-is.
- **Open Q2 resolved:** tag filtering (`shop=supermarket|grocery`, `amenity=pharmacy`, `amenity=fuel`) returns the right categories without brand/name logic — CONSTRAINT-004 satisfied.
- **Open Q1 resolved:** cache the OSM fallback under a **distinct short-TTL key** (`*:osm:*`, ~1h) so a cell recovers to Google quickly once quota resets, and an outage doesn't re-hammer Overpass.

## Task order

### Task 1 — Extract `src/shared/overpass.js` + tests
- Move `fetchOverpass(query, timeoutMs)` from `sensory/data.js` to `shared/overpass.js`; import `OVERPASS_ENDPOINTS`. Update `sensory/data.js` to import it (delete the local copy).
- **Tests** (`tests/shared/overpass.test.js`, mock `global.fetch`): first endpoint 429 → second endpoint 200 returns that response; all endpoints fail → `null`. **Regression:** Sensory suite stays green.

### Task 2 — `src/shared/osmPlaces.js` (`searchOSMPOIs`) + tests
- `searchOSMPOIs(lat, lng, { filters, radiusM, limit = 8 })`: build `[out:json][timeout:15];( nwr(around:radiusM,lat,lng)[<f>]; … );out center tags;` (union of filters) → call `fetchOverpass` → parse elements that have a `name`, compute `haversineDistance` to each (`center` or `lat/lon`), sort ascending, slice `limit`. Returns `[{ name, lat, lng, distanceMiles }]`; `[]` on null/empty (never throws).
- **Tests** (mock `fetchOverpass` with a fixture, `tests/shared/fixtures/overpass-grocery.json`): distance-sorted output; reads both node `lat/lon` and way `center`; unnamed elements skipped; `[]` on null response / empty elements.

### Task 3 — Constants (`src/utils/constants.js`)
- `OSM_POI_FILTERS = { grocery: ['shop~"supermarket|grocery"'], pharmacy: ['amenity=pharmacy'], gas: ['amenity=fuel'] }`.
- `OSM_POI_RADIUS_M` (reuse `GROCERY_SEARCH_RADIUS_M` value, named for general POI use).
- `PLACES_OSM_TTL_HOURS = 1` (short-TTL fallback cache).

### Task 4 — Cache (`src/cache.js`)
- Add `placesOsmCache = new Cache('places_osm', 60 * 60 * PLACES_OSM_TTL_HOURS)`; export it; add to `cacheStats` breakdown. (Distinct namespace ⇒ recovery to Google in ≤1h after quota resets.)

### Task 5 — Reachability data layer (`src/modules/reachability/data.js`) + tests
- For grocery / pharmacy / gas: rename the current body to `…Google(…)` (unchanged) and add `…OSM(…)`:
  - `…OSM` resolves search coords via `cellSearchOrigin`, calls `searchOSMPOIs` with the type's filters, maps to `{ name, address: null, location: { lat, lng }, driveTimeMinutes: null, distanceMiles, proximitySource: 'osm-straightline' }`. Grocery → top-3; pharmacy/gas → nearest only. **No `withCellFields`** (no minutes → no `bandRung`; `classifyBand` never called with null). Cache under `…:osm:<cellId|origin>` in `placesOsmCache`.
- Orchestrate each public fetcher via `sourceChain([{ name:'google', run, isValid: hasDriveTime }, { name:'osm', run, isValid: hasDistance }], null, { label:'reachability-<type>' })`; unwrap `.value`; if `null` throw the existing "none found" error (→ orchestrator link floor). Google short-circuits when valid (no Overpass call).
- Add SOURCES descriptors `osm-grocery-fallback` / `osm-pharmacy-fallback` / `osm-gas-fallback` (provider `osm`).
- **Tests** (mock `googleMapsClient` + `searchOSMPOIs`/`fetch`): Google success → google-shaped records, **OSM not called**; Google throws → OSM records (`distanceMiles`, `driveTimeMinutes: null`, `proximitySource`); both fail → throws; grocery OSM returns ≤3 sorted by distance.

### Task 6 — Logic layer (`src/modules/reachability/logic.js`) + tests
- Thread `proximitySource` onto assembled records. Guard the CONSTRAINT-010 coherence check to run only when `driveTimeMinutes != null` (distance-only records pass through untouched). No rule change otherwise.

### Task 7 — Template layer (`src/modules/reachability/template.js`) + tests
- `formatProximity(record)`: minutes present → `formatDriveTime(minutes)`; else → `~${distanceMiles} mi`. Use in the at-a-glance grid + cards.
- Narrative: branch the "${x} minutes away" prose to "about ${distanceMiles} miles away (straight-line)" on the OSM path; Google prose unchanged.
- Provenance: when any rendered reachability record is `proximitySource:'osm-straightline'`, emit `<p class="prem-disclaimer">Source: OpenStreetMap. Live drive times were unavailable, so distances are straight-line (as-the-crow-flies), not road miles.</p>`.
- **Tests:** OSM path renders `~X mi` + caveat + no NaN/undefined minutes; Google path renders minutes/bands unchanged; null-safe when `bandRung` absent.

### Task 8 — Full verification (CONSTRAINT-011)
- `npm test` green (new + existing reachability + sensory suites unchanged).
- **Live check** (keyless, zero Google cost): call `searchOSMPOIs` for the 5 test addresses' coords → plausible named groceries + straight-line distances (incl. Jeffersonville IN, Bozeman MT, Harlan KY). Plus a chain test with Google mocked to throw → OSM records flow end-to-end.
- Note: full `verify:sources` needs Google keys/cost; rely on CI monitor for the live Google rows. The new OSM descriptors will be verified there.

## Risks & unknowns

| Risk | Severity | Mitigation |
|------|----------|------------|
| Overpass per-endpoint flakiness / 429 | Med | `fetchOverpass` multi-endpoint failover (proven in probe); short-TTL cache avoids re-hammering during an outage |
| Record-shape divergence breaks Google narrative | Med | `formatProximity` + explicit branches + null-safe template tests; Google path code path unchanged |
| `bandRung`/`withCellFields` assume minutes | Med | OSM records skip banding; template/logic tolerate missing `bandRung`; `classifyBand` never called with null |
| Sensory refactor regресsion | Low | Pure extraction, identical behavior; Sensory suite is the safety net |
| OSM grocery includes non-grocery | Low | Tag-based filter (probe showed clean supermarkets); CONSTRAINT-004 honored |
| Stale straight-line distance lingers after Google recovers | Low | Distinct `places_osm` namespace at ~1h TTL |

## Definition of done
All Task-8 checks green; OSM fallback renders distance + caveat for all 5 addresses with Google forced to fail; Google path + safety tier unchanged; no scoring/inline styles; fixtures committed; `summary.md` written; PR opened (docs + code together, left for review per the doc-PR rule).
