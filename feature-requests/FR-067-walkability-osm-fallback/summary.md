# FR-067 — Walkability OSM cost-resilience fallback — Summary

*Phase 4 complete. Track A1 continuation. Extends FR-066's Google-POI→OSM
fallback to the Walkability chapter.*

## What shipped

When Google Places is unavailable (quota outage / spend cap), the walkability
proxy is now computed from OpenStreetMap via **one** Overpass union call instead
of returning a misleading `score: 0`. The chapter stays honest about which
source produced the number.

- **`getWalkabilityScore(lat, lng)`** is now a `sourceChain`: Google primary →
  OSM fallback → degraded-but-renderable floor. Google short-circuits the chain
  (no Overpass call) whenever it succeeds. Public signature unchanged.
- **Outage detection fix (observability):** `getWalkabilityScoreGoogle` now
  returns `null` when *every* Places call rejects (the outage signature), so the
  chain falls through to OSM **and** the source monitor sees a genuine failure.
  Previously the fetcher swallowed total failure to `score: 0` — masking outages
  green (the NR-004 "silent failures keep hiding" watch-item). A genuine rural
  walk-desert (calls succeed, 0 results) still returns a valid `score: 0`.
- **`getWalkabilityScoreOSM`** issues one `searchOSMPOIs` union call across 5
  tag-only walk-type filters at the 800 m walk radius, re-categorizes each POI by
  its tags (`categorizeOSMWalkPOI`), and scores with the *same* weight rule as
  Google. Short-TTL `placesOsmCache` so a cell recovers to Google after quota
  reset without re-hammering Overpass.
- **Honest provenance:** template disclaimers now read "OpenStreetMap
  (community-mapped) data — may be less complete than commercial sources" when
  the OSM path produced the result, vs "Google Places data" otherwise.
- **Graceful degradation (CONSTRAINT-015):** both sources down → a renderable
  card with no fabricated band, leading with the Walk Score / Street View
  research pointers, instead of vanishing.

## Files touched

- `src/shared/osmPlaces.js` — opt-in `withTags` (backward-compatible; FR-066
  callers untouched).
- `src/utils/constants.js` — `OSM_WALK_FILTERS` (tag-only, keyed 1:1 to
  `WALK_TYPES`) + export.
- `src/modules/walkability/logic.js` — `categorizeOSMWalkPOI`,
  `UNKNOWN_WALK_CATEGORY`.
- `src/modules/walkability/data.js` — Google/OSM split + sourceChain + SOURCES
  descriptors (Google descriptor now fails meaningfully on outage; OSM descriptor
  added, provider 'osm', coverage 'some').
- `src/modules/walkability/template.js` — provenance-aware disclaimers +
  unavailable floor card.
- Tests: `tests/modules/walkability/data.test.js` (rewritten),
  `tests/modules/walkability/template.test.js` (+FR-067 block),
  `tests/shared/osmPlaces.test.js` (+withTags).

## Constraints honored

- **004** — tag-only OSM filters, no brand/chain names. ✓
- **008** — no inline styles (incl. new unavailable card). ✓
- **009 (spirit)** — the new tag→category business rule lives in logic.js. (The
  pre-existing count→weight scoring stays in data.js for parity with the Google
  path — flagged in discovery, not refactored here.)
- **011** — tests for every new rule; Jeffersonville IN in the live check.
- **015** — both-down renders an actionable card, not silence.

## Verification

- `npx jest` — **81 suites / 1,539 tests green** (was 1,516; +23).
- **Keyless live Overpass check** on all 5 test addresses (the preferred
  verification): Georgetown 48, Louisville 68, Bozeman 90, Jeffersonville 65
  (IN data, no cross-state leak), Harlan 18 (correctly low for rural
  Appalachian). Categorization clean (Dining/Transit/Park), no Overpass call on
  the Google happy path.

## Phases

All 4 workflow phases executed (discovery → spec → plan → implementation). No
phases skipped.

## Next up (A1)

Recreation (park/coffee/library/rec/post office), then Sensory airports
(`aeroway=aerodrome`), then Growth commercial → then USDA soil / USGS elevation /
Census vintage.
