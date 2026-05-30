'use strict';

const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { getDriveTime } = require('../../shared/google/distanceMatrix');
const { haversineDistance } = require('../../utils/geo');
const {
  RESPONSE_SPEED_MPH,
  RESPONSE_DISPATCH_MINUTES,
  RESPONSE_TIME_THRESHOLDS,
} = require('../../utils/constants');

function normalizeStationName(name) {
  if (!name) return name;
  return name.replace(/Fire\s+Protction\s+Services/gi, 'Fire Protection Services');
}

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

function estimateResponseTime(distanceMiles, type) {
  const minutes = Math.round((distanceMiles / (RESPONSE_SPEED_MPH[type] || 30)) * 60 + (RESPONSE_DISPATCH_MINUTES[type] || 2));
  const t = RESPONSE_TIME_THRESHOLDS[type] || { excellent: 5, good: 10, fair: 15 };
  let category;
  if (minutes <= t.excellent) category = { label: 'Excellent', color: 'green' };
  else if (minutes <= t.good) category = { label: 'Good', color: 'gold' };
  else if (minutes <= t.fair) category = { label: 'Fair', color: 'orange' };
  else category = { label: 'Delayed', color: 'red' };
  return { estimate: minutes, category };
}

async function getSafetyLocationContext(locationInfo) {
  const { state, city, county } = locationInfo || {};
  if (!state) return null;
  return { state, city, county };
}

module.exports = {
  getEmergencyServices,
  getSafetyLocationContext,
  estimateResponseTime,
};
