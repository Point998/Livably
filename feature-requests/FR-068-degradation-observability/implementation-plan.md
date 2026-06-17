# FR-068 — Degradation observability — Implementation Plan

*Phase 3. Ordered shared-infra → chokepoint → report → admin, tests alongside.*

## Task 1 — `src/shared/degradationLedger.js`
- `AsyncLocalStorage` instance; `runWithLedger(fn)`, `recordDegradation(event)`,
  `getLedger()`, `summarize(ledger)`.
- `recordDegradation` try/catch-wrapped; no-op when no store.
- `summarize` → `{ total, fallbacks, exhausted, byLabel }`, `byLabel[label] =
  { fallback, miss, error, exhausted, sources: {source: count}, lastTs }`.
- Test `tests/shared/degradationLedger.test.js`: no-op without context;
  records within context; summarize counts; **two interleaved contexts stay
  isolated** (await a tick between pushes in each).

## Task 2 — instrument `src/shared/sourceChain.js`
- `require('./degradationLedger')`.
- Track whether any prior source failed; on a non-first valid result record
  `kind:'fallback'`; on miss/error record those kinds; on loop exhaustion record
  `kind:'exhausted'`.
- Keep the injected `log` sink calls exactly as-is. Return value unchanged.
- Test additions in `tests/shared/sourceChain.test.js`: wrap calls in
  `runWithLedger`, assert event kinds for happy-path (none), fallback (one),
  exhausted; assert no-context still returns correctly.

## Task 3 — `src/logger.js`
- `logDegradation(address, summary)` → append `{ type:'degradation', ts,
  address, ...summary }`. Export it.
- Test: in logger test (if present) or ledger test — appends and reads back via
  `readRecentLogs`. (Use a temp/▢ guard; existing logger tests show the pattern.)

## Task 4 — `src/services/reportBuilder.js`
- Wrap the body of `buildReport` in `runWithLedger` (return its result).
- Before `return`, `const summary = summarize(getLedger()); if (summary.total)
  logDegradation(address, summary);` — placed alongside the existing
  `logRequest`/`logAnalysis`.
- No other behaviour change. (Lightly covered by existing reportBuilder tests +
  a focused new test asserting a degradation line is emitted when a chained
  source falls back — mock one fetcher to force OSM.)

## Task 5 — admin panel
- Small aggregator `buildDegradationSummary(entries, knownSources)` (in a new
  `src/services/degradationReport.js` or inline admin helper) → label×source
  rows. Pure function → unit-testable.
- Extend `buildAdminHealthHTML` to render a "Source degradation (7d)" section
  from it; existing classes only, no inline styles.
- Wire in `app.js /admin/health`: pass `readRecentLogs(7)` degradation/error
  entries + `discoverSources(modulesDir)` (guard discover in try/catch — it
  `require`s module files; must not break the admin page).
- Tests: `degradationReport` aggregation unit test; adminPage no-inline-styles
  guard extended to the new section.

## Task 6 — verify
- `npx jest` full suite green.
- Run `npm run verify:sources`-style path mentally / confirm `sourceChain` with
  no ALS context (the harness) still works (Task 1/2 no-op guarantee).
- Live: generate a report against an address with a forced fallback is hard
  without tripping Google; instead assert via the unit/integration tests that a
  `fallback` event → `type:'degradation'` log line appears. (Keyless; no quota
  burn.)

## Risks / unknowns
- **ALS overhead**: negligible (one `getStore()` per source attempt). Happy path
  records nothing.
- **`discoverSources` in the admin request path**: it `require`s every module's
  data.js — already loaded in-process, so cheap; still guard in try/catch so a
  bad module never 500s the admin page.
- **Test isolation**: ledger ALS is module-global; tests must always enter via
  `runWithLedger` and not leak. The no-context no-op makes stray calls safe.
- **Log volume**: only `total > 0` reports emit a degradation line — bounded by
  real degradation, not traffic.
