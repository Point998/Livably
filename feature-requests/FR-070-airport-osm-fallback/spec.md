# FR-070 — Sensory Airport OSM cost-resilience fallback — Specification

*Phase 2. Module: `sensory`. Pattern: FR-069 recreation (Google primary → OSM
fallback via `sourceChain`), but **simpler** — airports are already straight-line
(haversine) on both paths, so there is no drive-time→distance provenance gap and
**no narrative rewrite**.*

## Goal

When Google Places is unavailable, the Sensory "What You'll Hear" airport finding
falls back to OpenStreetMap (`aeroway=aerodrome`) instead of vanishing. The
fallback returns the identical record shape and distance basis, so the existing
miles-based narrative renders unchanged — only the **source label** flips to
OpenStreetMap (honest provenance).

## Critical subtlety — `null` is a valid Google answer

Unlike recreation (which *throws* on no-result), `getAirportData` **returns `null`
for "no airports within 20 mi"** — a legitimate, common rural outcome — and only
*throws* on a real failure (Places quota/network error propagating from
`placesNearby`). The chain must therefore distinguish them:

- Google returns **array** → use it (airports found).
- Google returns **null** → *valid Google answer* (no airports). **Do NOT fall
  through to OSM** — short-circuit, fire no Overpass call, record no degradation.
- Google **throws** (outage) → fall through to OSM.

This is encoded by the Google source's `isValid` accepting **null-or-array**
(only a thrown error is a miss). Mirrors the existing `google-places-airports`
`isValid` rationale (`data.js:307-310`).

## Public contract

`getAirportData(lat, lng)` becomes a `sourceChain`: **Google primary → OSM
fallback**. Returns `picked.value` (array **or** null) — null only when both the
Google call threw and OSM found nothing/threw.

Record shapes (both already straight-line miles):
- Google (unchanged): `{ name, distanceMiles, lat, lng }`.
- OSM: `{ name, distanceMiles, lat, lng, source: 'osm' }` — sorted ascending,
  capped at `AIRPORT_MAX_DISTANCE_MILES`.

The per-record `source: 'osm'` marker is the **provenance carrier** (decision 2).
`proximitySource: 'osm-straightline'` is deliberately NOT used — Google is *also*
straight-line here, so that flag would mislabel both paths. Google records keep
no `source` field (absence = Google, the default).

## Behaviour

- `getAirportDataGoogle(lat, lng)` — today's `getAirportData` body verbatim
  (`placesNearby type:'airport'`, `NON_AIRPORT_RE`/`AIRPORT_RE` filter, distance
  cap, sort). Throws on Places error, returns null on legit-empty.
- `getAirportDataOSM(lat, lng)` —
  `searchOSMPOIs(lat, lng, { filters: OSM_AIRPORT_FILTERS, radiusM:
  AIRPORT_SEARCH_RADIUS_M, limit: 5 })`; map each to
  `{ name, distanceMiles, lat, lng, source: 'osm' }`; filter
  `distanceMiles <= AIRPORT_MAX_DISTANCE_MILES`; sort ascending; return the array
  or `null` if empty. Never throws on empty (returns null); a fetch failure inside
  `searchOSMPOIs` already yields `[]` → null.
- `getAirportData(lat, lng)` —
  `sourceChain([{name:'google', run:..., isValid: nullOrArray},
  {name:'osm', run:..., isValid: nullOrArray}], null,
  { label: 'sensory-airport', log: chainLog('getAirportData', \`${lat},${lng}\`) })`;
  return `picked ? picked.value : null`. Google short-circuits (no Overpass) on
  any non-throw.

`chainLog` adapter (FR-069 `recreation/data.js:37`) is added to `sensory/data.js`
so miss/error visibility flows through the structured logger and stays quiet in
tests. The FR-068 degradation ledger is recorded automatically inside
`sourceChain` — zero extra wiring.

## OSM tag filter (decision 1) — `utils/constants.js`

