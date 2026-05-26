'use strict';
const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { getDriveTime } = require('../../shared/google/distanceMatrix');
const { checkDriveTimeCoherence } = require('../../shared/validate');
const { placesCache } = require('../../cache');
const { getMitigation } = require('../../errorMemory');
const { logError } = require('../../logger');
const {
  GROCERY_SEARCH_RADIUS_M, GROCERY_CANDIDATE_COUNT, GROCERY_EXCLUDED_TYPES,
} = require('../../utils/constants');

// Returns top 3 nearest grocery stores by drive time.
// Uses textSearch with tight radius so Google relevance is overridden by actual drive time.
// Excludes gas stations, convenience stores, and dollar stores by place type.
// ruralMode: 'urban'|'suburban'|'rural'|'remote' from detectRuralMode().
// CONSTRAINT-010: Results >45 min are flagged with coherenceWarning for non-rural addresses.
async function findNearestGrocery(originLatLng, ruralMode = 'suburban') {
  const cacheKey = `grocery:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  const placesResponse = await googleMapsClient.textSearch({
    params: {
      key: googleMapsApiKey,
      query: 'grocery store',
      location: originLatLng,
      radius: getMitigation('findNearestGrocery', 'searchRadiusM', GROCERY_SEARCH_RADIUS_M),
    },
  });

  const placeResults = (placesResponse.data.results || []).filter((place) => {
    const types = place.types || [];
    return !GROCERY_EXCLUDED_TYPES.some((t) => types.includes(t));
  });

  if (!placeResults.length) {
    throw new Error('No grocery stores found near that address.');
  }

  // Calculate drive times for top candidates, return 3 fastest
  const candidates = placeResults.slice(0, GROCERY_CANDIDATE_COUNT);
  const withDriveTimes = await Promise.all(
    candidates.map(async (place) => {
      try {
        const driveTimeMinutes = await getDriveTime(originLatLng, place.geometry.location);
        return {
          name: place.name,
          address: place.formatted_address || place.vicinity || place.name,
          location: place.geometry.location,
          driveTimeMinutes,
        };
      } catch (e) {
        logError('findNearestGrocery', originLatLng, e);
        return null;
      }
    }),
  );

  const valid = withDriveTimes.filter(Boolean);
  valid.sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes);
  const top3 = valid.slice(0, 3).map((store) => {
    const coherence = checkDriveTimeCoherence(store.driveTimeMinutes, 'grocery store', ruralMode);
    return coherence.ok ? store : { ...store, coherenceWarning: true, coherenceReason: coherence.reason };
  });
  placesCache.set(cacheKey, top3);
  return top3;
}

async function findNearestPharmacy(originLatLng) {
  const cacheKey = `pharmacy:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  const placesResponse = await googleMapsClient.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: originLatLng,
      rankby: 'distance',
      type: 'pharmacy',
    },
  });

  const place = (placesResponse.data.results || [])[0];
  if (!place) {
    throw new Error('No pharmacy found near that address.');
  }

  const result = {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
  placesCache.set(cacheKey, result);
  return result;
}

async function findNearestGasStation(originLatLng) {
  const cacheKey = `gasstation:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  const placesResponse = await googleMapsClient.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: originLatLng,
      rankby: 'distance',
      type: 'gas_station',
    },
  });
  const place = (placesResponse.data.results || [])[0];
  if (!place) throw new Error('No gas station found near that address.');
  const result = {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
  placesCache.set(cacheKey, result);
  return result;
}

module.exports = { findNearestGrocery, findNearestPharmacy, findNearestGasStation };
