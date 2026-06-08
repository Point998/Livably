'use strict';
const { getElectricData, getEvChargingData, getUtilitiesData } = require('../../../src/modules/utilities/data');
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
    expect(r).toEqual({ utilityName: 'Kentucky Utilities Co', residentialRate: 0.131, ownership: null });
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
  });

  test('null fields when a type is absent', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ fuel_stations: [] }) });
    const r = await getEvChargingData(38.2, -84.5, '38.2,-84.5', fakeDrive);
    expect(r).toEqual({ level2: null, dcFast: null });
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
      .mockRejectedValueOnce(new Error('ev down'));
    const r = await getUtilitiesData(38.2, -84.5, '38.2,-84.5', async () => 5, null);
    expect(r.electric.utilityName).toBe('KU');
    expect(r.evCharging).toBeNull();
  });

  test('cell-caches: second call with same cellId makes zero new NREL calls', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ outputs: { utility_name: 'KU', residential: 0.13 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ fuel_stations: [] }) });
    const cell = { cellId: 'TESTCELL-FR032', centroid: { lat: 38.2, lng: -84.5 } };
    const r1 = await getUtilitiesData(38.2, -84.5, '38.2,-84.5', async () => 5, cell);
    const callsAfterMiss = global.fetch.mock.calls.length; // 2 (electric + ev)
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
    expect(seen.length).toBe(2); // both NREL endpoints fired (no vacuous pass)
    expect(seen.join('|')).toContain('39.99'); // centroid lat used in NREL URL
    expect(seen.join('|')).not.toContain('38.2');
  });

  test('does not cache a total miss (both null) — re-fetches next call', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }); // electric + ev both fail
    const cell = { cellId: 'TESTCELL-MISS', centroid: { lat: 38.2, lng: -84.5 } };
    const r1 = await getUtilitiesData(38.2, -84.5, '38.2,-84.5', async () => 5, cell);
    expect(r1).toEqual({ electric: null, evCharging: null });
    const callsAfterFirst = global.fetch.mock.calls.length;
    await getUtilitiesData(38.2, -84.5, '38.2,-84.5', async () => 5, cell);
    expect(global.fetch.mock.calls.length).toBeGreaterThan(callsAfterFirst); // not served from cache
  });
});
