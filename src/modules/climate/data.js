'use strict';

const path = require('path');
const fs   = require('fs');
const { logError } = require('../../logger');
const {
  NOAA_CDO_BASE_URL, NOAA_CDO_NORMALS_DATASET, NOAA_CDO_NORMALS_ANN,
  NOAA_STATION_SEARCH_RADII,
  FEMA_DECLARATIONS_URL,
  CLIMATE_STORM_LOOKBACK_YEARS, CLIMATE_FEMA_LOOKBACK_YEARS,
  WATERSHED_CELL_RESOLUTION,
  SEISMIC_DESIGNMAPS_URL,
  OPEN_METEO_ARCHIVE_URL, CLIMATE_NORMALS_MODEL_PERIOD,
} = require('../../utils/constants');
const { snapToCellAtResolution } = require('../../shared/spatial');
const { sourceChain } = require('../../shared/sourceChain');
const { fetchElevationsFeet, fetchElevationWithRetry } = require('../../shared/elevation');
const { watershedCache, seismicCache } = require('../../cache');
const {
  getEmergencySystem,
  getLastSignificantEvent,
  computeRarityStatement,
  classifyTopographicPosition,
  getSeismicContext,
} = require('./logic');

// ── FR-043: API helpers ───────────────────────────────────────────────────────

// getNOAAStormEvents — 3-tier strategy
// Tier 1: NOAA CDO API (does not have storm event narratives — returns [] immediately)
// Tier 2: Pre-cached JSON for known counties
// Tier 3: Returns [] — template renders graceful fallback link
async function getNOAAStormEvents(stateFips, countyFips) {
  // Tier 2: Pre-cached JSON
  if (stateFips && countyFips) {
    try {
      const file = path.join(__dirname, '..', '..', '..', 'data', 'noaa-storm-events', `${stateFips}-${countyFips}.json`);
      if (fs.existsSync(file)) {
        const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
        return cached.events || [];
      }
    } catch {
      // fall through to Tier 3
    }
  }
  // Tier 3: empty — template renders graceful degradation link
  return [];
}

