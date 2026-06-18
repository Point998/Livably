'use strict';

jest.mock('../../src/logger', () => ({ logError: jest.fn() }));

// Reset module registry between describe blocks so fipsCache + vintage caches clear.
// NOTE: because of resetModules, ledger helpers must be require()'d *inside* a test
// (after reset) so they share the same AsyncLocalStorage instance as census.js.
beforeEach(() => jest.resetModules());

describe('getCensusFIPS', () => {
  test('returns { state, county, tract } on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          geographies: {
            'Census Tracts': [{ STATE: '21', COUNTY: '199', TRACT: '012345' }],
          },
        },
      }),
    });
    const { getCensusFIPS } = require('../../src/shared/census');
    const result = await getCensusFIPS(38.2, -84.5);
    expect(result).toEqual({ state: '21', county: '199', tract: '012345' });
  });

  test('returns null on network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));
    const { getCensusFIPS } = require('../../src/shared/census');
    const result = await getCensusFIPS(38.2, -84.5);
    expect(result).toBeNull();
  });

  test('returns cached result on second call with same coordinates', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          geographies: {
            'Census Tracts': [{ STATE: '21', COUNTY: '199', TRACT: '012345' }],
          },
        },
      }),
    });
    const { getCensusFIPS } = require('../../src/shared/census');
    await getCensusFIPS(38.2, -84.5);
    await getCensusFIPS(38.2, -84.5);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('fetchCensusACS', () => {
  test('returns null when CENSUS_API_KEY missing', async () => {
    delete process.env.CENSUS_API_KEY;
    const { fetchCensusACS } = require('../../src/shared/census');
    const result = await fetchCensusACS({ state: '21', county: '199', tract: '012345' }, ['B19013_001E']);
    expect(result).toBeNull();
  });

  test('parses ACS response into get() accessor correctly', async () => {
    process.env.CENSUS_API_KEY = 'test-census-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([
        ['B19013_001E', 'state', 'county', 'tract'],
        ['75000', '21', '199', '012345'],
      ]),
    });
    const { fetchCensusACS } = require('../../src/shared/census');
    const result = await fetchCensusACS({ state: '21', county: '199', tract: '012345' }, ['B19013_001E']);
    expect(result).not.toBeNull();
    expect(result.get('B19013_001E')).toBe('75000');
    delete process.env.CENSUS_API_KEY;
  });
});

describe('fetchCensusACS — vintage fallback (FR-074)', () => {
  const FIPS = { state: '21', county: '199', tract: '012345' };
  const VARS = ['B25035_001E'];
  const rowsResp = () => ({ ok: true, status: 200, text: async () => JSON.stringify([['B25035_001E', 'state', 'county', 'tract'], ['1995', '21', '199', '012345']]) });
  const yearOf = (url) => Number(String(url).match(/\/data\/(\d{4})\//)?.[1]);

  beforeEach(() => { process.env.CENSUS_API_KEY = 'test-census-key'; });
  afterEach(() => { delete process.env.CENSUS_API_KEY; jest.restoreAllMocks(); });

  test('uses the newest vintage (2024) when it has data; no older calls', async () => {
    global.fetch = jest.fn().mockResolvedValue(rowsResp());
    const { fetchCensusACS } = require('../../src/shared/census');
    const result = await fetchCensusACS(FIPS, VARS);
    expect(result.vintage).toBe(2024);
    expect(result.get('B25035_001E')).toBe('1995');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('404 on newest → falls back to 2023, then SKIPS the absent 2024 on next call', async () => {
    global.fetch = jest.fn().mockImplementation((url) =>
      Promise.resolve(yearOf(url) === 2024 ? { ok: false, status: 404 } : rowsResp()));
    const { fetchCensusACS } = require('../../src/shared/census');

    const r1 = await fetchCensusACS(FIPS, VARS);
    expect(r1.vintage).toBe(2023);
    expect(global.fetch).toHaveBeenCalledTimes(2); // 2024 (404) + 2023 (ok)

    global.fetch.mockClear();
    const r2 = await fetchCensusACS(FIPS, VARS);
    expect(r2.vintage).toBe(2023);
    expect(global.fetch).toHaveBeenCalledTimes(1); // 2024 skipped (known-absent)
  });

  test('5xx on newest → falls back, but RETRIES 2024 next call (not marked absent)', async () => {
    let failNewest = true;
    global.fetch = jest.fn().mockImplementation((url) => {
      if (yearOf(url) === 2024 && failNewest) return Promise.resolve({ ok: false, status: 503 });
      return Promise.resolve(rowsResp());
    });
    const { fetchCensusACS } = require('../../src/shared/census');

    const r1 = await fetchCensusACS(FIPS, VARS);
    expect(r1.vintage).toBe(2023); // transient blip → next-newest

    failNewest = false;
    global.fetch.mockClear();
    const r2 = await fetchCensusACS(FIPS, VARS);
    expect(r2.vintage).toBe(2024); // 2024 retried + recovered (self-heals)
  });

  test('all vintages fail → null + FR-068 ledger records census-acs exhausted', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('census down'));
    const { fetchCensusACS } = require('../../src/shared/census');
    const { runWithLedger, getLedger } = require('../../src/shared/degradationLedger');
    const events = await runWithLedger(async () => {
      const r = await fetchCensusACS(FIPS, VARS);
      expect(r).toBeNull();
      return getLedger();
    });
    const kinds = events.filter((e) => e.label === 'census-acs').map((e) => e.kind);
    expect(kinds).toContain('exhausted');
  });
});

describe('getCensusFIPS — hardening (FR-074)', () => {
  afterEach(() => jest.restoreAllMocks());
  const geoResp = () => ({ ok: true, json: async () => ({ result: { geographies: { 'Census Tracts': [{ STATE: '21', COUNTY: '199', TRACT: '012345' }] } } }) });

  test('transient failure then success → one retry recovers', async () => {
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue(geoResp());
    const { getCensusFIPS } = require('../../src/shared/census');
    const result = await getCensusFIPS(38.2, -84.5);
    expect(result).toEqual({ state: '21', county: '199', tract: '012345' });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  }, 10000);

  test('total failure → null + census-fips ledger event', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('geocoder down'));
    const { getCensusFIPS } = require('../../src/shared/census');
    const { runWithLedger, getLedger } = require('../../src/shared/degradationLedger');
    const events = await runWithLedger(async () => {
      const r = await getCensusFIPS(40.1, -83.2);
      expect(r).toBeNull();
      return getLedger();
    });
    expect(events.some((e) => e.label === 'census-fips')).toBe(true);
  }, 10000);
});
