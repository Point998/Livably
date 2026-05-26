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
jest.mock('../../../src/logger', () => ({ logError: jest.fn() }));
jest.mock('../../../src/utils/constants', () => ({
  HOSPITAL_SEARCH_RADIUS_M: 50000,
  HOSPITAL_CANDIDATE_COUNT: 5,
}));

const { findNearestHospital, findNearestUrgentCare } = require('../../../src/modules/health/data');

const makePlace = (name, types = ['hospital'], lat = 38.3, lng = -84.4) => ({
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

describe('findNearestHospital', () => {
  // CONSTRAINT-003: Must return nearest by drive time, NOT by Google search rank
  test('returns nearest by drive time not by Google search rank', async () => {
    // Google returns [hospitalB, hospitalA] in that order
    mockTextSearch.mockResolvedValue({
      data: {
        results: [
          makePlace('Hospital B', ['hospital'], 38.3, -84.4),
          makePlace('Hospital A', ['hospital'], 38.2, -84.5),
        ],
      },
    });
    mockGetDriveTime
      .mockResolvedValueOnce(25)  // Hospital B — Google's #1 but farther
      .mockResolvedValueOnce(12); // Hospital A — Google's #2 but closer
    const result = await findNearestHospital('38.15,-84.55');
    expect(result.name).toBe('Hospital A');
    expect(result.driveTimeMinutes).toBe(12);
  });

  test('falls back to placesNearby when textSearch returns no results', async () => {
    mockTextSearch.mockResolvedValue({ data: { results: [] } });
    mockPlacesNearby.mockResolvedValue({ data: { results: [makePlace('Regional Hospital')] } });
    mockGetDriveTime.mockResolvedValue(20);
    const result = await findNearestHospital('38.15,-84.55');
    expect(result.name).toBe('Regional Hospital');
  });

  test('throws when no hospitals found anywhere', async () => {
    mockTextSearch.mockResolvedValue({ data: { results: [] } });
    mockPlacesNearby.mockResolvedValue({ data: { results: [] } });
    await expect(findNearestHospital('38.15,-84.55')).rejects.toThrow('No hospital found');
  });
});

describe('findNearestUrgentCare', () => {
  test('filters out retail-embedded health clinics (pharmacy/drugstore types)', async () => {
    mockPlacesNearby.mockResolvedValue({
      data: {
        results: [
          makePlace('Little Clinic at Kroger', ['pharmacy', 'store']), // retail-embedded — excluded
          makePlace('FastCare Clinic', ['health']), // standalone — kept
        ],
      },
    });
    mockGetDriveTime.mockResolvedValue(10);
    const result = await findNearestUrgentCare('38.15,-84.55');
    expect(result.name).toBe('FastCare Clinic');
  });

  test('falls back to textSearch when placesNearby returns only retail results', async () => {
    mockPlacesNearby.mockResolvedValue({
      data: { results: [makePlace('MinuteClinic', ['pharmacy'])] },
    });
    mockTextSearch.mockResolvedValue({
      data: { results: [makePlace('City Urgent Care', ['health'])] },
    });
    mockGetDriveTime.mockResolvedValue(15);
    const result = await findNearestUrgentCare('38.15,-84.55');
    expect(result.name).toBe('City Urgent Care');
  });

  test('attaches crossStateWarning for cross-state urgent care (warn, not reject)', async () => {
    mockPlacesNearby.mockResolvedValue({
      data: { results: [makePlace('Louisville Urgent Care', ['health'], 38.2, -85.7)] },
    });
    mockCheckCrossState.mockResolvedValue({ valid: false, resultState: 'KY' });
    mockGetDriveTime.mockResolvedValue(8);
    const result = await findNearestUrgentCare('38.3,-85.7', 'IN');
    expect(result.crossStateWarning).toBe(true);
    expect(result.crossStateNote).toContain('KY');
    expect(result.name).toBe('Louisville Urgent Care'); // not rejected — safety-critical
  });
});
