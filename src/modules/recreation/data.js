'use strict';
const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { getDriveTime } = require('../../shared/google/distanceMatrix');
const { placesCache } = require('../../cache');
const {
  COFFEE_SHOP_CANDIDATE_COUNT,
  PARK_EXCLUDED_TYPES, PARK_LEISURE_TYPES,
} = require('../../utils/constants');

function isValidPark(p) {
  const types = p.types || [];
  if (PARK_EXCLUDED_TYPES.some((t) => types.includes(t))) return false;
  if (types.includes('establishment') && !PARK_LEISURE_TYPES.some((t) => types.includes(t))) return false;
  return true;
}

async function findNearestPark(originLatLng) {
  const cacheKey = `park:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  const placesResponse = await googleMapsClient.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: originLatLng,
      rankby: 'distance',
      type: 'park',
    },
  });
  const place = (placesResponse.data.results || []).find(isValidPark);
  if (!place) throw new Error('No park found near that address.');
  const result = {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
  placesCache.set(cacheKey, result);
  return result;
}

async function findNearestCoffeeShop(originLatLng) {
  const cacheKey = `coffeeshop:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  const placesResponse = await googleMapsClient.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: originLatLng,
      rankby: 'distance',
      type: 'cafe',
    },
  });

  const candidates = (placesResponse.data.results || []).slice(0, COFFEE_SHOP_CANDIDATE_COUNT);
  if (!candidates.length) throw new Error('No coffee shop found near that address.');

  const withDriveTimes = await Promise.all(
    candidates.map(async (place) => {
      try {
        const driveTimeMinutes = await getDriveTime(originLatLng, place.geometry.location);
        return {
          name: place.name,
          address: place.vicinity || place.formatted_address || place.name,
          location: place.geometry.location,
          driveTimeMinutes,
        };
      } catch {
        return null;
      }
    }),
  );

  const valid = withDriveTimes.filter(Boolean);
  valid.sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes);
  const result = valid[0];
  if (!result) throw new Error('No coffee shop found near that address.');
  placesCache.set(cacheKey, result);
  return result;
}

module.exports = { findNearestPark, findNearestCoffeeShop };
