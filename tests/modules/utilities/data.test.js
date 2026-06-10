'use strict';
const { getElectricData, getEvChargingData, getUtilitiesData, getElectricFromHIFLD, getEvFromOpenChargeMap, getBroadbandData } = require('../../../src/modules/utilities/data');
const ocmFixture = require('./fixtures/openchargemap-poi.json');
const hifldFixture = require('./fixtures/hifld-territories.json');
const fccFixture = require('./fixtures/fcc-broadband.json');
const { utilitiesCache } = require('../../../src/cache');

beforeEach(() => utilitiesCache.clear());
afterAll(() => utilitiesCache.clear());

describe('getElectricData', () => {
  afterEach(() => { global.fetch = undefined; });

  test('parses utility name + residential rate (ownership null when utility_info absent)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ outputs: { utility_name: 'Kentucky Utilities Co', residential: 0.131 } }),
    });
    const r = await getElectricData(38.2, -84.5);
    expect(r).toEqual({ utilityName: 'Kentucky Utilities Co', residentialRate: 0.131, ownership: null, source: 'NREL' });
  });

  test('returns null on non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    expect(await getElectricData(38.2, -84.5)).toBeNull();
  });

  test('returns null on fetch throw', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));
    expect(await getElectricData(38.2, -84.5)).toBeNull();
  });

  test('returns null when residential rate absent', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ outputs: { utility_name: 'X' } }) });
    expect(await getElectricData(38.2, -84.5)).toBeNull();
  });
});

describe('getEvChargingData', () => {
  afterEach(() => { global.fetch = undefined; });
  const fakeDrive = async () => 7;

  test('returns nearest L2 and DC-fast with drive time', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ fuel_stations: [
        { station_name: 'Library L2', street_address: '1 Main St', ev_level2_evse_num: 2, ev_dc_fast_num: 0,
          latitude: 38.21, longitude: -84.51, distance: 1.2 },
        { station_name: 'Pilot DCFC', street_address: '2 Hwy', ev_level2_evse_num: 0, ev_dc_fast_num: 4,
          latitude: 38.25, longitude: -84.40, distance: 4.0 },
      ] }),
    });
    const r = await getEvChargingData(38.2, -84.5, '38.2,-84.5', fakeDrive);
    expect(r.level2.name).toBe('Library L2');
    expect(r.level2.driveTimeMinutes).toBe(7);
    expect(r.dcFast.name).toBe('Pilot DCFC');
    expect(r.source).toBe('NREL');
  });

  test('returns null when NREL finds no stations (no OCM key set)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ fuel_stations: [] }) });
    const r = await getEvChargingData(38.2, -84.5, '38.2,-84.5', fakeDrive);
    expect(r).toBeNull();
  });

  test('returns null on fetch failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));
    expect(await getEvChargingData(38.2, -84.5, '38.2,-84.5', fakeDrive)).toBeNull();
  });
});

describe('getUtilitiesData', () => {
  afterEach(() => { global.fetch = undefined; });

  test('aggregates electric + ev under Promise.allSettled, tolerates partial failure', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ outputs: { utility_name: 'KU', residential: 0.13 } }) })
      .mockRejectedValueOnce(new Error('ev down'))
      .mockResolvedValueOnce({ ok: false }); // FCC fails gracefully
    const r = await getUtilitiesData(38.2, -84.5, '38.2,-84.5', async () => 5, null);
    expect(r.electric.utilityName).toBe('KU');
    expect(r.evCharging).toBeNull();
  });

  test('cell-caches: second call with same cellId makes zero new API calls', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ outputs: { utility_name: 'KU', residential: 0.13 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ fuel_stations: [] }) })
      .mockResolvedValueOnce({ ok: false }); // FCC miss — but electric present so result is cached
    const cell = { cellId: 'TESTCELL-FR032', centroid: { lat: 38.2, lng: -84.5 } };
    const r1 = await getUtilitiesData(38.2, -84.5, '38.2,-84.5', async () => 5, cell);
    const callsAfterMiss = global.fetch.mock.calls.length; // 3 (electric + ev + fcc)
    const r2 = await getUtilitiesData(38.2, -84.5, '38.2,-84.5', async () => 5, cell);
    expect(global.fetch.mock.calls.length).toBe(callsAfterMiss); // no new fetches on hit
    expect(r2.electric.utilityName).toBe('KU');
    expect(r1).toEqual(r2);
  });

  test('searches from the cell centroid, not the raw address', async () => {
    const seen = [];
    global.fetch = jest.fn((url) => { seen.push(url); return Promise.resolve({ ok: true, json: async () => ({ outputs: { utility_name: 'KU', residential: 0.13 }, fuel_stations: [] }) }); });
    const cell = { cellId: 'TESTCELL-CENTROID', centroid: { lat: 39.99, lng: -83.99 } };
    await getUtilitiesData(38.2, -84.5, '38.2,-84.5', async () => 5, cell);
    expect(seen.length).toBe(3); // NREL electric + NREL EV + FCC broadband
    expect(seen.join('|')).toContain('39.99'); // centroid lat used in NREL URLs
    expect(seen.join('|')).not.toContain('38.2');
  });

  test('does not cache a total miss (all null) — re-fetches next call', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }); // electric + ev + fcc all fail
    const cell = { cellId: 'TESTCELL-MISS', centroid: { lat: 38.2, lng: -84.5 } };
    const r1 = await getUtilitiesData(38.2, -84.5, '38.2,-84.5', async () => 5, cell);
    expect(r1).toEqual({ electric: null, evCharging: null, internet: null });
    const callsAfterFirst = global.fetch.mock.calls.length;
    await getUtilitiesData(38.2, -84.5, '38.2,-84.5', async () => 5, cell);
    expect(global.fetch.mock.calls.length).toBeGreaterThan(callsAfterFirst); // not served from cache
  });
});

