'use strict';

// PM-001 regression suite — Jeffersonville IN (1007 Stonelilly Dr, Jeffersonville, IN 47130)
// Border city: physical address is IN, nearest schools/hospitals may be in KY.
// CONSTRAINT-006: Cross-state results must be flagged or rejected.
//
// These are mocked integration tests — no real API calls.

// ── findNearestSchool (mocked) ────────────────────────────────────────────────

const mockTextSearch = jest.fn();
const mockPlacesNearby = jest.fn();
const mockGetDriveTime = jest.fn();
const mockCheckCrossState = jest.fn();
const mockCheckDriveTimeCoherence = jest.fn();

const makeMockCache = () => {
  const store = new Map();
  return { get: (k) => (store.has(k) ? store.get(k) : null), set: (k, v) => store.set(k, v), clear: () => store.clear() };
};
const mockPlacesCache = makeMockCache();

jest.mock('../../src/shared/google/client', () => ({
  googleMapsClient: { textSearch: mockTextSearch, placesNearby: mockPlacesNearby },
  googleMapsApiKey: 'test-key',
}));
jest.mock('../../src/shared/google/distanceMatrix', () => ({ getDriveTime: mockGetDriveTime }));
jest.mock('../../src/shared/validate', () => ({
  checkCrossState: mockCheckCrossState,
  checkDriveTimeCoherence: mockCheckDriveTimeCoherence,
}));
jest.mock('../../src/errorMemory', () => ({ getMitigation: jest.fn().mockReturnValue(8000) }));
jest.mock('../../src/cache', () => ({ placesCache: mockPlacesCache }));
jest.mock('../../src/logger', () => ({ logError: jest.fn() }));
jest.mock('../../src/utils/constants', () => ({
  SCHOOL_PLACE_TYPES: new Set(['school', 'primary_school', 'secondary_school']),
  SCHOOL_NAME_TERMS: /school|academy|elementary|middle|high/i,
  ELEMENTARY_SCHOOL_SEARCH_RADIUS_M: 10000,
  ELEMENTARY_SCHOOL_EXCLUSIONS: ['online', 'virtual'],
  HOSPITAL_SEARCH_RADIUS_M: 50000,
  HOSPITAL_CANDIDATE_COUNT: 5,
  GROCERY_SEARCH_RADIUS_M: 8000,
  GROCERY_CANDIDATE_COUNT: 5,
  GROCERY_EXCLUDED_TYPES: ['gas_station', 'convenience_store'],
}));

const { findNearestSchool, findNearestElementarySchool } = require('../../src/modules/schools/data');
const { findNearestHospital } = require('../../src/modules/health/data');
const { findNearestGrocery } = require('../../src/modules/reachability/data');

const JEFFERSONVILLE_LATLNG = '38.2766,-85.7372';
const ORIGIN_STATE = 'IN';

const makePlace = (name, types, lat, lng) => ({
  name,
  types,
  formatted_address: `${name} Address`,
  vicinity: `${name} Vicinity`,
  geometry: { location: { lat, lng } },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPlacesCache.clear();
  mockCheckCrossState.mockResolvedValue({ valid: true, resultState: 'IN' });
  mockCheckDriveTimeCoherence.mockReturnValue({ ok: true });
});

// ── PM-001 regression: School cross-state check ───────────────────────────────

describe('Jeffersonville IN — school search (PM-001 regression)', () => {
  test('rejects a KY school when originState is IN', async () => {
    // Google returns a KY school (Louisville area) first
    const kySchool = makePlace('Louisville Elementary School', ['school'], 38.2, -85.75);
    mockPlacesNearby.mockResolvedValue({ data: { results: [kySchool] } });
    mockCheckCrossState.mockResolvedValue({ valid: false, resultState: 'KY' });

    await expect(findNearestSchool(JEFFERSONVILLE_LATLNG, ORIGIN_STATE))
      .rejects.toThrow(/Cross-state school rejected/);
  });

  test('accepts an IN school when originState is IN', async () => {
    const inSchool = makePlace('Clarksville Middle School', ['school'], 38.29, -85.75);
    mockPlacesNearby.mockResolvedValue({ data: { results: [inSchool] } });
    mockCheckCrossState.mockResolvedValue({ valid: true, resultState: 'IN' });
    mockGetDriveTime.mockResolvedValue(8);

    const result = await findNearestSchool(JEFFERSONVILLE_LATLNG, ORIGIN_STATE);
    expect(result.name).toBe('Clarksville Middle School');
    expect(result.driveTimeMinutes).toBe(8);
  });

  test('cross-state check is called with originState IN for every candidate', async () => {
    const inSchool = makePlace('Jeffersonville High School', ['school'], 38.28, -85.73);
    mockPlacesNearby.mockResolvedValue({ data: { results: [inSchool] } });
    mockGetDriveTime.mockResolvedValue(6);

    await findNearestSchool(JEFFERSONVILLE_LATLNG, ORIGIN_STATE);

    expect(mockCheckCrossState).toHaveBeenCalledWith(
      expect.anything(),
      ORIGIN_STATE
    );
  });
});

