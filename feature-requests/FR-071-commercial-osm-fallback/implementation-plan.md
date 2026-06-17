# FR-071 — Growth commercial OSM cost-resilience fallback — Implementation Plan

*Phase 3. Ordered constants → logic → data → template → sources → tests. Mirrors
FR-067 walkability, minus the scoring.*

## Task 1 — constants (`src/utils/constants.js`)
- Add `OSM_COMMERCIAL_FILTERS` (8 tag-only clauses; CONSTRAINT-004) + export.
- Reuse existing `DEVELOPMENT_ACTIVITY_SEARCH_RADIUS_M` (2400) and
  `COMMERCIAL_DEV_TYPES` (already exported).

## Task 2 — logic (`src/modules/growth/logic.js`)
- Add `categorizeOSMCommercialPOI(tags)` → `{ type, label, icon }` or null
  (first-match; tag-only). Source label/icon from `COMMERCIAL_DEV_TYPES` (import
  it) keyed by `type` so they never drift from the Google path.
- Export it (extend `module.exports`).

## Task 3 — data (`src/modules/growth/data.js`)
- New imports: `sourceChain`, `searchOSMPOIs`, `placesOsmCache` (`../../cache`),
  `logError` (`../../logger`), `OSM_COMMERCIAL_FILTERS` (add to constants
  destructure), `categorizeOSMCommercialPOI` (from `./logic`).
- Add `chainLog(fn, origin)` adapter (FR-070 form).
- Rename current `getRecentDevelopmentActivity` body → **`…Google`**, and add the
  outage signature: `if (!results.some((r) => r.status === 'fulfilled')) return
  null;` right after `Promise.allSettled`.
- Add **`getRecentDevelopmentActivityOSM(lat, lng)`**: cache → one `searchOSMPOIs`
  union (`withTags:true`, radius `DEVELOPMENT_ACTIVITY_SEARCH_RADIUS_M`, limit 40)
  → skip disused/abandoned → `categorizeOSMCommercialPOI` → group by type →
  top-2-per-type → flatten → name-dedupe (case-insensitive) → sort by
  `distanceMiles` → top-6, each `{name, label, icon, distanceMiles, source:'osm'}`
  → cache → return array (or `[]`).
- Add public **`getRecentDevelopmentActivity`** = `sourceChain([google, osm], null,
  { label:'growth-commercial', log: chainLog(...) })` with `isValid: Array.isArray`
  per source; return `picked ? picked.value : []`.
- `getGrowthAndDevelopment` still calls `getRecentDevelopmentActivity(lat,lng)` at
  `:120` — no change.
- `module.exports`: add `getRecentDevelopmentActivityGoogle`,
  `getRecentDevelopmentActivityOSM` (keep `getRecentDevelopmentActivity`).

## Task 4 — SOURCES (`src/modules/growth/data.js`)
- Repoint `google-places-development.run` → `getRecentDevelopmentActivityGoogle`;
  `isValid: Array.isArray` (now meaningful — null on outage fails). Keep probe.
- Add `osm-commercial-fallback` (provider `osm`, coverage `some`, run → OSM impl,
  `isValid: Array.isArray`, no probe) right after the Google descriptor.

## Task 5 — template (`src/modules/growth/template.js`)
- Add helper `commercialSourceLabel(establishments)` →
  `establishments?.[0]?.source === 'osm' ? 'OpenStreetMap' : 'Google Places'`.
- `:383`: `sources.push(commercialSourceLabel(establishments))` (was
  `'Google Places'`).
- No other change; no CSS/classes.

## Task 6 — tests
- `tests/modules/growth/data.test.js` — add top-of-file mocks: `osmPlaces`
  (`mockSearchOSMPOIs`), `../../../src/cache` (`placesOsmCache` make-mock-cache),
  `../../../src/logger` (`logError: jest.fn()`). Import the 3 commercial fns.
  New `describe('getRecentDevelopmentActivity (Google→OSM chain, FR-071)')`:
  1. Google returns places → array, **OSM not called**, no `source`.
  2. Google all-rejected → OSM fallback → records tagged `source:'osm'`, ≤6,
     sorted, name-deduped.
  3. Google fulfilled-but-empty → `[]`, **OSM not called**.
  4. Both empty/down → `[]`.
  5. `getRecentDevelopmentActivityOSM`: top-2-per-type variety + top-6 cap +
     disused skip + dedupe.
  6. Filter passed to `searchOSMPOIs` is tag-only and includes `shop`/`amenity`
     clauses (CONSTRAINT-004 guard).
- New `tests/modules/growth/logic.test.js` *(or extend if exists)* —
  `categorizeOSMCommercialPOI` maps all 6 types; unmatched → null.
- `tests/modules/growth/template.test.js` — sources list flips to "OpenStreetMap"
  when `establishments[0].source==='osm'`, "Google Places" otherwise. (Check the
  builder the existing tests exercise.)

## Task 7 — verify (Phase 4 close)
- `npx jest` full green.
- Keyless live Overpass check of `getRecentDevelopmentActivityOSM` across the 5
  test addresses (space calls — Overpass etiquette): sane categorized commercial
  POIs; **Jeffersonville IN** returns IN-side establishments.
- Spot-check the Google path unchanged if a key is present.

## Risks / unknowns
- **logic.test.js may not exist** — create it if absent (small, focused).
- **Rural sparsity** (Harlan) — OSM may return `[]` where Google found chains;
  acceptable (fallback only on outage; empty → same "lower density" narrative).
- **Label/icon drift** — guarded by sourcing them from `COMMERCIAL_DEV_TYPES`.
