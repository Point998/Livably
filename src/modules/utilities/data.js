'use strict';

const { haversineDistance } = require('../../utils/geo');
const { cellSearchOrigin, cellDriveOpts } = require('../../shared/spatial');
const { utilitiesCache } = require('../../cache');
const { HIFLD_TERRITORIES_URL, BROADBAND_TECH_CODES } = require('../../utils/constants');

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
async function getEvFromNREL(lat, lng, driveOrigin, getDriveTime, cell = null) {
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
    if (!level2 && !dcFast) return null;
    return { level2, dcFast, source: 'NREL' };
  } catch (err) {
    console.error('[NREL Alt Fuel Stations]', err.message);
    return null;
  }
}

// Fallback: OpenChargeMap. Optional key; null without it (degrade to link fallback).
async function getEvFromOpenChargeMap(lat, lng, driveOrigin, getDriveTime, cell = null) {
  const key = process.env.OPENCHARGEMAP_API_KEY;
  if (!key) return null;
  try {
    const params = new URLSearchParams({
      output: 'json', latitude: String(lat), longitude: String(lng),
      distance: '25', distanceunit: 'Miles', maxresults: '20', key,
    });
    const resp = await fetch(`https://api.openchargemap.io/v3/poi/?${params}`, {
      signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return null;
    const pois = await resp.json();
    if (!Array.isArray(pois) || !pois.length) return null;
    const conns = (p) => Array.isArray(p.Connections) ? p.Connections : [];
    const isDC = (p) => conns(p).some((c) => c.LevelID === 3 || c.Level?.IsFastChargeCapable === true);
    const isL2 = (p) => conns(p).some((c) => c.LevelID === 2 || c.Level?.ID === 2);
    const nearest = (pred) => pois.filter(pred).sort((a, b) => (a.AddressInfo?.Distance ?? 1e9) - (b.AddressInfo?.Distance ?? 1e9))[0] || null;
    const shape = async (p) => {
      if (!p) return null;
      const ai = p.AddressInfo || {};
      let driveTimeMinutes = null;
      try {
        driveTimeMinutes = await getDriveTime(driveOrigin, { lat: ai.Latitude, lng: ai.Longitude }, cellDriveOpts(cell));
      } catch (err) {
        console.warn('[OCM EV drive time]', err?.message);
      }
      const distanceMiles = ai.Distance != null
        ? Number(ai.Distance).toFixed(1)
        : haversineDistance(lat, lng, ai.Latitude, ai.Longitude).toFixed(1);
      return {
        name: String(ai.Title || 'Charging station').trim(),
        address: String(ai.AddressLine1 || '').trim(),
        driveTimeMinutes,
        distanceMiles,
      };
    };
    const [level2, dcFast] = await Promise.all([shape(nearest(isL2)), shape(nearest(isDC))]);
    if (!level2 && !dcFast) return null;
    return { level2, dcFast, source: 'OpenChargeMap' };
  } catch (err) {
    console.error('[OpenChargeMap]', err.message);
    return null;
  }
}

// NREL primary -> OpenChargeMap fallback.
async function getEvChargingData(lat, lng, driveOrigin, getDriveTime, cell = null) {
  return (await getEvFromNREL(lat, lng, driveOrigin, getDriveTime, cell))
      || (await getEvFromOpenChargeMap(lat, lng, driveOrigin, getDriveTime, cell));
}

// FR-061: FCC National Broadband Map (keyless). Relocated from the Property
// chapter — internet is treated as a utility. Returns advertised availability
// only; the "felt" band is computed in logic.js. No category field here.
async function getBroadbandData(lat, lng) {
  try {
    const url =
      `https://broadbandmap.fcc.gov/api/public/map/listAvailability` +
      `?latitude=${lat}&longitude=${lng}&unit=location&limit=25&category=residential`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
    if (!resp.ok) return null;
    const data = await resp.json();
    const availability =
      Array.isArray(data?.availability) ? data.availability :
      Array.isArray(data?.data)         ? data.data         :
      Array.isArray(data)               ? data              : [];
    if (!availability.length) return null;

    let maxDownload = 0;
    let hasFiber = false;
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
    return { providers: providers.slice(0, 5), maxDownloadMbps: maxDownload, hasFiber };
  } catch (err) {
    console.error('[FCC Broadband]', err.message);
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

  const [electricRes, evRes, internetRes] = await Promise.allSettled([
    getElectricData(sLat, sLng),
    getEvChargingData(sLat, sLng, searchOrigin, getDriveTime, cell),
    getBroadbandData(sLat, sLng),
  ]);
  const result = {
    electric:   electricRes.status === 'fulfilled' ? electricRes.value : null,
    evCharging: evRes.status       === 'fulfilled' ? evRes.value       : null,
    internet:   internetRes.status === 'fulfilled' ? internetRes.value : null,
  };
  // Don't cache a total miss (all null) for the full 30-day TTL — a transient
  // outage on a cold call would otherwise blank this cell for a month.
  // Re-fetch next request instead; a partial result (one side present) is cached.
  if (result.electric !== null || result.evCharging !== null || result.internet !== null) {
    utilitiesCache.set(cacheKey, result);
  }
  return result;
}

module.exports = { getElectricFromNREL, getElectricFromHIFLD, getElectricData, getEvFromNREL, getEvFromOpenChargeMap, getEvChargingData, getBroadbandData, getUtilitiesData };
