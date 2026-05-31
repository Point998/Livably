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
  suppressed,
  groupIncomeBrackets,
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

describe('suppressed', () => {
  test('positive integer returns the integer', () => expect(suppressed('500')).toBe(500));
  test('zero returns 0', () => expect(suppressed('0')).toBe(0));
  test('ACS suppression sentinel -666666666 returns null', () => expect(suppressed('-666666666')).toBeNull());
  test('negative number returns null', () => expect(suppressed('-1')).toBeNull());
  test('NaN string returns null', () => expect(suppressed('N/A')).toBeNull());
  test('undefined returns null', () => expect(suppressed(undefined)).toBeNull());
  test('null returns null', () => expect(suppressed(null)).toBeNull());
});

describe('groupIncomeBrackets', () => {
  function makeGet(map) { return (k) => map[k]; }

  test('returns null when total is 0', () => {
    expect(groupIncomeBrackets(makeGet({ B19001_001E: '0' }))).toBeNull();
  });

  test('returns null when total is missing', () => {
    expect(groupIncomeBrackets(makeGet({}))).toBeNull();
  });

  test('brackets sum to roughly 100% when all data present', () => {
    const map = {
      B19001_001E: '1000',
      B19001_002E: '50', B19001_003E: '50', B19001_004E: '50', B19001_005E: '50',
      B19001_006E: '50', B19001_007E: '50', B19001_008E: '50', B19001_009E: '50', B19001_010E: '50',
      B19001_011E: '100', B19001_012E: '80',
      B19001_013E: '100',
      B19001_014E: '50', B19001_015E: '50', B19001_016E: '100', B19001_017E: '70',
    };
    const result = groupIncomeBrackets(makeGet(map));
    expect(result).not.toBeNull();
    expect(result.brackets).toHaveLength(5);
    const total = result.brackets.reduce((s, b) => s + b.pct, 0);
    expect(total).toBeGreaterThanOrEqual(99);
    expect(total).toBeLessThanOrEqual(101);
  });

  test('bracket labels are correct', () => {
    const map = { B19001_001E: '100', B19001_002E: '25', B19001_003E: '0', B19001_004E: '0', B19001_005E: '0' };
    const result = groupIncomeBrackets(makeGet(map));
    expect(result.brackets[0].label).toBe('Under $25k');
    expect(result.brackets[4].label).toBe('$100k+');
  });

  test('suppressed cell sets hasSuppressed and counts as 0', () => {
    const map = {
      B19001_001E: '1000',
      B19001_002E: '-666666666',
      B19001_003E: '200', B19001_004E: '0', B19001_005E: '0',
      B19001_006E: '0', B19001_007E: '0', B19001_008E: '0', B19001_009E: '0', B19001_010E: '0',
      B19001_011E: '0', B19001_012E: '0',
      B19001_013E: '0',
      B19001_014E: '0', B19001_015E: '0', B19001_016E: '0', B19001_017E: '0',
    };
    const result = groupIncomeBrackets(makeGet(map));
    expect(result.hasSuppressed).toBe(true);
    expect(result.brackets[0].count).toBe(200);
  });
});
