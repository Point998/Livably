'use strict';
const mockTextSearch = jest.fn();
const mockPlacesNearby = jest.fn();
const mockGetDriveTime = jest.fn();
const mockCheckCrossState = jest.fn();

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
  googleMapsClient: { textSearch: mockTextSearch, placesNearby: mockPlacesNearby },
  googleMapsApiKey: 'test-key',
}));
jest.mock('../../../src/shared/google/distanceMatrix', () => ({
  getDriveTime: mockGetDriveTime,
}));
jest.mock('../../../src/shared/validate', () => ({
  checkCrossState: mockCheckCrossState,
}));
jest.mock('../../../src/cache', () => ({ placesCache: mockPlacesCache }));
jest.mock('../../../src/utils/constants', () => ({
  SCHOOL_PLACE_TYPES: new Set(['school', 'primary_school', 'secondary_school']),
  SCHOOL_NAME_TERMS: /school|academy|elementary|middle|high/i,
  ELEMENTARY_SCHOOL_SEARCH_RADIUS_M: 10000,
  ELEMENTARY_SCHOOL_EXCLUSIONS: ['online', 'virtual'],
}));

const { findNearestSchool, findNearestElementarySchool } = require('../../../src/modules/schools/data');

const makePlace = (name, types = ['school'], lat = 38.3, lng = -84.4) => ({
  name,
  types,
  formatted_address: `${name} Address`,
  vicinity: `${name} Vicinity`,
  geometry: { location: { lat, lng } },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPlacesCache.clear();
  // Default: same-state result (valid). Overridden in cross-state tests.
  mockCheckCrossState.mockResolvedValue({ valid: true, resultState: 'KY' });
});

describe('findNearestSchool', () => {
  test('requires both school place type AND school name term', async () => {
    // First result has wrong types, second is valid
    mockPlacesNearby.mockResolvedValue({
      data: {
        results: [
          makePlace('Business Center', ['establishment']),   // not a school type — rejected
          makePlace('Georgetown Elementary School', ['school']), // valid
        ],
      },
    });
    mockGetDriveTime.mockResolvedValue(8);
    const result = await findNearestSchool('38.2,-84.3', 'KY');
    expect(result.name).toBe('Georgetown Elementary School');
    expect(result.note).toContain('school district');
  });

  test('falls back to textSearch when placesNearby returns no valid school', async () => {
    mockPlacesNearby.mockResolvedValue({ data: { results: [makePlace('Community Center', ['establishment'])] } });
    mockTextSearch.mockResolvedValue({ data: { results: [makePlace('Lincoln Middle School', ['school'])] } });
    mockGetDriveTime.mockResolvedValue(12);
    const result = await findNearestSchool('38.2,-84.3', 'KY');
    expect(result.name).toBe('Lincoln Middle School');
    expect(mockTextSearch).toHaveBeenCalledTimes(1);
  });

  // PM-001 regression: Jeffersonville IN must not return a KY school (CONSTRAINT-006)
  test('rejects cross-state school result (Jeffersonville IN → KY school)', async () => {
    mockPlacesNearby.mockResolvedValue({
      data: { results: [makePlace('Louisville Elementary School', ['school'], 38.2, -85.7)] },
    });
    mockCheckCrossState.mockResolvedValue({ valid: false, resultState: 'KY' });
    await expect(findNearestSchool('38.3,-85.7', 'IN')).rejects.toThrow(/Cross-state school rejected/);
    await expect(findNearestSchool('38.3,-85.7', 'IN')).rejects.toThrow(/KY/);
  });

  test('accepts same-state school result', async () => {
    mockPlacesNearby.mockResolvedValue({
      data: { results: [makePlace('Clarksville Elementary School', ['school'], 38.3, -85.7)] },
    });
    mockCheckCrossState.mockResolvedValue({ valid: true, resultState: 'IN' });
    mockGetDriveTime.mockResolvedValue(7);
    const result = await findNearestSchool('38.3,-85.7', 'IN');
    expect(result.name).toBe('Clarksville Elementary School');
  });
});

describe('findNearestElementarySchool', () => {
  test('filters ELEMENTARY_SCHOOL_EXCLUSIONS', async () => {
    mockTextSearch.mockResolvedValue({
      data: {
        results: [
          makePlace('Virtual Online Elementary School', ['school']), // excluded
          makePlace('Oakwood Elementary School', ['school']),         // kept
        ],
      },
    });
    mockGetDriveTime.mockResolvedValue(10);
    const result = await findNearestElementarySchool('38.2,-84.3');
    expect(result.name).toBe('Oakwood Elementary School');
  });

  test('result includes driveTimeMinutes', async () => {
    mockTextSearch.mockResolvedValue({ data: { results: [makePlace('Maple Elementary School', ['school'])] } });
    mockGetDriveTime.mockResolvedValue(7);
    const result = await findNearestElementarySchool('38.2,-84.3');
    expect(result.driveTimeMinutes).toBe(7);
  });
});
