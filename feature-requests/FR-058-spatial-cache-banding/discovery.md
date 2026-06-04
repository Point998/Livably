# FR-058 — Discovery (Phase 1, read-only)
*Spatial cache keys + drive-time banding. Implements NR-003 Phase 1.*

## Source of this FR
NR-003 (`docs/nathan-reports/NR-003-spatial-cost-architecture.md`) — owner strategic review. This FR specs only **Phase 1** of that document (pure-Google spatial keys + banding). Phase 2 (OSRM routing) and Phase 3 (warehouse) are explicitly out of scope.

## What exists today

### Caching (`src/cache.js`)
- Persistent, file-backed `Cache` class. MD5-hashes the key → `<namespace>_<hash>.json` in `src/.cache/`.
- Three instances: `geocodeCache` (90d), `placesCache` (7d), `driveTimeCache` (24h).
- `get/set/clear/stats` + module-level `cacheStats()`. Fails silent on IO errors.
- **The leak:** every consumer keys by the exact origin coordinate. Neighboring addresses share nothing.

### Cache key construction (the exact-coordinate problem)
- `src/modules/reachability/data.js:19,68,97` — `grocery:${originLatLng}`, `pharmacy:${originLatLng}`, `gasstation:${originLatLng}`.
- `src/shared/google/distanceMatrix.js:9` — `${originLatLng}:${destStr}`; `:42` — `traffic:${originLatLng}:${destLatLng}:${label}`.
- `originLatLng` is a precise `"lat,lng"` string. No rounding/snapping anywhere.

### Drive time (`src/shared/google/distanceMatrix.js`)
- `getDriveTime(origin, dest)` → single-element Distance Matrix call, `departure_time = getNextTuesday8am()`, returns rounded **minutes** (`duration_in_traffic` preferred). 24h cache.
- `getTrafficVariations(origin, dest)` → 4 slots × Distance Matrix (the 8 calls in NR-002's count). Returns `{variations, stats:{min,max,avg,range}}`.

### POI fetchers
- Reachability: `findNearestGrocery` (textSearch, tight radius, top-N by drive time), `findNearestPharmacy`/`findNearestGasStation` (placesNearby `rankby:distance`). All compute drive time per result, then cache the **finished** object under the exact-coordinate key.
- Health (`src/modules/health/data.js`): hospital uses Text Search + **5-candidate drive-time verification** (CONSTRAINT-003) — the single most expensive operation per NR-002. Urgent care similar.

### Density classification (`src/shared/validate.js`)
- `detectRuralMode(tractPopulation, avgDriveMinutes)` → `{mode,label}` ∈ urban/suburban/rural/remote. Already computed before narrative. **This is the hook for both cell resolution and band thresholds.**
- `checkDriveTimeCoherence(minutes, label, ruralMode)` (CONSTRAINT-010) — operates on a numeric minute value; must run on the centroid value *before* banding.
- `checkCrossState` (CONSTRAINT-006) — unaffected; still runs on result coordinates.

### Constants (`src/utils/constants.js`)
- Holds `GROCERY_SEARCH_RADIUS_M`, candidate counts, rural-mode population/drive thresholds, `DRIVE_TIME_COHERENCE_THRESHOLD_MINUTES`, `TRAFFIC_VARIATION_SLOTS`. Band ladders + cell resolutions should live here.

## What's missing
- No spatial primitive. No way to snap a coordinate to a shared cell.
- No band classification. Drive times surface as exact integers everywhere.
- No separation between *what is cached* (cell-level) and *what is exact* (safety-tier per-address).

## What could break (risk surface)
1. **POI selection at cell edges.** Searching from the centroid means an edge-of-cell house could be marginally closer to a *different* POI than the centroid's pick. Acceptable in dense areas (small cells) and rural (POIs far + shared); must be bounded by cell size and an honest edge-case note.
2. **CONSTRAINT-003 (hospital).** Selection must stay drive-time-based, and the *displayed* ER time must stay genuinely concrete. Naive cell-caching would band/centroid the safety number. Mitigation (see spec): cell-cache the expensive 5-candidate *selection*, but recompute the final displayed drive time per actual address (1 call).
3. **New dependency.** H3 (`h3-js`) is the right primitive but is a new npm package — must be documented (CLAUDE.md "Do Not"). Geohash (`ngeohash`) is a fallback.
4. **CONSTRAINT-011.** Needs tests, including Jeffersonville IN, for the cell normalizer, band classifier, and cache-key behavior.
5. **CONSTRAINT-009.** Band *words* ("a quick trip") must never enter logic/data — logic emits a rung integer only.

## Conclusion
The change is small in surface area (a shared spatial primitive + a band classifier + a cache-key swap + a data-contract field) but high in leverage. It stays entirely within the existing 3-layer architecture and touches no provider. The only genuine design decisions are the H3 dependency and the safety-tier exact-call carve-out, both resolved in the spec.
