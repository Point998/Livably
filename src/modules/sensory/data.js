'use strict';

const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { fetchCensusACS } = require('../../shared/census');
const { haversineDistance } = require('../../utils/geo');
const {
  NON_AIRPORT_RE, AIRPORT_RE,
  AIRPORT_SEARCH_RADIUS_M, AIRPORT_MAX_DISTANCE_MILES,
  OSM_ROAD_NOISE_RADIUS_M, OSM_RAIL_RADIUS_M, OSM_LANDUSE_RADIUS_M,
  WATER_QUALITY_SEARCH_RADIUS_MILES,
  OVERPASS_ENDPOINTS,
} = require('../../utils/constants');
const { safeInt } = require('../../utils/text');
const { getAQICategory, interpretFloodZone, estimateDNLFromRoad, getDNLCategory, estimateBortle, getBortleDescription, getRadonZone } = require('./logic');

// ── FR-027: Sensory & Environmental (supersedes FR-019) ──────────────────────

async function getEnvironmentalData(lat, lng, _highwayDriveMinutes, fips) {
  const [airResult, floodResult, airportsResult, roadNoiseResult, railResult, lightResult, waterResult, radonResult, ejResult] =
    await Promise.allSettled([
      getAirQuality(lat, lng),
      getFloodRisk(lat, lng),
      getAirportData(lat, lng),
      getRoadNoise(lat, lng),
      getRailProximity(lat, lng),
      getLightPollution(lat, lng, fips),
      getWaterQuality(lat, lng),
      Promise.resolve(getRadonZone(fips)),
      getEJScreen(lat, lng),
    ]);
  const v = (r) => (r.status === 'fulfilled' ? r.value : null);
  let roadNoise = v(roadNoiseResult);
  if (!roadNoise && _highwayDriveMinutes != null) {
    const estDnl = _highwayDriveMinutes <= 5 ? 65 : _highwayDriveMinutes <= 15 ? 55 : 45;
    roadNoise = { dnl: estDnl, source: 'estimated from highway proximity', category: getDNLCategory(estDnl), nearestRoad: null };
  }
  return {
    _homeLat:       lat,
    _homeLng:       lng,
    airQuality:     v(airResult),
    floodRisk:      v(floodResult),
    airports:       v(airportsResult),
    roadNoise,
    rail:           v(railResult),
    lightPollution: v(lightResult),
    waterQuality:   v(waterResult),
    radon:          v(radonResult),
    ejscreen:       v(ejResult),
  };
}

// Air quality ─────────────────────────────────────────────────────────────────

async function getAirQuality(lat, lng) {
  const apiKey = process.env.AIRNOW_API_KEY;
  if (!apiKey) return null;
  const url =
    `https://www.airnowapi.org/aq/observation/latLong/current/` +
    `?format=application/json&latitude=${lat}&longitude=${lng}&distance=25&API_KEY=${apiKey}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!Array.isArray(data) || !data.length) return null;
  const maxAQI = Math.max(...data.map((d) => d.AQI));
  const primary = data.find((d) => d.AQI === maxAQI);
  return { aqi: maxAQI, category: getAQICategory(maxAQI), primaryPollutant: primary?.ParameterName || 'N/A' };
}

// Flood risk (FEMA NFHL) ──────────────────────────────────────────────────────

async function getFloodRisk(lat, lng) {
  const url =
    `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query` +
    `?geometry=${lng},${lat}&geometryType=esriGeometryPoint` +
    `&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,STUDY_TYP&returnGeometry=false&f=json`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data.features?.length) return { zone: 'X', risk: 'Minimal', insuranceRequired: false, description: 'Outside high-risk flood areas.' };
  const zone = data.features[0].attributes?.FLD_ZONE || 'X';
  return { zone, ...interpretFloodZone(zone) };
}

// Airport analysis (Google Places) ───────────────────────────────────────────

async function getAirportData(lat, lng) {
  const resp = await googleMapsClient.placesNearby({
    params: { key: googleMapsApiKey, location: `${lat},${lng}`, radius: AIRPORT_SEARCH_RADIUS_M, type: 'airport' },
  });
  const airports = (resp.data.results || [])
    .filter((p) => !NON_AIRPORT_RE.test(p.name) && AIRPORT_RE.test(p.name))
    .map((p) => ({
      name: p.name,
      distanceMiles: haversineDistance(lat, lng, p.geometry.location.lat, p.geometry.location.lng),
      lat: p.geometry.location.lat,
      lng: p.geometry.location.lng,
    }))
    .filter((a) => a.distanceMiles <= AIRPORT_MAX_DISTANCE_MILES)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
  return airports.length ? airports : null;
}

// Road noise (BTS GIS → OSM fallback) ────────────────────────────────────────

async function getRoadNoise(lat, lng) {
  try {
    const url =
      `https://gis.bts.gov/arcgis/rest/services/National_Transportation_Noise_Map/MapServer/0/query` +
      `?geometry=${lng},${lat}&geometryType=esriGeometryPoint` +
      `&spatialRel=esriSpatialRelIntersects&outFields=DNL_RD&returnGeometry=false&f=json`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (resp.ok) {
      const data = await resp.json();
      const dnl = data.features?.[0]?.attributes?.DNL_RD;
      if (dnl != null && dnl > 0) {
        return { dnl: Math.round(dnl), source: 'BTS', category: getDNLCategory(dnl), nearestRoad: null };
      }
    }
  } catch {}
  try {
    return await getRoadNoiseOSM(lat, lng);
  } catch {
    return null;
  }
}

