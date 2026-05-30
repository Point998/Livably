'use strict';

jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: { placesNearby: jest.fn() },
  googleMapsApiKey: 'test-key',
}));
jest.mock('../../../src/shared/census', () => ({ fetchCensusACS: jest.fn() }));
jest.mock('../../../src/development-discovery', () => ({ discoverDevelopments: jest.fn() }));

const { googleMapsClient } = require('../../../src/shared/google/client');
const { fetchCensusACS } = require('../../../src/shared/census');
const { discoverDevelopments } = require('../../../src/development-discovery');
const {
  getGrowthAndDevelopment,
  getNewConstructionContext,
  getBuildingPermitTrend,
} = require('../../../src/modules/growth/data');

describe('getNewConstructionContext', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns null when Census fails', async () => {
    fetchCensusACS.mockResolvedValue(null);
    expect(await getNewConstructionContext({ state: '21', county: '077', tract: '0101' })).toBeNull();
  });

  test('calculates newConstructionPct', async () => {
    fetchCensusACS.mockResolvedValue(new Map([
      ['B25034_001E', '1000'],
      ['B25034_002E', '100'],
      ['B25034_003E', '50'],
    ]));
    const result = await getNewConstructionContext({ state: '21', county: '077', tract: '0101' });
    expect(result.newConstructionPct).toBe(15);
  });

  test('returns null when fips is null', async () => {
    expect(await getNewConstructionContext(null)).toBeNull();
  });
});

describe('getBuildingPermitTrend', () => {
  test('returns null when fips missing state', async () => {
    expect(await getBuildingPermitTrend({ county: '077' })).toBeNull();
  });
  test('returns null when fips is null', async () => {
    expect(await getBuildingPermitTrend(null)).toBeNull();
  });
});

describe('getGrowthAndDevelopment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchCensusACS.mockResolvedValue(null);
    googleMapsClient.placesNearby.mockResolvedValue({ data: { results: [] } });
    discoverDevelopments.mockResolvedValue([]);
  });

  test('returns object with all four keys', async () => {
    const result = await getGrowthAndDevelopment(38.2, -84.5, null, { city: 'Georgetown', state: 'KY' });
    expect(result).toHaveProperty('permits');
    expect(result).toHaveProperty('newConstruction');
    expect(result).toHaveProperty('establishments');
    expect(result).toHaveProperty('namedProjects');
  });

  test('returns empty arrays for establishments and namedProjects on no results', async () => {
    const result = await getGrowthAndDevelopment(38.2, -84.5, null, { city: 'Georgetown', state: 'KY' });
    expect(result.establishments).toEqual([]);
    expect(result.namedProjects).toEqual([]);
  });
});
