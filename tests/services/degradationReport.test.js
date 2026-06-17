'use strict';

// FR-068 — admin degradation-panel aggregator (pure).

const { buildDegradationSummary } = require('../../src/services/degradationReport');

const entry = (byLabel, fallbacks = 0, exhausted = 0) => ({ type: 'degradation', byLabel, fallbacks, exhausted });

describe('buildDegradationSummary', () => {
  test('empty input → zeroed summary', () => {
    const s = buildDegradationSummary([]);
    expect(s).toEqual({ reportsAffected: 0, totalFallbacks: 0, totalExhausted: 0, rows: [] });
  });

  test('non-array input is safe', () => {
    expect(buildDegradationSummary(undefined).rows).toEqual([]);
  });

  test('aggregates fallbacks/exhausted across reports by label', () => {
    const s = buildDegradationSummary([
      entry({ walkability: { fallback: 1, miss: 1, error: 0, exhausted: 0, sources: { osm: 1, google: 1 }, lastTs: '2026-06-17T00:00:02Z' } }, 1, 0),
      entry({ walkability: { fallback: 1, miss: 0, error: 0, exhausted: 0, sources: { osm: 1 }, lastTs: '2026-06-17T01:00:00Z' },
              'climate-normals': { fallback: 0, miss: 0, error: 0, exhausted: 1, sources: {}, lastTs: '2026-06-17T01:00:01Z' } }, 1, 1),
    ]);
    expect(s.reportsAffected).toBe(2);
    expect(s.totalFallbacks).toBe(2);
    expect(s.totalExhausted).toBe(1);

    const walk = s.rows.find((r) => r.label === 'walkability');
    expect(walk.fallback).toBe(2);
    expect(walk.miss).toBe(1);
    expect(walk.sources.sort()).toEqual(['google', 'osm']);
    expect(walk.lastTs).toBe('2026-06-17T01:00:00Z'); // latest wins
  });

  test('rows sorted by fallback+exhausted descending', () => {
    const s = buildDegradationSummary([
      entry({ low: { fallback: 1, exhausted: 0, miss: 0, error: 0, sources: {}, lastTs: null },
              high: { fallback: 3, exhausted: 2, miss: 0, error: 0, sources: {}, lastTs: null } }),
    ]);
    expect(s.rows[0].label).toBe('high');
    expect(s.rows[1].label).toBe('low');
  });
});
