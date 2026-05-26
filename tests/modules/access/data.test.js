'use strict';
// Manual test addresses (require real API — run the server and call /report):
//   Georgetown KY: 100 Wishing Well Path, Georgetown, KY → should find I-75
//   Jeffersonville IN: 1007 Stonelilly Dr, Jeffersonville, IN 47130 (CONSTRAINT-011)

const mockClient = { geocode: jest.fn() };
const mockGetDriveTime = jest.fn();
const mockReverseGeocode = jest.fn();

const makeMockCache = () => {
  const store = new Map();
  return {
    get: (k) => (store.has(k) ? store.get(k) : null),
    set: (k, v) => store.set(k, v),
    clear: () => store.clear(),
  };
};
const mockPlacesCache = makeMockCache();

jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: mockClient,
  googleMapsApiKey: 'test-key',
}));
jest.mock('../../../src/shared/google/distanceMatrix', () => ({
  getDriveTime: mockGetDriveTime,
}));
jest.mock('../../../src/shared/google/reverseGeocode', () => ({
  reverseGeocodeAddress: mockReverseGeocode,
}));
jest.mock('../../../src/cache', () => ({ placesCache: mockPlacesCache }));
jest.mock('../../../src/utils/constants', () => ({
  INTERSTATE_LIST: ['I-75', 'I-64'],
  HIGHWAY_MAX_DRIVE_MINUTES: 20,
  HIGHWAY_INTERCHANGE_MAX_MINUTES: 50,
}));

const { findNearestHighwayOnRamp } = require('../../../src/modules/access/data');

const makeGeocodeResult = (formattedAddress, lat = 38.3, lng = -84.4) => ({
  data: {
    results: [{ formatted_address: formattedAddress, geometry: { location: { lat, lng } } }],
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPlacesCache.clear();
  mockReverseGeocode.mockResolvedValue({ city: 'Georgetown', state: 'KY', county: 'Scott County', zip: '40324' });
});

describe('findNearestHighwayOnRamp', () => {
  test('returns primary highway with driveTimeMinutes', async () => {
    mockClient.geocode
      .mockResolvedValueOnce(makeGeocodeResult('I-75, Georgetown, KY', 38.3, -84.4)) // I-75 valid
      .mockResolvedValueOnce({ data: { results: [] } }); // I-64 no result
    mockGetDriveTime.mockResolvedValue(8);
    const result = await findNearestHighwayOnRamp('38.2,-84.3');
    expect(result.name).toBe('I-75');
    expect(result.driveTimeMinutes).toBe(8);
  });

  test('rejects false geocode match — formatted_address must contain highway number', async () => {
    // "I-75 near Georgetown KY" returns a result that says "Boat Ramp" — no I-75 in address
    mockClient.geocode
      .mockResolvedValueOnce(makeGeocodeResult('Unnamed Boat Ramp, Georgetown, KY')) // I-75: rejected
      .mockResolvedValueOnce({ data: { results: [] } }); // I-64: no result
    await expect(findNearestHighwayOnRamp('38.2,-84.3')).rejects.toThrow('No interstate highways found');
  });

  test('othersNote lists additional highways within 20 minutes', async () => {
    mockClient.geocode
      .mockResolvedValueOnce(makeGeocodeResult('I-75, Georgetown, KY', 38.3, -84.4))
      .mockResolvedValueOnce(makeGeocodeResult('I-64, Lexington, KY', 38.0, -84.5));
    mockGetDriveTime
      .mockResolvedValueOnce(8)  // I-75
      .mockResolvedValueOnce(15); // I-64
    const result = await findNearestHighwayOnRamp('38.2,-84.3');
    expect(result.name).toBe('I-75');
    expect(result.note).toContain('I-64');
    expect(result.note).toContain('15 min');
  });
});
