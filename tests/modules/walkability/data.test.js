'use strict';

jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: {
    placesNearby: jest.fn(),
  },
  googleMapsApiKey: 'test-key',
}));

const { googleMapsClient } = require('../../../src/shared/google/client');
const { getWalkabilityScore, getWalkCategory } = require('../../../src/modules/walkability/data');

describe('getWalkCategory', () => {
  test('90+ is Walkers Paradise', () => expect(getWalkCategory(90).label).toMatch(/paradise/i));
  test('70-89 is Very Walkable', () => expect(getWalkCategory(75).label).toMatch(/very walkable/i));
  test('50-69 is Somewhat Walkable', () => expect(getWalkCategory(55).label).toMatch(/somewhat/i));
  test('25-49 is Car-Dependent', () => expect(getWalkCategory(30).label).toMatch(/car-dependent/i));
  test('below 25 is Very Car-Dependent', () => expect(getWalkCategory(10).label).toMatch(/very car/i));
});

describe('getWalkabilityScore', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns score=0 and empty destinations when all searches fail', async () => {
    googleMapsClient.placesNearby.mockRejectedValue(new Error('API error'));
    const result = await getWalkabilityScore(38.2, -84.5);
    expect(result.score).toBe(0);
    expect(result.destinations).toEqual([]);
  });

  test('returns non-zero score when places found', async () => {
    googleMapsClient.placesNearby.mockResolvedValue({
      data: {
        results: [
          { name: 'Kroger', geometry: { location: { lat: 38.201, lng: -84.501 } } },
          { name: 'CVS', geometry: { location: { lat: 38.202, lng: -84.502 } } },
        ],
      },
    });
    const result = await getWalkabilityScore(38.2, -84.5);
    expect(result.score).toBeGreaterThan(0);
  });

  test('isProxy flag is true', async () => {
    googleMapsClient.placesNearby.mockResolvedValue({ data: { results: [] } });
    const result = await getWalkabilityScore(38.2, -84.5);
    expect(result.isProxy).toBe(true);
  });
});
