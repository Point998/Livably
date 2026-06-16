'use strict';

// FR-065 — reusable source-chain resilience primitive. Pure orchestration:
// ordered try, first valid result wins, provenance tag, miss/error visibility.

const { sourceChain } = require('../../src/shared/sourceChain');

const ok = (value) => ({ run: async () => value });

describe('sourceChain', () => {
  test('returns the first valid result tagged with its source name', async () => {
    const result = await sourceChain([
      { name: 'primary', run: async () => ({ temp: 70 }) },
      { name: 'fallback', run: async () => ({ temp: 99 }) },
    ], null, { label: 'demo' });
    expect(result).toEqual({ value: { temp: 70 }, source: 'primary' });
  });

  test('skips a source whose result fails isValid and uses the next one', async () => {
    const result = await sourceChain([
      { name: 'primary', run: async () => ({ temp: null }), isValid: (r) => r.temp != null },
      { name: 'fallback', run: async () => ({ temp: 55 }), isValid: (r) => r.temp != null },
    ], null, { label: 'demo', log: () => {} });
    expect(result).toEqual({ value: { temp: 55 }, source: 'fallback' });
  });

  test('skips a source that throws and falls through to the next', async () => {
    const result = await sourceChain([
      { name: 'primary', run: async () => { throw new Error('boom'); } },
      { name: 'fallback', run: async () => ({ temp: 42 }) },
    ], null, { label: 'demo', log: () => {} });
    expect(result).toEqual({ value: { temp: 42 }, source: 'fallback' });
  });

  test('returns null when every source is invalid or throws', async () => {
    const result = await sourceChain([
      { name: 'a', run: async () => null },
      { name: 'b', run: async () => { throw new Error('x'); } },
    ], null, { label: 'demo', log: () => {} });
    expect(result).toBeNull();
  });

  test('default isValid treats any non-null result as valid', async () => {
    const result = await sourceChain([ok(0)].map((s, i) => ({ name: `s${i}`, ...s })), null, { label: 'demo' });
    expect(result).toEqual({ value: 0, source: 's0' }); // 0 is non-null → valid
  });

  test('does not call later sources once one succeeds (short-circuit)', async () => {
    const later = jest.fn(async () => ({ temp: 1 }));
    await sourceChain([
      { name: 'primary', run: async () => ({ temp: 70 }) },
      { name: 'fallback', run: later },
    ], null, { label: 'demo' });
    expect(later).not.toHaveBeenCalled();
  });

  test('passes ctx through to each source run', async () => {
    const ctx = { lat: 38.2, lng: -84.5 };
    const seen = jest.fn(async () => ({ ok: true }));
    await sourceChain([{ name: 'primary', run: seen }], ctx, { label: 'demo' });
    expect(seen).toHaveBeenCalledWith(ctx);
  });

  test('logs a visibility line for each miss/error via injected log', async () => {
    const log = jest.fn();
    await sourceChain([
      { name: 'primary', run: async () => null },
      { name: 'fallback', run: async () => ({ temp: 5 }) },
    ], null, { label: 'climate-normals', log });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(/climate-normals/);
    expect(log.mock.calls[0][0]).toMatch(/primary/);
  });
});
