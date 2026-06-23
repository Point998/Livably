'use strict';

const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { haversineDistance } = require('../../utils/geo');
const { WALKABILITY_SEARCH_RADIUS_M, WALK_TYPES, OSM_WALK_FILTERS } = require('../../utils/constants');
const { getWalkCategory, UNKNOWN_WALK_CATEGORY, categorizeOSMWalkPOI } = require('./logic');
const { googlePlacesProbe } = require('../../shared/google/probe');
const { sourceChain } = require('../../shared/sourceChain');
const { searchOSMPOIs } = require('../../shared/osmPlaces');
const { placesOsmCache } = require('../../cache');
const { logError } = require('../../logger');

// ── FR-021 / FR-067: Walkability Score (proxy via Google Places, OSM fallback) ─

// Maps each WALK_TYPES entry (Google place type) to the OSM walk category key
// returned by categorizeOSMWalkPOI, so the OSM path reuses the same weights,
// labels, and icons rather than duplicating them.
const OSM_CATEGORY_BY_WALK_TYPE = {
  grocery_or_supermarket: 'grocery',
  restaurant: 'restaurant',
  transit_station: 'transit',
  park: 'park',
  pharmacy: 'pharmacy',
};

// count→weight rule shared by both sources: 0 → 0, ≤2 → half weight, else full.
function weightForCount(count, weight) {
  return count === 0 ? 0 : count <= 2 ? Math.round(weight * 0.5) : weight;
}

const chainLog = (origin) => (msg) => logError('getWalkabilityScore', origin, new Error(msg));

// Public entry: Google primary → OSM fallback → degraded-but-renderable floor.
// Google short-circuits the chain (no Overpass call) whenever it succeeds.
async function getWalkabilityScore(lat, lng) {
  const picked = await sourceChain([
    { name: 'google', run: () => getWalkabilityScoreGoogle(lat, lng), isValid: isValidWalk },
    { name: 'osm',    run: () => getWalkabilityScoreOSM(lat, lng),    isValid: isValidWalk },
  ], null, { label: 'walkability', log: chainLog(`${lat},${lng}`) });

  if (picked) return picked.value;

  // Both sources down: keep the chapter renderable with an actionable pointer
  // (CONSTRAINT-015) rather than vanishing or faking a number.
  return { score: null, category: UNKNOWN_WALK_CATEGORY, destinations: [], isProxy: true, source: 'unavailable' };
}

const isValidWalk = (r) => r != null && typeof r.score === 'number' && Array.isArray(r.destinations);

async function getWalkabilityScoreGoogle(lat, lng) {
  const results = await Promise.allSettled(
    WALK_TYPES.map(({ type }) =>
      googleMapsClient.placesNearby({
        params: { key: googleMapsApiKey, location: `${lat},${lng}`, radius: WALKABILITY_SEARCH_RADIUS_M, type },
      })
    )
  );

  // Outage signature: if EVERY Places call rejected, this is a dead endpoint,
  // not a walk desert — return null so the chain falls through to OSM and the
  // monitor sees a genuine failure (FR-067; was swallowed to score 0 before).
  if (!results.some((r) => r.status === 'fulfilled')) return null;

  let totalScore = 0;
  const destinations = [];
  // FR-089 — retain the true per-category count. The headless contract surfaces these
  // factual counts instead of the composite score, which CONSTRAINT-001 forbids.
  const counts = {};

  for (let i = 0; i < WALK_TYPES.length; i++) {
    const { weight, label, icon } = WALK_TYPES[i];
    const r = results[i];
    if (r.status !== 'fulfilled') continue;
    const places = r.value.data.results || [];
    counts[label] = places.length;
    totalScore += weightForCount(places.length, weight);

    places.slice(0, 2).forEach((place) => {
      const dist = haversineDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng);
      destinations.push({
        label, icon,
        name: place.name,
        distanceMiles: dist,
        walkMinutes: Math.max(1, Math.round(dist * 20)),
      });
    });
  }

  destinations.sort((a, b) => a.distanceMiles - b.distanceMiles);

  const score = Math.min(100, totalScore);
  return { score, category: getWalkCategory(score), destinations, counts, isProxy: true, source: 'google' };
}

// FR-067 — keyless fallback. One Overpass union call across the 5 walk-type
// filters, then re-categorize each POI by its tags (Overpass doesn't label the
// matching clause). Straight-line proximity; same weight rule as Google.
async function getWalkabilityScoreOSM(lat, lng) {
  const cacheKey = `walk:osm:${lat},${lng}`;
  const cached = placesOsmCache.get(cacheKey);
  if (cached) return cached;

  const filters = Object.values(OSM_WALK_FILTERS).flat();
  const pois = await searchOSMPOIs(lat, lng, {
    filters, radiusM: WALKABILITY_SEARCH_RADIUS_M, withTags: true, limit: 60,
  });
  if (!pois.length) return null;

  // Group POIs (nearest first — searchOSMPOIs already sorted) by walk category.
  const byCategory = {};
  for (const p of pois) {
    const cat = categorizeOSMWalkPOI(p.tags);
    if (!cat) continue;
    (byCategory[cat] ||= []).push(p);
  }
  if (!Object.keys(byCategory).length) return null;

  let totalScore = 0;
  const destinations = [];
  const counts = {}; // FR-089 — per-category counts for the headless contract (no score).

  for (const { type, weight, label, icon } of WALK_TYPES) {
    const cat = OSM_CATEGORY_BY_WALK_TYPE[type];
    const group = byCategory[cat] || [];
    counts[label] = group.length;
    totalScore += weightForCount(group.length, weight);

    group.slice(0, 2).forEach((p) => {
      destinations.push({
        label, icon,
        name: p.name,
        distanceMiles: p.distanceMiles,
        walkMinutes: Math.max(1, Math.round(p.distanceMiles * 20)),
      });
    });
  }

  destinations.sort((a, b) => a.distanceMiles - b.distanceMiles);

  const score = Math.min(100, totalScore);
  const result = { score, category: getWalkCategory(score), destinations, counts, isProxy: true, source: 'osm' };
  placesOsmCache.set(cacheKey, result);
  return result;
}

const SOURCES = [
  // Google descriptor targets the Google impl directly so the monitor reports on
  // Google specifically (not masked green by the OSM fallback). isValid now fails
  // meaningfully on outage because the impl returns null when all calls reject.
  { id: 'google-places-walkability', label: 'Google Places (walkability score proxy)', provider: 'google', coverage: 'some',
    run: (ctx) => getWalkabilityScoreGoogle(ctx.lat, ctx.lng),
    isValid: isValidWalk,
    probe: googlePlacesProbe },
  // FR-067 OSM fallback. coverage 'some' — Overpass data is sparser than Google;
  // a miss is informational, not a failure.
  { id: 'osm-walkability-fallback', label: 'OSM Overpass walkability (Google fallback, straight-line)', provider: 'osm', coverage: 'some',
    run: (ctx) => getWalkabilityScoreOSM(ctx.lat, ctx.lng),
    isValid: isValidWalk },
];

module.exports = { getWalkabilityScore, getWalkabilityScoreGoogle, getWalkabilityScoreOSM, SOURCES };
