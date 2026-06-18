'use strict';

// FR-073 — shared resilient elevation helper (EPQS → OpenTopoData → null),
// observable via sourceChain/FR-068 ledger.

jest.mock('../../src/logger', () => ({ logError: jest.fn() }));
const { logError } = require('../../src/logger');
const {
  fetchElevationsFeet, fetchElevationFeet, fetchElevationWithRetry, epqsPointFeet, cleanFeet,
} = require('../../src/shared/elevation');
const { runWithLedger, getLedger } = require('../../src/shared/degradationLedger');

const isEpqs = (url) => String(url).includes('epqs.nationalmap.gov');

afterEach(() => jest.restoreAllMocks());

describe('cleanFeet', () => {
  test('rounds valid feet', () => expect(cleanFeet(850.5)).toBe(851));
  test('null → null', () => expect(cleanFeet(null)).toBeNull());
  test('-9999 sentinel → null', () => expect(cleanFeet(-9999)).toBeNull());
  test('-1000 boundary → null', () => expect(cleanFeet(-1000)).toBeNull());
});

describe('fetchElevationWithRetry (back-compat primitive)', () => {
  test('returns value on first success', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ value: 850 }) });
    expect(await fetchElevationWithRetry('https://x/elev')).toBe(850);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  test('retries then returns null after exhaustion', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    expect(await fetchElevationWithRetry('https://x/elev', 2)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(3);
  }, 15000);
});

describe('epqsPointFeet', () => {
  test('cleans value to integer feet', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ value: 850.5 }) });
    expect(await epqsPointFeet(38, -84.5)).toBe(851);
  });
  test('-9999 → null', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ value: -9999 }) });
    expect(await epqsPointFeet(38, -84.5)).toBeNull();
  });
});

describe('fetchElevationsFeet — EPQS primary', () => {
  test('returns feet for every point; OpenTopoData not called', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ value: 900 }) });
    const result = await fetchElevationsFeet([[38, -84], [38.01, -84]]);
    expect(result).toEqual([900, 900]);
    // all calls were EPQS
    expect(fetch.mock.calls.every(([u]) => isEpqs(u))).toBe(true);
  });

  test('empty points → null', async () => {
    expect(await fetchElevationsFeet([])).toBeNull();
  });
});

describe('fetchElevationsFeet — OpenTopoData fallback (meters→feet) + observability', () => {
  test('center fails on EPQS → batched OpenTopoData fallback, ledger records fallback', async () => {
    global.fetch = jest.fn().mockImplementation((url) => {
      if (isEpqs(url)) return Promise.reject(new Error('EPQS down'));
      return Promise.resolve({ ok: true, json: async () => ({ results: [{ elevation: 258.6 }, { elevation: 300 }] }) });
    });
    const events = await runWithLedger(async () => {
      const r = await fetchElevationsFeet([[38, -84], [38.01, -84]]);
      expect(r).toEqual([848, 984]); // 258.6m→848ft, 300m→984ft
      return getLedger();
    });
    const elev = events.filter((e) => e.label === 'elevation');
    expect(elev.some((e) => e.kind === 'fallback')).toBe(true);
  }, 15000);

  test('both sources down → null, ledger records error + exhausted', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('all down'));
    const events = await runWithLedger(async () => {
      const r = await fetchElevationsFeet([[38, -84]]);
      expect(r).toBeNull();
      return getLedger();
    });
    const kinds = events.filter((e) => e.label === 'elevation').map((e) => e.kind);
    expect(kinds).toContain('error');
    expect(kinds).toContain('exhausted');
    expect(logError).toHaveBeenCalledWith('fetchElevationsFeet', expect.stringContaining(','), expect.any(Error));
  }, 15000);
});

describe('fetchElevationFeet (single point)', () => {
  test('returns the center elevation', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ value: 4820 }) });
    expect(await fetchElevationFeet(46, -111)).toBe(4820);
  });
});
