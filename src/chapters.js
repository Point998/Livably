'use strict';

// Chapter data module — FR-017 through FR-024

const { haversineDistance } = require('./utils/geo');
const { escapeHtml, formatMoney, safeInt } = require('./utils/text');
const {
  TORNADO_TIER,
  RADON_ZONE_BY_STATE,
  FROST_DATE_TABLE,
  NATIVE_PLANT_EXCLUDE, NATIVE_PLANT_EXCLUDE_NAMES,
  BENIGN_INTRODUCED, DOMESTIC_MAMMALS,
  OVERPASS_ENDPOINTS,
  NON_AIRPORT_RE, AIRPORT_RE,
  AIRPORT_SEARCH_RADIUS_M, AIRPORT_MAX_DISTANCE_MILES,
  FEMA_FLOOD_ZONES,
  OSM_ROAD_NOISE_RADIUS_M, OSM_RAIL_RADIUS_M, OSM_LANDUSE_RADIUS_M,
  WATER_QUALITY_SEARCH_RADIUS_MILES,
  INAT_NATIVE_PLANTS_RADIUS_KM, INAT_INVASIVE_PLANTS_RADIUS_KM,
  INAT_WILDLIFE_RADIUS_KM, INAT_BIRDS_RADIUS_KM,
  INAT_NATIVE_PLANTS_PER_PAGE, INAT_INVASIVE_PLANTS_PER_PAGE,
  INAT_WILDLIFE_PER_PAGE, INAT_BIRDS_PER_PAGE,
  INAT_REPTILES_RADIUS_KM, INAT_REPTILES_PER_PAGE,
  INAT_INSECTS_RADIUS_KM, INAT_INSECTS_PER_PAGE,
  INAT_BUTTERFLIES_RADIUS_KM, INAT_BUTTERFLIES_PER_PAGE,
  PLANT_GROWTH_FORMS, MONARCH_CORRIDOR_STATES, MILKWEED_BY_STATE, FIREFLY_STATES,
  GROCERY_SEARCH_RADIUS_M,
} = require('./utils/constants');

const { getCensusFIPS, fetchCensusACS } = require('./shared/census');
const { renderChapterCard } = require('./templates/components/chapterCard');
const { badgeClass } = require('./templates/components/badge');
const { logError } = require('./logger');
const {
  getGardenData,
  filterReptiles, filterInsects, filterButterflies,
  categorizeSeasonalBirds, categorizePlantsByForm,
  getMonarchCorridorInfo, getFireflyHabitat,
} = require('./modules/garden/data');
const { getDemographics, getDensityType } = require('./modules/community/data');
const { getWalkabilityScore } = require('./modules/walkability/data');
const { getEmergencyServices, getSafetyLocationContext } = require('./modules/safety/data');
const {
  getClimateHistoryData,
  getEmergencySystem,
  getLastSignificantEvent,
  computeRarityStatement,
  classifyTopographicPosition,
  getWatershedContext,
  fetchElevationWithRetry,
} = require('./modules/climate/data');
const { getPropertyData, getPropertyIntelligence } = require('./modules/property/data');
const { getGrowthAndDevelopment } = require('./modules/growth/data');

// ── FR-027: Sensory & Environmental (supersedes FR-019) ──────────────────────

