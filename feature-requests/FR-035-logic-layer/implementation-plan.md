# FR-035 Implementation Plan — Logic Layer (validate.js)

**Branch:** `fr-035-logic-layer`
**Approach:** TDD — tests written first, implementation second.
**Constraint:** No code changes in Phase 1 or 2 (discovery and spec already done).

---

## Ordered Tasks

### Stage 1 — Create branch
```
git checkout -b fr-035-logic-layer
```

### Stage 2 — Write tests FIRST (`tests/shared/validate.test.js`)
Write the full test file before any implementation. Tests cover:

**detectRuralMode:**
- Urban: population > 5000 → mode 'urban'
- Suburban: population > 1000, drive ≤ 20 → mode 'suburban'
- Rural: population ≤ 1000 → mode 'rural'
- Rural: population > 1000 but drive > 20 → mode 'rural'
- Remote: population ≤ 200 → mode 'remote'
- Remote: grocery drive > 45 → mode 'remote'
- Null avgDriveMinutes: classify by population only (no remote from drive time)
- 5 test addresses with representative population/drive inputs

**checkCrossState:**
- Same state → `{ valid: true, resultState: 'KY' }`
- Different state → `{ valid: false, resultState: 'KY' }` (Jeffersonville IN → KY school)
- Reverse geocode failure → `{ valid: true, resultState: '' }` (fail open)
- Empty originState → `{ valid: true, resultState: '' }`

**checkDriveTimeCoherence:**
- 20 min urban → ok
- 50 min urban → not ok, reason includes destination label
- 50 min rural → ok
- 50 min remote → ok
- 45 min suburban → ok (boundary: exactly 45 is fine, >45 fails)
- 46 min suburban → not ok

### Stage 3 — Implement `src/shared/validate.js`
Pure functions first (detectRuralMode, checkDriveTimeCoherence), then async (checkCrossState).

```
src/shared/validate.js
```

File structure:
1. `detectRuralMode(tractPopulation, avgDriveMinutes)` — pure, sync
2. `checkDriveTimeCoherence(driveTimeMinutes, destinationLabel, ruralMode)` — pure, sync
3. `checkCrossState(resultLatLng, originState)` — async, calls reverseGeocodeAddress

Imports: only `src/shared/google/reverseGeocode.js` (for checkCrossState).

Run tests: `npm test -- --testPathPattern=validate` → must all pass.

### Stage 4 — Add rural/coherence constants to `src/utils/constants.js`
Add named constants instead of magic numbers in validate.js:
- `RURAL_MODE_URBAN_POP_MIN = 5001`
- `RURAL_MODE_SUBURBAN_POP_MIN = 1001`
- `RURAL_MODE_REMOTE_POP_MAX = 200`
- `RURAL_MODE_SUBURBAN_MAX_DRIVE_MINUTES = 20`
- `DRIVE_TIME_COHERENCE_THRESHOLD_MINUTES = 45`

Import these into validate.js.

### Stage 5 — Wire `schools/data.js` to call `checkCrossState`
In `findNearestSchool` and `findNearestElementarySchool`:
- Add `originState` parameter
- After getting the result, call `checkCrossState(result.location, originState)`
- If `!valid`: throw an error with `Cross-state school rejected: ${result.name} is in ${resultState}, origin is ${originState}`
- Update the module exports signature (callers must pass originState)

Update `tests/modules/schools/data.test.js` to mock validate.js and add the Jeffersonville IN → KY rejection test that was deferred from FR-037.

### Stage 6 — Wire `health/data.js` to call `checkCrossState`
In `findNearestHospital` and `findNearestUrgentCare`:
- Add `originState` parameter
- After selecting the shortest-drive-time result, call `checkCrossState`
- If `!valid`: log a warning (don't throw — hospital is safety-critical, falling back to cross-state is better than no result)
- Attach `crossStateWarning: true` to the result object

### Stage 7 — Wire `reachability/data.js` to call `checkDriveTimeCoherence`
In `findNearestGrocery`, after building the sorted result array:
- Accept `ruralMode` as a parameter (caller provides from detectRuralMode output)
- For each result in the top 3, call `checkDriveTimeCoherence(result.driveTimeMinutes, 'grocery store', ruralMode)`
- If any result fails coherence and there are more candidates, retry with the next candidate
- If all fail coherence, attach `coherenceWarning: true` to each result

### Stage 8 — Run full test suite
```
npm test
```
All 37 existing tests must still pass. New validate.test.js must pass. Updated schools/data.test.js must pass.

### Stage 9 — Test on all 5 addresses
Manual verification (server running locally):
1. Georgetown KY — grocery result should be coherent, school should be KY
2. Harlan KY — extended drive times should be ok (rural mode)
3. Louisville KY — urban, tight results expected
4. Bozeman MT — school should be MT
5. Jeffersonville IN — school must be IN, not KY (PM-001 regression test)

### Stage 10 — Write summary.md and commit

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| reverseGeocode of result location costs API quota | Called only when result exists, not speculatively. Cached in test mocks. |
| schools caller doesn't yet pass originState | originState defaults to `''` → checkCrossState fails open. No breaking change. |
| Hospital throws instead of warns on cross-state | Health is safety-critical — fail open with warning, not rejection. |
| validate.js becomes a test of reverseGeocode | Mock reverseGeocode in tests so validate tests are pure unit tests. |
| Constants not yet in constants.js | Add in Stage 4 before wiring Stage 5-7. |

---

## Files Modified

| File | Change |
|------|--------|
| `src/shared/validate.js` | Created (new file) |
| `src/utils/constants.js` | Add 5 rural-mode and coherence constants |
| `src/modules/schools/data.js` | Add originState param, call checkCrossState |
| `src/modules/health/data.js` | Add originState param, call checkCrossState (warn only) |
| `src/modules/reachability/data.js` | Add ruralMode param, call checkDriveTimeCoherence |
| `tests/shared/validate.test.js` | Created (new file) |
| `tests/modules/schools/data.test.js` | Add Jeffersonville IN → KY rejection test |

## Files NOT Modified

- `src/app.js` — callers haven't been updated to pass state/ruralMode yet; that's Phase 4 (template layer)
- `src/premium.js` — same; premium callers come in a later FR
- `src/modules/access/data.js` — highways cross state lines by design, no cross-state check
- `src/modules/recreation/data.js` — parks don't have cross-state safety implications

---

## Definition of Done

- [ ] `src/shared/validate.js` exists and exports all three functions
- [ ] `tests/shared/validate.test.js` passes
- [ ] Jeffersonville IN → KY school rejection test passes in schools/data.test.js
- [ ] All 37 existing tests still pass (no regressions)
- [ ] All 5 test addresses verified manually
- [ ] summary.md written
- [ ] Committed and pushed on `fr-035-logic-layer` branch