describe('getElectricFromHIFLD', () => {
  afterEach(() => { global.fetch = undefined; });
  test('parses + title-cases NAME, maps TYPE to ownership, rate null, source HIFLD', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => hifldFixture });
    const r = await getElectricFromHIFLD(38.2098, -84.5588);
    expect(r).toEqual({ utilityName: 'Kentucky Utilities Co', residentialRate: null, ownership: 'INVESTOR OWNED', source: 'HIFLD' });
  });
  test('returns null on empty features / ArcGIS error / non-ok / throw', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [] }) });
    expect(await getElectricFromHIFLD(0, 0)).toBeNull();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ error: { code: 400 } }) });
    expect(await getElectricFromHIFLD(0, 0)).toBeNull();
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    expect(await getElectricFromHIFLD(0, 0)).toBeNull();
    global.fetch = jest.fn().mockRejectedValue(new Error('net'));
    expect(await getElectricFromHIFLD(0, 0)).toBeNull();
  });
});

describe('getElectricData (NREL -> HIFLD orchestration)', () => {
  afterEach(() => { global.fetch = undefined; });
  test('returns NREL result (source NREL) and does NOT call HIFLD when NREL succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ outputs: { utility_name: 'KU', residential: 0.13 } }) });
    const r = await getElectricData(38.2, -84.5);
    expect(r.source).toBe('NREL');
    expect(global.fetch.mock.calls.length).toBe(1);
  });
  test('falls back to HIFLD (source HIFLD) when NREL returns null', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => hifldFixture });
    const r = await getElectricData(38.2, -84.5);
    expect(r.source).toBe('HIFLD');
    expect(r.utilityName).toBe('Kentucky Utilities Co');
    expect(r.residentialRate).toBeNull();
  });
});

describe('getEvFromOpenChargeMap', () => {
  afterEach(() => { global.fetch = undefined; delete process.env.OPENCHARGEMAP_API_KEY; });
  const noDrive = async () => null;
  test('returns null without an API key (no fetch)', async () => {
    global.fetch = jest.fn();
    expect(await getEvFromOpenChargeMap(38.2, -84.5, '38.2,-84.5', noDrive)).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
  test('parses nearest L2 + DC-fast from Connections, source OpenChargeMap', async () => {
    process.env.OPENCHARGEMAP_API_KEY = 'test';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ocmFixture });
    const r = await getEvFromOpenChargeMap(38.2, -84.5, '38.2,-84.5', noDrive);
    expect(r.level2.name).toBe('Library L2');
    expect(r.level2.distanceMiles).toBe('1.2');
    expect(r.dcFast.name).toBe('Pilot DCFC');
    expect(r.source).toBe('OpenChargeMap');
  });
  test('null on non-ok / empty / throw', async () => {
    process.env.OPENCHARGEMAP_API_KEY = 'test';
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    expect(await getEvFromOpenChargeMap(38.2, -84.5, '38.2,-84.5', noDrive)).toBeNull();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
    expect(await getEvFromOpenChargeMap(38.2, -84.5, '38.2,-84.5', noDrive)).toBeNull();
    global.fetch = jest.fn().mockRejectedValue(new Error('net'));
    expect(await getEvFromOpenChargeMap(38.2, -84.5, '38.2,-84.5', noDrive)).toBeNull();
  });
});

