'use strict';

// Chapter data module — FR-017 through FR-024

const path = require('path');
const fs   = require('fs');

const { discoverDevelopments } = require('./development-discovery');
const { haversineDistance } = require('./utils/geo');
const { escapeHtml, formatMoney } = require('./utils/text');
const {
  STATE_TAX_RATES, STATE_INSURANCE_ANNUAL, STATE_UTILITIES_MONTHLY,
  STATE_HOMESTEAD, STATE_EXTENSION,
  TORNADO_TIER,
  RADON_ZONE_BY_STATE,
  FROST_DATE_TABLE,
  NATIVE_PLANT_EXCLUDE, NATIVE_PLANT_EXCLUDE_NAMES,
  BENIGN_INTRODUCED, DOMESTIC_MAMMALS,
  OVERPASS_ENDPOINTS,
  NON_AIRPORT_RE, AIRPORT_RE,
  AIRPORT_SEARCH_RADIUS_M, AIRPORT_MAX_DISTANCE_MILES,
  WALKABILITY_SEARCH_RADIUS_M, WALK_TYPES,
  DEVELOPMENT_ACTIVITY_SEARCH_RADIUS_M, COMMERCIAL_DEV_TYPES,
  RESPONSE_SPEED_MPH, RESPONSE_DISPATCH_MINUTES, RESPONSE_TIME_THRESHOLDS,
  FEMA_FLOOD_ZONES,
  BROADBAND_TECH_CODES,
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
  GROCERY_SEARCH_RADIUS_M, STATE_ALERT_SYSTEMS, CLIMATE_SIGNIFICANT_DAMAGE_USD,
  NOAA_CDO_BASE_URL, NOAA_CDO_NORMALS_DATASET, NOAA_CDO_NORMALS_ANN,
  FEMA_DECLARATIONS_URL, USGS_ELEVATION_URL,
  CLIMATE_STORM_LOOKBACK_YEARS, CLIMATE_FEMA_LOOKBACK_YEARS,
} = require('./utils/constants');

const { getCensusFIPS, fetchCensusACS } = require('./shared/census');
const { renderChapterCard } = require('./templates/components/chapterCard');
const { badgeClass } = require('./templates/components/badge');

// ── Shared utilities ──────────────────────────────────────────────────────────

function safeInt(n) {
  const v = parseInt(n, 10);
  return isNaN(v) || v < 0 ? 0 : v;
}

// ── FR-024: Demographics ──────────────────────────────────────────────────────