async function fetchOverpass(query, timeoutMs = 15000) {
  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    const base = OVERPASS_ENDPOINTS[i];
    try {
      const resp = await fetch(
        `${base}?data=${encodeURIComponent(query)}`,
        { signal: AbortSignal.timeout(timeoutMs) },
      );
      if (resp.ok) return resp;
      // 429 = rate limited, 406 = blocked — try next endpoint after brief pause
      if (resp.status === 429 || resp.status === 406) {
        if (i < OVERPASS_ENDPOINTS.length - 1) await new Promise((r) => setTimeout(r, 300));
      }
    } catch {}
  }
  return null;
}

async function getRoadNoiseOSM(lat, lng) {
  const query =
    `[out:json][timeout:15];` +
    `(way(around:${OSM_ROAD_NOISE_RADIUS_M},${lat},${lng})["highway"~"motorway|trunk|primary|secondary"];);` +
    `out center tags;`;
  const resp = await fetchOverpass(query, 16000);
  if (!resp) return null;
  const data = await resp.json();
  const roads = (data.elements || [])
    .filter((el) => el.center || (el.lat && el.lon))
    .map((el) => ({
      highway:      el.tags?.highway || 'road',
      name:         el.tags?.name || el.tags?.ref || null,
      distanceMiles: haversineDistance(lat, lng, el.center?.lat ?? el.lat, el.center?.lon ?? el.lon),
    }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles);

  if (!roads.length) return { dnl: 40, source: 'estimated', category: getDNLCategory(40), nearestRoad: null };
  const nearest = roads[0];
  const dnl = estimateDNLFromRoad(nearest.highway, nearest.distanceMiles);
  return { dnl, source: 'estimated', category: getDNLCategory(dnl), nearestRoad: nearest };
}

// Rail proximity (OSM Overpass) ───────────────────────────────────────────────

async function getRailProximity(lat, lng) {
  try {
    const query =
      `[out:json][timeout:15];` +
      `(way(around:${OSM_RAIL_RADIUS_M},${lat},${lng})["railway"~"rail|light_rail|tram"];);` +
      `out center tags;`;
    const resp = await fetchOverpass(query, 16000);
    if (!resp) return null;
    const data = await resp.json();
    const lines = (data.elements || [])
      .filter((el) => el.center || (el.lat != null && el.lon != null))
      .map((el) => ({
        type:          el.tags?.railway || 'rail',
        name:          el.tags?.name || el.tags?.operator || el.tags?.ref || null,
        distanceMiles: haversineDistance(lat, lng, el.center?.lat ?? el.lat, el.center?.lon ?? el.lon),
      }))
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
    return lines.length ? lines[0] : null;
  } catch {
    return null;
  }
}

// Light pollution (Census pop density + OSM landuse proxy) ────────────────────

async function getLightPollution(lat, lng, fips) {
  const [acsResult, osmResult] = await Promise.allSettled([
    fips ? fetchCensusACS(fips, ['B01003_001E']) : Promise.resolve(null),
    fetchLanduseOSM(lat, lng),
  ]);
  const acs = acsResult.status === 'fulfilled' ? acsResult.value : null;
  const population = acs ? safeInt(acs.get('B01003_001E')) : null;
  const landuse = osmResult.status === 'fulfilled' ? osmResult.value : null;
  return estimateBortle(population, landuse);
}

async function fetchLanduseOSM(lat, lng) {
  const query = `[out:json][timeout:10];(way(around:${OSM_LANDUSE_RADIUS_M},${lat},${lng})["landuse"];);out center tags 10;`;
  const resp = await fetchOverpass(query, 11000);
  if (!resp) return null;
  const d = await resp.json();
  const uses = (d.elements || []).map((el) => el.tags?.landuse).filter(Boolean);
  if (uses.some((u) => ['commercial', 'industrial', 'retail'].includes(u))) return 'commercial';
  if (uses.includes('residential')) return 'residential';
  if (uses.some((u) => ['farmland', 'forest', 'meadow', 'grass', 'orchard'].includes(u))) return 'rural';
  return null;
}

// Water quality (EPA ECHO / SDWIS) ────────────────────────────────────────────

async function getWaterQuality(lat, lng) {
  // Uses EPA ECHO SDW REST services — verify endpoint if returning null; sdw_rest_services may be deprecated
  try {
    const facResp = await fetch(
      `https://echodata.epa.gov/echo/sdw_rest_services.get_facilities` +
      `?output=JSON&p_lat=${lat}&p_long=${lng}&p_radius=${WATER_QUALITY_SEARCH_RADIUS_MILES}&p_wt_type=CWS`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!facResp.ok) return null;
    const facData = await facResp.json();
    const systems =
      facData?.Results?.Water_Systems ||
      facData?.results?.water_systems ||
      [];
    if (!systems.length) return null;

    const sys = systems[0];
    const pwsId   = sys.pws_id   || sys.PWS_ID;
    const pwsName = sys.pws_name || sys.PWS_NAME || 'Public water system';
    if (!pwsId) return { systemName: pwsName, violations: [] };

    const vResp = await fetch(
      `https://echodata.epa.gov/echo/sdw_rest_services.get_violations` +
      `?output=JSON&p_id=${encodeURIComponent(pwsId)}`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!vResp.ok) return { systemName: pwsName, violations: [] };
    const vData = await vResp.json();

    const cutoff = new Date().getFullYear() - 5;
    const rawViolations =
      vData?.Results?.Violations ||
      vData?.results?.violations ||
      vData?.Results?.SDW_Violations ||
      [];
    const violations = rawViolations
      .filter((v) => {
        const dateStr =
          v.compl_per_begin_date || v.COMPL_PER_BEGIN_DATE ||
          v.compl_per_end_date   || v.COMPL_PER_END_DATE   || '';
        const yr = parseInt(dateStr.slice(0, 4), 10);
        return !yr || yr >= cutoff;
      })
      .map((v) => ({
        type: v.violation_code_desc || v.VIOLATION_CODE_DESCRIPTION ||
              v.viol_code_desc      || v.contaminant_code           || 'Violation',
        date: v.compl_per_begin_date || v.COMPL_PER_BEGIN_DATE || null,
        status: v.violation_status   || v.VIOLATION_STATUS     || 'Unknown',
      }));

    return { systemName: pwsName, pwsId, violations };
  } catch {
    return null;
  }
}

// EPA EJSCREEN ────────────────────────────────────────────────────────────────

async function getEJScreen(lat, lng) {
  try {
    // EJSCREEN REST broker (ejscreen.epa.gov — verify URL if this returns null; domain may migrate)
    const geom = encodeURIComponent(JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }));
    const resp = await fetch(
      `https://ejscreen.epa.gov/mapper/ejscreenRESTbroker.aspx` +
      `?namestr=&geometry=${geom}&distance=1&unit=9035&areatype=&areaid=&f=pjson`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    // Response can be { features: [{ attributes: {...} }] } or flat { PNPL: ... }
    const a = data?.features?.[0]?.attributes ?? data?.data ?? data;
    if (!a || typeof a !== 'object') return null;
    // Field names vary by API version: PNPL / P_PNPL / NPL_CNT_PCTILE / superfund_pctile
    const pnpl  = parseFloat(
      a.PNPL ?? a.P_PNPL ?? a.NPL_CNT_PCTILE ?? a.D2_PNPL ?? 0,
    ) || 0;
    const prmp  = parseFloat(
      a.PRMP ?? a.P_PRMP ?? a.RMP_CNT_PCTILE ?? a.D2_PRMP ?? 0,
    ) || 0;
    const ptsdf = parseFloat(
      a.PTSDF ?? a.P_PTSDF ?? a.TSDF_CNT_PCTILE ?? a.D2_PTSDF ?? 0,
    ) || 0;
    // If all values are 0 the API likely returned an empty/error result
    if (pnpl === 0 && prmp === 0 && ptsdf === 0 && !data?.features?.length) return null;
    return {
      superfundPct: Math.round(pnpl),
      rmpPct:       Math.round(prmp),
      tsdfPct:      Math.round(ptsdf),
      flagged:      pnpl > 75 || prmp > 75 || ptsdf > 75,
    };
  } catch {
    return null;
  }
}

