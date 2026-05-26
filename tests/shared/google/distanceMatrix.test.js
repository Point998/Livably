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

jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: mockClient,
  googleMapsApiKey: 'test-key',
}));
jest.mock('../../../src/cache', () => ({
  driveTimeCache: mockDriveTimeCache,
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

const { getDriveTime, getTrafficVariations } = require('../../../src/shared/google/distanceMatrix');

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
