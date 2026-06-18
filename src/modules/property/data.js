'use strict';

const { fetchCensusACS } = require('../../shared/census');
const { safeInt } = require('../../utils/text');
const {
  STATE_TAX_RATES, STATE_INSURANCE_ANNUAL, STATE_UTILITIES_MONTHLY,
  STATE_HOMESTEAD,
} = require('../../utils/constants');
const { getDensityType } = require('../community/logic');
const { getDrainageCategory, getConstructionEraContext, buildHousingAgeBands } = require('./logic');
const { sourceChain } = require('../../shared/sourceChain');
const { logError } = require('../../logger');

// FR-072 — SoilWeb (UC Davis) coordinate deep-link for the actionable floor when
// USDA SDA is unavailable. The spike (see FR-072 discovery) confirmed SoilWeb has
// no public JSON API, but /gmap/?loc=lat,lng is a working point-specific AOI link.
const SOILWEB_GMAP_BASE = 'https://casoilresource.lawr.ucdavis.edu/gmap/';

// Adapter so sourceChain miss/error visibility flows through the structured logger
// (NR-004 / FR-068 observability) and stays quiet in tests.
const chainLog = (fn, origin) => (msg) => logError(fn, origin, new Error(msg));

// A transient failure is worth one retry; a 4xx (bad query) is not.
function isTransientSoilError(err) {
  if (!err) return false;
  if (err.name === 'AbortError' || err.name === 'TimeoutError') return true; // fetch timeout
  const status = err.status;
  if (typeof status === 'number') return status >= 500;          // 5xx
  return !/\bHTTP 4\d\d\b/.test(err.message || '');               // network/unknown → transient
}

// ── FR-023: Property Costs & Market ──────────────────────────────────────────

async function getPropertyData(fips, locationInfo) {
  const state  = locationInfo?.state  || '';
  const county = locationInfo?.county || '';
  const taxRate       = STATE_TAX_RATES[state]       ?? 1.00;
  const insuranceYear = STATE_INSURANCE_ANNUAL[state] ?? 1400;
  const utilitiesMo   = STATE_UTILITIES_MONTHLY[state] ?? 185;
  const homesteadNote = STATE_HOMESTEAD[state] || null;

  let tractPop = null;
  if (fips) {
    try {
      const acs = await fetchCensusACS(fips, ['B01003_001E']);
      if (acs) tractPop = safeInt(acs.get('B01003_001E'));
    } catch {}
  }

  return {
    taxRate,
    insuranceYear,
    utilitiesMo,
    homesteadNote,
    state,
    county,
    densityLabel: getDensityType(tractPop || 0).label,
  };
}

// FR-072 — soil is a lone single-source dependency (no Google primary). Wrapped in
// sourceChain so an outage is recorded in the FR-068 ledger instead of swallowed to
// null (the NR-004 observability debt). Contract unchanged: object-or-null.
async function getSoilData(lat, lng) {
  const picked = await sourceChain([
    { name: 'sda', run: () => getSoilDataSDA(lat, lng), isValid: isValidSoilOrEmpty },
  ], null, { label: 'property-soil', log: chainLog('getSoilData', `${lat},${lng}`) });
  return picked ? picked.value : null;
}

// A soil object AND a legit-empty null (point not mapped — open water / urban pits)
// are both valid SDA outcomes; only a thrown fetch error is a miss. So an unmapped
// point short-circuits as success (no false degradation event); a real outage
// throws → chain records error+exhausted in the ledger → getSoilData returns null.
const isValidSoilOrEmpty = (r) => r === null || (r != null && typeof r.drainagecl === 'string');

