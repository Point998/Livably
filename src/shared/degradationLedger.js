'use strict';

// FR-068 — request-scoped degradation ledger (observability for the resilience
// track). Every sourceChain fallback is a place where the system serves a
// degraded read; this records when that happens, per report and in aggregate,
// without threading a collector through every data-function signature.
//
// AsyncLocalStorage gives request scope on a concurrent single-threaded server:
// buildReport runs the report body inside `runWithLedger`, and sourceChain reads
// the active store and pushes events. Reports in flight at the same time each
// get their own ledger — no cross-contamination, no signature churn.
//
// Crash-safety is the contract: observability must NEVER break a report. Every
// entry point no-ops cleanly when there's no active context (the FR-063 verify
// harness, tests, scripts, any non-report caller).

const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();

// Run fn with a fresh ledger bound to the async context. Returns fn's result.
function runWithLedger(fn) {
  return als.run([], fn);
}

// event: { label, source, kind } where kind ∈ 'miss'|'error'|'fallback'|'exhausted'.
// reason optional. ts is stamped here. No-op (never throws) when no active ledger.
function recordDegradation(event) {
  try {
    const ledger = als.getStore();
    if (!ledger) return;
    ledger.push({ ts: new Date().toISOString(), ...event });
  } catch {
    // observability must never crash the app
  }
}

// Current ledger array, or [] when there's no active context.
function getLedger() {
  return als.getStore() || [];
}

// Roll a ledger up into a compact summary for logging + the admin panel.
function summarize(ledger) {
  const events = Array.isArray(ledger) ? ledger : [];
  const byLabel = {};
  let fallbacks = 0;
  let exhausted = 0;

  for (const e of events) {
    if (e.kind === 'fallback') fallbacks++;
    if (e.kind === 'exhausted') exhausted++;
    const label = e.label || 'unknown';
    const row = (byLabel[label] ||= { fallback: 0, miss: 0, error: 0, exhausted: 0, sources: {}, lastTs: null });
    if (e.kind in row && typeof row[e.kind] === 'number') row[e.kind]++;
    if (e.source) row.sources[e.source] = (row.sources[e.source] || 0) + 1;
    if (!row.lastTs || e.ts > row.lastTs) row.lastTs = e.ts;
  }

  return { total: events.length, fallbacks, exhausted, byLabel };
}

module.exports = { runWithLedger, recordDegradation, getLedger, summarize };
