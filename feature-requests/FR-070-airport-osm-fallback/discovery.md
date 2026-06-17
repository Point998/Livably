# FR-070 — Sensory Airport: Google→OSM cost-resilience fallback (A1)

## Phase 1 — Discovery (read-only)

### What this slice is
The next A1 cost-resilience slice: give the Sensory chapter's **airport** finding an
OpenStreetMap fallback so a Google Places quota outage degrades gracefully instead of
dropping the "What You'll Hear" airport narrative. Mirrors FR-066 (reachability),
FR-067 (walkability), FR-069 (recreation).

### How airports work today (verified)
- **Source:** Google Places only. `getAirportData(lat, lng)` in
  `src/modules/sensory/data.js:87` calls `googleMapsClient.placesNearby({ type: 'airport',
  radius: AIRPORT_SEARCH_RADIUS_M })`.
- **No fallback.** Unlike its sibling Sensory signals — road-noise (BTS→OSM at
  `data.js:106`), rail (OSM at `:153`), land-use (OSM at `:189`) — the airport call has
  **zero degradation path**. A Places outage = `null` = the airport narrative silently
  disappears. This is the gap.
- **Already registered** in `SOURCES` as `google-places-airports` (`data.js:305`), gated
  by `googlePlacesProbe`, `isValid` accepting null-or-array. No OSM descriptor exists yet.

### The contract (what the OSM path must return)
`getAirportData` returns an **array** sorted by distance, or `null`:
```
[{ name, distanceMiles, lat, lng }, …]   // haversine straight-line distance
```
Consumed in `src/modules/sensory/template.js` at: `:143` (research table, `airports[0]`),
`:196–223` ("What You'll Hear" narrative, uses `airports[0]`, `.length`, `.slice(1,3)`,
and `dirOf()` which needs `lat`/`lng`), `:347` (key takeaway), `:415–420` (chapter glance).

### Key discovery — this is the *cleanest* slice yet
**Airports are already straight-line (haversine) on the Google path too** — `getAirportData`
does NOT call Distance Matrix; it computes `haversineDistance` and the narrative speaks in
**miles**, never minutes. So unlike recreation/reachability (where the OSM fallback
introduced a drive-time→straight-line provenance gap needing `proximitySource:'osm-straightline'`
and "as-the-crow-flies" rewrites), the airport OSM fallback is a **drop-in on the same
distance basis and the same `{name, distanceMiles, lat, lng}` shape**. No narrative rewrite,
no proximity-mode branching in the template.

### What the OSM query looks like
- Tag: `aeroway=aerodrome` (CONSTRAINT-004 compliant — pure tag, no brand/name logic).
- Radius: reuse `AIRPORT_SEARCH_RADIUS_M` (32 km ≈ 20 mi). **Note:** the generic
  `OSM_POI_RADIUS_M` (8 km) is too small for airports — a dedicated radius is required.
- Aerodromes are mapped as large ways/relations (the airfield polygon); `out center` gives
  the centroid — consistent with how the Google result's point geometry is used.
- **Filtering concern:** `aeroway=aerodrome` includes private grass strips and heliports-ish
  fields that the Google path's `AIRPORT_RE`/`NON_AIRPORT_RE` regex currently shapes. OSM
  has structured tags for this — likely exclude `aerodrome:type=private` and `access=private`
  to keep the "audible commercial/GA traffic" intent. Decision for Phase 2 spec.
- `searchOSMPOIs` (`src/shared/osmPlaces.js`) already returns exactly `{name, lat, lng,
  distanceMiles}` sorted ascending — near-perfect helper. It defaults to limit 8; airports
  want the full sorted list (template shows up to 3), so limit ~5 is fine.

### Provenance threading (the one real design question)
The template **hardcodes** the source label `'Google Places (airports)'`
(`template.js:144`, `:366`). Honest-provenance rule (`[[project_honest_provenance]]`): when
the OSM fallback wins, that label must say OpenStreetMap. Because the template reads
`env.airports` directly (not the `sourceChain` return), the winning source must be threaded
onto the data — simplest: tag OSM records with a `source:'osm'` marker (or set it on the
array), and have the template swap the label when present. `proximitySource:'osm-straightline'`
is the wrong flag here since Google is *also* straight-line — would mislabel both paths.

### Wiring pattern (established, FR-069)
- Wrap `getAirportData` selection in `sourceChain([{name:'google',…},{name:'osm',…}], …)`
  with a `label:'sensory-airport'`, `chainLog` adapter → FR-068 degradation ledger flows
  automatically (sourceChain calls `recordDegradation` internally).
- Add an `osm-airport-fallback` descriptor to `SOURCES` (provider `osm`, coverage `some`)
  so the monitor reports on the Google source specifically, not masked-green by OSM.

### Constants needed
- New `OSM_AIRPORT_FILTERS` (or single filter) + reuse `AIRPORT_SEARCH_RADIUS_M` for the OSM
  radius. Add to `src/utils/constants.js` exports.

### Tests (CONSTRAINT-011)
- `tests/modules/sensory/data.test.js` already asserts the `airports` key. Add:
  Google-success path, Google-outage→OSM-fallback path (mock Overpass), both-down→null,
  OSM record shape/sort, private-aerodrome exclusion. Jeffersonville IN must be a case.
- All 5 test addresses.

### Risks / unknowns
1. **Private/grass-strip noise** in `aeroway=aerodrome` — needs a tag-based exclusion that
   matches the Google regex intent without brand names (CONSTRAINT-004). Resolve in spec.
2. **Provenance marker shape** — per-record `source` vs array-level — pick the least
   invasive for the four template read sites. Resolve in spec.
3. Low risk otherwise: same-basis distance means no narrative rewrite (the expensive part
   of FR-066/069 doesn't recur here).

### Recommendation
Proceed to Phase 2 (spec) as **FR-070-airport-osm-fallback**. This is the smallest,
lowest-risk A1 slice remaining because the distance basis already matches — the only new
decisions are the OSM tag-exclusion filter and the provenance marker.
