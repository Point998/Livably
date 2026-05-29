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
