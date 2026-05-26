'use strict';
const { geocodeCache } = require('../../cache');
const { googleMapsClient, googleMapsApiKey } = require('./client');

async function geocodeAddress(address) {
  const cacheKey = address.toLowerCase().trim();
  const cached = geocodeCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] geocode:', cacheKey); return cached; }

  const geocodeResponse = await googleMapsClient.geocode({
    params: { address, key: googleMapsApiKey },
  });

  const geoResults = geocodeResponse.data.results || [];
  if (!geoResults.length) {
    throw new Error('Unable to geocode the address.');
  }

  const location = geoResults[0].geometry.location;
  geocodeCache.set(cacheKey, location);
  return location;
}

module.exports = { geocodeAddress };
