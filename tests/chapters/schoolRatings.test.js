'use strict';

// FR-082 / PM-005 — cross-state filter for the SCHOOLS CHAPTER path (getSchoolRatings).
// PM-001's fix covered findNearestSchool only; this is the regression test for the chapter
// data path. Origin: Jeffersonville IN (border city) — KY schools must be dropped/flagged.

const mockCheckCrossState = jest.fn();
jest.mock('../../src/shared/validate', () => ({
  checkCrossState: (...args) => mockCheckCrossState(...args),
  getBasementContext: jest.fn(),
  detectRuralMode: jest.fn(),
}));

const { getSchoolRatings } = require('../../src/chapters');

// Jeffersonville IN origin.
const LAT = 38.2766;
const LNG = -85.7372;
const ORIGIN_STATE = 'IN';

// KY marker lat (across the river); FAR KY marker (>50 mi).
const KY_LAT = 38.24, KY_LNG = -85.75;        // ~3 mi — within 50
const KY_FAR_LAT = 37.5, KY_FAR_LNG = -85.0;  // ~65 mi — beyond 50
const IN_LAT = 38.29, IN_LNG = -85.73;        // in-state

const makePlace = (name, lat, lng) => ({
  name,
  formatted_address: `${name} Address`,
  vicinity: `${name} Vicinity`,
  geometry: { location: { lat, lng } },
});

// Dispatches textSearch by query. publicByLevel keyed by query string.
const makeClient = (byQuery) => ({
  textSearch: jest.fn(async ({ params }) => ({ data: { results: byQuery[params.query] || [] } })),
});
const getDriveTime = jest.fn(async () => 7);

beforeEach(() => {
  jest.clearAllMocks();
  getDriveTime.mockResolvedValue(7);
  // Default: anything at KY coords is cross-state; everything else in-state.
  mockCheckCrossState.mockImplementation(async (loc) => {
    const isKY = (loc.lat === KY_LAT || loc.lat === KY_FAR_LAT);
    return isKY ? { valid: false, resultState: 'KY' } : { valid: true, resultState: 'IN' };
  });
});

const onlyElementary = (results) => ({
  'public elementary school': results,
  'middle school': [],
  'high school': [],
  'private school': [],
});

describe('getSchoolRatings — cross-state filter (FR-082 / PM-005)', () => {
  test('drops a KY result and picks the in-state alternative (AC-1)', async () => {
    const client = makeClient(onlyElementary([
      makePlace('Louisville Elementary', KY_LAT, KY_LNG),   // KY — dropped
      makePlace('Spring Hill Elementary', IN_LAT, IN_LNG),  // IN — chosen
    ]));
    const out = await getSchoolRatings(LAT, LNG, `${LAT},${LNG}`, client, 'k', getDriveTime, ORIGIN_STATE);
    const elem = out.public.find(Boolean);
    expect(elem.name).toBe('Spring Hill Elementary');
    expect(elem.crossState).toBeUndefined();
  });

  test('flags cross-state when no in-state option exists within 50 mi (AC-3)', async () => {
    const client = makeClient(onlyElementary([makePlace('Louisville Elementary', KY_LAT, KY_LNG)]));
    const out = await getSchoolRatings(LAT, LNG, `${LAT},${LNG}`, client, 'k', getDriveTime, ORIGIN_STATE);
    const elem = out.public.find(Boolean);
    expect(elem.name).toBe('Louisville Elementary');
    expect(elem.crossState).toBe(true);
    expect(elem.crossStateNote).toMatch(/KY/);
  });

  test('drops entirely when the only option is cross-state and beyond 50 mi', async () => {
    const client = makeClient(onlyElementary([makePlace('Far KY Elementary', KY_FAR_LAT, KY_FAR_LNG)]));
    const out = await getSchoolRatings(LAT, LNG, `${LAT},${LNG}`, client, 'k', getDriveTime, ORIGIN_STATE);
    // No in-state public, no private -> whole chapter null.
    expect(out).toBeNull();
  });

  test('drops cross-state private schools, keeps in-state ones', async () => {
    const client = makeClient({
      'public elementary school': [makePlace('Spring Hill Elementary', IN_LAT, IN_LNG)],
      'middle school': [],
      'high school': [],
      'private school': [
        makePlace('Sacred Heart KY', KY_LAT, KY_LNG),   // dropped
        makePlace('Providence IN', IN_LAT, IN_LNG),      // kept
      ],
    });
    const out = await getSchoolRatings(LAT, LNG, `${LAT},${LNG}`, client, 'k', getDriveTime, ORIGIN_STATE);
    expect(out.private.map((s) => s.name)).toEqual(['Providence IN']);
  });

  test('no filtering when originState is empty (unchanged behavior)', async () => {
    mockCheckCrossState.mockResolvedValue({ valid: true, resultState: '' });
    const client = makeClient(onlyElementary([makePlace('Some Elementary', KY_LAT, KY_LNG)]));
    const out = await getSchoolRatings(LAT, LNG, `${LAT},${LNG}`, client, 'k', getDriveTime, '');
    expect(out.public.find(Boolean).name).toBe('Some Elementary');
  });
});
