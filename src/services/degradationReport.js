'use strict';

// FR-068 — pure aggregator for the admin degradation panel. Rolls the per-report
// `type:'degradation'` log entries (each carrying a summarize() byLabel map) up
// into a label × kind view over the window, plus report-level totals.
//
// Kept pure (no IO) so it's unit-testable; app.js feeds it readRecentLogs output.
// Aggregates by sourceChain `label` (e.g. 'walkability', 'reachability-grocery')
// — deliberately NOT cross-referenced against the FR-063 SOURCES ids, which use a
// different key space; aggregating by the label that was actually recorded keeps
// the panel correct rather than impressively wrong.

function buildDegradationSummary(degradationEntries) {
  const entries = Array.isArray(degradationEntries) ? degradationEntries : [];
  const rows = {}; // label -> { fallback, miss, error, exhausted, sources:Set, lastTs }
  let totalFallbacks = 0;
  let totalExhausted = 0;

  for (const e of entries) {
    totalFallbacks += e.fallbacks || 0;
    totalExhausted += e.exhausted || 0;
    const byLabel = e.byLabel || {};
    for (const [label, r] of Object.entries(byLabel)) {
      const row = (rows[label] ||= { label, fallback: 0, miss: 0, error: 0, exhausted: 0, sources: new Set(), lastTs: null });
      row.fallback += r.fallback || 0;
      row.miss     += r.miss || 0;
      row.error    += r.error || 0;
      row.exhausted += r.exhausted || 0;
      for (const s of Object.keys(r.sources || {})) row.sources.add(s);
      if (r.lastTs && (!row.lastTs || r.lastTs > row.lastTs)) row.lastTs = r.lastTs;
    }
  }

  const rowList = Object.values(rows)
    .map((r) => ({ ...r, sources: [...r.sources] }))
    .sort((a, b) => (b.fallback + b.exhausted) - (a.fallback + a.exhausted));

  return {
    reportsAffected: entries.length,
    totalFallbacks,
    totalExhausted,
    rows: rowList,
  };
}

module.exports = { buildDegradationSummary };