const SOURCES = [
  { id: 'airnow-aqi', label: 'AirNow API current AQI', provider: 'airnow', coverage: 'some', requiresKey: 'AIRNOW_API_KEY',
    run: (ctx) => getAirQuality(ctx.lat, ctx.lng),
    isValid: (r) => r !== null && typeof r?.aqi === 'number' },
  { id: 'fema-flood', label: 'FEMA NFHL flood zone', provider: 'fema', coverage: 'all',
    run: (ctx) => getFloodRisk(ctx.lat, ctx.lng),
    isValid: (r) => r !== null && typeof r?.zone === 'string' },
  { id: 'google-places-airports', label: 'Google Places (airports within 20 miles)', provider: 'google', coverage: 'some',
    run: (ctx) => getAirportData(ctx.lat, ctx.lng),
    isValid: (r) => Array.isArray(r) && r.length > 0,
    probe: async (ctx) => { const { googleMapsApiKey } = require('../../shared/google/client'); const resp = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${ctx.lat},${ctx.lng}&radius=1000&type=restaurant&key=${googleMapsApiKey}`, { signal: AbortSignal.timeout(8000) }); return resp.status; } },
  { id: 'bts-road-noise', label: 'BTS National Transportation Noise Map (OSM fallback)', provider: 'bts', coverage: 'all',
    run: (ctx) => getRoadNoise(ctx.lat, ctx.lng),
    isValid: (r) => r !== null && typeof r?.dnl === 'number' },
  { id: 'osm-rail', label: 'OSM Overpass rail proximity', provider: 'osm', coverage: 'some',
    run: (ctx) => getRailProximity(ctx.lat, ctx.lng),
    isValid: (r) => r !== null && typeof r?.distanceMiles === 'number',
    probe: async (ctx) => { const base = OVERPASS_ENDPOINTS[0]; const q = encodeURIComponent(`[out:json][timeout:5];(way(around:100,${ctx.lat},${ctx.lng})["railway"~"rail"];);out 1;`); const resp = await fetch(`${base}?data=${q}`, { signal: AbortSignal.timeout(8000) }); return resp.status; } },
  { id: 'census-acs-lightpollution', label: 'Census ACS5 population (Bortle estimate)', provider: 'census', coverage: 'all', requiresKey: 'CENSUS_API_KEY',
    run: (ctx) => getLightPollution(ctx.lat, ctx.lng, ctx.fips),
    isValid: (r) => r !== null && typeof r?.bortle === 'number' },
  { id: 'osm-landuse', label: 'OSM Overpass land use (light pollution context)', provider: 'osm', coverage: 'some',
    run: (ctx) => fetchLanduseOSM(ctx.lat, ctx.lng),
    isValid: (r) => r !== null,
    probe: async (ctx) => { const base = OVERPASS_ENDPOINTS[0]; const q = encodeURIComponent(`[out:json][timeout:5];(way(around:100,${ctx.lat},${ctx.lng})["landuse"];);out 1;`); const resp = await fetch(`${base}?data=${q}`, { signal: AbortSignal.timeout(8000) }); return resp.status; } },
  { id: 'epa-echo-water', label: 'EPA ECHO SDWIS water quality', provider: 'epa', coverage: 'some',
    run: (ctx) => getWaterQuality(ctx.lat, ctx.lng),
    isValid: (r) => r !== null && typeof r?.systemName === 'string' },
  { id: 'epa-ejscreen', label: 'EPA EJScreen environmental indicators', provider: 'epa', coverage: 'all',
    run: (ctx) => getEJScreen(ctx.lat, ctx.lng),
    isValid: (r) => r !== null && typeof r?.superfundPct === 'number' },
];

module.exports = {
  getEnvironmentalData,
  getAirQuality,
  getAQICategory,
  getFloodRisk,
  getAirportData,
  getRoadNoise,
  getRailProximity,
  getLightPollution,
  fetchLanduseOSM,
  getWaterQuality,
  getRadonZone,
  getEJScreen,
  getDNLCategory,
  getBortleDescription,
  SOURCES,
};
