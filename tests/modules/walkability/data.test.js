'use strict';

const makeMockCache = () => {
  const store = new Map();
  return { get: (k) => (store.has(k) ? store.get(k) : null), set: (k, v) => store.set(k, v), clear: () => store.clear() };
};
const mockPlacesOsmCache = makeMockCache();
const mockSearchOSMPOIs = jest.fn();

jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: { placesNearby: jest.fn() },
  googleMapsApiKey: 'test-key',
}));
jest.mock('../../../src/cache', () => ({ placesOsmCache: mockPlacesOsmCache }));
jest.mock('../../../src/logger', () => ({ logError: jest.fn() }));
jest.mock('../../../src/shared/osmPlaces', () => ({ searchOSMPOIs: (...a) => mockSearchOSMPOIs(...a) }));

const { googleMapsClient } = require('../../../src/shared/google/client');
const {
  getWalkabilityScore, getWalkabilityScoreGoogle, getWalkabilityScoreOSM,
} = require('../../../src/modules/walkability/data');
const { getWalkCategory, categorizeOSMWalkPOI } = require('../../../src/modules/walkability/logic');

const place = (name, lat = 38.201, lng = -84.501) => ({ name, geometry: { location: { lat, lng } } });

beforeEach(() => {
  jest.clearAllMocks();
  mockPlacesOsmCache.clear();
  mockSearchOSMPOIs.mockResolvedValue([]); // default: OSM finds nothing
});

describe('getWalkCategory', () => {
  test('90+ is Walkers Paradise', () => expect(getWalkCategory(90).label).toMatch(/paradise/i));
  test('70-89 is Very Walkable', () => expect(getWalkCategory(75).label).toMatch(/very walkable/i));
  test('50-69 is Somewhat Walkable', () => expect(getWalkCategory(55).label).toMatch(/somewhat/i));
  test('25-49 is Car-Dependent', () => expect(getWalkCategory(30).label).toMatch(/car-dependent/i));
  test('below 25 is Very Car-Dependent', () => expect(getWalkCategory(10).label).toMatch(/very car/i));
});

describe('categorizeOSMWalkPOI', () => {
  test('grocery tags', () => expect(categorizeOSMWalkPOI({ shop: 'supermarket' })).toBe('grocery'));
  test('restaurant tags', () => expect(categorizeOSMWalkPOI({ amenity: 'restaurant' })).toBe('restaurant'));
  test('transit (bus stop)', () => expect(categorizeOSMWalkPOI({ highway: 'bus_stop' })).toBe('transit'));
  test('transit (rail station)', () => expect(categorizeOSMWalkPOI({ railway: 'station' })).toBe('transit'));
  test('park tags', () => expect(categorizeOSMWalkPOI({ leisure: 'park' })).toBe('park'));
  test('pharmacy tags', () => expect(categorizeOSMWalkPOI({ amenity: 'pharmacy' })).toBe('pharmacy'));
  test('unrelated tags → null', () => expect(categorizeOSMWalkPOI({ amenity: 'bench' })).toBeNull());
  test('no tags → null', () => expect(categorizeOSMWalkPOI(null)).toBeNull());
});

describe('getWalkabilityScoreGoogle', () => {
  test('all 5 Places calls reject → null (outage signature)', async () => {
    googleMapsClient.placesNearby.mockRejectedValue(new Error('API error'));
    expect(await getWalkabilityScoreGoogle(38.2, -84.5)).toBeNull();
  });

  test('genuine empty area (calls succeed, no results) → score 0, source google, non-null', async () => {
    googleMapsClient.placesNearby.mockResolvedValue({ data: { results: [] } });
    const r = await getWalkabilityScoreGoogle(38.2, -84.5);
    expect(r).not.toBeNull();
    expect(r.score).toBe(0);
    expect(r.source).toBe('google');
    expect(r.isProxy).toBe(true);
  });

  test('places found → non-zero score, source google', async () => {
    googleMapsClient.placesNearby.mockResolvedValue({
      data: { results: [place('Kroger'), place('CVS'), place('Aldi')] },
    });
    const r = await getWalkabilityScoreGoogle(38.2, -84.5);
    expect(r.score).toBeGreaterThan(0);
    expect(r.source).toBe('google');
  });

  test('FR-089 — exposes per-category counts (counts map keyed by WALK_TYPE label)', async () => {
    // Same mock applies to all 5 type calls → 3 results per category.
    googleMapsClient.placesNearby.mockResolvedValue({
      data: { results: [place('A'), place('B'), place('C')] },
    });
    const r = await getWalkabilityScoreGoogle(38.2, -84.5);
    expect(r.counts).toMatchObject({ Grocery: 3, Dining: 3, Transit: 3, Park: 3, Pharmacy: 3 });
  });

  test('partial failure (some types reject) → still non-null', async () => {
    googleMapsClient.placesNearby
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue({ data: { results: [place('Kroger')] } });
    const r = await getWalkabilityScoreGoogle(38.2, -84.5);
    expect(r).not.toBeNull();
    expect(r.source).toBe('google');
  });
});

