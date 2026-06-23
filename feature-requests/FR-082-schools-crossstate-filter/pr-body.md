## What

Fixes **PM-005** — the cross-state school gap in the schools **chapter** data path. PM-001/CONSTRAINT-006 was enforced in `findNearestSchool` only; `getSchoolRatings()` (what the chapter actually renders) had no `checkCrossState` filter, so a border address (Jeffersonville IN) could surface a Kentucky school in the chapter.

## Changes

- **`src/chapters.js` — `getSchoolRatings`**:
  - New `originState` param, threaded from `locationInfo.state` at the `getChapterData` call site.
  - New `selectInStateSchool()` helper: prefers the nearest **in-state** candidate (CONSTRAINT-006); only if none in-state, permits the nearest cross-state candidate **within 50 mi**, marked `crossState` + `crossStateNote`; beyond 50 mi the level is dropped. Cross-state checks for the bounded candidate set run in parallel.
  - Cross-state **private** schools are dropped (supplementary list, no flag).
  - **No-op when `originState` is empty** → unchanged behavior for callers without a known state.
  - `getSchoolRatings` exported for testability.
- **`src/modules/schools/contract.js` (FR-081)**: `nearest-public-{level}` reads the `crossState` marker → `tone: caution` + note in `defaultCopy` (mirrors the health contract's cross-state handling).

## Tests (+6)

- `tests/chapters/schoolRatings.test.js` — PM-005 regression (Jeffersonville IN origin): drop+pick-in-state, flag-within-50mi, drop-beyond-50mi, cross-state private drop, empty-state no-op.
- `tests/modules/schools/contract.test.js` — cross-state public school → caution + note.

## Verification

- Full suite: **93 suites / 1732 tests green** (1726 → +6), 12 snapshots.
- No behavior change for non-border addresses.

## Notes

- Reinforces **CONSTRAINT-014** (coherence applied to all searches of a class).
- Follow-on audit (separate): re-check hospital (`getHealthcareDepth` vs `findNearestHospital`), pharmacy, grocery multi-path searches for the same class of gap.

See PM-005 and `feature-requests/FR-082-schools-crossstate-filter/` for full detail.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