async function getDemographics(lat, lng, fips) {
  if (!fips) return null;

  // Split into two batches — Census ACS limit is 50 variables per request
  const varsBatch1 = [
    'B01001_001E', 'B01002_001E',
    'B19013_001E',
    'B25003_001E', 'B25003_002E', 'B25010_001E',
    'B15003_001E', 'B15003_017E', 'B15003_022E', 'B15003_023E', 'B15003_024E', 'B15003_025E',
    'B25039_001E',
    'B01001_003E','B01001_004E','B01001_005E','B01001_006E',
    'B01001_007E','B01001_008E','B01001_009E','B01001_010E','B01001_011E','B01001_012E',
    'B01001_013E','B01001_014E','B01001_015E','B01001_016E','B01001_017E','B01001_018E','B01001_019E',
    'B01001_020E','B01001_021E','B01001_022E','B01001_023E','B01001_024E','B01001_025E',
  ];
  const varsBatch2 = [
    'B01001_027E','B01001_028E','B01001_029E','B01001_030E',
    'B01001_031E','B01001_032E','B01001_033E','B01001_034E','B01001_035E','B01001_036E',
    'B01001_037E','B01001_038E','B01001_039E','B01001_040E','B01001_041E','B01001_042E','B01001_043E',
    'B01001_044E','B01001_045E','B01001_046E','B01001_047E','B01001_048E','B01001_049E',
  ];

  try {
    const [acs1, acs2] = await Promise.all([
      fetchCensusACS(fips, varsBatch1),
      fetchCensusACS(fips, varsBatch2),
    ]);
    if (!acs1) return null;
    const get = (name) => acs1.get(name) ?? (acs2 ? acs2.get(name) : undefined);

    const totalPop = safeInt(get('B01001_001E')) || 1;
    const medianAge = parseFloat(get('B01002_001E')) || null;
    const medianIncome = safeInt(get('B19013_001E'));
    const totalHousing = safeInt(get('B25003_001E')) || 1;
    const ownerOcc = safeInt(get('B25003_002E'));
    const avgHHSize = parseFloat(get('B25010_001E')) || null;
    const eduBase = safeInt(get('B15003_001E')) || 1;
    const hsGrad = safeInt(get('B15003_017E'));
    const bachelor = safeInt(get('B15003_022E'));
    const master = safeInt(get('B15003_023E'));
    const profDeg = safeInt(get('B15003_024E'));
    const doctoral = safeInt(get('B15003_025E'));

    const sum = (...names) => names.reduce((acc, n) => acc + safeInt(get(n)), 0);

    const under18 = sum(
      'B01001_003E','B01001_004E','B01001_005E','B01001_006E',
      'B01001_027E','B01001_028E','B01001_029E','B01001_030E',
    );
    const age18to34 = sum(
      'B01001_007E','B01001_008E','B01001_009E','B01001_010E','B01001_011E','B01001_012E',
      'B01001_031E','B01001_032E','B01001_033E','B01001_034E','B01001_035E','B01001_036E',
    );
    const age35to64 = sum(
      'B01001_013E','B01001_014E','B01001_015E','B01001_016E','B01001_017E','B01001_018E','B01001_019E',
      'B01001_037E','B01001_038E','B01001_039E','B01001_040E','B01001_041E','B01001_042E','B01001_043E',
    );
    const age65plus = sum(
      'B01001_020E','B01001_021E','B01001_022E','B01001_023E','B01001_024E','B01001_025E',
      'B01001_044E','B01001_045E','B01001_046E','B01001_047E','B01001_048E','B01001_049E',
    );

    const pct = (n) => Math.round(n / totalPop * 100);
    const under18Pct = pct(under18);
    const age18to34Pct = pct(age18to34);
    const age35to64Pct = pct(age35to64);
    const age65plusPct = pct(age65plus);

    const ageGroups = [
      { pct: under18Pct, label: 'Families with children' },
      { pct: age18to34Pct, label: 'Young professionals' },
      { pct: age35to64Pct, label: 'Established households' },
      { pct: age65plusPct, label: 'Retirees and seniors' },
    ];
    const primaryGroup = ageGroups.reduce((a, b) => a.pct >= b.pct ? a : b).label;

    const ownershipRate = Math.round(ownerOcc / totalHousing * 100);
    const bachelorPct = Math.round(bachelor / eduBase * 100);
    const graduatePct = Math.round((master + profDeg + doctoral) / eduBase * 100);
    const collegePct = bachelorPct + graduatePct;

    // Median tenure: Census gives year householder moved in; subtract from current year
    const medianMoveYear = parseInt(get('B25039_001E'), 10);
    const medianTenureYears = (!isNaN(medianMoveYear) && medianMoveYear > 1970)
      ? new Date().getFullYear() - medianMoveYear
      : null;

    return {
      totalPop,
      medianAge,
      age: { under18: under18Pct, age18to34: age18to34Pct, age35to64: age35to64Pct, age65plus: age65plusPct, primaryGroup },
      income: { median: medianIncome > 0 ? medianIncome : null, level: getIncomeLevel(medianIncome) },
      education: { bachelor: bachelorPct, graduate: graduatePct, collegePct, level: getEducationLevel(collegePct) },
      community: {
        ownershipRate,
        avgHHSize,
        medianTenureYears,
        type: getCommunityType(ownershipRate, avgHHSize),
        densityType: getDensityType(totalPop),
      },
    };
  } catch (err) {
    console.error('[Demographics]', err.message);
    return null;
  }
}

function getIncomeLevel(median) {
  if (!median || median <= 0) return { label: 'Data unavailable', color: 'muted' };
  if (median > 100000) return { label: 'Above $100k median', color: 'gold' };
  if (median > 70000) return { label: 'Above national median', color: 'gold' };
  if (median > 50000) return { label: 'Near national median', color: 'gold' };
  return { label: 'Below national median', color: 'gold' };
}

function getEducationLevel(collegePct) {
  if (collegePct > 60) return { label: 'Very highly educated', color: 'green' };
  if (collegePct > 40) return { label: 'Highly educated', color: 'lightgreen' };
  if (collegePct > 25) return { label: 'College-educated area', color: 'gold' };
  return { label: 'Moderate education', color: 'muted' };
}

function getDensityType(population) {
  if (population > 5000) return { label: 'Urban', icon: '🏙️' };
  if (population > 2000) return { label: 'Suburban', icon: '🏘️' };
  return { label: 'Rural', icon: '🌳' };
}

function getCommunityType(ownershipRate, householdSize) {
  if (ownershipRate > 70 && householdSize > 2.5) return { label: 'Established family neighborhood', icon: '👨‍👩‍👧‍👦' };
  if (ownershipRate < 40) return { label: 'Renter community', icon: '🏢' };
  if (householdSize && householdSize < 2) return { label: 'Singles and young professionals', icon: '👤' };
  return { label: 'Mixed residential community', icon: '🏘️' };
}

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

// ── FR-021: Walkability Score (proxy via Google Places) ───────────────────────