async function getEnvironmentalData(lat, lng, _highwayDriveMinutes, fips, googleMapsClient, googleMapsApiKey) {
  const [airResult, floodResult, airportsResult, roadNoiseResult, railResult, lightResult, waterResult, radonResult, ejResult] =
    await Promise.allSettled([
      getAirQuality(lat, lng),
      getFloodRisk(lat, lng),
      googleMapsClient ? getAirportData(lat, lng, googleMapsClient, googleMapsApiKey) : Promise.resolve(null),
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

function getAQICategory(aqi) {
  if (aqi <= 50)  return { label: 'Good',                           color: 'green',  description: 'Air quality is satisfactory.' };
  if (aqi <= 100) return { label: 'Moderate',                       color: 'gold',   description: 'Acceptable for most people.' };
  if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups',  color: 'orange', description: 'May affect sensitive individuals.' };
  if (aqi <= 200) return { label: 'Unhealthy',                      color: 'red',    description: 'Everyone may experience health effects.' };
  return            { label: 'Very Unhealthy',                       color: 'red',    description: 'Health alert — everyone may be affected.' };
}

// ── Chapter 6: Climate & Weather Risks ───────────────────────────────────────

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

function interpretFloodZone(zone) {
  return FEMA_FLOOD_ZONES[zone] || { risk: 'Unknown', insuranceRequired: false, description: 'Flood zone data unavailable.' };
}

const { buildClimateChapterHTML } = require('./templates/chapters/climate');

// Airport analysis (Google Places) ───────────────────────────────────────────

async function getAirportData(lat, lng, googleMapsClient, googleMapsApiKey) {
  const resp = await googleMapsClient.placesNearby({
    params: { key: googleMapsApiKey, location: `${lat},${lng}`, radius: AIRPORT_SEARCH_RADIUS_M, type: 'airport' },
  });
  const airports = (resp.data.results || [])
    .filter((p) => !NON_AIRPORT_RE.test(p.name) && AIRPORT_RE.test(p.name))
    .map((p) => ({
      name: p.name,
      distanceMiles: haversineDistance(lat, lng, p.geometry.location.lat, p.geometry.location.lng),
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

function estimateDNLFromRoad(type, distanceMiles) {
  // Normalize _link variants (motorway_link → motorway)
  const baseType = type?.replace(/_link$/, '') || 'road';
  const base = { motorway: 72, trunk: 68, primary: 62, secondary: 56 }[baseType] || 52;
  const decay = Math.log2(Math.max(distanceMiles * 5280 / 50, 1)) * 4.5;
  return Math.max(38, Math.round(base - decay));
}

function getDNLCategory(dnl) {
  if (dnl < 45) return { label: 'Very Quiet',  color: 'green',      hint: 'well below the residential noise threshold' };
  if (dnl < 55) return { label: 'Quiet',       color: 'lightgreen', hint: 'within the quiet residential range' };
  if (dnl < 65) return { label: 'Moderate',    color: 'gold',       hint: 'approaching FHWA\'s 65 dB residential standard' };
  if (dnl < 70) return { label: 'Elevated',    color: 'orange',     hint: 'above FHWA residential standard of 65 dB' };
  return           { label: 'Significant',     color: 'red',        hint: 'well above residential noise standards' };
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

function estimateBortle(population, landuse) {
  let b;
  if (population == null) {
    b = landuse === 'commercial' ? 7 : landuse === 'rural' ? 3 : 5;
  } else if (population > 6000) b = 7;
  else if (population > 3000)   b = 6;
  else if (population > 1200)   b = 5;
  else if (population > 400)    b = 4;
  else                          b = 3;
  if (landuse === 'commercial' && b < 7) b = Math.min(b + 1, 8);
  if (landuse === 'rural'      && b > 4) b = Math.max(b - 1, 2);
  return { bortle: b, ...getBortleDescription(b) };
}

function getBortleDescription(b) {
  if (b <= 2) return { label: 'Exceptional dark sky',      desc: 'The Milky Way is strikingly detailed and casts faint shadows.' };
  if (b <= 3) return { label: 'Rural dark sky',            desc: 'The Milky Way is clearly visible with obvious structure. Light domes from distant cities appear at the horizon.' };
  if (b <= 4) return { label: 'Rural/suburban transition', desc: 'The Milky Way is still visible but faint. Some light pollution from the nearest town is noticeable.' };
  if (b <= 5) return { label: 'Suburban sky',              desc: 'The Milky Way is a faint smudge on a good night. The sky background is noticeably bright near the horizon.' };
  if (b <= 6) return { label: 'Bright suburban sky',       desc: 'The Milky Way is at or below the threshold of visibility. Skyglow is obvious in multiple directions.' };
  if (b <= 7) return { label: 'Suburban/urban transition', desc: 'The Milky Way is not visible. Only the moon and the brightest stars are easily seen.' };
  return          { label: 'Urban sky',                    desc: 'Only the brightest stars are visible against a washed-out background.' };
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

// Radon zone (EPA static county-level lookup) ─────────────────────────────────

// State FIPS → default EPA radon zone (1=high, 2=moderate, 3=low)
function getRadonZone(fips) {
  if (!fips?.state) return null;
  const zone = RADON_ZONE_BY_STATE[fips.state] ?? 2;
  return { zone };
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

// ── FR-017: Schools & Education ──────────────────────────────────────────────

async function getSchoolRatings(lat, lng, originLatLng, googleMapsClient, googleMapsApiKey, getDriveTime) {
  const publicSearches = [
    { level: 'Elementary', query: 'public elementary school', exclude: ['preschool','pre-school','daycare','montessori','private'] },
    { level: 'Middle',     query: 'middle school',            exclude: ['elementary','preschool'] },
    { level: 'High',       query: 'high school',              exclude: ['middle','elementary','junior high'] },
  ];

  const [publicResults, privateResult] = await Promise.allSettled([
    Promise.allSettled(
      publicSearches.map(async ({ level, query, exclude }) => {
        const resp = await googleMapsClient.textSearch({
          params: { key: googleMapsApiKey, query, location: `${lat},${lng}`, radius: 20000 },
        });
        const places = (resp.data.results || []).filter(
          (p) => !exclude.some((ex) => (p.name || '').toLowerCase().includes(ex))
        );
        const place = places[0];
        if (!place) return null;
        let driveTimeMinutes = null;
        try { driveTimeMinutes = await getDriveTime(originLatLng, place.geometry.location); } catch {}
        return {
          level,
          name: place.name,
          address: place.formatted_address || place.vicinity || place.name,
          distanceMiles: haversineDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng).toFixed(1),
          driveTimeMinutes,
        };
      })
    ),
    googleMapsClient.textSearch({
      params: { key: googleMapsApiKey, query: 'private school', location: `${lat},${lng}`, radius: 16000 },
    }),
  ]);

  const publicSchools = publicResults.status === 'fulfilled'
    ? publicResults.value.map((r) => (r.status === 'fulfilled' ? r.value : null))
    : [];

  let privateSchools = [];
  if (privateResult.status === 'fulfilled') {
    const skipWords = ['preschool', 'pre-school', 'daycare', 'day care', 'montessori'];
    const places = (privateResult.value.data.results || [])
      .filter((p) => !skipWords.some((w) => (p.name || '').toLowerCase().includes(w)))
      .slice(0, 5);
    for (const place of places) {
      privateSchools.push({
        name: place.name,
        address: place.formatted_address || place.vicinity || place.name,
        distanceMiles: haversineDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng).toFixed(1),
      });
    }
    privateSchools.sort((a, b) => parseFloat(a.distanceMiles) - parseFloat(b.distanceMiles));
  }

  if (!publicSchools.some(Boolean) && !privateSchools.length) return null;
  return { public: publicSchools, private: privateSchools };
}

const { buildWhatWillGrowHTML } = require('./templates/chapters/garden');

// ── Master fetch ──────────────────────────────────────────────────────────────

async function getChapterData({ lat, lng, originLatLng, locationInfo, googleMapsClient, googleMapsApiKey, getDriveTime, highwayDriveMinutes }) {
  const fips = await getCensusFIPS(lat, lng);

  const [demographics, propertyData, walkability, emergency, environment, safetyLocation, schools, growth, propIntel, gardenData, climateHistory] =
    await Promise.allSettled([
      getDemographics(lat, lng, fips),
      getPropertyData(fips, locationInfo),
      getWalkabilityScore(lat, lng),
      getEmergencyServices(lat, lng, originLatLng),
      getEnvironmentalData(lat, lng, highwayDriveMinutes, fips, googleMapsClient, googleMapsApiKey),
      getSafetyLocationContext(locationInfo),
      getSchoolRatings(lat, lng, originLatLng, googleMapsClient, googleMapsApiKey, getDriveTime),
      getGrowthAndDevelopment(lat, lng, fips, locationInfo),
      getPropertyIntelligence(lat, lng, fips, locationInfo),
      getGardenData(lat, lng, locationInfo),
      getClimateHistoryData(lat, lng, locationInfo, fips),
    ]);

  const val = (r) => (r.status === 'fulfilled' ? r.value : null);

  // Post-resolve basementContext: needs constructionEra + ruralMode, both only available after parallel fetch
  const { getBasementContext: gbc, detectRuralMode: drm } = require('./shared/validate');
  let climateHistoryVal = val(climateHistory);
  if (climateHistoryVal) {
    const era        = val(propIntel)?.era?.medianYearBuilt ? String(val(propIntel).era.medianYearBuilt) : null;
    const demog      = val(demographics);
    const tractPop   = demog?.totalPop ?? null;
    const avgDrive   = val(propertyData)?.avgDriveMinutes ?? null;
    const ruralMode  = (tractPop !== null ? drm(tractPop, avgDrive) : { mode: 'suburban' }).mode;
    climateHistoryVal = {
      ...climateHistoryVal,
      basementContext: gbc(era, locationInfo?.state, ruralMode),
    };
  }

  return {
    demographics: val(demographics),
    propertyData: val(propertyData),
    walkability:  val(walkability),
    emergency:    val(emergency),
    environment:  val(environment),
    safetyLocation: val(safetyLocation),
    schools:      val(schools),
    growth:       val(growth),
    propIntel:    val(propIntel),
    gardenData:   val(gardenData),
    climateHistory: climateHistoryVal,
    locationInfo,
  };
}

// ── FR-021: Pedestrian environment by walkability score ───────────────────────


// ── HTML builders ──────────────────────────────────────────────────────────────

// badgeColor and chapterCard extracted to src/templates/components/
const badgeColor = badgeClass;
const chapterCard = renderChapterCard;

// FR-017: Schools & Education
const { buildSchoolRatingsHTML } = require('./templates/chapters/schools');

const { buildCrimeHTML, buildEmergencyServicesHTML } = require('./templates/chapters/safety');
const { buildSensoryEnvironmentalHTML } = require('./templates/chapters/sensory');

const { buildWalkabilityHTML } = require('./templates/chapters/walkability');
const { buildPropertyDataHTML } = require('./templates/chapters/costs');
const { buildDemographicsHTML } = require('./templates/chapters/community');
const { buildGrowthAndDevelopmentHTML } = require('./templates/chapters/growth');
const { buildPropertyIntelligenceHTML } = require('./templates/chapters/property');


function buildChaptersHTML(chapters) {
  if (!chapters) return '';
  return [
    buildSchoolRatingsHTML(chapters.schools),
    buildCrimeHTML(chapters.safetyLocation, chapters.emergency),
    buildDemographicsHTML(chapters.demographics),
    buildGrowthAndDevelopmentHTML(chapters.growth),
    buildClimateChapterHTML(chapters.environment, chapters.climateHistory, chapters.locationInfo),
    buildWhatWillGrowHTML(chapters.gardenData, chapters.propIntel?.soil, chapters.locationInfo),
    buildPropertyIntelligenceHTML(chapters.propIntel),
    buildSensoryEnvironmentalHTML(chapters.environment),
    buildWalkabilityHTML(chapters.walkability),
    buildPropertyDataHTML(chapters.propertyData),
  ].join('');
}

module.exports = {
  getChapterData, buildChaptersHTML,
  filterReptiles, filterInsects, filterButterflies,
  categorizeSeasonalBirds, categorizePlantsByForm,
  getMonarchCorridorInfo, getFireflyHabitat, getEmergencySystem,
  getLastSignificantEvent, computeRarityStatement, classifyTopographicPosition,
  getWatershedContext, fetchElevationWithRetry,
};
