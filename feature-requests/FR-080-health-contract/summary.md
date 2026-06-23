# FR-080 — Health chapter → headless report contract · Summary

**Status:** Complete · **Branch:** `FR-080-health-contract` · **Date:** 2026-06-23
**Rollout #2** of the headless contract (after FR-078 utilities, FR-079 community).
**3 of 14 chapters now on the contract.**

## What shipped

- **Schema evolution (`src/contract/schema.js`):** added one optional, non-breaking
  field — `PlaceSchema {name, address}` on `ClaimSchema.place` (`.strict().nullable().optional()`).
  Durable home for the recurring **located-facility** shape (health, schools, safety,
  reachability). Coordinates deliberately excluded until a real FE map consumer exists.
  schemaVersion stays **1.0** (additive). Existing utilities/community contracts validate unchanged.
- **`src/modules/health/contract.js`:** `buildHealthContract({hospital, urgentCare, healthcareDepth}, opts)`.
  Pure mapping (no API calls, no HTML — CONSTRAINT-009). Findings:
  `emergency-room` (place + drive_minutes measure, tone by ≤10/11–20/>20 tier),
  `urgent-care` (favorable if closer than ER), `hospital-type` (CMS designation),
  `primary-care` (count measure, tone by count tier), plus `*-missing` variants with
  actionable `fallbackAction` (CONSTRAINT-015).
- **`src/services/reportBuilder.js`:** wired `contract.chapters.health` additively (guarded).
- **`tests/modules/health/contract.test.js`:** +18 tests incl. 3 per-address snapshots
  (Georgetown suburban, Harlan rural critical-access, Jeffersonville IN cross-state).

## Key decisions (ADRs)

- **ADR-1 — boundary = health module only.** Fire/police ("emergency") is the safety
  module's data → its own contract later; the FE composes the two into one visual chapter.
- **ADR-2 — add `place{}` to the schema** rather than cramming name into `subject` +
  address into `defaultCopy`. The latter is lossy (FR-078 deletes `defaultCopy`). `place`
  is domain modeling of data ~5 chapters produce — not the *mechanism* speculation the
  FR-078 "don't expand early" ADR warns against. (Reasoned via /vibe-architect.)
- **CONSTRAINT-003** preserved — drive-time-verified hospital/urgent care arrive from the
  data layer (PM-003); the contract only serializes.
- **Cross-state** (CONSTRAINT-006, Jeffersonville) → `tone: caution` + note in `defaultCopy`;
  a structured cross-state flag is a deferred follow-up (true edge, not a recurring shape).

## Verification

- Full suite: **91 suites / 1714 tests green** (was 1696 → +18), 9 snapshots.
- Regression: utilities + community + schema contract tests pass unchanged (AC-10).
- CONSTRAINT-001/008: no score/grade/rating; no `"color"` in serialized JSON (tested).

## Follow-ups (carried)

- Optional `lat/lng` on `place` when an FE map consumer exists (non-breaking add).
- Structured cross-state flag if a 2nd chapter needs it.
- Remaining rollout: 11 chapters (access, climate, costs, garden, growth, property,
  reachability, recreation, safety, schools, sensory, traffic, walkability — settle the
  16-folder vs 14-chapter count as `place`-bearing located-facility chapters land).
- Precise ACS/research vintage in `provenance.asOf`; delete `defaultCopy` when FE owns voice.
