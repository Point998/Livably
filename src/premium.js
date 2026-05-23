'use strict';

// Premium data module — FR-017 through FR-024 (excluding FR-022 paywall)

const { discoverDevelopments } = require('./development-discovery');

// ── Shared utilities ──────────────────────────────────────────────────────────

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function safeInt(n) {
  const v = parseInt(n, 10);
  return isNaN(v) || v < 0 ? 0 : v;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatMoney(n) {
  return n != null ? '$' + Number(n).toLocaleString('en-US') : 'N/A';
}

// ── Census FIPS lookup (cached) ───────────────────────────────────────────────

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

const STATE_TAX_RATES = {
  AL:0.39,AK:1.04,AZ:0.60,AR:0.62,CA:0.73,CO:0.49,CT:1.73,DE:0.55,FL:0.80,GA:0.83,
  HI:0.28,ID:0.56,IL:2.07,IN:0.83,IA:1.46,KS:1.30,KY:0.83,LA:0.56,ME:1.09,MD:1.02,
  MA:1.12,MI:1.32,MN:1.02,MS:0.75,MO:0.93,MT:0.74,NE:1.54,NV:0.55,NH:1.89,NJ:2.13,
  NM:0.67,NY:1.40,NC:0.70,ND:0.88,OH:1.41,OK:0.88,OR:0.87,PA:1.36,RI:1.29,SC:0.52,
  SD:1.22,TN:0.66,TX:1.60,UT:0.52,VT:1.73,VA:0.75,WA:0.84,WV:0.55,WI:1.61,WY:0.55,
  DC:0.56,
};

// Annual homeowner's insurance avg by state (approx. for $300k home, 2024 NAIC data)
const STATE_INSURANCE_ANNUAL = {
  AL:2380,AK:975, AZ:1690,AR:2650,CA:1380,CO:2310,CT:1540,DE:1010,FL:4231,GA:2310,
  HI:560, ID:1090,IL:2049,IN:1280,IA:1280,KS:3460,KY:1680,LA:3540,ME:1100,MD:1240,
  MA:1430,MI:1400,MN:1530,MS:2970,MO:2220,MT:1550,NE:2610,NV:1060,NH:1160,NJ:1440,
  NM:1810,NY:1274,NC:1580,ND:1520,OH:1390,OK:3900,OR:1250,PA:1340,RI:1280,SC:1990,
  SD:1960,TN:2020,TX:3429,UT:1010,VT:1090,VA:1330,WA:1450,WV:1200,WI:1200,WY:1370,
  DC:1200,
};

// Average monthly home utilities (electric + gas + water, EIA/BLS 2024 estimates)
const STATE_UTILITIES_MONTHLY = {
  AL:215,AK:195,AZ:180,AR:205,CA:175,CO:145,CT:245,DE:185,FL:195,GA:195,
  HI:215,ID:155,IL:185,IN:195,IA:175,KS:185,KY:190,LA:200,ME:195,MD:185,
  MA:225,MI:195,MN:185,MS:200,MO:185,MT:165,NE:175,NV:160,NH:215,NJ:210,
  NM:175,NY:215,NC:175,ND:185,OH:185,OK:185,OR:155,PA:185,RI:215,SC:175,
  SD:175,TN:200,TX:195,UT:155,VT:195,VA:175,WA:155,WV:185,WI:175,WY:175,
  DC:155,
};

// Brief homestead exemption notes for common states
const STATE_HOMESTEAD = {
  KY: 'Kentucky offers a homestead exemption ($46,350 off assessed value) for homeowners 65+ or permanently disabled.',
  TX: 'Texas provides a $100,000 homestead exemption from school district taxes, plus additional caps on annual assessment increases.',
  FL: 'Florida\'s $50,000 homestead exemption plus the Save Our Homes cap (3%/yr assessment increase limit) can produce significant long-term savings.',
  CA: 'California\'s Prop 13 limits assessed value increases to 2%/yr for owner-occupied homes — a major long-term advantage in a high-appreciation state.',
  IL: 'Illinois offers a General Homestead Exemption ($10,000 off EAV) and a Long-time Occupant Exemption for incomes under $100,000.',
  GA: 'Georgia provides a standard homestead exemption plus additional senior exemptions. Amounts vary significantly by county.',
  OH: 'Ohio\'s Homestead Exemption provides $25,000 off assessed value for homeowners 65+ or permanently disabled.',
  PA: 'Pennsylvania\'s Homestead/Farmstead Exclusion reduces school property taxes; amounts vary by school district.',
  NC: 'North Carolina offers an Elderly/Disabled Exclusion and a Circuit Breaker deferral program for qualifying homeowners.',
  SC: 'South Carolina provides a 4% assessment ratio for primary residences (vs 6% for non-primary), a major ongoing savings.',
};

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
  const WALK_TYPES = [
    { type: 'grocery_or_supermarket', weight: 25, label: 'Grocery',  icon: '🛒' },
    { type: 'restaurant',             weight: 20, label: 'Dining',   icon: '🍽️' },
    { type: 'transit_station',        weight: 20, label: 'Transit',  icon: '🚌' },
    { type: 'park',                   weight: 15, label: 'Park',     icon: '🌳' },
    { type: 'pharmacy',               weight: 20, label: 'Pharmacy', icon: '💊' },
  ];

  const results = await Promise.allSettled(
    WALK_TYPES.map(({ type }) =>
      googleMapsClient.placesNearby({
        params: { key: googleMapsApiKey, location: `${lat},${lng}`, radius: 800, type },
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
      name: place.name,
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
  const speeds = { police: 30, fire: 35 };
  const dispatch = { police: 2, fire: 1.5 };
  const minutes = Math.round((distanceMiles / (speeds[type] || 30)) * 60 + (dispatch[type] || 2));
  const thresholds = {
    police: { excellent: 5, good: 10, fair: 15 },
    fire: { excellent: 5, good: 8, fair: 12 },
  };
  const t = thresholds[type] || { excellent: 5, good: 10, fair: 15 };
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
  const map = {
    A:  { risk: 'High',      insuranceRequired: true,  description: '1% annual flood chance (100-year floodplain).' },
    AE: { risk: 'High',      insuranceRequired: true,  description: '1% annual flood chance with base flood elevation.' },
    AH: { risk: 'High',      insuranceRequired: true,  description: 'Shallow flooding area.' },
    AO: { risk: 'High',      insuranceRequired: true,  description: 'Sheet flow flooding area.' },
    V:  { risk: 'Very High', insuranceRequired: true,  description: 'Coastal high-velocity wave action.' },
    VE: { risk: 'Very High', insuranceRequired: true,  description: 'Coastal flood with wave action.' },
    X:  { risk: 'Minimal',   insuranceRequired: false, description: 'Outside high-risk flood areas.' },
    B:  { risk: 'Moderate',  insuranceRequired: false, description: '0.2% annual flood chance.' },
    C:  { risk: 'Minimal',   insuranceRequired: false, description: 'Minimal flood hazard.' },
  };
  return map[zone] || { risk: 'Unknown', insuranceRequired: false, description: 'Flood zone data unavailable.' };
}

// State-level tornado frequency tier (NOAA historical average, tornadoes/year)
const TORNADO_TIER = (() => {
  const high   = ['TX','KS','OK','NE','IA','SD','ND','MO','MS','AL','AR','TN','KY','IN','IL','OH'];
  const mod    = ['FL','GA','SC','NC','VA','WV','CO','WY','MT','MN','WI','MI','LA'];
  const low    = ['CA','OR','WA','ID','NV','AZ','NM','UT','AK','HI','ME','NH','VT','MA','RI','CT','NY','NJ','PA','DE','MD','DC'];
  return (state) => {
    if (high.includes(state))  return { tier: 'High',     color: 'orange', note: `${state} averages among the highest tornado frequency in the US. Verify home has an interior shelter or basement.` };
    if (mod.includes(state))   return { tier: 'Moderate', color: 'gold',   note: `${state} sees periodic tornado activity. Most homes here are built with standard storm shutters — ask about storm shelter access.` };
    if (low.includes(state))   return { tier: 'Low',      color: 'green',  note: `${state} has low historical tornado frequency.` };
    return                            { tier: 'Unknown',  color: 'muted',  note: 'Check NOAA Storm Events for this area.' };
  };
})();

function buildClimateChapterHTML(environment, locationInfo) {
  if (!environment) return '';
  const flood  = environment.floodRisk;
  const state  = locationInfo?.state || null;
  const county = locationInfo?.county || 'this county';
  const tornado = state ? TORNADO_TIER(state) : null;

  // ── Flood section ─────────────────────────────────────────────────────────
  let floodPara = '';
  let floodAction = '';
  let floodBadgeColor = 'green';
  if (flood) {
    const zone = flood.zone || 'X';
    const risk = flood.risk || 'Minimal';
    if (risk === 'High' || risk === 'Very High') {
      floodBadgeColor = 'red';
      floodPara = `This parcel falls in FEMA Flood Zone <strong>${esc(zone)}</strong> — a high-risk area with a 1% annual flood chance. Over a 30-year mortgage that translates to a <strong>26% probability of at least one flood event</strong>. Flood insurance is federally required for federally-backed mortgages on this property. NFIP policies for Zone A/AE properties typically run <strong>$1,500–$3,500/year</strong>, though elevation can significantly change that figure. Request an elevation certificate from the seller — it's the single best tool for accurately quoting flood insurance and potentially reducing the premium.`;
      floodAction = 'Get flood insurance quotes before your inspection period ends — the premium varies widely based on the elevation certificate, and a surprise here can change your offer math.';
    } else if (risk === 'Moderate') {
      floodBadgeColor = 'gold';
      floodPara = `This parcel is in FEMA Flood Zone <strong>${esc(zone)}</strong> — a moderate-risk area (0.2% annual flood chance, or roughly 6% over a 30-year mortgage). Flood insurance is not federally required here, but <strong>25% of NFIP claims come from outside high-risk zones</strong>. A preferred-risk policy in moderate zones typically costs $300–$700/year and is worth considering if the property has low-lying areas or sits near a drainage channel.`;
      floodAction = "Confirm your zone at msc.fema.gov — boundaries shift over time and one parcel can differ from the neighbor's. A flood insurance quote takes 15 minutes and locks in your cost picture before closing.";
    } else {
      floodBadgeColor = 'green';
      floodPara = `This parcel is in FEMA Flood Zone <strong>${esc(zone)}</strong> — outside high-risk flood areas. No federally required flood insurance for this address. That said, <strong>25% of NFIP claims still come from Zone X properties</strong> — mostly from heavy rainfall events and local drainage issues rather than river flooding. A preferred-risk policy in Zone X runs around $300–$500/year if you want a cushion.`;
      floodAction = 'Verify your exact zone at msc.fema.gov using the specific parcel address — flood maps are updated periodically and this is the authoritative source.';
    }
  } else {
    floodPara = 'Flood zone data could not be retrieved for this address. Verify directly with FEMA\'s Flood Map Service Center at <strong>msc.fema.gov</strong> before closing — this is the only authoritative parcel-level source.';
    floodBadgeColor = 'muted';
    floodAction = 'Look up this address at msc.fema.gov before your inspection period closes. Flood zone status affects your insurance requirement and cost.';
  }

  // ── Tornado section ───────────────────────────────────────────────────────
  const tornadoHTML = tornado ? `
    <div class="prem-climate-row">
      <div class="prem-climate-row-label">
        🌪️ Tornado Frequency
        <span class="prem-badge" style="${badgeColor(tornado.color)}">${esc(tornado.tier)}</span>
      </div>
      <p class="prem-climate-row-body">${esc(tornado.note)}</p>
    </div>` : '';

  // ── Action checklist ──────────────────────────────────────────────────────
  const actions = [
    {
      icon: '🗺️',
      label: 'Verify your flood zone at msc.fema.gov',
      detail: floodAction,
    },
    {
      icon: '📋',
      label: 'Request the elevation certificate',
      detail: "Ask the seller's agent for the Elevation Certificate (EC) if one exists. It determines your flood insurance premium more than anything else — a 2-foot elevation advantage can cut a premium by 50%.",
    },
    {
      icon: '💰',
      label: 'Get a flood insurance quote before your deadline',
      detail: "Contact your homeowner's insurance agent or visit floodsmart.gov for NFIP quotes. Flood insurance has a 30-day waiting period before it takes effect — get quotes during inspection, not at closing.",
    },
    {
      icon: '🏠',
      label: 'Ask about storm shelter and drainage',
      detail: `Ask the seller about the property's drainage and whether neighbors have experienced basement or yard flooding after heavy rain. In ${esc(county)}, local drainage patterns often matter more than the FEMA zone designation.`,
    },
  ];

  const actionsHTML = actions.map((a) => `
    <div class="prem-safety-action">
      <span class="prem-safety-action-icon">${a.icon}</span>
      <div class="prem-safety-action-text">
        <div class="prem-safety-action-label">${esc(a.label)}</div>
        <div class="prem-safety-action-detail">${a.detail}</div>
      </div>
    </div>`).join('');

  // ── Key Takeaway ──────────────────────────────────────────────────────────
  let takeaway;
  if (!flood) {
    takeaway = 'Flood zone data was unavailable — look up this address at msc.fema.gov before closing. It\'s a 2-minute check that can reveal a $1,500–$3,500/year insurance requirement you won\'t see anywhere else in the listing.';
  } else if (flood.risk === 'High' || flood.risk === 'Very High') {
    takeaway = `Zone ${esc(flood.zone)} is a federally designated high-risk flood area. Flood insurance is required and will cost $1,500–$3,500/year minimum. Get the elevation certificate and insurance quote before your inspection period ends — this number changes your total monthly cost.`;
  } else if (flood.risk === 'Moderate') {
    takeaway = `Zone ${esc(flood.zone)} is a moderate-risk area — no federal requirement, but a preferred-risk policy is cheap here ($300–$700/year). Verify the boundary at msc.fema.gov; flood map updates can shift a parcel from X to AE without any visible change to the property.`;
  } else {
    takeaway = `Zone ${esc(flood.zone)}: outside high-risk flood areas — no flood insurance required. Confirm at msc.fema.gov to lock in that status. Zone X properties still account for 1 in 4 flood insurance claims, usually from heavy rain rather than river overflow.`;
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const floodBadge = flood ? `<span class="prem-badge" style="${badgeColor(floodBadgeColor)}">Zone ${esc(flood.zone)} · ${esc(flood.risk)} Risk</span>` : `<span class="prem-badge" style="${badgeColor('muted')}">Zone Unknown</span>`;

  const body = `
    <div class="prem-climate-flood">
      <div class="prem-climate-flood-head">
        🌊 Flood Zone ${floodBadge}
      </div>
      <div class="prem-narrative">
        <p class="prem-narrative-lead">${floodPara}</p>
      </div>
    </div>
    ${tornadoHTML}
    <div class="prem-safety-actions">
      <div class="prem-safety-actions-label">4 Things to Verify Before You Close</div>
      ${actionsHTML}
    </div>
    <div class="prem-sensory-takeaway">
      <span class="prem-sensory-key">🔑</span>
      <p><strong>Key Takeaway:</strong> ${takeaway}</p>
    </div>
    <p class="prem-disclaimer">Flood zone: FEMA National Flood Hazard Layer, parcel-level. Tornado frequency: NOAA Storm Events Database historical averages by state. Insurance cost estimates: NFIP rate ranges, 2024. Research date: ${today}. Verify all data directly with FEMA and your insurance agent before closing.</p>`;
  return premiumCard('Climate', 'Climate & Weather Risks', body);
}

// Airport analysis (Google Places) ───────────────────────────────────────────

// Keywords that indicate a non-airport aviation venue (paragliding, skydiving, etc.)
const NON_AIRPORT_RE = /paragli|skydiv|balloon|ultralight|glider|soaring|ppg|hang.?glid|flying.?club|flight.?school|air.?sport|airfield.?club/i;
// Keywords that confirm it's a real airport
const AIRPORT_RE = /airport|airfield|air\s*force\s*base|\bafb\b|international|regional|municipal|executive|aviation\s*center|jetport/i;

async function getAirportData(lat, lng, googleMapsClient, googleMapsApiKey) {
  const resp = await googleMapsClient.placesNearby({
    params: { key: googleMapsApiKey, location: `${lat},${lng}`, radius: 32000, type: 'airport' },
  });
  const airports = (resp.data.results || [])
    .filter((p) => !NON_AIRPORT_RE.test(p.name) && AIRPORT_RE.test(p.name))
    .map((p) => ({
      name: p.name,
      distanceMiles: haversineDistance(lat, lng, p.geometry.location.lat, p.geometry.location.lng),
    }))
    .filter((a) => a.distanceMiles <= 20)
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

// Fetch from Overpass API with fallback to alternative instances
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

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
    `(way(around:4000,${lat},${lng})["highway"~"motorway|trunk|primary|secondary"];);` +
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
      `(way(around:4800,${lat},${lng})["railway"~"rail|light_rail|tram"];);` +
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
  const query = `[out:json][timeout:10];(way(around:800,${lat},${lng})["landuse"];);out center tags 10;`;
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
      `?output=JSON&p_lat=${lat}&p_long=${lng}&p_radius=10&p_wt_type=CWS`,
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
const RADON_ZONE_BY_STATE = {
  '08': 1, '17': 1, '18': 1, '19': 1, '20': 1, '21': 1, '26': 1,
  '27': 1, '29': 1, '30': 1, '31': 1, '38': 1, '39': 1, '42': 1,
  '46': 1, '55': 1, '56': 1,
  '12': 3, '15': 3, '22': 3,
};

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

const COMMERCIAL_DEV_TYPES = [
  { type: 'shopping_mall',    label: 'Shopping Center', icon: '🏬' },
  { type: 'supermarket',      label: 'Grocery Store',   icon: '🛒' },
  { type: 'department_store', label: 'Major Retail',    icon: '🏪' },
  { type: 'gym',              label: 'Fitness Center',  icon: '💪' },
  { type: 'movie_theater',    label: 'Entertainment',   icon: '🎬' },
  { type: 'bank',             label: 'Financial',       icon: '🏦' },
];

async function getRecentDevelopmentActivity(lat, lng, googleMapsClient, googleMapsApiKey) {
  const results = await Promise.allSettled(
    COMMERCIAL_DEV_TYPES.map(({ type }) =>
      googleMapsClient.placesNearby({
        params: { key: googleMapsApiKey, location: `${lat},${lng}`, radius: 2400, type },
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

const FROST_DATE_TABLE = {
  '1':  { lastSpring: 'June 15', firstFall: 'August 1',   days: 47  },
  '2':  { lastSpring: 'June 1',  firstFall: 'August 15',  days: 75  },
  '2a': { lastSpring: 'June 1',  firstFall: 'August 15',  days: 75  },
  '2b': { lastSpring: 'June 1',  firstFall: 'August 15',  days: 75  },
  '3':  { lastSpring: 'May 20',  firstFall: 'September 10', days: 113 },
  '3a': { lastSpring: 'May 25',  firstFall: 'September 1', days: 99  },
  '3b': { lastSpring: 'May 15',  firstFall: 'September 15', days: 123 },
  '4':  { lastSpring: 'May 7',   firstFall: 'September 22', days: 138 },
  '4a': { lastSpring: 'May 7',   firstFall: 'September 22', days: 138 },
  '4b': { lastSpring: 'May 1',   firstFall: 'September 25', days: 147 },
  '5':  { lastSpring: 'April 25', firstFall: 'October 5',  days: 163 },
  '5a': { lastSpring: 'April 25', firstFall: 'October 5',  days: 163 },
  '5b': { lastSpring: 'April 15', firstFall: 'October 15', days: 183 },
  '6':  { lastSpring: 'April 10', firstFall: 'October 20', days: 193 },
  '6a': { lastSpring: 'April 10', firstFall: 'October 20', days: 193 },
  '6b': { lastSpring: 'April 15', firstFall: 'October 15', days: 183 },
  '7':  { lastSpring: 'March 25', firstFall: 'November 5', days: 225 },
  '7a': { lastSpring: 'March 25', firstFall: 'November 5', days: 225 },
  '7b': { lastSpring: 'March 15', firstFall: 'November 15', days: 245 },
  '8':  { lastSpring: 'March 1',  firstFall: 'December 1', days: 275 },
  '8a': { lastSpring: 'March 1',  firstFall: 'December 1', days: 275 },
  '8b': { lastSpring: 'February 15', firstFall: 'December 15', days: 303 },
  '9':  { lastSpring: 'February 1',  firstFall: 'December 20', days: 322 },
  '9a': { lastSpring: 'February 1',  firstFall: 'December 20', days: 322 },
  '9b': { lastSpring: 'January 20',  firstFall: 'December 31', days: 345 },
  '10': { lastSpring: 'January 1',   firstFall: 'December 31', days: 365 },
  '10a': { lastSpring: 'January 1',  firstFall: 'December 31', days: 365 },
  '10b': { lastSpring: 'January 1',  firstFall: 'December 31', days: 365 },
  '11': { lastSpring: 'January 1',   firstFall: 'December 31', days: 365 },
  '11a': { lastSpring: 'January 1',  firstFall: 'December 31', days: 365 },
  '11b': { lastSpring: 'January 1',  firstFall: 'December 31', days: 365 },
  '12': { lastSpring: 'January 1',   firstFall: 'December 31', days: 365 },
  '13': { lastSpring: 'January 1',   firstFall: 'December 31', days: 365 },
};

// Genera/species to exclude from native plant results (weedy, toxic, or undesirable)
const NATIVE_PLANT_EXCLUDE = new Set([
  'ambrosia', 'toxicodendron', 'conium', 'solanum carolinense',
  'urtica', 'arctium', 'phytolacca', 'robinia pseudoacacia',
  'cynanchum laeve', 'packera glabella', 'ageratina altissima',
]);

// Common names to exclude from native plants
const NATIVE_PLANT_EXCLUDE_NAMES = ['ragweed', 'poison ivy', 'poison oak', 'poison sumac',
  'hemlock', 'horsenettle', 'pokeweed', 'stinging nettle', 'black locust'];

// Introduced species that are benign — exclude from "invasive" list
const BENIGN_INTRODUCED = new Set([
  'trifolium repens', 'trifolium pratense', 'cichorium intybus', 'glechoma hederacea',
  'lamium purpureum', 'veronica persica', 'medicago lupulina',
  'stellaria media', 'taraxacum officinale', 'plantago major',
  'poa annua', 'capsella bursa-pastoris', 'cerastium fontanum',
  'tussilago farfara', 'sherardia arvensis', 'geranium molle',
  'lolium perenne', 'dactylis glomerata', 'phleum pratense',
  'trifolium incarnatum', 'trifolium hybridum', 'lamium amplexicaule',
  'vicia sativa', 'veronica arvensis', 'ornithogalum umbellatum',
  'potentilla indica', 'ajuga reptans', 'rumex acetosella',
  'hypericum perforatum', 'lotus corniculatus', 'achillea millefolium',
]);

// Mammals to exclude from "yard wildlife" list (domestic, feral, or aquatic-only species)
const DOMESTIC_MAMMALS = new Set([
  'felis catus', 'canis lupus familiaris', 'sus scrofa domesticus',
  'myocastor coypus',  // Coypu/Nutria — aquatic invasive, not a yard animal
]);

const STATE_EXTENSION = {
  AL: { name: 'Alabama Cooperative Extension System', url: 'www.aces.edu' },
  AK: { name: 'University of Alaska Cooperative Extension', url: 'www.uaf.edu/ces' },
  AZ: { name: 'University of Arizona Cooperative Extension', url: 'extension.arizona.edu' },
  AR: { name: 'University of Arkansas Cooperative Extension', url: 'www.uaex.uada.edu' },
  CA: { name: 'UC Cooperative Extension', url: 'ucanr.edu' },
  CO: { name: 'Colorado State University Extension', url: 'extension.colostate.edu' },
  CT: { name: 'UConn Extension', url: 'extension.uconn.edu' },
  DE: { name: 'University of Delaware Cooperative Extension', url: 'sites.udel.edu/extension' },
  FL: { name: 'UF/IFAS Extension', url: 'extension.ifas.ufl.edu' },
  GA: { name: 'UGA Cooperative Extension', url: 'extension.uga.edu' },
  HI: { name: 'University of Hawaii Cooperative Extension', url: 'www.ctahr.hawaii.edu/site/Ext.aspx' },
  ID: { name: 'University of Idaho Extension', url: 'www.uidaho.edu/extension' },
  IL: { name: 'University of Illinois Extension', url: 'extension.illinois.edu' },
  IN: { name: 'Purdue Extension', url: 'extension.purdue.edu' },
  IA: { name: 'Iowa State University Extension', url: 'www.extension.iastate.edu' },
  KS: { name: 'K-State Research and Extension', url: 'www.ksre.k-state.edu' },
  KY: { name: 'UK Cooperative Extension Service', url: 'extension.ca.uky.edu' },
  LA: { name: 'LSU AgCenter', url: 'www.lsuagcenter.com' },
  ME: { name: 'University of Maine Cooperative Extension', url: 'extension.umaine.edu' },
  MD: { name: 'University of Maryland Extension', url: 'extension.umd.edu' },
  MA: { name: 'UMass Extension', url: 'ag.umass.edu/extension' },
  MI: { name: 'MSU Extension', url: 'www.canr.msu.edu/outreach' },
  MN: { name: 'University of Minnesota Extension', url: 'extension.umn.edu' },
  MS: { name: 'Mississippi State University Extension', url: 'extension.msstate.edu' },
  MO: { name: 'University of Missouri Extension', url: 'extension.missouri.edu' },
  MT: { name: 'Montana State University Extension', url: 'www.msuextension.org' },
  NE: { name: 'Nebraska Extension', url: 'extension.unl.edu' },
  NV: { name: 'University of Nevada Cooperative Extension', url: 'www.unce.unr.edu' },
  NH: { name: 'UNH Cooperative Extension', url: 'extension.unh.edu' },
  NJ: { name: 'Rutgers Cooperative Extension', url: 'njaes.rutgers.edu' },
  NM: { name: 'NMSU Cooperative Extension Service', url: 'extension.nmsu.edu' },
  NY: { name: 'Cornell Cooperative Extension', url: 'cce.cornell.edu' },
  NC: { name: 'NC State Extension', url: 'www.ces.ncsu.edu' },
  ND: { name: 'NDSU Extension', url: 'www.ndsu.edu/extension' },
  OH: { name: 'Ohio State University Extension', url: 'extension.osu.edu' },
  OK: { name: 'Oklahoma Cooperative Extension Service', url: 'extension.okstate.edu' },
  OR: { name: 'Oregon State University Extension Service', url: 'extension.oregonstate.edu' },
  PA: { name: 'Penn State Extension', url: 'extension.psu.edu' },
  RI: { name: 'URI Cooperative Extension', url: 'web.uri.edu/coopext' },
  SC: { name: 'Clemson Cooperative Extension', url: 'www.clemson.edu/extension' },
  SD: { name: 'SDSU Extension', url: 'extension.sdstate.edu' },
  TN: { name: 'UT Extension', url: 'extension.tennessee.edu' },
  TX: { name: 'Texas A&M AgriLife Extension', url: 'agrilifeextension.tamu.edu' },
  UT: { name: 'USU Extension', url: 'extension.usu.edu' },
  VT: { name: 'UVM Extension', url: 'www.uvm.edu/extension' },
  VA: { name: 'Virginia Cooperative Extension', url: 'ext.vt.edu' },
  WA: { name: 'WSU Extension', url: 'extension.wsu.edu' },
  WV: { name: 'WVU Extension Service', url: 'extension.wvu.edu' },
  WI: { name: 'UW-Extension', url: 'fyi.extension.wisc.edu' },
  WY: { name: 'University of Wyoming Extension', url: 'www.uwyo.edu/uwext' },
  DC: { name: 'University of the District of Columbia Extension', url: 'udc.edu/causes/cooperative-extension' },
};

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

async function getGardenData(lat, lng, locationInfo) {
  const zip = locationInfo?.zip || '';
  const [zoneRes, nativePlantsRes, invasivePlantsRes, wildlifeRes, birdsRes] =
    await Promise.allSettled([
      getHardinessZone(zip),
      iNatSpeciesCounts(lat, lng, 16, 47126, { native: true }, 30),
      iNatSpeciesCounts(lat, lng, 32, 47126, { introduced: true }, 25),
      iNatSpeciesCounts(lat, lng, 16, 40151, {}, 15),
      iNatSpeciesCounts(lat, lng, 16, 3, {}, 20),
    ]);

  const val = (r, fallback) => r.status === 'fulfilled' ? r.value : fallback;

  return {
    hardinessZone: val(zoneRes, null),
    nativePlants:  filterNativePlants(val(nativePlantsRes, [])),
    invasivePlants: filterInvasivePlants(val(invasivePlantsRes, [])),
    wildlife:      filterWildlife(val(wildlifeRes, [])),
    birds:         filterBirds(val(birdsRes, [])),
  };
}

function buildWhatWillGrowHTML(gardenData, soil, locationInfo) {
  if (!gardenData) return '';

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const county = locationInfo?.county || '';
  const state = locationInfo?.state || '';
  const ext = STATE_EXTENSION[state] || null;
  const { hardinessZone, nativePlants, invasivePlants, wildlife, birds } = gardenData;

  // ── Growing Conditions ──
  let conditionsPara = '';
  if (hardinessZone) {
    const { zone, tempRange, frost } = hardinessZone;
    const zoneNote = tempRange ? ` (average winter low: ${tempRange}°F)` : '';
    conditionsPara = `This property sits in USDA Hardiness Zone ${esc(zone)}${zoneNote}. `;
    if (frost) {
      conditionsPara += `The last spring frost typically falls around <strong>${esc(frost.lastSpring)}</strong> and the first fall frost arrives around <strong>${esc(frost.firstFall)}</strong> — giving you a growing season of roughly ${frost.days} days. `;
      if (frost.days >= 180) {
        conditionsPara += `That's enough time for tomatoes, peppers, squash, and most vegetables to complete a full cycle.`;
      } else if (frost.days >= 120) {
        conditionsPara += `That's enough time for fast-maturing vegetables and most annuals, though warm-season crops need a head start indoors.`;
      } else {
        conditionsPara += `It's a shorter season — focus on cold-hardy crops and varieties bred for quick maturity.`;
      }
    }
  } else {
    conditionsPara = `Hardiness zone data was not available for this address. You can look up your zone at the USDA Plant Hardiness Zone Map at planthardiness.ars.usda.gov.`;
  }

  // ── Soil ──
  let soilPara = '';
  if (soil) {
    const name = soil.muname || 'this soil type';
    const drain = soil.drainageCategory;
    soilPara = `The lot sits on ${esc(name)}${soil.drainagecl ? ` — USDA drainage class: ${esc(soil.drainagecl.toLowerCase())}` : ''}. `;
    if (drain && drain.color !== 'muted') {
      soilPara += esc(drain.implication) + ' ';
    }
    if (drain?.color === 'green' || drain?.color === 'lightgreen') {
      soilPara += `A layer of compost before planting and you're in good shape.`;
    } else if (drain?.color === 'orange' || drain?.color === 'red') {
      soilPara += `Raised beds are a practical solution for vegetable gardens — they let you control drainage regardless of the native soil conditions.`;
    }
  }

  // ── Native Plants ──
  let nativePlantsHTML = '';
  if (nativePlants.length > 0) {
    const items = nativePlants.map((p) =>
      `<li class="grow-plant-item"><span class="grow-plant-name">${esc(p.name)}</span> <em class="grow-plant-sci">(${esc(p.sci)})</em></li>`
    ).join('\n');
    nativePlantsHTML = `
    <div class="grow-subsection">
      <div class="grow-subsection-label">🌿 What Grows Naturally Here</div>
      <p class="prem-narrative-body">These native plants thrive in this region without much help — they've been doing it for centuries. They're adapted to your soil, your rainfall, and your winters, which means less maintenance and more resilience once established.</p>
      <ul class="grow-plant-list">${items}
      </ul>
    </div>`;
  }

  // ── Invasive Plants ──
  let invasivePlantsHTML = '';
  if (invasivePlants.length > 0) {
    const items = invasivePlants.map((p) =>
      `<li class="grow-plant-item"><span class="grow-plant-name">${esc(p.name)}</span> <em class="grow-plant-sci">(${esc(p.sci)})</em></li>`
    ).join('\n');
    invasivePlantsHTML = `
    <div class="grow-subsection">
      <div class="grow-subsection-label">⚠️ What to Avoid</div>
      <p class="prem-narrative-body">These introduced plants are frequently observed in this area and cause real problems — they outcompete native plants, can damage trees and structures, or spread aggressively once established. Worth knowing before you plant anything from a nursery.</p>
      <ul class="grow-plant-list">${items}
      </ul>
    </div>`;
  }

  // ── Wildlife ──
  let wildlifeHTML = '';
  if (wildlife.length > 0 || birds.length > 0) {
    let wildlifePara = '';
    if (wildlife.length > 0) {
      const mammalNames = wildlife.slice(0, 4).map((w) => esc(w.name)).join(', ');
      wildlifePara += `Common mammals observed in this area include ${mammalNames}. `;
      if (wildlife.some((w) => w.name.toLowerCase().includes('deer'))) {
        wildlifePara += `If deer are active nearby, plan any vegetable garden or ornamental plantings with deer-resistant species or fencing. `;
      }
    }
    if (birds.length > 0) {
      const birdNames = birds.slice(0, 5).map((b) => esc(b.name)).join(', ');
      wildlifePara += `Common backyard birds in this area include ${birdNames}. A simple feeder and a water source will bring them close.`;
    }
    wildlifeHTML = `
    <div class="grow-subsection">
      <div class="grow-subsection-label">🦌 Wildlife You'll Share the Yard With</div>
      <p class="prem-narrative-body">${wildlifePara}</p>
    </div>`;
  }

  // ── Extension Office CTA ──
  let extCTA = '';
  if (ext) {
    const countyLabel = county ? `${esc(county)}` : esc(state);
    extCTA = `<p class="grow-ext-cta">Your local Cooperative Extension office offers free soil testing and planting guides specific to your county. For ${countyLabel}: <strong>${esc(ext.name)}</strong> — <a href="https://${ext.url}" target="_blank" rel="noopener noreferrer">${esc(ext.url)}</a></p>`;
  } else {
    extCTA = `<p class="grow-ext-cta">Your local Cooperative Extension office offers free soil testing and planting guides specific to your county — search for your state's land-grant university extension service for county-specific resources.</p>`;
  }

  // ── Opportunity paragraph ──
  let opportunityPara = '';
  if (hardinessZone && hardinessZone.frost) {
    const { days } = hardinessZone.frost;
    if (days >= 200) {
      opportunityPara = `A well-maintained yard in this zone with native plantings can become genuinely beautiful with relatively little effort. The growing season is long, rainfall is typically reliable in this region, and native plants require almost no intervention once established.`;
    } else if (days >= 130) {
      opportunityPara = `A well-chosen native garden in this zone rewards low-maintenance effort — the plants are built for these winters and summers, and they'll return every year without replanting. The growing season gives you time for most of what you'd want to grow.`;
    } else {
      opportunityPara = `This is a shorter growing season, but the region's native plants are perfectly matched to it. Focus on cold-hardy perennials and native shrubs — they'll come back each year and don't need babying.`;
    }
  }

  const sources = [
    hardinessZone ? 'USDA Plant Hardiness Zone Map (phzmapi.org)' : null,
    nativePlants.length > 0 ? 'iNaturalist research-grade observations' : null,
    soil ? 'USDA Web Soil Survey' : null,
  ].filter(Boolean).join('; ');

  const body = `
    <p class="prem-narrative-lead">${conditionsPara}</p>
    ${soilPara ? `
    <div class="grow-subsection">
      <div class="grow-subsection-label">🪱 Your Soil</div>
      <p class="prem-narrative-body">${soilPara}</p>
    </div>` : ''}
    ${nativePlantsHTML}
    ${invasivePlantsHTML}
    ${wildlifeHTML}
    ${opportunityPara ? `
    <div class="grow-subsection">
      <div class="grow-subsection-label">✨ The Opportunity</div>
      <p class="prem-narrative-body">${opportunityPara}</p>
      ${extCTA}
    </div>` : extCTA}
    <div class="prem-sensory-takeaway">
      <span class="prem-sensory-key">🔑</span>
      <p><strong>Key Takeaway:</strong> ${hardinessZone ? `Zone ${esc(hardinessZone.zone)} gives you ${hardinessZone.frost ? `a ${hardinessZone.frost.days}-day growing season` : 'a defined growing season'}. Native plants adapted to this region require the least effort and give back the most.` : 'Native plants adapted to your region require the least effort and give back the most.'}</p>
    </div>
    <p class="prem-disclaimer">Hardiness zone: USDA phzmapi.org, ZIP-code level. Frost dates are 30-year climate normals correlated with USDA hardiness zone. ${sources ? `Sources: ${esc(sources)}. ` : ''}Wildlife observations: iNaturalist research-grade, 10-mile radius. Research date: ${today}.</p>`;

  return premiumCard('Your Yard', 'What Will Grow Here', body);
}

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

    const TECH_MAP = {
      10: 'DSL', 11: 'ADSL2+', 12: 'VDSL', 40: 'Cable', 41: 'DOCSIS 3.0',
      42: 'DOCSIS 3.1+', 50: 'Fiber', 60: 'Satellite', 70: 'Fixed Wireless',
      300: 'LTE Fixed Wireless', 400: 'Licensed Fixed Wireless', 500: 'Unlicensed Fixed Wireless',
    };

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
          tech:     TECH_MAP[techCode] || `Type ${techCode}`,
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

async function getPremiumData({ lat, lng, originLatLng, locationInfo, googleMapsClient, googleMapsApiKey, getDriveTime, highwayDriveMinutes }) {
  const fips = await getCensusFIPS(lat, lng);

  const [demographics, propertyData, walkability, emergency, environment, safetyLocation, schools, growth, propIntel, gardenData] =
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
    ]);

  const val = (r) => (r.status === 'fulfilled' ? r.value : null);
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
    locationInfo,
  };
}

// ── FR-021: Pedestrian environment by walkability score ───────────────────────

function getPedestrianFeatures(score) {
  if (score >= 90) return {
    present: ['Well-connected sidewalk network', 'Marked crosswalks throughout', 'Pedestrian signals at intersections', 'Street lighting on main routes'],
    note: null,
  };
  if (score >= 70) return {
    present: ['Sidewalks on most streets', 'Crosswalks at main intersections', 'Street lighting available'],
    note: 'Verify sidewalk coverage on residential side streets',
  };
  if (score >= 50) return {
    present: ['Sidewalks on main roads', 'Some pedestrian crossings'],
    note: 'Sidewalk coverage may be limited on some side streets',
  };
  if (score >= 25) return {
    present: ['Sidewalks on select main roads'],
    note: 'Most walking routes require sharing the roadway — plan routes carefully',
  };
  return {
    present: [],
    note: 'Limited pedestrian infrastructure in this area — verify routes before walking',
  };
}

// ── HTML builders ──────────────────────────────────────────────────────────────

function badgeColor(color) {
  const map = {
    green: 'background:rgba(40,167,69,0.12);color:#1e7e34',
    lightgreen: 'background:rgba(92,184,92,0.12);color:#3a9a3a',
    gold: 'background:rgba(184,149,106,0.14);color:#8a6a40',
    orange: 'background:rgba(253,126,20,0.12);color:#c0530a',
    red: 'background:rgba(220,53,69,0.12);color:#a71d2a',
    muted: 'background:rgba(107,107,107,0.1);color:#555',
  };
  return map[color] || map.muted;
}

function premiumCard(label, title, bodyHTML) {
  return `
  <div class="chapter-card">
    <div class="chapter-header">
      <div class="chapter-label">${esc(label)}</div>
      <div class="chapter-title">${esc(title)}</div>
    </div>
    <div class="chapter-body premium-body">
      ${bodyHTML}
    </div>
  </div>`;
}

// FR-017: Schools & Education
function buildSchoolRatingsHTML(schools) {
  if (!schools) return '';
  const publicSchools  = schools.public  || [];
  const privateSchools = schools.private || [];
  const nearest = publicSchools.find((s) => s != null);

  // ── Assigned school alert ─────────────────────────────────────────────────
  const assignedAlertHTML = `
    <div class="prem-school-assigned-alert">
      <div class="prem-school-assigned-icon">⚠️</div>
      <div class="prem-school-assigned-text">
        <strong>Nearest school is not necessarily your assigned school.</strong>
        Attendance boundaries don't follow distance logic — a school 0.5 miles away may serve a different zone. Before making any decision based on a specific school, call the district office with your exact address.
        <div class="prem-school-assigned-action">Action: Call <strong>the district office</strong> with your address and ask which school your parcel is zoned to — takes 5 minutes.</div>
      </div>
    </div>`;

  // ── Lead narrative ────────────────────────────────────────────────────────
  const narrativeHTML = nearest ? `
    <div class="prem-narrative">
      <p class="prem-narrative-lead">The nearest public ${nearest.level.toLowerCase()} school is ${nearest.driveTimeMinutes != null ? `${nearest.driveTimeMinutes} minute${nearest.driveTimeMinutes !== 1 ? 's' : ''} away` : `${nearest.distanceMiles} miles away`}—${nearest.driveTimeMinutes != null && nearest.driveTimeMinutes <= 5 ? 'close enough that walking or biking is realistic on good weather days' : nearest.driveTimeMinutes != null && nearest.driveTimeMinutes <= 10 ? 'a quick drive that fits easily into any morning routine' : nearest.driveTimeMinutes != null && nearest.driveTimeMinutes <= 15 ? 'a manageable commute once you know the route' : 'a commute worth timing on a real school morning'}. The listings below show the nearest school at each level — not your assigned school.</p>
      <p class="prem-narrative-body">What the data doesn't tell you: average class size, after-school care cutoff times, or how active the parent community is. These are often the deciding factors for families, and none appear in any public directory. Schedule a tour on a regular school day and talk to parents at afternoon pickup — that's where you get the real picture.</p>
    </div>` : '';

  // ── Public school cards ───────────────────────────────────────────────────
  const publicItems = publicSchools.map((s) => {
    if (!s) return '';
    return `
    <div class="prem-school-card">
      <div class="prem-school-header">
        <div class="prem-school-level">Public ${esc(s.level)} School</div>
        <div class="prem-school-name">${esc(s.name)}</div>
        <div class="prem-school-addr">${esc(s.address)}</div>
        <div class="prem-school-meta">
          <span class="prem-school-dist">${esc(s.distanceMiles)} mi away</span>
          ${s.driveTimeMinutes != null ? `<span class="prem-school-time">${s.driveTimeMinutes} min drive</span>` : ''}
        </div>
      </div>
    </div>`;
  }).filter(Boolean).join('');

  // ── Private school section ────────────────────────────────────────────────
  let privateHTML = '';
  if (privateSchools.length > 0) {
    const privateItems = privateSchools.map((s) => `
      <div class="prem-school-choice-item">
        <div class="prem-school-choice-name">${esc(s.name)}</div>
        <div class="prem-school-choice-meta">${esc(s.distanceMiles)} mi away · ${esc(s.address)}</div>
      </div>`).join('');
    privateHTML = `
    <div class="prem-school-choice-section">
      <div class="prem-school-choice-label">Private Schools Within 10 Miles</div>
      ${privateItems}
      <p class="prem-school-choice-note">Contact each school directly for tuition, enrollment, and admissions timelines. Most private schools require applications 6–12 months before the school year starts.</p>
    </div>`;
  }

  // ── Questions to ask checklist ────────────────────────────────────────────
  const checklistHTML = `
    <div class="prem-safety-actions">
      <div class="prem-safety-actions-label">4 Questions to Ask Before You Close</div>
      <div class="prem-safety-action">
        <div class="prem-safety-action-icon">🏫</div>
        <div>
          <div class="prem-safety-action-label">Confirm your assigned school</div>
          <div class="prem-safety-action-detail">Call the district office with your exact address — ask which school your specific parcel is zoned to at each level. Boundaries can split streets.</div>
        </div>
      </div>
      <div class="prem-safety-action">
        <div class="prem-safety-action-icon">📐</div>
        <div>
          <div class="prem-safety-action-label">Ask about boundary stability</div>
          <div class="prem-safety-action-detail">Ask the district: "Have boundaries changed in the last 5 years?" and "Are any redistricting plans in review?" Kids switching schools mid-elementary is a real disruption.</div>
        </div>
      </div>
      <div class="prem-safety-action">
        <div class="prem-safety-action-icon">⏰</div>
        <div>
          <div class="prem-safety-action-label">Check after-school care availability</div>
          <div class="prem-safety-action-detail">Ask the school's front office: Is on-site care available? What are the pickup cutoff times and cost? This is often a dealbreaker for working parents and has a waitlist.</div>
        </div>
      </div>
      <div class="prem-safety-action">
        <div class="prem-safety-action-icon">👥</div>
        <div>
          <div class="prem-safety-action-label">Talk to current parents</div>
          <div class="prem-safety-action-detail">Walk the school at afternoon pickup. Ask parents what they wish they'd known. Class size, teacher turnover, and community involvement don't appear in any public database.</div>
        </div>
      </div>
    </div>`;

  // ── Key Takeaway ──────────────────────────────────────────────────────────
  let takeawayText = '';
  if (nearest && nearest.driveTimeMinutes != null) {
    takeawayText = nearest.driveTimeMinutes <= 5
      ? `The nearest public ${nearest.level.toLowerCase()} school is just ${nearest.driveTimeMinutes} minutes away — but confirm your assigned school with the district before treating that as your actual option.`
      : nearest.driveTimeMinutes <= 12
      ? `Public schools are within a reasonable drive, but your assigned school may differ from the nearest one. Confirm your zone before factoring any specific school into your decision.`
      : `School commutes here are on the longer side. Confirm your assigned school with the district — and explore private options if public commute times are a concern.`;
  } else if (publicSchools.some(Boolean)) {
    takeawayText = 'Schools are accessible in this area. Before relying on any specific school, verify your assigned zone with the district — nearest school and assigned school are often different.';
  }

  const takeawayHTML = takeawayText ? `
    <div class="prem-sensory-takeaway">
      <div class="prem-sensory-takeaway-label">Key Takeaway</div>
      <p>${esc(takeawayText)}</p>
    </div>` : '';

  const body = `
    ${assignedAlertHTML}
    ${narrativeHTML}
    <div class="prem-school-section-label">Nearest Public Schools</div>
    ${publicItems || '<p class="prem-na">No public schools found within search radius.</p>'}
    ${privateHTML}
    ${checklistHTML}
    ${takeawayHTML}`;

  return premiumCard('Schools', 'Schools & Education', body);
}

// FR-018: Safety & Emergency Response
function buildCrimeHTML(crime, emergency) {
  if (!crime && !emergency) return '';
  const police = emergency?.police;
  const fire   = emergency?.fire;
  if (!police && !fire) return '';

  const city   = crime?.city   || '';
  const county = crime?.county || 'this county';

  // ── Police response ───────────────────────────────────────────────────────
  let policePara = '';
  if (police) {
    const mins = police.response.estimate;
    const cat  = police.response.category;
    const dist = parseFloat(police.distanceMiles);
    const context =
      mins <= 5  ? `That's an excellent response time — faster than most suburban areas. Response quality at this level is genuinely meaningful in an emergency.` :
      mins <= 8  ? `That's a solid response time, consistent with typical suburban service levels and well within the range where outcomes are good across most emergency types.` :
      mins <= 12 ? `That's an average response time. For medical emergencies, every minute matters — knowing basic first aid and having a plan adds a real margin of safety.` :
      mins <= 20 ? `A ${mins}-minute response estimate is common for rural and exurban areas. Working smoke detectors, a CO detector, and a family emergency plan matter more when professional help is further away.` :
      `At ${mins} minutes, response is extended — typical for sparsely populated rural areas. Fire extinguishers on each floor, interconnected smoke alarms, and a practiced family escape plan are practical necessities here, not just suggestions.`;
    policePara = `The nearest police station is ${esc(police.name)}, ${police.distanceMiles} miles away. Estimated response time: <strong>~${mins} minutes</strong> <span class="prem-inline-badge" style="${badgeColor(cat.color)}">${esc(cat.label)}</span>. ${context}`;
  }

  // ── Fire response ─────────────────────────────────────────────────────────
  let firePara = '';
  if (fire) {
    const mins = fire.response.estimate;
    const cat  = fire.response.category;
    const context =
      mins <= 5  ? `That's an excellent fire response — critical for limiting structural damage. Homes near stations like this often qualify for lower homeowner's insurance rates (ISO rating 1–4 range).` :
      mins <= 8  ? `A ${mins}-minute fire response is solid — this is the range where professional suppression and modern systems work well together.` :
      mins <= 12 ? `A ${mins}-minute fire response means a fire has time to spread beyond one room. Working smoke detectors in every bedroom and a household fire escape plan are essential.` :
      `A ${mins}-minute fire response time is extended. A house fire doubles in size every minute — this is a meaningful practical consideration. Ask your insurance agent for the ISO fire protection class rating, which directly affects your premium.`;
    firePara = `${esc(fire.name)} is ${fire.distanceMiles} miles away. Estimated fire response: <strong>~${mins} minutes</strong> <span class="prem-inline-badge" style="${badgeColor(cat.color)}">${esc(cat.label)}</span>. ${context}`;
  }

  // ── Insurance / ISO note ──────────────────────────────────────────────────
  const isoNote = `The ISO Public Protection Classification (PPC) for this address determines your homeowner's insurance premium for fire coverage. Ratings 1–4 are excellent; 8–10 mean limited station coverage and higher premiums. Your insurance agent can pull this — it takes one minute and can be worth hundreds per year in premium differences.`;

  // ── 4-item research checklist ─────────────────────────────────────────────
  const actions = [
    {
      icon: '🗺️',
      label: 'Run a crime map',
      detail: `Search "crime map ${city || county}" — most police departments publish neighborhood-level incident maps. Look at the 3-month trend on your specific block, not the city average.`,
    },
    {
      icon: '🏘️',
      label: 'Find the neighborhood watch',
      detail: `Ask the listing agent if there's an active neighborhood watch. Search "[neighborhood name] Nextdoor" — active online communities indicate real neighbor engagement, which correlates with lower property crime.`,
    },
    {
      icon: '📞',
      label: 'Call the community resource officer',
      detail: `Call the non-emergency line for ${city ? esc(city) + ' Police' : 'the local police department'} and ask for the community resource officer for this precinct. They'll tell you more about the area than any statistic.`,
    },
    {
      icon: '🔐',
      label: 'Get the ISO fire protection rating',
      detail: `Ask your homeowner's insurance agent for the ISO PPC rating for this specific address. The number directly sets your fire coverage premium — it's address-specific, not neighborhood-level.`,
    },
  ];

  const actionsHTML = actions.map((a) => `
    <div class="prem-safety-action">
      <span class="prem-safety-action-icon">${a.icon}</span>
      <div class="prem-safety-action-text">
        <div class="prem-safety-action-label">${esc(a.label)}</div>
        <div class="prem-safety-action-detail">${a.detail}</div>
      </div>
    </div>`).join('');

  // ── Key Takeaway ──────────────────────────────────────────────────────────
  let takeaway;
  const pmins = police?.response?.estimate;
  const fmins = fire?.response?.estimate;
  if (pmins && pmins <= 5) {
    takeaway = `Police response of ~${pmins} min is excellent — a genuine safety asset for this address. Check the ISO fire protection rating with your insurance agent to confirm fire coverage costs.`;
  } else if (fmins && fmins > 12) {
    takeaway = `Fire station response of ~${fmins} min is extended. Get the ISO PPC rating before closing — it affects your insurance premium and tells you the official fire risk classification for this address.`;
  } else if (pmins && pmins > 15) {
    takeaway = `Police response of ~${pmins} min reflects a rural service area. A family emergency plan, working smoke and CO detectors, and fire extinguishers on every floor are practical necessities — not optional — at this response time.`;
  } else {
    takeaway = `Response times are within normal range for this area type. Run a crime map search on the specific block before you close — it takes 5 minutes and shows the street-level picture that neighborhood-level stats miss.`;
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const body = `
    <div class="prem-narrative">
      ${policePara ? `<p class="prem-narrative-lead">${policePara}</p>` : ''}
      ${firePara   ? `<p class="prem-narrative-body">${firePara}</p>`   : ''}
      <p class="prem-narrative-body">${isoNote}</p>
    </div>
    <div class="prem-safety-actions">
      <div class="prem-safety-actions-label">4 Things to Research Before You Close</div>
      ${actionsHTML}
    </div>
    <div class="prem-sensory-takeaway">
      <span class="prem-sensory-key">🔑</span>
      <p><strong>Key Takeaway:</strong> ${takeaway}</p>
    </div>
    <p class="prem-disclaimer">Response times are estimates based on station distance and typical dispatch speeds. Actual times vary by call volume and unit availability. Research date: ${today}. For current safety data, contact ${city ? esc(city) + ' Police or' : ''} ${esc(county)} Emergency Management.</p>`;
  return premiumCard('Safety', 'Safety & Emergency Response', body);
}

// FR-027: Sensory & Environmental
function buildSensoryEnvironmentalHTML(env) {
  if (!env) return '';
  const { airports, roadNoise, rail, lightPollution, airQuality, waterQuality, radon, ejscreen } = env;

  // ── Section A: What You'll Hear ───────────────────────────────────────────

  let airportPara;
  if (!airports || !airports.length) {
    airportPara = 'No airports are within 20 miles of this address. Commercial and general aviation flight traffic is not a daily experience here.';
  } else {
    const n = airports[0];
    const d = n.distanceMiles.toFixed(1);
    if (n.distanceMiles < 5) {
      airportPara = `${esc(n.name)} is ${d} miles away — close enough that aircraft on approach or departure are frequently audible, particularly in the mornings and evenings. Consider visiting the property during early morning hours (6–9am weekdays) before committing.`;
    } else if (n.distanceMiles < 10) {
      airportPara = `${esc(n.name)} is approximately ${d} miles away. Aircraft on approach or departure paths may be audible at this distance during peak periods. Worth visiting at different times of day to gauge the actual sound level.`;
    } else if (n.distanceMiles < 15) {
      airportPara = `The nearest airport, ${esc(n.name)}, is ${d} miles away. Depending on prevailing winds and runway configuration, some approach traffic may occasionally be audible overhead. At this distance, it's not typically disruptive.`;
    } else {
      airportPara = `The nearest airport, ${esc(n.name)}, is ${d} miles away. At that distance, aircraft are at altitude and not meaningfully audible at ground level. Flight noise is not a daily factor here.`;
    }
    if (airports.length > 1) {
      const others = airports.slice(1, 3).map((a) => `${esc(a.name)} (${a.distanceMiles.toFixed(1)} mi)`).join(' and ');
      airportPara += ` ${others} ${airports.length === 2 ? 'is' : 'are'} also in the region.`;
    }
  }

  let roadNoisePara;
  if (!roadNoise) {
    roadNoisePara = 'Road noise data was not available for this address.';
  } else {
    const { dnl, source, nearestRoad } = roadNoise;
    const srcNote = source === 'BTS' ? ' (BTS National Transportation Noise Map)' : ' (estimated from highway proximity)';
    const roadRef = nearestRoad?.name ? ` Nearest major road: ${esc(nearestRoad.name)}.` : '';
    if (dnl < 55) {
      roadNoisePara = `Road noise is low — approximately ${dnl} dB day-night average${srcNote}. That's well below the FHWA's 65 dB residential threshold, and in a range most people describe as quiet.${roadRef}`;
    } else if (dnl < 65) {
      roadNoisePara = `Road noise is moderate — approximately ${dnl} dB day-night average${srcNote}. Highway sound may be noticeable with windows open during busy periods. This is within FHWA's acceptable residential range, but worth evaluating at different times of day.${roadRef}`;
    } else {
      roadNoisePara = `Road noise is elevated at approximately ${dnl} dB day-night average${srcNote} — above FHWA's 65 dB residential standard. Outdoor spaces and open windows will carry highway sound. Evaluate this on-site, not just on paper.${roadRef}`;
    }
  }

  let railPara;
  if (!rail) {
    railPara = 'No freight or passenger rail lines run within 3 miles of this address. Train noise is not a factor here.';
  } else {
    const typeLabel = rail.type === 'light_rail' ? 'light rail' : rail.type === 'tram' ? 'tram' : 'rail';
    const nameStr = rail.name ? `${esc(rail.name)} ` : '';
    if (rail.distanceMiles < 0.25) {
      railPara = `A ${nameStr}${typeLabel} line runs less than a quarter mile from this address. At that proximity, trains will be audible indoors. Freight schedules aren't fixed — trains can pass at any hour, including overnight.`;
    } else if (rail.distanceMiles < 0.75) {
      railPara = `A ${nameStr}${typeLabel} line runs approximately ${Math.round(rail.distanceMiles * 5280)} feet away. Whether trains are audible inside depends on frequency and construction. Listen for this during any site visit.`;
    } else {
      railPara = `The nearest ${typeLabel} line (${nameStr.trim() || 'unnamed'}) is ${rail.distanceMiles.toFixed(2)} miles away. At that distance, trains are unlikely to be audible indoors except possibly on quiet nights with windows open.`;
    }
  }

  const sectionA = `
    <div class="prem-sensory-section">
      <div class="prem-sensory-label">What You'll Hear</div>
      <div class="prem-narrative">
        <p class="prem-narrative-lead">${airportPara}</p>
        <p class="prem-narrative-body">${roadNoisePara}</p>
        <p class="prem-narrative-body">${railPara}</p>
      </div>
    </div>`;

  // ── Section B: What You'll See at Night ──────────────────────────────────

  let lightPara;
  if (!lightPollution) {
    lightPara = 'Night sky brightness data was not available for this address.';
  } else {
    const { bortle, label, desc } = lightPollution;
    lightPara = `The night sky here is roughly Bortle ${bortle} — a ${esc(label)}. ${esc(desc)} This is estimated from Census tract population density and nearby land use patterns, not satellite measurement.`;
  }

  const sectionB = `
    <div class="prem-sensory-section">
      <div class="prem-sensory-label">What You'll See at Night</div>
      <div class="prem-narrative">
        <p class="prem-narrative-lead">${lightPara}</p>
      </div>
    </div>`;

  // ── Section C: What You Can't See ────────────────────────────────────────

  let airPara;
  if (airQuality) {
    const { aqi, category: c, primaryPollutant } = airQuality;
    const pollNote = primaryPollutant && primaryPollutant !== 'N/A' ? ` Primary pollutant: ${esc(primaryPollutant)}.` : '';
    airPara = `Air quality in this region averages AQI ${aqi} — ${esc(c.label.toLowerCase())}. ${esc(c.description)}${pollNote} Source: EPA AirNow, nearest monitoring station.`;
  } else {
    airPara = 'Air quality data was not available for this address. Check EPA AirNow (airnow.gov) for current conditions in your area.';
  }

  let waterPara;
  if (!waterQuality) {
    waterPara = 'EPA drinking water records were not accessible for this address. Check historical water quality at <a href="https://www.ewg.org/tapwater/" target="_blank" rel="noopener">EWG\'s Tap Water Database</a> (search by zip code) and request your utility\'s Consumer Confidence Report before closing.';
  } else if (!waterQuality.violations?.length) {
    waterPara = `Water here is supplied by ${esc(waterQuality.systemName)}. EPA Safe Drinking Water records show no health-based violations in the last five years — a clean record. You can request the annual Consumer Confidence Report from the utility for full detail.`;
  } else {
    const v = waterQuality.violations[0];
    const dateStr = v.date ? ` in ${v.date.slice(0, 4)}` : '';
    const statusStr = (v.status && v.status !== 'Unknown') ? ` — ${esc(v.status)}` : '';
    waterPara = `Water here is supplied by ${esc(waterQuality.systemName)}. EPA records show ${waterQuality.violations.length} violation${waterQuality.violations.length > 1 ? 's' : ''} in the last five years. The most recent: ${esc(v.type)}${dateStr}${statusStr}. Request the utility's Consumer Confidence Report before closing to understand current status.`;
  }

  let radonPara;
  if (!radon) {
    radonPara = 'Radon zone data requires county identification. Verify your county\'s EPA radon zone at epa.gov/radon. Testing is inexpensive and recommended before purchase.';
  } else if (radon.zone === 1) {
    radonPara = 'This county is EPA Radon Zone 1 — high geologic potential for elevated indoor radon. Radon is the second-leading cause of lung cancer, and it\'s odorless and invisible. Testing is strongly recommended before closing: DIY kits run $15–$30 and results come back in days. If elevated, mitigation systems typically cost $800–$2,500 installed.';
  } else if (radon.zone === 2) {
    radonPara = 'This county is EPA Radon Zone 2 — moderate geologic potential for radon. Testing is recommended, particularly if the home has below-grade living space. Kits are inexpensive and widely available.';
  } else {
    radonPara = 'This county is EPA Radon Zone 3 — lower geologic potential for elevated radon. While the risk is reduced here, no zone is radon-free. A quick test remains a reasonable precaution, especially for homes with basements.';
  }
  if (radon) radonPara += ' Note: Zone classifications are county-level, not parcel-specific. Source: EPA Radon Zone Map.';

  let ejPara;
  if (!ejscreen) {
    ejPara = 'EPA environmental screening (EJSCREEN) data was not accessible via API. Check environmental hazard proximity at <a href="https://ejscreen.epa.gov/mapper/" target="_blank" rel="noopener">EPA EJSCREEN</a> — search this address to see Superfund site proximity, air toxics, and chemical facility flags for this location.';
  } else if (ejscreen.flagged) {
    const flags = [];
    if (ejscreen.superfundPct > 75) flags.push(`${ejscreen.superfundPct}th percentile nationally for proximity to Superfund sites`);
    if (ejscreen.rmpPct > 75)       flags.push(`${ejscreen.rmpPct}th percentile for chemical risk facilities`);
    if (ejscreen.tsdfPct > 75)      flags.push(`${ejscreen.tsdfPct}th percentile for hazardous waste facilities`);
    ejPara = `EPA EJSCREEN flags this location: ${flags.join('; ')}. That means more nearby industrial or hazardous-site activity than the majority of US residential locations. Review the EPA ECHO database for specific facilities near this address.`;
  } else {
    ejPara = 'EPA environmental screening (EJSCREEN) shows no significant proximity concerns — below the 75th national percentile for Superfund sites, chemical risk facilities, and hazardous waste sites.';
  }

  const sectionC = `
    <div class="prem-sensory-section">
      <div class="prem-sensory-label">What You Can't See</div>
      <div class="prem-narrative">
        <p class="prem-narrative-body">${airPara}</p>
        <p class="prem-narrative-body">${waterPara}</p>
        <p class="prem-narrative-body">${radonPara}</p>
        <p class="prem-narrative-body">${ejPara}</p>
      </div>
    </div>`;

  // ── Key Takeaway ──────────────────────────────────────────────────────────

  let takeaway;
  if (airports?.length && airports[0].distanceMiles < 10) {
    takeaway = `${esc(airports[0].name)} is ${airports[0].distanceMiles.toFixed(1)} miles away. Visit the property during morning hours (6–9am weekdays) to hear the actual aircraft noise level before committing.`;
  } else if (roadNoise?.dnl >= 65) {
    takeaway = `Road noise at this location (~${roadNoise.dnl} dB) exceeds the FHWA residential standard of 65 dB. Evaluate it on-site during peak traffic hours.`;
  } else if (waterQuality?.violations?.length) {
    const v = waterQuality.violations[0];
    takeaway = `EPA records show a recent water quality violation (${esc(v.type)}). Request the utility's Consumer Confidence Report before closing.`;
  } else if (radon?.zone === 1) {
    takeaway = 'This is a high-radon county (EPA Zone 1). Include radon testing in your inspection scope — a $20 kit prevents a costly and dangerous surprise.';
  } else if (ejscreen?.flagged) {
    takeaway = 'EPA environmental screening flagged elevated industrial hazard proximity for this location. Review EPA ECHO for specific nearby facilities.';
  } else if (rail && rail.distanceMiles < 0.5) {
    takeaway = `A rail line runs ${Math.round(rail.distanceMiles * 5280)} feet from this address. Visit during evening or overnight hours to evaluate train noise.`;
  } else {
    const aqLabel = airQuality ? esc(airQuality.category.label.toLowerCase()) : 'not reported';
    takeaway = `No major noise, water, or hazard concerns were identified for this location. Air quality is ${aqLabel} per EPA monitoring.`;
  }

  const sources = [
    airports   && 'Google Places (airports)',
    roadNoise  && 'BTS National Transportation Noise Map / OpenStreetMap (road noise)',
    rail       && 'OpenStreetMap (rail)',
    lightPollution && 'U.S. Census ACS / OpenStreetMap (light pollution, estimated)',
    airQuality && 'EPA AirNow (air quality)',
    waterQuality && 'EPA ECHO/SDWIS (water quality)',
    radon      && 'EPA Radon Zone Map (county-level)',
    ejscreen   && 'EPA EJSCREEN (hazard proximity)',
  ].filter(Boolean).join('; ');

  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const body =
    sectionA + sectionB + sectionC +
    `<div class="prem-sensory-takeaway">
      <span class="prem-sensory-key">🔑</span>
      <p><strong>Key Takeaway:</strong> ${takeaway}</p>
    </div>` +
    `<p class="prem-disclaimer">Sources: ${sources}. Research date: ${today}. Light pollution is estimated, not satellite-measured.</p>`;

  return premiumCard('Environment', 'Sensory & Environmental', body);
}

// FR-020: Emergency Services
function buildEmergencyServicesHTML(emergency) {
  if (!emergency) return '';
  if (!emergency.police && !emergency.fire) return '';

  function serviceCard(icon, label, station) {
    if (!station) return `
    <div class="prem-emergency-card">
      <div class="prem-emergency-head">${icon} <span class="prem-emergency-label">${esc(label)}</span></div>
      <p class="prem-na">No ${esc(label.toLowerCase())} station found nearby.</p>
    </div>`;
    const cat = station.response.category;
    return `
    <div class="prem-emergency-card">
      <div class="prem-emergency-head">
        ${icon} <span class="prem-emergency-label">${esc(label)}</span>
        <span class="prem-badge prem-badge-right" style="${badgeColor(cat.color)}">~${station.response.estimate} min</span>
      </div>
      <div class="prem-emergency-name">${esc(station.name)}</div>
      <div class="prem-emergency-addr">${esc(station.address)}</div>
      <div class="prem-emergency-dist">${esc(station.distanceMiles)} miles away · Response: <strong>${esc(cat.label)}</strong></div>
    </div>`;
  }

  const fastestResponse = [emergency.police, emergency.fire]
    .filter(Boolean)
    .map((s) => s.response.estimate)
    .sort((a, b) => a - b)[0];
  const emergencyNarrative = fastestResponse != null
    ? fastestResponse <= 5
      ? `Emergency services reach this location quickly—estimated response times under ${fastestResponse + 1} minutes. That's meaningfully faster than average, and it reflects well on the density and positioning of local stations.`
      : fastestResponse <= 10
      ? `Emergency response times here are typical for residential areas—around ${fastestResponse} minutes on average. In most situations, that's enough time for basic first aid and preparing to receive responders. Knowing the address clearly posted outside your home speeds things up further.`
      : `Response times are longer than average at approximately ${fastestResponse} minutes. In a time-critical emergency—cardiac arrest, structure fire—every minute matters. Families in areas with longer response times often invest more in smoke detectors, carbon monoxide alarms, and basic CPR training as a practical buffer.`
    : '';

  const body = emergencyNarrative
    ? `<div class="prem-narrative"><p class="prem-narrative-body">${emergencyNarrative}</p></div>` +
      serviceCard('🚔', 'Police', emergency.police) +
      serviceCard('🚒', 'Fire Department', emergency.fire) +
      `<p class="prem-disclaimer">Response times are estimates based on distance to nearest stations. Actual times vary. Contact local emergency services for official data.</p>`
    : serviceCard('🚔', 'Police', emergency.police) +
      serviceCard('🚒', 'Fire Department', emergency.fire) +
      `<p class="prem-disclaimer">Response times are estimates based on distance to nearest stations. Actual times vary. Contact local emergency services for official data.</p>`;
  return premiumCard('Emergency Services', 'Emergency Response', body);
}

// FR-021: Walkability
function buildWalkabilityHTML(walk) {
  if (!walk) return '';
  const { score, category, destinations } = walk;

  const verdictColor = {
    green: '#1e7e34', lightgreen: '#3a9a3a', gold: '#8a6a40', orange: '#c0530a', red: '#a71d2a',
  }[category.color] || '#8a6a40';
  const verdictBg = {
    green: 'rgba(40,167,69,0.1)', lightgreen: 'rgba(92,184,92,0.1)', gold: 'rgba(184,149,106,0.12)',
    orange: 'rgba(253,126,20,0.1)', red: 'rgba(220,53,69,0.1)',
  }[category.color] || 'rgba(184,149,106,0.12)';

  // Bucket destinations by walk time for narrative use
  const nearby = (destinations || []).filter((d) => d.walkMinutes <= 10);
  const reachable = (destinations || []).filter((d) => d.walkMinutes > 10 && d.walkMinutes <= 20);

  // Lead paragraph: the felt experience
  let para1HTML;
  if (score >= 70) {
    const examples = nearby.length
      ? `${nearby.slice(0, 2).map((d) => `${esc(d.name)} (${d.walkMinutes} min)`).join(' and ')} ${nearby.length > 1 ? 'are' : 'is'} reachable on foot without a second thought. `
      : '';
    para1HTML = `<p class="prem-narrative-lead">${examples}Walking here is practical, not aspirational. Morning coffee, a quick errand, an evening stroll—these happen without involving the car. That low-friction access compounds quietly: you stop thinking about it after a week, and start missing it immediately if you ever move somewhere without it.</p>`;
  } else if (score >= 50) {
    const firstDest = (destinations || [])[0];
    const example = firstDest ? `${esc(firstDest.name)} is ${firstDest.walkMinutes} minutes on foot. ` : '';
    para1HTML = `<p class="prem-narrative-lead">${example}Walking is a realistic option here—for some trips, on some days. It's a pleasant supplement to a car-based routine, not a replacement for it. On a nice evening or a relaxed weekend morning, you'll use your feet. On a typical Tuesday errand run, you'll drive.</p>`;
  } else if (score >= 30) {
    para1HTML = `<p class="prem-narrative-lead">This is car-dependent territory. Not because it's unwalkable for exercise or leisure—it's fine for that—but because the distances and infrastructure don't support walking as a way to run errands or access daily services. Plan your life around the car, and enjoy the walking for what it is: recreation, not transportation.</p>`;
  } else {
    para1HTML = `<p class="prem-narrative-lead">Walking to daily services isn't part of the picture here. The distances are long, the pedestrian infrastructure is limited, and that's simply the character of this kind of location. What it offers instead—space, quiet, nature—is a different kind of value. Most people who choose somewhere like this have already made that trade-off consciously.</p>`;
  }

  // Second paragraph: what IS and ISN'T walkable
  let para2HTML = '';
  if (score >= 70 && (nearby.length || reachable.length)) {
    const nearbyNames = nearby.map((d) => esc(d.name)).join(', ');
    const reachableNames = reachable.map((d) => esc(d.name)).join(', ');
    let text = '';
    if (nearbyNames) text += `Within easy walking distance: ${nearbyNames}.`;
    if (reachableNames) text += ` A bit further but still walkable: ${reachableNames}.`;
    if (text) text += ' A full grocery haul or anything that needs a car seat still gets driven—walkability here doesn\'t eliminate the car, it just reduces how often you reach for the keys.';
    if (text) para2HTML = `<p class="prem-narrative-body">${text}</p>`;
  } else if (score >= 50 && (destinations || []).length) {
    const destNames = (destinations || []).slice(0, 3).map((d) => esc(d.name)).join(', ');
    para2HTML = `<p class="prem-narrative-body">The walkable options nearby—${destNames}—are genuinely useful when the timing is right, but they don't add up to a fully walkable lifestyle. Most daily needs still require a car trip.</p>`;
  } else if (score < 30 && (destinations || []).length) {
    const destNames = (destinations || []).slice(0, 2).map((d) => esc(d.name)).join(' and ');
    para2HTML = `<p class="prem-narrative-body">${destNames ? `The closest options on foot are ${destNames}—` : ''}worth knowing for a neighborhood stroll, but not practical for regular errands given the distances involved.</p>`;
  }

  // Third paragraph: honest reality / anticipation
  let para3HTML;
  if (score >= 70) {
    para3HTML = `<p class="prem-narrative-body">One thing walkability ratings can't fully capture: the quality of the experience. Sidewalk continuity, shade, lighting, and how the streets feel matter as much as what's nearby. The pedestrian environment details below give you a ground-level picture of what walking here actually feels like.</p>`;
  } else if (score >= 50) {
    para3HTML = `<p class="prem-narrative-body">If walkability matters to you but this location is otherwise right, most people adapt to car-based routines easily. Where it surfaces more is for teenagers who can't drive yet, elderly family members who may stop driving, or anyone who values the independence of not needing a car for daily life.</p>`;
  } else {
    para3HTML = `<p class="prem-narrative-body">Worth naming clearly: in a car-dependent location, anyone who doesn't or can't drive is significantly constrained. That's a real quality-of-life factor for families with teenagers, for aging in place, and for any household member who loses driving ability. Worth thinking about before committing.</p>`;
  }

  const destHTML = (destinations || []).length ? `
    <div class="prem-walk-section-label">What's Within Walking Distance</div>
    <div class="prem-walk-dests">
      ${destinations.map((d) => {
        const distDisplay = d.distanceMiles < 0.2
          ? `${Math.round(d.distanceMiles * 5280)} ft`
          : `${d.distanceMiles.toFixed(1)} mi`;
        return `
      <div class="prem-walk-dest">
        <span class="prem-walk-dest-icon">${d.icon}</span>
        <div class="prem-walk-dest-info">
          <div class="prem-walk-dest-name">${esc(d.name)}</div>
          <div class="prem-walk-dest-cat">${esc(d.label)}</div>
        </div>
        <div class="prem-walk-dest-time">${d.walkMinutes} min walk<div class="prem-walk-dest-dist">${distDisplay}</div></div>
      </div>`;
      }).join('')}
    </div>` : '';

  const features = getPedestrianFeatures(score);
  const featHTML = `
    <div class="prem-walk-section-label">Pedestrian Environment</div>
    <div class="prem-walk-features">
      ${features.present.map((f) => `<div class="prem-walk-feature prem-walk-feat-yes">✓ ${esc(f)}</div>`).join('')}
      ${features.note ? `<div class="prem-walk-feature prem-walk-feat-note">◎ ${esc(features.note)}</div>` : ''}
    </div>`;

  const body = `
    <div class="prem-walk-header">
      <div class="prem-walk-verdict" style="color:${verdictColor};background:${verdictBg}">${esc(category.label)}</div>
      <div class="prem-walk-desc">${esc(category.description)}</div>
    </div>
    <div class="prem-narrative">
      ${para1HTML}
      ${para2HTML}
      ${para3HTML}
    </div>
    ${destHTML}
    ${featHTML}
    <p class="prem-disclaimer">Walkability is estimated from nearby amenities within 0.5 miles using Google Places data. Not an official Walk Score®.</p>`;
  return premiumCard('Walkability', 'Getting Around on Foot', body);
}

// FR-023: Property Costs & Market
function buildPropertyDataHTML(p) {
  if (!p) return '';

  // ── Tax rate narrative ────────────────────────────────────────────────────
  const taxLow  = p.taxRate < 0.5;
  const taxHigh = p.taxRate > 1.5;
  const taxPara = taxLow
    ? `${esc(p.state)}'s ${p.taxRate.toFixed(2)}% effective property tax rate is among the lowest in the country — a meaningful long-term advantage. For a $350,000 home, that's roughly $${Math.round(350000 * p.taxRate / 100 / 12).toLocaleString()}/month in property tax, not $${Math.round(350000 * 1.5 / 100 / 12).toLocaleString()}+/month in higher-tax states. Check whether your county or city layers additional levies on top of the state average.`
    : taxHigh
    ? `${esc(p.state)}'s ${p.taxRate.toFixed(2)}% effective rate is on the higher end nationally. For a $350,000 home, that's roughly $${Math.round(350000 * p.taxRate / 100 / 12).toLocaleString()}/month in property taxes. In many high-tax states the trade-off is strong school funding and well-maintained public infrastructure — but factor this into your total monthly cost math.`
    : `${esc(p.state)}'s ${p.taxRate.toFixed(2)}% effective property tax rate is close to the national average. For a $350,000 home, budget approximately $${Math.round(350000 * p.taxRate / 100 / 12).toLocaleString()}/month for property taxes.`;

  // ── Carrying cost breakdown ───────────────────────────────────────────────
  // Show for $300k and $400k price points
  const prices = [300000, 400000];
  const rows = prices.map((price) => {
    const taxMo  = Math.round(price * (p.taxRate / 100) / 12);
    // Scale insurance from $300k base proportionally
    const insMo  = Math.round((p.insuranceYear * (price / 300000)) / 12);
    const utilMo = p.utilitiesMo;
    const total  = taxMo + insMo + utilMo;
    return { price, taxMo, insMo, utilMo, total };
  });

  const carryingRows = rows.map((r) => `
    <tr class="prem-carry-row">
      <td class="prem-carry-price">${formatMoney(r.price)}</td>
      <td class="prem-carry-cell">${formatMoney(r.taxMo)}</td>
      <td class="prem-carry-cell">${formatMoney(r.insMo)}</td>
      <td class="prem-carry-cell">${formatMoney(r.utilMo)}</td>
      <td class="prem-carry-total">${formatMoney(r.total)}</td>
    </tr>`).join('');

  const carryingTable = `
    <div class="prem-carrying-section">
      <div class="prem-carrying-label">Monthly Carrying Costs (Not Including Mortgage)</div>
      <table class="prem-carry-table">
        <thead>
          <tr>
            <th class="prem-carry-th">Home Price</th>
            <th class="prem-carry-th">Tax</th>
            <th class="prem-carry-th">Insurance</th>
            <th class="prem-carry-th">Utilities</th>
            <th class="prem-carry-th prem-carry-th-total">Monthly Total</th>
          </tr>
        </thead>
        <tbody>${carryingRows}</tbody>
      </table>
      <div class="prem-carrying-note">Tax based on ${p.taxRate.toFixed(2)}% state avg · Insurance from NAIC state avg (2024) · Utilities from EIA state avg · HOA not included</div>
    </div>`;

  // ── Homestead exemption note ──────────────────────────────────────────────
  const homesteadHTML = p.homesteadNote ? `
    <div class="prem-market-note prem-homestead-note">
      <span class="prem-market-note-icon">🏡</span>
      <span><strong>Homestead Exemption:</strong> ${esc(p.homesteadNote)}</span>
    </div>` : '';

  // ── Valuation redirect ────────────────────────────────────────────────────
  const valuationNote = `
    <div class="prem-market-note">
      <span class="prem-market-note-icon">ℹ️</span>
      <span>Current home values are not shown here — they change daily and Census estimates lag 3–5 years. For current pricing: <strong>Zillow, Redfin, or Realtor.com</strong> all show recent sales and active listings for this address. Your agent can pull a Comparative Market Analysis (CMA) for the most accurate view.</span>
    </div>`;

  // ── Key Takeaway ──────────────────────────────────────────────────────────
  const lowestCarrying = rows[0];
  let takeaway;
  if (taxHigh) {
    takeaway = `Property taxes in ${esc(p.state)} add ~${formatMoney(rows[0].taxMo)}/month for a $300k home. Factor this into your offer price math — the tax gap between high- and low-tax states compounds significantly over a 30-year mortgage.`;
  } else if (taxLow) {
    takeaway = `${esc(p.state)}'s low property tax rate is a genuine long-term savings advantage. On a $350k home, you'd pay ~${formatMoney(Math.round(350000 * p.taxRate / 100 / 12))}/month vs ~${formatMoney(Math.round(350000 * 1.5 / 100 / 12))}/month in a high-tax state — a difference that compounds significantly over 30 years.`;
  } else {
    takeaway = `Total carrying costs for a $300k home in ${esc(p.state)} run approximately ${formatMoney(lowestCarrying.total)}/month before the mortgage — ${formatMoney(lowestCarrying.taxMo)} tax, ${formatMoney(lowestCarrying.insMo)} insurance, ${formatMoney(lowestCarrying.utilMo)} utilities. Add your mortgage payment for the true monthly cost.`;
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const body = `
    <div class="prem-narrative">
      <p class="prem-narrative-lead">${taxPara}</p>
    </div>
    ${carryingTable}
    ${homesteadHTML}
    ${valuationNote}
    <div class="prem-sensory-takeaway">
      <span class="prem-sensory-key">🔑</span>
      <p><strong>Key Takeaway:</strong> ${takeaway}</p>
    </div>
    <p class="prem-disclaimer">Property tax rate: ${esc(p.state)} state effective average (Lincoln Institute, 2024). Insurance: NAIC 2024 state averages, scaled to home price. Utilities: EIA/BLS state averages, 2024. These are estimates — your actual costs will vary. Research date: ${today}.</p>`;
  return premiumCard('Costs', 'Property Costs & Market', body);
}

// FR-024: Demographics
function buildDemographicsHTML(d) {
  if (!d) return '';

  function ageBar(label, pct) {
    return `
    <div class="prem-age-row">
      <span class="prem-age-label">${esc(label)}</span>
      <div class="prem-age-track"><div class="prem-age-fill" style="width:${pct}%"></div></div>
      <span class="prem-age-pct">${pct}%</span>
    </div>`;
  }

  const incomeBadge = `<span class="prem-badge" style="${badgeColor(d.income.level.color)}">${esc(d.income.level.label)}</span>`;
  const eduBadge = `<span class="prem-badge" style="${badgeColor(d.education.level.color)}">${esc(d.education.level.label)}</span>`;

  const ageNarrative = (() => {
    const under18 = d.age.under18;
    const seniors = d.age.age65plus;
    const youngAdults = d.age.age18to34;
    if (under18 > 28) return `With ${under18}% of residents under 18, this is family-heavy territory. Expect school buses, youth sports, and neighbors who share your kid-related schedule. The upside: a strong parenting community and lots of kids the same age for yours to grow up with.`;
    if (seniors > 25) return `${seniors}% of residents are 65 or older. That typically means a quieter, more established neighborhood with strong community ties and low turnover. Neighbors tend to know each other and have been here a while.`;
    if (youngAdults > 30) return `${youngAdults}% of residents are 18–34. This skews younger—expect more energy, more turnover, and a neighborhood that's still forming its identity. Can mean more vibrancy; can also mean less of the settled-in community feel that comes with long-term residents.`;
    return `The age mix here is fairly balanced across life stages. That typically produces a stable, diverse community—families, working adults, and established residents sharing the same streets.`;
  })();

  const incomeNarrative = d.income.median
    ? (() => {
        const inc = d.income.median;
        const nationalMedian = 74580;
        const diff = Math.round(Math.abs(inc - nationalMedian) / 1000) * 1000;
        const rel = inc > nationalMedian
          ? `${formatMoney(diff)} above the national median of ${formatMoney(nationalMedian)}`
          : inc < nationalMedian
          ? `${formatMoney(diff)} below the national median of ${formatMoney(nationalMedian)}`
          : `at the national median`;
        return `Median household income in this Census tract is ${formatMoney(inc)} — ${rel}. Income data here is Census tract level (ACS 5-year estimates) and reflects the broader area, not this specific block or street.`;
      })()
    : null;

  const communityNarrative = (() => {
    const ownership = d.community.ownershipRate;
    const tenure    = d.community.medianTenureYears;
    const tenureStr = tenure ? ` The median resident has lived here for about ${tenure} year${tenure !== 1 ? 's' : ''} — ${tenure >= 12 ? 'a strong signal of neighborhood stability and community investment' : tenure >= 7 ? 'indicating a settled community that also sees some turnover' : 'a relatively mobile population, common in growth areas and near large employers'}.` : '';
    if (ownership > 75) return `${ownership}% homeownership puts this firmly in owner-occupied territory.${tenureStr} People who own tend to stay longer, invest in their properties, and participate more in local decisions — that translates to stable, maintained streetscapes and a stronger sense of shared stakes.`;
    if (ownership > 50) return `${ownership}% homeownership means a mixed community of owners and renters.${tenureStr} Ownership majority generally signals investment and stability, while the renter population keeps the neighborhood more dynamic.`;
    return `${ownership}% homeownership — majority renter.${tenureStr} Renters aren't less invested in their communities, but higher turnover is typical. That can make it harder to build long-term neighbor relationships and often correlates with more frequent property management changes in the surrounding buildings.`;
  })();

  // ── Community character synthesis ────────────────────────────────────────
  const synthesisParts = [];
  if (d.age.under18 > 28) synthesisParts.push('family-oriented with active youth presence');
  else if (d.age.age65plus > 25) synthesisParts.push('established and senior-skewing');
  else if (d.age.age18to34 > 30) synthesisParts.push('young and professionally active');
  else synthesisParts.push('multi-generational');

  if (d.community.ownershipRate > 70) synthesisParts.push('high owner-occupancy');
  else if (d.community.ownershipRate < 45) synthesisParts.push('predominantly renter');

  if (d.education.collegePct > 50) synthesisParts.push('college-educated workforce');

  const synthesisLine = synthesisParts.length >= 2
    ? `This Census tract is characterized by: ${synthesisParts.join(', ')}. That combination shapes the daily character of the neighborhood more than any single metric.`
    : null;

  // ── Key Takeaway ──────────────────────────────────────────────────────────
  let takeaway;
  const tenure = d.community.medianTenureYears;
  if (tenure && tenure >= 15) {
    takeaway = `Median resident tenure of ~${tenure} years is a strong stability indicator — these are neighbors who chose to stay. That kind of community continuity is difficult to find and hard to replicate.`;
  } else if (tenure && tenure <= 5) {
    takeaway = `Median resident tenure of ~${tenure} years signals a mobile population — common in growth areas and university towns. Expect a changing cast of neighbors but also a neighborhood still forming its identity.`;
  } else if (d.community.ownershipRate > 80) {
    takeaway = `${d.community.ownershipRate}% homeownership is exceptionally high — the majority of your neighbors are owners invested in their property and the neighborhood. This level of ownership correlates strongly with neighborhood stability and active community engagement.`;
  } else if (d.age.under18 > 30) {
    takeaway = `${d.age.under18}% of residents are under 18 — a genuinely family-heavy area. School quality and youth programs will matter to nearly every neighbor you'll have.`;
  } else {
    takeaway = `The ${d.community.type.label.toLowerCase()} character of this Census tract — ${d.community.ownershipRate}% ownership, median age ${d.medianAge ?? '?'} — is the baseline for what daily neighborhood life looks and feels like.`;
  }

  const body = `
    <div class="prem-narrative">
      <p class="prem-narrative-lead">${ageNarrative}</p>
      ${incomeNarrative ? `<p class="prem-narrative-body">${incomeNarrative}</p>` : ''}
      <p class="prem-narrative-body">${communityNarrative}</p>
      ${synthesisLine ? `<p class="prem-narrative-body prem-synthesis-line">${synthesisLine}</p>` : ''}
    </div>
    <div class="prem-demo-grid">
      <div class="prem-demo-card">
        <div class="prem-demo-title">👨‍👩‍👧‍👦 Age Distribution</div>
        <div class="prem-demo-summary">${esc(d.age.primaryGroup)}</div>
        ${ageBar('Under 18', d.age.under18)}
        ${ageBar('18–34', d.age.age18to34)}
        ${ageBar('35–64', d.age.age35to64)}
        ${ageBar('65+', d.age.age65plus)}
        ${d.medianAge ? `<div class="prem-demo-note">Median age: ${d.medianAge} years</div>` : ''}
      </div>
      <div class="prem-demo-card">
        <div class="prem-demo-title">💵 Income</div>
        ${d.income.median ? `<div class="prem-demo-big">${formatMoney(d.income.median)}</div><div class="prem-demo-sub">Median household income</div>` : '<div class="prem-demo-sub">Income data unavailable</div>'}
        ${incomeBadge}
      </div>
      <div class="prem-demo-card">
        <div class="prem-demo-title">🎓 Education</div>
        <div class="prem-edu-stats">
          <div><span class="prem-edu-pct">${d.education.bachelor}%</span><span class="prem-edu-lbl">Bachelor's</span></div>
          <div><span class="prem-edu-pct">${d.education.graduate}%</span><span class="prem-edu-lbl">Graduate</span></div>
        </div>
        ${eduBadge}
      </div>
      <div class="prem-demo-card">
        <div class="prem-demo-title">${d.community.densityType.icon} Community</div>
        <div class="prem-community-item">${d.community.densityType.icon} ${esc(d.community.densityType.label)} area</div>
        <div class="prem-community-item">${d.community.type.icon} ${esc(d.community.type.label)}</div>
        <div class="prem-community-item">🏠 ${d.community.ownershipRate}% homeownership</div>
        ${d.community.medianTenureYears ? `<div class="prem-community-item">📅 ~${d.community.medianTenureYears} yr median resident tenure</div>` : ''}
        ${d.community.avgHHSize ? `<div class="prem-community-item">👥 ${d.community.avgHHSize} avg household size</div>` : ''}
      </div>
    </div>
    <div class="prem-sensory-takeaway">
      <span class="prem-sensory-key">🔑</span>
      <p><strong>Key Takeaway:</strong> ${takeaway}</p>
    </div>
    <p class="prem-disclaimer">Data: U.S. Census Bureau American Community Survey 5-year estimates (2022). Census tract level. Provided for informational purposes only; not to be used as a basis for housing discrimination.</p>`;
  return premiumCard('Community', 'Demographics & Community', body);
}

// FR-025: Growth & Development
function buildGrowthAndDevelopmentHTML(growth) {
  if (!growth) return '';
  const { permits, newConstruction, establishments, namedProjects = [], locationInfo } = growth;
  const county = locationInfo?.county || 'this county';
  const city   = locationInfo?.city   || '';

  // ── Named projects (from local intel database) ────────────────────────────
  const STATUS_COLORS = {
    'Under Construction': '#2e7d32',
    'Approved':           '#b8922a',
    'Planned':            '#5c6bc0',
  };

  const hasManual    = namedProjects.some((p) => !p.automated);
  const hasAutomated = namedProjects.some((p) => p.automated);
  const sectionLabel = hasManual
    ? `Confirmed Projects Near ${esc(city || county)}`
    : `Developments Reported Near ${esc(city || county)}`;

  let namedProjectsHTML = '';
  if (namedProjects.length) {
    const projectCards = namedProjects.map((p) => {
      const color = STATUS_COLORS[p.status] || '#666';
      return `
        <div class="prem-growth-named-project">
          <div class="prem-growth-named-project-header">
            <span class="prem-growth-named-project-icon">${p.icon}</span>
            <div class="prem-growth-named-project-title">
              <div class="prem-growth-named-project-name">${esc(p.name)}</div>
              <div class="prem-growth-named-project-type">${esc(p.type)}</div>
            </div>
            <div class="prem-growth-named-project-status" style="color:${color};border-color:${color}">${esc(p.status)}</div>
          </div>
          ${p.expectedOpening ? `<div class="prem-growth-named-project-timeline">Expected: ${esc(p.expectedOpening)}</div>` : ''}
          <div class="prem-growth-named-project-impact">${esc(p.impact)}</div>
          ${p.automated ? `<div class="prem-growth-named-project-source">Source: ${esc(p.source || 'News report')}${p.sourceUrl ? ` · <a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="prem-growth-source-link">view article</a>` : ''}</div>` : ''}
        </div>`;
    }).join('');

    const automatedNote = hasAutomated && !hasManual
      ? `<div class="prem-growth-automated-note">Projects discovered via news search — verify with ${esc(county)} Planning &amp; Zoning before making decisions.</div>`
      : '';

    namedProjectsHTML = `
      <div class="prem-growth-section prem-growth-named-projects">
        <div class="prem-growth-label">${sectionLabel}</div>
        ${projectCards}
        ${automatedNote}
      </div>`;
  }

  // ── Growth trend narrative ────────────────────────────────────────────────
  let growthPara;
  if (permits) {
    const countStr = permits.current.toLocaleString();
    const yearStr  = permits.currentYear ? ` in ${permits.currentYear}` : '';
    const trendCtx =
      permits.trend === 'rising'    ? `up ${Math.abs(permits.percentChange)}% from ${permits.priorYear || 'the prior year'}` :
      permits.trend === 'declining' ? `down ${Math.abs(permits.percentChange)}% from ${permits.priorYear || 'the prior year'}` :
      `relatively stable compared to ${permits.priorYear || 'the prior year'}`;
    const trendDesc =
      permits.trend === 'rising'
        ? `That's an active construction pace — new housing and commercial development are expanding in this area.`
        : permits.trend === 'declining'
        ? `Construction has slowed from recent levels. That can reflect a maturing market or broader economic conditions.`
        : `Construction activity is holding steady — neither a boom nor a slowdown.`;
    growthPara = `${esc(county)} issued ${countStr} building permits${yearStr}, ${trendCtx}. ${trendDesc}`;
  } else if (newConstruction) {
    const pct = newConstruction.newConstructionPct;
    if (pct >= 20)      growthPara = `${pct}% of housing in this Census tract was built after 2010 — a significant share of relatively recent construction, indicating an active growth area.`;
    else if (pct >= 10) growthPara = `About ${pct}% of housing in this Census tract was built after 2010, reflecting moderate new construction activity in the area.`;
    else                growthPara = `Only ${pct}% of housing in this Census tract was built after 2010, indicating an established neighborhood with limited recent new construction.`;
  } else {
    growthPara = `Building permit trend data was not available for ${esc(county)} at this time. For current construction activity, contact the ${esc(county)} Planning and Zoning office directly.`;
  }

  // ── Commercial landscape ──────────────────────────────────────────────────
  let activityPara = '';
  let placesHTML   = '';
  if (establishments?.length) {
    const nearby     = establishments.filter((e) => e.distanceMiles <= 0.5);
    const withinMile = establishments.filter((e) => e.distanceMiles > 0.5 && e.distanceMiles <= 1);
    if (nearby.length) {
      activityPara = `Within a half mile: ${nearby.slice(0, 3).map((e) => esc(e.name)).join(', ')}. The commercial environment immediately surrounding this address is active and established.`;
    } else if (withinMile.length) {
      activityPara = `Within a mile: ${withinMile.slice(0, 3).map((e) => esc(e.name)).join(', ')}. The local commercial corridor is accessible without a long drive.`;
    } else {
      const e = establishments[0];
      activityPara = `The nearest major commercial establishment is ${esc(e.name)} (${e.distanceMiles.toFixed(1)} mi). Commercial density in the immediate area is lower.`;
    }
    placesHTML = `
      <div class="prem-growth-section">
        <div class="prem-growth-label">Commercial Landscape Within 1.5 Miles</div>
        <div class="prem-growth-places">
          ${establishments.map((e) => `
          <div class="prem-growth-place">
            <span class="prem-growth-place-icon">${e.icon}</span>
            <div class="prem-growth-place-info">
              <div class="prem-growth-place-name">${esc(e.name)}</div>
              <div class="prem-growth-place-cat">${esc(e.label)}</div>
            </div>
            <div class="prem-growth-place-dist">${e.distanceMiles.toFixed(1)} mi</div>
          </div>`).join('')}
        </div>
      </div>`;
  }

  // ── Pipeline note ─────────────────────────────────────────────────────────
  const planningPara = `For development projects in the pipeline — approved applications, zoning changes, pending permits — check with ${esc(county)} Planning and Zoning. Those records are public but require a direct inquiry. Specific projects (a proposed apartment complex, a road widening, a new commercial pad) won't show up in any API; they live in the county's planning portal.`;

  // ── Key Takeaway ──────────────────────────────────────────────────────────
  let takeaway;
  if (namedProjects.length) {
    const underConstruction = namedProjects.filter((p) => p.status === 'Under Construction');
    const approved          = namedProjects.filter((p) => p.status === 'Approved');
    if (underConstruction.length) {
      takeaway = `${esc(underConstruction[0].name)} is currently under construction${underConstruction[0].timeline ? ` (expected ${esc(underConstruction[0].timeline)})` : ''} — a significant change coming to this area within the next year or two.`;
    } else if (approved.length) {
      takeaway = `${esc(approved[0].name)} has been approved${approved[0].timeline ? ` (expected ${esc(approved[0].timeline)})` : ''} — this development is confirmed and on the way.`;
    } else {
      takeaway = `${namedProjects.length} confirmed development project${namedProjects.length > 1 ? 's are' : ' is'} on the way near this address. See details above.`;
    }
  } else if (permits?.trend === 'rising' && permits.percentChange >= 20) {
    takeaway = `${esc(county)} is in an active growth phase — building permits are up ${permits.percentChange}% year-over-year. Expect continued residential and commercial expansion near this area.`;
  } else if (permits?.trend === 'declining' && permits.percentChange !== null && permits.percentChange <= -20) {
    takeaway = `Construction activity in ${esc(county)} has slowed significantly (${permits.percentChange}%). Ask your agent about what's driving the change.`;
  } else if (establishments?.length && establishments.filter((e) => e.distanceMiles <= 0.5).length >= 2) {
    takeaway = `The immediate area has active commercial infrastructure within a half mile. For specific planned projects near this address, contact ${esc(county)} Planning and Zoning directly.`;
  } else {
    takeaway = `For the most current picture of planned development near this address, contact ${esc(county)} Planning and Zoning — their records show pending applications and approved projects that don't yet appear in any public data feed.`;
  }

  const sources = [];
  if (namedProjects.length) sources.push('Livably Development Intelligence (manually verified)');
  if (permits) sources.push('U.S. Census Bureau Building Permits Survey');
  else if (newConstruction) sources.push('U.S. Census ACS 5-year estimates');
  if (establishments?.length) sources.push('Google Places');
  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const body = `
    ${namedProjectsHTML}
    <div class="prem-narrative">
      <p class="prem-narrative-lead">${growthPara}</p>
      ${activityPara ? `<p class="prem-narrative-body">${activityPara}</p>` : ''}
      <p class="prem-narrative-body">${planningPara}</p>
    </div>
    ${placesHTML}
    <div class="prem-sensory-takeaway">
      <span class="prem-sensory-key">🔑</span>
      <p><strong>Key Takeaway:</strong> ${takeaway}</p>
    </div>
    <p class="prem-disclaimer">Sources: ${esc(sources.join('; ') || 'See notes above')}. Research date: ${today}. Permit data is county-level — not neighborhood-specific. Specific planned projects require direct inquiry with the county planning department.</p>`;

  return premiumCard('Development', 'Growth & Development', body);
}

// FR-026: Property Intelligence
function buildPropertyIntelligenceHTML(propIntel) {
  if (!propIntel) return '';
  const { soil, broadband, era, locationInfo } = propIntel;
  const county = locationInfo?.county || 'this county';

  // ── Construction Era ──────────────────────────────────────────────────────
  let eraPara;
  let eraCautionsHTML = '';
  if (era?.medianYearBuilt) {
    const ctx = era.context;
    eraPara = ctx
      ? `${esc(ctx.era)}. The median year built for homes in this Census tract is ${era.medianYearBuilt}${era.newConstructionPct !== undefined ? `, with ${era.newConstructionPct}% of housing built after 2010` : ''}.`
      : `The median year built for homes in this Census tract is ${era.medianYearBuilt}.`;
    if (ctx?.cautions?.length) {
      eraCautionsHTML = `
        <div class="prem-intel-cautions">
          <div class="prem-intel-caution-label">Inspection checklist for homes built in this era:</div>
          <ul class="prem-intel-caution-list">
            ${ctx.cautions.map((c) => `<li>${esc(c)}</li>`).join('')}
          </ul>
        </div>`;
    }
  } else {
    eraPara = 'Construction era data was not available for this Census tract.';
  }

  // ── Soil & Drainage ───────────────────────────────────────────────────────
  let soilPara;
  let soilBadgeHTML = '';
  if (!soil) {
    soilPara = 'Soil survey data was not available for this location through the USDA Web Soil Survey.';
  } else {
    const name  = soil.muname || 'this soil type';
    const drain = soil.drainageCategory;
    const isUrban = !drain && (name.toLowerCase().includes('urban') || name.toLowerCase().includes('pits'));
    soilPara = `The lot sits on ${esc(name)}${soil.drainagecl ? `, USDA drainage class: ${esc(soil.drainagecl.toLowerCase())}` : ''}. `;
    if (drain) {
      soilPara += esc(drain.implication);
      soilBadgeHTML = `<span class="prem-badge prem-intel-soil-badge" style="${badgeColor(drain.color)}">${esc(drain.label)}</span>`;
    } else if (isUrban) {
      soilPara += `Urban land classifications don't carry standard drainage ratings — the soil profile has been altered by development. If you're concerned about drainage or foundation conditions, an on-site soil evaluation by a geotechnical engineer is the right approach.`;
    } else if (!soil.drainagecl) {
      soilPara += `No drainage classification is on record for this soil type — consult a soil engineer for site-specific drainage evaluation.`;
    }
    if (soil.isHydric) {
      soilPara += ` USDA identifies this soil as hydric — a potential wetland indicator. Discuss foundation moisture, drainage feasibility, and any planned additions with your inspector.`;
    }
  }

  // ── Broadband ─────────────────────────────────────────────────────────────
  let broadbandPara;
  let broadbandCardsHTML = '';
  if (!broadband || !broadband.providers?.length) {
    broadbandPara = broadband === null
      ? 'FCC broadband availability data was not accessible for this address. Verify internet service before closing: check the <a href="https://broadbandmap.fcc.gov/" target="_blank" rel="noopener">FCC National Broadband Map</a> by searching this address, or search "[zip code] internet providers" for local ISP options.'
      : 'No internet providers were confirmed at this address through the FCC Broadband Map. Verify connectivity directly with local providers before closing.';
  } else {
    const cat = broadband.category;
    broadbandPara = cat.desc;
    if (broadband.maxDownloadMbps > 0) broadbandPara += ` Maximum advertised download: ${broadband.maxDownloadMbps} Mbps.`;
    broadbandPara += broadband.providers.length > 1
      ? ` ${broadband.providers.length} providers serve this address — competition gives you options if service quality is inconsistent.`
      : ` Only one provider is confirmed at this address — worth verifying service reliability before committing.`;
    broadbandCardsHTML = `
      <div class="prem-intel-bb-providers">
        <span class="prem-badge" style="${badgeColor(cat.color)}">${esc(cat.label)}</span>
        ${broadband.providers.map((p) => `
        <div class="prem-intel-bb-provider">
          <span class="prem-intel-bb-name">${esc(p.name)}</span>
          <span class="prem-intel-bb-tech">${esc(p.tech)}</span>
          ${p.download ? `<span class="prem-intel-bb-speed">${p.download} Mbps</span>` : ''}
        </div>`).join('')}
      </div>`;
  }

  // ── Tax & Permit note ─────────────────────────────────────────────────────
  const assessorSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${county} county assessor property records`)}`;
  const taxPermitPara = `Property tax history and permit records for this specific parcel are public records available from the <a href="${assessorSearchUrl}" target="_blank" rel="noopener">${esc(county)} Assessor</a> and Building Department. One call before closing reveals the full permit history (including any unpermitted work), the tax assessment trajectory, and any open permits — information that doesn't appear in any public API.`;

  // ── Key Takeaway ──────────────────────────────────────────────────────────
  let takeaway;
  if (soil?.isHydric) {
    takeaway = 'USDA identifies this soil as hydric — a potential wetland indicator. Discuss foundation drainage and any planned additions with your inspector before closing.';
  } else if (soil?.drainageCategory?.color === 'red') {
    takeaway = `Soil drainage here is ${esc(soil.drainageCategory.label.toLowerCase())}. Ask your inspector specifically about basement moisture and discuss drainage with the seller.`;
  } else if (broadband === null || !broadband?.providers?.length) {
    takeaway = 'Internet connectivity at this address could not be confirmed through FCC data. If remote work or streaming is important, verify service options with local providers before committing.';
  } else if (era?.medianYearBuilt && era.medianYearBuilt < 1978 && era.context?.cautions?.length) {
    takeaway = `Homes in this tract average ${era.medianYearBuilt} — pre-1978 construction. Include a lead paint inspection in your due diligence scope.`;
  } else if (broadband?.hasFiber || broadband?.maxDownloadMbps >= 1000) {
    takeaway = 'Gigabit or fiber internet is available at this address — a meaningful advantage for remote workers and streaming-heavy households.';
  } else {
    takeaway = `Request the permit history and tax record for this specific parcel from the ${esc(county)} Building Department and Assessor's office before closing — it takes one call and can reveal unpermitted work or unexpected tax increases.`;
  }

  const sources = [
    soil      ? 'USDA Web Soil Survey' : null,
    broadband ? 'FCC National Broadband Map' : null,
    era       ? 'U.S. Census ACS 5-year estimates (construction era)' : null,
  ].filter(Boolean);
  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const body = `
    <div class="prem-narrative">
      <p class="prem-narrative-lead">County records, soil surveys, and broadband maps reveal factors specific to this property — ones that don't show up in a listing or a 20-minute showing, but affect ownership costs, livability, and decision-making.</p>
    </div>
    <div class="prem-intel-section">
      <div class="prem-intel-label">Construction Era</div>
      <p class="prem-narrative-body">${eraPara}</p>
      ${eraCautionsHTML}
    </div>
    <div class="prem-intel-section">
      <div class="prem-intel-label">Soil &amp; Drainage ${soilBadgeHTML}</div>
      <p class="prem-narrative-body">${soilPara}</p>
    </div>
    <div class="prem-intel-section">
      <div class="prem-intel-label">Internet Availability</div>
      <p class="prem-narrative-body">${broadbandPara}</p>
      ${broadbandCardsHTML}
    </div>
    <div class="prem-intel-section">
      <div class="prem-intel-label">Tax &amp; Permit Records</div>
      <p class="prem-narrative-body">${taxPermitPara}</p>
    </div>
    <div class="prem-sensory-takeaway">
      <span class="prem-sensory-key">🔑</span>
      <p><strong>Key Takeaway:</strong> ${takeaway}</p>
    </div>
    <p class="prem-disclaimer">Sources: ${esc(sources.join('; ') || 'See notes above')}. Research date: ${today}. Construction era is a tract-level Census ACS estimate — not specific to this parcel. Parcel-level permit and tax history requires direct inquiry with the county.</p>`;

  return premiumCard('Property', 'Property Intelligence', body);
}

function buildPremiumSectionsHTML(premium) {
  if (!premium) return '';
  return [
    buildSchoolRatingsHTML(premium.schools),
    buildCrimeHTML(premium.safetyLocation, premium.emergency),
    buildDemographicsHTML(premium.demographics),
    buildGrowthAndDevelopmentHTML(premium.growth),
    buildClimateChapterHTML(premium.environment, premium.locationInfo),
    buildWhatWillGrowHTML(premium.gardenData, premium.propIntel?.soil, premium.locationInfo),
    buildPropertyIntelligenceHTML(premium.propIntel),
    buildSensoryEnvironmentalHTML(premium.environment),
    buildWalkabilityHTML(premium.walkability),
    buildPropertyDataHTML(premium.propertyData),
  ].join('');
}

module.exports = { getPremiumData, buildPremiumSectionsHTML };
