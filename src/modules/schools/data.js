'use strict';
// NOTE: Cross-state school filtering (CONSTRAINT-006) is NOT implemented at this layer.
// These functions return raw API results. Cross-state rejection happens in validate.js.
const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { getDriveTime } = require('../../shared/google/distanceMatrix');
const { placesCache } = require('../../cache');
const {
  SCHOOL_PLACE_TYPES, SCHOOL_NAME_TERMS,
  ELEMENTARY_SCHOOL_SEARCH_RADIUS_M, ELEMENTARY_SCHOOL_EXCLUSIONS,
} = require('../../utils/constants');

function isExcludedPlaceName(name, excludeTerms) {
  const normalized = (name || '').toLowerCase();
  return excludeTerms.some((term) => normalized.includes(term));
}

function isValidSchoolPlace(p) {
  const hasSchoolType = (p.types || []).some((t) => SCHOOL_PLACE_TYPES.has(t));
  const hasSchoolName = SCHOOL_NAME_TERMS.test(p.name || '');
  return hasSchoolType && hasSchoolName;
}

// Returns nearest school by distance.
// Note: nearest by distance is not the assigned school for the parcel.
// Assigned school requires verification with the school district.
async function findNearestSchool(originLatLng) {
  const cacheKey = `school:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  let placesResponse = await googleMapsClient.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: originLatLng,
      rankby: 'distance',
      type: 'school',
    },
  });

  let placeResults = placesResponse.data.results || [];

  // Fallback to text search if placesNearby returned nothing or no valid school
  if (!placeResults.some(isValidSchoolPlace)) {
    placesResponse = await googleMapsClient.textSearch({
      params: {
        key: googleMapsApiKey,
        query: 'school',
        location: originLatLng,
        radius: 25000,
      },
    });
    placeResults = placesResponse.data.results || [];
  }

  // Require both a school place type AND a school-related name
  const place = placeResults.find(isValidSchoolPlace);
  if (!place) {
    throw new Error('No school found near that address.');
  }

  const result = {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
    note: 'This is the nearest school by distance. Assigned school for this address requires verification directly with the school district.',
  };
  placesCache.set(cacheKey, result);
  return result;
}

async function findNearestElementarySchool(originLatLng) {
  const cacheKey = `elementary:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  const placesResponse = await googleMapsClient.textSearch({
    params: {
      key: googleMapsApiKey,
      query: 'public elementary school',
      location: originLatLng,
      radius: ELEMENTARY_SCHOOL_SEARCH_RADIUS_M,
    },
  });
  const place = (placesResponse.data.results || []).filter(
    (p) => !isExcludedPlaceName(p.name, ELEMENTARY_SCHOOL_EXCLUSIONS),
  )[0];
  if (!place) throw new Error('No elementary school found near that address.');
  const result = {
    name: place.name,
    address: place.formatted_address || place.vicinity || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
  placesCache.set(cacheKey, result);
  return result;
}

module.exports = { findNearestSchool, findNearestElementarySchool };
