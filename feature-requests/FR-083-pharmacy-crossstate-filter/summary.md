# FR-083 — Cross-state filter for findNearestPharmacy (PM-006 fix) · Summary

**Status:** Complete · **Branch:** `FR-083-pharmacy-crossstate-filter` · **Date:** 2026-06-23
Closes the PM-006 / CONSTRAINT-006 gap in the **pharmacy** (Reachability) data path — the last
member of CONSTRAINT-006's named list that was still unguarded.

## What shipped

- **`src/modules/reachability/data.js`:**
  - New `finalizePharmacyRecord(record, originState)` helper — routes the final selected pharmacy
    through `checkCrossState(record.location, originState)`. Policy mirrors the health safety tier
    (`finalizeSafetyRecord`): **warn, don't reject** — the nearest pharmacy is always returned, but a
    cross-state result gets `crossStateWarning: true` + a `crossStateNote`. Returns a **new** object
    on the cross-state branch so the FR-058 cell cache is never mutated (an H3 cell can straddle a
    border; two addresses in one cell with different `originState` each get the correct flag).
  - `findNearestPharmacy(originLatLng, cell)` → `findNearestPharmacy(originLatLng, cell, originState)`.
    The check is applied once at the public entry, **after** the source chain resolves — so it covers
    the Google primary and OSM fallback uniformly, per-address (never inside the cell-cached sub-fetchers).
  - When `originState` is empty, `checkCrossState` is a no-op → behavior unchanged.
- **`src/modules/reachability/template.js`:** the Daily Conveniences narrative surfaces
  `pharmacy.crossStateNote` in both the drive-time branch and the OSM straight-line branch
  (mirrors the health template). Plain text — no inline styles (CONSTRAINT-008).
- **`src/services/reportBuilder.js`:** call site now passes `originState` (matches the
  hospital/urgent-care lines). `compareBuilder.js` left as-is (no `originState` → no-op, consistent
  with how it already invokes the hospital search).

## Tests (+9)

- `tests/modules/reachability/data.test.js` (+4) — PM-006 regression: cross-state pharmacy flagged
  with note; in-state not flagged; no-op when `originState` omitted; **cache not poisoned** across
  states (IN-origin flagged, KY-origin not, single shared cell fetch).
- `tests/modules/reachability/template.test.js` (+3) — note rendered in the drive-time branch and the
  OSM branch; absent for in-state.
- `tests/integration/jeffersonville-in.test.js` (+2) — IN-origin pharmacy: KY result flagged, IN result clean.

## Verification

- Full suite: **93 suites / 1741 tests green** (1732 → +9), 12 snapshots.
- No behavior change for non-border addresses (empty/in-state → no-op path).

## Notes / follow-on

- Reinforces **CONSTRAINT-014** (coherence applied to all searches of a class). With FR-083,
  CONSTRAINT-006's named list (school, hospital, urgent care, pharmacy) is **fully covered**.
  Grocery/gas/coffee remain deliberately out of scope (not jurisdiction-sensitive findings).
- Reachability is **not yet on the headless contract** (rollout 4/14), so there is no contract.js to
  update here. When the reachability contract lands, it should read the
  `crossStateWarning`/`crossStateNote` markers (mirrors the health contract) — tracked follow-on.
