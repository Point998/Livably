'use strict';

jest.mock('../../../src/shared/census', () => ({
  fetchCensusACS: jest.fn(),
}));

const { fetchCensusACS } = require('../../../src/shared/census');
const {
  getDrainageCategory,
  getConstructionEraContext,
  getPropertyData,
  getPropertyIntelligence,
  getSoilData,
  getSoilDataSDA,
} = require('../../../src/modules/property/data');
const { runWithLedger, getLedger } = require('../../../src/shared/degradationLedger');

describe('getDrainageCategory', () => {
  test('well drained returns green', () => expect(getDrainageCategory('well drained').color).toBe('green'));
  test('moderately well drained returns lightgreen', () => expect(getDrainageCategory('moderately well drained').color).toBe('lightgreen'));
  test('somewhat poorly drained returns orange', () => expect(getDrainageCategory('somewhat poorly drained').color).toBe('orange'));
  test('poorly drained returns red', () => expect(getDrainageCategory('poorly drained').color).toBe('red'));
  test('very poorly drained returns red', () => expect(getDrainageCategory('very poorly drained').color).toBe('red'));
  test('null returns null', () => expect(getDrainageCategory(null)).toBeNull());
});


describe('getConstructionEraContext', () => {
  test('2015 is Modern construction', () => expect(getConstructionEraContext(2015).era).toMatch(/modern/i));
  test('2003 is 2000s construction', () => expect(getConstructionEraContext(2003).era).toMatch(/2000s/));
  test('1985 mentions polybutylene', () => {
    const ctx = getConstructionEraContext(1985);
    expect(ctx.cautions.some((c) => /polybutylene/i.test(c))).toBe(true);
  });
  test('1965 has lead paint caution', () => {
    const ctx = getConstructionEraContext(1965);
    expect(ctx.cautions.some((c) => /lead/i.test(c))).toBe(true);
  });
  test('1945 has knob-and-tube caution', () => {
    const ctx = getConstructionEraContext(1945);
    expect(ctx.cautions.some((c) => /knob/i.test(c))).toBe(true);
  });
  test('1920 is Pre-1940', () => expect(getConstructionEraContext(1920).era).toMatch(/pre-1940/i));
  test('null returns null', () => expect(getConstructionEraContext(null)).toBeNull());
});

describe('getPropertyData', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns KY data including tax rate', async () => {
    fetchCensusACS.mockResolvedValue(new Map([['B01003_001E', '3000']]));
    const result = await getPropertyData({ state: '21', county: '077', tract: '0101' }, { state: 'KY', county: 'Scott County' });
    expect(result.state).toBe('KY');
    expect(typeof result.taxRate).toBe('number');
    expect(result.taxRate).toBeGreaterThan(0);
  });

  test('returns densityLabel from tract population', async () => {
    fetchCensusACS.mockResolvedValue(new Map([['B01003_001E', '6000']]));
    const result = await getPropertyData({ state: '21', county: '077', tract: '0101' }, { state: 'KY', county: 'Scott County' });
    expect(result.densityLabel).toBe('Urban');
  });
});

describe('getSoilData — SDA resilience + observability (FR-072)', () => {
  let fetchSpy;
  const okJson = (body) => ({ ok: true, json: async () => body });
  const soilRow = { Table: [['Bluegrass-Maury silt loams', 'Bluegrass', 'Well drained', 'B', 'No']] };

  beforeEach(() => {
    jest.clearAllMocks();
    fetchSpy = jest.spyOn(global, 'fetch');
  });
  afterEach(() => fetchSpy.mockRestore());

  test('SDA success → soil object, single fetch, no retry', async () => {
    fetchSpy.mockResolvedValue(okJson(soilRow));
    const result = await getSoilData(38.2, -84.5);
    expect(result).toMatchObject({ muname: 'Bluegrass-Maury silt loams', drainagecl: 'Well drained', isHydric: false });
    expect(result.drainageCategory.color).toBe('green');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test('hydric rating "Yes" sets isHydric', async () => {
    fetchSpy.mockResolvedValue(okJson({ Table: [['Wetland muck', 'Comp', 'Poorly drained', 'D', 'Yes']] }));
    const result = await getSoilData(38.2, -84.5);
    expect(result.isHydric).toBe(true);
  });

  test('empty Table (unmapped point) → null, no retry, NO degradation event', async () => {
    fetchSpy.mockResolvedValue(okJson({ Table: [] }));
    const events = await runWithLedger(async () => {
      const r = await getSoilData(38.2, -84.5);
      expect(r).toBeNull();
      return getLedger();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(0);
  });

  test('SDA 503 both tries → null AND degradation recorded in ledger (no silent swallow)', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 503 });
    const events = await runWithLedger(async () => {
      const r = await getSoilData(38.2, -84.5);
      expect(r).toBeNull();
      return getLedger();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2); // one retry on transient
    const kinds = events.filter((e) => e.label === 'property-soil').map((e) => e.kind);
    expect(kinds).toContain('error');
    expect(kinds).toContain('exhausted');
  });

  test('SDA 503 then 200 → retry succeeds, soil object', async () => {
    fetchSpy
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(okJson(soilRow));
    const result = await getSoilData(38.2, -84.5);
    expect(result.muname).toBe('Bluegrass-Maury silt loams');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  test('SDA 400 (bad query) → no retry, null + degradation event', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 400 });
    const events = await runWithLedger(async () => {
      const r = await getSoilData(38.2, -84.5);
      expect(r).toBeNull();
      return getLedger();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1); // 4xx is not transient → no retry
    expect(events.some((e) => e.label === 'property-soil' && e.kind === 'error')).toBe(true);
  });

  test('getSoilDataSDA throws on outage (so the SOURCES monitor sees failure)', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500 });
    await expect(getSoilDataSDA(38.2, -84.5)).rejects.toThrow(/SDA HTTP 500/);
  });
});

describe('getPropertyIntelligence — soilwebUrl floor link (FR-072)', () => {
  let fetchSpy;
  beforeEach(() => {
    jest.clearAllMocks();
    fetchCensusACS.mockResolvedValue(null);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 503 });
  });
  afterEach(() => fetchSpy.mockRestore());

  test('always returns a coordinate-specific SoilWeb deep-link', async () => {
    const result = await getPropertyIntelligence(38.2098, -84.5588, null, { county: 'Scott County' });
    expect(result.soil).toBeNull(); // SDA down in this test
    expect(result.soilwebUrl).toContain('casoilresource.lawr.ucdavis.edu/gmap/');
    expect(result.soilwebUrl).toContain('loc=38.2098,-84.5588');
  });
});