async function getNOAAClimateNormals(lat, lng) {
  const key = process.env.NOAA_CDO_API_KEY;
  if (!key) return null;

  try {
    // Progressive radius expansion: ~25 mi, ~50 mi, ~100 mi.
    // For each radius, try up to 5 candidate stations until one has real TMAX records.
    // NOAA station metadata can claim MLY-TMAX-NORMAL support but actual data may be absent.
    const RADII = NOAA_STATION_SEARCH_RADII;
    for (const radius of RADII) {
      const stationParams = new URLSearchParams({
        datasetid: NOAA_CDO_NORMALS_DATASET,
        datatypeid: 'MLY-TMAX-NORMAL',
        extent: `${(lat - radius).toFixed(4)},${(lng - radius).toFixed(4)},${(lat + radius).toFixed(4)},${(lng + radius).toFixed(4)}`,
        limit: 5,
      });
      const stResp = await fetch(`${NOAA_CDO_BASE_URL}/stations?${stationParams}`, {
        headers: { token: key },
        signal: AbortSignal.timeout(8000),
      });
      if (!stResp.ok) continue;
      const stData = await stResp.json();
      if (!stData.results?.length) continue;

      for (const candidate of stData.results) {
        // Fetch monthly normals for this candidate
        const normParams = new URLSearchParams({
          datasetid: NOAA_CDO_NORMALS_DATASET,
          stationid: candidate.id,
          datatypeid: 'MLY-TMAX-NORMAL,MLY-TMIN-NORMAL,MLY-PRCP-NORMAL,MLY-SNOW-NORMAL',
          startdate: '2010-01-01',
          enddate: '2010-12-31',
          limit: 100,
        });
        const normResp = await fetch(`${NOAA_CDO_BASE_URL}/data?${normParams}`, {
          headers: { token: key },
          signal: AbortSignal.timeout(10000),
        });
        if (!normResp.ok) continue;
        const normData = await normResp.json();
        if (!normData.results?.length) continue;
        // Skip stations whose records lack actual temperature data
        if (!normData.results.some((r) => r.datatype === 'MLY-TMAX-NORMAL')) continue;

        // Pivot into monthly rows
        const byMonth = {};
        for (const r of normData.results) {
          const month = parseInt(r.date.slice(5, 7), 10);
          if (!byMonth[month]) byMonth[month] = {};
          byMonth[month][r.datatype] = r.value;
        }
        const monthly = Array.from({ length: 12 }, (_, i) => {
          const m = byMonth[i + 1] || {};
          // NOAA CDO units: temps in tenths of °F, precip in hundredths of inches, snow in tenths of inches
          return {
            month: i + 1,
            tMaxF: m['MLY-TMAX-NORMAL'] != null ? m['MLY-TMAX-NORMAL'] / 10 : null,
            tMinF: m['MLY-TMIN-NORMAL'] != null ? m['MLY-TMIN-NORMAL'] / 10 : null,
            precipIn: m['MLY-PRCP-NORMAL'] != null ? m['MLY-PRCP-NORMAL'] / 100 : null,
            snowIn: m['MLY-SNOW-NORMAL'] != null ? m['MLY-SNOW-NORMAL'] / 10 : null,
          };
        });

        // Annual normals (optional — best-effort)
        const annParams = new URLSearchParams({
          datasetid: NOAA_CDO_NORMALS_ANN,
          stationid: candidate.id,
          datatypeid: 'ANN-TMAX-AVGNDS-GRTH090,ANN-TMAX-AVGNDS-GRTH095,ANN-TMIN-AVGNDS-LSTH032',
          startdate: '2010-01-01',
          enddate: '2010-12-31',
          limit: 10,
        });
        let annual = { daysAbove90: null, daysAbove95: null, daysBelow32: null };
        try {
          const annResp = await fetch(`${NOAA_CDO_BASE_URL}/data?${annParams}`, {
            headers: { token: key },
            signal: AbortSignal.timeout(8000),
          });
          if (annResp.ok) {
            const annData = await annResp.json();
            for (const r of (annData.results || [])) {
              if (r.datatype === 'ANN-TMAX-AVGNDS-GRTH090') annual.daysAbove90 = r.value;
              if (r.datatype === 'ANN-TMAX-AVGNDS-GRTH095') annual.daysAbove95 = r.value;
              if (r.datatype === 'ANN-TMIN-AVGNDS-LSTH032') annual.daysBelow32 = r.value;
            }
          }
        } catch { /* annual normals are optional */ }

        return { monthly, annual, stationId: candidate.id, stationName: candidate.name };
      }
    }

    return null;
  } catch {
    return null;
  }
}

// FR-065 — Open-Meteo ERA5 modeled-normals fallback.
// Pure transform: a daily ERA5 series (already °F / inch — NO tenths division,
// unlike the NOAA CDO path) aggregated into the same normals contract NOAA returns.
function aggregateOpenMeteoNormals(daily) {
  const time = daily?.time || [];
  const tmax = daily?.temperature_2m_max || [];
  const tmin = daily?.temperature_2m_min || [];
  const prcp = daily?.precipitation_sum || [];
  const snow = daily?.snowfall_sum || [];

  const monMax  = Array.from({ length: 12 }, () => []);   // daily values per month
  const monMin  = Array.from({ length: 12 }, () => []);
  const monPrcp = Array.from({ length: 12 }, () => ({}));  // year -> monthly total
  const monSnow = Array.from({ length: 12 }, () => ({}));
  const years = new Set();
  let daysAbove90 = 0, daysAbove95 = 0, daysBelow32 = 0;

  for (let i = 0; i < time.length; i++) {
    const d = time[i];
    if (!d) continue;
    const year = d.slice(0, 4);
    const mi = parseInt(d.slice(5, 7), 10) - 1;
    if (mi < 0 || mi > 11) continue;
    years.add(year);
    const mx = tmax[i], mn = tmin[i], pr = prcp[i], sn = snow[i];
    if (mx != null) { monMax[mi].push(mx); if (mx >= 90) daysAbove90++; if (mx >= 95) daysAbove95++; }
    if (mn != null) { monMin[mi].push(mn); if (mn <= 32) daysBelow32++; }
    if (pr != null) { monPrcp[mi][year] = (monPrcp[mi][year] || 0) + pr; }
    if (sn != null) { monSnow[mi][year] = (monSnow[mi][year] || 0) + sn; }
  }

  const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const meanOfTotals = (obj) => { const v = Object.values(obj); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
  const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

  const monthly = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    tMaxF: round1(mean(monMax[i])),
    tMinF: round1(mean(monMin[i])),
    precipIn: round2(meanOfTotals(monPrcp[i])),
    snowIn: round2(meanOfTotals(monSnow[i])),
  }));

  const yearCount = years.size || 1;
  const annual = {
    daysAbove90: Math.round(daysAbove90 / yearCount),
    daysAbove95: Math.round(daysAbove95 / yearCount),
    daysBelow32: Math.round(daysBelow32 / yearCount),
  };

  return { monthly, annual, stationId: null, stationName: 'Modeled climatology (Open-Meteo, 1991–2020)' };
}

