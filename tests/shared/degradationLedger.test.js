'use strict';

// FR-068 — request-scoped degradation ledger (AsyncLocalStorage).

const { runWithLedger, recordDegradation, getLedger, summarize } = require('../../src/shared/degradationLedger');

describe('degradationLedger', () => {
  test('recordDegradation is a safe no-op outside any ledger context', () => {
    expect(() => recordDegradation({ label: 'x', kind: 'fallback' })).not.toThrow();
    expect(getLedger()).toEqual([]); // no context → empty
  });

  test('records events within a ledger context and stamps ts', () => {
    const ledger = runWithLedger(() => {
      recordDegradation({ label: 'walkability', source: 'osm', kind: 'fallback' });
      recordDegradation({ label: 'climate-normals', source: null, kind: 'exhausted' });
      return getLedger();
    });
    expect(ledger).toHaveLength(2);
    expect(ledger[0]).toMatchObject({ label: 'walkability', source: 'osm', kind: 'fallback' });
    expect(typeof ledger[0].ts).toBe('string');
  });

  test('summarize rolls events into totals + byLabel', () => {
    const ledger = [
      { label: 'walkability', source: 'osm', kind: 'fallback', ts: '2026-06-17T00:00:01Z' },
      { label: 'walkability', source: 'google', kind: 'miss', ts: '2026-06-17T00:00:02Z' },
      { label: 'climate-normals', source: null, kind: 'exhausted', ts: '2026-06-17T00:00:03Z' },
    ];
    const s = summarize(ledger);
    expect(s.total).toBe(3);
    expect(s.fallbacks).toBe(1);
    expect(s.exhausted).toBe(1);
    expect(s.byLabel.walkability).toMatchObject({ fallback: 1, miss: 1 });
    expect(s.byLabel.walkability.sources).toMatchObject({ osm: 1, google: 1 });
    expect(s.byLabel.walkability.lastTs).toBe('2026-06-17T00:00:02Z');
  });

  test('summarize of empty/non-array is safe', () => {
    expect(summarize([]).total).toBe(0);
    expect(summarize(undefined).total).toBe(0);
  });

  test('concurrent ledgers do not cross-contaminate', async () => {
    const runA = runWithLedger(async () => {
      recordDegradation({ label: 'A', kind: 'fallback' });
      await new Promise((r) => setTimeout(r, 10)); // yield so B interleaves
      recordDegradation({ label: 'A', kind: 'miss' });
      return getLedger().map((e) => e.label);
    });
    const runB = runWithLedger(async () => {
      recordDegradation({ label: 'B', kind: 'fallback' });
      await new Promise((r) => setTimeout(r, 5));
      recordDegradation({ label: 'B', kind: 'error' });
      return getLedger().map((e) => e.label);
    });
    const [a, b] = await Promise.all([runA, runB]);
    expect(a).toEqual(['A', 'A']);
    expect(b).toEqual(['B', 'B']);
  });
});
