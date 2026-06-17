# FR-071 — Growth commercial OSM cost-resilience fallback — Summary

*Phase 4 complete. Track A1, 6th cost-resilience slice (after FR-066 reachability,
FR-067 walkability, FR-069 recreation, FR-070 airports).*

## What shipped

The Growth chapter's commercial-activity finding — previously **Google Places only,
no fallback** — now degrades to OpenStreetMap when Google Places is unavailable,
instead of dropping the entire "Commercial Landscape Within 1.5 Miles" section
(narrative + place cards + research table + a takeaway branch). Wired through the
FR-065 `sourceChain`, so FR-068 degradation observability flows for free.

## Pattern

This is the **FR-067 walkability shape** (multi-type Google Places *union* → one
Overpass union → categorize-by-tags), **minus two things**:
1. **No scoring** (CONSTRAINT-001) — it's a list of establishments, not a score, so
   the OSM path is just categorize → group → cap (no weight rule, no score).
2. **No narrative rewrite** — the Google path already used straight-line
   (haversine) miles and the narrative speaks in miles, so the OSM fallback is a
   drop-in on the same basis (like FR-070); only the source label flips.

## Changes

- **`src/utils/constants.js`** — new `OSM_COMMERCIAL_FILTERS` (8 tag-only clauses,
  CONSTRAINT-004): `shop=mall|supermarket|department_store`,
  `leisure=fitness_centre`/`sport=fitness`/`amenity=gym` (gym unioned across OSM's
  three inconsistent tags), `amenity=cinema|bank`. Searched at the existing 2.4 km
  `DEVELOPMENT_ACTIVITY_SEARCH_RADIUS_M`.
- **`src/modules/growth/logic.js`** — `categorizeOSMCommercialPOI(tags)`: the one
  tag→commercial-type rule (mirrors `categorizeOSMWalkPOI`); label/icon sourced
  from `COMMERCIAL_DEV_TYPES` so they never drift from the Google path; skips
  `disused:`/`abandoned:`/`razed:`/`demolished:`-prefixed POIs (operational proxy).
- **`src/modules/growth/data.js`** — split `getRecentDevelopmentActivity` into
  `…Google` (verbatim + outage signature) + `…OSM` (Overpass union → categorize →
  top-2-per-type → name-dedupe → sort → top-6, `source:'osm'`, short-TTL cached);
  public fn is now a `sourceChain([google, osm])`. Repointed
  `google-places-development` SOURCES descriptor to the Google impl + added
  `osm-commercial-fallback`. Added `chainLog` adapter.
- **`src/modules/growth/template.js`** — `commercialSourceLabel(establishments)`
  flips the hardcoded "Google Places" source label to "OpenStreetMap" when records
  carry `source:'osm'`. No CSS/class changes.

## Observability fix (FR-067 parity)

`getRecentDevelopmentActivityGoogle` now returns **null on total outage**
(`!results.some(fulfilled)`) instead of swallowing to `[]`. Before, a Google
outage produced `[]` — indistinguishable from a genuinely empty commercial area —
and the source monitor showed **green during an outage**. Now null fails the
descriptor's `isValid: Array.isArray`, so the monitor goes red and the chain falls
through to OSM; a genuinely empty area still returns `[]` (short-circuits, no
needless Overpass call).

## Provenance marker

Per-record `source:'osm'` — not `proximitySource:'osm-straightline'` (Google is
also straight-line here, so that would mislabel both paths).
(`[[project_honest_provenance]]`.)

## Tests (CONSTRAINT-011)

- `growth/logic.test.js` — `categorizeOSMCommercialPOI`: all 6 types, gym union,
  null for unmatched/missing/non-operational tags.
- `growth/data.test.js` — chain: Google-success (no OSM call, no source marker),
  legit-empty short-circuit, full-outage→OSM fallback (source-tagged, sorted),
  both-down→[], outage-null observability, OSM top-2-per-type + name-dedupe + cap +
  uncategorized-skip, tag-only/withTags guard (CONSTRAINT-004).
- `growth/template.test.js` — label flips to "OpenStreetMap" on OSM records.
- **Full suite: 1,598 passed / 83 suites green** (1,585 + 13 new).

## Live verification — keyless OSM path, all 5 test addresses

| Address | OSM commercial (categorized) |
|---|---|
| Georgetown KY | 5 — Whitaker Bank, Central Bank, Save-A-Lot, Big Lots, Theaters of Georgetown |
| Harlan KY | 2 — Commercial Bank, Food City (rural; appropriately sparse) |
| Louisville KY | 6 (capped) — PNC, Chase, Spa & Fitness, Video Concept Art Theatre, Bourbon Barrel Foods, … |
| Bozeman MT | 6 (capped) — First Interstate, Opportunity Bank, 2× Co-op grocery, Pure Barre, The Ridge |
| Jeffersonville IN | 2 — Save-A-Lot, New Washington State Bank (IN-side) |

All sane, categorized, with top-2-per-type variety visible (e.g. Bozeman: 2 banks +
2 grocery + 2 fitness). Jeffersonville returns Indiana-side establishments.

## Workflow note

Full 4-phase workflow followed (discovery → spec → plan → implementation). No
phases skipped. No new npm packages.

## Remaining A1 slices

Non-Google singles: USDA soil, USGS elevation, Census vintage.
