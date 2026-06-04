# FR-058 — Implementation Plan (Phase 3)
*Ordered by layer (shared → data → logic → wiring → tests). No code until this plan is approved.*

## Task order

### T1 — Dependency + constants (foundation)
- Add `h3-js` to `package.json`; document in `summary.md` (CLAUDE.md requires it).
- Add to `src/utils/constants.js`:
  - `CELL_RESOLUTION_BY_MODE = { urban: 9, suburban: 8, rural: 6, remote: 5 }`
  - `BAND_LADDER_BY_MODE` (the rung→upper-bound table from spec R2)
  - `BAND_STRADDLE_MINUTES = 1`
  - `DRIVETIME_CELL_TTL_DAYS = 14`
- **Risk:** dependency approval. If `h3-js` is rejected, swap to `ngeohash` behind the same `snapToCell` interface — only T2 changes.

### T2 — Spatial primitive (`src/shared/spatial.js`, new) — shared layer
- `snapToCell(latLng, mode)` → `{ cellId, resolution, centroid }` using `latLngToCell` + `cellToLatLng`.
- Accept `latLng` as `{lat,lng}` or `"lat,lng"` string (match existing helpers).
- Zero IO. Pure.
- **Tests first (TDD):** same-cell collision ~100 m apart; cross-boundary distinction; resolution varies by mode; string + object input parity.

### T3 — Band classifier (`src/shared/validate.js`) — logic/coherence layer
- `classifyBand(driveMinutes, mode)` → integer `rung`, reading `BAND_LADDER_BY_MODE`, applying `BAND_STRADDLE_MINUTES`.
- Export alongside existing `detectRuralMode` / `checkDriveTimeCoherence`.
- **Tests first:** rung boundaries per mode; straddle rounds up; `null`/missing minutes → no rung.

### T4 — Drive-time layer (`src/shared/google/distanceMatrix.js`) — data layer
- `getDriveTime` keying: accept a `cellId`-based key; compute from `centroid`. New TTL constant.
- `getTrafficVariations`: key by `cellId`, apply 14-day TTL.
- Add a thin `getExactDriveTime(actualOrigin, dest)` path for the safety tier that bypasses the cell key and is **not** long-TTL cached (per-address, exact).
- Keep return shape (rounded minutes) — banding happens in logic, not here (CONSTRAINT-009).

### T5 — POI fetchers — data layer
- `reachability/data.js`: snap origin→cell once; search from `centroid`; key caches by `cellId`; attach `cellId`, `resolution`, `centroidDriveMinutes` to each record.
- Radius from centroid sized to cover cell + margin (edge-case mitigation, spec Edge Cases).
- `health/data.js`: 5-candidate **selection** keyed by `cellId` from centroid (CONSTRAINT-003 logic intact); then call `getExactDriveTime` from the actual address for the selected hospital/urgent-care → `exactDriveMinutes`.

### T6 — Logic threading
- Where records flow through `logic.js`: run `checkDriveTimeCoherence(centroidDriveMinutes, …)` **then** `classifyBand` → set `bandRung`, `mode`. Safety records keep `exactDriveMinutes` and skip banding.
- No template changes. Templates continue to read whatever they read today; new fields are additive and unused until a future template FR.

### T7 — Tests (CONSTRAINT-011)
- Unit: `spatial.test.js`, band cases in `validate.test.js`, distanceMatrix cell-key + exact-path tests.
- Integration: all 5 addresses (Georgetown, Harlan, Louisville, Bozeman, **Jeffersonville IN**). Assert: report still renders; `bandRung` populated for lifestyle; `exactDriveMinutes` populated for safety; cross-state (006) and rural mode (007) unchanged.
- Cache-behavior test: two addresses in one suburban cell → 2nd report yields Places cache hits + no new Places call (assert via `cacheStats`/log spy).

### T8 — Summary + verification
- `summary.md`: document `h3-js` dependency, the safety-tier exact-call carve-out, measured cache-hit behavior, and the known cell-edge POI limitation.
- Run full test suite; confirm green before commit (verification-before-completion).

## Sequencing rationale
Shared primitives (T1–T3) are pure and testable in isolation, so they land first with TDD. Data layer (T4–T5) depends on them. Logic threading (T6) depends on data. Tests (T7) validate end-to-end. No layer reaches into another's concerns (three-layer rule).

## Risks & unknowns
1. **h3-js approval** — gated at T1; clean fallback to ngeohash.
2. **Cell-edge POI selection drift** — accepted limitation; bounded by cell size; documented. If it proves material in dense urban testing, mitigation is a smaller urban resolution (res 10) — a one-line constant change.
3. **Hospital exact-vs-centroid selection mismatch** — verify in T7 that centroid-based top-5 selection matches actual-address nearest for the 5 test addresses; if any mismatch, fall back to actual-address selection for the safety tier only (still cell-cache the candidate *list*, not the choice).
4. **Report byte-stability** — new fields must be additive; confirm no template currently renders raw minutes in a way the new flow changes. (Audit during T6.)

## Out of scope (do not build here)
- Band *wording* / visual framing → future template FR.
- OSRM routing (NR-003 Phase 2), warehouse (Phase 3).
- Redis/shared-instance cache (separate infra FR; file cache is sufficient for this change).