// ── CONSTRAINT-006: Hospital cross-state check ────────────────────────────────

describe('Jeffersonville IN — hospital search (CONSTRAINT-006)', () => {
  test('returns a hospital with crossStateWarning when nearest is in KY', async () => {
    const kyHospital = makePlace('University of Louisville Hospital', ['hospital'], 38.24, -85.75);
    mockTextSearch.mockResolvedValue({ data: { results: [kyHospital] } });
    mockCheckCrossState.mockResolvedValue({ valid: false, resultState: 'KY' });
    mockGetDriveTime.mockResolvedValue(15);

    const result = await findNearestHospital(JEFFERSONVILLE_LATLNG, ORIGIN_STATE);
    // Hospital should be returned (not rejected) with a cross-state warning flag
    expect(result).not.toBeNull();
    expect(result.crossStateWarning).toBe(true);
    expect(result.name).toBe('University of Louisville Hospital');
  });

  test('returns IN hospital without warning when nearest is in-state', async () => {
    const inHospital = makePlace('Clark Memorial Hospital', ['hospital'], 38.28, -85.73);
    mockTextSearch.mockResolvedValue({ data: { results: [inHospital] } });
    mockCheckCrossState.mockResolvedValue({ valid: true, resultState: 'IN' });
    mockGetDriveTime.mockResolvedValue(10);

    const result = await findNearestHospital(JEFFERSONVILLE_LATLNG, ORIGIN_STATE);
    expect(result).not.toBeNull();
    expect(result.crossStateWarning).toBeFalsy();
    expect(result.name).toBe('Clark Memorial Hospital');
  });
});

// ── CONSTRAINT-010: Grocery coherence check ───────────────────────────────────

describe('Jeffersonville IN — grocery coherence check (CONSTRAINT-010)', () => {
  const makeGroceryPlace = (name, lat, lng) => ({
    name,
    formatted_address: `${name} Address`,
    types: ['supermarket', 'grocery_or_supermarket'],
    geometry: { location: { lat, lng } },
  });

  test('coherence check is called with drive time and suburban ruralMode', async () => {
    const store = makeGroceryPlace('Kroger', 38.28, -85.73);
    mockPlacesNearby.mockResolvedValue({ data: { results: [store] } });
    mockTextSearch.mockResolvedValue({ data: { results: [store] } });
    mockGetDriveTime.mockResolvedValue(12);

    await findNearestGrocery(JEFFERSONVILLE_LATLNG, 'suburban');

    expect(mockCheckDriveTimeCoherence).toHaveBeenCalledWith(12, 'grocery store', 'suburban');
  });

  test('flags coherenceWarning when grocery is > 45 min for suburban address', async () => {
    const farStore = makeGroceryPlace('Distant Kroger', 38.0, -85.0);
    mockTextSearch.mockResolvedValue({ data: { results: [farStore] } });
    mockGetDriveTime.mockResolvedValue(52);
    mockCheckDriveTimeCoherence.mockReturnValue({ ok: false, reason: 'Drive time 52 min exceeds suburban threshold of 45 min' });

    const result = await findNearestGrocery(JEFFERSONVILLE_LATLNG, 'suburban');
    expect(result[0].coherenceWarning).toBe(true);
    expect(result[0].coherenceReason).toMatch(/45 min/);
  });

  test('no coherenceWarning for nearby grocery', async () => {
    const nearStore = makeGroceryPlace('Nearby Kroger', 38.27, -85.73);
    mockTextSearch.mockResolvedValue({ data: { results: [nearStore] } });
    mockGetDriveTime.mockResolvedValue(8);
    // Default mock returns { ok: true }

    const result = await findNearestGrocery(JEFFERSONVILLE_LATLNG, 'suburban');
    expect(result[0].coherenceWarning).toBeUndefined();
  });
});
