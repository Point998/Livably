# FR-067 — Walkability OSM cost-resilience fallback — Discovery

*Phase 1 (read-only). Track A1 continuation. Extends the FR-066 Google-POI→OSM
fallback pattern to the Walkability chapter — the next single-source Google
module and the smallest remaining OSM reuse (one Overpass union call).*

## What exists

- **`src/modules/walkability/data.js`** — `getWalkabilityScore(lat, lng)` is the
  sole data entry. It fires 5 `placesNearby` calls (one per `WALK_TYPES` entry:
  grocery, restaurant, transit_station, park, pharmacy) at radius 800 m
  (`WALKABILITY_SEARCH_RADIUS_M`), via `Promise.allSettled`. Score = sum of
  per-type weights: 0 if count 0, half-weight if count ≤ 2, full weight
  otherwise; capped at 100. Up to 2 nearest POIs per type become `destinations`
  with `walkMinutes = max(1, round(distanceMiles * 20))`. Returns
  `{ score, category, destinations, isProxy: true }`. **Never throws.**
- **`SOURCES`** descriptor (one Google entry) with `probe: googlePlacesProbe` and
  an `isValid` that only checks *shape* — because the fetcher swallows failures
  to a well-formed empty object, so a probe (not isValid) gates reachability.
- **`logic.js`** — `getWalkCategory(score)` → label/color/description bands.
- **`template.js`** — `buildWalkabilityHTML(walk)`. Renders the score band,
  destinations, pedestrian-environment, L3 deep dive, L4 research table.
  Disclaimers hardcode **"Source: Google Places API"** / "using Google Places
  data" (template.js:158, 286).
- **Orchestrator** (`src/chapters.js:116`) calls `getWalkabilityScore(lat, lng)`
  inside `Promise.allSettled`; `val()` unwraps; template gets `null` on failure
  (`buildWalkabilityHTML(null)` → `''`).

## Reusable primitives (the cheap path)

- **`shared/osmPlaces.js` `searchOSMPOIs(lat, lng, { filters, radiusM, limit })`**
  — builds ONE Overpass union query from tag-only filters (CONSTRAINT-004 clean),
  returns `[{ name, lat, lng, distanceMiles }]` sorted by haversine. Never throws.
- **`shared/overpass.js` `fetchOverpass`** — endpoint rotation, UA header
  (the 406 fix), 429/406 spacing.
- **`shared/sourceChain.js` `sourceChain(...)`** — ordered google→osm with
  per-source `isValid` and a structured-log sink (NR-004 observability).
- **`OSM_POI_FILTERS`** already has `grocery` and `pharmacy`. **Missing:**
  restaurant, transit, park tag filters. `OSM_POI_RADIUS_M = 8000` is the
  *reachability* (drive-to-nearest) radius — **walkability needs 800 m.**

## Findings — what's missing / what could break

1. **Swallow-to-empty defeats a naïve fallback AND hides outages.**
   `getWalkabilityScore` returns `score: 0, destinations: []` even when all 5
   Places calls reject. A sourceChain with a shape-only `isValid` would treat
   that as a valid Google result and **never reach OSM**. Same root cause makes
   the monitor green during a Places outage (the NR-004 "silent failures keep
   hiding" watch-item). **Fix:** the Google impl must return `null` when *every*
   Places call rejects (outage signature), while still returning a valid
   `score: 0` object when calls succeed but the area is a genuine walk desert
   (rural). Tracking fulfilled-vs-rejected count distinguishes the two.

2. **Category attribution.** `searchOSMPOIs` returns a flat list without the
   matched tags, so a single union call can't tell which POI is a park vs a
   pharmacy — but the weighted score needs per-category counts. Options:
   (a) one union call + an opt-in `withTags` so the caller re-derives category
   from each POI's tags; (b) 5 separate calls. (b) hammers Overpass 5× per
   address against the rate-limit etiquette watch-item. **Lean: (a)** — one call,
   minimal backward-compatible enhancement to the shared primitive.

3. **OSM tag map for the 5 walk types** (CONSTRAINT-004 tag-only):
   grocery `shop~supermarket|grocery` (exists) · dining `amenity=restaurant` ·
   transit `public_transport=station|platform` + `highway=bus_stop` +
   `railway~station|tram_stop` · park `leisure=park` · pharmacy
   `amenity=pharmacy` (exists). Categorization is a **business rule → logic.js**.

4. **Provenance (honest-provenance principle).** OSM score will differ from
   Google's (sparser data) and uses no API. Template disclaimers hardcode
   "Google Places". Need a `source: 'google'|'osm'` field the template reads to
   swap the disclaimer to "estimated from OpenStreetMap data" — modeled-vs-
   measured callout, no manufactured precision.

5. **No cache today.** Walkability has no cache (Google quota permitting).
   Reachability's OSM fallback uses `placesOsmCache` (1 h TTL) so a cell recovers
   to Google quickly after quota reset without re-hammering Overpass. Decision
   for spec: add a short-TTL OSM cache key here too.

6. **CONSTRAINT-009 pre-existing note.** Scoring/weights already live in
   `data.js` (the Google impl), not logic.js. To minimize blast radius I'll keep
   parity (score in data.js) rather than refactor the Google path; categorization
   (the new business rule) goes in logic.js. Flagging the pre-existing concern,
   not fixing it in this FR.

7. **Constraints in scope:** 004 (tag-only ✓ via searchOSMPOIs), 011 (tests +
   Jeffersonville IN regression), 015 (both-down graceful degradation — keep the
   chapter renderable with an actionable Walk Score fallback rather than vanishing).

## Blast radius

`data.js` (refactor entry → google/osm + sourceChain), `logic.js` (+categorize),
`constants.js` (+walk OSM filters + radius), `template.js` (provenance-aware
disclaimer), `cache.js` (reuse `placesOsmCache` or add a walk OSM cache),
tests. No orchestrator signature change (`getWalkabilityScore(lat,lng)` stays
the public entry).
