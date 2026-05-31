'use strict';
// CONSTRAINT-005: Highway access must use geocoding strategy only.
// Text search for "highway on ramp" returns boat ramps and parking ramps. See PM-002.
const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { reverseGeocodeAddress } = require('../../shared/google/reverseGeocode');
const { getDriveTime } = require('../../shared/google/distanceMatrix');
const { placesCache } = require('../../cache');
const {
  INTERSTATE_LIST,
  HIGHWAY_MAX_DRIVE_MINUTES,
  HIGHWAY_INTERCHANGE_MAX_MINUTES,
} = require('../../utils/constants');
const { isValidHighwayName } = require('./logic');

// Finds nearby interstates by geocoding each highway name near the address city/state.
// Validates the returned result actually mentions the highway to filter out false matches.
// Shows the closest as primary, lists others within 20 minutes in the note.
async function findNearestHighwayOnRamp(originLatLng) {
  const cacheKey = `highway:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  const { city, state } = await reverseGeocodeAddress(originLatLng);
  const locationLabel = city && state ? `${city}, ${state}` : originLatLng;

  const geocodeResults = await Promise.all(
    INTERSTATE_LIST.map(async (highway) => {
      try {
        const response = await googleMapsClient.geocode({
          params: {
            key: googleMapsApiKey,
            address: `${highway} near ${locationLabel}`,
          },
        });
        const result = response.data.results?.[0];
        if (!result) return null;

        if (!isValidHighwayName(result.formatted_address, highway)) return null;

        return {
          highway,
          location: result.geometry.location,
          address: result.formatted_address,
        };
      } catch {
        return null;
      }
    }),
  );

  const validGeoResults = geocodeResults.filter(Boolean);
  if (!validGeoResults.length) {
    throw new Error('No interstate highways found near that address.');
  }

  const withDriveTimes = await Promise.all(
    validGeoResults.map(async (result) => {
      try {
        const driveTimeMinutes = await getDriveTime(originLatLng, result.location);
        return { ...result, driveTimeMinutes };
      } catch {
        return null;
      }
    }),
  );

  const allValid = withDriveTimes.filter(Boolean);

  // Google's geocoder returns a representative midpoint for a highway in the state,
  // not the nearest on-ramp. "I-64 near Georgetown, KY" gives a point 35 min away,
  // but the I-64/I-75 interchange in Lexington is only 14 min away. For interstates
  // whose geocoded point is >20 min but ≤50 min, try the junction with the nearest
  // already-validated within-20 interstate to find the real closest access.
  const primary20 = allValid
    .filter((r) => r.driveTimeMinutes <= HIGHWAY_MAX_DRIVE_MINUTES)
    .sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes);

  if (primary20.length && state) {
    const nearestHwy = primary20[0];
    const borderline = allValid.filter((r) => r.driveTimeMinutes > HIGHWAY_MAX_DRIVE_MINUTES && r.driveTimeMinutes <= HIGHWAY_INTERCHANGE_MAX_MINUTES);

    const interchangeResults = await Promise.all(
      borderline.map(async (farHwy) => {
        try {
          const response = await googleMapsClient.geocode({
            params: {
              key: googleMapsApiKey,
              address: `${farHwy.highway}/${nearestHwy.highway} ${state}`,
            },
          });
          const result = response.data.results?.[0];
          if (!result) return null;

          if (!isValidHighwayName(result.formatted_address, farHwy.highway)) return null;

          const driveTimeMinutes = await getDriveTime(originLatLng, result.geometry.location);
          if (driveTimeMinutes > HIGHWAY_MAX_DRIVE_MINUTES) return null;

          return {
            highway: farHwy.highway,
            location: result.geometry.location,
            address: result.formatted_address,
            driveTimeMinutes,
          };
        } catch {
          return null;
        }
      }),
    );

    for (const r of interchangeResults) {
      if (r && !allValid.some((v) => v.highway === r.highway && v.driveTimeMinutes <= HIGHWAY_MAX_DRIVE_MINUTES)) {
        allValid.push(r);
      }
    }
  }

  const nearby = allValid
    .filter((r) => r.driveTimeMinutes <= HIGHWAY_MAX_DRIVE_MINUTES)
    .sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes);

  const candidates = nearby.length
    ? nearby
    : allValid.sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes).slice(0, 1);

  if (!candidates.length) {
    throw new Error('Unable to calculate drive times to nearby interstate highways.');
  }

  const primary = candidates[0];
  const othersNote = candidates.length > 1
    ? `Also within 20 minutes: ${candidates.slice(1).map((c) => `${c.highway} (${c.driveTimeMinutes} min)`).join(', ')}`
    : null;

  const result = {
    name: primary.highway,
    address: primary.address,
    location: primary.location,
    driveTimeMinutes: primary.driveTimeMinutes,
    note: othersNote,
  };
  placesCache.set(cacheKey, result);
  return result;
}

module.exports = { findNearestHighwayOnRamp };
