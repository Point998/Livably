# FR-025: Error Memory & Self-Refining Mitigations

## What it does

A persistent logging and pattern-detection layer that records every report request and every caught error, identifies recurring failure patterns, and applies runtime mitigations automatically so the same failure mode doesn't repeat indefinitely.

The system has three parts:
1. **Logger** — writes structured JSON lines to daily log files
2. **Pattern analyzer** — reads logs, detects recurring failure patterns, updates a patterns summary file
3. **Mitigation store** — stores runtime parameter overrides (search radius, retry count, exclusion lists) derived from patterns; functions read these at call time

---

## Inputs

- Every call to a data-fetching function (`findNearestHospital`, `findNearestGrocery`, etc.)
- Every error thrown or caught in app.js and premium.js
- Every `/report` route request (address, outcome, duration)

## Outputs

- `data/logs/YYYY-MM-DD.jsonl` — one JSON line per event (requests + errors)
- `data/error-patterns.json` — aggregated pattern summary, rewritten on each analysis run
- `data/mitigations.json` — runtime config overrides; read by functions at call time
- `GET /admin/health` — HTML dashboard showing recent errors, patterns, active mitigations, and API usage

---

## Log Entry Schemas

### Request event
```json
{
  "type": "request",
  "ts": "2026-05-22T14:30:00.000Z",
  "address": "100 Wishing Well Path, Georgetown, KY 40324",
  "outcome": "success" | "error",
  "durationMs": 4200,
  "errorType": null | "ADDRESS_NOT_FOUND" | "SERVER_ERROR" | "RATE_LIMIT" | "QUOTA_EXCEEDED"
}
```

### Error event
```json
{
  "type": "error",
  "ts": "2026-05-22T14:30:00.000Z",
  "fn": "findNearestHospital",
  "address": "100 Wishing Well Path, Georgetown, KY 40324",
  "errorMsg": "No hospital found near that address.",
  "addressType": "suburban",
  "context": {}
}
```

---

## Pattern File Schema (`data/error-patterns.json`)

```json
{
  "analyzedAt": "2026-05-22T14:00:00.000Z",
  "windowDays": 7,
  "functions": {
    "findNearestHospital": {
      "calls": 42,
      "failures": 8,
      "failureRate": 0.19,
      "topErrors": ["No hospital found near that address."],
      "flagged": true,
      "flagReason": "Failure rate 19% exceeds 15% threshold"
    }
  },
  "requestStats": {
    "total": 120,
    "success": 98,
    "error": 22,
    "successRate": 0.82
  }
}
```

---

## Mitigation File Schema (`data/mitigations.json`)

```json
{
  "updatedAt": "2026-05-22T14:00:00.000Z",
  "hospital": {
    "searchRadiusM": 16000,
    "reason": "Auto-expanded from 10km — failure rate was 19% over 7 days",
    "appliedAt": "2026-05-22T14:00:00.000Z"
  },
  "grocery": {
    "searchRadiusM": 8000
  }
}
```

Functions call `getMitigation(fn, key, defaultValue)` to read these at runtime.

---

## Mitigation Rules (auto-applied)

| Pattern | Trigger | Mitigation Applied |
|---------|---------|-------------------|
| Hospital search failure rate >15% over 7 days | Pattern analyzer | Expand `hospital.searchRadiusM` from 10,000 → 16,000 |
| Grocery search failure rate >15% | Pattern analyzer | Expand `grocery.searchRadiusM` from 8,000 → 12,000 |
| Pharmacy search failure rate >15% | Pattern analyzer | Expand `pharmacy.searchRadiusM` from 5,000 → 10,000 |
| Urgent care failure rate >15% | Pattern analyzer | Expand `urgentCare.searchRadiusM` from 8,000 → 16,000 |
| Highway search failure rate >20% | Pattern analyzer | Flag for manual review (can't safely auto-expand — BUG-003 risk) |
| Any function failure rate >40% | Pattern analyzer | Flag as critical — surfaced prominently in /admin/health |

Radius expansions are one-time and stored. They do not keep expanding on each run — the analyzer only applies a mitigation once and tracks `appliedAt`.

---

## Admin Dashboard (`GET /admin/health`)

Simple HTML page (no auth in MVP — localhost only, no public route):
- Overall request success rate (7 days)
- Per-function failure rates with flag status
- Active mitigations with reason and date applied
- Last 20 errors with address, function, and message
- API usage stats (from existing `getUsageStats()` in rateLimit.js)
- Link to raw log files

---

## Edge Cases

- **No logs yet**: All stats show N/A; patterns file is empty; mitigations file stays at defaults
- **Log file write failure**: Swallowed silently — logging must never crash the report flow
- **Corrupt log line**: Skipped during analysis — JSONL format means one bad line doesn't break the whole file
- **Mitigation file missing**: Functions fall back to hardcoded defaults
- **Radius expansion conflict**: If a function already has a mitigation applied, the analyzer skips re-applying (idempotent)

---

## Acceptance Criteria

- [ ] Every `/report` request writes a log entry (success or failure)
- [ ] Every caught error in app.js and premium.js writes a log entry with function name and address
- [ ] Silent `catch` blocks that return `null` now log before returning
- [ ] Daily log files appear in `data/logs/` named `YYYY-MM-DD.jsonl`
- [ ] `data/error-patterns.json` is written after each request
- [ ] `data/mitigations.json` is read by `findNearestHospital`, `findNearestGrocery`, `findNearestPharmacy`, `findNearestUrgentCare` at call time
- [ ] `GET /admin/health` returns a readable dashboard
- [ ] A test run with Georgetown address succeeds and produces a log entry
- [ ] Manually injecting a bad address produces an error log entry with correct function name
