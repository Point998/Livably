# FR-058 — Summary (Phase 4, Implementation)
*Spatial cache keys + drive-time banding. Implements NR-003 Phase 1. Built June 4 2026.*

## What shipped
Location caches are now keyed by a **spatial cell** (H3) instead of the exact origin
coordinate, so neighboring addresses share one fetch. Lifestyle drive times are
computed once from the cell **centroid** and carry an honest integer **band rung**
in the data layer. The safety tier (hospital / urgent care) keeps a genuinely exact,
per-address drive time. **No template/visual change** — all new fields are additive
and dormant until a future presentation FR.

## Dependency added
- **`h3-js` ^4.4.0** (Uber H3 bindings, pure-JS/emscripten — server-side only, no
  browser bundle impact). Chosen over the `ngeohash` fallback for **uniform global
  cell size** (a res-8 cell is ~0.7 km² in every market), which keeps cost-per-cell
  predictable across the B2B footprint, and for better centroid-to-edge geometry
  (smaller worst-case POI-selection drift). Installed clean, 0 vulnerabilities.

## Owner decision recorded
The spec was ambiguous on lifestyle display vs. byte-stability. Confirmed with Nathan:
lifestyle `driveTimeMinutes` now reflects the **centroid value** (`= centroidDriveMinutes`),
delivering the full warm-cell saving now. Displayed lifestyle minutes can shift ~0–2 min
vs. the old per-doorstep number (≤~225 m centroid offset suburban, less urban) — exactly
the imprecision banding is designed to absorb. Structure/layout unchanged. Safety ER/urgent-care
time stays exact per address.

