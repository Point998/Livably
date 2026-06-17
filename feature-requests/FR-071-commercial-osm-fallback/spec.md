# FR-071 — Growth commercial OSM cost-resilience fallback — Specification

*Phase 2. Module: `growth`. Pattern: FR-067 walkability (multi-type Google union →
one Overpass union → categorize-by-tags), **minus the scoring** (CONSTRAINT-001 —
this is a list, not a score) and **minus the narrative rewrite** (distance basis
already matches — both paths are straight-line miles, like FR-070).*

## Goal

When Google Places is unavailable, the Growth chapter's "Commercial Landscape
Within 1.5 Miles" finding falls back to OpenStreetMap instead of vanishing. Same
record shape, same straight-line distance basis, so narrative/cards/table render
unchanged — only the source label flips to OpenStreetMap (honest provenance). Also
fixes the swallow-to-empty observability bug (FR-067 parity).

## Public contract

`getRecentDevelopmentActivity(lat, lng)` becomes a `sourceChain`: **Google primary
→ OSM fallback**, returning the picked array, or `[]` when both miss (the
renderer's empty-state — "lower commercial density" narrative — stays intact;
CONSTRAINT-015).

Record shapes (both straight-line `haversineDistance` miles, sorted ascending, ≤6):
- Google (unchanged): `{ name, label, icon, distanceMiles }`.
- OSM: `{ name, label, icon, distanceMiles, source: 'osm' }`.

`source: 'osm'` is the provenance carrier (NOT `proximitySource:'osm-straightline'`
— Google is also straight-line here).

## Behaviour

### `getRecentDevelopmentActivityGoogle(lat, lng)`
Today's `getRecentDevelopmentActivity` body verbatim (per-type `placesNearby`,
`business_status==='OPERATIONAL'`, top-2-per-type, `place_id` dedupe, sort, top-6)
— **plus the FR-067 outage signature**: after `Promise.allSettled`,
```
if (!results.some((r) => r.status === 'fulfilled')) return null;
```
So a total Places outage returns `null` (→ chain falls to OSM, → monitor sees red),
while a genuine empty area still returns `[]`.

### `getRecentDevelopmentActivityOSM(lat, lng)`
- `placesOsmCache` key `commercial:osm:${lat},${lng}` (short-TTL, FR-067 parity).
- One Overpass union: `searchOSMPOIs(lat, lng, { filters: OSM_COMMERCIAL_FILTERS,
  radiusM: DEVELOPMENT_ACTIVITY_SEARCH_RADIUS_M, withTags: true, limit: 40 })`.
- For each POI, `categorizeOSMCommercialPOI(p.tags)` → `{ type, label, icon }` or
  null (discard). Skip `disused:`/`abandoned:`-prefixed POIs (operational proxy).
- **Variety parity with Google** (decision): group categorized POIs by type
  (nearest-first; `searchOSMPOIs` already sorted), take **top 2 per type**, flatten,
  re-sort by `distanceMiles`, take **top 6**. Each record carries `source:'osm'`.
- Dedupe by `name` (case-insensitive) before capping, to avoid the same place
  mapped as node+way appearing twice (mirrors the Google `place_id` dedupe intent).
- Return the array, or `[]` if nothing categorized (chain treats `[]` as valid —
  see validity note).
- Cache and return.

### `getRecentDevelopmentActivity(lat, lng)` (public)
```
const picked = await sourceChain([
  { name: 'google', run: () => getRecentDevelopmentActivityGoogle(lat, lng), isValid: Array.isArray },
  { name: 'osm',    run: () => getRecentDevelopmentActivityOSM(lat, lng),    isValid: Array.isArray },
], null, { label: 'growth-commercial', log: chainLog('getRecentDevelopmentActivity', `${lat},${lng}`) });
return picked ? picked.value : [];
```
`Array.isArray` makes Google's `null` (outage) a miss → fallthrough to OSM; an
empty `[]` from a healthy Google short-circuits (no Overpass call). Add the
`chainLog` adapter (FR-067/070 form) to `growth/data.js`.

## New tag→category rule (`src/modules/growth/logic.js`)

`categorizeOSMCommercialPOI(tags)` — the one place the OSM tag→commercial-type rule
lives (CONSTRAINT-004: tag-only, no brand/name). Mirrors `categorizeOSMWalkPOI`.
Returns the matched `COMMERCIAL_DEV_TYPES`-aligned `{ type, label, icon }` or null:

| tag match | type / label / icon |
|---|---|
| `shop=mall` | shopping_mall · Shopping Center · 🏬 |
| `shop=supermarket` | supermarket · Grocery Store · 🛒 |
| `shop=department_store` | department_store · Major Retail · 🏪 |
| `leisure=fitness_centre` \| `sport=fitness` \| `amenity=gym` | gym · Fitness Center · 💪 |
| `amenity=cinema` | movie_theater · Entertainment · 🎬 |
| `amenity=bank` | bank · Financial · 🏦 |

