# FR-067 — Walkability OSM cost-resilience fallback — Specification

*Phase 2. Module: `walkability`. Pattern: FR-066 (Google→OSM source-chain).*

## Goal

When Google Places is unavailable (quota outage / cost cap), compute the
walkability proxy from OpenStreetMap instead of returning a misleading
`score: 0`. Keep the chapter honest about which source produced the number.

## Public contract (unchanged signature)

`getWalkabilityScore(lat, lng)` remains the orchestrator entry. It becomes a
`sourceChain`: **Google primary → OSM fallback**. Google short-circuits the
chain (no Overpass call) whenever it succeeds.

Return shape (additive — existing fields preserved):
```
{ score, category, destinations, isProxy: true, source: 'google' | 'osm' }
```
- `source` is the new field. Template reads it for the provenance disclaimer.
- On both-down: return a renderable degraded object
  `{ score: null, category: <unknown band>, destinations: [], isProxy: true, source: 'unavailable' }`
  so the chapter still renders an actionable Walk Score pointer (CONSTRAINT-015),
  rather than vanishing.

## Inputs

- `lat`, `lng` (numbers).

## Behaviour

### Google source (`getWalkabilityScoreGoogle`)
- Same 5 `placesNearby` calls, same scoring, same destinations as today.
- **Change:** track fulfilled vs rejected. If **every** call rejected → return
  `null` (outage signature → chain falls through to OSM, monitor sees red).
  If ≥1 fulfilled → return the scored object (a genuine rural `score: 0` is
  valid and non-null). Tag `source: 'google'`.

### OSM source (`getWalkabilityScoreOSM`)
- **One** `searchOSMPOIs` call with all 5 walk-type filters unioned, radius
  `WALKABILITY_SEARCH_RADIUS_M` (800 m), `withTags: true`, generous `limit`
  (e.g. 60 — enough to count density, capped).
- Categorize each returned POI via `categorizeOSMWalkPOI(tags)` (logic.js) into
  one of the 5 `WALK_TYPES` (or null → discard). Uncategorizable POIs ignored.
- Score with the **same** weight rule as Google (count 0 → 0; ≤2 → half; else
  full), capped at 100. `category = getWalkCategory(score)`.
- `destinations`: up to 2 nearest per category, `{ label, icon, name,
  distanceMiles, walkMinutes }` — identical shape to the Google path.
- Return `null` if the Overpass call yields zero categorizable POIs (so the
  chain can fall to the degraded floor). Tag `source: 'osm'`.
- Cache: `placesOsmCache` key `walk:osm:${lat},${lng}` (short TTL, reuse).

### sourceChain wiring
```
google: isValid = r != null && typeof r.score === 'number'
osm:    isValid = r != null && typeof r.score === 'number'
```
Both fail → return the degraded `source: 'unavailable'` object (not throw —
walkability is non-safety; CONSTRAINT-015 wants a renderable actionable card).

## New constants (`utils/constants.js`)

```
OSM_WALK_FILTERS = {
  grocery:    ['["shop"~"supermarket|grocery"]'],
  restaurant: ['["amenity"="restaurant"]'],
  transit:    ['["public_transport"~"station|platform"]', '["highway"="bus_stop"]',
               '["railway"~"station|tram_stop"]'],
  park:       ['["leisure"="park"]'],
  pharmacy:   ['["amenity"="pharmacy"]'],
}
```
- Tag-only (CONSTRAINT-004 ✓). Maps 1:1 to the existing `WALK_TYPES` order so
  weights/labels/icons are reused, not duplicated.
- Radius reuses existing `WALKABILITY_SEARCH_RADIUS_M = 800`.

## logic.js additions

- `categorizeOSMWalkPOI(tags)` → `'grocery'|'restaurant'|'transit'|'park'|'pharmacy'|null`.
  Pure tag inspection, mirrors `OSM_WALK_FILTERS`. The single place the tag→
  category rule lives (CONSTRAINT-009: business rule out of data.js where
  practical; the count→weight math stays parity-with-Google in data.js).

## template.js change

- Provenance-aware disclaimer: when `walk.source === 'osm'`, the two disclaimer
  lines read "estimated from OpenStreetMap data" (community-mapped, may be less
  complete than commercial data) instead of "Google Places". When
  `source === 'unavailable'`, render the score band as unknown and lead with the
  Walk Score / Street View research pointers (CONSTRAINT-015 actionable floor).
- No inline styles, no new visual decisions (CONSTRAINT-008).

## SOURCES descriptors

- Keep the Google descriptor pointing at `getWalkabilityScoreGoogle` directly
  (monitor reports Google specifically; the swallow-to-empty→null change means
  the existing `probe` is now backed by a fetcher that can actually fail —
  monitor accuracy improves).
- Add an OSM descriptor → `getWalkabilityScoreOSM`, `provider: 'osm'`,
  `coverage: 'some'`, no probe (a miss is informational, like FR-066).

## Edge cases

| Case | Expected |
|---|---|
| Google fully down, OSM has POIs | OSM score, `source: 'osm'`, provenance disclaimer |
| Google fully down, OSM empty/down | degraded `source: 'unavailable'`, actionable card |
| Google partial (some types reject) | Google object (non-null), `source: 'google'` |
| Genuine rural desert (Google up, 0 POIs) | `score: 0`, `source: 'google'` (not outage) |
| OSM returns POIs with no `name` | already filtered by `searchOSMPOIs` |
| OSM POI matches no category | discarded by `categorizeOSMWalkPOI` |

## Acceptance criteria

1. Google up → behaviour byte-identical to today plus `source: 'google'`; no
   Overpass call made.
2. All 5 Google calls reject → OSM path runs; if POIs found, valid score with
   `source: 'osm'`.
3. Both down → renderable degraded object, chapter still shows actionable Walk
   Score pointer; no throw, no empty section.
4. `categorizeOSMWalkPOI` maps each filter's representative tags correctly and
   returns null for unrelated tags.
5. No brand/chain names anywhere (CONSTRAINT-004); no inline styles
   (CONSTRAINT-008); tag→category rule in logic.js (CONSTRAINT-009 spirit).
6. Tests cover all of the above; Jeffersonville IN included; all 5 test
   addresses pass an end-to-end render. All existing suites stay green.
