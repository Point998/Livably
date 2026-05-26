'use strict';

const fipsCache = new Map();

async function getCensusFIPS(lat, lng) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (fipsCache.has(key)) return fipsCache.get(key);
  try {
    const url =
      `https://geocoding.geo.census.gov/geocoder/geographies/coordinates` +
      `?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    const tracts = data?.result?.geographies?.['Census Tracts'];
    if (!tracts?.length) return null;
    const t = tracts[0];
    const result = { state: t.STATE, county: t.COUNTY, tract: t.TRACT };
    fipsCache.set(key, result);
    return result;
  } catch {
    return null;
  }
}

async function fetchCensusACS(fips, vars) {
  const censusKey = process.env.CENSUS_API_KEY;
  if (!censusKey) return null;
  const { state, county, tract } = fips;
  const url =
    `https://api.census.gov/data/2022/acs/acs5?get=${vars.join(',')}` +
    `&for=tract:${tract}&in=state:${state}%20county:${county}&key=${censusKey}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) return null;
  const body = await resp.text();
  let rows;
  try { rows = JSON.parse(body); } catch { return null; }
  if (!rows || rows.length < 2) return null;
  const headers = rows[0];
  const values = rows[1];
  const get = (name) => values[headers.indexOf(name)];
  return { get, headers, values };
}

module.exports = { getCensusFIPS, fetchCensusACS };
