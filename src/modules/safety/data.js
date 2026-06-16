'use strict';

const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { getDriveTime } = require('../../shared/google/distanceMatrix');
const { haversineDistance } = require('../../utils/geo');
const { normalizeStationName, estimateResponseTime, getSafetyLocationContext } = require('./logic');

async function getEmergencyServices(lat, lng, originLatLng) {
  const [policeResult, fireResult] = await Promise.allSettled([
    googleMapsClient.placesNearby({
      params: { key: googleMapsApiKey, location: `${lat},${lng}`, rankby: 'distance', type: 'police' },
    }),
    googleMapsClient.placesNearby({
      params: { key: googleMapsApiKey, location: `${lat},${lng}`, rankby: 'distance', type: 'fire_station' },
    }),
  ]);

  async function processStation(result, serviceType) {
    if (result.status !== 'fulfilled') return null;
    const place = (result.value.data.results || [])[0];
    if (!place) return null;
    const distanceMiles = haversineDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng);
    let driveTimeMinutes = null;
    try { driveTimeMinutes = await getDriveTime(originLatLng, place.geometry.location); } catch {}
    return {
      name: normalizeStationName(place.name),
      address: place.vicinity || place.formatted_address || place.name,
      distanceMiles: distanceMiles.toFixed(1),
      driveTimeMinutes,
      response: estimateResponseTime(distanceMiles, serviceType),
    };
  }

  const [police, fire] = await Promise.all([
    processStation(policeResult, 'police'),
    processStation(fireResult, 'fire'),
  ]);

  return { police, fire };
}

const SOURCES = [
  { id: 'google-places-safety', label: 'Google Places (police + fire stations)', provider: 'google', coverage: 'all',
    run: (ctx) => getEmergencyServices(ctx.lat, ctx.lng, `${ctx.lat},${ctx.lng}`),
    isValid: (r) => r !== null && (r?.police !== null || r?.fire !== null) },
];

module.exports = {
  getEmergencyServices,
  getSafetyLocationContext,
  estimateResponseTime,
  SOURCES,
};