describe('getWalkabilityScoreOSM', () => {
  test('categorizes POIs into walk types and scores, source osm', async () => {
    mockSearchOSMPOIs.mockResolvedValue([
      { name: 'OSM Market', lat: 38.201, lng: -84.501, distanceMiles: 0.2, tags: { shop: 'supermarket' } },
      { name: 'OSM Diner', lat: 38.202, lng: -84.502, distanceMiles: 0.3, tags: { amenity: 'restaurant' } },
      { name: 'OSM Park', lat: 38.203, lng: -84.503, distanceMiles: 0.4, tags: { leisure: 'park' } },
    ]);
    const r = await getWalkabilityScoreOSM(38.2, -84.5);
    expect(r.source).toBe('osm');
    expect(r.score).toBeGreaterThan(0);
    expect(r.destinations.length).toBe(3);
    expect(r.destinations.every((d) => typeof d.walkMinutes === 'number')).toBe(true);
    // FR-089 — per-category counts (grocery/dining/park each 1; transit/pharmacy 0).
    expect(r.counts).toMatchObject({ Grocery: 1, Dining: 1, Park: 1, Transit: 0, Pharmacy: 0 });
  });

  test('Overpass returns nothing → null', async () => {
    mockSearchOSMPOIs.mockResolvedValue([]);
    expect(await getWalkabilityScoreOSM(38.2, -84.5)).toBeNull();
  });

  test('only uncategorizable POIs → null', async () => {
    mockSearchOSMPOIs.mockResolvedValue([
      { name: 'Bench', lat: 38.2, lng: -84.5, distanceMiles: 0.1, tags: { amenity: 'bench' } },
    ]);
    expect(await getWalkabilityScoreOSM(38.2, -84.5)).toBeNull();
  });

  test('caches result', async () => {
    mockSearchOSMPOIs.mockResolvedValue([
      { name: 'OSM Market', lat: 38.201, lng: -84.501, distanceMiles: 0.2, tags: { shop: 'grocery' } },
    ]);
    await getWalkabilityScoreOSM(38.2, -84.5);
    await getWalkabilityScoreOSM(38.2, -84.5);
    expect(mockSearchOSMPOIs).toHaveBeenCalledTimes(1); // second call served from cache
  });
});

describe('getWalkabilityScore (source chain)', () => {
  test('Google success → OSM never queried', async () => {
    googleMapsClient.placesNearby.mockResolvedValue({ data: { results: [place('Kroger')] } });
    const r = await getWalkabilityScore(38.2, -84.5);
    expect(r.source).toBe('google');
    expect(mockSearchOSMPOIs).not.toHaveBeenCalled();
  });

  test('Google outage → OSM fallback used', async () => {
    googleMapsClient.placesNearby.mockRejectedValue(new Error('quota'));
    mockSearchOSMPOIs.mockResolvedValue([
      { name: 'OSM Market', lat: 38.201, lng: -84.501, distanceMiles: 0.2, tags: { shop: 'supermarket' } },
    ]);
    const r = await getWalkabilityScore(38.2, -84.5);
    expect(r.source).toBe('osm');
    expect(mockSearchOSMPOIs).toHaveBeenCalledTimes(1);
  });

  test('both sources down → degraded but renderable (source unavailable)', async () => {
    googleMapsClient.placesNearby.mockRejectedValue(new Error('quota'));
    mockSearchOSMPOIs.mockResolvedValue([]);
    const r = await getWalkabilityScore(38.2, -84.5);
    expect(r.source).toBe('unavailable');
    expect(r.score).toBeNull();
    expect(r.destinations).toEqual([]);
    expect(r.category).toBeDefined();
  });

  test('genuine empty area still resolves via Google (not OSM)', async () => {
    googleMapsClient.placesNearby.mockResolvedValue({ data: { results: [] } });
    const r = await getWalkabilityScore(38.2, -84.5);
    expect(r.source).toBe('google');
    expect(r.score).toBe(0);
    expect(mockSearchOSMPOIs).not.toHaveBeenCalled();
  });
});
