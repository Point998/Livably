'use strict';

const { haversineDistance } = require('../../utils/geo');
const { cellSearchOrigin, cellDriveOpts } = require('../../shared/spatial');
const { utilitiesCache } = require('../../cache');
const { HIFLD_TERRITORIES_URL } = require('../../utils/constants');

const NREL_BASE = 'https://developer.nrel.gov/api';
function nrelKey() { return process.env.NREL_API_KEY || 'DEMO_KEY'; }

function titleCase(s) {
  return String(s).toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

async function getElectricFromNREL(lat, lng) {
  try {
    const url = `${NREL_BASE}/utility_rates/v3.json?api_key=${nrelKey()}&lat=${lat}&lon=${lng}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
    if (!resp.ok) return null;
    const data = await resp.json();
    const out = data?.outputs || {};
    // NREL returns "no data" (string) for unserved areas — Number(...) -> NaN.
    const residentialRate = Number(out.residential);
    const utilityName = String(out.utility_name || '').trim();
    // Authoritative ownership classification from utility_info, when present
    // (e.g. "Investor Owned" / "Cooperative" / "Municipal"). Falls back to a
    // name heuristic downstream when absent/unrecognized.
    const ownership = String(out.utility_info?.[0]?.ownership || '').trim() || null;
    if (!residentialRate || residentialRate <= 0) return null;
    return { utilityName: utilityName || 'Unknown provider', residentialRate, ownership, source: 'NREL' };
  } catch (err) {
    console.error('[NREL Utility Rates]', err.message);
    return null;
  }
}

// Fallback: HIFLD Electric Retail Service Territories (ArcGIS point query) —
// provider name + ownership type, no rate. Keyless.
async function getElectricFromHIFLD(lat, lng) {
  try {
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects', outFields: 'NAME,TYPE',
      returnGeometry: 'false', resultRecordCount: '1', f: 'json',
    });
    const resp = await fetch(`${HIFLD_TERRITORIES_URL}/query?${params}`, {
      signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data?.error) return null;
    const a = data?.features?.[0]?.attributes;
    const name = String(a?.NAME || '').trim();
    if (!name) return null;
    return { utilityName: titleCase(name), residentialRate: null, ownership: String(a?.TYPE || '').trim() || null, source: 'HIFLD' };
  } catch (err) {
    console.error('[HIFLD territories]', err.message);
    return null;
  }
}

// NREL primary -> HIFLD fallback. Short-circuits: no HIFLD call when NREL succeeds.
async function getElectricData(lat, lng) {
  return (await getElectricFromNREL(lat, lng)) || (await getElectricFromHIFLD(lat, lng));
}

// driveOrigin is the cell centroid string ("lat,lng") when a cell is present;
// drive time is cell-shared via cellDriveOpts (FR-058), never a Google call here.
async function getEvChargingData(lat, lng, driveOrigin, getDriveTime, cell = null) {
  try {
    const url =
      `${NREL_BASE}/alt-fuel-stations/v1/nearest.json?api_key=${nrelKey()}` +
      `&latitude=${lat}&longitude=${lng}&fuel_type=ELEC&radius=infinite&limit=20&status=E&access=public`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
    if (!resp.ok) return null;
    const data = await resp.json();
    const stations = Array.isArray(data?.fuel_stations) ? data.fuel_stations : [];

    const nearestOf = (predicate) =>
      stations.filter(predicate)
        .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9))[0] || null;

    const rawL2 = nearestOf((s) => Number(s.ev_level2_evse_num) > 0);
    const rawDC = nearestOf((s) => Number(s.ev_dc_fast_num) > 0);

    const shape = async (s) => {
      if (!s) return null;
      let driveTimeMinutes = null;
      try {
        driveTimeMinutes = await getDriveTime(driveOrigin, { lat: s.latitude, lng: s.longitude }, cellDriveOpts(cell));
      } catch (err) {
        console.warn('[NREL EV drive time]', err?.message); // non-safety dest: degrade to distance only
      }
      const distanceMiles = s.distance != null
        ? Number(s.distance).toFixed(1)
        : haversineDistance(lat, lng, s.latitude, s.longitude).toFixed(1);
      return {
        name: String(s.station_name || 'Charging station').trim(),
        address: String(s.street_address || '').trim(),
        driveTimeMinutes,
        distanceMiles,
      };
    };

    const [level2, dcFast] = await Promise.all([shape(rawL2), shape(rawDC)]);
    return { level2, dcFast };
  } catch (err) {
    console.error('[NREL Alt Fuel Stations]', err.message);
    return null;
  }
}

// Cell-cached entry point (FR-058 parity). Warm cell -> zero NREL calls.
// Searches from the cell centroid so every address in a cell shares one fetch.
async function getUtilitiesData(lat, lng, originLatLng, getDriveTime, cell = null) {
  const cacheKey = cell ? `utilities:${cell.cellId}` : `utilities:${originLatLng}`;
  const cached = utilitiesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] utilities:', cacheKey); return cached; }

  const searchOrigin = cellSearchOrigin(originLatLng, cell); // "lat,lng" string
  const [sLat, sLng] = searchOrigin.split(',').map((n) => parseFloat(n));

  const [electricRes, evRes] = await Promise.allSettled([
    getElectricData(sLat, sLng),
    getEvChargingData(sLat, sLng, searchOrigin, getDriveTime, cell),
  ]);
  const result = {
    electric:   electricRes.status === 'fulfilled' ? electricRes.value : null,
    evCharging: evRes.status       === 'fulfilled' ? evRes.value       : null,
  };
  // Don't cache a total miss (both null) for the full 30-day TTL — a transient
  // NREL outage on a cold call would otherwise blank this cell for a month.
  // Re-fetch next request instead; a partial result (one side present) is cached.
  if (result.electric !== null || result.evCharging !== null) {
    utilitiesCache.set(cacheKey, result);
  }
  return result;
}

module.exports = { getElectricFromNREL, getElectricFromHIFLD, getElectricData, getEvChargingData, getUtilitiesData };
