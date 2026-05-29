'use strict';
const {
  NOAA_CDO_BASE_URL, FEMA_DECLARATIONS_URL, USGS_ELEVATION_URL,
  CLIMATE_STORM_LOOKBACK_YEARS, CLIMATE_FEMA_LOOKBACK_YEARS,
  CLIMATE_SIGNIFICANT_DAMAGE_USD, STATE_ALERT_SYSTEMS,
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