// Fetches the ERA5 daily series for the normals period and aggregates it.
// Keyless; returns null on any failure (→ chain falls to the link floor).
async function getNormalsFromModel(lat, lng) {
  try {
    const { start, end } = CLIMATE_NORMALS_MODEL_PERIOD;
    const params = new URLSearchParams({
      latitude: String(lat), longitude: String(lng),
      start_date: start, end_date: end,
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum',
      temperature_unit: 'fahrenheit', precipitation_unit: 'inch', timezone: 'auto',
    });
    const resp = await fetch(`${OPEN_METEO_ARCHIVE_URL}?${params}`, {
      signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data?.daily?.time?.length) return null;
    return aggregateOpenMeteoNormals(data.daily);
  } catch (err) {
    logError('getNormalsFromModel', `${lat},${lng}`, err);
    return null;
  }
}

// FR-065 — climate-normals source chain: NOAA station normals (authoritative) →
// Open-Meteo modeled climatology (regional, keyless) → null (link floor). The
// validity predicate enforces real temperature records on BOTH tiers (CONSTRAINT-016).
async function getClimateNormals(lat, lng) {
  const hasRealNormals = (r) => Array.isArray(r?.monthly) && r.monthly.some((m) => m.tMaxF != null);
  const picked = await sourceChain([
    { name: 'NOAA',  run: () => getNOAAClimateNormals(lat, lng) },
    { name: 'model', run: () => getNormalsFromModel(lat, lng) },
  ], null, { label: 'climate-normals', isValid: hasRealNormals });
  if (!picked) return null;
  return { ...picked.value, normalsSource: picked.source };
}

const WBD_BASE = 'https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer';

// Query one WBD layer at a point; return the watershed unit's `name` or null.
async function queryWBDName(layer, lat, lng) {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'name',
    returnGeometry: 'false',
    f: 'json',
  });
  const resp = await fetch(`${WBD_BASE}/${layer}/query?${params}`, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data?.features?.[0]?.attributes?.name ?? null;
}

// getNamedWatershed(lat, lng) -> { huc12Name, basinName } | null
// Cell-cached (neighbors share one fetch). Queries WBD at the cell centroid so
// every address in the cell resolves to the same watershed. Layer 6 = HUC-12,
// layer 4 = HUC-8 basin.
async function getNamedWatershed(lat, lng) {
  const { cellId, centroid } = snapToCellAtResolution({ lat, lng }, WATERSHED_CELL_RESOLUTION);

  const cached = watershedCache.get(cellId);
  if (cached) return cached.huc12Name ? cached : null; // negatives cached as { huc12Name: null }

  try {
    const [huc12Name, basinName] = await Promise.all([
      queryWBDName(6, centroid.lat, centroid.lng),
      queryWBDName(4, centroid.lat, centroid.lng),
    ]);
    if (!huc12Name) {
      watershedCache.set(cellId, { huc12Name: null, basinName: null });
      return null;
    }
    const result = { huc12Name, basinName: basinName || null };
    watershedCache.set(cellId, result);
    return result;
  } catch {
    return null; // transient errors are not cached
  }
}

