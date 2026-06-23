# FR-081 — Schools chapter → headless report contract · Summary

**Status:** Complete · **Branch:** `FR-081-schools-contract` · **Date:** 2026-06-23
**Rollout #3** (after FR-078 utilities, FR-079 community, FR-080 health).
**4 of 14 chapters now on the contract.**

## What shipped

- **`src/modules/schools/contract.js`:** `buildSchoolsContract(schools, opts)` — pure
  mapping (no API calls, no HTML — CONSTRAINT-009) of `getSchoolRatings()` output. Findings:
  - `assigned-school` — the chapter's headline caveat (nearest ≠ assigned), bucket `check`,
    tone `caution`, with an instruction `fallbackAction` to call the district (CONSTRAINT-015).
  - `nearest-public-{level}` — one per public level, `place {name,address}` + drive-minutes
    measure (miles fallback when no drive time), tone by ≤10/11–20/>20 commute tier.
  - `private-school-{i}` — each private school as its own finding with `place` + miles measure.
  - **Reuses the FR-080 `ClaimSchema.place` primitive — no schema change.**
- **`src/services/reportBuilder.js`:** wired `contract.chapters.schools` additively (guarded).
- **`tests/modules/schools/contract.test.js`:** +12 tests incl. 3 per-address snapshots
  (Georgetown full, Harlan rural, Jeffersonville IN).

## CONSTRAINT-001 note

The schools data carries **no ratings/scores** (GreatSchools appears only as an external
research link in the HTML), so the contract surfaces none — verified by test (no
score/grade/rating; no `"color"` in JSON).

## Discovered issue — flagged, NOT fixed here (surgical scope)

`getSchoolRatings()` (the chapter data path) does **not** call `checkCrossState`, unlike
`findNearestSchool()`/`findNearestElementarySchool()` (PM-001 / CONSTRAINT-006). A border
address (Jeffersonville IN) could surface a cross-state school in the chapter, and the data
shape carries no `location`/`state`, so the contract cannot flag it. **Recommend a dedicated
postmortem + FR** to route `getSchoolRatings` through `checkCrossState`. This FR faithfully
serializes whatever the data layer returns; the Jeffersonville snapshot documents current
behavior pending that fix.

## Verification

- Full suite: **92 suites / 1726 tests green** (1714 → +12), 12 snapshots.
- Regression: utilities + community + health + schema contract tests pass unchanged (AC-8).

## Follow-ups (carried)

- **NEW:** cross-state filter for `getSchoolRatings` (postmortem + FR) — CONSTRAINT-006 gap.
- Remaining rollout: 10 chapters. `place{}` next serves safety (fire/police) + reachability.
- Optional `lat/lng` on `place` when an FE map consumer exists; delete `defaultCopy` when FE owns voice.
