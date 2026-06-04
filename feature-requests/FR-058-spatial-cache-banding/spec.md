# FR-058 — Spatial Cache Keys + Drive-Time Banding
*Implements NR-003 Phase 1. Module: `src/shared/` (cross-cutting) + reachability, health, distanceMatrix.*

## What
Stop re-billing Google for answers we already have. Key location caches by a **spatial cell** (so neighboring addresses share one fetch), and present lifestyle drive times as **honesty-preserving bands** computed once from the cell centroid. Keep the safety tier (hospital/ER, urgent care) genuinely exact.

This is a cost + data-model change. **It makes no visual decisions** — the report's appearance is unchanged until a later, separate template FR chooses how bands render.

## Problem
Every cache key is the exact origin coordinate (`grocery:${originLatLng}`, `${originLatLng}:${destStr}`). Two houses on the same street share nothing on disk. At B2B volume (loans clustered in the same metros/subdivisions) we pay full freight — ~$0.65/report — for POI and drive-time answers that are identical across a neighborhood. See NR-002 (cost model) and NR-003 (diagnosis).

## Goals
- Marginal cost of the *Nth* report in a cell drops from ~$0.65 to ~$0.03–0.04 (warm cell), with **no accuracy regression** and **no provider change**.
- Drive-time values become **band-capable** in the data layer so any future presentation is a pure template change.
- All existing constraints (001, 003, 006, 007, 009, 010, 011, 014) remain satisfied.

## Non-Goals
- No OSRM/OSM (NR-003 Phase 2). No precomputed warehouse (Phase 3).
- No visual/template change. No band *wording* anywhere in this FR.
- No change to which APIs are called — only *how often* and *under what key*.

---

## Requirements

### R1 — Spatial cell primitive (`src/shared/spatial.js`, new)
- `snapToCell(latLng, mode)` → `{ cellId, resolution, centroid: {lat,lng} }`.
- Uses H3 (`h3-js`). Resolution chosen by `mode` from `detectRuralMode`:

  | mode | H3 res | ~edge length |
  |---|---|---|
  | urban | 9 | ~150 m |
  | suburban | 8 | ~450 m |
  | rural | 6 | ~3 km |
  | remote | 5 | ~8 km |

- `cellId` is the H3 index string at that resolution. `centroid` is `cellToLatLng(cellId)`.
- Pure function, no IO, no API calls. Fully unit-testable.

### R2 — Band classifier (add to `src/shared/validate.js`)
- `classifyBand(driveMinutes, mode)` → integer `rung` (0 = closest). Thresholds by mode (the ladder *shifts*, finer near zero, coarser far out):

  | rung | urban | suburban | rural | remote |
  |---|---|---|---|---|
  | 0 | <2 | <5 | <15 | <25 |
  | 1 | <5 | <10 | <25 | <40 |
  | 2 | <10 | <15 | <40 | <60 |
  | 3 | <15 | <25 | <60 | <90 |
  | 4 | <25 | <40 | <90 | ≥90 |
  | 5 | ≥25 | ≥40 | ≥60→≥90 | — |

  (Exact numbers tunable in `constants.js`; table above is the baseline.)
- **Straddle rule:** if `driveMinutes` is within 1 min of a rung's upper bound, assign the **higher** rung (never undersell a drive).
- Returns `rung` only — an integer classification. **No words, no labels** (CONSTRAINT-009). Template maps rung → language later.

### R3 — Cache keys become cell-based
- POI keys: `grocery:${cellId}`, `pharmacy:${cellId}`, `gasstation:${cellId}`, hospital/urgent-care selection keyed by `${cellId}`.
- Drive-time keys: `${cellId}:${destStr}` and `traffic:${cellId}:${destStr}:${label}`.
- POI **searches and centroid drive-time computations run from `centroid`**, not the raw address. All addresses in a cell reuse the same fetch.

### R4 — Data contract (the field that keeps presentation open)
Each destination record carries:

| field | layer | purpose |
|---|---|---|
| `cellId`, `resolution` | shared | the cache key |
| `centroidDriveMinutes` | logic | the value banded; input to coherence (010) + straddle |
| `bandRung`, `mode` | logic | the honest classification (a data fact) |
| `exactDriveMinutes` | logic | **safety tier only** — see R5 |
| existing: `name`, `address`, `location`, source, research date | data | unchanged |

### R5 — Safety tier stays genuinely exact (CONSTRAINT-003 preserved)
- Hospital + urgent care: the **5-candidate drive-time selection** is computed from the centroid and **cell-cached** (this is the expensive, shareable part).
- The **final displayed drive time** for the selected hospital/urgent-care is recomputed from the **actual address** (1 Distance Matrix call per report) → `exactDriveMinutes`. This number is **never banded**.
- Net: the costly verification is shared; the safety number a buyer reads stays truly exact for their house. Cost: ~1–2 Distance Matrix calls/report (~$0.02) — accepted.

