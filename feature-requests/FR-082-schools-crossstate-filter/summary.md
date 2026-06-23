# FR-082 — Cross-state filter for getSchoolRatings (PM-005 fix) · Summary

**Status:** Complete · **Branch:** `FR-082-schools-crossstate-filter` · **Date:** 2026-06-23
Fixes the PM-005 / CONSTRAINT-006 gap in the schools **chapter** data path.

## What shipped

- **`src/chapters.js` — `getSchoolRatings`:**
  - New param `originState` (threaded from `locationInfo.state` at the `getChapterData` call site).
  - New `selectInStateSchool(candidates)` helper: prefers the nearest **in-state** candidate
    (CONSTRAINT-006); only if none in-state does it permit the nearest cross-state candidate
    **within 50 mi**, returning a `crossState` marker; beyond 50 mi the level is dropped.
    Cross-state checks for the bounded candidate set (≤6) run in parallel.
  - Public per-level entries gain `crossState` + `crossStateNote` when flagged.
  - Private candidates that are cross-state are dropped (supplementary list, no flag); widened
    the candidate window to 10 then keep ≤5 in-state.
  - When `originState` is empty, `checkCrossState` is a no-op → behavior unchanged.
  - `getSchoolRatings` exported for testability.
- **`src/modules/schools/contract.js` (FR-081):** `nearest-public-{level}` now reads the
  `crossState` marker → `tone: caution` + the note in `defaultCopy` (mirrors the health contract).

## Tests (+6)

- `tests/chapters/schoolRatings.test.js` — PM-005 regression (Jeffersonville IN origin):
  drop+pick-in-state, flag-within-50mi, drop-beyond-50mi, private cross-state drop, empty-state no-op.
- `tests/modules/schools/contract.test.js` — cross-state public school → caution + note.

## Verification

- Full suite: **93 suites / 1732 tests green** (1726 → +6), 12 snapshots.
- No behavior change for non-border addresses (empty/in-state → no-op path).

## Notes / follow-on

- Reinforces **CONSTRAINT-014** (coherence applied to all searches of a class).
- Follow-on audit (separate): re-check other multi-path search classes for the same gap —
  hospital (`getHealthcareDepth` vs `findNearestHospital`), pharmacy, grocery.
