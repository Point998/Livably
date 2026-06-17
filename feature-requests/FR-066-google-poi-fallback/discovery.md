# FR-066 — Discovery (Phase 1, read-only)

*Track A1, slice 2: Google-POI cost-resilience fallback. Reuses the FR-065 `sourceChain` primitive. Discovery 2026-06-16. No code changed in this phase.*

## Why this slice (the cost-resilience case)

~9 modules depend on Google (Places + Distance Matrix), all through `googleMapsClient` → `rateLimit.js`, which throws `QuotaExceededError` when quota/spend trips. When that happens, **nearly half the report degrades at once** — and there's no second data source cushioning the blow, only the CONSTRAINT-015 link floor. This slice inserts a real OSM fallback so a Google outage (or a deliberate spend cap) keeps the daily-needs content alive. Directly addresses Nathan's standing Google cost/quota concern.

## The central tension (resolved)

In a quota/spend outage, **Distance Matrix is down too** — not just Places. An OSM POI search still needs proximity, and Google routing is unavailable. **Decision (Nathan, 2026-06-16): use haversine straight-line distance, clearly labeled** ("live drive times unavailable — straight-line distance shown"). Keyless, free, honest — the right cost-resilience floor, matching the honest-provenance principle ([[project-honest-provenance]]). OSRM routing is a deferred upgrade (cost-architecture Phase 2), not this slice.

## Safety boundary — EXCLUDED from this slice

- **Health** (hospital / urgent care): CONSTRAINT-003 (exact drive time across top-5 candidates) + CONSTRAINT-006 (cross-state via `checkCrossState`). A straight-line fallback would violate the safety guarantee — never apply it here.
- **Schools**: CONSTRAINT-006 cross-state.
- These keep Google-only; if Google is down, they hit their existing link floor. The OSM fallback is for **non-safety** POIs only.

## First module (decision: Reachability trio)

`findNearestGrocery` / `findNearestPharmacy` / `findNearestGasStation` (`src/modules/reachability/data.js`) — archetypal daily non-safety POIs, highest everyday salience. Proves the pattern; the shared helper then extends to walkability, recreation, sensory-airports, growth-commercial as later FRs.

## Key consumption finding (shapes the spec)

The reachability **template + narrative consume `driveTimeMinutes` pervasively** — `formatDriveTime(result.driveTimeMinutes)`, prose like `"${g.driveTimeMinutes} minutes away"`, the at-a-glance grid, depth content. So the haversine fallback is **not** a one-line note: each place needs an **alternate rendering state** (distance-in-miles + "straight-line" label, no minutes), analogous to FR-060's "provider known, rate unknown" state. Logic + template must branch on a `driveTimeMinutes === null` / `proximitySource` flag.

## Assets to reuse

- **`fetchOverpass`** (currently in `sensory/data.js`, lines ~128) — multi-endpoint Overpass client with 429/406 failover + `OVERPASS_ENDPOINTS` constant. **Extract to `src/shared/overpass.js`** (CONSTRAINT-014) and update Sensory to import it (sensory tests cover the refactor).
- **`haversineDistance`** (`src/utils/geo.js`).
- **`sourceChain`** (FR-065) — the chain mechanism (Google primary → OSM fallback → throw/link floor).
- The **cell-cache seam** (`placesCache`, cell keys) — the OSM fallback must also cache so an outage doesn't hammer Overpass.

## Risks / constraints

- **Record-shape divergence**: Google records carry `driveTimeMinutes` + cell band fields; OSM records carry `distanceMiles` + `driveTimeMinutes: null` + `proximitySource`. Both must flow through logic/template without breaking the existing Google path. Banding (`bandRung`) is drive-time-based — on the OSM path it's absent; template must tolerate that.
- **Coherence**: CONSTRAINT-010 drive-time coherence checks key off minutes — skip them on the distance-only path (no minutes to check), don't crash.
- **Honest labeling** (CONSTRAINT-015 + honest-provenance): OSM source + straight-line caveat must be visible wherever the fallback renders.
- **Don't regress the Google path**: primary behavior, cell-cache, coherence all unchanged when Google is up.
- **Anti-mega-FR** (CONSTRAINT-013): shared helper + reachability only; other modules are follow-up FRs.

## Recommended scope for Phase 2

Shared `overpass.js` (extracted) + a shared `searchOSMPOIs` helper + apply the chain to the three reachability fetchers + the logic/template alternate state. Tests: Overpass parser fixture, haversine ordering, chain fallback ordering, template no-drive-time state, 5 addresses.
