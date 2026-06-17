'use strict';
const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { getDriveTime } = require('../../shared/google/distanceMatrix');
const { sourceChain } = require('../../shared/sourceChain');
const { searchOSMPOIs } = require('../../shared/osmPlaces');
const { placesCache, placesOsmCache } = require('../../cache');
const { logError } = require('../../logger');
const {
  COFFEE_SHOP_CANDIDATE_COUNT,
  PARK_EXCLUDED_TYPES, PARK_LEISURE_TYPES,
  OSM_RECREATION_FILTERS, OSM_POI_RADIUS_M,
} = require('../../utils/constants');

function isValidPark(p) {
  const types = p.types || [];
  if (PARK_EXCLUDED_TYPES.some((t) => types.includes(t))) return false;
  if (types.includes('establishment') && !PARK_LEISURE_TYPES.some((t) => types.includes(t))) return false;
  return true;
}

// FR-069 — shape an OSM POI into the recreation record contract. No routing
// (Google Distance Matrix is down in a quota outage), so proximity is the
// straight-line distance, flagged for honest rendering (mirrors reachability).
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
// logger (NR-004 / FR-068 observability) and stays quiet in tests.
const chainLog = (fn, origin) => (msg) => logError(fn, origin, new Error(msg));

const isValidRec = (r) => r != null && typeof r.distanceMiles === 'number';

// Generic OSM nearest-single helper for the simple recreation categories.
async function recreationOSM(originLatLng, key, cachePrefix) {
  const cacheKey = `${cachePrefix}:osm:${originLatLng}`;
  const cached = placesOsmCache.get(cacheKey);
  if (cached) return cached;
  const [lat, lng] = originLatLng.split(',').map(Number);
  const pois = await searchOSMPOIs(lat, lng, { filters: OSM_RECREATION_FILTERS[key], radiusM: OSM_POI_RADIUS_M, limit: 1 });
  if (!pois.length) return null;
  const record = osmRecord(pois[0]);
  placesOsmCache.set(cacheKey, record);
  return record;
}

// ── Park ──────────────────────────────────────────────────────────────────────
async function findNearestPark(originLatLng) {
  const picked = await sourceChain([
    { name: 'google', run: () => findNearestParkGoogle(originLatLng), isValid: (r) => r != null && typeof r.driveTimeMinutes === 'number' },
    { name: 'osm',    run: () => findNearestParkOSM(originLatLng),    isValid: isValidRec },
  ], null, { label: 'recreation-park', log: chainLog('findNearestPark', originLatLng) });
  if (!picked) throw new Error('No park found near that address.');
  return picked.value;
}

