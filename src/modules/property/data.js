'use strict';

const { fetchCensusACS } = require('../../shared/census');
const { safeInt } = require('../../utils/text');
const {
  STATE_TAX_RATES, STATE_INSURANCE_ANNUAL, STATE_UTILITIES_MONTHLY,
  STATE_HOMESTEAD,
  BROADBAND_TECH_CODES,
} = require('../../utils/constants');
const { getDensityType } = require('../community/data');

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

function getDrainageCategory(drainagecl) {
  if (!drainagecl) return null;
  const d = drainagecl.toLowerCase();
  if (d.includes('excessively'))      return { label: 'Excessively drained',      color: 'gold',       implication: 'Soil dries out quickly — low basement moisture risk, but may need irrigation for landscaping.' };
  if (d.includes('moderately well'))  return { label: 'Moderately well drained',  color: 'lightgreen', implication: 'Drains well in most conditions; may be briefly wet after heavy rain.' };
  if (d.includes('well drained') || d === 'well drained') return { label: 'Well drained', color: 'green', implication: 'Water drains readily. Low risk of basement moisture from soil conditions.' };
  if (d.includes('somewhat poorly'))  return { label: 'Somewhat poorly drained',  color: 'orange',     implication: 'Stays wet for significant periods — may affect basement moisture and landscaping choices.' };
  if (d.includes('very poorly'))      return { label: 'Very poorly drained',      color: 'red',        implication: 'Water stands near the surface most of the year. Significant moisture risk and likely wetland indicators.' };
  if (d.includes('poorly'))           return { label: 'Poorly drained',           color: 'red',        implication: 'Wet soil most of the year. High basement moisture risk — thorough foundation inspection essential.' };
  return { label: drainagecl, color: 'muted', implication: 'Consult a soil engineer for specific drainage implications at this location.' };
}

async function getBroadbandData(lat, lng) {
  try {
    const url =
      `https://broadbandmap.fcc.gov/api/public/map/listAvailability` +
      `?latitude=${lat}&longitude=${lng}&unit=location&limit=25&category=residential`;
    const resp = await fetch(url, {
      signal:  AbortSignal.timeout(12000),
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const availability =
      Array.isArray(data?.availability) ? data.availability :
      Array.isArray(data?.data)         ? data.data         :
      Array.isArray(data)               ? data              : [];
    if (!availability.length) return null;

    let maxDownload = 0;
    let hasFiber    = false;
    const seenNames = new Set();
    const providers = [];

    for (const item of availability) {
      const techCode = item.technology_code ?? item.tech_code ?? 0;
      const download = Number(item.max_advertised_download_speed ?? item.download_speed ?? 0);
      if (download > maxDownload) maxDownload = download;
      if (techCode === 50) hasFiber = true;
      const name = String(item.brand_name || item.doing_business_as || item.provider_name || '').trim();
      if (name && !seenNames.has(name)) {
        seenNames.add(name);
        providers.push({
          name,
          tech:     BROADBAND_TECH_CODES[techCode] || `Type ${techCode}`,
          download,
          upload:   Number(item.max_advertised_upload_speed ?? item.upload_speed ?? 0),
        });
      }
    }
    providers.sort((a, b) => b.download - a.download);
    return { providers: providers.slice(0, 5), maxDownloadMbps: maxDownload, hasFiber, category: getBroadbandCategory(maxDownload, hasFiber) };
  } catch (err) {
    console.error('[FCC Broadband]', err.message);
    return null;
  }
}

function getBroadbandCategory(maxMbps, hasFiber) {
  if (hasFiber || maxMbps >= 1000) return { label: 'Gigabit available',    color: 'green',      desc: 'Fiber or gigabit internet is available — ideal for remote work and large households.' };
  if (maxMbps >= 200)              return { label: 'High-speed available', color: 'lightgreen', desc: 'Fast broadband is available. Most remote work and streaming needs are well-covered.' };
  if (maxMbps >= 25)               return { label: 'Broadband available',  color: 'gold',       desc: 'Standard broadband is available. Sufficient for most households.' };
  if (maxMbps > 0)                 return { label: 'Limited options',      color: 'orange',     desc: 'Limited speeds available. Verify connectivity before committing, especially for remote work.' };
  return                               { label: 'Coverage unconfirmed',  color: 'muted',      desc: 'Internet availability not confirmed at this address via FCC data.' };
}

function getConstructionEraContext(year) {
  if (!year || isNaN(year)) return null;
  if (year >= 2010) return { era: 'Modern construction (2010s–present)', cautions: [] };
  if (year >= 2000) return { era: '2000s construction', cautions: [] };
  if (year >= 1980) return { era: '1980s–90s construction', cautions: ['Some homes from this era may contain polybutylene plumbing (recalled for failure risk)', 'Asbestos possible in textured surfaces or floor tiles if not previously remediated'] };
  if (year >= 1978) return { era: 'Late 1970s construction', cautions: ['Pre-1980 construction may lack modern insulation standards', 'Aluminum wiring was common in this era — electrical inspection recommended'] };
  if (year >= 1960) return { era: '1960s–70s construction', cautions: ['Pre-1978: lead paint likely in original finishes', 'Asbestos common in floor tiles, insulation, or textured ceilings', 'Galvanized plumbing may be near end of service life'] };
  if (year >= 1940) return { era: '1940s–50s construction', cautions: ['Lead paint presumed in original surfaces', 'Original plumbing (galvanized or cast iron) may be aging', 'Knob-and-tube wiring possible if not updated', 'Asbestos in insulation and building materials is common'] };
  return { era: 'Pre-1940 construction', cautions: ['Lead paint presumed in original surfaces', 'Plumbing and electrical may be original or patchwork-updated — verify', 'Asbestos common in original building materials', 'Structural updates vary widely — confirm with inspection'] };
}

async function getPropertyIntelligence(lat, lng, fips, locationInfo) {
  const [soilRes, broadbandRes, acsRes] = await Promise.allSettled([
    getSoilData(lat, lng),
    getBroadbandData(lat, lng),
    fips
      ? fetchCensusACS(fips, ['B25035_001E', 'B25034_001E', 'B25034_002E', 'B25034_003E'])
      : Promise.resolve(null),
  ]);

  const soil      = soilRes.status      === 'fulfilled' ? soilRes.value      : null;
  const broadband = broadbandRes.status === 'fulfilled' ? broadbandRes.value  : null;
  const acs       = acsRes.status       === 'fulfilled' ? acsRes.value        : null;

  let era = null;
  if (acs) {
    const medianYear  = parseInt(acs.get('B25035_001E'), 10);
    const total       = safeInt(acs.get('B25034_001E')) || 1;
    const post2014    = safeInt(acs.get('B25034_002E'));
    const post2010    = post2014 + safeInt(acs.get('B25034_003E'));
    era = {
      medianYearBuilt:   isNaN(medianYear) ? null : medianYear,
      newConstructionPct: Math.round(post2010 / total * 100),
      context:           getConstructionEraContext(isNaN(medianYear) ? null : medianYear),
    };
  }

  return { soil, broadband, era, locationInfo };
}

module.exports = {
  getPropertyData,
  getPropertyIntelligence,
  getSoilData,
  getDrainageCategory,
  getBroadbandData,
  getBroadbandCategory,
  getConstructionEraContext,
};
