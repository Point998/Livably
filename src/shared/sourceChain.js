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

async function sourceChain(sources, ctx, { label = 'source-chain', isValid = DEFAULT_VALID, log = console.warn } = {}) {
  for (const source of sources) {
    const valid = source.isValid || isValid;
    try {
      const result = await source.run(ctx);
      if (valid(result)) return { value: result, source: source.name };
      log(`[sourceChain:${label}] ${source.name} miss (invalid result)`);
    } catch (err) {
      log(`[sourceChain:${label}] ${source.name} error: ${err && err.message ? err.message : err}`);
    }
  }
  return null;
}

module.exports = { sourceChain };
