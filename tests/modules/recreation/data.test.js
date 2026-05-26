'use strict';
const mockPlacesNearby = jest.fn();
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
  googleMapsClient: { placesNearby: mockPlacesNearby },
  googleMapsApiKey: 'test-key',
}));
jest.mock('../../../src/shared/google/distanceMatrix', () => ({
  getDriveTime: mockGetDriveTime,
}));
jest.mock('../../../src/cache', () => ({ placesCache: mockPlacesCache }));
jest.mock('../../../src/utils/constants', () => ({
  COFFEE_SHOP_CANDIDATE_COUNT: 5,
  PARK_EXCLUDED_TYPES: ['local_government_office', 'lawyer', 'insurance_agency', 'political'],
  PARK_LEISURE_TYPES: ['park', 'natural_feature', 'campground', 'amusement_park', 'zoo', 'stadium', 'gym'],
}));

const { findNearestPark, findNearestCoffeeShop } = require('../../../src/modules/recreation/data');

const makePlace = (name, types = ['park'], lat = 38.3, lng = -84.4) => ({
  name,
  types,
  formatted_address: `${name} Address`,
  vicinity: `${name} Vicinity`,
  geometry: { location: { lat, lng } },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPlacesCache.clear();
});

describe('findNearestPark', () => {
  test('filters PARK_EXCLUDED_TYPES', async () => {
    mockPlacesNearby.mockResolvedValue({
      data: {
        results: [
          makePlace('Law Office', ['local_government_office', 'establishment']),  // excluded
          makePlace('Willows Park', ['park']),  // valid
        ],
      },
    });
    mockGetDriveTime.mockResolvedValue(5);
    const result = await findNearestPark('38.2,-84.3');
    expect(result.name).toBe('Willows Park');
  });

  test('filters establishment-typed places not in PARK_LEISURE_TYPES', async () => {
    mockPlacesNearby.mockResolvedValue({
      data: {
        results: [
          makePlace('Parking Lot', ['establishment', 'parking']),  // establishment, not a leisure type — excluded
          makePlace('City Campground', ['establishment', 'campground']),  // establishment but IS a leisure type — kept
        ],
      },
    });
    mockGetDriveTime.mockResolvedValue(6);
    const result = await findNearestPark('38.2,-84.3');
    expect(result.name).toBe('City Campground');
  });
});

describe('findNearestCoffeeShop', () => {
  test('returns nearest by drive time from top candidates', async () => {
    mockPlacesNearby.mockResolvedValue({
      data: {
        results: [
          makePlace('Cafe A', ['cafe'], 38.3, -84.4),
          makePlace('Cafe B', ['cafe'], 38.4, -84.5),
          makePlace('Cafe C', ['cafe'], 38.5, -84.6),
        ],
      },
    });
    mockGetDriveTime
      .mockResolvedValueOnce(15)  // Cafe A
      .mockResolvedValueOnce(8)   // Cafe B — nearest by drive time
      .mockResolvedValueOnce(12); // Cafe C
    const result = await findNearestCoffeeShop('38.2,-84.3');
    expect(result.name).toBe('Cafe B');
    expect(result.driveTimeMinutes).toBe(8);
  });
});
