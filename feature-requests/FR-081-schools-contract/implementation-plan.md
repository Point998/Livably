# FR-081 — Implementation Plan

Ordered by layer. TDD alongside. No schema change (reuses FR-080 `place`).

## Task 1 — Schools contract builder
- New `src/modules/schools/contract.js` exporting `buildSchoolsContract(schools, opts)`.
- Pure mapping — no API calls, no HTML (CONSTRAINT-009). Mirrors health/contract.js style.
- Local `commuteTone(mins)` helper (≤10/11–20/>20). Build findings per spec:
  `assigned-school` (headline check) → public-per-level → private-per-school.
- Return null when schools null or no public(non-null)/private entries.

## Task 2 — Tests (alongside Task 1)
- New `tests/modules/schools/contract.test.js`:
  - null / empty → null
  - full input schema-valid
  - assigned-school: bucket check, tone caution, instruction fallbackAction
  - public findings: place + measure; tone tiers; miles fallback when drive null
  - private findings: place + miles measure, bucket cool, one per entry
  - no score/grade/rating; no "color" in JSON
  - per-address snapshots incl. Jeffersonville IN
- Regression: existing utilities/community/health/schema contract tests unchanged.

## Task 3 — Wire into report envelope
- `reportBuilder.js`: import `buildSchoolsContract`; add `schools` key to
  `contract.chapters` (additive, guarded).

## Task 4 — Verify
- `npx jest` full suite green; confirm count delta.

## Risks
- None structural (no schema change). The cross-state gap in `getSchoolRatings` is
  pre-existing and explicitly out of scope (flagged in spec + roadmap follow-up).
