## What

Rollout **#3** of the headless report contract (after FR-078 utilities, FR-079 community, FR-080 health). Migrates the **schools** chapter to the `ChapterContract`. **4 of 14 chapters now on the contract.** Reuses the FR-080 `ClaimSchema.place` located-facility primitive — **no schema change**.

## Changes

- **`src/modules/schools/contract.js`**: `buildSchoolsContract(schools, opts)` — pure mapping of `getSchoolRatings()` output (no API calls / no HTML, CONSTRAINT-009). Findings:
  - `assigned-school` — the chapter's headline caveat (nearest ≠ assigned): bucket `check`, tone `caution`, instruction `fallbackAction` to call the district (CONSTRAINT-015).
  - `nearest-public-{level}` — `place {name,address}` + drive-minutes measure (miles fallback when no drive time), tone by ≤10/11–20/>20 commute tier.
  - `private-school-{i}` — each private school as its own finding with `place` + miles measure.
- **`src/services/reportBuilder.js`**: wire `contract.chapters.schools` additively (guarded).
- **Tests**: +12 incl. 3 per-address snapshots (Georgetown full, Harlan rural, Jeffersonville IN).

## CONSTRAINT-001

The schools data carries **no ratings/scores** (GreatSchools is an external link only), so the contract surfaces none — tested (no score/grade/rating; no `"color"` in JSON).

## ⚠️ Discovered issue — flagged, not fixed here (surgical scope)

`getSchoolRatings()` does **not** call `checkCrossState`, unlike `findNearestSchool()`/`findNearestElementarySchool()` (PM-001 / CONSTRAINT-006). A border address (Jeffersonville IN) could surface a cross-state school in the chapter, and the data shape carries no `location`/`state`, so the contract cannot flag it. **Recommend a dedicated postmortem + FR** to route `getSchoolRatings` through `checkCrossState`. This FR faithfully serializes whatever the data layer returns; the Jeffersonville snapshot documents current behavior pending that fix.

## Verification

- Full suite: **92 suites / 1726 tests green** (1714 → +12), 12 snapshots.
- Regression: utilities + community + health + schema contract tests pass unchanged.

See `feature-requests/FR-081-schools-contract/` for spec, plan, and summary.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
