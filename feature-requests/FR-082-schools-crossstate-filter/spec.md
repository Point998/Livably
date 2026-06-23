# FR-082 — Cross-state filter for getSchoolRatings (PM-005 fix)

**Status:** Spec (not yet implemented) · **Module:** `src/chapters.js` + `src/shared/validate.js`
**Origin:** PM-005 · **Constraint:** CONSTRAINT-006 enforcement gap · **Date:** 2026-06-23

## Problem

`getSchoolRatings()` (the Schools chapter data path) does not route results through
`checkCrossState`, so a border address (Jeffersonville IN) can surface a cross-state
(KY) school in the chapter. PM-001's fix only covered `findNearestSchool` /
`findNearestElementarySchool`. See PM-005 for full analysis.

## Goal

Apply CONSTRAINT-006 uniformly to **all** school searches: every public-level result and
every private result in `getSchoolRatings` must pass `checkCrossState` before inclusion.

## Requirements

1. Thread `originState` into `getSchoolRatings(...)` (currently not a parameter — it's
   available at the call site in `getChapterData`, derived from reverse geocoding at report start).
2. For each public-level candidate and each private candidate, call
   `checkCrossState(place.geometry.location, originState)` at fetch time (while
   `geometry.location` is still in scope).
3. Policy per CONSTRAINT-006: drop cross-state results. Only if **no in-state option exists
   within 50 miles** for a level, include the cross-state result and mark it
   `crossState: true` + `crossStateNote` on that entry.
4. Extend the chapter data shape so a legitimately-surfaced cross-state school carries a
   `crossState` marker — so the FR-081 contract can flag it (today the shape has no
   location/state and the contract cannot detect cross-state). When present, the FR-081
   `nearest-public-{level}` finding should set `tone: 'caution'` + a cross-state `defaultCopy`
   note (mirrors the health contract's cross-state handling).

## Acceptance criteria

- AC-1: a mocked KY result for a Jeffersonville IN origin is dropped from `getSchoolRatings` output.
- AC-2: `tests/integration/jeffersonville.test.js` extended to assert the **chapter** path
  (not only `findNearestSchool`) returns in-state schools.
- AC-3: when a cross-state school is legitimately surfaced (no in-state within 50mi), it is
  marked and the FR-081 contract flags it (tone caution + note).
- AC-4: no behavior change for non-border addresses (Georgetown/Harlan/Louisville/Bozeman).
- AC-5: full suite green incl. all 5 test addresses.

## Notes

- Reinforces CONSTRAINT-014 (coherence in validate.js, applied to all searches of a class).
- Follow-on audit (separate): re-check other multi-path search classes for the same gap —
  hospital (`getHealthcareDepth` vs `findNearestHospital`), pharmacy, grocery.
