# FR-070 — Sensory Airport OSM cost-resilience fallback — Summary

*Phase 4 complete. Track A1, 4th cost-resilience slice (after FR-066 reachability,
FR-067 walkability, FR-069 recreation).*

## What shipped

The Sensory chapter's airport finding — previously **Google Places only, no
fallback** — now degrades to OpenStreetMap (`aeroway=aerodrome`) when Google
Places is unavailable, instead of silently dropping the "What You'll Hear" airport
narrative. Wired through the FR-065 `sourceChain` primitive, so FR-068 degradation
observability flows for free.

## Why this slice was the cleanest yet

Airports never used Distance Matrix — `getAirportData` already computed
**straight-line (haversine)** miles and the narrative speaks in miles, not minutes.
So the OSM fallback is a drop-in on the *identical distance basis and record
contract*: no "as-the-crow-flies" narrative rewrite (the expensive part of
FR-066/069 did not recur). The template touched only **two hardcoded source-label
strings**.

## Changes

- **`src/utils/constants.js`** — new `OSM_AIRPORT_FILTERS` (tag-only,
  CONSTRAINT-004): `aeroway=aerodrome` excluding `aerodrome:type=private` and
  `access=private|no`. Military airbases kept (audible; `AIRPORT_RE` includes
  "afb"). Searched at `AIRPORT_SEARCH_RADIUS_M` (32 km), not the 8 km POI radius.
- **`src/modules/sensory/data.js`** — split `getAirportData` into
  `getAirportDataGoogle` (verbatim prior logic) + `getAirportDataOSM`
  (searchOSMPOIs → `{name, distanceMiles, lat, lng, source:'osm'}`, sorted, capped
  ≤ 20 mi); public `getAirportData` is now a `sourceChain([google, osm])`. Added
  `chainLog` adapter. `google-places-airports` SOURCES descriptor repointed to the
  Google impl (monitor reports on Google specifically); added `osm-airport-fallback`
  descriptor.
- **`src/modules/sensory/template.js`** — `airportSourceLabel(airports)` helper
  flips the two hardcoded "Google Places" labels to "OpenStreetMap" when the
  winning record carries `source:'osm'` (honest provenance). No CSS/class changes.

## Key design decision — `null` is a valid Google answer

`getAirportData` returns `null` for "no airports within 20 mi" (common rural
outcome), and only *throws* on a real Places error. So the chain's Google
`isValid` accepts **null-or-array**: a legit-empty result short-circuits with no
Overpass call and no false degradation event; only a thrown error falls through to
OSM. Copying the recreation throw-pattern blindly would have fired Overpass and
logged bogus "degradations" on every rural address.

## Provenance marker

Per-record `source:'osm'` — deliberately NOT `proximitySource:'osm-straightline'`,
because Google is *also* straight-line here and that flag would mislabel both
paths. (`[[project_honest_provenance]]`.)

## Tests (CONSTRAINT-011)

- `tests/modules/sensory/data.test.js` — new `getAirportData` chain block:
  Google-success (no OSM call, no source marker), legit-empty short-circuit (OSM
  not called), Google-throw→OSM-fallback (source tagged, sorted, capped),
  both-down→null, tag-only/private-exclusion guard (CONSTRAINT-004), OSM cap, and
  Google passthrough.
- `tests/modules/sensory/template.test.js` — provenance label: Google → "Google
  Places (airports)"; OSM → "OpenStreetMap (airports)".
- **Full suite: 1,585 passed / 83 suites green** (1,575 + 10 new).

## Live verification — keyless OSM path, all 5 test addresses

| Address | Nearest OSM aerodrome | Dist |
|---|---|---|
| Georgetown KY | Georgetown-Scott County Regional Airport | 6.9 mi |
| Harlan KY | Tucker-Guthrie Memorial Airport | 2.3 mi |
| Louisville KY | Bowman Field | 5.6 mi |
| Bozeman MT | Edsall Field | 3.3 mi |
| Jeffersonville IN | Haps Airport (IN-side) | 4.5 mi |

All sane, locally-correct, `source:'osm'`. Jeffersonville returns an Indiana-side
field (no cross-state surprise; CONSTRAINT-006 governs schools/hospitals/urgent-
care/pharmacy, not airports — nearest-by-distance is correct here).

## Workflow note

Full 4-phase workflow followed (discovery → spec → plan → implementation). No
phases skipped. No new npm packages.

## Deferred

- OSM result caching (existing airport path is uncached; runs once per report, not
  per-cell — kept the diff minimal). Revisit if Overpass load becomes a concern.
- FAA approach/departure-corridor detection (already deferred at FR-034 enh 5).
