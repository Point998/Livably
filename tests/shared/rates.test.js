'use strict';
const path = require('path');
const { fetchGasPrice, fetchIrsMileageRate } = require('../../src/shared/rates');

const eiaFixture = require('./fixtures/eia-gas-price.json');
const fs = require('fs');
const irsHtml = fs.readFileSync(path.join(__dirname, 'fixtures', 'irs-rate-page.html'), 'utf8');

afterEach(() => { global.fetch = undefined; delete process.env.EIA_API_KEY; });

describe('fetchGasPrice (EIA)', () => {
  test('parses national weekly regular retail price + asOf', async () => {
    process.env.EIA_API_KEY = 'test';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => eiaFixture });
    const r = await fetchGasPrice();
    expect(r).toEqual({ value: 3.41, asOf: '2026-06-01' });
  });
  test('returns null when no API key', async () => {
    expect(await fetchGasPrice()).toBeNull();
  });
  test('returns null on non-ok / throw / empty data', async () => {
    process.env.EIA_API_KEY = 'test';
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    expect(await fetchGasPrice()).toBeNull();
    global.fetch = jest.fn().mockRejectedValue(new Error('net'));
    expect(await fetchGasPrice()).toBeNull();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ response: { data: [] } }) });
    expect(await fetchGasPrice()).toBeNull();
  });
});

describe('fetchIrsMileageRate', () => {
  test('parses "67 cents per mile" -> 0.67', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => irsHtml });
    const r = await fetchIrsMileageRate();
    expect(r.value).toBe(0.67);
    expect(typeof r.asOf).toBe('string');
  });
  test('returns null when pattern absent or fetch fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '<p>no rate here</p>' });
    expect(await fetchIrsMileageRate()).toBeNull();
    global.fetch = jest.fn().mockRejectedValue(new Error('net'));
    expect(await fetchIrsMileageRate()).toBeNull();
  });
});

const { getDrivingRates } = require('../../src/shared/rates');
const { ratesCache } = require('../../src/cache');

describe('getDrivingRates', () => {
  beforeEach(() => ratesCache.clear());
  afterAll(() => ratesCache.clear());

  test('uses live gas price when available; derives marginalCostPerMile', async () => {
    process.env.EIA_API_KEY = 'test';
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => eiaFixture })
      .mockResolvedValueOnce({ ok: true, text: async () => irsHtml });
    const r = await getDrivingRates();
    expect(r.gasPricePerGallon).toBe(3.41);
    expect(r.sources.gas).toBe('EIA');
    expect(r.irsRatePerMile).toBe(0.67);
    expect(r.marginalCostPerMile).toBeCloseTo(3.41 / 25 + 0.10, 6);
    expect(r.tripDistances.groceryRoundTripMiles).toBe(12);
    expect(r.asOf.gas).toBe('2026-06-01');
  });

  test('falls back to dated constants when fetches fail (resilient)', async () => {
    delete process.env.EIA_API_KEY;
    global.fetch = jest.fn().mockRejectedValue(new Error('net'));
    const r = await getDrivingRates();
    expect(r.gasPricePerGallon).toBe(3.20);
    expect(r.sources.gas).toBe('fallback');
    expect(r.irsRatePerMile).toBe(0.67);
    expect(r.sources.irs).toBe('fallback');
  });

  test('caches a successful gas fetch (second call makes no new gas fetch)', async () => {
    process.env.EIA_API_KEY = 'test';
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => eiaFixture })
      .mockResolvedValueOnce({ ok: true, text: async () => irsHtml });
    await getDrivingRates();
    const callsAfterFirst = global.fetch.mock.calls.length;
    await getDrivingRates();
    expect(global.fetch.mock.calls.length).toBe(callsAfterFirst);
  });

  test('a failed fetch is not cached (re-attempts next call)', async () => {
    delete process.env.EIA_API_KEY;
    global.fetch = jest.fn().mockRejectedValue(new Error('net'));
    await getDrivingRates();
    const calls1 = global.fetch.mock.calls.length;
    await getDrivingRates();
    expect(global.fetch.mock.calls.length).toBeGreaterThanOrEqual(calls1);
  });
});
