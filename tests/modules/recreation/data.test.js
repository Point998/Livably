'use strict';
const mockPlacesNearby = jest.fn();
const mockGetDriveTime = jest.fn();
const mockSearchOSMPOIs = jest.fn();

const makeMockCache = () => {
  const store = new Map();
  return {
    get: (k) => (store.has(k) ? store.get(k) : null),
    set: (k, v) => store.set(k, v),
    clear: () => store.clear(),
  };
};
const mockPlacesCache = makeMockCache();
const mockPlacesOsmCache = makeMockCache();

jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: { placesNearby: mockPlacesNearby },
  googleMapsApiKey: 'test-key',
}));
jest.mock('../../../src/shared/google/distanceMatrix', () => ({
  getDriveTime: mockGetDriveTime,
}));
jest.mock('../../../src/cache', () => ({ placesCache: mockPlacesCache, placesOsmCache: mockPlacesOsmCache }));
jest.mock('../../../src/logger', () => ({ logError: jest.fn() }));
jest.mock('../../../src/shared/osmPlaces', () => ({ searchOSMPOIs: (...a) => mockSearchOSMPOIs(...a) }));
jest.mock('../../../src/utils/constants', () => ({
  COFFEE_SHOP_CANDIDATE_COUNT: 5,
  PARK_EXCLUDED_TYPES: ['local_government_office', 'lawyer', 'insurance_agency', 'political'],
  PARK_LEISURE_TYPES: ['park', 'natural_feature', 'campground', 'amusement_park', 'zoo', 'stadium', 'gym'],
  OSM_RECREATION_FILTERS: {
    park: ['["leisure"="park"]'], coffee: ['["amenity"="cafe"]'], library: ['["amenity"="library"]'],
    recCenter: ['["leisure"="sports_centre"]', '["amenity"="community_centre"]'], postOffice: ['["amenity"="post_office"]'],
  },
  OSM_POI_RADIUS_M: 8000,
}));

const {
  findNearestPark, findNearestCoffeeShop, findNearestLibrary,
  findNearestRecreationCenter, findNearestPostOffice,
} = require('../../../src/modules/recreation/data');

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
  mockPlacesOsmCache.clear();
  // Default: OSM finds nothing — so when Google succeeds it's never consulted,
  // and when Google fails the function throws (link floor). Overridden per test.
  mockSearchOSMPOIs.mockResolvedValue([]);
});

describe('findNearestPark (Google)', () => {
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
    expect(mockSearchOSMPOIs).not.toHaveBeenCalled();
  });

  test('filters establishment-typed places not in PARK_LEISURE_TYPES', async () => {
    mockPlacesNearby.mockResolvedValue({
      data: {
        results: [
          makePlace('Parking Lot', ['establishment', 'parking']),
          makePlace('City Campground', ['establishment', 'campground']),
        ],
      },
    });
    mockGetDriveTime.mockResolvedValue(6);
    const result = await findNearestPark('38.2,-84.3');
    expect(result.name).toBe('City Campground');
  });
});

describe('findNearestCoffeeShop (Google)', () => {
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
    mockGetDriveTime.mockResolvedValueOnce(15).mockResolvedValueOnce(8).mockResolvedValueOnce(12);
    const result = await findNearestCoffeeShop('38.2,-84.3');
    expect(result.name).toBe('Cafe B');
    expect(result.driveTimeMinutes).toBe(8);
    expect(mockSearchOSMPOIs).not.toHaveBeenCalled();
  });
});

// ── FR-069: OSM cost-resilience fallback ─────────────────────────────────────
describe('OSM fallback when Google is down (FR-069)', () => {
  const osmPoi = { name: 'OSM Place', lat: 38.31, lng: -84.41, distanceMiles: 1.23 };

  const cases = [
    ['park', findNearestPark],
    ['coffee', findNearestCoffeeShop],
    ['library', findNearestLibrary],
    ['recCenter', findNearestRecreationCenter],
    ['postOffice', findNearestPostOffice],
  ];

  test.each(cases)('%s: Google failure → OSM straight-line record (no minutes)', async (_key, fn) => {
    mockPlacesNearby.mockRejectedValue(new Error('quota'));
    mockSearchOSMPOIs.mockResolvedValue([osmPoi]);
    const result = await fn('38.2,-84.3');
    expect(result).toMatchObject({
      name: 'OSM Place', driveTimeMinutes: null, distanceMiles: 1.2, proximitySource: 'osm-straightline',
    });
    expect(mockSearchOSMPOIs).toHaveBeenCalledTimes(1);
  });

  test.each(cases)('%s: both Google and OSM fail → throws (link floor)', async (_key, fn) => {
    mockPlacesNearby.mockRejectedValue(new Error('quota'));
    mockSearchOSMPOIs.mockResolvedValue([]);
    await expect(fn('38.2,-84.3')).rejects.toThrow();
  });

  test('park: Google success → OSM never queried', async () => {
    mockPlacesNearby.mockResolvedValue({ data: { results: [makePlace('Willows Park', ['park'])] } });
    mockGetDriveTime.mockResolvedValue(5);
    await findNearestPark('38.2,-84.3');
    expect(mockSearchOSMPOIs).not.toHaveBeenCalled();
  });

  test('library OSM result is cached (second call served from cache)', async () => {
    mockPlacesNearby.mockRejectedValue(new Error('quota'));
    mockSearchOSMPOIs.mockResolvedValue([osmPoi]);
    await findNearestLibrary('38.2,-84.3');
    await findNearestLibrary('38.2,-84.3');
    expect(mockSearchOSMPOIs).toHaveBeenCalledTimes(1);
  });
});