async function getWalkabilityScore(lat, lng, googleMapsClient, googleMapsApiKey) {
  const results = await Promise.allSettled(
    WALK_TYPES.map(({ type }) =>
      googleMapsClient.placesNearby({
        params: { key: googleMapsApiKey, location: `${lat},${lng}`, radius: WALKABILITY_SEARCH_RADIUS_M, type },
      })
    )
  );

  let totalScore = 0;
  const destinations = [];

  for (let i = 0; i < WALK_TYPES.length; i++) {
    const { weight, label, icon } = WALK_TYPES[i];
    const r = results[i];
    if (r.status !== 'fulfilled') continue;
    const places = r.value.data.results || [];
    const count = places.length;
    totalScore += count === 0 ? 0 : count <= 2 ? Math.round(weight * 0.5) : weight;

    places.slice(0, 2).forEach((place) => {
      const dist = haversineDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng);
      destinations.push({
        label, icon,
        name: place.name,
        distanceMiles: dist,
        walkMinutes: Math.max(1, Math.round(dist * 20)),
      });
    });
  }

  destinations.sort((a, b) => a.distanceMiles - b.distanceMiles);

  const score = Math.min(100, totalScore);
  return { score, category: getWalkCategory(score), destinations, isProxy: true };
}

function getWalkCategory(score) {
  if (score >= 90) return { label: "Walker's Paradise", color: 'green', description: 'Daily errands do not require a car.' };
  if (score >= 70) return { label: 'Very Walkable', color: 'lightgreen', description: 'Most errands can be done on foot.' };
  if (score >= 50) return { label: 'Somewhat Walkable', color: 'gold', description: 'Some errands can be done on foot.' };
  if (score >= 25) return { label: 'Car-Dependent', color: 'orange', description: 'Most errands require a car.' };
  return { label: 'Very Car-Dependent', color: 'red', description: 'Almost all errands require a car.' };
}

// ── FR-020: Emergency Services ────────────────────────────────────────────────

function normalizeStationName(name) {
  if (!name) return name;
  return name.replace(/Fire\s+Protction\s+Services/gi, 'Fire Protection Services');
}

async function getEmergencyServices(lat, lng, originLatLng, googleMapsClient, googleMapsApiKey, getDriveTime) {
  const [policeResult, fireResult] = await Promise.allSettled([
    googleMapsClient.placesNearby({
      params: { key: googleMapsApiKey, location: `${lat},${lng}`, rankby: 'distance', type: 'police' },
    }),
    googleMapsClient.placesNearby({
      params: { key: googleMapsApiKey, location: `${lat},${lng}`, rankby: 'distance', type: 'fire_station' },
    }),
  ]);

  async function processStation(result, serviceType) {
    if (result.status !== 'fulfilled') return null;
    const place = (result.value.data.results || [])[0];
    if (!place) return null;
    const distanceMiles = haversineDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng);
    let driveTimeMinutes = null;
    try { driveTimeMinutes = await getDriveTime(originLatLng, place.geometry.location); } catch {}
    return {
      name: normalizeStationName(place.name),
      address: place.vicinity || place.formatted_address || place.name,
      distanceMiles: distanceMiles.toFixed(1),
      driveTimeMinutes,
      response: estimateResponseTime(distanceMiles, serviceType),
    };
  }

  const [police, fire] = await Promise.all([
    processStation(policeResult, 'police'),
    processStation(fireResult, 'fire'),
  ]);

  return { police, fire };
}

function estimateResponseTime(distanceMiles, type) {
  const minutes = Math.round((distanceMiles / (RESPONSE_SPEED_MPH[type] || 30)) * 60 + (RESPONSE_DISPATCH_MINUTES[type] || 2));
  const t = RESPONSE_TIME_THRESHOLDS[type] || { excellent: 5, good: 10, fair: 15 };
  let category;
  if (minutes <= t.excellent) category = { label: 'Excellent', color: 'green' };
  else if (minutes <= t.good) category = { label: 'Good', color: 'gold' };
  else if (minutes <= t.fair) category = { label: 'Fair', color: 'orange' };
  else category = { label: 'Delayed', color: 'red' };
  return { estimate: minutes, category };
}

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

// ── FR-018: Safety & Emergency Response ──────────────────────────────────────

