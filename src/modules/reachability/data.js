'use strict';
const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { getDriveTime } = require('../../shared/google/distanceMatrix');
const { checkDriveTimeCoherence, classifyBand } = require('../../shared/validate');
const { cellSearchOrigin, cellDriveOpts } = require('../../shared/spatial');
const { sourceChain } = require('../../shared/sourceChain');
const { searchOSMPOIs } = require('../../shared/osmPlaces');
const { placesCache, placesOsmCache } = require('../../cache');
const { getMitigation } = require('../../errorMemory');
const { logError } = require('../../logger');
const {
  GROCERY_SEARCH_RADIUS_M, GROCERY_CANDIDATE_COUNT,
  OSM_POI_FILTERS, OSM_POI_RADIUS_M,
} = require('../../utils/constants');
const { isExcludedGroceryType } = require('./logic');

// FR-066 — shape an OSM POI into the reachability record contract. No routing
// (Google Distance Matrix is down in a quota outage), so proximity is the
// straight-line distance, flagged for honest rendering. No cell band fields:
// bandRung is drive-time-based, and there are no minutes here.
function osmRecord(p) {
  return {
    name: p.name,
    address: null,
    location: { lat: p.lat, lng: p.lng },
    driveTimeMinutes: null,
    distanceMiles: Math.round(p.distanceMiles * 10) / 10,
    proximitySource: 'osm-straightline',
  };
}

// Adapter so sourceChain miss/error visibility flows through the structured
// logger (NR-004 observability) rather than console — and stays quiet in tests.
const chainLog = (fn, origin) => (msg) => logError(fn, origin, new Error(msg));

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
// Public entry: Google primary → OSM straight-line fallback → throw (link floor).
// Google short-circuits the chain (no Overpass call) whenever it succeeds.
async function findNearestGrocery(originLatLng, ruralMode = 'suburban', cell = null) {
  const picked = await sourceChain([
    { name: 'google', run: () => findNearestGroceryGoogle(originLatLng, ruralMode, cell), isValid: (r) => Array.isArray(r) && r.length > 0 },
    { name: 'osm',    run: () => findNearestGroceryOSM(originLatLng, cell),                isValid: (r) => Array.isArray(r) && r.length > 0 },
  ], null, { label: 'reachability-grocery', log: chainLog('findNearestGrocery', originLatLng) });
  if (!picked) throw new Error('No grocery stores found near that address.');
  return picked.value;
}

async function findNearestGroceryOSM(originLatLng, cell = null) {
  const cacheKey = cell ? `grocery:osm:${cell.cellId}` : `grocery:osm:${originLatLng}`;
  const cached = placesOsmCache.get(cacheKey);
  if (cached) return cached;
  const searchOrigin = cellSearchOrigin(originLatLng, cell);
  const [sLat, sLng] = searchOrigin.split(',').map(Number);
  const pois = await searchOSMPOIs(sLat, sLng, { filters: OSM_POI_FILTERS.grocery, radiusM: OSM_POI_RADIUS_M, limit: 3 });
  if (!pois.length) return null;
  const records = pois.map(osmRecord);
  placesOsmCache.set(cacheKey, records);
  return records;
}

async function findNearestGroceryGoogle(originLatLng, ruralMode = 'suburban', cell = null) {
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
  const picked = await sourceChain([
    { name: 'google', run: () => findNearestPharmacyGoogle(originLatLng, cell), isValid: (r) => r != null },
    { name: 'osm',    run: () => findNearestPharmacyOSM(originLatLng, cell),    isValid: (r) => r != null },
  ], null, { label: 'reachability-pharmacy', log: chainLog('findNearestPharmacy', originLatLng) });
  if (!picked) throw new Error('No pharmacy found near that address.');
  return picked.value;
}

async function findNearestPharmacyOSM(originLatLng, cell = null) {
  const cacheKey = cell ? `pharmacy:osm:${cell.cellId}` : `pharmacy:osm:${originLatLng}`;
  const cached = placesOsmCache.get(cacheKey);
  if (cached) return cached;
  const searchOrigin = cellSearchOrigin(originLatLng, cell);
  const [sLat, sLng] = searchOrigin.split(',').map(Number);
  const pois = await searchOSMPOIs(sLat, sLng, { filters: OSM_POI_FILTERS.pharmacy, radiusM: OSM_POI_RADIUS_M, limit: 1 });
  if (!pois.length) return null;
  const record = osmRecord(pois[0]);
  placesOsmCache.set(cacheKey, record);
  return record;
}

