'use strict';

// FR-065 — source-chain resilience primitive (Track A1).
// Runs an ordered list of data sources, returns the first result that passes a
// validity predicate, tagged with its source name for provenance. Misses and
// errors are logged so a silent fallthrough becomes visible (NR-004 observability
// thread). Pure orchestration: no fetch, no cache, no env reads — generalizes the
// FR-060 NREL→HIFLD pattern so every module reuses one mechanism (CONSTRAINT-014).
//
// sourceChain(sources, ctx, { label, isValid, log }) -> { value, source } | null
//   sources : [{ name, run(ctx), isValid?(result) }]   (tried in order)
//   isValid : default validity predicate (per-source isValid overrides it)
//   log     : visibility sink for misses/errors (default console.warn)

const DEFAULT_VALID = (r) => r != null;

const { recordDegradation } = require('./degradationLedger');

// FR-068 — records degradation events to the request-scoped ledger directly (not
// via the injected `log` sink, which stays for console/log visibility), so every
// current and future caller of sourceChain gets observability with zero wiring.
// A non-first source winning is a `fallback` (the path is running degraded); a
// fully exhausted chain is `exhausted` (the link floor). First-source success
// records nothing — the happy path stays free.
async function sourceChain(sources, ctx, { label = 'source-chain', isValid = DEFAULT_VALID, log = console.warn } = {}) {
  let degraded = false; // a prior source missed/errored → the next win is a fallback
  for (const source of sources) {
    const valid = source.isValid || isValid;
    try {
      const result = await source.run(ctx);
      if (valid(result)) {
        if (degraded) recordDegradation({ label, source: source.name, kind: 'fallback' });
        return { value: result, source: source.name };
      }
      log(`[sourceChain:${label}] ${source.name} miss (invalid result)`);
      recordDegradation({ label, source: source.name, kind: 'miss' });
      degraded = true;
    } catch (err) {
      const reason = err && err.message ? err.message : String(err);
      log(`[sourceChain:${label}] ${source.name} error: ${reason}`);
      recordDegradation({ label, source: source.name, kind: 'error', reason });
      degraded = true;
    }
  }
  recordDegradation({ label, source: null, kind: 'exhausted' });
  return null;
}

module.exports = { sourceChain };
