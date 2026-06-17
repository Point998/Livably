'use strict';

jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: { placesNearby: jest.fn() },
  googleMapsApiKey: 'test-key',
}));
jest.mock('../../../src/shared/census', () => ({
  fetchCensusACS: jest.fn(),
}));
const mockSearchOSMPOIs = jest.fn();
jest.mock('../../../src/shared/osmPlaces', () => ({ searchOSMPOIs: (...a) => mockSearchOSMPOIs(...a) }));
jest.mock('../../../src/logger', () => ({ logError: jest.fn() }));

const { googleMapsClient } = require('../../../src/shared/google/client');
const { fetchCensusACS } = require('../../../src/shared/census');

const {
  getAQICategory,
  getDNLCategory,
  getBortleDescription,
  getEnvironmentalData,
  getAirportData,
  getAirportDataGoogle,
  getAirportDataOSM,
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
  let fetchSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    googleMapsClient.placesNearby.mockResolvedValue({ data: { results: [] } });
    fetchCensusACS.mockResolvedValue(null);
    // Mock global fetch so no real network calls are made
    fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network unavailable'));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test('returns object with all expected keys', async () => {
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

  test('returns null for airQuality when no API key or network', async () => {
    const result = await getEnvironmentalData(38.2, -84.5, null, null);
    expect(result.airQuality).toBeNull();
  });
}, 10000);

describe('getAirportData (Google→OSM cost-resilience chain, FR-070)', () => {
  const makeGooglePlace = (name, lat, lng) => ({ name, geometry: { location: { lat, lng } } });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: OSM finds nothing, so a Google success is never overridden and a
    // Google throw falls through to a clean null.
    mockSearchOSMPOIs.mockResolvedValue([]);
  });

  test('Google returns airports → uses them, never calls OSM, no source marker', async () => {
    googleMapsClient.placesNearby.mockResolvedValue({
      data: { results: [makeGooglePlace('Blue Grass Airport', 38.04, -84.61)] },
    });
    const result = await getAirportData(38.2, -84.5);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].name).toBe('Blue Grass Airport');
    expect(result[0].source).toBeUndefined();
    expect(mockSearchOSMPOIs).not.toHaveBeenCalled();
  });

  test('Google returns no airports (null) → short-circuits, OSM not called', async () => {
    googleMapsClient.placesNearby.mockResolvedValue({ data: { results: [] } });
    const result = await getAirportData(38.2, -84.5);
    expect(result).toBeNull();
    expect(mockSearchOSMPOIs).not.toHaveBeenCalled();
  });

  test('Google throws (quota) → falls back to OSM, tags source:osm, sorted & capped', async () => {
    googleMapsClient.placesNearby.mockRejectedValue(new Error('OVER_QUERY_LIMIT'));
    mockSearchOSMPOIs.mockResolvedValue([
      { name: 'Regional Field', lat: 38.1, lng: -84.55, distanceMiles: 8.2 },
      { name: 'County Strip',   lat: 38.0, lng: -84.6,  distanceMiles: 3.1 },
    ]);
    const result = await getAirportData(38.2, -84.5);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('County Strip'); // sorted ascending
    expect(result.every((a) => a.source === 'osm')).toBe(true);
    expect(result[0]).toMatchObject({ name: 'County Strip', distanceMiles: 3.1, lat: 38.0, lng: -84.6 });
  });

  test('Google throws + OSM empty → null', async () => {
    googleMapsClient.placesNearby.mockRejectedValue(new Error('network'));
    mockSearchOSMPOIs.mockResolvedValue([]);
    const result = await getAirportData(38.2, -84.5);
    expect(result).toBeNull();
  });

  test('OSM query is tag-only and excludes private aerodromes (CONSTRAINT-004)', async () => {
    googleMapsClient.placesNearby.mockRejectedValue(new Error('quota'));
    await getAirportData(38.2, -84.5);
    expect(mockSearchOSMPOIs).toHaveBeenCalledWith(38.2, -84.5, expect.objectContaining({
      filters: expect.arrayContaining([expect.stringContaining('aeroway')]),
    }));
    const filterStr = mockSearchOSMPOIs.mock.calls[0][2].filters.join(' ');
    expect(filterStr).toContain('aerodrome');
    expect(filterStr).toMatch(/!~"private"|!~"private\|no"/); // private exclusion present
  });

  test('getAirportDataOSM: drops results beyond the distance cap, returns null when none remain', async () => {
    mockSearchOSMPOIs.mockResolvedValue([{ name: 'Faraway Intl', lat: 39, lng: -85, distanceMiles: 99 }]);
    const result = await getAirportDataOSM(38.2, -84.5);
    expect(result).toBeNull();
  });

  test('getAirportDataGoogle passthrough: returns null on empty (legit no-result, no throw)', async () => {
    googleMapsClient.placesNearby.mockResolvedValue({ data: { results: [] } });
    await expect(getAirportDataGoogle(38.2, -84.5)).resolves.toBeNull();
  });
});