// Cell-cached (FR-058): USGS ASCE 7-16 seismic design values. Negatives cached
// as { pga: null } (mirrors getNamedWatershed); transient errors not cached.
async function getSeismicHazard(lat, lng) {
  const { cellId, centroid } = snapToCellAtResolution({ lat, lng }, WATERSHED_CELL_RESOLUTION);

  const cached = seismicCache.get(cellId);
  if (cached) return cached.pga != null ? cached : null;

  try {
    const url =
      `${SEISMIC_DESIGNMAPS_URL}?latitude=${centroid.lat}&longitude=${centroid.lng}` +
      `&riskCategory=II&siteClass=D&title=livably`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json' } });
    if (!resp.ok) return null; // transient — not cached
    const data = await resp.json();
    const d = data?.response?.data || {};
    const pga = Number(d.pga);
    if (!pga || isNaN(pga)) { seismicCache.set(cellId, { pga: null }); return null; }
    const result = { pga, ss: Number(d.ss) || null, s1: Number(d.s1) || null, sds: Number(d.sds) || null };
    seismicCache.set(cellId, result);
    return result;
  } catch {
    return null; // transient errors not cached
  }
}

async function getWatershedContext(lat, lng) {
  const offsets = [[0, 0], [0.0036, 0], [-0.0036, 0], [0, 0.0045], [0, -0.0045]];
  const points = offsets.map(([dlat, dlng]) => [lat + dlat, lng + dlng]);

  // FR-073 — resilient + observable: EPQS → OpenTopoData NED 10 m → null, with the
  // degradation recorded in the FR-068 ledger (was per-point logError only).
  const results = await fetchElevationsFeet(points);

  const centerElevation = results?.[0];
  if (centerElevation == null) return null;

  // Fill failed surrounding points with center elevation (flat-terrain approximation)
  const elevations = results.map((val, i) => (i === 0 ? centerElevation : (val ?? centerElevation)));

  return { elevations, position: classifyTopographicPosition(elevations) };
}

