'use strict';

jest.mock('../../../src/shared/census', () => ({
  fetchCensusACS: jest.fn(),
}));

const { fetchCensusACS } = require('../../../src/shared/census');
const {
  getDrainageCategory,
  getBroadbandCategory,
  getConstructionEraContext,
  getPropertyData,
  getPropertyIntelligence,
} = require('../../../src/modules/property/data');

describe('getDrainageCategory', () => {
  test('well drained returns green', () => expect(getDrainageCategory('well drained').color).toBe('green'));
  test('moderately well drained returns lightgreen', () => expect(getDrainageCategory('moderately well drained').color).toBe('lightgreen'));
  test('somewhat poorly drained returns orange', () => expect(getDrainageCategory('somewhat poorly drained').color).toBe('orange'));
  test('poorly drained returns red', () => expect(getDrainageCategory('poorly drained').color).toBe('red'));
  test('very poorly drained returns red', () => expect(getDrainageCategory('very poorly drained').color).toBe('red'));
  test('null returns null', () => expect(getDrainageCategory(null)).toBeNull());
});

describe('getBroadbandCategory', () => {
  test('fiber (hasFiber=true) returns green', () => expect(getBroadbandCategory(1000, true).color).toBe('green'));
  test('1000Mbps without fiber flag still green', () => expect(getBroadbandCategory(1000, false).color).toBe('green'));
  test('200Mbps returns lightgreen', () => expect(getBroadbandCategory(250, false).color).toBe('lightgreen'));
  test('25Mbps returns gold', () => expect(getBroadbandCategory(25, false).color).toBe('gold'));
  test('1Mbps returns orange', () => expect(getBroadbandCategory(1, false).color).toBe('orange'));
  test('0Mbps returns muted', () => expect(getBroadbandCategory(0, false).color).toBe('muted'));
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
