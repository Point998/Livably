'use strict';

jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: { placesNearby: jest.fn() },
  googleMapsApiKey: 'test-key',
}));
jest.mock('../../../src/shared/census', () => ({ fetchCensusACS: jest.fn() }));
jest.mock('../../../src/development-discovery', () => ({ discoverDevelopments: jest.fn() }));
const mockSearchOSMPOIs = jest.fn();
jest.mock('../../../src/shared/osmPlaces', () => ({ searchOSMPOIs: (...a) => mockSearchOSMPOIs(...a) }));
jest.mock('../../../src/logger', () => ({ logError: jest.fn() }));
const makeMockCache = () => {
  const store = new Map();
  return { get: (k) => (store.has(k) ? store.get(k) : null), set: (k, v) => store.set(k, v), clear: () => store.clear() };
};
const mockPlacesOsmCache = makeMockCache();
jest.mock('../../../src/cache', () => ({ placesOsmCache: mockPlacesOsmCache }));

const { googleMapsClient } = require('../../../src/shared/google/client');
const { fetchCensusACS } = require('../../../src/shared/census');
const { discoverDevelopments } = require('../../../src/development-discovery');
const {
  getGrowthAndDevelopment,
  getNewConstructionContext,
  getBuildingPermitTrend,
  getRecentDevelopmentActivity,
  getRecentDevelopmentActivityGoogle,
  getRecentDevelopmentActivityOSM,
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

describe('getRecentDevelopmentActivity (Google→OSM cost-resilience chain, FR-071)', () => {
  const googlePlace = (name, lat, lng) => ({
    name, place_id: name, business_status: 'OPERATIONAL', geometry: { location: { lat, lng } },
  });
  // placesNearby is called once per COMMERCIAL_DEV_TYPES entry (6). Resolve the
  // first with a hit, the rest empty.
  const googleOneHit = () => {
    googleMapsClient.placesNearby
      .mockResolvedValueOnce({ data: { results: [googlePlace('Georgetown Mall', 38.04, -84.61)] } })
      .mockResolvedValue({ data: { results: [] } });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlacesOsmCache.clear();
    mockSearchOSMPOIs.mockResolvedValue([]);
  });

  test('Google returns establishments → uses them, never calls OSM, no source marker', async () => {
    googleOneHit();
    const result = await getRecentDevelopmentActivity(38.2, -84.5);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Georgetown Mall');
    expect(result[0].source).toBeUndefined();
    expect(mockSearchOSMPOIs).not.toHaveBeenCalled();
  });

  test('Google fulfilled-but-empty → [] short-circuits, OSM not called', async () => {
    googleMapsClient.placesNearby.mockResolvedValue({ data: { results: [] } });
    const result = await getRecentDevelopmentActivity(38.2, -84.5);
    expect(result).toEqual([]);
    expect(mockSearchOSMPOIs).not.toHaveBeenCalled();
  });

  test('Google fully rejected → OSM fallback, records tagged source:osm, sorted', async () => {
    googleMapsClient.placesNearby.mockRejectedValue(new Error('OVER_QUERY_LIMIT'));
    mockSearchOSMPOIs.mockResolvedValue([
      { name: 'Far Bank',  lat: 38.1, lng: -84.5, distanceMiles: 1.2, tags: { amenity: 'bank' } },
      { name: 'Near Mall', lat: 38.2, lng: -84.5, distanceMiles: 0.3, tags: { shop: 'mall' } },
    ]);
    const result = await getRecentDevelopmentActivity(38.2, -84.5);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Near Mall'); // sorted ascending
    expect(result.every((e) => e.source === 'osm')).toBe(true);
    expect(result[0]).toMatchObject({ label: 'Shopping Center', icon: '🏬' });
  });

  test('Google rejected + OSM empty → []', async () => {
    googleMapsClient.placesNearby.mockRejectedValue(new Error('network'));
    mockSearchOSMPOIs.mockResolvedValue([]);
    expect(await getRecentDevelopmentActivity(38.2, -84.5)).toEqual([]);
  });

  test('getRecentDevelopmentActivityGoogle returns null on total outage (observability)', async () => {
    googleMapsClient.placesNearby.mockRejectedValue(new Error('quota'));
    await expect(getRecentDevelopmentActivityGoogle(38.2, -84.5)).resolves.toBeNull();
  });

  test('OSM path: top-2-per-type, dedupes by name, caps at 6, skips uncategorized', async () => {
    googleMapsClient.placesNearby.mockRejectedValue(new Error('quota'));
    mockSearchOSMPOIs.mockResolvedValue([
      { name: 'Bank A', lat: 38, lng: -84, distanceMiles: 0.1, tags: { amenity: 'bank' } },
      { name: 'Bank B', lat: 38, lng: -84, distanceMiles: 0.2, tags: { amenity: 'bank' } },
      { name: 'Bank C', lat: 38, lng: -84, distanceMiles: 0.3, tags: { amenity: 'bank' } }, // 3rd bank dropped (top-2)
      { name: 'Bank A', lat: 38, lng: -84, distanceMiles: 0.4, tags: { amenity: 'bank' } }, // dup name dropped
      { name: 'Cafe',   lat: 38, lng: -84, distanceMiles: 0.5, tags: { amenity: 'restaurant' } }, // uncategorized
      { name: 'Gym X',  lat: 38, lng: -84, distanceMiles: 0.6, tags: { leisure: 'fitness_centre' } },
    ]);
    const result = await getRecentDevelopmentActivityOSM(38.2, -84.5);
    const names = result.map((e) => e.name);
    expect(names).toEqual(['Bank A', 'Bank B', 'Gym X']);
  });

  test('OSM query is tag-only and includes shop/amenity clauses (CONSTRAINT-004)', async () => {
    googleMapsClient.placesNearby.mockRejectedValue(new Error('quota'));
    await getRecentDevelopmentActivity(38.2, -84.5);
    const opts = mockSearchOSMPOIs.mock.calls[0][2];
    const filterStr = opts.filters.join(' ');
    expect(filterStr).toContain('shop');
    expect(filterStr).toContain('amenity');
    expect(opts.withTags).toBe(true);
  });
});
