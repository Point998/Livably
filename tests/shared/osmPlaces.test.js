'use strict';

// FR-066 — shared OSM POI search. Pure parse over Overpass JSON + haversine
// sort. The keyless fallback proximity is straight-line distance (no Google
// Distance Matrix in a quota outage).

jest.mock('../../src/shared/overpass', () => ({ fetchOverpass: jest.fn() }));
const { fetchOverpass } = require('../../src/shared/overpass');
const { searchOSMPOIs } = require('../../src/shared/osmPlaces');

const resp = (elements) => ({ json: async () => ({ elements }) });
const ORIGIN = { lat: 38.2098, lng: -84.5588 };
const opts = { filters: ['["shop"~"supermarket|grocery"]'], radiusM: 8000 };

afterEach(() => jest.clearAllMocks());

describe('searchOSMPOIs', () => {
  test('returns named POIs sorted by straight-line distance, nearest first', async () => {
    fetchOverpass.mockResolvedValue(resp([
      { type: 'way',  id: 2, center: { lat: 38.25, lon: -84.60 }, tags: { name: 'Far Foods', shop: 'grocery' } },
      { type: 'node', id: 1, lat: 38.2100, lon: -84.5590, tags: { name: 'Near Mart', shop: 'supermarket' } },
    ]));
    const out = await searchOSMPOIs(ORIGIN.lat, ORIGIN.lng, opts);
    expect(out.map((p) => p.name)).toEqual(['Near Mart', 'Far Foods']);
    expect(out[0].distanceMiles).toBeLessThan(out[1].distanceMiles);
    expect(typeof out[0].distanceMiles).toBe('number');
  });

  test('reads node lat/lon and way center alike, and carries coords', async () => {
    fetchOverpass.mockResolvedValue(resp([
      { type: 'way', id: 2, center: { lat: 38.30, lon: -84.70 }, tags: { name: 'Way Store', shop: 'supermarket' } },
    ]));
    const [p] = await searchOSMPOIs(ORIGIN.lat, ORIGIN.lng, opts);
    expect(p.lat).toBe(38.30);
    expect(p.lng).toBe(-84.70);
  });

  test('skips elements without a name', async () => {
    fetchOverpass.mockResolvedValue(resp([
      { type: 'node', id: 3, lat: 38.21, lon: -84.56, tags: { shop: 'supermarket' } },
      { type: 'node', id: 1, lat: 38.211, lon: -84.561, tags: { name: 'Has Name', shop: 'supermarket' } },
    ]));
    const out = await searchOSMPOIs(ORIGIN.lat, ORIGIN.lng, opts);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Has Name');
  });

  test('respects the limit', async () => {
    const els = Array.from({ length: 10 }, (_, i) => ({ type: 'node', id: i, lat: 38.2 + i * 0.01, lon: -84.55, tags: { name: `Store ${i}`, shop: 'supermarket' } }));
    fetchOverpass.mockResolvedValue(resp(els));
    const out = await searchOSMPOIs(ORIGIN.lat, ORIGIN.lng, { ...opts, limit: 3 });
    expect(out).toHaveLength(3);
  });

  test('returns [] when Overpass is unreachable (null)', async () => {
    fetchOverpass.mockResolvedValue(null);
    expect(await searchOSMPOIs(ORIGIN.lat, ORIGIN.lng, opts)).toEqual([]);
  });

  test('returns [] on an empty element set', async () => {
    fetchOverpass.mockResolvedValue(resp([]));
    expect(await searchOSMPOIs(ORIGIN.lat, ORIGIN.lng, opts)).toEqual([]);
  });

  test('builds a union Overpass query from the filters around the point', async () => {
    fetchOverpass.mockResolvedValue(resp([]));
    await searchOSMPOIs(ORIGIN.lat, ORIGIN.lng, { filters: ['["amenity"="pharmacy"]'], radiusM: 8000 });
    const query = fetchOverpass.mock.calls[0][0];
    expect(query).toMatch(/nwr\(around:8000,38.2098,-84.5588\)\["amenity"="pharmacy"\]/);
    expect(query).toMatch(/out center tags/);
  });
});