async function findNearestPharmacyGoogle(originLatLng, cell = null) {
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
  const picked = await sourceChain([
    { name: 'google', run: () => findNearestGasStationGoogle(originLatLng, cell), isValid: (r) => r != null },
    { name: 'osm',    run: () => findNearestGasStationOSM(originLatLng, cell),    isValid: (r) => r != null },
  ], null, { label: 'reachability-gas', log: chainLog('findNearestGasStation', originLatLng) });
  if (!picked) throw new Error('No gas station found near that address.');
  return picked.value;
}

async function findNearestGasStationOSM(originLatLng, cell = null) {
  const cacheKey = cell ? `gasstation:osm:${cell.cellId}` : `gasstation:osm:${originLatLng}`;
  const cached = placesOsmCache.get(cacheKey);
  if (cached) return cached;
  const searchOrigin = cellSearchOrigin(originLatLng, cell);
  const [sLat, sLng] = searchOrigin.split(',').map(Number);
  const pois = await searchOSMPOIs(sLat, sLng, { filters: OSM_POI_FILTERS.gas, radiusM: OSM_POI_RADIUS_M, limit: 1 });
  if (!pois.length) return null;
  const record = osmRecord(pois[0]);
  placesOsmCache.set(cacheKey, record);
  return record;
}

async function findNearestGasStationGoogle(originLatLng, cell = null) {
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
  // Google descriptors target the Google impl directly so the monitor reports on
  // Google specifically (not masked green by the OSM fallback).
  { id: 'google-places-grocery', label: 'Google Places (nearest grocery stores)', provider: 'google', coverage: 'all',
    run: (ctx) => findNearestGroceryGoogle(`${ctx.lat},${ctx.lng}`, 'suburban', null),
    isValid: (r) => Array.isArray(r) && r.length > 0 && typeof r[0]?.driveTimeMinutes === 'number' },
  { id: 'google-places-pharmacy', label: 'Google Places (nearest pharmacy)', provider: 'google', coverage: 'all',
    run: (ctx) => findNearestPharmacyGoogle(`${ctx.lat},${ctx.lng}`, null),
    isValid: (r) => r !== null && typeof r?.driveTimeMinutes === 'number' },
  { id: 'google-places-gas', label: 'Google Places (nearest gas station)', provider: 'google', coverage: 'all',
    run: (ctx) => findNearestGasStationGoogle(`${ctx.lat},${ctx.lng}`, null),
    isValid: (r) => r !== null && typeof r?.driveTimeMinutes === 'number' },
  // FR-066 OSM fallbacks (non-safety POIs). coverage 'some' — Overpass data is
  // sparser than Google in places; a miss is informational, not a failure.
  { id: 'osm-grocery-fallback', label: 'OSM Overpass grocery (Google fallback, straight-line)', provider: 'osm', coverage: 'some',
    run: (ctx) => findNearestGroceryOSM(`${ctx.lat},${ctx.lng}`, null),
    isValid: (r) => Array.isArray(r) && r.length > 0 && typeof r[0]?.distanceMiles === 'number' },
  { id: 'osm-pharmacy-fallback', label: 'OSM Overpass pharmacy (Google fallback, straight-line)', provider: 'osm', coverage: 'some',
    run: (ctx) => findNearestPharmacyOSM(`${ctx.lat},${ctx.lng}`, null),
    isValid: (r) => r !== null && typeof r?.distanceMiles === 'number' },
  { id: 'osm-gas-fallback', label: 'OSM Overpass fuel (Google fallback, straight-line)', provider: 'osm', coverage: 'some',
    run: (ctx) => findNearestGasStationOSM(`${ctx.lat},${ctx.lng}`, null),
    isValid: (r) => r !== null && typeof r?.distanceMiles === 'number' },
];

module.exports = {
  findNearestGrocery, findNearestPharmacy, findNearestGasStation,
  findNearestGroceryGoogle, findNearestPharmacyGoogle, findNearestGasStationGoogle,
  findNearestGroceryOSM, findNearestPharmacyOSM, findNearestGasStationOSM,
  SOURCES,
};
