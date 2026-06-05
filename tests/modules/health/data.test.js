'use strict';
const mockTextSearch = jest.fn();
const mockPlacesNearby = jest.fn();
const mockGetDriveTime = jest.fn();
const mockGetExactDriveTime = jest.fn();
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
  getExactDriveTime: mockGetExactDriveTime,
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

// ── FR-058: safety-tier cell selection + per-address exact time ───────────────
// CONSTRAINT-003 preserved: 5-candidate selection is shared (cell-keyed from the
// centroid), but the displayed drive time is recomputed from the ACTUAL address.

const HCELL = { cellId: 'CELL_H', resolution: 9, centroid: { lat: 38.16, lng: -84.56 } };
const HCENTROID_STR = '38.16,-84.56';

describe('findNearestHospital — cell safety tier (FR-058)', () => {
  test('selects shortest from centroid but displays the exact per-address drive time', async () => {
    mockTextSearch.mockResolvedValue({
      data: {
        results: [
          makePlace('Hospital B', ['hospital'], 38.3, -84.4),
          makePlace('Hospital A', ['hospital'], 38.2, -84.5),
        ],
      },
    });
    mockGetDriveTime.mockResolvedValueOnce(25).mockResolvedValueOnce(12); // centroid selection
    mockGetExactDriveTime.mockResolvedValue(13); // from the actual address
    const result = await findNearestHospital('38.15,-84.55', 'KY', HCELL);
    expect(result.name).toBe('Hospital A');           // CONSTRAINT-003: shortest by drive time
    expect(result.driveTimeMinutes).toBe(13);          // displayed = exact per-address
    expect(result.exactDriveMinutes).toBe(13);
    expect(result.cellId).toBe('CELL_H');
  });

  test('selection drive times are computed from the centroid with the cellId option', async () => {
    mockTextSearch.mockResolvedValue({ data: { results: [makePlace('Only Hospital', ['hospital'])] } });
    mockGetDriveTime.mockResolvedValue(10);
    mockGetExactDriveTime.mockResolvedValue(11);
    await findNearestHospital('38.15,-84.55', 'KY', HCELL);
    expect(mockGetDriveTime).toHaveBeenCalledWith(HCENTROID_STR, expect.anything(), { cellId: 'CELL_H' });
  });

  test('exact drive time is computed from the actual address, never the centroid', async () => {
    mockTextSearch.mockResolvedValue({ data: { results: [makePlace('Only Hospital', ['hospital'])] } });
    mockGetDriveTime.mockResolvedValue(10);
    mockGetExactDriveTime.mockResolvedValue(11);
    await findNearestHospital('38.15,-84.55', 'KY', HCELL);
    expect(mockGetExactDriveTime).toHaveBeenCalledWith('38.15,-84.55', expect.anything());
  });

  test('two addresses in the same cell share the candidate selection (one search) but each gets its own exact time', async () => {
    mockTextSearch.mockResolvedValue({ data: { results: [makePlace('Shared Hospital', ['hospital'])] } });
    mockGetDriveTime.mockResolvedValue(10);
    mockGetExactDriveTime.mockResolvedValueOnce(11).mockResolvedValueOnce(14);
    const r1 = await findNearestHospital('38.15,-84.55', 'KY', HCELL);
    const r2 = await findNearestHospital('38.17,-84.57', 'KY', HCELL);
    expect(mockTextSearch).toHaveBeenCalledTimes(1);       // selection shared
    expect(r1.driveTimeMinutes).toBe(11);                   // per-address exact
    expect(r2.driveTimeMinutes).toBe(14);
  });

  // CONSTRAINT-015: a transient failure of the extra per-address exact call must
  // not discard an already-selected safety facility — fall back to the centroid time.
  test('keeps the safety result and falls back to the centroid time when the exact recompute fails', async () => {
    mockTextSearch.mockResolvedValue({ data: { results: [makePlace('Only Hospital', ['hospital'])] } });
    mockGetDriveTime.mockResolvedValue(10); // centroid selection
    mockGetExactDriveTime.mockRejectedValue(new Error('Distance Matrix timeout'));
    const result = await findNearestHospital('38.15,-84.55', 'KY', HCELL);
    expect(result).not.toBeNull();
    expect(result.name).toBe('Only Hospital');
    expect(result.driveTimeMinutes).toBe(10); // graceful fallback to centroid value
  });

  // CONSTRAINT-006 / PM-001: an H3 cell can straddle a state border (Jeffersonville
  // IN / Louisville KY). Cross-state status depends on the asking address's state,
  // so it must be determined per address — NOT inherited from a cell-shared cache.
  test('cross-state is determined per address, not shared across the cell (border safety)', async () => {
    mockTextSearch.mockResolvedValue({ data: { results: [makePlace('Louisville Hospital', ['hospital'], 38.2, -85.75)] } });
    mockGetDriveTime.mockResolvedValue(10);
    mockGetExactDriveTime.mockResolvedValue(11);
    mockCheckCrossState.mockImplementation(async (_loc, originState) =>
      (originState === 'IN' ? { valid: false, resultState: 'KY' } : { valid: true, resultState: 'KY' }));

    const inResult = await findNearestHospital('38.2766,-85.7372', 'IN', HCELL); // IN buyer
    const kyResult = await findNearestHospital('38.2000,-85.7500', 'KY', HCELL); // KY neighbor, same cell

    expect(mockTextSearch).toHaveBeenCalledTimes(1);   // expensive selection still shared
    expect(inResult.crossStateWarning).toBe(true);      // IN buyer: hospital is cross-state (KY)
    expect(kyResult.crossStateWarning).toBeFalsy();     // KY buyer: same-state, no false warning
  });
});

describe('findNearestUrgentCare — cell safety tier (FR-058)', () => {
  test('displays exact per-address drive time and carries cell fields', async () => {
    mockPlacesNearby.mockResolvedValue({ data: { results: [makePlace('Cell Urgent Care', ['health'])] } });
    mockGetDriveTime.mockResolvedValue(9);
    mockGetExactDriveTime.mockResolvedValue(10);
    const result = await findNearestUrgentCare('38.15,-84.55', 'KY', HCELL);
    expect(result.driveTimeMinutes).toBe(10);
    expect(result.exactDriveMinutes).toBe(10);
    expect(result.cellId).toBe('CELL_H');
  });
});
