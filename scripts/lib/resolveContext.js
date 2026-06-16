'use strict';
const { geocodeAddress } = require('../../src/shared/google/geocoding');
const { reverseGeocodeAddress } = require('../../src/shared/google/reverseGeocode');
const { getCensusFIPS } = require('../../src/shared/census');

// Resolve one address → ctx. Geocoding is the floor: if it fails the address is
// unusable and returned with an `error` so the harness can exclude it.
async function resolveContext(address) {
  let loc;
  try {
    loc = await geocodeAddress(address);
  } catch (e) {
    return { address, error: e.message || 'geocode failed' };
  }
  const { lat, lng } = loc;
  const info = await reverseGeocodeAddress({ lat, lng });
  const fips = await getCensusFIPS(lat, lng);
  return { address, lat, lng, state: info.state, county: info.county, fips };
}

async function resolveContexts(addresses) {
  return Promise.all(addresses.map(resolveContext));
}

module.exports = { resolveContext, resolveContexts };
