# FR-071 — Growth commercial: Google→OSM cost-resilience fallback (A1)

## Phase 1 — Discovery (read-only)

### What this slice is
The 6th A1 cost-resilience slice: give the Growth chapter's **commercial
development activity** finding an OpenStreetMap fallback so a Google Places quota
outage degrades gracefully instead of dropping the "Commercial Landscape Within
1.5 Miles" section. Mirrors FR-067 (walkability) — *not* FR-069/070 — because the
shape is a **multi-type Places union**, not a single-nearest lookup.

### How commercial activity works today (verified)
- **Source:** Google Places only. `getRecentDevelopmentActivity(lat, lng)`
  (`src/modules/growth/data.js:89`) fires one `placesNearby` per entry in
  `COMMERCIAL_DEV_TYPES` (6 types: shopping_mall, supermarket, department_store,
  gym, movie_theater, bank) within `DEVELOPMENT_ACTIVITY_SEARCH_RADIUS_M` (2400 m
  ≈ 1.5 mi), filters `business_status === 'OPERATIONAL'`, takes top 2 per type,
  dedupes by `place_id`, sorts by distance, returns top 6.
- **No fallback.** A Places outage = the whole commercial section + its research
  table + the "Commercial Landscape" narrative + a takeaway branch all vanish.
- **Already registered** in `SOURCES` as `google-places-development`
  (`data.js:139`), gated by `googlePlacesProbe`.

### The contract (what the OSM path must return)
`getRecentDevelopmentActivity` returns an **array** (possibly empty):
```
[{ name, label, icon, distanceMiles }, …]   // haversine straight-line, sorted, ≤6
```
Consumed in `src/modules/growth/template.js`: `:108`/`:129` (research table),
`:247`/`:324–345` ("Commercial Landscape" narrative + place cards — uses
`distanceMiles`, `name`, `icon`, `label`), `:371` (takeaway branch), `:383`
(sources list, hardcoded `'Google Places'`), plus the glance bar.

### This is the FR-067 walkability pattern — with two simplifications
**Same as walkability:** multi-type Google union; the **swallow-to-empty masking
bug is present** — `Promise.allSettled` returns `[]` on *total* failure, which is
indistinguishable from "no commercial nearby." The `google-places-development`
descriptor's `isValid: Array.isArray` accepts `[]`, so during a Google outage the
**monitor shows green** (exactly the bug FR-067 fixed for walkability at
`walkability/data.js:62`).

**Simpler than walkability (two ways):**
1. **No scoring** (CONSTRAINT-001) — walkability computes a 0–100 score with a
   weight rule; this is just a *list* of establishments. So the OSM path has no
   `weightForCount`, no `getWalkCategory`, no score assembly — just categorize →
   collect → sort → cap.
2. **Distance basis already matches** — the Google path uses `haversineDistance`
   (straight-line), and the narrative speaks in miles ("Within a half mile…"). So
   the OSM fallback is a drop-in on the same basis (like FR-070 airports): **no
   narrative rewrite**, only the source label flips.

### The OSM query (FR-067 mechanics, reused)
- One Overpass **union** call across commercial filters via `searchOSMPOIs(lat,
  lng, { filters, radiusM: DEVELOPMENT_ACTIVITY_SEARCH_RADIUS_M, withTags: true,
  limit: ~40 })` — then re-derive each POI's category from its tags (Overpass
  doesn't label the matching clause), mirroring `categorizeOSMWalkPOI`.
- New `categorizeOSMCommercialPOI(tags)` in `growth/logic.js` (the one place the
  tag→type rule lives; CONSTRAINT-004 tag-only) returning the matched type's
  `{label, icon}` or null. Tag mapping for the 6 types:
  | Google type | OSM tag |
  |---|---|
  | shopping_mall | `shop=mall` |
  | supermarket | `shop=supermarket` |
  | department_store | `shop=department_store` |
  | gym | `leisure=fitness_centre` (union `sport=fitness`) |
  | movie_theater | `amenity=cinema` |
  | bank | `amenity=bank` |
- New `OSM_COMMERCIAL_FILTERS` constant (the union clause list) + export. Searched
  at the existing 2400 m radius, not the 8 km generic POI radius.

### Provenance threading (decision, same as FR-070)
`establishments` is an array of records (like airports). Tag OSM records with a
per-record `source: 'osm'` marker; add a `commercialSourceLabel(establishments)`
helper to flip the hardcoded `'Google Places'` at `template.js:383` to
`'OpenStreetMap'`. (`[[project_honest_provenance]]`.) Not
`proximitySource:'osm-straightline'` — Google is also straight-line here.

### Wiring pattern (established)
- Rename current body → `getRecentDevelopmentActivityGoogle`; **add the outage
  signature** (`if (!results.some(fulfilled)) return null;`) so a real outage is
  null (→ chain reaches OSM, → monitor red) while a genuine empty area still
  returns `[]`.
- Add `getRecentDevelopmentActivityOSM`.
- Public `getRecentDevelopmentActivity` = `sourceChain([google, osm], …, { label:
  'growth-commercial', log: chainLog(...) })`. Validity: Google `isValid =
  Array.isArray` (null on outage fails → fallthrough); the public return is the
  picked array, or `[]` when both miss (keeps the renderer's empty-state intact).
- Repoint `google-places-development.run` → the Google impl; tighten its `isValid`
  so null (outage) fails (FR-067 parity); add `osm-commercial-fallback` descriptor.
- FR-068 degradation ledger flows automatically through `sourceChain`.

### Constants / cache
- `placesOsmCache` short-TTL caching as FR-067 (key `commercial:osm:${lat},${lng}`)
  — worthwhile here since it's a 6-clause union call.

### Tests (CONSTRAINT-011)
- `tests/modules/growth/data.test.js` — Google success (no OSM call, no source
  marker); all-Places-rejected → OSM fallback (records tagged `source:'osm'`,
  sorted, ≤6); both empty → `[]`; `categorizeOSMCommercialPOI` mapping correctness
  + tag-only guard (CONSTRAINT-004); top-6 cap. Jeffersonville IN.
- `tests/modules/growth/template.test.js` — sources list flips to "OpenStreetMap"
  when `establishments[0].source === 'osm'`.
- All 5 addresses; full suite green.

### Risks / unknowns
1. **`gym` tag ambiguity** — OSM uses `leisure=fitness_centre` (sometimes
   `amenity=gym`, `sport=fitness`); union a couple of clauses to catch it.
2. **OPERATIONAL has no OSM equivalent** — OSM POIs are assumed operational;
   optionally skip `disused:`/`abandoned:`-prefixed tags. Low stakes.
3. **Dedupe** — a single Overpass union dedupes by element id, so one mall mapped
   as both node+way could appear twice; dedupe by `name` (+ rounded coords) to be
   safe, mirroring the Google `place_id` dedupe intent.
4. **Sparse rural OSM commercial** (Harlan) — acceptable: fallback only fires on a
   Google outage, and empty → the same "lower commercial density" narrative a real
   no-result already produces. No worse than today (which is *nothing*).
5. **Variety vs nearest** — Google takes top-2-per-type then top-6 overall (forces
   category variety). Recommend mirroring that grouping in OSM rather than a raw
   nearest-6, for parity. Resolve in spec.

### Recommendation
Proceed to Phase 2 (spec) as **FR-071-commercial-osm-fallback**. Direct reuse of
the FR-067 walkability union+categorize machinery, minus the scoring — plus the
same swallow-to-empty observability fix that slice established.
