# FR-041 Summary — Services and Routes

**Branch:** `fr-041-services-routes`
**Date:** 2026-05-27
**Status:** Complete

---

## What Was Done

Extracted all business logic and HTML generation from `src/app.js` (1,128 lines) into dedicated service and template files. `app.js` is now a pure Express configuration shell (167 lines) with zero HTML generation, zero business logic, and zero direct API calls.

### Files Created

**Services:**
- `src/services/reportStore.js` — file-based report persistence (saveReport, getReport, updateReportAccess, loadReports, ensureReportsFile)
- `src/services/reportBuilder.js` — report orchestration (geocode → fetch → render → return {html})
- `src/services/compareBuilder.js` — comparison data orchestration

**Page Templates:**
- `src/templates/pages/reportPage.js` — main report HTML (buildReportHTML + section helpers)
- `src/templates/pages/errorPage.js` — error and loading HTML
- `src/templates/pages/comparePage.js` — compare feature HTML
- `src/templates/pages/adminPage.js` — admin health dashboard HTML

**Tests:**
- `tests/services/reportStore.test.js`
- `tests/services/reportBuilder.test.js`
- `tests/templates/pages/reportPage.test.js`
- `tests/templates/pages/errorPage.test.js`
- `tests/templates/pages/comparePage.test.js`

### Key Improvements

**CONSTRAINT-006 activated:** `originState` (from `reverseGeocodeAddress`) is now passed to `findNearestHospital`, `findNearestUrgentCare`, `findNearestSchool`, and `findNearestElementarySchool`. Cross-state filtering was previously bypassed by no-arg calls; it is now enforced for all four functions.

**CONSTRAINT-008 fix:** Pre-existing inline `style="--path-len:..."` attributes on SVG icons in `reportPage.js` were removed. CSS fallback values handle the animation.

---

## Acceptance Criteria

- [x] `src/services/reportBuilder.js` exists and exports `buildReport`, `classifyError`
- [x] `src/services/reportStore.js` exists and exports `saveReport`, `getReport`, `loadReports`, `updateReportAccess`
- [x] `app.js` is 167 lines (down from 1,128)
- [x] `app.js` contains no HTML generation
- [x] `app.js` contains no API calls
- [x] `app.js` contains no business logic definitions
- [x] `originState` passed to hospital, urgentCare, school, elementarySchool (CONSTRAINT-006 active)
- [x] All 9 routes preserved in app.js
- [x] `npm test` passes — 189 tests

---

## Deferred Items

- **ruralMode wiring:** `detectRuralMode` requires `tractPopulation` from census data (currently in premium.js). `findNearestGrocery` defaults to `ruralMode='suburban'`. Activate in a future FR when census data is hoisted to the main fetch.
- **Admin inline styles:** `adminPage.js` contains pre-existing CONSTRAINT-008 violations (inline styles in the admin dashboard). Out of scope — deferred.
- **`buildHeroInsightRowsHTML` logic/HTML mix:** This function in `reportPage.js` contains business rules (drive time thresholds, radon zones) — CONSTRAINT-009 debt. Deferred.