async function getSafetyLocationContext(locationInfo) {
  const { state, city, county } = locationInfo || {};
  if (!state) return null;
  return { state, city, county };
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

// ── FR-025: Growth & Development ─────────────────────────────────────────────

async function getBuildingPermitTrend(fips) {
  if (!fips?.state || !fips?.county) return null;
  try {
    const censusKey = process.env.CENSUS_API_KEY;
    const keyParam = censusKey ? `&key=${censusKey}` : '';
    const currentYear = new Date().getFullYear() - 1;
    const permitsByYear = [];

    for (const year of [currentYear, currentYear - 1, currentYear - 2]) {
      try {
        const url =
          `https://api.census.gov/data/timeseries/eits/bps` +
          `?get=cell_value,data_type_code,category_code` +
          `&for=county:${fips.county}&in=state:${fips.state}` +
          `&time=${year}${keyParam}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!resp.ok) continue;
        const data = await resp.json();
        if (!Array.isArray(data) || data.length < 2) continue;
        const headers = data[0];
        const rows = data.slice(1);
        const cvIdx  = headers.indexOf('cell_value');
        const dtIdx  = headers.indexOf('data_type_code');
        const catIdx = headers.indexOf('category_code');
        let row = rows.find((r) => {
          const cat = catIdx >= 0 ? String(r[catIdx] || '').toLowerCase() : '';
          const dt  = dtIdx  >= 0 ? String(r[dtIdx]  || '').toLowerCase() : '';
          return (cat === 'total' || cat === '') && dt.includes('estimate');
        });
        if (!row) row = rows.find((r) => dtIdx >= 0 && String(r[dtIdx] || '').toLowerCase().includes('estimate'));
        if (row && cvIdx >= 0) {
          const val = parseInt(row[cvIdx], 10);
          if (!isNaN(val) && val >= 0) permitsByYear.push({ year, permits: val });
        }
      } catch {}
    }

    if (!permitsByYear.length) return null;
    permitsByYear.sort((a, b) => b.year - a.year);
    const current = permitsByYear[0];
    const prior   = permitsByYear[1] || null;
    let percentChange = null;
    if (current && prior && prior.permits > 0) {
      percentChange = Math.round((current.permits - prior.permits) / prior.permits * 100);
    }
    const trend =
      percentChange === null ? 'stable'
      : percentChange >= 10  ? 'rising'
      : percentChange <= -10 ? 'declining'
      : 'stable';
    return {
      current:      current.permits,
      currentYear:  current.year,
      prior:        prior?.permits ?? null,
      priorYear:    prior?.year    ?? null,
      percentChange,
      trend,
    };
  } catch (err) {
    console.error('[BPS]', err.message);
    return null;
  }
}

async function getNewConstructionContext(fips) {
  if (!fips) return null;
  try {
    const acs = await fetchCensusACS(fips, ['B25034_001E', 'B25034_002E', 'B25034_003E']);
    if (!acs) return null;
    const total    = safeInt(acs.get('B25034_001E')) || 1;
    const post2014 = safeInt(acs.get('B25034_002E'));
    const post2010 = post2014 + safeInt(acs.get('B25034_003E'));
    return { newConstructionPct: Math.round(post2010 / total * 100) };
  } catch { return null; }
}

async function getRecentDevelopmentActivity(lat, lng, googleMapsClient, googleMapsApiKey) {
  const results = await Promise.allSettled(
    COMMERCIAL_DEV_TYPES.map(({ type }) =>
      googleMapsClient.placesNearby({
        params: { key: googleMapsApiKey, location: `${lat},${lng}`, radius: DEVELOPMENT_ACTIVITY_SEARCH_RADIUS_M, type },
      })
    )
  );
  const seen = new Set();
  const establishments = [];
  for (let i = 0; i < COMMERCIAL_DEV_TYPES.length; i++) {
    const r = results[i];
    if (r.status !== 'fulfilled') continue;
    for (const place of (r.value.data.results || []).filter((p) => p.business_status === 'OPERATIONAL').slice(0, 2)) {
      if (seen.has(place.place_id)) continue;
      seen.add(place.place_id);
      establishments.push({
        name:          place.name,
        label:         COMMERCIAL_DEV_TYPES[i].label,
        icon:          COMMERCIAL_DEV_TYPES[i].icon,
        distanceMiles: haversineDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng),
      });
    }
  }
  return establishments.sort((a, b) => a.distanceMiles - b.distanceMiles).slice(0, 6);
}

async function getGrowthAndDevelopment(lat, lng, fips, locationInfo, googleMapsClient, googleMapsApiKey) {
  const [permitRes, newConstRes, activityRes, discoveryRes] = await Promise.allSettled([
    getBuildingPermitTrend(fips),
    getNewConstructionContext(fips),
    googleMapsClient
      ? getRecentDevelopmentActivity(lat, lng, googleMapsClient, googleMapsApiKey)
      : Promise.resolve([]),
    discoverDevelopments(locationInfo?.city, locationInfo?.state),
  ]);
  return {
    permits:         permitRes.status    === 'fulfilled' ? permitRes.value    : null,
    newConstruction: newConstRes.status  === 'fulfilled' ? newConstRes.value  : null,
    establishments:  activityRes.status  === 'fulfilled' ? activityRes.value  : [],
    namedProjects:   discoveryRes.status === 'fulfilled' ? discoveryRes.value : [],
    locationInfo,
  };
}

// ── FR-031: What Will Grow Here ───────────────────────────────────────────────

async function getHardinessZone(zip) {
  if (!zip) return null;
  try {
    const resp = await fetch(`https://phzmapi.org/${encodeURIComponent(zip)}.json`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data?.zone) return null;
    const zone = data.zone.toLowerCase().trim();
    const frost = FROST_DATE_TABLE[zone] || FROST_DATE_TABLE[zone.replace(/[ab]$/, '')] || null;
    return {
      zone: data.zone,
      tempRange: data.temperature_range || null,
      frost,
    };
  } catch {
    return null;
  }
}

async function iNatSpeciesCounts(lat, lng, radiusKm, taxonId, flags, perPage) {
  try {
    const params = new URLSearchParams({
      lat: lat.toFixed(4),
      lng: lng.toFixed(4),
      radius: radiusKm,
      taxon_id: taxonId,
      quality_grade: 'research',
      per_page: perPage,
      order_by: 'count',
    });
    if (flags.native)     params.set('native', 'true');
    if (flags.introduced) params.set('introduced', 'true');
    const resp = await fetch(`https://api.inaturalist.org/v1/observations/species_counts?${params}`, {
      signal: AbortSignal.timeout(12000),
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.results || [];
  } catch {
    return [];
  }
}

function filterNativePlants(results) {
  return results
    .filter((r) => {
      const t = r.taxon;
      const sci = (t.name || '').toLowerCase();
      const common = (t.preferred_common_name || '').toLowerCase();
      if (!t.preferred_common_name) return false; // skip obscure species
      if (t.rank !== 'species') return false;
      // Exclude by genus or full species name
      const genus = sci.split(' ')[0];
      if (NATIVE_PLANT_EXCLUDE.has(sci) || NATIVE_PLANT_EXCLUDE.has(genus)) return false;
      // Exclude by common name keywords
      if (NATIVE_PLANT_EXCLUDE_NAMES.some((kw) => common.includes(kw))) return false;
      return true;
    })
    .slice(0, 6)
    .map((r) => ({ name: r.taxon.preferred_common_name, sci: r.taxon.name, count: r.count }));
}

function filterInvasivePlants(results) {
  return results
    .filter((r) => {
      const t = r.taxon;
      const sci = (t.name || '').toLowerCase();
      if (!t.preferred_common_name) return false;
      if (t.rank !== 'species') return false;
      if (BENIGN_INTRODUCED.has(sci)) return false;
      return true;
    })
    .slice(0, 5)
    .map((r) => ({ name: r.taxon.preferred_common_name, sci: r.taxon.name, count: r.count }));
}

function filterWildlife(results) {
  return results
    .filter((r) => {
      const sci = (r.taxon.name || '').toLowerCase();
      return r.taxon.preferred_common_name && !DOMESTIC_MAMMALS.has(sci);
    })
    .slice(0, 6)
    .map((r) => ({ name: r.taxon.preferred_common_name, sci: r.taxon.name, count: r.count }));
}

function filterBirds(results) {
  return results
    .filter((r) => r.taxon.preferred_common_name)
    .slice(0, 6)
    .map((r) => ({ name: r.taxon.preferred_common_name, sci: r.taxon.name, count: r.count }));
}

function filterReptiles(results) {
  return results
    .filter((r) => r.taxon.preferred_common_name)
    .slice(0, 8)
    .map((r) => ({ name: r.taxon.preferred_common_name, sci: r.taxon.name, count: r.count }));
}

function filterInsects(results) {
  return results
    .filter((r) => r.taxon.preferred_common_name)
    .slice(0, 10)
    .map((r) => ({ name: r.taxon.preferred_common_name, sci: r.taxon.name, count: r.count }));
}

function filterButterflies(results) {
  return results
    .filter((r) => r.taxon.preferred_common_name)
    .slice(0, 10)
    .map((r) => ({ name: r.taxon.preferred_common_name, sci: r.taxon.name, count: r.count }));
}

function categorizeSeasonalBirds({ spring, summer, fall, winter }) {
  const seasonSets = [spring, summer, fall, winter].map(
    (arr) => new Set((arr || []).map((r) => r.taxon.name))
  );

  const countSeasons = (sciName) =>
    seasonSets.reduce((acc, s) => acc + (s.has(sciName) ? 1 : 0), 0);

  const allRaw = [...(spring || []), ...(summer || []), ...(fall || []), ...(winter || [])];
  const allSci = new Set(allRaw.map((r) => r.taxon.name));
  const yearRoundSci = new Set([...allSci].filter((s) => countSeasons(s) >= 3));

  const toEntry = (r) => ({ name: r.taxon.preferred_common_name, sci: r.taxon.name, count: r.count });
  const seen = new Set();

  const dedup = (arr) => {
    const out = [];
    for (const r of (arr || [])) {
      if (!seen.has(r.taxon.name) && r.taxon.preferred_common_name) {
        seen.add(r.taxon.name);
        out.push(toEntry(r));
      }
    }
    return out;
  };

  const yearRoundItems = dedup(allRaw.filter((r) => yearRoundSci.has(r.taxon.name))).slice(0, 8);

  const seasonal = (arr) => (arr || [])
    .filter((r) => !yearRoundSci.has(r.taxon.name) && r.taxon.preferred_common_name)
    .filter((r) => { if (seen.has(r.taxon.name)) return false; seen.add(r.taxon.name); return true; })
    .slice(0, 6)
    .map(toEntry);

  return {
    yearRound: yearRoundItems,
    spring: seasonal(spring),
    summer: seasonal(summer),
    fall: seasonal(fall),
    winter: seasonal(winter),
  };
}

function categorizePlantsByForm(nativePlants) {
  const trees = [], shrubs = [], perennials = [], grasses = [], vines = [];
  for (const p of nativePlants) {
    const form = PLANT_GROWTH_FORMS.get((p.sci || '').toLowerCase()) || 'perennial';
    if (form === 'tree') trees.push(p);
    else if (form === 'shrub') shrubs.push(p);
    else if (form === 'grass') grasses.push(p);
    else if (form === 'vine') vines.push(p);
    else perennials.push(p);
  }
  return { trees, shrubs, perennials, grasses, vines };
}

function getMonarchCorridorInfo(state) {
  const inCorridor = !!state && MONARCH_CORRIDOR_STATES.has(state);
  const milkweedSpecies = inCorridor
    ? (MILKWEED_BY_STATE[state] || MILKWEED_BY_STATE._default)
    : [];
  return { inCorridor, milkweedSpecies };
}

function getFireflyHabitat(state) {
  return !!state && FIREFLY_STATES.has(state);
}

// ── FR-043: Climate — emergency system lookup ─────────────────────────────────
function getEmergencySystem(state, county) {
  const tier1 = state ? STATE_ALERT_SYSTEMS.get(state) : undefined;
  const countyName = county || 'this county';
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${countyName} ${state || ''} emergency alert registration`.trim())}`;

  if (tier1) {
    return { tier: 1, name: tier1.name, url: tier1.url, searchUrl, note: null };
  }

  const slug = countyName.toLowerCase().replace(/\s+county$/i, '').replace(/[^a-z0-9]/g, '');
  const stSlug = (state || '').toLowerCase();
  return {
    tier: 2,
    name: null,
    url: `https://${slug}${stSlug}.gov/emergency`,
    searchUrl,
    note: `Emergency alerts for ${countyName} are managed locally. The URL above may not be correct — use the search link to find the official registration page.`,
  };
}

// Returns { type, year } for the most recent qualifying climate event, or null.
// FEMA declarations always qualify; NOAA events only qualify if damage >= CLIMATE_SIGNIFICANT_DAMAGE_USD.
function getLastSignificantEvent(femaDeclarations, noaaEvents) {
  let latestDate = null;
  let latest = null;

  for (const d of (femaDeclarations || [])) {
    const date = new Date(d.declarationDate);
    if (isNaN(date.getTime())) continue;
    if (!latestDate || date > latestDate) {
      latestDate = date;
      latest = { type: d.incidentType || d.declarationTitle || 'Disaster', year: date.getFullYear() };
    }
  }

  for (const e of (noaaEvents || [])) {
    const damage = typeof e.damage_property === 'number'
      ? e.damage_property
      : parseFloat(String(e.damage_property || '0').replace(/[^0-9.]/g, '')) || 0;
    if (damage < CLIMATE_SIGNIFICANT_DAMAGE_USD) continue;
    const date = new Date(e.begin_date);
    if (isNaN(date.getTime())) continue;
    if (!latestDate || date > latestDate) {
      latestDate = date;
      latest = { type: e.event_type || 'Weather Event', year: date.getFullYear() };
    }
  }

  return latest;
}

// Returns a human-readable rarity framing string.
function computeRarityStatement(count, years, eventType) {
  if (count === 0) {
    return `No recorded ${eventType} events in this county in ${years} years.`;
  }
  const perDecade = Math.round((count / years) * 10);
  return `${count} ${eventType} event${count === 1 ? '' : 's'} in ${years} years — roughly ${perDecade} per decade.`;
}

// Returns 'uphill' | 'midslope' | 'lowpoint' | null
// elevations: [address, north, south, east, west] in feet
function classifyTopographicPosition(elevations) {
  if (!Array.isArray(elevations) || elevations.length < 5) return null;
  const [addr, ...surrounding] = elevations;
  const lower  = surrounding.filter((e) => addr < e).length;
  const higher = surrounding.filter((e) => addr > e).length;
  if (lower  >= 3) return 'lowpoint';
  if (higher >= 3) return 'uphill';
  return 'midslope';
}

// ── FR-043: API helpers ───────────────────────────────────────────────────────

// getNOAAStormEvents — 3-tier strategy
// Tier 1: NOAA CDO API (does not have storm event narratives — returns [] immediately)
// Tier 2: Pre-cached JSON for known counties
// Tier 3: Returns [] — template renders graceful fallback link
async function getNOAAStormEvents(stateFips, countyFips) {
  // Tier 2: Pre-cached JSON
  if (stateFips && countyFips) {
    try {
      const file = path.join(__dirname, '..', 'data', 'noaa-storm-events', `${stateFips}-${countyFips}.json`);
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
    // Find nearest NORMAL_MLY station within bounding box
    const stationParams = new URLSearchParams({
      datasetid: NOAA_CDO_NORMALS_DATASET,
      extent: `${(lat - 1).toFixed(4)},${(lng - 1).toFixed(4)},${(lat + 1).toFixed(4)},${(lng + 1).toFixed(4)}`,
      limit: 5,
    });
    const stResp = await fetch(`${NOAA_CDO_BASE_URL}/stations?${stationParams}`, {
      headers: { token: key },
      signal: AbortSignal.timeout(8000),
    });
    if (!stResp.ok) return null;
    const stData = await stResp.json();
    if (!stData.results?.length) return null;
    const station = stData.results[0];

    // Fetch monthly normals
    const normParams = new URLSearchParams({
      datasetid: NOAA_CDO_NORMALS_DATASET,
      stationid: station.id,
      datatypeid: 'MLY-TMAX-NORMAL,MLY-TMIN-NORMAL,MLY-PRCP-NORMAL,MLY-SNOW-NORMAL',
      startdate: '2010-01-01',
      enddate: '2010-12-31',
      limit: 100,
    });
    const normResp = await fetch(`${NOAA_CDO_BASE_URL}/data?${normParams}`, {
      headers: { token: key },
      signal: AbortSignal.timeout(10000),
    });
    if (!normResp.ok) return null;
    const normData = await normResp.json();
    if (!normData.results?.length) return null;

    // Pivot into monthly rows
    const byMonth = {};
    for (const r of normData.results) {
      const month = parseInt(r.date.slice(5, 7), 10);
      if (!byMonth[month]) byMonth[month] = {};
      byMonth[month][r.datatype] = r.value;
    }
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const m = byMonth[i + 1] || {};
      return {
        month: i + 1,
        tMaxF: m['MLY-TMAX-NORMAL'] ?? null,
        tMinF: m['MLY-TMIN-NORMAL'] ?? null,
        precipIn: m['MLY-PRCP-NORMAL'] ?? null,
        snowIn: m['MLY-SNOW-NORMAL'] ?? null,
      };
    });

    // Annual normals
    const annParams = new URLSearchParams({
      datasetid: NOAA_CDO_NORMALS_ANN,
      stationid: station.id,
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

    return { monthly, annual, stationId: station.id, stationName: station.name };
  } catch {
    return null;
  }
}

async function getWatershedContext(lat, lng) {
  try {
    const offsets = [[0, 0], [0.0036, 0], [-0.0036, 0], [0, 0.0045], [0, -0.0045]];
    const elevations = await Promise.all(
      offsets.map(async ([dlat, dlng]) => {
        const resp = await fetch(
          `${USGS_ELEVATION_URL}?x=${(lng + dlng).toFixed(6)}&y=${(lat + dlat).toFixed(6)}&units=Feet&wkid=4326&includeDate=false`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (!resp.ok) return null;
        const data = await resp.json();
        return data?.value ?? null;
      })
    );
    if (elevations.some((e) => e === null)) return null;
    return { elevations, position: classifyTopographicPosition(elevations) };
  } catch {
    return null;
  }
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

  const [stormResult, femaResult, normalsResult, watershedResult] =
    await Promise.allSettled([
      getNOAAStormEvents(stateFips, countyFips),
      getFEMADeclarations(state, county),
      getNOAAClimateNormals(lat, lng),
      getWatershedContext(lat, lng),
    ]);

  const val = (r, fallback) => r.status === 'fulfilled' ? r.value : fallback;
  const allEvents  = val(stormResult, []);
  const femaAll    = val(femaResult, []);
  const normals    = val(normalsResult, null);
  const watershed  = val(watershedResult, null);

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
    watershed: watershed
      ? { topographicPosition: watershed.position, elevations: watershed.elevations }
      : null,
    basementContext: null, // populated post-resolution in getChapterData using propIntel.constructionEra
  };
}

async function iNatSeasonalBirds(lat, lng, months) {
  try {
    const params = new URLSearchParams({
      lat: lat.toFixed(4),
      lng: lng.toFixed(4),
      radius: INAT_BIRDS_RADIUS_KM,
      taxon_id: 3,
      quality_grade: 'research',
      per_page: 20,
      order_by: 'count',
      months,
    });
    const resp = await fetch(`https://api.inaturalist.org/v1/observations/species_counts?${params}`, {
      signal: AbortSignal.timeout(12000),
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.results || [];
  } catch {
    return [];
  }
}

async function getGardenData(lat, lng, locationInfo) {
  const zip = locationInfo?.zip || '';
  const state = locationInfo?.state || null;

  const [
    zoneRes, nativePlantsRes, invasivePlantsRes, wildlifeRes, birdsRes,
    reptilesRes, insectsRes, butterfliesRes,
    birdSpringRes, birdSummerRes, birdFallRes, birdWinterRes,
  ] = await Promise.allSettled([
    getHardinessZone(zip),
    iNatSpeciesCounts(lat, lng, INAT_NATIVE_PLANTS_RADIUS_KM,    47126, { native: true },     INAT_NATIVE_PLANTS_PER_PAGE),
    iNatSpeciesCounts(lat, lng, INAT_INVASIVE_PLANTS_RADIUS_KM,  47126, { introduced: true }, INAT_INVASIVE_PLANTS_PER_PAGE),
    iNatSpeciesCounts(lat, lng, INAT_WILDLIFE_RADIUS_KM,          40151, {},                  INAT_WILDLIFE_PER_PAGE),
    iNatSpeciesCounts(lat, lng, INAT_BIRDS_RADIUS_KM,             3,    {},                  INAT_BIRDS_PER_PAGE),
    iNatSpeciesCounts(lat, lng, INAT_REPTILES_RADIUS_KM,          26036, {},                  INAT_REPTILES_PER_PAGE),
    iNatSpeciesCounts(lat, lng, INAT_INSECTS_RADIUS_KM,           47158, {},                  INAT_INSECTS_PER_PAGE),
    iNatSpeciesCounts(lat, lng, INAT_BUTTERFLIES_RADIUS_KM,       47224, {},                  INAT_BUTTERFLIES_PER_PAGE),
    iNatSeasonalBirds(lat, lng, '3,4,5'),
    iNatSeasonalBirds(lat, lng, '6,7,8'),
    iNatSeasonalBirds(lat, lng, '9,10,11'),
    iNatSeasonalBirds(lat, lng, '12,1,2'),
  ]);

  const val = (r, fallback) => r.status === 'fulfilled' ? r.value : fallback;
  const rawNativePlants = val(nativePlantsRes, []);
  const filteredNativePlants = filterNativePlants(rawNativePlants);

  return {
    hardinessZone:  val(zoneRes, null),
    nativePlants:   filteredNativePlants,
    invasivePlants: filterInvasivePlants(val(invasivePlantsRes, [])),
    wildlife:       filterWildlife(val(wildlifeRes, [])),
    birds:          filterBirds(val(birdsRes, [])),
    nativePlantsByForm: categorizePlantsByForm(filteredNativePlants),
    reptiles:       filterReptiles(val(reptilesRes, [])),
    insects:        filterInsects(val(insectsRes, [])),
    butterflies:    filterButterflies(val(butterfliesRes, [])),
    birdsBySeason:  categorizeSeasonalBirds({
      spring: val(birdSpringRes, []),
      summer: val(birdSummerRes, []),
      fall:   val(birdFallRes, []),
      winter: val(birdWinterRes, []),
    }),
    monarchCorridor: getMonarchCorridorInfo(state),
    fireflyHabitat:  getFireflyHabitat(state),
  };
}

const { buildWhatWillGrowHTML } = require('./templates/chapters/garden');

// ── FR-026: Property Intelligence ────────────────────────────────────────────

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

// ── Master fetch ──────────────────────────────────────────────────────────────

async function getChapterData({ lat, lng, originLatLng, locationInfo, googleMapsClient, googleMapsApiKey, getDriveTime, highwayDriveMinutes }) {
  const fips = await getCensusFIPS(lat, lng);

  const [demographics, propertyData, walkability, emergency, environment, safetyLocation, schools, growth, propIntel, gardenData, climateHistory] =
    await Promise.allSettled([
      getDemographics(lat, lng, fips),
      getPropertyData(fips, locationInfo),
      getWalkabilityScore(lat, lng, googleMapsClient, googleMapsApiKey),
      getEmergencyServices(lat, lng, originLatLng, googleMapsClient, googleMapsApiKey, getDriveTime),
      getEnvironmentalData(lat, lng, highwayDriveMinutes, fips, googleMapsClient, googleMapsApiKey),
      getSafetyLocationContext(locationInfo),
      getSchoolRatings(lat, lng, originLatLng, googleMapsClient, googleMapsApiKey, getDriveTime),
      getGrowthAndDevelopment(lat, lng, fips, locationInfo, googleMapsClient, googleMapsApiKey),
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
};
