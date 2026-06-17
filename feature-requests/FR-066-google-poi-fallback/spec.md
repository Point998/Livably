# FR-066 — Google-POI cost-resilience fallback (OSM, non-safety POIs)

*Track A1, slice 2. Reuses the FR-065 `sourceChain` primitive. Proven on the Reachability daily trio. Phases 1/3 in `discovery.md` / `implementation-plan.md`.*

## Problem

~9 modules depend on Google (Places + Distance Matrix). When Google quota/spend trips (`QuotaExceededError`), nearly half the report degrades to the link floor at once — including everyday daily-needs content. There is no second data source. This slice adds an **OSM fallback for non-safety POIs** so a Google outage (or a deliberate spend cap) keeps the daily content alive, and proves it on Reachability (grocery / pharmacy / gas).

## Decisions (Nathan, 2026-06-16)

- **Proximity on the OSM path = haversine straight-line distance, clearly labeled.** In a quota outage Distance Matrix is down too, so no Google drive time is available. Keyless, honest, free — the cost-resilience floor. OSRM routing is a deferred upgrade, not this slice.
- **First module = Reachability trio.** Shared helper extends to other modules in later FRs.
- **Safety tier excluded** — Health (CONSTRAINT-003/006) and Schools (CONSTRAINT-006) stay Google-only; never apply a straight-line fallback there.

## Shared layer

### `src/shared/overpass.js` (NEW — extracted, CONSTRAINT-014)
- Move `fetchOverpass(query, timeoutMs)` (multi-endpoint 429/406 failover) out of `sensory/data.js` into `shared/`, importing `OVERPASS_ENDPOINTS` from constants. Update Sensory to import it (its tests cover the refactor; behavior unchanged).

### `src/shared/osmPlaces.js` (NEW)
- `searchOSMPOIs(lat, lng, { filters, radiusM, limit = 8 })` → builds an Overpass query (`nwr(around:radiusM,lat,lng)[<filter>];` for each filter, union), parses elements, returns `[{ name, lat, lng, distanceMiles }]` sorted ascending by `haversineDistance`. Skips unnamed nodes. Returns `[]` on no result / fetch failure (never throws). Pure parse over the Overpass JSON; the only IO is `fetchOverpass`.

## Data layer — `src/modules/reachability/data.js`

For each of grocery / pharmacy / gas, split into a Google impl + an OSM impl, orchestrated by `sourceChain`:

- **Google impl** = the current body, unchanged (cell cache, drive times, coherence, `withCellFields`). Records implicitly `proximitySource: 'google-drive'`.
- **OSM impl** = `searchOSMPOIs` with the type's tag filters → maps to the **same record shape minus routing**: `{ name, address: null, location: { lat, lng }, driveTimeMinutes: null, distanceMiles, proximitySource: 'osm-straightline' }`. Grocery returns top-3 by distance; pharmacy/gas return the single nearest. **OSM records skip `withCellFields`/banding** (no minutes → no `bandRung`; `classifyBand` is never called with null).
- **Orchestration:** `sourceChain([{ name:'google', run: <googleImpl>, isValid: <has drive time> }, { name:'osm', run: <osmImpl>, isValid: <has distanceMiles> }], …, { label:'reachability-<type>' })`. On both-null the function throws as today → orchestrator's existing link floor. Google still short-circuits (no OSM/Overpass call) when it succeeds — preserves cost behavior.
- **Cache:** OSM results cached under a distinct key suffix (e.g. `grocery:osm:<cellId>`); cell behavior preserved.
- Tag filters (constants): grocery `shop~"supermarket|grocery"`; pharmacy `amenity=pharmacy`; gas `amenity=fuel`.

## Logic layer — `src/modules/reachability/logic.js`

- Thread `proximitySource` through where records are assembled. **No business-rule change**; the coherence check (CONSTRAINT-010) only runs on the Google path (it keys off minutes) — guard it so a distance-only record is passed through untouched.

## Template layer — `src/modules/reachability/template.js`

