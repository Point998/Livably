'use strict';

const { geocodeAddress } = require('../shared/google/geocoding');
const { findNearestGrocery, findNearestPharmacy, findNearestGasStation } = require('../modules/reachability/data');
const { findNearestHighwayOnRamp } = require('../modules/access/data');
const { findNearestHospital, findNearestUrgentCare } = require('../modules/health/data');

async function generateComparisonData(address) {
  const origin = await geocodeAddress(address);
  const originLatLng = `${origin.lat},${origin.lng}`;
  const results = await Promise.allSettled([
    findNearestGrocery(originLatLng),
    findNearestPharmacy(originLatLng),
    findNearestHospital(originLatLng),
    findNearestUrgentCare(originLatLng),
    findNearestHighwayOnRamp(originLatLng),
    findNearestGasStation(originLatLng),
  ]);
  const [grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation] =
    results.map((r) => (r.status === 'fulfilled' ? r.value : null));
  return { address, origin, services: { grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation } };
}

module.exports = { generateComparisonData };
