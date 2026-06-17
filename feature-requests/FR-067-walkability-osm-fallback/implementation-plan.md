# FR-067 — Walkability OSM cost-resilience fallback — Implementation Plan

*Phase 3. Ordered by layer (shared → constants → logic → data → template →
sources), tests alongside each. Pattern reference: FR-066 reachability/data.js.*

## Task 1 — shared/osmPlaces.js: opt-in `withTags`
- Add `{ withTags = false }` option. When true, include `tags: el.tags` on each
  returned record. Default false → fully backward-compatible (FR-066 callers
  untouched).
- Test: `tests/shared/osmPlaces.test.js` — add a `withTags: true` case asserting
  `tags` present; existing cases assert it absent by default.
- Risk: none — purely additive.

## Task 2 — utils/constants.js: walk OSM filters
- Add `OSM_WALK_FILTERS` (5 keys mirroring `WALK_TYPES` order) + export.
- Tag-only strings (CONSTRAINT-004). Reuse `WALKABILITY_SEARCH_RADIUS_M`.
- No test (data constant); covered transitively by logic/data tests.

## Task 3 — logic.js: `categorizeOSMWalkPOI(tags)`
- Pure function: inspect tags → `'grocery'|'restaurant'|'transit'|'park'|
  'pharmacy'|null`. Order of checks matches `OSM_WALK_FILTERS`.
- Export it; keep `getWalkCategory` as-is.
- Test: `tests/modules/walkability/data.test.js` (or logic-focused block) —
  representative tags per category + an unrelated tag → null.

## Task 4 — data.js: split + sourceChain
- Rename current `getWalkabilityScore` body → `getWalkabilityScoreGoogle`.
  - Add fulfilled/rejected tracking: count `r.status === 'fulfilled'`. If
    `fulfilledCount === 0` → `return null`. Else build object as today + add
    `source: 'google'`.
- New `getWalkabilityScoreOSM(lat, lng)`:
  - cache check `placesOsmCache` key `walk:osm:${lat},${lng}`.
  - one `searchOSMPOIs(lat, lng, { filters: <all 5 unioned>, radiusM:
    WALKABILITY_SEARCH_RADIUS_M, withTags: true, limit: 60 })`.
  - group by `categorizeOSMWalkPOI`; per category compute count→weight (parity
    with Google), accumulate score; collect up to 2 nearest destinations per
    category with `walkMinutes = max(1, round(dist*20))`.
  - 0 categorizable POIs → return null. Else cache + return object +
    `source: 'osm'`.
- New public `getWalkabilityScore(lat, lng)`:
  - `sourceChain([google, osm], null, { label: 'walkability', log: chainLog(...) })`.
  - picked → `picked.value`; both null → degraded
    `{ score: null, category: <unknown>, destinations: [], isProxy: true,
       source: 'unavailable' }`.
  - Add an `unknown` band to `getWalkCategory` handling OR construct the unknown
    category inline in data.js (lean: a small `UNKNOWN_WALK_CATEGORY` const in
    logic.js so the band vocabulary stays in one place).
- chainLog adapter via `logError` (mirror reachability lines 33-34).
- Tests: outage→OSM, google-success→no-overpass, both-down→degraded,
  partial-google→non-null, rural-desert→score0-source-google.

## Task 5 — template.js: provenance + degraded floor
- Read `walk.source`. Helper `walkSourceLine(source)` returns the disclaimer
  source phrase ('Google Places' | 'OpenStreetMap (community-mapped)' ). Apply
  to both disclaimer lines (190-286 region + research table 158).
- `source === 'unavailable'` (or `score == null`): render the verdict block as
  an "unavailable" state and surface the Walk Score / Street View pointers as
  the lead (reuse `buildWalkResearchToolsTab`), no fabricated band.
- No inline styles; reuse existing classes (CONSTRAINT-008).
- Test: `tests/modules/walkability/template.test.js` — osm source → OSM
  disclaimer text; unavailable → no numeric band + research pointer present;
  google source → existing text unchanged.

## Task 6 — SOURCES descriptors
- Google descriptor: point `run` at `getWalkabilityScoreGoogle`; isValid =
  `r != null && typeof r.score === 'number'` (now meaningfully fails on outage).
  Keep `probe: googlePlacesProbe`.
- Add OSM descriptor → `getWalkabilityScoreOSM`, provider 'osm', coverage
  'some', isValid same shape, no probe.
- Update `module.exports` to expose google/osm impls (mirror reachability).

## Task 7 — verify
- `npx jest` full suite green.
- End-to-end render on all 5 addresses (Georgetown, Harlan, Louisville, Bozeman,
  Jeffersonville) via the existing run path — confirm walkability card renders
  with `source: 'google'` live, and a forced-OSM path produces a coherent card.
- Confirm no Overpass call on the happy path (Google success short-circuits).

## Risks / unknowns
- **Overpass transit tags** are noisy (platforms + stops can double-count a
  single station). Acceptable for a proxy; the half/full weight rule damps it.
- **OSM density ≠ Google density** → OSM score will often differ. Expected and
  disclosed (provenance line). Not a correctness bug.
- **`limit: 60`** must be high enough that no category is starved by another's
  abundance. If observed starving, switch to per-category limits — but that
  needs tag-grouping post-fetch anyway, which we already do, so the single
  generous limit is fine.
- **Rate-limit etiquette**: one union call per address per cache window — within
  etiquette (the FR-066 watch-item).
