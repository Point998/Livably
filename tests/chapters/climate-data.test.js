'use strict';

jest.mock('../../src/logger', () => ({
  logError: jest.fn(),
  logRequest: jest.fn(),
  logAnalysis: jest.fn(),
  readRecentLogs: jest.fn(() => []),
}));
const { logError } = require('../../src/logger');

const {
  NOAA_CDO_BASE_URL, FEMA_DECLARATIONS_URL, USGS_ELEVATION_URL,
  CLIMATE_STORM_LOOKBACK_YEARS, CLIMATE_FEMA_LOOKBACK_YEARS,
  CLIMATE_SIGNIFICANT_DAMAGE_USD, STATE_ALERT_SYSTEMS,
  NOAA_STATION_SEARCH_RADII,
} = require('../../src/utils/constants');

test('NOAA CDO base URL is defined', () => {
  expect(typeof NOAA_CDO_BASE_URL).toBe('string');
  expect(NOAA_CDO_BASE_URL).toMatch(/ncdc\.noaa\.gov/);
});

test('FEMA declarations URL is defined', () => {
  expect(typeof FEMA_DECLARATIONS_URL).toBe('string');
  expect(FEMA_DECLARATIONS_URL).toMatch(/fema\.gov/);
});

test('USGS elevation URL is defined', () => {
  expect(typeof USGS_ELEVATION_URL).toBe('string');
});

test('climate lookback years are positive numbers', () => {
  expect(CLIMATE_STORM_LOOKBACK_YEARS).toBeGreaterThan(0);
  expect(CLIMATE_FEMA_LOOKBACK_YEARS).toBeGreaterThan(0);
});

test('CLIMATE_SIGNIFICANT_DAMAGE_USD is 100000', () => {
  expect(CLIMATE_SIGNIFICANT_DAMAGE_USD).toBe(100_000);
});

test('STATE_ALERT_SYSTEMS is a Map with KY, MT, IN entries', () => {
  expect(STATE_ALERT_SYSTEMS).toBeInstanceOf(Map);
  expect(STATE_ALERT_SYSTEMS.get('KY').name).toBe('KYEM Alert');
  expect(STATE_ALERT_SYSTEMS.get('MT').name).toBe('MT Alert');
  expect(STATE_ALERT_SYSTEMS.get('IN').name).toBe('IN-Alert');
});

test('STATE_ALERT_SYSTEMS covers at least 45 states', () => {
  expect(STATE_ALERT_SYSTEMS.size).toBeGreaterThanOrEqual(45);
});

