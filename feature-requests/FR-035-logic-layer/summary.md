# FR-035 Summary — Logic Layer (validate.js)
*Phase 2 of the Module Restructure*
*Status: Complete*
*Date: 2026-05-26*

---

## What Was Built

Created `src/shared/validate.js` — the single shared coherence layer (CONSTRAINT-014).
Three enforcement rules implemented:

| Function | Constraint | Type |
|----------|-----------|------|
| `detectRuralMode(tractPopulation, avgDriveMinutes)` | CONSTRAINT-007 | Pure/sync |
| `checkCrossState(resultLatLng, originState)` | CONSTRAINT-006 | Async |
| `checkDriveTimeCoherence(driveTimeMinutes, destinationLabel, ruralMode)` | CONSTRAINT-010 | Pure/sync |

### New Files
- `src/shared/validate.js` — the Logic Layer
- `tests/shared/validate.test.js` — 28 tests covering all rules and all 5 test addresses

### Modified Files
- `src/utils/constants.js` — added 5 rural-mode/coherence constants
- `src/modules/schools/data.js` — wired `checkCrossState`, added `originState` param
- `src/modules/health/data.js` — wired `checkCrossState` (warn only — safety-critical), added `originState` param
- `src/modules/reachability/data.js` — wired `checkDriveTimeCoherence`, added `ruralMode` param
- `tests/modules/schools/data.test.js` — added PM-001 regression test (Jeffersonville IN → KY rejection)
- `tests/modules/health/data.test.js` — added cross-state warning test
- `tests/modules/reachability/data.test.js` — added coherence warning tests

---

## Test Results

```
Before FR-035: 37 tests, 10 suites
After FR-035:  70 tests, 11 suites
New tests:     33
Regressions:   0
```

---

## Key Decisions

### Hospital warns, doesn't reject cross-state
`findNearestHospital` attaches `crossStateWarning: true` rather than throwing. A cross-state hospital is better than no hospital for a safety-critical finding. The template layer will surface the warning to the buyer.

### Reachability flags but doesn't drop incoherent results
`findNearestGrocery` attaches `coherenceWarning: true` to results >45 min rather than dropping them. Dropping silently would leave the buyer with no data. The template layer decides whether to surface the warning.

### checkCrossState fails open
If reverse geocoding of the result location fails, the check returns `valid: true`. Blocking a real in-state result due to a transient API error is worse than passing a potential cross-state result. Failure is logged implicitly by the try/catch.

### app.js and premium.js callers not updated
These callers don't yet pass `originState` or `ruralMode` — both default to safe values (`''` → fail open for cross-state; `'suburban'` → conservative coherence). Caller updates happen in Phase 4 (template layer) when the route handlers are restructured.

---

## Notes for Next FRs

- **FR-040 (Test Suite):** `detectRuralMode` has no integration tests against real Census data. The 5-address population inputs in validate.test.js are representative estimates, not real Census values.
- **Phase 4 (Template Layer):** `app.js` route handlers must start passing `originState` (from reverseGeocodeAddress at report start) to `findNearestSchool`, `findNearestHospital`, and `findNearestUrgentCare`. Until then, cross-state rejection for schools is inactive.
- **community/logic.js:** Fair Housing compliance checks are not in validate.js by design — they live in the community module's logic layer and reference only that module's data. CONSTRAINT-014 applies to cross-module rules only.
