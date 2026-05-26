'use strict';
const { googleMapsClient, googleMapsApiKey } = require('./client');

async function reverseGeocodeAddress(latLng) {
  try {
    const result = await googleMapsClient.reverseGeocode({
      params: { latlng: latLng, key: googleMapsApiKey },
    });
    const components = result.data.results?.[0]?.address_components || [];
    return {
      city:   components.find((c) => c.types.includes('locality'))?.long_name || '',
      state:  components.find((c) => c.types.includes('administrative_area_level_1'))?.short_name || '',
      county: components.find((c) => c.types.includes('administrative_area_level_2'))?.long_name || '',
      zip:    components.find((c) => c.types.includes('postal_code'))?.long_name || '',
    };
  } catch {
    return { city: '', state: '', county: '', zip: '' };
  }
}

module.exports = { reverseGeocodeAddress };
