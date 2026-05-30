'use strict';

jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: { placesNearby: jest.fn() },
  googleMapsApiKey: 'test-key',
}));
jest.mock('../../../src/shared/census', () => ({
  fetchCensusACS: jest.fn(),
}));

const { googleMapsClient } = require('../../../src/shared/google/client');
const { fetchCensusACS } = require('../../../src/shared/census');

const {
  getAQICategory,
  getDNLCategory,
  getBortleDescription,
  getEnvironmentalData,
} = require('../../../src/modules/sensory/data');

describe('getAQICategory', () => {
  test('AQI 0-50 is Good green', () => {
    const r = getAQICategory(25);
    expect(r.label).toBe('Good');
    expect(r.color).toBe('green');
  });
  test('AQI 51-100 is Moderate gold', () => {
    const r = getAQICategory(75);
    expect(r.label).toBe('Moderate');
    expect(r.color).toBe('gold');
  });
  test('AQI 101-150 is Unhealthy for Sensitive Groups orange', () => {
    const r = getAQICategory(120);
    expect(r.color).toBe('orange');
  });
  test('AQI 151-200 is Unhealthy red', () => {
    const r = getAQICategory(170);
    expect(r.label).toBe('Unhealthy');
    expect(r.color).toBe('red');
  });
  test('AQI 200+ is Very Unhealthy red', () => {
    const r = getAQICategory(250);
    expect(r.color).toBe('red');
  });
});

describe('getDNLCategory', () => {
  test('DNL < 45 is Very Quiet green', () => {
    const r = getDNLCategory(40);
    expect(r.label).toMatch(/very quiet/i);
    expect(r.color).toBe('green');
  });
  test('DNL 45-54 is Quiet lightgreen', () => {
    const r = getDNLCategory(50);
    expect(r.color).toBe('lightgreen');
  });
  test('DNL 55-64 is Moderate gold', () => {
    const r = getDNLCategory(60);
    expect(r.label).toBe('Moderate');
  });
  test('DNL 65-69 is Elevated orange', () => {
    const r = getDNLCategory(67);
    expect(r.label).toBe('Elevated');
    expect(r.color).toBe('orange');
  });
  test('DNL 70+ is Significant red', () => {
    const r = getDNLCategory(75);
    expect(r.label).toBe('Significant');
    expect(r.color).toBe('red');
  });
});

describe('getBortleDescription', () => {
  test('Bortle 1-2 is exceptional dark sky', () => expect(getBortleDescription(2).label).toMatch(/exceptional/i));
  test('Bortle 3 is rural dark sky', () => expect(getBortleDescription(3).label).toMatch(/rural/i));
  test('Bortle 5 is suburban sky', () => expect(getBortleDescription(5).label).toMatch(/suburban/i));
  test('Bortle 7 is suburban/urban transition', () => expect(getBortleDescription(7).label).toMatch(/suburban|urban/i));
  test('Bortle 8 is urban sky', () => expect(getBortleDescription(8).label).toMatch(/urban/i));
});

describe('getEnvironmentalData', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns object with all expected keys', async () => {
    googleMapsClient.placesNearby.mockResolvedValue({ data: { results: [] } });
    fetchCensusACS.mockResolvedValue(null);
    const result = await getEnvironmentalData(38.2, -84.5, null, null);
    expect(result).toHaveProperty('airQuality');
    expect(result).toHaveProperty('floodRisk');
    expect(result).toHaveProperty('airports');
    expect(result).toHaveProperty('roadNoise');
    expect(result).toHaveProperty('rail');
    expect(result).toHaveProperty('lightPollution');
    expect(result).toHaveProperty('waterQuality');
    expect(result).toHaveProperty('radon');
    expect(result).toHaveProperty('ejscreen');
  });

  test('returns null for airQuality when no API key', async () => {
    googleMapsClient.placesNearby.mockResolvedValue({ data: { results: [] } });
    fetchCensusACS.mockResolvedValue(null);
    // AIRNOW_API_KEY is not set in test env
    const result = await getEnvironmentalData(38.2, -84.5, null, null);
    expect(result.airQuality).toBeNull();
  });
});