describe('getEvChargingData (NREL -> OpenChargeMap orchestration)', () => {
  afterEach(() => { global.fetch = undefined; delete process.env.OPENCHARGEMAP_API_KEY; });
  const noDrive = async () => null;
  test('falls back to OCM when NREL finds nothing', async () => {
    process.env.OPENCHARGEMAP_API_KEY = 'test';
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ fuel_stations: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ocmFixture });
    const r = await getEvChargingData(38.2, -84.5, '38.2,-84.5', noDrive);
    expect(r.source).toBe('OpenChargeMap');
    expect(r.level2.name).toBe('Library L2');
  });
  test('uses NREL (source NREL) when it has stations; no OCM call', async () => {
    process.env.OPENCHARGEMAP_API_KEY = 'test';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ fuel_stations: [
      { station_name: 'NREL L2', street_address: '1 St', ev_level2_evse_num: 2, ev_dc_fast_num: 0, latitude: 38.21, longitude: -84.51, distance: 1 },
    ] }) });
    const r = await getEvChargingData(38.2, -84.5, '38.2,-84.5', noDrive);
    expect(r.source).toBe('NREL');
    expect(global.fetch.mock.calls.length).toBe(1);
  });
  test('a partial NREL result (L2 only, no DC-fast) stays on NREL — no OCM fallback', async () => {
    process.env.OPENCHARGEMAP_API_KEY = 'test';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ fuel_stations: [
      { station_name: 'NREL L2', street_address: '1 St', ev_level2_evse_num: 2, ev_dc_fast_num: 0, latitude: 38.21, longitude: -84.51, distance: 1 },
    ] }) });
    const r = await getEvChargingData(38.2, -84.5, '38.2,-84.5', noDrive);
    expect(r.source).toBe('NREL');
    expect(r.level2).not.toBeNull();
    expect(r.dcFast).toBeNull();
    expect(global.fetch.mock.calls.length).toBe(1); // OCM not called
  });
});

describe('getBroadbandData (relocated from Property)', () => {
  afterEach(() => { global.fetch = undefined; });

  test('parses providers, dedups by name, detects fiber + max download, no category field', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => fccFixture });
    const r = await getBroadbandData(38.2098, -84.5588);
    expect(r.providers.map((p) => p.name)).toEqual(['Glo Fiber', 'Spectrum']); // dedup, sorted by download desc
    expect(r.providers[0].tech).toBe('Fiber'); // tech code 50
    expect(r.maxDownloadMbps).toBe(1000);
    expect(r.hasFiber).toBe(true);
    expect(r).not.toHaveProperty('category'); // categorization moved to logic
  });

  test('returns null on non-ok / empty / throw', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    expect(await getBroadbandData(0, 0)).toBeNull();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ availability: [] }) });
    expect(await getBroadbandData(0, 0)).toBeNull();
    global.fetch = jest.fn().mockRejectedValue(new Error('net'));
    expect(await getBroadbandData(0, 0)).toBeNull();
  });

  test('dedup keeps the highest-tier plan when a provider appears multiple times', async () => {
    const out = { availability: [
      { brand_name: 'Acme', technology_code: 40, max_advertised_download_speed: 300, max_advertised_upload_speed: 20 }, // Cable, listed first
      { brand_name: 'Acme', technology_code: 50, max_advertised_download_speed: 1000, max_advertised_upload_speed: 1000 }, // Fiber, listed second
    ] };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => out });
    const r = await getBroadbandData(38.2, -84.5);
    const acme = r.providers.find((p) => p.name === 'Acme');
    expect(acme.tech).toBe('Fiber');       // highest-tier row wins, not the first-listed Cable row
    expect(acme.download).toBe(1000);
    expect(r.hasFiber).toBe(true);
  });
});

describe('getUtilitiesData threads internet', () => {
  afterEach(() => { global.fetch = undefined; });
  const noDrive = async () => null;

  test('includes internet in the assembled raw result', async () => {
    global.fetch = jest.fn((url) => {
      if (url.includes('utility_rates'))    return Promise.resolve({ ok: true, json: async () => ({ outputs: { utility_name: 'KU', residential: 0.13 } }) });
      if (url.includes('alt-fuel-stations')) return Promise.resolve({ ok: true, json: async () => ({ fuel_stations: [] }) });
      if (url.includes('broadbandmap'))     return Promise.resolve({ ok: true, json: async () => fccFixture });
      return Promise.resolve({ ok: false });
    });
    const r = await getUtilitiesData(38.2, -84.5, '38.2,-84.5', noDrive, null);
    expect(r.internet).not.toBeNull();
    expect(r.internet.hasFiber).toBe(true);
  });
});
