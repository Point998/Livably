# FR-040 Spec — Test Suite Expansion
*Phase 3 of the Module Restructure*
*Status: Spec*

---

## What This Is

Expand the Jest test suite to cover every numbered constraint in CLAUDE.md and every business rule in the logic layer. Every constraint must have at least one corresponding test. Tests must run before any deployment (CONSTRAINT-011).

---

## Required Test Coverage

### CONSTRAINT-001: No scoring
- Test that no chapter template function returns HTML containing score-related patterns (`score`, `grade`, `rating`, `ring`, numeric quality indicators)

### CONSTRAINT-002: Fair Housing
- Test that `src/modules/community/logic.js` (when built) produces no output containing demographic characterizations
- Pattern match for: racial/ethnic terms, income class labels, "good neighborhood", demographic composition language

### CONSTRAINT-003: Hospital verified by drive time
- Test that `findNearestHospital` returns the shorter-drive-time hospital even when a different hospital appears first in search results
- Already partially covered in `tests/modules/health/data.test.js` — expand to cover edge cases

### CONSTRAINT-006: Cross-state filtering
- Test that `checkCrossState` rejects a KY school when origin is Jeffersonville IN (PM-001 regression)
- Test that cross-state hospital returns `crossStateWarning: true` rather than throwing
- Already covered in FR-035 — verify in integration context

### CONSTRAINT-007: Rural mode detection
- Test all four modes (urban/suburban/rural/remote) with boundary values
- Test null avgDriveMinutes handling
- Already covered in FR-035 — verify thresholds match real census data for test addresses

### CONSTRAINT-008: No inline styles
- Test that no template function output contains `style="` (string pattern match)
- Run against all 6 component functions and all 13 chapter template functions

### CONSTRAINT-009: No layer violations
- Test that no `data.js` file exports any function that returns an HTML string
- Test that no `template.js` file contains `require('axios')`, `require('@googlemaps')`, or direct API calls

### CONSTRAINT-010: Drive time coherence
- Test that `checkDriveTimeCoherence` flags suburban grocery at 50 min
- Test that rural mode suppresses coherence warnings at any drive time
- Already covered in FR-035

### CONSTRAINT-011: No feature ships without tests
- Meta-test: assert that for every file in `src/modules/*/data.js`, a corresponding test file exists in `tests/modules/*/data.test.js`

### CONSTRAINT-014: Logic layer is sole owner of coherence rules
- Test that no module data.js file contains its own state comparison logic
- Static analysis: grep for `=== state` or `!== state` in module data files — should find zero matches

---

## Jeffersonville IN Regression Suite

The Jeffersonville IN address (1007 Stonelilly Dr, Jeffersonville, IN 47130) must have explicit test coverage for every module that searches by location:
- `findNearestSchool` with originState='IN' → must not return a KY school
- `findNearestHospital` with originState='IN' → cross-state hospital gets warning, not rejection
- `findNearestGrocery` → coherence check applied

---

## Test File Structure

```
tests/
  constraints/
    no-scoring.test.js        ← CONSTRAINT-001
    fair-housing.test.js      ← CONSTRAINT-002
    no-inline-styles.test.js  ← CONSTRAINT-008
    no-layer-violations.test.js ← CONSTRAINT-009
    layer-ownership.test.js   ← CONSTRAINT-014
    test-coverage.test.js     ← CONSTRAINT-011 (meta)
  integration/
    jeffersonville-in.test.js ← PM-001 regression suite
```

---

## Acceptance Criteria

- [x] Every numbered constraint in CLAUDE.md (001–016) has at least one test
- [x] Jeffersonville IN regression suite covers schools, health, reachability
- [x] All tests are pure unit tests (no API calls, all dependencies mocked)
- [x] `npm test` runs the full suite in under 30 seconds
- [x] No test skips (`test.skip`) committed to main
- [x] CI-ready: tests can run in GitHub Actions without env vars (all mocked)

**Note:** CONSTRAINT-016 was added after original spec was written (PM-004, NOAA metadata reliability).
