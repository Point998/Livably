'use strict';

// FR-074 — Census is the app's most widely-shared external source (6 modules +
// rural-mode cascade). This layer hardens both lone endpoints:
//  • fetchCensusACS — newest-first ACS5 *vintage* fallback (currency + resilience)
//    via sourceChain, so an outage is recorded in the FR-068 ledger instead of a
//    silent null, and the data is no longer pinned to a stale hard-coded year.
//  • getCensusFIPS — light transient retry + observability (the upstream cascade).
// Contract preserved: fetchCensusACS still returns { get, headers, values } (+ an
// additive `vintage`) or null; getCensusFIPS still returns { state, county, tract }
// or null. No keyless fallback (Census requires a key).

const { sourceChain } = require('./sourceChain');
const { logError } = require('../logger');
const { CENSUS_ACS_VINTAGES } = require('../utils/constants');

const fipsCache = new Map();

// Vintages proven *permanently* absent (HTTP 404 — not yet released / retired) are
// skipped on subsequent calls. Transient failures do NOT land here, so the newest
// vintage is retried next call (self-heals; avoids sticking the process staler).
const knownAbsentVintages = new Set();

const chainLog = (fn, origin) => (msg) => logError(fn, origin, new Error(msg));

// ── FIPS (Census geocoder) ────────────────────────────────────────────────────

async function fetchFipsOnce(lat, lng) {
  const url =
    `https://geocoding.geo.census.gov/geocoder/geographies/coordinates` +
    `?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`FIPS HTTP ${resp.status}`);
  const data = await resp.json();
  const tracts = data?.result?.geographies?.['Census Tracts'];
  if (!tracts?.length) throw new Error('FIPS: no tract');
  const t = tracts[0];
  return { state: t.STATE, county: t.COUNTY, tract: t.TRACT };
}

async function fetchFipsWithRetry(lat, lng) {
  try {
    return await fetchFipsOnce(lat, lng);
  } catch {
    await new Promise((r) => setTimeout(r, 1000));   // one transient retry
    return fetchFipsOnce(lat, lng);
  }
}

async function getCensusFIPS(lat, lng) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (fipsCache.has(key)) return fipsCache.get(key);

  const picked = await sourceChain([
    { name: 'geocoder', run: () => fetchFipsWithRetry(lat, lng), isValid: (r) => r != null },
  ], null, { label: 'census-fips', log: chainLog('getCensusFIPS', `${lat},${lng}`) });

  if (!picked) return null;            // exhausted → recorded in the FR-068 ledger
  fipsCache.set(key, picked.value);
  return picked.value;
}

// ── ACS 5-year (vintage fallback) ─────────────────────────────────────────────

// One vintage attempt. Throws on a failed fetch (404 also marks the vintage as
// permanently absent); returns the parsed accessor on success, or null when the
// vintage responds but has no data for this tract (→ chain tries the next).
async function fetchAcsVintage(vintage, fips, vars, censusKey) {
  const { state, county, tract } = fips;
  const url =
    `https://api.census.gov/data/${vintage}/acs/acs5?get=${vars.join(',')}` +
    `&for=tract:${tract}&in=state:${state}%20county:${county}&key=${censusKey}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (resp.status === 404) { knownAbsentVintages.add(vintage); throw new Error(`ACS ${vintage} absent`); }
  if (!resp.ok) throw new Error(`ACS ${vintage} HTTP ${resp.status}`);
  const body = await resp.text();
  let rows;
  try { rows = JSON.parse(body); } catch { return null; }
  if (!rows || rows.length < 2) return null;
  const headers = rows[0];
  const values = rows[1];
  const get = (name) => values[headers.indexOf(name)];
  return { get, headers, values, vintage };
}

async function fetchCensusACS(fips, vars) {
  const censusKey = process.env.CENSUS_API_KEY;
  if (!censusKey) return null;

  const order = CENSUS_ACS_VINTAGES.filter((v) => !knownAbsentVintages.has(v));
  const picked = await sourceChain(
    order.map((v) => ({
      name: `acs${v}`,
      run: () => fetchAcsVintage(v, fips, vars, censusKey),
      isValid: (r) => r != null && typeof r.get === 'function',
    })),
    null,
    { label: 'census-acs', log: chainLog('fetchCensusACS', `${fips.state}/${fips.county}/${fips.tract}`) },
  );

  return picked ? picked.value : null;
}

module.exports = { getCensusFIPS, fetchCensusACS };