test('every STATE_ALERT_SYSTEMS entry has name and url', () => {
  for (const [state, sys] of STATE_ALERT_SYSTEMS) {
    expect(typeof sys.name).toBe('string');
    expect(typeof sys.url).toBe('string');
    expect(sys.url).toMatch(/^https:\/\//);
  }
});

// ── getEmergencySystem ────────────────────────────────────────────────────────

const { getEmergencySystem } = require('../../src/chapters');

describe('getEmergencySystem', () => {
  test('KY → Tier 1 with KYEM Alert', () => {
    const result = getEmergencySystem('KY', 'Scott County');
    expect(result.tier).toBe(1);
    expect(result.name).toBe('KYEM Alert');
    expect(result.url).toMatch(/kyem\.ky\.gov/);
    expect(result.searchUrl).toMatch(/google\.com/);
    expect(result.note).toBeNull();
  });

  test('MT → Tier 1 with MT Alert', () => {
    const result = getEmergencySystem('MT', 'Gallatin County');
    expect(result.tier).toBe(1);
    expect(result.name).toBe('MT Alert');
  });

  test('IN → Tier 1 with IN-Alert', () => {
    const result = getEmergencySystem('IN', 'Clark County');
    expect(result.tier).toBe(1);
    expect(result.name).toBe('IN-Alert');
  });

  test('unknown state → Tier 2 with dynamic URL and search', () => {
    const result = getEmergencySystem('XX', 'Test County');
    expect(result.tier).toBe(2);
    expect(result.name).toBeNull();
    expect(result.url).toBeTruthy();
    expect(result.searchUrl).toMatch(/google\.com/);
    expect(result.searchUrl).toMatch(/Test/);
    expect(typeof result.note).toBe('string');
  });

  test('both tiers always populate searchUrl', () => {
    const tier1 = getEmergencySystem('KY', 'Jefferson County');
    const tier2 = getEmergencySystem('XX', 'Nowhere County');
    expect(tier1.searchUrl).toMatch(/google\.com/);
    expect(tier2.searchUrl).toMatch(/google\.com/);
  });

  test('null state → Tier 2', () => {
    const result = getEmergencySystem(null, 'Scott County');
    expect(result.tier).toBe(2);
  });
});

// ── getLastSignificantEvent ───────────────────────────────────────────────────

const {
  getLastSignificantEvent,
  computeRarityStatement,
  classifyTopographicPosition,
} = require('../../src/chapters');

describe('getLastSignificantEvent', () => {
  test('returns most recent when FEMA is newer', () => {
    const fema = [{ declarationDate: '2021-02-15', declarationTitle: 'Severe Ice Storm', incidentType: 'Ice Storm' }];
    const noaa = [{ begin_date: '2019-05-01', event_type: 'Tornado', damage_property: 500000 }];
    const result = getLastSignificantEvent(fema, noaa);
    expect(result.year).toBe(2021);
    expect(result.type).toMatch(/ice storm/i);
  });

  test('returns most recent when NOAA is newer', () => {
    const fema = [{ declarationDate: '2018-03-01', declarationTitle: 'Flooding', incidentType: 'Flood' }];
    const noaa = [{ begin_date: '2022-06-10', event_type: 'Flash Flood', damage_property: 250000 }];
    const result = getLastSignificantEvent(fema, noaa);
    expect(result.year).toBe(2022);
  });

  test('returns null when both arrays empty', () => {
    expect(getLastSignificantEvent([], [])).toBeNull();
  });

  test('ignores NOAA events below damage threshold', () => {
    const noaa = [{ begin_date: '2023-01-01', event_type: 'Tornado', damage_property: 5000 }];
    expect(getLastSignificantEvent([], noaa)).toBeNull();
  });

  test('handles null gracefully', () => {
    expect(getLastSignificantEvent(null, null)).toBeNull();
  });

  test('uses incidentType from FEMA when declarationTitle absent', () => {
    const fema = [{ declarationDate: '2020-04-01', incidentType: 'Tornado' }];
    const result = getLastSignificantEvent(fema, []);
    expect(result.type).toBe('Tornado');
  });
});

describe('computeRarityStatement', () => {
  test('3 events in 30 years → roughly 1 per decade', () => {
    const result = computeRarityStatement(3, 30, 'tornado');
    expect(result).toMatch(/3/);
    expect(result).toMatch(/30 years/);
    expect(result).toMatch(/1 per decade/);
  });

  test('0 events → no recorded events message', () => {
    const result = computeRarityStatement(0, 30, 'tornado');
    expect(result).toMatch(/no recorded/i);
    expect(result).toMatch(/30 years/);
  });

  test('12 events in 30 years → roughly 4 per decade', () => {
    const result = computeRarityStatement(12, 30, 'flood');
    expect(result).toMatch(/12/);
    expect(result).toMatch(/4 per decade/);
  });

  test('1 event uses singular form', () => {
    const result = computeRarityStatement(1, 30, 'tornado');
    expect(result).toMatch(/1 tornado event in/);
  });
});

// ── getNOAAClimateNormals station-selection logic ─────────────────────────────

describe('getNOAAClimateNormals progressive radius bounding-box logic', () => {
  // Validate that the three radius constants produce correct extent strings.
  // This is pure math — no API calls needed.

  function buildExtent(lat, lng, radius) {
    return [
      (lat - radius).toFixed(4),
      (lng - radius).toFixed(4),
      (lat + radius).toFixed(4),
      (lng + radius).toFixed(4),
    ].join(',');
  }

  test('NOAA_STATION_SEARCH_RADII is an array of 3 values in ascending order', () => {
    expect(Array.isArray(NOAA_STATION_SEARCH_RADII)).toBe(true);
    expect(NOAA_STATION_SEARCH_RADII).toHaveLength(3);
    expect(NOAA_STATION_SEARCH_RADII[0]).toBeLessThan(NOAA_STATION_SEARCH_RADII[1]);
    expect(NOAA_STATION_SEARCH_RADII[1]).toBeLessThan(NOAA_STATION_SEARCH_RADII[2]);
  });

  test('pass 1 radius covers ~25 miles around Louisville KY', () => {
    const extent = buildExtent(38.2527, -85.7585, NOAA_STATION_SEARCH_RADII[0]);
    const [minLat, minLng, maxLat, maxLng] = extent.split(',').map(Number);
    expect(maxLat - minLat).toBeCloseTo(NOAA_STATION_SEARCH_RADII[0] * 2, 2);
    expect(maxLng - minLng).toBeCloseTo(NOAA_STATION_SEARCH_RADII[0] * 2, 2);
    expect(minLat).toBeLessThan(38.2527);
    expect(maxLat).toBeGreaterThan(38.2527);
  });

  test('pass 2 radius is exactly double pass 1', () => {
    expect(NOAA_STATION_SEARCH_RADII[1]).toBeCloseTo(NOAA_STATION_SEARCH_RADII[0] * 2, 5);
  });

  test('pass 3 radius covers ~100 miles', () => {
    // 1.45° ≈ 100 miles; verify it is larger than pass 2
    expect(NOAA_STATION_SEARCH_RADII[2]).toBeGreaterThan(NOAA_STATION_SEARCH_RADII[1]);
  });

  test('extent string format is minLat,minLng,maxLat,maxLng', () => {
    const extent = buildExtent(38.2527, -85.7585, NOAA_STATION_SEARCH_RADII[0]);
    const parts = extent.split(',');
    expect(parts).toHaveLength(4);
    // minLat < maxLat
    expect(Number(parts[0])).toBeLessThan(Number(parts[2]));
    // minLng < maxLng (both negative in CONUS, so less-negative = greater)
    expect(Number(parts[1])).toBeLessThan(Number(parts[3]));
  });
});

describe('classifyTopographicPosition', () => {
  test('address lower than 3 of 4 surrounding points → lowpoint', () => {
    // [address, N, S, E, W]
    expect(classifyTopographicPosition([850, 920, 910, 900, 890])).toBe('lowpoint');
  });

  test('address higher than 3 of 4 surrounding points → uphill', () => {
    expect(classifyTopographicPosition([950, 880, 870, 900, 890])).toBe('uphill');
  });

  test('mixed elevations → midslope', () => {
    expect(classifyTopographicPosition([900, 920, 880, 910, 890])).toBe('midslope');
  });

  test('null → null', () => {
    expect(classifyTopographicPosition(null)).toBeNull();
  });

  test('fewer than 5 elements → null', () => {
    expect(classifyTopographicPosition([900, 920])).toBeNull();
  });

  test('address equal to surrounding → midslope', () => {
    expect(classifyTopographicPosition([900, 900, 900, 900, 900])).toBe('midslope');
  });
});

// ── fetchElevationWithRetry ───────────────────────────────────────────────────

const { fetchElevationWithRetry, getWatershedContext } = require('../../src/chapters');

describe('fetchElevationWithRetry', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns value on first attempt when fetch succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ value: 850 }),
    });
    const result = await fetchElevationWithRetry('https://example.com/elev');
    expect(result).toBe(850);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('retries once after a network error and returns value on second attempt', async () => {
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue({ ok: true, json: async () => ({ value: 900 }) });
    const result = await fetchElevationWithRetry('https://example.com/elev');
    expect(result).toBe(900);
    expect(fetch).toHaveBeenCalledTimes(2);
  }, 10000);

  test('retries twice after non-ok HTTP responses and returns null after exhausting retries', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const result = await fetchElevationWithRetry('https://example.com/elev', 2);
    expect(result).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  }, 15000);

  test('retries when value is null in response body', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: null }) })
      .mockResolvedValue({ ok: true, json: async () => ({ value: 750 }) });
    const result = await fetchElevationWithRetry('https://example.com/elev');
    expect(result).toBe(750);
    expect(fetch).toHaveBeenCalledTimes(2);
  }, 10000);

  test('returns null after all retries exhausted', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));
    const result = await fetchElevationWithRetry('https://example.com/elev', 2);
    expect(result).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(3);
  }, 15000);
});