Label/icon strings are sourced from `COMMERCIAL_DEV_TYPES` (import into logic, or
keep a local aligned map) so they never drift from the Google path. First match
wins; unmatched → null.

## New constants (`src/utils/constants.js`)

```js
// FR-071 — Growth commercial OSM fallback. Tag-only (CONSTRAINT-004), keyed to
// COMMERCIAL_DEV_TYPES so the OSM path reuses the same labels/icons. Searched at
// DEVELOPMENT_ACTIVITY_SEARCH_RADIUS_M (2.4 km), not the 8 km generic POI radius.
const OSM_COMMERCIAL_FILTERS = [
  '["shop"="mall"]', '["shop"="supermarket"]', '["shop"="department_store"]',
  '["leisure"="fitness_centre"]', '["sport"="fitness"]', '["amenity"="gym"]',
  '["amenity"="cinema"]', '["amenity"="bank"]',
];
```
Export `OSM_COMMERCIAL_FILTERS`.

## Template (`src/modules/growth/template.js`) — source label only

Narrative (`:324–345`), research table (`:129`), takeaway (`:371`), glance — all
read `name`/`label`/`icon`/`distanceMiles`, **identical shape, no change**. Only
the hardcoded source label flips:
- Add helper `commercialSourceLabel(establishments)` → `'OpenStreetMap'` when
  `establishments?.[0]?.source === 'osm'`, else `'Google Places'`.
- `:383` `if (establishments?.length) sources.push(commercialSourceLabel(establishments));`
- No CSS/class changes (CONSTRAINT-008); no API calls in template (CONSTRAINT-009).

## SOURCES descriptors (`src/modules/growth/data.js`)

- Repoint `google-places-development.run` → `getRecentDevelopmentActivityGoogle`
  (monitor reports on Google specifically). Tighten `isValid: Array.isArray` —
  now meaningful, because the impl returns `null` on outage (FR-067 parity). Keep
  `googlePlacesProbe`.
- Add `osm-commercial-fallback` — provider `osm`, coverage `some`, `run: (ctx) =>
  getRecentDevelopmentActivityOSM(ctx.lat, ctx.lng)`, `isValid: Array.isArray`,
  no probe.

Export `getRecentDevelopmentActivityGoogle`, `getRecentDevelopmentActivityOSM`
(keep `getRecentDevelopmentActivity`).

## Edge cases

| Case | Expected |
|---|---|
| Google up, results found | byte-identical to today; **no Overpass call**; label "Google Places" |
| Google up, no commercial (all fulfilled, empty) | `[]` short-circuits; no Overpass call; renderer's "lower density" path |
| Google fully down (all rejected) | Google impl returns null → OSM fallback; records `source:'osm'`; ledger records `fallback`; label flips to "OpenStreetMap" |
| Google down, OSM has POIs | categorized, top-2-per-type, ≤6, sorted, name-deduped |
| Google down, OSM empty | `[]`; renderer empty-state; ledger records osm result |
| OSM disused/abandoned POI | skipped |
| OSM POI matching no rule | discarded by `categorizeOSMCommercialPOI` → null |

## Acceptance criteria

1. Google up (array or empty) → unchanged behaviour + **no Overpass call**.
2. Google fully-rejected → OSM fallback; each record
   `{name, label, icon, distanceMiles, source:'osm'}`, ≤6, sorted, name-deduped,
   top-2-per-type variety.
3. `categorizeOSMCommercialPOI` maps each of the 6 types correctly; unmatched →
   null; tag-only (CONSTRAINT-004).
4. Template shows "OpenStreetMap" as the commercial source when records are OSM,
   "Google Places" otherwise; narrative/cards/table otherwise identical.
5. Outage observability: Google impl returns null on all-rejected → descriptor
   `isValid` fails → monitor red (no more swallow-to-green).
6. Both down → `[]` → existing empty-state narrative (no crash).
7. No scoring introduced (CONSTRAINT-001); no brand names (004); template reuses
   existing classes (008); no HTML/CSS in data/logic (009).
8. Tests cover Google passthrough + outage-null, OSM categorize/variety/cap/dedupe/
   source-marker, chain short-circuit vs fallback, template label flip. **Jeffersonville
   IN** in the live 5-address check. All suites green.

## Out of scope / deferred
- `business_status` richness — OSM has no operational status beyond the disused/
  abandoned tag skip; acceptable for a degraded fallback.
- Named-project discovery (Google News RSS) is a separate source, untouched here.
