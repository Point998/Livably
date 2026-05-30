# FR-040 Test Suite Expansion — Implementation Plan
*May 2026*

## Current State (as of May 2026)

Most FR-040 coverage is already implemented. The following constraint tests exist:

| Constraint | Test File | Status |
|---|---|---|
| CONSTRAINT-001 (no scoring) | `tests/constraints/no-scoring.test.js` | ✅ Done — enhanced May 2026 to catch `display-num` and `index (0-N)` patterns |
| CONSTRAINT-002 (fair housing) | `tests/constraints/fair-housing.test.js` | ✅ Done |
| CONSTRAINT-003 (hospital drive-time) | `tests/modules/health/data.test.js` | ✅ Done |
| CONSTRAINT-006 (cross-state) | `tests/shared/validate.test.js` | ✅ Done |
| CONSTRAINT-007 (rural mode) | `tests/shared/validate.test.js` | ✅ Done |
| CONSTRAINT-008 (no inline styles) | `tests/constraints/no-inline-styles.test.js` | ✅ Done |
| CONSTRAINT-009 (no layer violations) | `tests/constraints/no-layer-violations.test.js` | ✅ Done |
| CONSTRAINT-010 (drive-time coherence) | `tests/shared/validate.test.js` | ✅ Done |
| CONSTRAINT-011 (test coverage meta) | `tests/constraints/test-coverage.test.js` | ✅ Done |
| CONSTRAINT-014 (logic layer ownership) | None | ❌ Missing |
| CONSTRAINT-016 (NOAA metadata) | None | ❌ Missing |
| Jeffersonville IN regression | `tests/integration/jeffersonville-in.test.js` | ⚠️ Minimal — needs expansion |

## Remaining Work

### Task 1: `tests/constraints/layer-ownership.test.js` (CONSTRAINT-014)

Static analysis — assert no module `data.js` file contains its own state comparison logic.

```js
'use strict';
const fs = require('fs');
const path = require('path');
const glob = require('glob'); // or use fs.readdirSync

// Find all data.js files under src/modules/
function findDataFiles() {
  const modulesDir = path.join(__dirname, '../../src/modules');
  const result = [];
  for (const mod of fs.readdirSync(modulesDir)) {
    const f = path.join(modulesDir, mod, 'data.js');
    if (fs.existsSync(f)) result.push({ mod, path: f });
  }
  return result;
}

describe('CONSTRAINT-014: Logic layer owns all coherence rules', () => {
  const dataFiles = findDataFiles();

  dataFiles.forEach(({ mod, path: filePath }) => {
    test(`${mod}/data.js contains no inline state comparison logic`, () => {
      const src = fs.readFileSync(filePath, 'utf8');
      // No direct state string comparisons — all state logic goes through validate.js
      expect(src).not.toMatch(/\.state\s*===\s*['"][A-Z]{2}['"]/);
      expect(src).not.toMatch(/\.state\s*!==\s*['"][A-Z]{2}['"]/);
      // No inline cross-state filtering
      expect(src).not.toMatch(/originState\s*===\s*result\.state/);
    });
  });
});
```

### Task 2: `tests/constraints/noaa-metadata.test.js` (CONSTRAINT-016)

Verify that `getNOAAClimateNormals` (in `src/chapters.js`) validates actual record content before accepting a station.

```js
'use strict';
// Static analysis — confirm the validation pattern is present in chapters.js
const fs = require('fs');
const path = require('path');

describe('CONSTRAINT-016: NOAA station records validated before acceptance', () => {
  test('chapters.js validates MLY-TMAX-NORMAL presence in returned records', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../src/chapters.js'),
      'utf8'
    );
    // The validation check must exist: only accept station if TMAX records present
    expect(src).toMatch(/MLY-TMAX-NORMAL/);
    // Must skip stations without confirmed data (not just trust metadata filter)
    expect(src).toMatch(/Skip stations whose records lack actual temperature data|MLY-TMAX-NORMAL.*continue/);
  });
});
```

### Task 3: Expand `tests/integration/jeffersonville-in.test.js`

Read the current file and expand to cover the full regression spec from FR-040:
- `findNearestSchool(originLatLng, 'IN')` → must reject KY schools
- `checkCrossState(result, 'IN')` → hospital in KY returns `crossStateWarning: true`, not rejection
- `findNearestGrocery` coherence check applied

### Task 4: Update FR-040 spec acceptance criteria

Update `feature-requests/FR-040-test-suite/spec.md` acceptance criteria to reflect CONSTRAINT-016 was added after original spec.

## Acceptance Criteria (revised)
- [x] CONSTRAINT-001 through CONSTRAINT-011 have at least one test
- [x] `npm test` runs full suite in under 30 seconds
- [x] No test.skip on main
- [ ] CONSTRAINT-014 has static analysis test
- [ ] CONSTRAINT-016 has static analysis test
- [ ] Jeffersonville IN regression suite covers schools, health, reachability with mocked API data
