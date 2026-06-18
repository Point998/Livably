'use strict';

// FR-073 — resilient, observable elevation. USGS EPQS is a lone single-source
// dependency for two chapters (Climate topographic position, Garden microclimate)
// and is a known-flaky endpoint. This helper wraps EPQS (primary) → OpenTopoData
// NED 10 m (independent fallback, same USGS DEM, different host) → null, via
// sourceChain so the degradation is recorded in the FR-068 ledger instead of
// swallowed. Batch-aware: Climate's 5 points cost one OpenTopoData call.

const { sourceChain } = require('./sourceChain');
const { logError } = require('../logger');
const { USGS_ELEVATION_URL, OPENTOPODATA_NED10M_URL } = require('../utils/constants');

const FEET_PER_METER = 3.28084;

// Unified no-data guard: null, or a sentinel/ocean-floor value (<= -1000), is
// "no data" (preserves Garden's −9999 handling; hardens Climate against a −9999
// corrupting topographic classification). Otherwise round to integer feet.
function cleanFeet(v) {
  return v == null || v <= -1000 ? null : Math.round(v);
}

// Generic EPQS point fetch with retry. Returns the raw `value` (feet) or null.
// Kept URL-based + raw for back-compat (Climate/chapters re-export it).
async function fetchElevationWithRetry(url, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const value = data?.value ?? null;
      if (value === null) throw new Error('null value in response');
      return value;
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        return null;
      }
    }
  }
}

// One EPQS point → cleaned integer feet (or null). Never throws.
async function epqsPointFeet(lat, lng) {
  const url = `${USGS_ELEVATION_URL}?x=${lng.toFixed(6)}&y=${lat.toFixed(6)}&units=Feet&wkid=4326&includeDate=false`;
  return cleanFeet(await fetchElevationWithRetry(url));
}

// EPQS for every point (parallel). Returns feet[] with null per failed point.
function epqsElevations(points) {
  return Promise.all(points.map(([lat, lng]) => epqsPointFeet(lat, lng)));
}

// OpenTopoData NED 10 m for every point in ONE batched call. Returns feet[]
// (meters → feet). Throws on a real fetch failure so the chain treats it as a miss
// (not a silent empty).
async function openTopoElevations(points) {
  const locs = points.map(([lat, lng]) => `${lat},${lng}`).join('|');
  const resp = await fetch(`${OPENTOPODATA_NED10M_URL}?locations=${locs}`, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`OpenTopoData HTTP ${resp.status}`);
  const data = await resp.json();
  const results = data?.results;
  if (!Array.isArray(results)) throw new Error('OpenTopoData: no results');
  return points.map((_, i) => {
    const m = results[i]?.elevation;
    return cleanFeet(m == null ? null : m * FEET_PER_METER);
  });
}

// The center point (index 0) is the one consumers require; surrounding nulls are
// acceptable (Climate fills them with the center). A null center = miss.
const centerPresent = (arr) => Array.isArray(arr) && arr[0] != null;

const chainLog = (origin) => (msg) => logError('fetchElevationsFeet', origin, new Error(msg));

// Public: resilient batch elevation. EPQS → OpenTopoData → null, observable.
async function fetchElevationsFeet(points) {
  if (!Array.isArray(points) || !points.length) return null;
  const origin = `${points[0][0]},${points[0][1]}`;
  const picked = await sourceChain([
    { name: 'epqs',     run: () => epqsElevations(points),     isValid: centerPresent },
    { name: 'opentopo', run: () => openTopoElevations(points), isValid: centerPresent },
  ], null, { label: 'elevation', log: chainLog(origin) });
  return picked ? picked.value : null;
}

// Public: single-point convenience.
async function fetchElevationFeet(lat, lng) {
  const arr = await fetchElevationsFeet([[lat, lng]]);
  return arr ? (arr[0] ?? null) : null;
}

module.exports = {
  fetchElevationsFeet,
  fetchElevationFeet,
  fetchElevationWithRetry, // back-compat re-export target
  epqsPointFeet,
  cleanFeet,
};
