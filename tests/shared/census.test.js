'use strict';

// Reset module registry between describe blocks so fipsCache is cleared
beforeEach(() => jest.resetModules());

describe('getCensusFIPS', () => {
  test('returns { state, county, tract } on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          geographies: {
            'Census Tracts': [{ STATE: '21', COUNTY: '199', TRACT: '012345' }],
          },
        },
      }),
    });
    const { getCensusFIPS } = require('../../src/shared/census');
    const result = await getCensusFIPS(38.2, -84.5);
    expect(result).toEqual({ state: '21', county: '199', tract: '012345' });
  });

  test('returns null on network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));
    const { getCensusFIPS } = require('../../src/shared/census');
    const result = await getCensusFIPS(38.2, -84.5);
    expect(result).toBeNull();
  });

  test('returns cached result on second call with same coordinates', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          geographies: {
            'Census Tracts': [{ STATE: '21', COUNTY: '199', TRACT: '012345' }],
          },
        },
      }),
    });
    const { getCensusFIPS } = require('../../src/shared/census');
    await getCensusFIPS(38.2, -84.5);
    await getCensusFIPS(38.2, -84.5);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('fetchCensusACS', () => {
  test('returns null when CENSUS_API_KEY missing', async () => {
    delete process.env.CENSUS_API_KEY;
    const { fetchCensusACS } = require('../../src/shared/census');
    const result = await fetchCensusACS({ state: '21', county: '199', tract: '012345' }, ['B19013_001E']);
    expect(result).toBeNull();
  });

  test('parses ACS response into get() accessor correctly', async () => {
    process.env.CENSUS_API_KEY = 'test-census-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([
        ['B19013_001E', 'state', 'county', 'tract'],
        ['75000', '21', '199', '012345'],
      ]),
    });
    const { fetchCensusACS } = require('../../src/shared/census');
    const result = await fetchCensusACS({ state: '21', county: '199', tract: '012345' }, ['B19013_001E']);
    expect(result).not.toBeNull();
    expect(result.get('B19013_001E')).toBe('75000');
    delete process.env.CENSUS_API_KEY;
  });
});
