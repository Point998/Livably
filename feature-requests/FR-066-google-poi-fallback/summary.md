# FR-066 — Summary

*Track A1, slice 2: Google-POI cost-resilience fallback. Reuses the FR-065 `sourceChain` primitive. Built test-first (TDD). Phases 1–3 in `discovery.md` / `spec.md` / `implementation-plan.md`.*

## What shipped

1. **`src/shared/overpass.js`** — the OSM Overpass client extracted from Sensory (multi-endpoint failover), now shared (CONSTRAINT-014). Sensory imports it; behavior preserved.
2. **`src/shared/osmPlaces.js`** — `searchOSMPOIs(lat, lng, { filters, radiusM, limit })`: tag-only Overpass query (CONSTRAINT-004 — no brand/name logic) → named POIs sorted by **haversine straight-line distance**. Pure aside from the fetch; never throws.
3. **Reachability fallback** (`src/modules/reachability/data.js`): grocery / pharmacy / gas each wrapped in a `sourceChain` — **Google primary → OSM straight-line fallback → throw (link floor)**. Google short-circuits (no Overpass call) whenever it succeeds, so normal-path cost behavior is unchanged. OSM records carry `{ distanceMiles, driveTimeMinutes: null, proximitySource: 'osm-straightline' }`, cached in a new short-TTL `places_osm` cache (~1h) so a cell recovers to Google quickly once quota resets. New FR-063 SOURCES descriptors (Google descriptors retargeted at the `…Google` impl so the monitor still reports on Google specifically; OSM fallbacks added).
4. **Honest rendering** (`src/modules/reachability/template.js`): `formatProximity` + a distance-based narrative branch + glance/insight handling so the OSM path shows `~X mi` with a clear "live drive times unavailable — straight-line, not road miles, from OpenStreetMap" caveat. The Google path renders minutes/bands **unchanged**.

**Safety tier untouched:** Health (CONSTRAINT-003/006) and Schools (CONSTRAINT-006) stay Google-only — never a straight-line fallback.

## Bonus bug fixed (was silently breaking Sensory too)

**Overpass blocks Node's default `fetch` User-Agent (HTTP 406).** Discovered during the live check: the same query worked via `curl` but every Node `fetch` to Overpass returned 406/403. This is a **pre-existing latent bug** — Sensory's OSM features (road noise, rail, land use) were silently degrading to their fallbacks in production for the same reason. Fixed in `shared/overpass.js` by sending a descriptive `User-Agent` (Overpass etiquette anyway). One small fix repairs both FR-066 and Sensory's OSM data. *(Found in development, not a real report → no PM per CONSTRAINT-012, but noted here and in the roadmap.)*

## Verification

- **Full suite green: 1,516** (was 1,493; +23 — 5 overpass, 7 osmPlaces, 4 reachability-data, 4 template, plus the UA test). Built test-first: every test watched fail before implementation.
- **Live OSM grocery fallback, all 5 addresses** (keyless, zero Google cost), with the UA fix:
  | Address | Nearest (straight-line) |
  |---------|--------------------------|
  | Georgetown KY | Save-A-Lot ~0.2 mi (3 stores) |
  | Harlan KY | Food City ~1.2 mi (2 stores) |
  | Louisville KY | Bourbon Barrel Foods ~0.2 mi (3) |
  | Bozeman MT | Co-op Downtown ~0.4 mi (3) |
  | Jeffersonville IN | Save-A-Lot ~0.9 mi (3) |
  - All return `proximitySource: 'osm-straightline'` with plausible distances. When Google is up, OSM is never queried; when both fail, the existing link floor still covers (no crash — verified in the pre-fix run, which degraded cleanly to NULL → link floor).

## Constraints honored

CONSTRAINT-001 (no scoring), 003/006 (safety + cross-state tiers untouched), 004 (tag-only OSM filters, no brand logic), 008 (no inline styles — `prem-disclaimer`/existing classes), 009 (data fetches / template renders — `searchOSMPOIs` returns data, zero HTML), 010 (coherence runs only on the minutes path), 011 (tests + fixtures, all 5 addresses incl. Jeffersonville/Bozeman), 013 (shared helper + one module; others are follow-ups), 014 (Overpass + OSM-POI helpers in `shared/`), 015 + honest-provenance (OSM source + straight-line caveat always visible).

## Out of scope (future A1 slices, reuse `overpass.js` + `searchOSMPOIs`)

Walkability, Recreation, Sensory-airports, Growth-commercial Google fetchers — each a later FR. OSRM road routing on the OSM path (deferred cost-architecture Phase 2). Never Health/Schools (safety + cross-state).
