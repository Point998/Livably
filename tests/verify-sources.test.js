'use strict';
const { computeSourceVerdict, computeExitCode } = require('../scripts/lib/verdict');

const cells = (...outcomes) => outcomes.map((outcome) => ({ outcome }));

describe('computeSourceVerdict', () => {
  test("coverage 'all' dead-at-one → FAIL", () => {
    expect(computeSourceVerdict('all', cells('OK', 'FAIL', 'OK'))).toBe('FAIL');
  });
  test("coverage 'all' all-OK → PASS", () => {
    expect(computeSourceVerdict('all', cells('OK', 'OK'))).toBe('PASS');
  });
  test("coverage 'some' dead-at-all → FAIL", () => {
    expect(computeSourceVerdict('some', cells('FAIL', 'FAIL'))).toBe('FAIL');
  });
  test("coverage 'some' partial → INFO", () => {
    expect(computeSourceVerdict('some', cells('OK', 'FAIL'))).toBe('INFO');
  });
  test("coverage 'some' all-OK → PASS", () => {
    expect(computeSourceVerdict('some', cells('OK', 'OK'))).toBe('PASS');
  });
  test('all cells skipped → SKIPPED', () => {
    expect(computeSourceVerdict('all', cells('SKIPPED', 'SKIPPED'))).toBe('SKIPPED');
  });
  test('skipped cells excluded from denominator', () => {
    expect(computeSourceVerdict('all', cells('SKIPPED', 'OK'))).toBe('PASS');
  });
});

describe('computeExitCode', () => {
  test('1 when any verdict is FAIL', () => {
    expect(computeExitCode(['PASS', 'INFO', 'FAIL'])).toBe(1);
  });
  test('0 when no FAIL', () => {
    expect(computeExitCode(['PASS', 'INFO', 'SKIPPED'])).toBe(0);
  });
});

const { evaluateCell } = require('../scripts/lib/evaluateCell');
const noSleep = { sleep: async () => {} };
const ctx = { address: 'x', lat: 1, lng: 2, state: 'KY', county: 'X County', fips: null };

describe('evaluateCell', () => {
  afterEach(() => { delete process.env.SOME_KEY; });

  test('deferred → SKIPPED(deferred)', async () => {
    const r = await evaluateCell({ status: 'deferred', run: async () => 1, isValid: () => true }, ctx, noSleep);
    expect(r).toEqual({ outcome: 'SKIPPED', reason: 'deferred' });
  });

  test('missing required key → SKIPPED(no key)', async () => {
    const r = await evaluateCell({ requiresKey: 'SOME_KEY', run: async () => 1, isValid: () => true }, ctx, noSleep);
    expect(r).toEqual({ outcome: 'SKIPPED', reason: 'no key' });
  });

  test('valid result → OK', async () => {
    const r = await evaluateCell({ run: async () => [1], isValid: (x) => x.length === 1 }, ctx, noSleep);
    expect(r.outcome).toBe('OK');
  });

  test('invalid on both attempts → FAIL', async () => {
    const r = await evaluateCell({ run: async () => null, isValid: () => false }, ctx, noSleep);
    expect(r.outcome).toBe('FAIL');
  });

  test('transient throw then success on retry → OK', async () => {
    let n = 0;
    const r = await evaluateCell({
      run: async () => { if (n++ === 0) throw new Error('blip'); return [1]; },
      isValid: (x) => Array.isArray(x),
    }, ctx, noSleep);
    expect(r.outcome).toBe('OK');
  });

  test('429 on both attempts → SKIPPED(rate-limited)', async () => {
    const r = await evaluateCell({
      run: async () => { throw new Error('HTTP 429 Too Many Requests'); },
      isValid: () => true,
    }, ctx, noSleep);
    expect(r).toEqual({ outcome: 'SKIPPED', reason: 'rate-limited' });
  });

  test('probe unreachable but payload empty → FAIL', async () => {
    const r = await evaluateCell({
      probe: async () => 503,
      run: async () => [],
      isValid: (x) => Array.isArray(x),
    }, ctx, noSleep);
    expect(r.outcome).toBe('FAIL');
  });

  test('probe reachable + valid → OK', async () => {
    const r = await evaluateCell({
      probe: async () => 200,
      run: async () => [],
      isValid: (x) => Array.isArray(x),
    }, ctx, noSleep);
    expect(r.outcome).toBe('OK');
  });
});

const { runWithProviderLimit } = require('../scripts/lib/pool');

describe('runWithProviderLimit', () => {
  test('never exceeds the per-provider concurrency cap', async () => {
    let active = 0, peak = 0;
    const make = (provider) => ({
      provider,
      run: async () => {
        active++; peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--; return provider;
      },
    });
    const tasks = Array.from({ length: 6 }, () => make('google'));
    const results = await runWithProviderLimit(tasks, 2);
    expect(results).toHaveLength(6);
    expect(peak).toBeLessThanOrEqual(2);
  });

  test('different providers run concurrently and results keep input order', async () => {
    const order = [];
    const tasks = [
      { provider: 'a', run: async () => { order.push('a'); return 'a'; } },
      { provider: 'b', run: async () => { order.push('b'); return 'b'; } },
    ];
    const results = await runWithProviderLimit(tasks, 1);
    expect(results).toEqual(['a', 'b']);
  });
});
