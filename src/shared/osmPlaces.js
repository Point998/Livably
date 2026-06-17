'use strict';

// FR-066 — OSM POI search (keyless fallback for Google Places). Builds an
// Overpass union query from tag-only filters (CONSTRAINT-004: no brand/name
// logic), parses named POIs, and orders them by straight-line (haversine)
// distance — the honest proximity floor when Google Distance Matrix is also
// unavailable in a quota outage. Pure aside from fetchOverpass. Never throws.

const { fetchOverpass } = require('./overpass');
const { haversineDistance } = require('../utils/geo');

// searchOSMPOIs(lat, lng, { filters, radiusM, limit, withTags }) -> [{ name, lat, lng, distanceMiles, tags? }]
// withTags (FR-067): include the raw OSM tags on each record so a caller making a
// single union query can re-derive which filter a POI matched (Overpass doesn't
// label the matching clause). Default false → fully backward-compatible.
async function searchOSMPOIs(lat, lng, { filters, radiusM, limit = 8, withTags = false } = {}) {
  const clauses = (filters || []).map((f) => `nwr(around:${radiusM},${lat},${lng})${f};`).join('');
  const query = `[out:json][timeout:15];(${clauses});out center tags;`;
  const resp = await fetchOverpass(query);
  if (!resp) return [];

  let data;
  try { data = await resp.json(); } catch { return []; }
  const elements = Array.isArray(data?.elements) ? data.elements : [];

  return elements
    .filter((el) => el.tags && el.tags.name)
    .map((el) => {
      const eLat = el.center?.lat ?? el.lat;
      const eLng = el.center?.lon ?? el.lon;
      const rec = { name: el.tags.name, lat: eLat, lng: eLng, distanceMiles: haversineDistance(lat, lng, eLat, eLng) };
      if (withTags) rec.tags = el.tags;
      return rec;
    })
    .filter((p) => p.lat != null && p.lng != null)
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, limit);
}

module.exports = { searchOSMPOIs };