async function getFEMADeclarations(state, county) {
  if (!state || !county) return [];
  try {
    // FEMA county filter uses uppercase county name without "County" suffix
    const countyFilter = county.toUpperCase().replace(/\s*COUNTY\s*$/i, '').trim();
    const params = new URLSearchParams({
      '$filter': `stateCode eq '${state}' and designatedArea eq '${countyFilter} (C)'`,
      '$orderby': 'declarationDate desc',
      '$top': 50,
      '$format': 'json',
      '$select': 'declarationDate,declarationTitle,incidentType,disasterNumber',
    });
    const resp = await fetch(`${FEMA_DECLARATIONS_URL}?${params}`, {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - CLIMATE_FEMA_LOOKBACK_YEARS);
    return (data.DisasterDeclarationsSummaries || [])
      .filter((d) => new Date(d.declarationDate) >= cutoff)
      .map((d) => ({
        declarationDate: d.declarationDate,
        declarationTitle: d.declarationTitle,
        incidentType: d.incidentType,
        disasterNumber: d.disasterNumber,
      }));
  } catch {
    return [];
  }
}

async function getClimateHistoryData(lat, lng, locationInfo, fips) {
  const state      = locationInfo?.state  || null;
  const county     = locationInfo?.county || '';
  const stateFips  = fips?.state          || '';
  const countyFips = fips?.county         || '';

  const [stormResult, femaResult, normalsResult, watershedResult, namedResult, seismicResult] =
    await Promise.allSettled([
      getNOAAStormEvents(stateFips, countyFips),
      getFEMADeclarations(state, county),
      getClimateNormals(lat, lng),
      getWatershedContext(lat, lng),
      getNamedWatershed(lat, lng),
      getSeismicHazard(lat, lng),
    ]);

  const val = (r, fallback) => r.status === 'fulfilled' ? r.value : fallback;
  const allEvents  = val(stormResult, []);
  const femaAll    = val(femaResult, []);
  const normals    = val(normalsResult, null);
  const watershed  = val(watershedResult, null);
  const named      = val(namedResult, null);
  const seismic    = getSeismicContext(val(seismicResult, null));

  const tornadoes    = allEvents.filter((e) => /tornado/i.test(e.event_type || ''));
  const floods       = allEvents.filter((e) => /flood/i.test(e.event_type || ''));
  const winterStorms = allEvents.filter((e) => /winter|ice|blizzard|snow/i.test(e.event_type || ''));
  const heatEvents   = allEvents.filter((e) => /heat|drought/i.test(e.event_type || ''));

  const weatherTypes = new Set([
    'Tornado', 'Flood', 'Flash Flood', 'Severe Storm', 'Hurricane',
    'Ice Storm', 'Winter Storm', 'Blizzard', 'Excessive Heat', 'Drought',
    'Wildfire', 'Severe Ice Storm', 'Heavy Snow',
  ]);
  const femaWeather = femaAll.filter((d) => weatherTypes.has(d.incidentType));

  return {
    stormEvents: { tornadoes, floods, winterStorms, heatEvents, allEvents },
    femaDeclarations: {
      weatherRelated: femaWeather,
      all: femaAll,
      count: femaWeather.length,
    },
    climateNormals: normals,
    glance: {
      lastSignificantEvent: getLastSignificantEvent(femaWeather, allEvents),
    },
    preparedness: {
      emergencySystem: getEmergencySystem(state, county),
      roadPriority: null,
    },
    watershed: (watershed || named)
      ? {
          topographicPosition: watershed ? watershed.position : null,
          elevations: watershed ? watershed.elevations : null,
          named: named,
        }
      : null,
    seismic,
    basementContext: null, // populated post-resolution in getChapterData using propIntel.constructionEra
  };
}

const SOURCES = [
  { id: 'noaa-normals', label: 'NOAA CDO 30-yr normals', provider: 'noaa', coverage: 'all', requiresKey: 'NOAA_CDO_API_KEY',
    run: (ctx) => getNOAAClimateNormals(ctx.lat, ctx.lng),
    isValid: (r) => Array.isArray(r?.monthly) && r.monthly.length === 12 },
  { id: 'openmeteo-normals-fallback', label: 'Open-Meteo ERA5 modeled climate normals', provider: 'open-meteo', coverage: 'all',
    run: (ctx) => getNormalsFromModel(ctx.lat, ctx.lng),
    isValid: (r) => Array.isArray(r?.monthly) && r.monthly.some((m) => m.tMaxF != null) },
  { id: 'fema-declarations', label: 'FEMA disaster declarations', provider: 'fema', coverage: 'some',
    run: (ctx) => getFEMADeclarations(ctx.state, ctx.county),
    isValid: (r) => Array.isArray(r),
    probe: async () => { const resp = await fetch(`${FEMA_DECLARATIONS_URL}?$top=1&$format=json`, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } }); return resp.status; } },
  { id: 'usgs-elevation', label: 'USGS elevation (watershed context)', provider: 'usgs', coverage: 'all',
    run: (ctx) => getWatershedContext(ctx.lat, ctx.lng),
    isValid: (r) => Array.isArray(r?.elevations) && r.elevations.length > 0 },
  { id: 'usgs-watershed', label: 'USGS WBD named watershed', provider: 'usgs', coverage: 'some',
    run: (ctx) => getNamedWatershed(ctx.lat, ctx.lng),
    isValid: (r) => typeof r?.huc12Name === 'string',
    probe: async (ctx) => { const params = new URLSearchParams({ geometry: `${ctx.lng},${ctx.lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'name', returnGeometry: 'false', f: 'json' }); const resp = await fetch(`${WBD_BASE}/6/query?${params}`, { signal: AbortSignal.timeout(8000) }); return resp.status; } },
  { id: 'usgs-seismic', label: 'USGS ASCE seismic design', provider: 'usgs', coverage: 'all',
    run: (ctx) => getSeismicHazard(ctx.lat, ctx.lng),
    isValid: (r) => typeof r?.pga === 'number' },
];

module.exports = {
  getClimateHistoryData,
  getNOAAClimateNormals,
  getClimateNormals,
  getNormalsFromModel,
  aggregateOpenMeteoNormals,
  getNOAAStormEvents,
  getFEMADeclarations,
  getWatershedContext,
  fetchElevationWithRetry,
  getNamedWatershed,
  getSeismicHazard,
  queryWBDName,
  getEmergencySystem,
  getLastSignificantEvent,
  computeRarityStatement,
  classifyTopographicPosition,
  WBD_BASE,
  SOURCES,
};
