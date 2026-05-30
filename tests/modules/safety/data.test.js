'use strict';

jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: { placesNearby: jest.fn() },
  googleMapsApiKey: 'test-key',
}));
jest.mock('../../../src/shared/google/distanceMatrix', () => ({
  getDriveTime: jest.fn(),
}));

const { googleMapsClient } = require('../../../src/shared/google/client');
const { getDriveTime } = require('../../../src/shared/google/distanceMatrix');
const { getEmergencyServices, getSafetyLocationContext, estimateResponseTime } = require('../../../src/modules/safety/data');

describe('estimateResponseTime', () => {
  test('fire 0.5 miles is Excellent', () => {
    const r = estimateResponseTime(0.5, 'fire');
    expect(r.category.label).toBe('Excellent');
    expect(r.estimate).toBeGreaterThan(0);
  });
  test('police 5.0 miles is Fair', () => {
    // 5mi @ 30mph + 2min dispatch = 12min → within fair threshold of 15
    const r = estimateResponseTime(5.0, 'police');
    expect(r.category.label).toBe('Fair');
  });
  test('returns estimate in minutes', () => {
    const r = estimateResponseTime(1.0, 'fire');
    expect(typeof r.estimate).toBe('number');
  });
});

describe('getSafetyLocationContext', () => {
  test('returns state, city, county from locationInfo', async () => {
    const r = await getSafetyLocationContext({ state: 'KY', city: 'Georgetown', county: 'Scott County' });
    expect(r.state).toBe('KY');
    expect(r.city).toBe('Georgetown');
    expect(r.county).toBe('Scott County');
  });
  test('returns null when locationInfo is null', async () => {
    const r = await getSafetyLocationContext(null);
    expect(r).toBeNull();
  });
  test('returns null when state missing', async () => {
    const r = await getSafetyLocationContext({ city: 'Georgetown' });
    expect(r).toBeNull();
  });
});

describe('getEmergencyServices', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns null fire and police when no places found', async () => {
    googleMapsClient.placesNearby.mockResolvedValue({ data: { results: [] } });
    getDriveTime.mockResolvedValue(5);
    const result = await getEmergencyServices(38.2, -84.5, '38.2,-84.5');
    expect(result.fire).toBeNull();
    expect(result.police).toBeNull();
  });

  test('returns fire station with response estimate when place found', async () => {
    googleMapsClient.placesNearby
      .mockResolvedValueOnce({ data: { results: [] } }) // police = empty (first call)
      .mockResolvedValueOnce({
        data: {
          results: [{
            name: 'Georgetown Fire Station 1',
            vicinity: '100 Fire St',
            geometry: { location: { lat: 38.201, lng: -84.501 } },
          }],
        },
      }); // fire station (second call)
    getDriveTime.mockResolvedValue(4);
    const result = await getEmergencyServices(38.2, -84.5, '38.2,-84.5');
    expect(result.fire).not.toBeNull();
    expect(result.fire.name).toBe('Georgetown Fire Station 1');
    expect(result.fire.response.estimate).toBeGreaterThan(0);
    expect(result.fire.driveTimeMinutes).toBe(4);
  });
});
