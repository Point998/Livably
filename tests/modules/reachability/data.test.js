'use strict';
const mockClient = { textSearch: jest.fn(), placesNearby: jest.fn() };
const mockGetDriveTime = jest.fn();
const mockCheckDriveTimeCoherence = jest.fn();
const mockClassifyBand = jest.fn();

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
jest.mock('../../../src/shared/validate', () => ({
  checkDriveTimeCoherence: mockCheckDriveTimeCoherence,
  classifyBand: mockClassifyBand,
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
  // Default: coherent result. Overridden in coherence-warning tests.
  mockCheckDriveTimeCoherence.mockReturnValue({ ok: true, reason: '' });
  // Sentinel rung — band classification is unit-tested in validate.test.js; here
  // we only verify the data layer wires centroidDriveMinutes + mode → bandRung.
  mockClassifyBand.mockReturnValue(2);
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

  test('attaches coherenceWarning for incoherent drive times (CONSTRAINT-010)', async () => {
    mockClient.textSearch.mockResolvedValue({ data: { results: [makePlace('Far Grocer')] } });
    mockGetDriveTime.mockResolvedValue(60);
    mockCheckDriveTimeCoherence.mockReturnValue({ ok: false, reason: 'grocery store drive time of 60 min exceeds 45 min threshold for suburban address' });
    const result = await findNearestGrocery('38.2,-84.3', 'suburban');
    expect(result[0].coherenceWarning).toBe(true);
    expect(result[0].coherenceReason).toContain('grocery store');
  });

  test('no coherenceWarning when drive time is ok', async () => {
    mockClient.textSearch.mockResolvedValue({ data: { results: [makePlace('Near Grocer')] } });
    mockGetDriveTime.mockResolvedValue(12);
    const result = await findNearestGrocery('38.2,-84.3', 'suburban');
    expect(result[0].coherenceWarning).toBeUndefined();
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

// ── FR-058: cell-based keying + centroid search ───────────────────────────────

const CELL = { cellId: 'CELL_SUB', resolution: 8, centroid: { lat: 38.21, lng: -84.54 }, mode: 'suburban' };
const CENTROID_STR = '38.21,-84.54';

describe('cell-based keying (FR-058)', () => {
  test('grocery searches from the centroid, not the raw address', async () => {
    mockClient.textSearch.mockResolvedValue({ data: { results: [makePlace('Cell Grocer', ['supermarket'])] } });
    mockGetDriveTime.mockResolvedValue(7);
    await findNearestGrocery('38.2101,-84.5447', 'suburban', CELL);
    expect(mockClient.textSearch).toHaveBeenCalledWith(
      expect.objectContaining({ params: expect.objectContaining({ location: CENTROID_STR }) }),
    );
  });

  test('grocery computes drive time from centroid with the cellId cache option', async () => {
    mockClient.textSearch.mockResolvedValue({ data: { results: [makePlace('Cell Grocer', ['supermarket'])] } });
    mockGetDriveTime.mockResolvedValue(7);
    await findNearestGrocery('38.2101,-84.5447', 'suburban', CELL);
    expect(mockGetDriveTime).toHaveBeenCalledWith(CENTROID_STR, expect.anything(), { cellId: 'CELL_SUB' });
  });

  test('grocery records carry cellId, resolution, centroidDriveMinutes, bandRung, and mode', async () => {
    mockClient.textSearch.mockResolvedValue({ data: { results: [makePlace('Cell Grocer', ['supermarket'])] } });
    mockGetDriveTime.mockResolvedValue(7);
    const result = await findNearestGrocery('38.2101,-84.5447', 'suburban', CELL);
    expect(result[0]).toMatchObject({
      cellId: 'CELL_SUB', resolution: 8, centroidDriveMinutes: 7, driveTimeMinutes: 7,
      bandRung: 2, mode: 'suburban',
    });
    // R7: band is classified from the centroid drive minutes + mode (single source).
    expect(mockClassifyBand).toHaveBeenCalledWith(7, 'suburban');
  });

  test('pharmacy keys the cache by cellId (two addresses in a cell share one fetch)', async () => {
    mockClient.placesNearby.mockResolvedValue({ data: { results: [makePlace('Cell Rx', ['pharmacy'])] } });
    mockGetDriveTime.mockResolvedValue(6);
    await findNearestPharmacy('38.2101,-84.5447', CELL);
    await findNearestPharmacy('38.2110,-84.5447', CELL); // different address, same cell
    expect(mockClient.placesNearby).toHaveBeenCalledTimes(1);
  });

  test('gas station attaches cell fields and searches from centroid', async () => {
    mockClient.placesNearby.mockResolvedValue({ data: { results: [makePlace('Cell Gas', ['gas_station'])] } });
    mockGetDriveTime.mockResolvedValue(4);
    const result = await findNearestGasStation('38.2101,-84.5447', CELL);
    expect(result).toMatchObject({ cellId: 'CELL_SUB', resolution: 8, centroidDriveMinutes: 4, bandRung: 2, mode: 'suburban' });
    expect(mockClient.placesNearby).toHaveBeenCalledWith(
      expect.objectContaining({ params: expect.objectContaining({ location: CENTROID_STR }) }),
    );
  });
});
