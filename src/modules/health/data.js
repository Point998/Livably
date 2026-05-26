'use strict';
// CONSTRAINT-003: Hospital must be selected by shortest drive time across top 5 candidates,
// NOT by Google search rank. Never trust Google's relevance ranking for safety-critical destinations.
const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { getDriveTime } = require('../../shared/google/distanceMatrix');
const { checkCrossState } = require('../../shared/validate');
const { placesCache } = require('../../cache');
const { logError } = require('../../logger');
const {
  HOSPITAL_SEARCH_RADIUS_M, HOSPITAL_CANDIDATE_COUNT,
} = require('../../utils/constants');

// Returns true for places that are primarily a pharmacy, drug store, or retail store —
// indicating an in-store health clinic rather than a standalone urgent care facility.
function isRetailEmbeddedHealth(place) {
  const types = place.types || [];
  return types.includes('pharmacy') ||
         types.includes('drug_store') ||
         types.includes('store') ||
         types.includes('supermarket') ||
         types.includes('grocery_or_supermarket');
}

// Gets top 5 hospital results, calculates actual drive time to each,
// and returns the one with the shortest drive time — not just Google's first result.
// originState: 2-letter abbreviation. Cross-state hospital is warned, not rejected —
// for safety-critical results, a cross-state hospital is better than no result.
async function findNearestHospital(originLatLng, originState = '') {
  const cacheKey = `hospital:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  let placesResponse = await googleMapsClient.textSearch({
    params: {
      key: googleMapsApiKey,
      query: 'hospital emergency department',
      location: originLatLng,
      radius: HOSPITAL_SEARCH_RADIUS_M,
    },
  });

  let placeResults = placesResponse.data.results || [];

  if (!placeResults.length) {
    placesResponse = await googleMapsClient.placesNearby({
      params: {
        key: googleMapsApiKey,
        location: originLatLng,
        rankby: 'distance',
        type: 'hospital',
      },
    });
    placeResults = placesResponse.data.results || [];
  }

  if (!placeResults.length) {
    throw new Error('No hospital found near that address.');
  }

  const candidates = placeResults.slice(0, HOSPITAL_CANDIDATE_COUNT);
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
        logError('findNearestHospital', originLatLng, e);
        return null;
      }
    }),
  );

  const valid = withDriveTimes.filter(Boolean);
  if (!valid.length) {
    throw new Error('Unable to calculate drive times to nearby hospitals.');
  }

  valid.sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes);
  const result = valid[0];

  const { valid: sameState, resultState } = await checkCrossState(result.location, originState);
  if (!sameState) {
    result.crossStateWarning = true;
    result.crossStateNote = `This hospital is in ${resultState}. No in-state hospital was found within the search radius.`;
  }

  placesCache.set(cacheKey, result);
  return result;
}

async function findNearestUrgentCare(originLatLng, originState = '') {
  const cacheKey = `urgentcare:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  let placesResponse = await googleMapsClient.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: originLatLng,
      rankby: 'distance',
      keyword: 'urgent care',
    },
  });

  let placeResults = (placesResponse.data.results || []).filter(
    (place) => !isRetailEmbeddedHealth(place),
  );

  if (!placeResults.length) {
    placesResponse = await googleMapsClient.textSearch({
      params: {
        key: googleMapsApiKey,
        query: 'urgent care clinic',
        location: originLatLng,
        radius: HOSPITAL_SEARCH_RADIUS_M,
      },
    });
    placeResults = (placesResponse.data.results || []).filter(
      (place) => !isRetailEmbeddedHealth(place),
    );
  }

  const place = placeResults[0];
  if (!place) {
    throw new Error('No urgent care clinic found near that address.');
  }

  const result = {
    name: place.name,
    address: place.formatted_address || place.vicinity || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };

  const { valid: sameState, resultState } = await checkCrossState(result.location, originState);
  if (!sameState) {
    result.crossStateWarning = true;
    result.crossStateNote = `This urgent care is in ${resultState}. No in-state facility was found within the search radius.`;
  }

  placesCache.set(cacheKey, result);
  return result;
}

module.exports = { findNearestHospital, findNearestUrgentCare };
