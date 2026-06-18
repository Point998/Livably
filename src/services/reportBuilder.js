'use strict';

const { geocodeAddress } = require('../shared/google/geocoding');
const { reverseGeocodeAddress } = require('../shared/google/reverseGeocode');
const { getDriveTime, getTrafficVariations } = require('../shared/google/distanceMatrix');
const { googleMapsClient, googleMapsApiKey } = require('../shared/google/client');
const { findNearestGrocery, findNearestPharmacy, findNearestGasStation } = require('../modules/reachability/data');
const { findNearestHighwayOnRamp } = require('../modules/access/data');
const { findNearestHospital, findNearestUrgentCare, getHealthcareDepth } = require('../modules/health/data');
const { findNearestSchool, findNearestElementarySchool } = require('../modules/schools/data');
const { findNearestPark, findNearestCoffeeShop, findNearestLibrary, findNearestRecreationCenter, findNearestPostOffice } = require('../modules/recreation/data');
const { getChapterData } = require('../chapters');
const { saveReport } = require('./reportStore');
const { logRequest, logError, logDegradation, logAnalysis } = require('../logger');
const { runWithLedger, getLedger, summarize } = require('../shared/degradationLedger');
const { buildReportHTML } = require('../templates/pages/reportPage');
const { QuotaExceededError, RateLimitError, BudgetExceededError } = require('../rateLimit');
const { getCensusFIPS, fetchCensusACS } = require('../shared/census');
const { detectRuralMode } = require('../shared/validate');
const { snapToCell } = require('../shared/spatial');
const { getDrivingRates } = require('../shared/rates');
const { DEFAULT_PROFILE, PROFILE_BOUNDS } = require('../utils/constants');

function classifyError(error) {
  if (error instanceof BudgetExceededError) {
    return { type: 'QUOTA_EXCEEDED', title: 'Service at capacity', message: "We've reached today's data-fetch limit. Please try again later.", retryAfter: null };
  }
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

// Public entry. Runs the whole report inside a request-scoped degradation ledger
// (FR-068) so every sourceChain fallback fired anywhere in the fan-out is
// attributed to this report — concurrency-safe via AsyncLocalStorage.
function buildReport(address, options = {}) {
  return runWithLedger(() => buildReportInner(address, options));
}

async function buildReportInner(address, options = {}) {
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

  // FR-058: snap origin to a mode-sized spatial cell once. POI fetchers below
  // search from the cell centroid and cache by cellId so neighboring addresses
  // share fetches; safety tier (hospital/urgent care) recomputes the displayed
  // drive time per actual address. centroidLatLng is the shared origin for
  // cell-keyed drive-time + traffic computations.
  // snapToCell stays pure-spatial; we augment with `mode` so the data layer can
  // band centroid drive times from the same single source that sized the cell.
  const cell = { ...snapToCell({ lat: origin.lat, lng: origin.lng }, ruralMode), mode: ruralMode };
  const centroidLatLng = `${cell.centroid.lat},${cell.centroid.lng}`;

  const results = await Promise.allSettled([
    findNearestGrocery(originLatLng, ruralMode, cell),
    findNearestPharmacy(originLatLng, cell),
    findNearestHospital(originLatLng, originState, cell),       // CONSTRAINT-006: cross-state filter
    findNearestUrgentCare(originLatLng, originState, cell),     // CONSTRAINT-006: cross-state filter
    findNearestHighwayOnRamp(originLatLng),
    findNearestSchool(originLatLng, originState),         // CONSTRAINT-006: cross-state filter
    findNearestGasStation(originLatLng, cell),
    findNearestPark(originLatLng),
    findNearestCoffeeShop(originLatLng),
    findNearestElementarySchool(originLatLng, originState), // CONSTRAINT-006: cross-state filter
    findNearestLibrary(originLatLng),
    findNearestRecreationCenter(originLatLng),
    findNearestPostOffice(originLatLng),
  ]);

  const [grocery, pharmacy, hospital, urgentCare, highwayRamp, school, gasStation, park, coffeeShop, elementarySchool, library, recCenter, postOffice] =
    results.map((r) => (r.status === 'fulfilled' ? r.value : null));

  // Enrich hospital with CMS + NPI healthcare depth data (non-blocking)
  let healthcareDepth = null;
  if (hospital) {
    try {
      healthcareDepth = await getHealthcareDepth(hospital, locationInfo);
    } catch {}
  }

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

  // FR-058: traffic curves are a stable cell→destination shape — compute from the
  // centroid and cell-key them (14-day TTL) so neighbors share the 4-slot fetch.
  const trafficResults = await Promise.allSettled(
    trafficTargets.map((t) => getTrafficVariations(centroidLatLng, t.location, { cellId: cell.cellId })),
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
      ruralMode,
      cell,
    });
  } catch (chapErr) {
    console.error('[Chapters] fetch error:', chapErr.message);
    logError('getChapterData', address, chapErr);
  }

  let lifeCalc = null;
  try {
    // FR-032 seam: feed the utilities chapter's per-address local electricity rate
    // into the EV-equivalent cost when available (falls back to national avg).
    const localElectricRate = chapters?.utilities?.electric?.residentialRate;
    const rates = await getDrivingRates({ electricRatePerKwh: localElectricRate });
    lifeCalc = { profile: DEFAULT_PROFILE, rates, bounds: PROFILE_BOUNDS };
  } catch (_) { /* calculator omitted on total failure */ }

  let reportId = null;
  try { reportId = saveReport(address); } catch {}
  logRequest(address, 'success', Date.now() - _reqStart);
  // FR-068 — emit one degradation summary line only when this report ran on at
  // least one fallback (signal, not noise; clean reports stay quiet).
  const degradation = summarize(getLedger());
  if (degradation.total > 0) logDegradation(address, degradation);
  logAnalysis();

  const html = buildReportHTML(address, {
    grocery, pharmacy, hospital, urgentCare, highwayRamp, school, gasStation,
    park, coffeeShop, elementarySchool, library, recCenter, postOffice,
    healthcareDepth, customDestinations, trafficData, origin, reportId, chapters, lifeCalc,
  });

  return { html, reportId, address };
}

module.exports = { buildReport, classifyError };
