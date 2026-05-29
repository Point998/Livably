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
