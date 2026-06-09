'use strict';

// Hardening the NREL parser against real (documented) response shapes.
// See ./fixtures/README.md — these are schema-derived, not live captures.

const path = require('path');
const { getElectricData, getEvChargingData } = require('../../../src/modules/utilities/data');
const { getUtilityType, assembleUtilities } = require('../../../src/modules/utilities/logic');
const { utilitiesCache } = require('../../../src/cache');

const fx = (name) => require(path.join(__dirname, 'fixtures', name));
const mockJson = (obj) => { global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => obj }); };

beforeEach(() => utilitiesCache.clear());
afterEach(() => { global.fetch = undefined; });
afterAll(() => utilitiesCache.clear());

describe('getElectricData against real utility_rates shapes', () => {
  test('investor-owned: extracts name, rate, and authoritative ownership', async () => {
    mockJson(fx('utility-rates-iou.json'));
    const r = await getElectricData(38.2098, -84.5588);
    expect(r.utilityName).toBe('Kentucky Utilities Co');
    expect(r.residentialRate).toBe(0.1187);
    expect(r.ownership).toBe('Investor Owned');
  });

  test('cooperative: ownership pulled from utility_info', async () => {
    mockJson(fx('utility-rates-coop.json'));
    const r = await getElectricData(37.98, -84.37);
    expect(r.ownership).toBe('Cooperative');
  });

  test('"no data" residential rate is handled without throwing (returns null)', async () => {
    mockJson(fx('utility-rates-no-data.json'));
    const r = await getElectricData(36.84, -83.32);
    expect(r).toBeNull(); // no usable rate -> null, no crash on the string "no data"
  });
});

describe('getEvChargingData against real alt-fuel-stations shapes', () => {
  const noDrive = async () => null;

  test('picks nearest L2 and nearest DC-fast, ignoring null-count stations', async () => {
    mockJson(fx('alt-fuel-stations-mixed.json'));
    const r = await getEvChargingData(38.2098, -84.5588, '38.2098,-84.5588', noDrive);
    expect(r.level2.name).toBe('Scott County Public Library'); // 0.4 mi, nearest L2
    expect(r.level2.distanceMiles).toBe('0.4');
    expect(r.dcFast.name).toBe('Toyota Georgetown Visitor Center'); // 2.7 mi, nearest DC-fast
    expect(r.dcFast.distanceMiles).toBe('2.7');
  });

  test('empty station list yields both null, no throw', async () => {
    mockJson(fx('alt-fuel-stations-empty.json'));
    const r = await getEvChargingData(38.2, -84.5, '38.2,-84.5', noDrive);
    expect(r).toEqual({ level2: null, dcFast: null });
  });
});

describe('getUtilityType prefers authoritative NREL ownership over name guessing', () => {
  test('ownership "Investor Owned" -> investor-owned, confident (not hedged)', () => {
    const r = getUtilityType('Kentucky Utilities Co', 'Investor Owned');
    expect(r.type).toBe('investor-owned');
    expect(r.hedge).toBe(false);
    expect(r.label.toLowerCase()).not.toMatch(/appears to be/);
  });

  test('ownership "Cooperative" -> cooperative, confident', () => {
    const r = getUtilityType('Owen County Anything', 'Cooperative');
    expect(r.type).toBe('cooperative');
    expect(r.hedge).toBe(false);
  });

  test('ownership "Municipal" -> municipal, confident', () => {
    const r = getUtilityType('Anytown Power', 'Municipal');
    expect(r.type).toBe('municipal');
    expect(r.hedge).toBe(false);
  });

  test('unrecognized ownership (e.g. Federal) falls back to name heuristic (hedged)', () => {
    const r = getUtilityType('Tennessee Valley Authority', 'Federal');
    expect(r.hedge).toBe(true); // ownership not in our 3 buckets -> name heuristic
  });

  test('no ownership arg -> name heuristic, unchanged behavior (hedged)', () => {
    const r = getUtilityType('Blue Grass Energy Cooperative');
    expect(r.type).toBe('cooperative');
    expect(r.hedge).toBe(true);
  });
});

describe('assembleUtilities threads ownership through to utilityType', () => {
  test('uses ownership when the data layer provides it', () => {
    const raw = { electric: { utilityName: 'Kentucky Utilities Co', residentialRate: 0.1187, ownership: 'Investor Owned' }, evCharging: null };
    const u = assembleUtilities(raw, 'suburban', { state: 'KY', county: 'Scott' });
    expect(u.utilityType.type).toBe('investor-owned');
    expect(u.utilityType.hedge).toBe(false);
  });

  test('still works when ownership is absent (name heuristic, hedged)', () => {
    const raw = { electric: { utilityName: 'Owen Electric Co-op', residentialRate: 0.12 }, evCharging: null };
    const u = assembleUtilities(raw, 'rural', { state: 'KY', county: 'Owen' });
    expect(u.utilityType.type).toBe('cooperative');
    expect(u.utilityType.hedge).toBe(true);
  });
});
