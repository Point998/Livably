# FR-068 — Degradation observability (source-chain ledger) — Specification

*Phase 2. New shared infra: `src/shared/degradationLedger.js`. Touches
`sourceChain.js`, `reportBuilder.js`, `logger.js`, `app.js`, `adminPage`.*

## Goal

Make every source-chain fallback **visible** — per report and in aggregate —
without changing any data-function signature and without new infrastructure.
Turn the silent-degradation surface the A1 track keeps growing into a recorded,
inspectable signal.

## Component 1 — `degradationLedger.js` (request-scoped, ALS)

```
const als = new AsyncLocalStorage();

runWithLedger(fn)          // als.run([], fn) → returns fn's result; ledger is the array
recordDegradation(event)   // push onto current ledger; no-op if no active context
getLedger()                // current ledger array, or [] if none
summarize(ledger)          // → { total, fallbacks, exhausted, byLabel: {label: {...}} }
```

- `event` shape: `{ label, source, kind, reason, ts }` where
  `kind ∈ 'miss' | 'error' | 'fallback' | 'exhausted'`.
- **Every export is crash-safe**: `recordDegradation` wrapped in try/catch and
  no-ops when `als.getStore()` is undefined (verify harness, tests, any
  non-report caller). Observability must never break a report.

## Component 2 — `sourceChain.js` instrumentation (the chokepoint)

`sourceChain` records to the ledger **directly** (not via the injected `log`
sink — that stays for console/log visibility). So all 5 current callers and
every future A1 slice get coverage with zero wiring.

Per run:
- source throws → `recordDegradation({ label, source, kind:'error', reason })`
- source returns invalid → `{ kind:'miss' }`
- a **non-first** source passes validity → before returning, record
  `{ label, source: winner, kind:'fallback' }` (the report is running degraded
  on this path). First-source success records **nothing** (happy path, zero
  overhead beyond an ALS read).
- loop exhausts with no valid source → `{ kind:'exhausted', source:null }`.

Behaviour/return value of `sourceChain` is otherwise **unchanged** (existing
tests must stay green).

## Component 3 — per-report summary (`reportBuilder.js`)

- Wrap the `buildReport` body in `runWithLedger`.
- After the report is built, `summarize(getLedger())` and emit **one**
  structured log line: `logDegradation(address, summary)` →
  `{ type:'degradation', ts, address, total, fallbacks, exhausted, byLabel }`.
- Only emit when `total > 0` (clean reports stay quiet — signal, not noise).
- No buyer-facing HTML change (the honest-provenance buyer treatment is separate
  and already shipped; this is internal-facing).

## Component 4 — `logger.js`

- Add `logDegradation(address, summary)` appending a `type:'degradation'` entry.
- (No change to `readRecentLogs`; it already returns all types.)

## Component 5 — `/admin/health` degradation panel

- New aggregator (in app.js or a small admin helper): read `readRecentLogs(7)`,
  take `type:'degradation'` + `type:'error'` entries, and build a
  **label × source** table with counts of fallback / exhausted / error over the
  window, plus a "last seen" timestamp.
- Cross-reference `discoverSources` (FR-063) so the known source universe is the
  backdrop — a source with zero events reads as healthy, not missing.
- Render inside the existing `buildAdminHealthHTML` (new section), existing
  classes, **no inline styles** (CONSTRAINT-008).

## Inputs / outputs

- Input: ambient ALS context established by `buildReport`. No new request params.
- Output: structured `type:'degradation'` log entries + an admin panel. No public
  API surface change; no change to report HTML.

## Edge cases

| Case | Expected |
|---|---|
| No ALS context (verify harness, tests, scripts) | `recordDegradation` no-ops; `sourceChain` behaves exactly as today |
| Happy path (first source wins) | zero events recorded; no degradation log line |
| Fallback wins (e.g. OSM after Google) | one `fallback` event; report log line emitted |
| All sources fail | `exhausted` event; counts surface in admin panel |
| Concurrent reports | each report's events isolated by its own ALS store |
| Logger write fails | swallowed (existing logger guarantee); report unaffected |

## Acceptance criteria

1. `sourceChain` return values and existing behaviour unchanged; all existing
   suites green.
2. Fallback win records exactly one `fallback` event with the winning source;
   first-source success records nothing.
3. `recordDegradation` outside any ALS context is a safe no-op.
4. `buildReport` emits a single `type:'degradation'` summary line only when
   `total > 0`.
5. Concurrent ledgers do not cross-contaminate (tested with two interleaved
   `runWithLedger` contexts).
6. Admin panel renders a label×source degradation view with no inline styles.
7. New tests cover the ledger, the sourceChain emission, and the summary; the
   verify harness (no ALS context) still runs clean.
