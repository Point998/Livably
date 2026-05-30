'use strict';

jest.mock('../../../src/shared/census', () => ({
  getCensusFIPS: jest.fn(),
  fetchCensusACS: jest.fn(),
}));

const { fetchCensusACS } = require('../../../src/shared/census');
const {
  getDemographics,
  getIncomeLevel,
  getEducationLevel,
  getDensityType,
  getCommunityType,
} = require('../../../src/modules/community/data');

describe('getIncomeLevel', () => {
  test('above 100k is gold', () => expect(getIncomeLevel(120000).color).toBe('gold'));
  test('70-100k is gold', () => expect(getIncomeLevel(85000).color).toBe('gold'));
  test('50-70k is gold', () => expect(getIncomeLevel(60000).color).toBe('gold'));
  test('below 50k is gold', () => expect(getIncomeLevel(40000).color).toBe('gold'));
  test('zero returns muted', () => expect(getIncomeLevel(0).color).toBe('muted'));
  test('null returns muted', () => expect(getIncomeLevel(null).color).toBe('muted'));
});

describe('getEducationLevel', () => {
  test('above 60% is green', () => expect(getEducationLevel(65).color).toBe('green'));
  test('40-60% is lightgreen', () => expect(getEducationLevel(45).color).toBe('lightgreen'));
  test('25-40% is gold', () => expect(getEducationLevel(30).color).toBe('gold'));
  test('below 25% is muted', () => expect(getEducationLevel(15).color).toBe('muted'));
});

describe('getDensityType', () => {
  test('population > 5000 is Urban', () => expect(getDensityType(6000).label).toBe('Urban'));
  test('population 2001-5000 is Suburban', () => expect(getDensityType(3000).label).toBe('Suburban'));
  test('population <= 2000 is Rural', () => expect(getDensityType(1000).label).toBe('Rural'));
});

describe('getCommunityType', () => {
  test('high ownership + large household = established family', () => {
    expect(getCommunityType(75, 3.0).label).toMatch(/family/i);
  });
  test('low ownership = renter community', () => {
    expect(getCommunityType(35, 2.5).label).toMatch(/renter/i);
  });
  test('small household = singles', () => {
    expect(getCommunityType(55, 1.5).label).toMatch(/single|young/i);
  });
});

describe('getDemographics', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns null when fetchCensusACS returns null', async () => {
    fetchCensusACS.mockResolvedValue(null);
    const result = await getDemographics(38.2, -84.5, { state: '21', county: '077', tract: '0101' });
    expect(result).toBeNull();
  });

  test('returns structured object when Census data available', async () => {
    // Build a minimal mock Map covering all variables getDemographics reads
    const vars = [
      ['B01001_001E', '5000'], ['B01002_001E', '38'],
      ['B19013_001E', '65000'], ['B25003_001E', '2000'],
      ['B25003_002E', '1500'], ['B25010_001E', '2.5'],
      ['B15003_001E', '3000'], ['B15003_017E', '500'],
      ['B15003_022E', '400'], ['B15003_023E', '200'],
      ['B15003_024E', '50'], ['B15003_025E', '50'],
      ['B25039_001E', '2010'],
    ];
    // Also add B01001 age variables (the function reads many of these)
    for (let i = 3; i <= 25; i++) vars.push([`B01001_0${String(i).padStart(2,'0')}E`, '100']);
    for (let i = 27; i <= 49; i++) vars.push([`B01001_0${String(i).padStart(2,'0')}E`, '100']);
    const mockMap = new Map(vars);
    fetchCensusACS.mockResolvedValue(mockMap);

    const result = await getDemographics(38.2, -84.5, { state: '21', county: '077', tract: '0101' });
    expect(result).not.toBeNull();
    expect(result.income.median).toBe(65000);
    expect(result.community.ownershipRate).toBe(75);
    expect(result).toHaveProperty('age');
    expect(result).toHaveProperty('education');
  });
});
