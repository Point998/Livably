'use strict';
const mockClient = { geocode: jest.fn() };

jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: mockClient,
  googleMapsApiKey: 'test-key',
}));
jest.mock('../../../src/cache', () => ({
  geocodeCache: new Map(),
}));

const { geocodeAddress } = require('../../../src/shared/google/geocoding');

describe('geocodeAddress', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns { lat, lng } for valid address', async () => {
    mockClient.geocode.mockResolvedValue({
      data: { results: [{ geometry: { location: { lat: 38.2, lng: -84.5 } } }] },
    });
    const result = await geocodeAddress('100 Wishing Well Path, Georgetown, KY');
    expect(result).toEqual({ lat: 38.2, lng: -84.5 });
  });

  test('throws on empty results', async () => {
    mockClient.geocode.mockResolvedValue({ data: { results: [] } });
    await expect(geocodeAddress('invalid')).rejects.toThrow('Unable to geocode');
  });

  test('returns cached result without calling client on second call', async () => {
    mockClient.geocode.mockResolvedValue({
      data: { results: [{ geometry: { location: { lat: 38.2, lng: -84.5 } } }] },
    });
    const cache = require('../../../src/cache').geocodeCache;
    cache.clear();
    await geocodeAddress('Georgetown KY');
    await geocodeAddress('Georgetown KY');
    expect(mockClient.geocode).toHaveBeenCalledTimes(1);
  });
});
