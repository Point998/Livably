# FR-041 Spec — Services and Routes
*Phase 5 (Final Architectural Extraction)*
*Status: Spec*

---

## What This Is

Extract report generation from the `/report` route handler in `src/app.js` into `src/services/reportBuilder.js`. After this FR, `app.js` is purely Express configuration and middleware (~30 lines). `reportBuilder.js` becomes the single orchestrator for the entire report lifecycle.

This is the final piece of the module restructure. After FR-041, the architecture described in `docs/plans/module-restructure.md` is fully realized.

---

## The Problem

Currently the `/report` route handler in `app.js` does everything:
- Geocoding the input address
- Calling every data module in parallel
- Running validation and coherence checks
- Rendering the full HTML report
- Persisting the report to disk
- Returning the response

This mixes Express concerns (routing, HTTP) with application concerns (data orchestration, rendering). The route handler cannot be tested without starting Express.

---

## What reportBuilder.js Does

```js
// src/services/reportBuilder.js

async function buildReport(address, options = {}) {
  // 1. Geocode address → originLatLng, originState, locationInfo
  // 2. Detect rural mode (detectRuralMode from validate.js)
  // 3. Run all module data fetches in parallel (Promise.allSettled)
  // 4. Validate coherence on each result (checkCrossState, checkDriveTimeCoherence)
  // 5. Run all module logic layers (when logic.js files exist)
  // 6. Render full HTML report (chapter templates from FR-039)
  // 7. Return { html: string, metadata: object }
}

module.exports = { buildReport };
```

`buildReport` accepts an address string and returns a complete report object. It never touches Express objects (`req`, `res`).

---

## What app.js Looks Like After FR-041

```js
// src/app.js — ~30 lines after extraction
const express = require('express');
const { buildReport } = require('./services/reportBuilder');
const { saveReport, getReport } = require('./services/reportStore');

const app = express();
app.use(express.static('public'));

app.post('/report', async (req, res) => {
  const { address } = req.body;
  const report = await buildReport(address);
  const id = await saveReport(report);
  res.redirect(`/report/${id}`);
});

app.get('/report/:id', async (req, res) => {
  const report = await getReport(req.params.id);
  res.send(report.html);
});

app.listen(process.env.PORT || 3000);
```

---

## Migration Strategy

1. Create `src/services/reportBuilder.js` with the full orchestration logic extracted from the route handler
2. Create `src/services/reportStore.js` with report persistence functions (`loadReports`, `saveReport`, `getReport`, `updateReportAccess`) extracted from app.js
3. Replace the route handler body with calls to `buildReport` and `reportStore`
4. Verify: server starts, all 5 test addresses return HTTP 200 with identical output
5. Verify: `npm test` still passes (37+ tests)

---

## What Stays in app.js

- Express initialization
- Static file serving
- Route definitions (the 3-4 `app.get` / `app.post` calls)
- `app.listen`

That is all. No data fetching, no HTML generation, no business logic.

---

## What Moves to reportBuilder.js

- Address geocoding call
- `originState` extraction (prerequisite for validate.js cross-state checks to be active)
- `detectRuralMode` call (makes rural mode detection active for all callers)
- All module data function calls
- Coherence validation passes
- Report HTML assembly
- Error handling and graceful degradation fallbacks (CONSTRAINT-015)

---

## Acceptance Criteria

- [ ] `src/services/reportBuilder.js` exists and exports `buildReport`
- [ ] `src/services/reportStore.js` exists and exports `saveReport`, `getReport`, `loadReports`, `updateReportAccess`
- [ ] `app.js` is ≤ 40 lines
- [ ] `app.js` contains no HTML generation, no API calls, no business logic
- [ ] `originState` is passed to all module data functions that accept it (activates CONSTRAINT-006 enforcement)
- [ ] `ruralMode` is passed to `findNearestGrocery` (activates CONSTRAINT-010 enforcement)
- [ ] Server HTTP 200 on all 5 test addresses
- [ ] `npm test` passes (no regressions)
- [ ] `tests/services/reportBuilder.test.js` covers the orchestration flow with mocked modules