### R6 — TTL extension (bands are stable)
- Because lifestyle values surface as rungs (not minutes), extend `driveTimeCache` TTL from 24h to **14 days** for centroid lifestyle drive times. Safety `exactDriveMinutes` is per-address and not cell-cached, so it is unaffected.
- `getTrafficVariations` results become cell-keyed with the 14-day TTL (the *shape* of a cell→destination traffic curve is stable).

### R7 — Coherence ordering
- `checkDriveTimeCoherence` (010) runs on `centroidDriveMinutes` **before** `classifyBand`. A flagged-incoherent result is handled exactly as today (no banding masks an incoherent drive).

---

## Acceptance Criteria
- [ ] `snapToCell` returns identical `cellId` for two coordinates ~100 m apart in a suburban cell, and **different** `cellId`s across cell boundaries.
- [ ] Two distinct addresses in the same suburban cell produce **zero** new Places calls on the second report (verified via cache-hit logs / `cacheStats`).
- [ ] `classifyBand` honors the straddle rule (a 9.7-min suburban drive → rung 2, not rung 1).
- [ ] `classifyBand` and all logic emit **no band wording** — grep for label strings in `data.js`/`logic.js`/`validate.js` returns none (CONSTRAINT-009).
- [ ] Hospital selection still returns the shortest-drive-time candidate (CONSTRAINT-003); `exactDriveMinutes` is computed from the actual address and is not banded.
- [ ] `checkCrossState` (006) and `detectRuralMode` (007) behavior unchanged.
- [ ] Coherence check (010) runs on the centroid value before banding.
- [ ] `h3-js` documented in `summary.md` as a new dependency.
- [ ] Tests pass for all 5 addresses incl. Jeffersonville IN (CONSTRAINT-011); report output is byte-stable vs. pre-FR baseline except for the new internal fields (no visual change).

## Edge Cases
- **Cell-edge POI selection.** An edge house may be marginally closer to a different POI than the centroid's pick. Bounded by cell size; accepted with same justification as banding. Search radius from centroid must cover cell + margin so no in-cell-relevant POI is missed. Documented as a known limitation.
- **Mode boundary addresses.** If an address sits near a rural/suburban classification edge, `detectRuralMode` decides resolution + ladder consistently (single source). No special-casing.
- **Remote / very large cells.** At res 5 the centroid can be several km from the address; this is fine because remote POIs are far and shared, and bands are wide. Coherence/rural framing already handles "everything is far."
- **Cache poisoning across modes.** `cellId` is resolution-specific, so an urban-res cell and a rural-res cell never collide. Safe.
- **Missing drive time.** If a centroid drive time can't be computed, behavior matches today (skip/flag); no band is emitted.

## Testing Scenarios
1. Same cell, two addresses → 2nd report: all POI + lifestyle drive caches hit, only per-address geocode + safety `exactDriveMinutes` call out.
2. Adjacent cells → independent cache entries, no false sharing.
3. Straddle: drive times of 4.6 / 5.0 / 9.7 / 10.2 min (suburban) land on the conservative rung.
4. Hospital: selection from centroid matches the exact-address nearest among top-5; displayed ER time is exact-per-address.
5. All 5 standard test addresses produce a valid report with populated `bandRung` and (for safety) `exactDriveMinutes`.

## Constraint Compliance
| Constraint | How satisfied |
|---|---|
| 001 no false precision | Banding *is* the anti-false-precision posture for time |
| 003 hospital by drive time | Selection unchanged; displayed time exact-per-address (R5) |
| 006 cross-state | Unchanged |
| 007 rural mode | Drives cell res + band ladder (single source) |
| 009 no design in data/logic | Logic emits `bandRung` integer; words live in template (future FR) |
| 010 coherence | Runs on centroid value before banding (R7) |
| 011 tests | New unit tests + 5-address integration incl. Jeffersonville |
| 014 coherence in shared | `snapToCell` in shared; `classifyBand` in validate.js |

## Dependencies
- `h3-js` (new). Pure-JS H3 bindings. Documented in summary per CLAUDE.md. Fallback: `ngeohash` if H3 is rejected (rectangular cells, lat-varying size — inferior but zero-risk).
- No other new packages.

## Estimated Effort
**Medium** — spatial primitive + band classifier + cache-key swap across 3 fetch sites + data-contract threading + tests. ~1 focused build session under the 4-phase workflow.
