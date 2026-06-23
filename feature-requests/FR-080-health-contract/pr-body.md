## What

Rollout **#2** of the headless report contract (after FR-078 utilities, FR-079 community). Migrates the **health** chapter (ER / urgent care / healthcare depth) to the versioned, presentation-free `ChapterContract`. **3 of 14 chapters now on the contract.**

## Changes

- **Schema** (`src/contract/schema.js`): one optional, non-breaking field — `ClaimSchema.place {name, address}` (`.strict().nullable().optional()`). Durable home for the recurring **located-facility** shape (health, schools, safety, reachability). schemaVersion stays **1.0**; existing utilities/community contracts validate unchanged. Coordinates deliberately excluded until a real FE map consumer exists.
- **`src/modules/health/contract.js`**: `buildHealthContract({hospital, urgentCare, healthcareDepth}, opts)` — pure mapping, no API calls / no HTML (CONSTRAINT-009). Findings: `emergency-room` (place + `drive_minutes` measure, tone by ≤10/11–20/>20 tier), `urgent-care` (favorable if closer than ER), `hospital-type` (CMS), `primary-care` (CMS NPI, count measure), plus `*-missing` variants with actionable `fallbackAction` (CONSTRAINT-015).
- **`src/services/reportBuilder.js`**: wire `contract.chapters.health` additively (guarded).
- **Tests**: +18 incl. 3 per-address snapshots (Georgetown suburban, Harlan rural critical-access, Jeffersonville IN cross-state).

## Key decisions

- **ADR-1** — boundary = health module only; fire/police ("emergency") is the safety module's data, so it gets its own contract later; the FE composes the visual chapter.
- **ADR-2** — add `place{}` to the schema rather than cramming the name into `subject` + address into `defaultCopy` (lossy, since `defaultCopy` is slated for deletion). `place` is domain modeling of data ~5 chapters produce — not the mechanism-level speculation the FR-078 "don't-expand-early" ADR warns against.

## Constraints

- CONSTRAINT-003 (drive-time-verified hospital, PM-003) preserved upstream — contract only serializes.
- CONSTRAINT-006 cross-state (Jeffersonville) → `tone: caution` + note in `defaultCopy`.
- CONSTRAINT-001/008 — no score/grade/rating; no `"color"` in serialized JSON (tested).

## Verification

- Full suite: **91 suites / 1714 tests green** (1696 → +18), 9 snapshots.
- Regression: utilities + community + schema contract tests pass unchanged.

See `feature-requests/FR-080-health-contract/` for spec, plan, and summary.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
