# FR-068 — Degradation observability (source-chain ledger) — Summary

*Phase 4 complete. Hardening Track Stage-2 thread, pulled forward — FR-067
spotlighted the recurring debt that every resilience feature is a
silent-degradation site.*

## What shipped

Every `sourceChain` fallback is now **visible** — per report and in a 7-day
admin aggregate — with zero data-function signature changes and no new infra.

- **`src/shared/degradationLedger.js`** — request-scoped ledger over Node's
  `AsyncLocalStorage`. `runWithLedger` / `recordDegradation` / `getLedger` /
  `summarize`. Concurrency-safe (each in-flight report gets its own store) and
  **crash-safe** (every entry point no-ops when there's no active context — the
  FR-063 verify harness, tests, scripts all run untouched).
- **`sourceChain` instrumentation** — records to the ledger **directly** (not via
  the injected `log` sink), so all 5 current callers and every future A1 slice
  get coverage for free. Event kinds: `miss`, `error`, `fallback` (a non-primary
  source won → path running degraded), `exhausted` (all sources failed → link
  floor). First-source success records nothing — the happy path stays free.
- **Per-report summary** — `buildReport` runs inside `runWithLedger`; on finish,
  emits one structured `type:'degradation'` log line **only when a fallback
  actually fired** (signal, not noise).
- **`/admin/health` degradation panel** — a label × kind table
  (fallback/exhausted/miss/error + sources seen + last-seen) over 7 days, with
  report-level totals. Pure aggregator (`degradationReport.js`) + a render
  section in the existing admin page.

## Why this, why now (architecture note)

The A1 resilience track adds fallbacks faster than it adds visibility into when
they fire — and `sourceChain` is the single chokepoint they all flow through.
Instrumenting the chokepoint **now**, with only 5 fallbacks live, means slices
4–7 (Recreation, Sensory, Growth, USDA/USGS/Census) are born observable instead
of retrofitted. The concurrency catch (reports run in parallel; a global
collector would cross-contaminate) is what makes `AsyncLocalStorage` the right
primitive rather than a passed-in collector.

## Files touched

- `src/shared/degradationLedger.js` (new) · `src/shared/sourceChain.js`
- `src/logger.js` (`logDegradation`) · `src/services/reportBuilder.js` (ledger wrap + summary emit)
- `src/services/degradationReport.js` (new aggregator) · `src/templates/pages/adminPage.js` · `src/app.js`
- Tests: `degradationLedger.test.js` (new), `degradationReport.test.js` (new),
  `sourceChain.test.js` (+ledger events), `reportBuilder.test.js` (+emit/no-emit).

## Scope boundary (right-sizing — Tier 2, not Tier 4)

- **In:** ledger, chokepoint instrumentation, per-report summary, admin panel.
  Stdlib + existing logger + existing admin page only.
- **Out (explicit non-goals):** Sentry / OpenTelemetry / dashboards / SLOs /
  alerting (premature for a single-instance system; Hardening Stage 2+ proper,
  gated on B2B). A full sweep of every `try/catch → null` swallow site across
  modules is a separate follow-up — FR-067's walkability fix is the template.

## Deviations from spec

- The admin panel uses inline styles, **matching the existing `adminPage.js`
  convention** (the whole file does). CONSTRAINT-008 governs *report* generators
  + `report.css`, not this internal dashboard; the no-inline-styles test excludes
  it. Spec said "no inline styles" — corrected to "match file convention."
- Dropped the planned `discoverSources` (FR-063) cross-reference: sourceChain
  `label`s and `SOURCES` ids use different key spaces, so aggregating by the
  recorded label keeps the panel correct rather than forcing a brittle mapping.

## Verification

- `npx jest` — **83 suites / 1,554 tests green** (was 81 / 1,539; +2 suites, +15).
- Includes a **concurrent-ledger isolation** test (two interleaved
  `runWithLedger` contexts stay separate) and a no-ALS-context no-op test.
- Admin panel smoke-rendered for both populated and empty states.

## Phases

All 4 workflow phases executed (discovery → spec → plan → implementation). No
phases skipped.
