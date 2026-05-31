'use strict';

const { geocodeAddress } = require('../shared/google/geocoding');
const { reverseGeocodeAddress } = require('../shared/google/reverseGeocode');
const { getDriveTime, getTrafficVariations } = require('../shared/google/distanceMatrix');
const { googleMapsClient, googleMapsApiKey } = require('../shared/google/client');
const { findNearestGrocery, findNearestPharmacy, findNearestGasStation } = require('../modules/reachability/data');
const { findNearestHighwayOnRamp } = require('../modules/access/data');
const { findNearestHospital, findNearestUrgentCare } = require('../modules/health/data');
const { findNearestSchool, findNearestElementarySchool } = require('../modules/schools/data');
const { findNearestPark, findNearestCoffeeShop } = require('../modules/recreation/data');
const { getChapterData } = require('../chapters');
const { saveReport } = require('./reportStore');
const { logRequest, logError, logAnalysis } = require('../logger');
const { buildReportHTML } = require('../templates/pages/reportPage');
const { QuotaExceededError, RateLimitError } = require('../rateLimit');
const { getCensusFIPS, fetchCensusACS } = require('../shared/census');
const { detectRuralMode } = require('../shared/validate');

function classifyError(error) {
  if (error instanceof QuotaExceededError) {
    return { type: 'QUOTA_EXCEEDED', title: 'Quota limit reached', message: error.message, retryAfter: null };
  }
  if (error instanceof RateLimitError) {
    return { type: 'RATE_LIMIT', title: "We're experiencing high demand", message: error.message, retryAfter: error.retryAfter || 30 };
  }
  const msg = (error.message || '').toLowerCase();
  const status = error.response?.status;
  if (msg.includes('unable to geocode')) {
    return { type: 'ADDRESS_NOT_FOUND', title: "We couldn't find that address", message: 'Check the spelling and try again.', retryAfter: null };
  }
  if (status === 429 || msg.includes('quota') || msg.includes('rate limit')) {
    return { type: 'RATE_LIMIT', title: 'High demand right now', message: 'Please try again in a moment.', retryAfter: 30 };
  }
  return { type: 'SERVER_ERROR', title: 'Something went wrong', message: 'An error occurred generating your report.', retryAfter: null };
}

async function buildReport(address, options = {}) {
  const _reqStart = Date.now();

  const origin = await geocodeAddress(address);
  const originLatLng = `${origin.lat},${origin.lng}`;

  // Reverse geocode for city/state/county — used by crime data, property data, and CONSTRAINT-006
  const locationInfo = await reverseGeocodeAddress(originLatLng);
  const originState = locationInfo.state;

  // Pre-fetch FIPS + tract population to compute rural mode before parallel batch.
  // CONSTRAINT-007: classify address before narrative generation.
  // Falls back to 'suburban' silently if Census is unavailable.
  let ruralMode = 'suburban';
  let prefetchedFips = null;
  try {
    prefetchedFips = await getCensusFIPS(origin.lat, origin.lng);
    if (prefetchedFips) {
      const popMap = await fetchCensusACS(prefetchedFips, ['B01001_001E']);
      const tractPop = popMap ? parseInt(popMap.get('B01001_001E'), 10) : 0;
      if (tractPop > 0) {
        ruralMode = detectRuralMode(tractPop).mode;
      }
    }
  } catch (_) {
    // Census pre-fetch failed — ruralMode stays 'suburban'
  }

  const results = await Promise.allSettled([
    findNearestGrocery(originLatLng, ruralMode),
    findNearestPharmacy(originLatLng),
    findNearestHospital(originLatLng, originState),       // CONSTRAINT-006: cross-state filter
    findNearestUrgentCare(originLatLng, originState),     // CONSTRAINT-006: cross-state filter
    findNearestHighwayOnRamp(originLatLng),
    findNearestSchool(originLatLng, originState),         // CONSTRAINT-006: cross-state filter
    findNearestGasStation(originLatLng),
    findNearestPark(originLatLng),
    findNearestCoffeeShop(originLatLng),
    findNearestElementarySchool(originLatLng, originState), // CONSTRAINT-006: cross-state filter
  ]);

  const [grocery, pharmacy, hospital, urgentCare, highwayRamp, school, gasStation, park, coffeeShop, elementarySchool] =
    results.map((r) => (r.status === 'fulfilled' ? r.value : null));

  const rawNames     = [].concat(options.customDestName    || []);
  const rawAddresses = [].concat(options.customDestAddress || []);
  const rawTypes     = [].concat(options.customDestType    || []);
  const rawCustomDests = [];
  for (let i = 0; i < Math.min(rawAddresses.length, 10); i++) {
    const addr = (rawAddresses[i] || '').trim();
    if (addr) rawCustomDests.push({ name: (rawNames[i] || 'Destination').trim(), address: addr, type: rawTypes[i] || 'other' });
  }

  const customDestResults = await Promise.allSettled(
    rawCustomDests.map(async ({ name, address: destAddr, type }) => {
      const location = await geocodeAddress(destAddr);
      const driveTimeMinutes = await getDriveTime(originLatLng, location);
      return { name, address: destAddr, type, location, driveTimeMinutes };
    }),
  );
  const customDestinations = customDestResults
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);

  // Traffic analysis for grocery, hospital, and work-type custom destinations
  const g0 = Array.isArray(grocery) ? grocery[0] : grocery;
  const trafficTargets = [];
  if (g0?.location) trafficTargets.push({ name: g0.name, location: g0.location });
  if (hospital?.location) trafficTargets.push({ name: hospital.name, location: hospital.location });
  customDestinations
    .filter((d) => d.type === 'work' && d.location)
    .forEach((d) => trafficTargets.push({ name: d.name, location: d.location }));

  const trafficResults = await Promise.allSettled(
    trafficTargets.map((t) => getTrafficVariations(originLatLng, t.location)),
  );
  const trafficData = trafficTargets
    .map((t, i) => ({ ...t, traffic: trafficResults[i].status === 'fulfilled' ? trafficResults[i].value : null }))
    .filter((t) => t.traffic !== null);

  const highwayDriveMinutes = highwayRamp?.driveTimeMinutes ?? null;
  let chapters = null;
  try {
    chapters = await getChapterData({
      lat: origin.lat,
      lng: origin.lng,
      originLatLng,
      locationInfo,
      googleMapsClient,
      googleMapsApiKey,
      getDriveTime,
      highwayDriveMinutes,
      fips: prefetchedFips,
    });
  } catch (chapErr) {
    console.error('[Chapters] fetch error:', chapErr.message);
    logError('getChapterData', address, chapErr);
  }

  let reportId = null;
  try { reportId = saveReport(address); } catch {}
  logRequest(address, 'success', Date.now() - _reqStart);
  logAnalysis();

  const html = buildReportHTML(address, {
    grocery, pharmacy, hospital, urgentCare, highwayRamp, school, gasStation,
    park, coffeeShop, elementarySchool, customDestinations, trafficData,
    origin, reportId, chapters,
  });

  return { html, reportId, address };
}

module.exports = { buildReport, classifyError };
