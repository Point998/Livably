# FR-069 — Recreation OSM cost-resilience fallback — Summary

*Phase 4 complete. Track A1, fourth slice. Extends the FR-066 reachability
pattern to the Recreation module. First slice to land in the FR-068-instrumented
system — its fallbacks are observable for free via the source-chain ledger.*

## What shipped

When Google Places is unavailable, the 5 recreation amenities (park, coffee,
library, rec center, post office) fall back to OpenStreetMap straight-line
nearest instead of vanishing — and render honestly (straight-line miles, never
fake minutes).

- Each `findNearestX(originLatLng)` is now a `sourceChain`: **Google → OSM →
  throw** (link floor; `buildDestSection` already degrades a thrown→null result
  to an actionable "Search Google Maps" note, CONSTRAINT-015). Google
  short-circuits (no Overpass) on success. Public signatures unchanged.
- OSM records use the FR-066 contract (`driveTimeMinutes: null`, `distanceMiles`,
  `proximitySource: 'osm-straightline'`); a shared `recreationOSM` helper drives
  all 5 via one `searchOSMPOIs(filters, limit: 1)` call.
- **Renderer fix:** `buildAdditionalServicesCardHTML` rendered `driveTimeMinutes`
  raw in the narrative and civic-items row — would have printed "null minutes"
  for an OSM record. Now straight-line-aware via the existing
  `isStraightLine`/`proximityPhrase`/`formatProximity` helpers. Google records
  render byte-identical (`formatDriveTime` → "N min").

## Pattern decision (no premature abstraction)

Recreation is the reachability pattern (nearest single amenity), **not** the
walkability union-categorize pattern — so the `withTags` + `categorizeOSMWalkPOI`
helper does not apply, and the hypothetical "shared categorized-OSM helper"
second caller never materialized. Confirmed: keep walkability's categorizer
walkability-specific.

## Files touched

- `src/utils/constants.js` — `OSM_RECREATION_FILTERS` (tag-only) + export.
- `src/modules/recreation/data.js` — 5 fns split google/osm + sourceChain;
  `recreationOSM` + `osmRecord` helpers; 11 SOURCES descriptors (1 google + 5 osm
  + existing).
- `src/modules/reachability/template.js` — straight-line handling in
  `buildAdditionalServicesCardHTML` (recreation has no template of its own).
- Tests: `tests/modules/recreation/data.test.js` (OSM fallback block, `test.each`
  over all 5), `tests/modules/reachability/template.test.js` (+FR-069 block).

## Constraints honored

- **004** — tag-only OSM filters, no brand/chain names. ✓
- **008** — renderer edits reuse existing classes/helpers, no inline styles. ✓
- **011** — tests per OSM fn + straight-line renderer; Jeffersonville IN in live
  check. ✓
- **015** — both-down keeps the existing "Search Google Maps" actionable floor. ✓

## Verification

- `npx jest` — **83 suites / 1,575 tests green** (was 83 / 1,554; +21).
- **Keyless live Overpass check**, all 5 addresses: Georgetown / Louisville /
  Bozeman / Jeffersonville (IN-side POIs — no cross-state leak) all returned
  sane nearest results; Harlan (rural) correctly returned `none` for coffee &
  rec center (sparse OSM → link floor). No Overpass call on the Google happy path.

## Phases

All 4 workflow phases executed (discovery → spec → plan → implementation). No
phases skipped.

## Next up (A1)

Sensory airports (OSM `aeroway=aerodrome`, not shop/amenity — a different tag
shape) → Growth commercial → then non-Google singles: USDA soil, USGS elevation,
Census vintage.