async function findNearestParkGoogle(originLatLng) {
  const cacheKey = `park:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  const placesResponse = await googleMapsClient.placesNearby({
    params: { key: googleMapsApiKey, location: originLatLng, rankby: 'distance', type: 'park' },
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

const findNearestParkOSM = (originLatLng) => recreationOSM(originLatLng, 'park', 'park');

// ── Coffee shop ─────────────────────────────────────────────────────────────
async function findNearestCoffeeShop(originLatLng) {
  const picked = await sourceChain([
    { name: 'google', run: () => findNearestCoffeeShopGoogle(originLatLng), isValid: (r) => r != null && typeof r.driveTimeMinutes === 'number' },
    { name: 'osm',    run: () => findNearestCoffeeShopOSM(originLatLng),    isValid: isValidRec },
  ], null, { label: 'recreation-coffee', log: chainLog('findNearestCoffeeShop', originLatLng) });
  if (!picked) throw new Error('No coffee shop found near that address.');
  return picked.value;
}

async function findNearestCoffeeShopGoogle(originLatLng) {
  const cacheKey = `coffeeshop:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  const placesResponse = await googleMapsClient.placesNearby({
    params: { key: googleMapsApiKey, location: originLatLng, rankby: 'distance', type: 'cafe' },
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

const findNearestCoffeeShopOSM = (originLatLng) => recreationOSM(originLatLng, 'coffee', 'coffeeshop');

// ── Library ───────────────────────────────────────────────────────────────────
async function findNearestLibrary(originLatLng) {
  const picked = await sourceChain([
    { name: 'google', run: () => findNearestLibraryGoogle(originLatLng), isValid: (r) => r != null && typeof r.driveTimeMinutes === 'number' },
    { name: 'osm',    run: () => findNearestLibraryOSM(originLatLng),    isValid: isValidRec },
  ], null, { label: 'recreation-library', log: chainLog('findNearestLibrary', originLatLng) });
  if (!picked) throw new Error('No library found near that address.');
  return picked.value;
}

async function findNearestLibraryGoogle(originLatLng) {
  const cacheKey = `library:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }
  const placesResponse = await googleMapsClient.placesNearby({
    params: { key: googleMapsApiKey, location: originLatLng, rankby: 'distance', type: 'library' },
  });
  const place = (placesResponse.data.results || [])[0];
  if (!place) throw new Error('No library found near that address.');
  const result = {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
  placesCache.set(cacheKey, result);
  return result;
}

const findNearestLibraryOSM = (originLatLng) => recreationOSM(originLatLng, 'library', 'library');

// ── Recreation center ───────────────────────────────────────────────────────
async function findNearestRecreationCenter(originLatLng) {
  const picked = await sourceChain([
    { name: 'google', run: () => findNearestRecreationCenterGoogle(originLatLng), isValid: (r) => r != null && typeof r.driveTimeMinutes === 'number' },
    { name: 'osm',    run: () => findNearestRecreationCenterOSM(originLatLng),    isValid: isValidRec },
  ], null, { label: 'recreation-reccenter', log: chainLog('findNearestRecreationCenter', originLatLng) });
  if (!picked) throw new Error('No recreation center found near that address.');
  return picked.value;
}

async function findNearestRecreationCenterGoogle(originLatLng) {
  const cacheKey = `reccenter:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }
  const placesResponse = await googleMapsClient.placesNearby({
    params: { key: googleMapsApiKey, location: originLatLng, rankby: 'distance', type: 'community_center' },
  });
  const place = (placesResponse.data.results || [])[0];
  if (!place) throw new Error('No recreation center found near that address.');
  const result = {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
  placesCache.set(cacheKey, result);
  return result;
}

const findNearestRecreationCenterOSM = (originLatLng) => recreationOSM(originLatLng, 'recCenter', 'reccenter');

// ── Post office ───────────────────────────────────────────────────────────────
async function findNearestPostOffice(originLatLng) {
  const picked = await sourceChain([
    { name: 'google', run: () => findNearestPostOfficeGoogle(originLatLng), isValid: (r) => r != null && typeof r.driveTimeMinutes === 'number' },
    { name: 'osm',    run: () => findNearestPostOfficeOSM(originLatLng),    isValid: isValidRec },
  ], null, { label: 'recreation-postoffice', log: chainLog('findNearestPostOffice', originLatLng) });
  if (!picked) throw new Error('No post office found near that address.');
  return picked.value;
}

async function findNearestPostOfficeGoogle(originLatLng) {
  const cacheKey = `postoffice:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }
  const placesResponse = await googleMapsClient.placesNearby({
    params: { key: googleMapsApiKey, location: originLatLng, rankby: 'distance', type: 'post_office' },
  });
  const place = (placesResponse.data.results || [])[0];
  if (!place) throw new Error('No post office found near that address.');
  const result = {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
  placesCache.set(cacheKey, result);
  return result;
}

const findNearestPostOfficeOSM = (originLatLng) => recreationOSM(originLatLng, 'postOffice', 'postoffice');

const SOURCES = [
  // Google descriptor targets the Google impl directly so the monitor reports on
  // Google specifically (not masked green by the OSM fallback).
  { id: 'google-places-recreation', label: 'Google Places (park, coffee, library, rec center, post office)', provider: 'google', coverage: 'all',
    run: (ctx) => findNearestParkGoogle(`${ctx.lat},${ctx.lng}`),
    isValid: (r) => r !== null && typeof r?.driveTimeMinutes === 'number' },
  // FR-069 OSM fallbacks (non-safety POIs). coverage 'some' — a miss is
  // informational, not a failure.
  { id: 'osm-park-fallback',       label: 'OSM Overpass park (Google fallback, straight-line)',       provider: 'osm', coverage: 'some', run: (ctx) => findNearestParkOSM(`${ctx.lat},${ctx.lng}`),              isValid: isValidRec },
  { id: 'osm-coffee-fallback',     label: 'OSM Overpass cafe (Google fallback, straight-line)',       provider: 'osm', coverage: 'some', run: (ctx) => findNearestCoffeeShopOSM(`${ctx.lat},${ctx.lng}`),        isValid: isValidRec },
  { id: 'osm-library-fallback',    label: 'OSM Overpass library (Google fallback, straight-line)',    provider: 'osm', coverage: 'some', run: (ctx) => findNearestLibraryOSM(`${ctx.lat},${ctx.lng}`),           isValid: isValidRec },
  { id: 'osm-reccenter-fallback',  label: 'OSM Overpass rec centre (Google fallback, straight-line)', provider: 'osm', coverage: 'some', run: (ctx) => findNearestRecreationCenterOSM(`${ctx.lat},${ctx.lng}`),  isValid: isValidRec },
  { id: 'osm-postoffice-fallback', label: 'OSM Overpass post office (Google fallback, straight-line)',provider: 'osm', coverage: 'some', run: (ctx) => findNearestPostOfficeOSM(`${ctx.lat},${ctx.lng}`),        isValid: isValidRec },
];

module.exports = {
  findNearestPark, findNearestCoffeeShop, findNearestLibrary, findNearestRecreationCenter, findNearestPostOffice,
  findNearestParkGoogle, findNearestCoffeeShopGoogle, findNearestLibraryGoogle, findNearestRecreationCenterGoogle, findNearestPostOfficeGoogle,
  findNearestParkOSM, findNearestCoffeeShopOSM, findNearestLibraryOSM, findNearestRecreationCenterOSM, findNearestPostOfficeOSM,
  SOURCES,
};