```js
// FR-070 — Sensory airport OSM fallback. Tag-only (CONSTRAINT-004). aeroway=
// aerodrome is the airfield polygon; out center → centroid. Exclude private-type
// and private/no-access strips (match the Google AIRPORT_RE intent of audible
// public/GA/military traffic). Military airbases are KEPT (AIRPORT_RE includes
// "air force base"/"afb"; they are very much audible). Searched at the 32 km
// airport radius, not the 8 km generic POI radius.
const OSM_AIRPORT_FILTERS = [
  '["aeroway"="aerodrome"]["aerodrome:type"!~"private"]["access"!~"private|no"]',
];
```
Radius reuses `AIRPORT_SEARCH_RADIUS_M` (32000). `OSM_POI_RADIUS_M` (8000) is too
small. Overpass `!~` / `!=` match elements *without* the tag too, so the common
untagged aerodrome is included; only explicitly-private ones are dropped.
Unnamed strips are dropped anyway (`searchOSMPOIs` requires `tags.name`).

Export `OSM_AIRPORT_FILTERS`.

## Template (`sensory/template.js`) — source label only

The narrative (`:196-223`), research table value/sort, key takeaway (`:347`), and
chapter glance (`:415-420`) all read `distanceMiles` / `name` / `lat` / `lng` —
**identical shape, no change**. Only the two hardcoded source labels flip:

- `:144` research-table source cell — currently `Google Places`.
- `:366` sources list — currently `Google Places (airports)`.

Add a small helper, e.g. `airportSourceLabel(airports)` → returns
`'OpenStreetMap'` when `airports?.[0]?.source === 'osm'`, else `'Google Places'`,
and use it at both sites (`… (airports)` suffix preserved at `:366`). No new CSS,
no class changes (CONSTRAINT-008).

## SOURCES descriptors (`sensory/data.js`)

- Repoint the existing `google-places-airports` descriptor's `run` to
  `getAirportDataGoogle` (not the full chain) so the monitor reports on Google
  *specifically*, not masked-green by the OSM fallback. Keep `googlePlacesProbe`,
  keep `isValid: (r) => r === null || Array.isArray(r)`.
- Add `osm-airport-fallback` — provider `osm`, coverage `some`, `run: (ctx) =>
  getAirportDataOSM(ctx.lat, ctx.lng)`, `isValid: (r) => r === null ||
  Array.isArray(r)`, no probe (mirrors FR-069 OSM descriptors).

Export `getAirportDataGoogle`, `getAirportDataOSM` (keep `getAirportData`).

## Edge cases

| Case | Expected |
|---|---|
| Google up, airports found | byte-identical to today; **no Overpass call**; label "Google Places" |
| Google up, no airports (null) | null short-circuits as valid; **no Overpass call**; no degradation recorded; "No airports within 20 miles" narrative |
| Google throws (quota), OSM has aerodrome | OSM array with `source:'osm'`; label flips to "OpenStreetMap"; FR-068 ledger records `fallback` |
| Google throws, OSM empty | null; "No airports within 20 miles" narrative; ledger records the osm result |
| Google throws, OSM throws | null (exhausted); same no-airport narrative |
| OSM returns a private aerodrome | excluded by `aerodrome:type!~private` / `access!~private` filter |
| OSM returns unnamed strip | dropped (`searchOSMPOIs` requires `name`) |

## Acceptance criteria

1. Google up (array or null) → unchanged behaviour + **no Overpass call** + no
   degradation event.
2. Google throws + OSM aerodrome present → valid array, each record
   `{name, distanceMiles, lat, lng, source:'osm'}`, sorted, capped at 20 mi.
3. Template renders the OSM source as **OpenStreetMap** at both label sites; miles
   narrative otherwise identical (no "null"/no fake minutes — N/A here anyway).
4. Both down → null → existing "No airports within 20 miles" narrative (no crash).
5. No brand names (CONSTRAINT-004); template edits reuse existing classes
   (CONSTRAINT-008); HTML stays out of data/logic (CONSTRAINT-009).
6. Tests cover `getAirportDataGoogle` (passthrough), `getAirportDataOSM` (shape,
   sort, cap, private-exclusion, empty→null), the chain (short-circuit on
   null/array, fallback on throw), and the template label flip. **Jeffersonville
   IN** in the live 5-address check. All existing suites green.

## Out of scope / deferred

- OSM result caching (the existing Google airport path is uncached; airports run
  once per report, not per-cell — matching keeps the diff minimal). Noted as a
  deferrable if Overpass load becomes a concern.
- FAA approach/departure-corridor detection (already deferred at FR-034 enh 5).
