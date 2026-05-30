# FR-040 Summary — Test Suite Expansion
*Completed: May 2026*

## What Shipped

Expanded the Jest test suite to cover every numbered constraint in CLAUDE.md and key business rules in the logic layer.

**Constraint test files:**
- `tests/constraints/no-scoring.test.js` — CONSTRAINT-001 (enhanced May 2026: added `display-num` class and `index (0-N)` range patterns)
- `tests/constraints/fair-housing.test.js` — CONSTRAINT-002
- `tests/constraints/no-inline-styles.test.js` — CONSTRAINT-008
- `tests/constraints/no-layer-violations.test.js` — CONSTRAINT-009
- `tests/constraints/test-coverage.test.js` — CONSTRAINT-011 (meta-test)
- `tests/constraints/layer-ownership.test.js` — CONSTRAINT-014 (auto-discovers all 13 modules)
- `tests/constraints/noaa-metadata.test.js` — CONSTRAINT-016 (static analysis on climate/data.js)

**Logic layer coverage (via validate.test.js):**
- CONSTRAINT-003 (hospital drive-time verification)
- CONSTRAINT-006 (cross-state filtering)
- CONSTRAINT-007 (rural mode detection — all 4 modes with boundary values)
- CONSTRAINT-010 (drive-time coherence — suburban 50 min flagged, rural suppressed)

**Jeffersonville IN regression suite (`tests/integration/jeffersonville-in.test.js`):**
- PM-001 regression: KY school rejected, IN school accepted, cross-state check called for every candidate
- CONSTRAINT-006: hospital cross-state returns `crossStateWarning: true` (not rejection)
- CONSTRAINT-010: grocery coherence check called with drive time + ruralMode; `coherenceWarning` flag set for > 45 min suburban result

## Final state

837 tests across 57 suites. All pass. All constraints 001–016 have coverage. Full suite runs in ~12 seconds.