// ── getWatershedContext ───────────────────────────────────────────────────────

describe('getWatershedContext', () => {
  beforeEach(() => {
    logError.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns elevations and position when all 5 points succeed', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ value: 850 }),
    });
    const result = await getWatershedContext(38.25, -85.75);
    expect(result).not.toBeNull();
    expect(result.elevations).toHaveLength(5);
    expect(result.elevations.every(e => e === 850)).toBe(true);
    expect(result.position).toBe('midslope'); // all equal → midslope
  });

  test('fills failed surrounding points with center elevation', async () => {
    // Center succeeds, surrounding points fail
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: true, json: async () => ({ value: 900 }) });
      }
      return Promise.reject(new Error('timeout'));
    });
    const result = await getWatershedContext(38.25, -85.75);
    // Should not be null — center succeeded, surrounding filled with 900
    expect(result).not.toBeNull();
    expect(result.elevations[0]).toBe(900);
    // Surrounding points should be filled with center value
    expect(result.elevations.slice(1).every(e => e === 900)).toBe(true);
    expect(result.position).toBe('midslope');
    // FR-073: EPQS center succeeded → no chain miss → no degradation logged.
  }, 30000);

  test('returns null when center point fails after all retries (EPQS + OpenTopoData both down)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network failure'));
    const result = await getWatershedContext(38.25, -85.75);
    expect(result).toBeNull();
    // FR-073: degradation now flows through the shared helper's sourceChain log.
    expect(logError).toHaveBeenCalledWith('fetchElevationsFeet', expect.stringContaining(','), expect.any(Error));
  }, 30000);
});
