'use strict';

jest.mock('../../../src/shared/census', () => ({
  getCensusFIPS: jest.fn(),
  fetchCensusACS: jest.fn(),
}));

const { fetchCensusACS } = require('../../../src/shared/census');
const { getDemographics } = require('../../../src/modules/community/data');

function buildFullMockMap() {
  const vars = [
    // Existing L2 variables
    ['B01001_001E', '5000'], ['B01002_001E', '38'],
    ['B19013_001E', '65000'], ['B25003_001E', '2000'],
    ['B25003_002E', '1500'], ['B25010_001E', '2.5'],
    ['B15003_001E', '3000'], ['B15003_017E', '500'],
    ['B15003_022E', '400'], ['B15003_023E', '200'],
    ['B15003_024E', '50'], ['B15003_025E', '50'],
    ['B25039_001E', '2010'],
    // Education new
    ['B15003_018E', '100'], ['B15003_019E', '80'],
    ['B15003_020E', '70'],  ['B15003_021E', '100'],
    // Income distribution — total 1000 households
    ['B19001_001E', '1000'],
    ['B19001_002E', '50'], ['B19001_003E', '50'], ['B19001_004E', '50'], ['B19001_005E', '50'],
    ['B19001_006E', '50'], ['B19001_007E', '50'], ['B19001_008E', '50'], ['B19001_009E', '50'], ['B19001_010E', '50'],
    ['B19001_011E', '100'], ['B19001_012E', '80'],
    ['B19001_013E', '100'],
    ['B19001_014E', '50'], ['B19001_015E', '50'], ['B19001_016E', '100'], ['B19001_017E', '70'],
    // Household composition — total 1000 households
    ['B11001_001E', '1000'], ['B11001_002E', '700'], ['B11001_003E', '500'],
    ['B11001_005E', '100'], ['B11001_006E', '100'], ['B11001_007E', '300'], ['B11001_008E', '200'],
    // Commute mode — total 2000 workers
    ['B08006_001E', '2000'], ['B08006_002E', '1400'], ['B08006_003E', '200'],
    ['B08006_008E', '100'], ['B08006_014E', '20'], ['B08006_015E', '80'],
    ['B08006_016E', '40'],  ['B08006_017E', '160'],
  ];
  // Age variables (B01001 sex-by-age detail)
  for (let i = 3; i <= 25; i++) vars.push([`B01001_0${String(i).padStart(2,'0')}E`, '100']);
  for (let i = 27; i <= 49; i++) vars.push([`B01001_0${String(i).padStart(2,'0')}E`, '100']);
  return new Map(vars);
}

describe('getDemographics', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns null when fetchCensusACS returns null', async () => {
    fetchCensusACS.mockResolvedValue(null);
    const result = await getDemographics(38.2, -84.5, { state: '21', county: '077', tract: '0101' });
    expect(result).toBeNull();
  });

  // FR-077 — the demographics fetch failure path returns null without throwing; the error is
  // routed to the structured logger (logError), not console.error.
  test('returns null without throwing when fetchCensusACS rejects', async () => {
    fetchCensusACS.mockRejectedValue(new Error('census down'));
    await expect(getDemographics(38.2, -84.5, { state: '21', county: '077', tract: '0101' })).resolves.toBeNull();
  });

  test('returns structured object with existing L2 fields', async () => {
    const mockMap = buildFullMockMap();
    fetchCensusACS.mockResolvedValue(mockMap);
    const result = await getDemographics(38.2, -84.5, { state: '21', county: '077', tract: '0101' });
    expect(result).not.toBeNull();
    expect(result.income.median).toBe(65000);
    expect(result.community.ownershipRate).toBe(75);
    expect(result).toHaveProperty('age');
    expect(result).toHaveProperty('education');
  });

  test('returns incomeDistribution with brackets', async () => {
    const mockMap = buildFullMockMap();
    fetchCensusACS.mockResolvedValue(mockMap);
    const result = await getDemographics(38.2, -84.5, { state: '21', county: '077', tract: '0101' });
    expect(result).toHaveProperty('incomeDistribution');
    expect(result.incomeDistribution.brackets).toHaveLength(5);
  });

  test('returns educationLadder with 5 steps', async () => {
    const mockMap = buildFullMockMap();
    fetchCensusACS.mockResolvedValue(mockMap);
    const result = await getDemographics(38.2, -84.5, { state: '21', county: '077', tract: '0101' });
    expect(result).toHaveProperty('educationLadder');
    expect(result.educationLadder.steps).toHaveLength(5);
  });

  test('returns householdComposition', async () => {
    const mockMap = buildFullMockMap();
    fetchCensusACS.mockResolvedValue(mockMap);
    const result = await getDemographics(38.2, -84.5, { state: '21', county: '077', tract: '0101' });
    expect(result).toHaveProperty('householdComposition');
    expect(result.householdComposition).toHaveProperty('familyPct');
  });

  test('returns commuteMode', async () => {
    const mockMap = buildFullMockMap();
    fetchCensusACS.mockResolvedValue(mockMap);
    const result = await getDemographics(38.2, -84.5, { state: '21', county: '077', tract: '0101' });
    expect(result).toHaveProperty('commuteMode');
    expect(result.commuteMode).toHaveProperty('droveAlonePct');
  });

  test('returns tractFips with censusExplorerUrl', async () => {
    const mockMap = buildFullMockMap();
    fetchCensusACS.mockResolvedValue(mockMap);
    const result = await getDemographics(38.2, -84.5, { state: '21', county: '077', tract: '010101' });
    expect(result).toHaveProperty('tractFips');
    expect(result.tractFips.censusExplorerUrl).toContain('data.census.gov');
  });
});