- Add `formatProximity(record)`: `driveTimeMinutes != null` → `formatDriveTime(minutes)`; else → `~${distanceMiles} mi`. Use it in the at-a-glance grid + cards in place of bare `formatDriveTime(driveTimeMinutes)`.
- **Narrative branches**: where prose says `"${g.driveTimeMinutes} minutes away"`, branch to a distance phrasing on the OSM path (e.g. `"about ${g.distanceMiles} miles away (straight-line)"`). Keep the existing minutes prose for the Google path.
- **Provenance + caveat** (honest-provenance principle): when any rendered reachability record is `proximitySource: 'osm-straightline'`, show a `prem-disclaimer`: `Source: OpenStreetMap. Live drive times were unavailable, so distances are straight-line (as-the-crow-flies), not road miles.`
- No inline styles (CONSTRAINT-008); no scoring (CONSTRAINT-001); template makes no API calls (CONSTRAINT-009).

## Constants — `src/utils/constants.js`

- OSM tag filters per POI type; an OSM search radius (reuse `GROCERY_SEARCH_RADIUS_M` where sensible, or `OSM_POI_RADIUS_M`).

## SOURCES (FR-063)

- Add OSM fallback descriptors (`osm-grocery-fallback`, `osm-pharmacy-fallback`, `osm-gas-fallback`, provider `osm`) so the scheduled monitor verifies the fallbacks against the 5 addresses.

## Constraints

- CONSTRAINT-001/008/009/011 (no score / no inline styles / layer separation / tests + 5 addresses incl. Jeffersonville).
- CONSTRAINT-003 / 006: **safety + cross-state tiers untouched.**
- CONSTRAINT-010: coherence runs only where minutes exist.
- CONSTRAINT-013: shared helper + one module; others are follow-ups.
- CONSTRAINT-014: Overpass + OSM-POI helpers live in `shared/`.
- CONSTRAINT-015 + honest-provenance: OSM source + straight-line caveat always visible on that path.
- Cost: OSM fires only when Google fails; Google path + cell cache unchanged; OSM results cached.

## Tests

- `searchOSMPOIs`: fixture of Overpass JSON → distance-sorted records, name extraction, unnamed skipped, `[]` on empty/failure.
- `fetchOverpass` extraction: Sensory suite stays green (behavior unchanged).
- Reachability chain (mock `googleMapsClient` + `fetch`): Google success → google records, **no Overpass call**; Google throws → OSM records with `distanceMiles`, `driveTimeMinutes: null`, `proximitySource: 'osm-straightline'`; both fail → throws.
- Template: renders `~X mi` + straight-line caveat on the OSM path; renders minutes normally on the Google path; no crash when `driveTimeMinutes` is null / `bandRung` absent.
- Live: all 5 addresses return OSM POIs with plausible straight-line distances when Google is forced to fail (incl. Jeffersonville IN / Bozeman MT).

## Acceptance Criteria

- [ ] `shared/overpass.js` extracted; Sensory imports it; Sensory tests green.
- [ ] `searchOSMPOIs` returns distance-sorted named POIs from Overpass; `[]` on failure.
- [ ] Each reachability fetcher falls back to OSM when Google throws, with no Overpass call when Google succeeds.
- [ ] OSM records render distance + a clear straight-line caveat + OSM source; Google records render unchanged (minutes, bands, coherence).
- [ ] Safety/health/schools code paths untouched.
- [ ] No scoring, no inline styles; fixtures committed; full suite green; FR-063 descriptors added.

## Out of scope (YAGNI)

- OSRM / real road routing on the OSM path (deferred cost-architecture Phase 2).
- OSM fallback for Health / Schools (safety + cross-state — never straight-line).
- Other Google modules (walkability, recreation, sensory-airports, growth-commercial) — each a later FR reusing `overpass.js` + `searchOSMPOIs`.

## Open questions (resolve in planning)

1. **Caching a Google outage**: if Google throws and OSM fills in, do we cache the OSM result under the normal key (so the cell shows straight-line distance for the TTL) or a short-TTL key (so it re-tries Google sooner)? Lean: distinct OSM key, shorter TTL, so recovery is quick once quota resets.
2. **`isExcludedGroceryType` parity**: the Google grocery path excludes gas/convenience/dollar stores by Google place type. OSM filtering uses tags (`shop=supermarket|grocery`) which largely avoids these by construction — confirm no brand/name logic creeps in (CONSTRAINT-004).
