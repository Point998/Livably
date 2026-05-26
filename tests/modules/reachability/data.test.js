'use strict';
// Manual test addresses (require real API — run the server and call /report):
//   Georgetown KY: 100 Wishing Well Path Unit 2306, Georgetown, KY 40324
//   Jeffersonville IN: 1007 Stonelilly Dr, Jeffersonville, IN 47130 (CONSTRAINT-011)

const mockClient = { textSearch: jest.fn(), placesNearby: jest.fn() };
const mockGetDriveTime = jest.fn();

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
jest.mock('../../../src/cache', () => ({ placesCache: mockPlacesCache }));
jest.mock('../../../src/errorMemory', () => ({ getMitigation: (_fn, _key, def) => def }));
jest.mock('../../../src/logger', () => ({ logError: jest.fn() }));
jest.mock('../../../src/utils/constants', () => ({
  GROCERY_SEARCH_RADIUS_M: 5000,
  GROCERY_CANDIDATE_COUNT: 5,
  GROCERY_EXCLUDED_TYPES: ['gas_station', 'convenience_store', 'lodging'],
}));

const { findNearestGrocery, findNearestPharmacy, findNearestGasStation } =
  require('../../../src/modules/reachability/data');

const makePlace = (name, types = ['grocery_or_supermarket'], lat = 38.3, lng = -84.4) => ({
  name,
  types,
  formatted_address: `${name} Address`,
  geometry: { location: { lat, lng } },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPlacesCache.clear();
});

describe('findNearestGrocery', () => {
  test('returns top 3 sorted by drive time', async () => {
    const places = [makePlace('A', [], 38.3, -84.4), makePlace('B', [], 38.4, -84.5), makePlace('C', [], 38.5, -84.6)];
    mockClient.textSearch.mockResolvedValue({ data: { results: places } });
    mockGetDriveTime
      .mockResolvedValueOnce(20)  // A
      .mockResolvedValueOnce(10)  // B
      .mockResolvedValueOnce(15); // C
    const result = await findNearestGrocery('38.2,-84.3');
    expect(result[0].name).toBe('B');
    expect(result[1].name).toBe('C');
    expect(result[2].name).toBe('A');
  });

  test('filters GROCERY_EXCLUDED_TYPES', async () => {
    const places = [
      makePlace('Gas Mart', ['gas_station']),
      makePlace('Real Grocer', ['supermarket']),
    ];
    mockClient.textSearch.mockResolvedValue({ data: { results: places } });
    mockGetDriveTime.mockResolvedValue(5);
    const result = await findNearestGrocery('38.2,-84.3');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Real Grocer');
  });

  test('throws when no results after filtering', async () => {
    mockClient.textSearch.mockResolvedValue({ data: { results: [makePlace('Gas Mart', ['gas_station'])] } });
    await expect(findNearestGrocery('38.2,-84.3')).rejects.toThrow('No grocery stores found');
  });
});

describe('findNearestPharmacy', () => {
  test('returns name/address/location/driveTimeMinutes', async () => {
    mockClient.placesNearby.mockResolvedValue({ data: { results: [makePlace('CVS', ['pharmacy'])] } });
    mockGetDriveTime.mockResolvedValue(8);
    const result = await findNearestPharmacy('38.2,-84.3');
    expect(result).toMatchObject({ name: 'CVS', driveTimeMinutes: 8 });
    expect(result.location).toBeDefined();
  });
});

describe('findNearestGasStation', () => {
  test('returns nearest result', async () => {
    mockClient.placesNearby.mockResolvedValue({ data: { results: [makePlace('Shell', ['gas_station'])] } });
    mockGetDriveTime.mockResolvedValue(3);
    const result = await findNearestGasStation('38.2,-84.3');
    expect(result).toMatchObject({ name: 'Shell', driveTimeMinutes: 3 });
  });
});