## Changes by layer
- **shared/** — new `src/shared/spatial.js`: `snapToCell(latLng, mode)` →
  `{ cellId, resolution, centroid }`. Pure, no IO. `src/shared/validate.js`: added
  `classifyBand(driveMinutes, mode)` → integer rung (0 = closest), straddle rule
  (within 1 min below a bound → higher rung; never undersell). Returns an integer
  only — no words (CONSTRAINT-009). Missing/invalid input or unknown mode → `null`.
- **constants** — `CELL_RESOLUTION_BY_MODE` (9/8/6/5), `BAND_LADDER_BY_MODE`,
  `BAND_STRADDLE_MINUTES` (1), `DRIVETIME_CELL_TTL_DAYS` (14).
- **cache** — new `driveTimeCellCache` (namespace `drivetime_cell`, **14-day TTL**)
  for cell-keyed lifestyle drives + traffic; `cacheStats` breakdown split
  `drivetime` vs `drivetimeCell`.
- **data (drive time)** — `getDriveTime(origin, dest, { cellId })`: with a `cellId`
  it keys by cell in the 14-day cache and computes from the centroid; without one,
  unchanged per-address/24h behavior (backward compatible for all other callers).
  New `getExactDriveTime(actualOrigin, dest)` — the safety-tier per-address path
  (24h cache, never cell-shared).
- **data (POI)** — `reachability/data.js` (grocery/pharmacy/gas) and
  `health/data.js` (hospital/urgent care) take an optional `cell`. With a cell they
  search from the centroid, key caches by `cellId`, and attach the R4 contract:
  lifestyle → `cellId, resolution, centroidDriveMinutes, bandRung, mode`; safety →
  `cellId, resolution, exactDriveMinutes` (selection cell-cached, displayed time
  recomputed per address).
- **orchestration** — `reportBuilder.js` snaps the origin to a cell once, augments
  it with `mode` (keeping `snapToCell` pure-spatial), and threads it to the five
  fetchers; traffic variations are computed from the centroid and cell-keyed.

## Safety-tier carve-out (CONSTRAINT-003 preserved)
The expensive 5-candidate selection is computed from the centroid and **cell-cached**
(shared across the neighborhood). The **cached object is the selection only** — both
the displayed drive time AND the cross-state determination are recomputed from the
**actual address** per report in `finalizeSafetyRecord` and are **never banded,
never cell-shared**. Net cost: ~1–2 Distance Matrix calls/report. Verified: two
addresses in one cell share the candidate search but each receives its own exact time.

## Post-review hardening (code review on the diff)
Four findings from a high-effort review were fixed test-first:
1. **Cross-state per address, not per cell (CONSTRAINT-006 / PM-001).** An H3 cell can
   straddle a state border. Cross-state status was baked into the cell-shared
   selection, so a same-cell neighbor in a different state inherited the wrong label.
   Fixed: cross-state is now computed in `finalizeSafetyRecord` per `(winner location,
   originState)`, like the exact time — selection stays state-independent and shared.
   Regression test: IN + KY addresses in one cell, one search, correct per-buyer labels.
2. **Cache namespace prefix collision.** `Cache.clear()/stats()` matched files by
   `startsWith(\`${namespace}_\`)`, so `driveTimeCache.clear()` (live at `app.js:103`)
   also wiped `drivetime_cell_*`. Fixed with `Cache._ownsFile` (exact `<ns>_<hash>.json`
   match); robust against any future prefix collision. `tests/cache.test.js` added.
3. **Graceful degradation (CONSTRAINT-015).** A transient failure of the extra exact
   call no longer discards an already-selected safety facility — it falls back to the
   centroid time (`exactDriveMinutes: null`, display = centroid).
4. **Reuse.** `cellSearchOrigin` / `cellDriveOpts` extracted to `shared/spatial.js`
   (were duplicated verbatim in health + reachability data files).

## Measured cache behavior
Integration test `tests/integration/fr058-cell-cache.test.js` (real `snapToCell` +
real H3 + real reachability data layer, mocked IO): two real Georgetown addresses
~100 m apart resolve to the **same `cellId`**, and the second report makes **zero new
Places calls** — grocery `textSearch` fires once; pharmacy+gas `placesNearby` fires
twice for two POIs across both reports (not four). Cache-hit logs confirm
`places: grocery:88266daa65fffff` etc.

## Known limitation (accepted, documented)
**Cell-edge POI selection.** Searching from the centroid means an edge-of-cell house
could be marginally closer to a different POI than the centroid's pick. Bounded by
cell size (≤~225 m centroid offset suburban). If it proves material in dense urban
testing, mitigation is a one-line constant change (urban res 9 → 10).

## R7 ordering note
Coherence (CONSTRAINT-010) and banding both read the raw `centroidDriveMinutes`
independently; `coherenceWarning` remains on the record after banding, so a band
never masks an incoherent drive. Order of computation does not change values.

## Constraint compliance
001 (no scoring) — banding is an integer rung, the anti-false-precision posture, not
a quality score. 003 — selection unchanged; displayed safety time exact per address.
006 — cross-state determined per address (post-review fix #1); border cell regression test.
007 — `detectRuralMode` untouched. 009 — logic emits integer
`bandRung`; no words/HTML/CSS in data/logic. 010 — coherence runs on the centroid value.
011 — new unit + integration tests incl. Jeffersonville IN. 014 — `snapToCell` in
shared, `classifyBand` in validate.js (single source).

## Tests
Full suite green: **64 suites, 1210 tests**. New/extended: `spatial.test.js` (7),
`classifyBand` in `validate.test.js` (10), `distanceMatrix.test.js` cell/exact (6),
`reachability/data.test.js` cell+band (7), `health/data.test.js` safety tier (5),
`fr058-cell-cache.test.js` (4); `reportBuilder.test.js` signature assertions updated.
All built test-first (RED→GREEN).

## Out of scope (unchanged)
Band wording / visual framing (future template FR). OSRM (NR-003 Phase 2), warehouse
(Phase 3). Schools/recreation/access/safety fetchers remain per-address (highest-volume
POIs — grocery/pharmacy/gas/hospital/urgent care — converted first).