// Fetches the SSURGO map unit for the point. Returns a soil object, or null when
// the query succeeds but no soil is mapped. THROWS (after one retry on transient
// failure) when the SDA fetch itself fails — so the chain can distinguish
// "no soil here" from "SDA down".
async function getSoilDataSDA(lat, lng) {
  const query = `
    SELECT TOP 1 mu.muname, co.compname, co.drainagecl, co.hydgrp, co.hydricrating
    FROM mapunit mu
    JOIN component co ON mu.mukey = co.mukey
    WHERE mu.mukey = (
      SELECT mukey FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('point(${lng} ${lat})')
    )
    ORDER BY co.majcompflag DESC, co.comppct_r DESC
  `;
  const fetchOnce = async (timeoutMs) => {
    const resp = await fetch(
      'https://sdmdataaccess.sc.egov.usda.gov/Tabular/SDMTabularService/post.rest',
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `query=${encodeURIComponent(query)}&format=JSON`,
        signal:  AbortSignal.timeout(timeoutMs),
      }
    );
    if (!resp.ok) { const e = new Error(`SDA HTTP ${resp.status}`); e.status = resp.status; throw e; }
    return resp.json();
  };

  let data;
  try {
    data = await fetchOnce(15000);
  } catch (err) {
    if (!isTransientSoilError(err)) throw err;   // 4xx → no retry
    data = await fetchOnce(10000);               // one retry, tighter budget
  }

  const table = data?.Table;
  if (!table || !table.length) return null;       // legit: point not mapped
  // SDA JSON returns data rows only (no header row) — positional per SELECT order:
  // 0=muname 1=compname 2=drainagecl 3=hydgrp 4=hydricrating
  const row = table[0];
  if (!row) return null;
  const drainagecl   = row[2] || null;
  const hydricrating = row[4] || null;
  return {
    muname:           row[0] || null,
    drainagecl,
    hydricrating,
    isHydric:         !!(hydricrating && String(hydricrating).toLowerCase().includes('yes')),
    drainageCategory: getDrainageCategory(drainagecl),
  };
}

async function getHousingVintageData(fips) {
  if (!fips) return null;
  try {
    const acs = await fetchCensusACS(fips, [
      'B25035_001E',
      'B25034_001E', 'B25034_002E', 'B25034_003E',
      'B25034_004E', 'B25034_005E', 'B25034_006E', 'B25034_007E',
      'B25034_008E', 'B25034_009E', 'B25034_010E', 'B25034_011E',
    ]);
    if (!acs) return null;
    const medianYear  = parseInt(acs.get('B25035_001E'), 10);
    const total       = safeInt(acs.get('B25034_001E')) || 1;
    const post2014    = safeInt(acs.get('B25034_002E'));
    const post2010    = post2014 + safeInt(acs.get('B25034_003E'));
    return {
      medianYearBuilt:    isNaN(medianYear) ? null : medianYear,
      newConstructionPct: Math.round(post2010 / total * 100),
      housingAgeBands:    buildHousingAgeBands((k) => acs.get(k)),
    };
  } catch (err) {
    console.error('[Census ACS housing vintage]', err.message);
    return null;
  }
}

async function getPropertyIntelligence(lat, lng, fips, locationInfo) {
  const [soilRes, acsRes] = await Promise.allSettled([
    getSoilData(lat, lng),
    getHousingVintageData(fips),
  ]);

  const soil    = soilRes.status === 'fulfilled' ? soilRes.value : null;
  const vintage = acsRes.status  === 'fulfilled' ? acsRes.value  : null;

  return {
    soil,
    // FR-072 — always-present point-specific SoilWeb deep-link, so the template's
    // CONSTRAINT-015 floor links the exact location when SDA soil is unavailable.
    soilwebUrl: `${SOILWEB_GMAP_BASE}?loc=${lat},${lng}`,
    era: vintage ? {
      medianYearBuilt:    vintage.medianYearBuilt,
      newConstructionPct: vintage.newConstructionPct,
      context:            getConstructionEraContext(vintage.medianYearBuilt),
    } : null,
    housingAgeBands: vintage?.housingAgeBands ?? null,
    locationInfo,
  };
}

const SOURCES = [
  { id: 'usda-soil', label: 'USDA Soil Data Access (SDA)', provider: 'usda', coverage: 'some',
    // Targets the SDA impl directly (not the chain wrapper) so the monitor reports
    // on SDA specifically (FR-072). A legit-empty (unmapped) point returns null and
    // is accepted; a real SDA outage throws, which the harness catches as failure.
    run: (ctx) => getSoilDataSDA(ctx.lat, ctx.lng),
    isValid: (r) => r === null || typeof r?.drainagecl === 'string' },
  { id: 'census-acs-property', label: 'Census ACS5 housing vintage (median year built + age bands)', provider: 'census', coverage: 'all', requiresKey: 'CENSUS_API_KEY',
    run: (ctx) => getHousingVintageData(ctx.fips),
    isValid: (r) => r !== null && typeof r?.medianYearBuilt === 'number' && r.medianYearBuilt > 1700 && r.medianYearBuilt < 2100 },
];

module.exports = {
  getPropertyData,
  getPropertyIntelligence,
  getHousingVintageData,
  getSoilData,
  getSoilDataSDA,
  getDrainageCategory,
  getConstructionEraContext,
  SOURCES,
};
