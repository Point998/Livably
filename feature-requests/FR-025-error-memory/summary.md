# FR-025: Implementation Summary

## What Was Built

Three-part error memory system: structured logging, pattern analysis, and auto-mitigations.

### New Files
- **`src/logger.js`** — Appends JSON lines to `data/logs/YYYY-MM-DD.jsonl`. Exports `logRequest`, `logError`, `logAnalysis`, `readRecentLogs`. All writes are wrapped in try/catch — the logger cannot crash the app.
- **`src/errorMemory.js`** — Reads mitigations from `data/mitigations.json` at call time. Pattern analyzer reads 7-day log window, aggregates failure rates per function, writes `data/error-patterns.json`, and auto-applies mitigations when thresholds are crossed.

### Changes to `app.js`
- Added requires for `logger` and `errorMemory` at top
- `/report` route now records start time, calls `logRequest` on both success and error paths, calls `logError` in the catch block before returning error HTML, then fires `logAnalysis()` async (via `setImmediate`)
- Two silent `catch {}` blocks converted to `catch (e)` with `logError` — grocery drive-time failures and hospital drive-time failures now surface in the log
- Premium data catch now calls `logError('getPremiumData', ...)`
- `findNearestGrocery` reads its search radius from `getMitigation('findNearestGrocery', 'searchRadiusM', 8000)` — if the auto-mitigation fires, it will expand to 12,000m automatically
- New `GET /admin/health` route (localhost-only) showing request stats, function failure rates, active mitigations, recent errors, and API usage

### Auto-Mitigation Rules
| Function | Threshold | Auto-Action |
|----------|-----------|-------------|
| `findNearestGrocery` | >15% failure rate | Expand search radius 8km → 12km (one-time, idempotent) |
| `findNearestHospital` | >15% | Flag only — already uses 50km radius |
| `findNearestPharmacy` | >15% | Flag only — uses `rankby:distance`, no radius param |
| `findNearestUrgentCare` | >15% | Flag only — same reason |
| `findNearestHighwayOnRamp` | >20% | Flag only — BUG-003: never auto-change highway params |
| `getPremiumData` | >20% | Flag only |

## Test Results

- Georgetown address: logged `[REQUEST] success 3240ms` ✓
- Invalid address: logged `[ERROR] report | Unable to geocode the address.` + `[REQUEST] error ADDRESS_NOT_FOUND 283ms` ✓
- `/admin/health` renders correctly with live stats ✓
- Pattern analysis writes `data/error-patterns.json` after each request ✓
- No npm packages added

## Deviations from Plan

None. All tasks completed as specified.
