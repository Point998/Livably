# FR-080 — Implementation Plan

Ordered by layer. TDD: write/extend tests alongside each step.

## Task 1 — Schema (contract layer)
- `src/contract/schema.js`: add optional `place` to `ClaimSchema`:
  `place: z.object({ name: z.string(), address: z.string() }).strict().nullable().optional()`.
- Risk: must be optional so existing utilities/community contracts validate unchanged.
  Verified by running their existing tests after the edit (AC-10).
- No schemaVersion bump (additive/non-breaking).

## Task 2 — Health contract builder (maps logic → contract)
- New `src/modules/health/contract.js` exporting `buildHealthContract(input, opts)`.
- `input = { hospital, urgentCare, healthcareDepth }`; `opts = { asOf?, degraded? }`.
- Pure mapping — no API calls, no HTML (CONSTRAINT-009). Mirrors community/contract.js style.
- Helpers: `erTone(mins)`, `pcTone(count)`. Builds findings per spec table, then
  `provenanceSummary` dedupe, then `safeBuild('health', ...)`.
- Return null when all three inputs are null-ish.

## Task 3 — Tests (alongside Task 2)
- New `tests/modules/health/contract.test.js`:
  - null input → null
  - full input: schema-valid; ER place + measure; tones; provenance
  - drive-time tone tiers (≤10 / 11–20 / >20)
  - urgent-care closer-than-ER → favorable
  - missing hospital → emergency-room-missing + fallbackAction (CONSTRAINT-015)
  - cross-state hospital → tone caution + defaultCopy note (CONSTRAINT-006)
  - primary-care count tiers
  - no score/grade/rating; no "color" in JSON (CONSTRAINT-001/008)
  - per-address snapshots incl. Jeffersonville IN (CONSTRAINT-011)
- Regression: run existing `tests/modules/utilities/contract.test.js` +
  `tests/modules/community/contract.test.js` + `tests/contract/schema.test.js`
  unchanged (AC-10).

## Task 4 — Wire into report envelope
- `src/services/reportBuilder.js`: import `buildHealthContract`; add
  `health` key to `contract.chapters` (additive, guarded like utilities/community).

## Task 5 — Verify
- `npx jest` full suite green; confirm count delta.
- Grep the wired path is reached; sanity that schemaVersion stays '1.0'.

## Risks / unknowns
- The `place` field is the first schema evolution; the regression run on existing
  contract tests is the guardrail.
- `healthcareDepth` shape from CMS/NPI can be partially null — handle each datum
  independently (designation vs primaryCareCount), as the template already does.
