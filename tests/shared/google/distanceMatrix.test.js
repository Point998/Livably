'use strict';
const mockClient = { distancematrix: jest.fn() };

// Cache mock returns null on miss (matching the real file-based Cache class behaviour)
const makeMockCache = () => {
  const store = new Map();
  return {
    get: (k) => (store.has(k) ? store.get(k) : null),
    set: (k, v) => store.set(k, v),
    clear: () => store.clear(),
  };
};
const mockDriveTimeCache = makeMockCache();
const mockDriveTimeCellCache = makeMockCache();

jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: mockClient,
  googleMapsApiKey: 'test-key',
}));
jest.mock('../../../src/cache', () => ({
  driveTimeCache: mockDriveTimeCache,
  driveTimeCellCache: mockDriveTimeCellCache,
}));
jest.mock('../../../src/utils/time', () => ({
  getNextTuesday8am: jest.fn().mockReturnValue(1748000000),
  getNextDayAt: jest.fn().mockReturnValue(1748000000),
}));
jest.mock('../../../src/utils/constants', () => ({
  TRAFFIC_VARIATION_SLOTS: [
    { label: 'morningRush', display: '8am Mon',  targetDay: 1, hour: 8  },
    { label: 'midday',      display: '12pm Mon', targetDay: 1, hour: 12 },
    { label: 'eveningRush', display: '5pm Mon',  targetDay: 1, hour: 17 },
    { label: 'weekend',     display: '10am Sat', targetDay: 6, hour: 10 },
  ],
}));

const { getDriveTime, getTrafficVariations, getExactDriveTime } = require('../../../src/shared/google/distanceMatrix');

const makeMatrixResponse = (seconds) => ({
  data: {
    rows: [{ elements: [{ status: 'OK', duration_in_traffic: { value: seconds } }] }],
  },
});

describe('getDriveTime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDriveTimeCache.clear();
  });

  test('returns integer minutes', async () => {
    mockClient.distancematrix.mockResolvedValue(makeMatrixResponse(720)); // 720s = 12 min
    const result = await getDriveTime('38.2,-84.5', { lat: 38.3, lng: -84.4 });
    expect(result).toBe(12);
  });

  test('returns cached value on second call', async () => {
    mockClient.distancematrix.mockResolvedValue(makeMatrixResponse(720));
    await getDriveTime('38.2,-84.5', { lat: 38.3, lng: -84.4 });
    await getDriveTime('38.2,-84.5', { lat: 38.3, lng: -84.4 });
    expect(mockClient.distancematrix).toHaveBeenCalledTimes(1);
  });

  test('throws on non-OK element status', async () => {
    mockClient.distancematrix.mockResolvedValue({
      data: { rows: [{ elements: [{ status: 'NOT_FOUND' }] }] },
    });
    await expect(getDriveTime('38.2,-84.5', { lat: 38.3, lng: -84.4 })).rejects.toThrow();
  });
});

describe('getTrafficVariations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDriveTimeCache.clear();
  });

  test('returns null when all slots fail', async () => {
    mockClient.distancematrix.mockRejectedValue(new Error('timeout'));
    const result = await getTrafficVariations('38.2,-84.5', { lat: 38.3, lng: -84.4 });
    expect(result).toBeNull();
  });

  test('calculates min/max/avg correctly from successful slots', async () => {
    mockClient.distancematrix
      .mockResolvedValueOnce(makeMatrixResponse(600))   // 10 min
      .mockResolvedValueOnce(makeMatrixResponse(900))   // 15 min
      .mockResolvedValueOnce(makeMatrixResponse(1200))  // 20 min
      .mockResolvedValueOnce(makeMatrixResponse(720));  // 12 min
    const result = await getTrafficVariations('38.2,-84.5', { lat: 38.3, lng: -84.4 });
    expect(result).not.toBeNull();
    expect(result.stats.min).toBe(10);
    expect(result.stats.max).toBe(20);
  });
});

// ── FR-058: cell-based keying + safety-tier exact path ────────────────────────

const DEST = { lat: 38.3, lng: -84.4 };
const DEST_STR = '38.3,-84.4';

describe('getDriveTime — cell keying (FR-058)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDriveTimeCache.clear();
    mockDriveTimeCellCache.clear();
  });

  test('two distinct origins in the same cell share one API call', async () => {
    mockClient.distancematrix.mockResolvedValue(makeMatrixResponse(720));
    // Different raw address strings, same cellId — the core cache-sharing win.
    await getDriveTime('38.2101,-84.5447', DEST, { cellId: 'CELL_X' });
    await getDriveTime('38.2110,-84.5447', DEST, { cellId: 'CELL_X' });
    expect(mockClient.distancematrix).toHaveBeenCalledTimes(1);
  });

  test('cell-keyed value is stored in the cell cache under the cellId, not the per-address cache', async () => {
    mockClient.distancematrix.mockResolvedValue(makeMatrixResponse(720));
    await getDriveTime('38.2101,-84.5447', DEST, { cellId: 'CELL_X' });
    expect(mockDriveTimeCellCache.get(`CELL_X:${DEST_STR}`)).toBe(12);
    expect(mockDriveTimeCache.get(`38.2101,-84.5447:${DEST_STR}`)).toBeNull();
  });

  test('without a cellId, keeps backward-compatible per-address keying in the short cache', async () => {
    mockClient.distancematrix.mockResolvedValue(makeMatrixResponse(720));
    await getDriveTime('38.2,-84.5', DEST);
    expect(mockDriveTimeCache.get(`38.2,-84.5:${DEST_STR}`)).toBe(12);
    expect(mockDriveTimeCellCache.get(`38.2,-84.5:${DEST_STR}`)).toBeNull();
  });
});

describe('getExactDriveTime — safety tier (FR-058)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDriveTimeCache.clear();
    mockDriveTimeCellCache.clear();
  });

  test('computes per-address: two different addresses do NOT share (exact for each house)', async () => {
    mockClient.distancematrix.mockResolvedValue(makeMatrixResponse(720));
    await getExactDriveTime('38.2101,-84.5447', DEST);
    await getExactDriveTime('38.2110,-84.5447', DEST);
    expect(mockClient.distancematrix).toHaveBeenCalledTimes(2);
  });

  test('never writes to the long-TTL cell cache', async () => {
    mockClient.distancematrix.mockResolvedValue(makeMatrixResponse(720));
    await getExactDriveTime('38.2101,-84.5447', DEST);
    expect(mockDriveTimeCellCache.get(`38.2101,-84.5447:${DEST_STR}`)).toBeNull();
  });

  test('returns integer minutes', async () => {
    mockClient.distancematrix.mockResolvedValue(makeMatrixResponse(900));
    expect(await getExactDriveTime('38.2,-84.5', DEST)).toBe(15);
  });
});

describe('getTrafficVariations — cell keying (FR-058)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDriveTimeCache.clear();
    mockDriveTimeCellCache.clear();
  });

  test('cell-keyed traffic slots are shared across addresses in the same cell', async () => {
    mockClient.distancematrix.mockResolvedValue(makeMatrixResponse(600));
    // 4 slots → 4 calls on first address; second same-cell address adds none.
    await getTrafficVariations('38.2101,-84.5447', DEST, { cellId: 'CELL_T' });
    await getTrafficVariations('38.2110,-84.5447', DEST, { cellId: 'CELL_T' });
    expect(mockClient.distancematrix).toHaveBeenCalledTimes(4);
  });
});
