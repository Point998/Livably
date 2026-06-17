# FR-068 — Degradation observability (source-chain ledger) — Discovery

*Phase 1 (read-only). Hardening Track Stage-2 thread, pulled forward because
FR-067 spotlighted the recurring debt: resilience features are silent-degradation
sites, and we add them faster than we add visibility into when they fire.*

## The problem, precisely

Every `sourceChain` fallback is a place where the system serves a degraded read
(OSM straight-line instead of Google drive time; ERA5 modeled normals instead of
NOAA station data) and **nothing durable records that it happened.** For a
product whose value is data quality, silently shipping floor data is a
product-integrity risk, not just an ops gap. Concrete instances already bit us:
the FCC 405 hid behind a swallowed null (FR-061/062); walkability masked total
Google outage as a legitimate `score: 0` (fixed in FR-067).

## What exists

- **`src/shared/sourceChain.js`** — THE chokepoint. All 5 fallbacks flow through
  it (`climate`, `reachability` grocery/pharmacy/gas, `walkability`). On a miss
  or error it calls an injected `log` sink; modules wire `log → chainLog →
  logError`. So misses *do* reach the JSONL log — but as generic `type:'error'`
  entries, indistinguishable from hard failures, with **no positive record of a
  successful fallback** ("Google missed, OSM won") and **no per-report
  aggregation.**
- **`src/logger.js`** — append-only JSONL per day (`data/logs/<date>.jsonl`),
  `type: 'request' | 'error'`. `readRecentLogs(windowDays)` reads them back.
  Logging is wrapped to never crash the app. Good substrate to extend with a
  `type: 'degradation'` event — no new storage.
- **`src/services/reportBuilder.js` `buildReport`** — the per-report entry. Fans
  out POIs + `getChapterData` via `Promise.allSettled`, then `logRequest(...)`.
  The natural place to scope a per-report ledger and emit its summary.
- **`src/chapters.js` `getChapterData`** — fans out 12 chapter fetchers via
  `Promise.allSettled`; `val()` swallows rejections to `null`.
- **`scripts/lib/discoverSources.js`** (FR-063) — enumerates the `SOURCES`
  descriptor space (41 across 14 modules). Reusable to render the *known* source
  universe in an admin view (so healthy sources show as "0 issues", not absent).
- **`src/app.js` `/admin/health`** (guarded by `makeRequireAdmin`, FR-064) —
  already aggregates `recentErrors` + `usage` via `buildAdminHealthHTML`. The
  place to surface a degradation panel.

## The concurrency catch (invisible complexity)

To attribute degradation events to a *specific report*, a collector must be
request-scoped. But Node serves reports concurrently, and each report fans out
modules in parallel — a module-level/global collector would cross-contaminate.
Threading a collector param through every data-function signature is invasive
(dozens of signatures, CONSTRAINT-009 churn). **`AsyncLocalStorage`** (Node
stdlib) solves this: `buildReport` runs the report body inside `als.run(ledger,
fn)`; `sourceChain` reads the current store and pushes events. Zero signature
changes, concurrency-safe, no new infra. This is the central design decision.

## What's missing

1. A request-scoped **degradation ledger** primitive (ALS-based).
2. `sourceChain` recording **three event kinds**, centrally (not via the
   per-module `log` wiring, so it's free for all current + future callers):
   `miss` (invalid result), `error` (threw), `fallback` (a non-primary source
   won → report running degraded), and chain-level `exhausted` (all sources
   failed → link floor / hard degradation).
3. Per-report summary: one structured `type:'degradation'` log line per report.
4. Admin panel aggregating recent degradation/error events into a label×source
   view, over the known `SOURCES` space.

## Scope boundary (right-sizing — Tier 2, not Tier 4)

- **In:** ALS ledger, `sourceChain` instrumentation, per-report summary log,
  `/admin/health` degradation panel. Stdlib + existing logger + existing admin
  page only.
- **Out (explicit non-goals):** Sentry/OpenTelemetry/Prometheus, dashboards,
  SLOs, alerting — premature for a single-instance system; that's Hardening
  Stage 2+ proper, gated on B2B. Also out: a full sweep of every `try/catch →
  null` swallow site across all modules (broader follow-up; the walkability fix
  in FR-067 is the template). This FR instruments the *resilience chokepoint*,
  where degradation concentrates by design.

## Constraints

- **Never crash the app for observability** — every ledger call wrapped; no-ops
  cleanly when there's no ALS context (e.g. the FR-063 verify harness, tests).
- **011** — tests for the ledger + the sourceChain event emission.
- **008** — admin panel uses existing adminPage classes, no inline styles.
- **009** — ledger is infra, not chapter data/logic/template; it does not touch
  the three-layer chapter contract.
