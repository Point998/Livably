# FR-025: Implementation Plan

## Task Order

### Task 1 — Create `src/logger.js`

New module with three exported functions:

```js
logRequest(address, outcome, durationMs, errorType)
logError(fn, address, error, context)
logAnalysis()  // runs pattern analysis + writes error-patterns.json + applies mitigations
```

Implementation details:
- Log dir: `data/logs/`; auto-created on first write
- File name: `YYYY-MM-DD.jsonl` based on UTC date
- Each call appends one JSON line + newline (`fs.appendFileSync`)
- All writes wrapped in try/catch — logger must never throw
- `logAnalysis()` reads last 7 days of log files, aggregates by function, writes `data/error-patterns.json`, then calls `applyMitigations(patterns)`

### Task 2 — Create `src/errorMemory.js`

New module for reading and writing `data/mitigations.json`:

```js
getMitigation(fn, key, defaultValue)   // read a param for a function
applyMitigations(patterns)             // rule engine — writes mitigations.json if triggered
```

Mitigation rules encoded as constants:
```js
const RULES = [
  { fn: 'findNearestHospital', key: 'searchRadiusM', threshold: 0.15, expandedValue: 16000 },
  { fn: 'findNearestGrocery',  key: 'searchRadiusM', threshold: 0.15, expandedValue: 12000 },
  { fn: 'findNearestPharmacy', key: 'searchRadiusM', threshold: 0.15, expandedValue: 10000 },
  { fn: 'findNearestUrgentCare', key: 'searchRadiusM', threshold: 0.15, expandedValue: 16000 },
];
```

`getMitigation` reads `mitigations.json` on each call (cheap — small file). Falls back to `defaultValue` if file missing or key not present.

### Task 3 — Wire logger into `app.js`

Changes to `app.js`:

1. **Require** `logger` and `getMitigation` at top
2. **`/report` route** — wrap in timing, call `logRequest` before return, call `logError` in the catch block before `classifyError`
3. **Silent catch blocks** (lines 246, 333) — add `logger.logError(fnName, address, e)` before `return null`
4. **Premium catch** (line 1709) — add `logger.logError('getPremiumData', address, premErr)` before the existing `console.error`
5. Call `logger.logAnalysis()` after each successful log write (async, fire-and-forget — don't await)

### Task 4 — Update search functions to read mitigations

Four functions need to read their radius from `getMitigation`:

- `findNearestHospital`: `const radius = getMitigation('findNearestHospital', 'searchRadiusM', 10000)`
- `findNearestGrocery`: `const radius = getMitigation('findNearestGrocery', 'searchRadiusM', 8000)`
- `findNearestPharmacy`: `const radius = getMitigation('findNearestPharmacy', 'searchRadiusM', 5000)`
- `findNearestUrgentCare`: `const radius = getMitigation('findNearestUrgentCare', 'searchRadiusM', 8000)`

Each function already uses a hardcoded radius in its Places API call — replace with the variable.

### Task 5 — Add `/admin/health` route

Simple HTML route in `app.js`:
- Read `data/error-patterns.json` (if exists)
- Read `data/mitigations.json` (if exists)
- Read last 20 error entries from today's log file
- Call `getUsageStats()` from rateLimit.js
- Return styled HTML (match Livably design system — cream background, dark ink, gold accents)

Route: `GET /admin/health`

### Task 6 — Test

1. Start server
2. Run Georgetown address → verify `data/logs/YYYY-MM-DD.jsonl` has a request entry
3. Run a bad address (`xyz 123 nowhere`) → verify error entry logged with correct `fn` and `errorType`
4. Check `/admin/health` renders without errors
5. Manually set a function's failure rate in patterns.json above threshold → verify mitigation applies to mitigations.json
6. Verify server still starts and runs cleanly

---

## Risks

- **`fs.appendFileSync` on hot path**: Each report request writes to disk synchronously. For low traffic this is fine. If this becomes a bottleneck later, switch to a write queue. Not a concern at current scale.
- **Log file growth**: JSONL files are small (one line per event). 1,000 reports/day ≈ 200KB/day. Seven days = ~1.4MB. Not a concern.
- **`logAnalysis()` running on every request**: Analysis reads up to 7 days of logs. Fire-and-forget (don't await) so it doesn't block the response. If it becomes slow, add a cooldown (only run if last run was >5 min ago).
- **Highway mitigation excluded**: BUG-003 showed that changing how highway search works has unintended consequences. The rule engine flags highway failures but does NOT auto-apply a radius change — always manual review.

---

## Files Changed

| File | Change |
|------|--------|
| `src/logger.js` | New — logger + pattern analyzer |
| `src/errorMemory.js` | New — mitigation store |
| `src/app.js` | Add logging calls, wire mitigations into 4 search functions, add /admin/health route |
| `data/logs/` | New directory (auto-created) |
| `data/error-patterns.json` | Auto-generated |
| `data/mitigations.json` | Auto-generated |

No new npm packages required. All file I/O uses Node built-in `fs`.
