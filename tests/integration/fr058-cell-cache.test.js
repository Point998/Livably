'use strict';

// FR-058 headline acceptance: two DISTINCT addresses that fall in the same
// spatial cell must share POI fetches — the second report makes zero new Places
// calls. This exercises the real snapToCell (real H3) + the real reachability
// data layer against a shared in-memory placesCache, proving the whole chain:
// nearby coords → identical cellId → identical cache key → cache hit.

const mockClient = { textSearch: jest.fn(), placesNearby: jest.fn() };
const mockGetDriveTime = jest.fn();

const makeMockCache = () => {
  const store = new Map();
  return {
    get: (k) => (store.has(k) ? store.get(k) : null),
    set: (k, v) => store.set(k, v),
    clear: () => store.clear(),
    keys: () => [...store.keys()],
  };
};
const mockPlacesCache = makeMockCache();

jest.mock('../../src/shared/google/client', () => ({
  googleMapsClient: mockClient,
  googleMapsApiKey: 'test-key',
}));
jest.mock('../../src/shared/google/distanceMatrix', () => ({ getDriveTime: mockGetDriveTime }));
jest.mock('../../src/cache', () => ({ placesCache: mockPlacesCache }));
jest.mock('../../src/errorMemory', () => ({ getMitigation: (_fn, _key, def) => def }));
jest.mock('../../src/logger', () => ({ logError: jest.fn() }));
// Real snapToCell, real constants, real classifyBand — only the IO boundary is mocked.

const { snapToCell } = require('../../src/shared/spatial');
const { findNearestGrocery, findNearestPharmacy, findNearestGasStation } =
  require('../../src/modules/reachability/data');

// Two real Georgetown KY addresses ~100 m apart — verified to share one res-8 cell.
const ADDR_A = '38.2101,-84.5447';
const ADDR_B = '38.2110,-84.5447';

function cellFor(addr) {
  return { ...snapToCell(addr, 'suburban'), mode: 'suburban' };
}

const makePlace = (name, types, lat = 38.3, lng = -84.4) => ({
  name, types,
  formatted_address: `${name} Address`,
  vicinity: `${name} Vicinity`,
  geometry: { location: { lat, lng } },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPlacesCache.clear();
  mockGetDriveTime.mockResolvedValue(7);
});

describe('FR-058 — neighbors in one cell share POI fetches', () => {
  test('two addresses ~100 m apart resolve to the same cellId', () => {
    expect(cellFor(ADDR_A).cellId).toBe(cellFor(ADDR_B).cellId);
  });

  test('grocery: second same-cell report makes no new Places call', async () => {
    mockClient.textSearch.mockResolvedValue({ data: { results: [makePlace('Kroger', ['supermarket'])] } });
    const r1 = await findNearestGrocery(ADDR_A, 'suburban', cellFor(ADDR_A));
    const r2 = await findNearestGrocery(ADDR_B, 'suburban', cellFor(ADDR_B));
    expect(mockClient.textSearch).toHaveBeenCalledTimes(1);     // shared fetch
    expect(r2).toEqual(r1);                                      // same cached result
    expect(mockPlacesCache.keys()).toContain(`grocery:${cellFor(ADDR_A).cellId}`);
  });

  test('pharmacy + gas: second same-cell report makes no new Places call', async () => {
    mockClient.placesNearby
      .mockResolvedValueOnce({ data: { results: [makePlace('CVS', ['pharmacy'])] } })   // pharmacy A
      .mockResolvedValueOnce({ data: { results: [makePlace('Shell', ['gas_station'])] } }); // gas A
    await findNearestPharmacy(ADDR_A, cellFor(ADDR_A));
    await findNearestGasStation(ADDR_A, cellFor(ADDR_A));
    await findNearestPharmacy(ADDR_B, cellFor(ADDR_B)); // cache hit
    await findNearestGasStation(ADDR_B, cellFor(ADDR_B)); // cache hit
    expect(mockClient.placesNearby).toHaveBeenCalledTimes(2); // not 4
  });

  test('lifestyle records carry a band rung derived from the centroid drive (data fact, integer)', async () => {
    mockClient.textSearch.mockResolvedValue({ data: { results: [makePlace('Kroger', ['supermarket'])] } });
    const [store] = await findNearestGrocery(ADDR_A, 'suburban', cellFor(ADDR_A));
    expect(Number.isInteger(store.bandRung)).toBe(true); // classifyBand(7,'suburban') → integer
    expect(typeof store.bandRung).toBe('number');         // never a word/label (CONSTRAINT-009)
    expect(store.mode).toBe('suburban');
  });
});
