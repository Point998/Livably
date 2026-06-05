'use strict';
// CONSTRAINT-003: Hospital must be selected by shortest drive time across top 5 candidates,
// NOT by Google search rank. Never trust Google's relevance ranking for safety-critical destinations.
const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { getDriveTime, getExactDriveTime } = require('../../shared/google/distanceMatrix');
const { checkCrossState } = require('../../shared/validate');
const { cellSearchOrigin, cellDriveOpts } = require('../../shared/spatial');
const { placesCache } = require('../../cache');
const { logError } = require('../../logger');
const {
  HOSPITAL_SEARCH_RADIUS_M, HOSPITAL_CANDIDATE_COUNT,
} = require('../../utils/constants');
const { isRetailEmbeddedHealth } = require('./logic');

// FR-058 safety tier (CONSTRAINT-003 preserved): when a `cell` is supplied, the
// expensive candidate SELECTION is computed from the centroid and cell-cached
// (shared across the neighborhood), but the displayed drive time and cross-state
// status are recomputed from the ACTUAL address so they stay correct per house.
// Cell helpers (cellSearchOrigin / cellDriveOpts) live in shared/spatial.js.
//
// Per-report fields layered onto a cell-cached selection. BOTH depend on the
// asking address, so neither may be cell-shared (CONSTRAINT-006 / PM-001):
//  - exactDriveMinutes: drive time from the ACTUAL address (the displayed value).
//  - cross-state: an H3 cell can straddle a state border, so the cross-state
//    determination is computed per address + originState, never inherited.
async function finalizeSafetyRecord(selection, actualOrigin, originState, kind, facilityWord) {
  // The exact recompute is one extra Distance Matrix call. If it fails (timeout/
  // transient), don't discard an already-selected safety facility — fall back to
  // the centroid time so the buyer still gets the destination (CONSTRAINT-015).
  let exactDriveMinutes = null;
  let displayMinutes = selection.centroidDriveMinutes ?? null;
  try {
    exactDriveMinutes = await getExactDriveTime(actualOrigin, selection.location);
    displayMinutes = exactDriveMinutes;
  } catch (e) {
    logError('finalizeSafetyRecord', actualOrigin, e);
  }
  const record = { ...selection, exactDriveMinutes, driveTimeMinutes: displayMinutes };

  const { valid: sameState, resultState } = await checkCrossState(selection.location, originState);
  if (!sameState) {
    record.crossStateWarning = true;
    record.crossStateNote = `This ${kind} is in ${resultState}. No in-state ${facilityWord} was found within the search radius.`;
  }
  return record;
}

// Gets top 5 hospital results, calculates actual drive time to each,
// and returns the one with the shortest drive time — not just Google's first result.
// originState: 2-letter abbreviation. Cross-state hospital is warned, not rejected —
// for safety-critical results, a cross-state hospital is better than no result.
// cell: FR-058 spatial cell (optional) — selection cell-cached, displayed time per-address.
async function findNearestHospital(originLatLng, originState = '', cell = null) {
  const cacheKey = cell ? `hospital:${cell.cellId}` : `hospital:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) {
    console.log('[CACHE HIT] places:', cacheKey);
    return cell ? finalizeSafetyRecord(cached, originLatLng, originState, 'hospital', 'hospital') : cached;
  }

  const searchOrigin = cellSearchOrigin(originLatLng, cell);
  let placesResponse = await googleMapsClient.textSearch({
    params: {
      key: googleMapsApiKey,
      query: 'hospital emergency department',
      location: searchOrigin,
      radius: HOSPITAL_SEARCH_RADIUS_M,
    },
  });

  let placeResults = placesResponse.data.results || [];

  if (!placeResults.length) {
    placesResponse = await googleMapsClient.placesNearby({
      params: {
        key: googleMapsApiKey,
        location: searchOrigin,
        rankby: 'distance',
        type: 'hospital',
      },
    });
    placeResults = placesResponse.data.results || [];
  }

  if (!placeResults.length) {
    throw new Error('No hospital found near that address.');
  }

  const candidates = placeResults.slice(0, HOSPITAL_CANDIDATE_COUNT);
  const withDriveTimes = await Promise.all(
    candidates.map(async (place) => {
      try {
        const driveTimeMinutes = await getDriveTime(searchOrigin, place.geometry.location, cellDriveOpts(cell));
        return {
          name: place.name,
          address: place.formatted_address || place.vicinity || place.name,
          location: place.geometry.location,
          driveTimeMinutes,
        };
      } catch (e) {
        logError('findNearestHospital', originLatLng, e);
        return null;
      }
    }),
  );

  const valid = withDriveTimes.filter(Boolean);
  if (!valid.length) {
    throw new Error('Unable to calculate drive times to nearby hospitals.');
  }

  valid.sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes);
  const result = valid[0];

  if (!cell) {
    // Legacy per-address path: cross-state is baked into the cached result.
    const { valid: sameState, resultState } = await checkCrossState(result.location, originState);
    if (!sameState) {
      result.crossStateWarning = true;
      result.crossStateNote = `This hospital is in ${resultState}. No in-state hospital was found within the search radius.`;
    }
    placesCache.set(cacheKey, result);
    return result;
  }

  // Cell path: cache the centroid-based selection only (state-independent, so it
  // can be shared across the cell). The buyer's displayed ER time AND the
  // cross-state determination are recomputed per address in finalizeSafetyRecord.
  const { driveTimeMinutes: centroidDriveMinutes, ...rest } = result;
  const selection = { ...rest, centroidDriveMinutes, cellId: cell.cellId, resolution: cell.resolution };
  placesCache.set(cacheKey, selection);
  return finalizeSafetyRecord(selection, originLatLng, originState, 'hospital', 'hospital');
}

async function findNearestUrgentCare(originLatLng, originState = '', cell = null) {
  const cacheKey = cell ? `urgentcare:${cell.cellId}` : `urgentcare:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) {
    console.log('[CACHE HIT] places:', cacheKey);
    return cell ? finalizeSafetyRecord(cached, originLatLng, originState, 'urgent care', 'facility') : cached;
  }

  const searchOrigin = cellSearchOrigin(originLatLng, cell);
  let placesResponse = await googleMapsClient.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: searchOrigin,
      rankby: 'distance',
      keyword: 'urgent care',
    },
  });

  let placeResults = (placesResponse.data.results || []).filter(
    (place) => !isRetailEmbeddedHealth(place),
  );

  if (!placeResults.length) {
    placesResponse = await googleMapsClient.textSearch({
      params: {
        key: googleMapsApiKey,
        query: 'urgent care clinic',
        location: searchOrigin,
        radius: HOSPITAL_SEARCH_RADIUS_M,
      },
    });
    placeResults = (placesResponse.data.results || []).filter(
      (place) => !isRetailEmbeddedHealth(place),
    );
  }

  const place = placeResults[0];
  if (!place) {
    throw new Error('No urgent care clinic found near that address.');
  }

  const driveTimeMinutes = await getDriveTime(searchOrigin, place.geometry.location, cellDriveOpts(cell));
  const result = {
    name: place.name,
    address: place.formatted_address || place.vicinity || place.name,
    location: place.geometry.location,
    driveTimeMinutes,
  };

  if (!cell) {
    // Legacy per-address path: cross-state is baked into the cached result.
    const { valid: sameState, resultState } = await checkCrossState(result.location, originState);
    if (!sameState) {
      result.crossStateWarning = true;
      result.crossStateNote = `This urgent care is in ${resultState}. No in-state facility was found within the search radius.`;
    }
    placesCache.set(cacheKey, result);
    return result;
  }

  const { driveTimeMinutes: centroidDriveMinutes, ...rest } = result;
  const selection = { ...rest, centroidDriveMinutes, cellId: cell.cellId, resolution: cell.resolution };
  placesCache.set(cacheKey, selection);
  return finalizeSafetyRecord(selection, originLatLng, originState, 'urgent care', 'facility');
}

