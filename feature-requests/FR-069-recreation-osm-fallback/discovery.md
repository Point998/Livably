# FR-069 — Recreation OSM cost-resilience fallback — Discovery

*Phase 1 (read-only). Track A1, fourth slice. Extends the FR-066 reachability
pattern (Google nearest → OSM straight-line) to the Recreation module. Lands in
a system now instrumented by FR-068, so its fallbacks are observable from birth.*

## What exists

- **`src/modules/recreation/data.js`** — 5 single-POI "find nearest" Google
  functions: `findNearestPark` (type `park`, with `isValidPark` type filter),
  `findNearestCoffeeShop` (type `cafe`, drive-time sorts top
  `COFFEE_SHOP_CANDIDATE_COUNT`), `findNearestLibrary` (`library`),
  `findNearestRecreationCenter` (`community_center`), `findNearestPostOffice`
  (`post_office`). Each returns `{ name, address, location, driveTimeMinutes }`
  or throws. `placesCache`-backed. **No `logic.js`, no cell** (exact per-address).
- **SOURCES** — a single descriptor pointing at `findNearestPark` only (the
  others aren't individually monitored).
- Called directly in **`reportBuilder.js`** inside the `Promise.allSettled`
  fan-out (now wrapped in `runWithLedger`, FR-068) — so Recreation sourceChains
  will be captured by the degradation ledger automatically.
- Rendered in **`reachability/template.js` `buildAdditionalServicesCardHTML`**
  (recreation has no template of its own).

## This is the reachability pattern, not the walkability one

Recreation is 5 instances of "nearest single amenity" — structurally identical
to reachability's pharmacy/gas (`findNearestPharmacyOSM`/`GasStationOSM`):
`searchOSMPOIs(filters, limit: 1)` → `osmRecord(p)` →
`{ ..., driveTimeMinutes: null, distanceMiles, proximitySource:
'osm-straightline' }`. **No categorization needed** → the walkability `withTags`
+ `categorizeOSMWalkPOI` helper does NOT apply, and the "promote a shared
categorized-OSM helper" question resolves to **no** (the hypothetical second
caller never materialized — Recreation wants per-category single results, not a
unioned scored set). No premature abstraction.

## Findings — what's missing / what could break

1. **Renderer is not straight-line-safe in two spots.** `buildDestSection`
   (used for the park/coffee grid items) already handles OSM records via the
   FR-066 helpers `isStraightLine` / `formatProximity` / `proximityPhrase`. But
   `buildAdditionalServicesCardHTML` renders `driveTimeMinutes` **raw** in:
   - the narrative prose (coffee/park `${x.driveTimeMinutes} minutes away`, and
     the `<= 5` branch — a `null` makes the comparison false *and* prints
     "null minutes"), lines 414–427;
   - the civic-items row (`${c.driveTimeMinutes} min`), line 440.
   These must use the existing helpers so an OSM record renders as
   "~N mi (straight-line)" instead of "null minutes". `elementarySchool` (from
   the schools module, no OSM fallback this slice) stays non-null → its narrative
   branch is unaffected, but I'll keep it guarded for safety.
2. **OSM filters missing** for the 5 recreation categories (tag-only,
   CONSTRAINT-004): park `leisure=park`, coffee `amenity=cafe`, library
   `amenity=library`, rec center `leisure=sports_centre` + `amenity=
   community_centre`, post office `amenity=post_office`.
3. **No `osmRecord` shaper in recreation** — reachability's lives in its own
   data.js (module-private). Mirror it locally (small, keeps modules decoupled).
4. **Cache** — reuse `placesOsmCache` (short TTL) with `*:osm:` keys, like
   reachability.

## Reuse

`searchOSMPOIs` (limit 1), `sourceChain`, `placesOsmCache`, `OSM_POI_RADIUS_M`
(8 km — "nearest single amenity" radius, same as reachability), the structured
`chainLog`→`logError` sink, and the FR-066 template helpers already in
`reachability/template.js`.

## Constraints

- **004** — tag-only OSM filters, no brand/chain names.
- **011** — tests per new OSM function + the straight-line renderer path;
  Jeffersonville IN in the live check.
- **015** — both-down keeps `buildDestSection`'s existing "Data not available →
  Search Google Maps" actionable floor (unchanged).
- **008/009** — renderer edits stay in template.js using existing classes; no
  business rules leak into data.js beyond the established osmRecord shape.

## Blast radius

`recreation/data.js` (5 fns split google/osm + sourceChain), `constants.js`
(`OSM_RECREATION_FILTERS`), `reachability/template.js`
(`buildAdditionalServicesCardHTML` straight-line handling), tests. No
reportBuilder signature change (functions keep `findNearestX(originLatLng)`).
