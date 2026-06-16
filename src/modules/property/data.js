'use strict';

const { fetchCensusACS } = require('../../shared/census');
const { safeInt } = require('../../utils/text');
const {
  STATE_TAX_RATES, STATE_INSURANCE_ANNUAL, STATE_UTILITIES_MONTHLY,
  STATE_HOMESTEAD,
} = require('../../utils/constants');
const { getDensityType } = require('../community/logic');
const { getDrainageCategory, getConstructionEraContext, buildHousingAgeBands } = require('./logic');

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

async function getSoilData(lat, lng) {
  try {
    const query = `
      SELECT TOP 1 mu.muname, co.compname, co.drainagecl, co.hydgrp, co.hydricrating
      FROM mapunit mu
      JOIN component co ON mu.mukey = co.mukey
      WHERE mu.mukey = (
        SELECT mukey FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('point(${lng} ${lat})')
      )
      ORDER BY co.majcompflag DESC, co.comppct_r DESC
    `;
    const resp = await fetch(
      'https://sdmdataaccess.sc.egov.usda.gov/Tabular/SDMTabularService/post.rest',
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `query=${encodeURIComponent(query)}&format=JSON`,
        signal:  AbortSignal.timeout(15000),
      }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const table = data?.Table;
    if (!table || !table.length) return null;
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
  } catch (err) {
    console.error('[USDA Soil]', err.message);
    return null;
  }
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
    run: (ctx) => getSoilData(ctx.lat, ctx.lng),
    isValid: (r) => r !== null && typeof r?.drainagecl === 'string' },
  { id: 'census-acs-property', label: 'Census ACS5 housing vintage (median year built + age bands)', provider: 'census', coverage: 'all', requiresKey: 'CENSUS_API_KEY',
    run: (ctx) => getHousingVintageData(ctx.fips),
    isValid: (r) => r !== null && typeof r?.medianYearBuilt === 'number' && r.medianYearBuilt > 1700 && r.medianYearBuilt < 2100 },
];

module.exports = {
  getPropertyData,
  getPropertyIntelligence,
  getHousingVintageData,
  getSoilData,
  getDrainageCategory,
  getConstructionEraContext,
  SOURCES,
};
