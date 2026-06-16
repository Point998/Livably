'use strict';
const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { getDriveTime } = require('../../shared/google/distanceMatrix');
const { checkDriveTimeCoherence, classifyBand } = require('../../shared/validate');
const { cellSearchOrigin, cellDriveOpts } = require('../../shared/spatial');
const { placesCache } = require('../../cache');
const { getMitigation } = require('../../errorMemory');
const { logError } = require('../../logger');
const {
  GROCERY_SEARCH_RADIUS_M, GROCERY_CANDIDATE_COUNT,
} = require('../../utils/constants');
const { isExcludedGroceryType } = require('./logic');

// FR-058 cell helpers (cellSearchOrigin / cellDriveOpts) live in shared/spatial.js.
// Attach the cell data-contract fields (R4) onto a finished record. The drive
// is banded from the centroid minutes + mode (R7: classification is a data fact,
// an integer rung — no words; CONSTRAINT-009). cell.mode is the rural-mode string
// the orchestrator augments onto the cell (single source with cell resolution).
function withCellFields(record, driveTimeMinutes, cell) {
  if (!cell) return record;
  return {
    ...record,
    cellId: cell.cellId,
    resolution: cell.resolution,
    centroidDriveMinutes: driveTimeMinutes,
    bandRung: classifyBand(driveTimeMinutes, cell.mode),
    mode: cell.mode,
  };
}

// Returns top 3 nearest grocery stores by drive time.
// Uses textSearch with tight radius so Google relevance is overridden by actual drive time.
// Excludes gas stations, convenience stores, and dollar stores by place type.
// ruralMode: 'urban'|'suburban'|'rural'|'remote' from detectRuralMode().
// cell: FR-058 spatial cell (optional). CONSTRAINT-010: Results >45 min are
// flagged with coherenceWarning for non-rural addresses.
async function findNearestGrocery(originLatLng, ruralMode = 'suburban', cell = null) {
  const cacheKey = cell ? `grocery:${cell.cellId}` : `grocery:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  const searchOrigin = cellSearchOrigin(originLatLng, cell);
  const placesResponse = await googleMapsClient.textSearch({
    params: {
      key: googleMapsApiKey,
      query: 'grocery store',
      location: searchOrigin,
      radius: getMitigation('findNearestGrocery', 'searchRadiusM', GROCERY_SEARCH_RADIUS_M),
    },
  });

  const placeResults = (placesResponse.data.results || []).filter((place) => !isExcludedGroceryType(place));

  if (!placeResults.length) {
    throw new Error('No grocery stores found near that address.');
  }

  // Calculate drive times for top candidates, return 3 fastest
  const candidates = placeResults.slice(0, GROCERY_CANDIDATE_COUNT);
  const withDriveTimes = await Promise.all(
    candidates.map(async (place) => {
      try {
        const driveTimeMinutes = await getDriveTime(searchOrigin, place.geometry.location, cellDriveOpts(cell));
        return withCellFields({
          name: place.name,
          address: place.formatted_address || place.vicinity || place.name,
          location: place.geometry.location,
          driveTimeMinutes,
        }, driveTimeMinutes, cell);
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

async function findNearestPharmacy(originLatLng, cell = null) {
  const cacheKey = cell ? `pharmacy:${cell.cellId}` : `pharmacy:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  const searchOrigin = cellSearchOrigin(originLatLng, cell);
  const placesResponse = await googleMapsClient.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: searchOrigin,
      rankby: 'distance',
      type: 'pharmacy',
    },
  });

  const place = (placesResponse.data.results || [])[0];
  if (!place) {
    throw new Error('No pharmacy found near that address.');
  }

  const driveTimeMinutes = await getDriveTime(searchOrigin, place.geometry.location, cellDriveOpts(cell));
  const result = withCellFields({
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes,
  }, driveTimeMinutes, cell);
  placesCache.set(cacheKey, result);
  return result;
}

async function findNearestGasStation(originLatLng, cell = null) {
  const cacheKey = cell ? `gasstation:${cell.cellId}` : `gasstation:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  const searchOrigin = cellSearchOrigin(originLatLng, cell);
  const placesResponse = await googleMapsClient.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: searchOrigin,
      rankby: 'distance',
      type: 'gas_station',
    },
  });
  const place = (placesResponse.data.results || [])[0];
  if (!place) throw new Error('No gas station found near that address.');
  const driveTimeMinutes = await getDriveTime(searchOrigin, place.geometry.location, cellDriveOpts(cell));
  const result = withCellFields({
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes,
  }, driveTimeMinutes, cell);
  placesCache.set(cacheKey, result);
  return result;
}

const SOURCES = [
  { id: 'google-places-grocery', label: 'Google Places (nearest grocery stores)', provider: 'google', coverage: 'all',
    run: (ctx) => findNearestGrocery(`${ctx.lat},${ctx.lng}`, 'suburban', null),
    isValid: (r) => Array.isArray(r) && r.length > 0 && typeof r[0]?.driveTimeMinutes === 'number' },
  { id: 'google-places-pharmacy', label: 'Google Places (nearest pharmacy)', provider: 'google', coverage: 'all',
    run: (ctx) => findNearestPharmacy(`${ctx.lat},${ctx.lng}`, null),
    isValid: (r) => r !== null && typeof r?.driveTimeMinutes === 'number' },
  { id: 'google-places-gas', label: 'Google Places (nearest gas station)', provider: 'google', coverage: 'all',
    run: (ctx) => findNearestGasStation(`${ctx.lat},${ctx.lng}`, null),
    isValid: (r) => r !== null && typeof r?.driveTimeMinutes === 'number' },
];

module.exports = { findNearestGrocery, findNearestPharmacy, findNearestGasStation, SOURCES };