function mapCMSHospitalType(hospitalType) {
  if (!hospitalType) return null;
  const t = hospitalType.toLowerCase();
  if (t.includes('critical access'))
    return { label: 'Critical Access Hospital', note: 'A smaller rural hospital (typically ≤25 beds). Excellent for local access, but major trauma, complex cardiac events, and specialty procedures are typically transferred to a larger regional medical center.' };
  if (t.includes('acute care') || t.includes('short term'))
    return { label: 'Acute Care Hospital', note: 'Equipped for most emergencies. Verify trauma center designation directly with the hospital if your household has specific trauma care needs.' };
  if (t.includes('children'))
    return { label: "Children's Hospital", note: 'Specialized pediatric facility — not a general emergency department for adults.' };
  if (t.includes('psychiatric'))
    return { label: 'Psychiatric Hospital', note: 'Specialized psychiatric facility — not a general emergency department.' };
  return null;
}

async function getCMSHospitalType(address) {
  if (!address) return null;
  try {
    const zipMatch = address.match(/\b(\d{5})\b/);
    if (!zipMatch) return null;
    const zip = zipMatch[1];
    const url = `https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0?conditions[0][property]=zip_code&conditions[0][operator]=%3D&conditions[0][value]=${zip}&limit=10`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    const rows = data?.results ?? data?.data ?? [];
    if (!rows.length) return null;
    const preferred = rows.find(r => {
      const t = (r.hospital_type || '').toLowerCase();
      return t.includes('acute') || t.includes('critical access');
    }) || rows[0];
    return mapCMSHospitalType(preferred.hospital_type || preferred.hospitalType || null);
  } catch {
    return null;
  }
}

async function getPrimaryCareCount(city, state) {
  if (!city || !state) return null;
  try {
    const cityEnc  = encodeURIComponent(city);
    const stateEnc = encodeURIComponent(state);
    const base = `https://npiregistry.cms.hhs.gov/api/?version=2.1&enumeration_type=NPI-1&city=${cityEnc}&state=${stateEnc}&limit=1`;
    const [famRes, intRes] = await Promise.allSettled([
      fetch(`${base}&taxonomy_description=Family+Medicine`,  { signal: AbortSignal.timeout(10000) }),
      fetch(`${base}&taxonomy_description=Internal+Medicine`, { signal: AbortSignal.timeout(10000) }),
    ]);
    let total = 0;
    for (const r of [famRes, intRes]) {
      if (r.status !== 'fulfilled' || !r.value.ok) continue;
      const json = await r.value.json();
      total += (json.result_count ?? 0);
    }
    return total;
  } catch {
    return null;
  }
}

async function getHealthcareDepth(hospital, locationInfo) {
  if (!hospital) return null;
  const [desigRes, pcRes] = await Promise.allSettled([
    getCMSHospitalType(hospital.address),
    getPrimaryCareCount(locationInfo?.city, locationInfo?.state),
  ]);
  return {
    designation:      desigRes.status === 'fulfilled' ? desigRes.value : null,
    primaryCareCount: pcRes.status    === 'fulfilled' ? pcRes.value    : null,
  };
}

module.exports = { findNearestHospital, findNearestUrgentCare, getCMSHospitalType, getPrimaryCareCount, getHealthcareDepth };
