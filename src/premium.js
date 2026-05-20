'use strict';

// Premium data module — FR-017 through FR-024 (excluding FR-022 paywall)

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

    return {
      totalPop,
      medianAge,
      age: { under18: under18Pct, age18to34: age18to34Pct, age35to64: age35to64Pct, age65plus: age65plusPct, primaryGroup },
      income: { median: medianIncome > 0 ? medianIncome : null, level: getIncomeLevel(medianIncome) },
      education: { bachelor: bachelorPct, graduate: graduatePct, collegePct, level: getEducationLevel(collegePct) },
      community: {
        ownershipRate,
        avgHHSize,
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
  if (median > 100000) return { label: 'Upper income', color: 'green' };
  if (median > 70000) return { label: 'Above average', color: 'lightgreen' };
  if (median > 50000) return { label: 'Middle income', color: 'gold' };
  return { label: 'Below average', color: 'orange' };
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

// ── FR-023: Property & Market Data ───────────────────────────────────────────

const STATE_TAX_RATES = {
  AL:0.39,AK:1.04,AZ:0.60,AR:0.62,CA:0.73,CO:0.49,CT:1.73,DE:0.55,FL:0.80,GA:0.83,
  HI:0.28,ID:0.56,IL:2.07,IN:0.83,IA:1.46,KS:1.30,KY:0.83,LA:0.56,ME:1.09,MD:1.02,
  MA:1.12,MI:1.32,MN:1.02,MS:0.75,MO:0.93,MT:0.74,NE:1.54,NV:0.55,NH:1.89,NJ:2.13,
  NM:0.67,NY:1.40,NC:0.70,ND:0.88,OH:1.41,OK:0.88,OR:0.87,PA:1.36,RI:1.29,SC:0.52,
  SD:1.22,TN:0.66,TX:1.60,UT:0.52,VT:1.73,VA:0.75,WA:0.84,WV:0.55,WI:1.61,WY:0.55,
  DC:0.56,
};

async function getPropertyData(fips, locationInfo) {
  const state = locationInfo?.state || '';
  const county = locationInfo?.county || '';
  const taxRate = STATE_TAX_RATES[state] ?? 1.00;

  let medianHomeValue = null;
  let tractPop = null;

  if (fips) {
    try {
      const acs = await fetchCensusACS(fips, ['B25077_001E', 'B01003_001E']);
      if (acs) {
        const raw = parseInt(acs.get('B25077_001E'), 10);
        medianHomeValue = (raw > 0) ? raw : null;
        tractPop = safeInt(acs.get('B01003_001E'));
      }
    } catch {}
  }

  const annualTax = medianHomeValue ? Math.round(medianHomeValue * (taxRate / 100)) : null;

  return {
    taxRate,
    state,
    county,
    medianHomeValue,
    annualTax,
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

// ── FR-019: Environmental Data ────────────────────────────────────────────────

async function getEnvironmentalData(lat, lng, highwayDriveMinutes) {
  const [airResult, floodResult] = await Promise.allSettled([
    getAirQuality(lat, lng),
    getFloodRisk(lat, lng),
  ]);
  return {
    airQuality: airResult.status === 'fulfilled' ? airResult.value : null,
    noise: estimateNoiseLevel(highwayDriveMinutes),
    floodRisk: floodResult.status === 'fulfilled' ? floodResult.value : null,
  };
}

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
  if (aqi <= 50) return { label: 'Good', color: 'green', description: 'Air quality is satisfactory.' };
  if (aqi <= 100) return { label: 'Moderate', color: 'gold', description: 'Acceptable for most people.' };
  if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', color: 'orange', description: 'May affect sensitive individuals.' };
  if (aqi <= 200) return { label: 'Unhealthy', color: 'red', description: 'Everyone may experience health effects.' };
  return { label: 'Very Unhealthy', color: 'red', description: 'Health alert — everyone may be affected.' };
}

function estimateNoiseLevel(highwayDriveMinutes) {
  let db = 40;
  const sources = [];
  if (highwayDriveMinutes != null) {
    if (highwayDriveMinutes <= 2) { db += 20; sources.push('Very close to highway'); }
    else if (highwayDriveMinutes <= 5) { db += 12; sources.push('Near highway'); }
    else if (highwayDriveMinutes <= 10) { db += 5; sources.push('Moderate highway proximity'); }
  }
  return { level: Math.min(db, 75), category: getNoiseCategory(db), sources };
}

function getNoiseCategory(db) {
  if (db < 45) return { label: 'Very Quiet', color: 'green', description: 'Rural or very quiet neighborhood.' };
  if (db < 55) return { label: 'Quiet', color: 'lightgreen', description: 'Typical quiet suburban.' };
  if (db < 65) return { label: 'Moderate', color: 'gold', description: 'Busy suburban or light urban.' };
  if (db < 70) return { label: 'Noisy', color: 'orange', description: 'Urban area with traffic noise.' };
  return { label: 'Very Noisy', color: 'red', description: 'Heavy traffic or industrial area.' };
}

async function getFloodRisk(lat, lng) {
  const url =
    `https://hazards.fema.gov/gis/nfhl/services/public/NFHL/MapServer/28/query` +
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

function getFloodRiskColor(risk) {
  if (risk === 'Minimal') return 'green';
  if (risk === 'Moderate') return 'gold';
  if (risk === 'High') return 'orange';
  if (risk === 'Very High') return 'red';
  return 'muted';
}

// ── FR-018: Community Safety & Activity ──────────────────────────────────────

async function getCrimeData(locationInfo) {
  const { state } = locationInfo || {};
  if (!state) return null;
  return {
    state,
    programs: [
      { icon: '🏘️', label: 'Neighborhood Watch Program' },
      { icon: '👮', label: 'Community Policing Initiative' },
      { icon: '📱', label: 'Non-Emergency Tip Line' },
      { icon: '🎉', label: 'Community Events & Outreach' },
      { icon: '🚨', label: 'Emergency Preparedness Resources' },
    ],
  };
}

// ── FR-017: Nearby Schools ────────────────────────────────────────────────────

async function getSchoolRatings(lat, lng, originLatLng, googleMapsClient, googleMapsApiKey, getDriveTime) {
  const searches = [
    { level: 'Elementary', query: 'public elementary school', exclude: ['preschool','pre-school','daycare','montessori','private'] },
    { level: 'Middle',     query: 'middle school',            exclude: ['elementary','preschool'] },
    { level: 'High',       query: 'high school',              exclude: ['middle','elementary','junior high'] },
  ];

  const results = await Promise.allSettled(
    searches.map(async ({ level, query, exclude }) => {
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
  );

  const schools = results.map((r) => (r.status === 'fulfilled' ? r.value : null));
  return schools.some(Boolean) ? schools : null;
}

// ── Master fetch ──────────────────────────────────────────────────────────────

async function getPremiumData({ lat, lng, originLatLng, locationInfo, googleMapsClient, googleMapsApiKey, getDriveTime, highwayDriveMinutes }) {
  const fips = await getCensusFIPS(lat, lng);

  const [demographics, propertyData, walkability, emergency, environment, crime, schools] =
    await Promise.allSettled([
      getDemographics(lat, lng, fips),
      getPropertyData(fips, locationInfo),
      getWalkabilityScore(lat, lng, googleMapsClient, googleMapsApiKey),
      getEmergencyServices(lat, lng, originLatLng, googleMapsClient, googleMapsApiKey, getDriveTime),
      getEnvironmentalData(lat, lng, highwayDriveMinutes),
      getCrimeData(locationInfo),
      getSchoolRatings(lat, lng, originLatLng, googleMapsClient, googleMapsApiKey, getDriveTime),
    ]);

  const val = (r) => (r.status === 'fulfilled' ? r.value : null);
  return {
    demographics: val(demographics),
    propertyData: val(propertyData),
    walkability: val(walkability),
    emergency: val(emergency),
    environment: val(environment),
    crime: val(crime),
    schools: val(schools),
  };
}

// ── FR-017: School highlights by level ───────────────────────────────────────

const SCHOOL_HIGHLIGHTS = {
  Elementary: [
    { icon: '🎨', label: 'Arts & Music' },
    { icon: '📚', label: 'Library Program' },
    { icon: '🏃', label: 'Physical Education' },
    { icon: '🧪', label: 'Science Exploration' },
    { icon: '🎭', label: 'After-School Clubs' },
    { icon: '👨‍👩‍👧', label: 'Parent Community' },
  ],
  Middle: [
    { icon: '🔬', label: 'STEM Labs' },
    { icon: '🎭', label: 'Performing Arts' },
    { icon: '⚽', label: 'Intramural Sports' },
    { icon: '🎵', label: 'Band & Choir' },
    { icon: '🏛️', label: 'Student Government' },
    { icon: '📚', label: 'Research Library' },
  ],
  High: [
    { icon: '🎓', label: 'AP & Honors' },
    { icon: '🏆', label: 'Varsity Athletics' },
    { icon: '🎨', label: 'Fine Arts' },
    { icon: '💻', label: 'Career & Tech' },
    { icon: '🌍', label: 'Clubs & Activities' },
    { icon: '📚', label: 'College Prep' },
  ],
};

const SCHOOL_SUPPORT = {
  Elementary: ['Full-time school counselor', 'Special education support', 'Gifted & enrichment programs', 'Before & after school care'],
  Middle: ['Guidance counselors', 'IEP & 504 services', 'Academic tutoring', 'Enrichment activities'],
  High: ['College counseling', 'Academic advisors', 'AP & honors support', 'Career guidance center', 'Tutoring services'],
};

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

// FR-017: Schools
function buildSchoolRatingsHTML(schools) {
  if (!schools) return '';
  const nearest = schools.find((s) => s != null);

  const narrativeHTML = nearest ? `
    <div class="prem-narrative">
      <p class="prem-narrative-lead">The nearest ${nearest.level.toLowerCase()} school is ${nearest.driveTimeMinutes} minute${nearest.driveTimeMinutes !== 1 ? 's' : ''} away—${nearest.driveTimeMinutes <= 5 ? 'close enough that walking or biking is realistic on good weather days' : nearest.driveTimeMinutes <= 10 ? 'a quick drive that fits easily into any morning routine' : nearest.driveTimeMinutes <= 15 ? 'a manageable commute once you know the route' : 'a commute worth timing on a real school morning'}. The information below is a starting point, not the full picture.</p>
      <p class="prem-narrative-body">The questions that matter most and are hardest to find online: average class size (smaller is generally better, especially in grades K–3), after-school care availability and its cutoff time (a dealbreaker for many working parents), and how active the parent community is. None of those appear in any directory—you find them by scheduling a tour on a regular school day and talking to parents at afternoon pickup.</p>
      <p class="prem-narrative-note">Don't assume the nearest school is your assigned school. Attendance boundaries don't always follow distance logic. Call the district office with your specific address—it takes 5 minutes and eliminates guesswork before you make a decision based on the wrong school.</p>
    </div>` : '';

  const items = schools.map((s) => {
    if (!s) return `<div class="prem-school-card prem-school-na"><p class="prem-na">No school found nearby.</p></div>`;

    const hlData = SCHOOL_HIGHLIGHTS[s.level] || SCHOOL_HIGHLIGHTS.Elementary;
    const highlights = hlData.map((h) =>
      `<div class="prem-school-highlight"><span class="prem-school-hl-icon">${h.icon}</span><span class="prem-school-hl-label">${esc(h.label)}</span></div>`
    ).join('');

    const supportData = SCHOOL_SUPPORT[s.level] || SCHOOL_SUPPORT.Elementary;
    const support = supportData.map((item) =>
      `<span class="prem-school-support-item">${esc(item)}</span>`
    ).join('');

    return `
    <div class="prem-school-card">
      <div class="prem-school-header">
        <div class="prem-school-level">${esc(s.level)} School</div>
        <div class="prem-school-name">${esc(s.name)}</div>
        <div class="prem-school-addr">${esc(s.address)}</div>
        <div class="prem-school-meta">
          <span class="prem-school-dist">${esc(s.distanceMiles)} mi away</span>
          ${s.driveTimeMinutes != null ? `<span class="prem-school-time">${s.driveTimeMinutes} min drive</span>` : ''}
        </div>
      </div>
      <div class="prem-school-opportunities">
        <div class="prem-school-opp-label">Typical Programs &amp; Activities</div>
        <div class="prem-school-highlights">${highlights}</div>
      </div>
      <div class="prem-school-support-section">
        <div class="prem-school-opp-label">Student Support Services</div>
        <div class="prem-school-support">${support}</div>
      </div>
    </div>`;
  }).join('');

  const body = `
    ${narrativeHTML}
    ${items}
    <p class="prem-disclaimer">Programs shown are typical for this school level — contact the school directly to confirm specific offerings. School assignment requires verification with the local school district.</p>`;
  return premiumCard('Schools', 'Nearby Schools', body);
}

// FR-018: Community Safety & Activity
function buildCrimeHTML(crime, emergency) {
  if (!crime) return '';

  const policeSection = emergency?.police ? `
    <div class="prem-comm-police">
      <div class="prem-comm-police-head">
        <span class="prem-comm-police-icon">🚔</span>
        <div class="prem-comm-police-text">
          <div class="prem-comm-police-name">${esc(emergency.police.name)}</div>
          <div class="prem-comm-police-sub">${esc(emergency.police.distanceMiles)} miles away</div>
        </div>
        <span class="prem-badge prem-badge-right" style="${badgeColor(emergency.police.response.category.color)}">~${emergency.police.response.estimate} min response</span>
      </div>
    </div>` : '';

  const programsHTML = crime.programs.map((p) => `
    <div class="prem-comm-program">
      <span class="prem-comm-prog-icon">${p.icon}</span>
      <span class="prem-comm-prog-label">${esc(p.label)}</span>
    </div>`).join('');

  const policeTime = emergency?.police?.response?.estimate;
  const policeIntro = emergency?.police
    ? `The nearest police station is ${esc(emergency.police.distanceMiles)} miles away with an estimated ${policeTime}-minute response time.`
    : '';

  const crimeContext = `
    <div class="prem-narrative">
      <p class="prem-narrative-lead">Understanding community safety goes beyond crime statistics. The programs and infrastructure below tell you how actively this area invests in resident safety—neighborhood watch networks, community policing, and emergency preparedness all contribute to how safe daily life actually feels.</p>
      <p class="prem-narrative-body">${policeIntro ? policeIntro + ' ' : ''}Response time estimates are based on distance—actual times depend on call volume, time of day, and available units. For a truer picture, check with the local precinct or look up community crime mapping tools for your specific block.</p>
      <p class="prem-narrative-note">The most informative signal is often community engagement: active neighborhood watch groups and strong turnout at local meetings correlate with lower crime rates more reliably than raw statistics. Ask neighbors when you visit—five minutes of conversation reveals what no report can.</p>
    </div>`;

  const body = `
    ${crimeContext}
    ${policeSection}
    <div class="prem-comm-section-label">Community Safety Programs</div>
    <div class="prem-comm-programs">${programsHTML}</div>
    <p class="prem-disclaimer">This section is provided for informational purposes only. For current community safety information, contact your local police department or city government. Program availability varies by municipality.</p>`;
  return premiumCard('Safety', 'Community Safety & Activity', body);
}

// FR-019: Environmental
function buildEnvironmentalHTML(env) {
  if (!env) return '';
  const items = [];

  if (env.airQuality) {
    items.push(`
    <div class="prem-env-card">
      <div class="prem-env-head">
        <div class="prem-env-icon">🌫️</div>
        <div>
          <div class="prem-env-title">Air Quality</div>
          <span class="prem-badge" style="${badgeColor(env.airQuality.category.color)}">${esc(env.airQuality.category.label)}</span>
        </div>
        <div class="prem-env-value">AQI ${env.airQuality.aqi}</div>
      </div>
      <div class="prem-env-desc">${esc(env.airQuality.category.description)} Primary pollutant: ${esc(env.airQuality.primaryPollutant)}.</div>
    </div>`);
  }

  if (env.noise) {
    const noiseSrc = env.noise.sources.length ? ` Source: ${env.noise.sources.join(', ')}.` : '';
    items.push(`
    <div class="prem-env-card">
      <div class="prem-env-head">
        <div class="prem-env-icon">🔊</div>
        <div>
          <div class="prem-env-title">Noise Level</div>
          <span class="prem-badge" style="${badgeColor(env.noise.category.color)}">${esc(env.noise.category.label)}</span>
        </div>
        <div class="prem-env-value">~${env.noise.level} dB</div>
      </div>
      <div class="prem-env-desc">${esc(env.noise.category.description)}${esc(noiseSrc)} Estimated based on proximity to highway.</div>
    </div>`);
  }

  if (env.floodRisk) {
    const fl = env.floodRisk;
    items.push(`
    <div class="prem-env-card">
      <div class="prem-env-head">
        <div class="prem-env-icon">💧</div>
        <div>
          <div class="prem-env-title">Flood Risk</div>
          <span class="prem-badge" style="${badgeColor(getFloodRiskColor(fl.risk))}">${esc(fl.risk)} Risk</span>
        </div>
        <div class="prem-env-value">Zone ${esc(fl.zone)}</div>
      </div>
      <div class="prem-env-desc">${esc(fl.description)} Flood insurance: <strong>${fl.insuranceRequired ? 'Required for mortgages' : 'Not required'}</strong>.</div>
    </div>`);
  }

  if (!items.length) return '';

  const envFactors = [];
  if (env.airQuality) envFactors.push(env.airQuality.category.color === 'green' ? 'air quality is good' : env.airQuality.category.color === 'gold' ? 'air quality is moderate—noticeable for sensitive individuals' : 'air quality is a genuine concern worth monitoring');
  if (env.noise) envFactors.push(env.noise.category.color === 'green' ? 'noise levels are low' : env.noise.category.color === 'gold' ? 'noise is moderate—you may notice it with windows open' : 'noise is elevated enough to factor into your daily experience');
  if (env.floodRisk) envFactors.push(env.floodRisk.risk === 'Low' ? 'flood risk is minimal' : env.floodRisk.risk === 'Moderate' ? 'flood risk is moderate—worth understanding your specific parcel' : 'flood risk is elevated—insurance and elevation certificates matter here');

  const envIntro = envFactors.length
    ? `For this location: ${envFactors.join('; ')}. These factors affect daily comfort and long-term costs in ways that don't show up in price-per-square-foot comparisons.`
    : '';

  const body = (envIntro ? `<div class="prem-narrative"><p class="prem-narrative-body">${envIntro}</p></div>` : '') +
    items.join('') +
    `<p class="prem-disclaimer">Air quality: EPA AirNow. Flood zone: FEMA National Flood Hazard Layer. Noise: estimate based on highway proximity.</p>`;
  return premiumCard('Environment', 'Environmental Factors', body);
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

// FR-023: Property Data
function buildPropertyDataHTML(p) {
  if (!p) return '';
  const taxLow = p.taxRate < 0.5;
  const taxHigh = p.taxRate > 1.5;
  const taxContext = taxLow
    ? `${p.taxRate.toFixed(2)}% is a notably low property tax rate. That translates to meaningful savings over time compared to higher-tax states—but check whether local municipalities layer on additional levies above the state average.`
    : taxHigh
    ? `${p.taxRate.toFixed(2)}% is on the higher end for property taxes. Factor this into your total cost-of-ownership math. In many high-tax states, strong school funding is the trade-off—so what you pay in taxes may come back in school quality and local services.`
    : `${p.taxRate.toFixed(2)}% is a typical property tax rate. Budget roughly ${p.annualTax ? formatMoney(Math.round(p.annualTax / 12)) + '/month' : 'taxes based on your purchase price'} for property taxes on a home at the area median.`;

  const body = `
    <div class="prem-narrative">
      <p class="prem-narrative-body">${taxContext} The median home value shown here is a Census tract average from 2018–2022 data—it includes all housing types across a wide geographic area. In fast-growing markets, actual current prices may be significantly higher. Use this as directional context, not a pricing estimate.</p>
    </div>
    <div class="prem-market-grid">
      <div class="prem-market-card">
        <div class="prem-market-icon">💰</div>
        <div class="prem-market-title">Property Tax Rate</div>
        <div class="prem-market-value">${p.taxRate.toFixed(2)}%</div>
        <div class="prem-market-sub">${esc(p.state)} state average</div>
      </div>
      <div class="prem-market-card">
        <div class="prem-market-icon">🏠</div>
        <div class="prem-market-title">Median Home Value</div>
        <div class="prem-market-value">${p.medianHomeValue ? formatMoney(p.medianHomeValue) : 'N/A'}</div>
        <div class="prem-market-sub">ACS 2022 est. · tract avg</div>
      </div>
      <div class="prem-market-card">
        <div class="prem-market-icon">📋</div>
        <div class="prem-market-title">Est. Annual Taxes</div>
        <div class="prem-market-value">${p.annualTax ? formatMoney(p.annualTax) : 'N/A'}</div>
        <div class="prem-market-sub">At median home value</div>
      </div>
      <div class="prem-market-card">
        <div class="prem-market-icon">🏘️</div>
        <div class="prem-market-title">Area Type</div>
        <div class="prem-market-value">${esc(p.densityLabel)}</div>
        <div class="prem-market-sub">by Census tract population</div>
      </div>
    </div>
    <div class="prem-market-note">
      <span class="prem-market-note-icon">ℹ️</span>
      <span>The median home value is a <strong>Census tract average</strong> from 2018–2022 ACS data. It includes rentals, condos, and all owner-occupied units across the tract — individual property values and current market prices may differ significantly. Fast-growing areas especially may have seen substantial appreciation since this estimate.</span>
    </div>
    <p class="prem-disclaimer">Property tax rate is the state average effective rate. Home values from U.S. Census Bureau ACS 5-year estimates (2022). Not a property appraisal — consult a licensed real estate professional for current pricing.</p>`;
  return premiumCard('Market', 'Property & Market Data', body);
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
        if (inc > 100000) return `Median household income of ${formatMoney(inc)} indicates an affluent area. That usually correlates with well-maintained properties, strong local tax base, and active investment in schools and public services.`;
        if (inc > 60000) return `Median household income of ${formatMoney(inc)} puts this solidly in the middle tier—a working and professional community with financial stability. The range of incomes typically produces diverse, grounded neighborhoods.`;
        return `Median household income of ${formatMoney(inc)} reflects a more modest economic profile. That can mean a tight-knit community with deep roots, or it can mean deferred maintenance and stretched local services—visit in person to get a feel for which describes this area.`;
      })()
    : null;

  const communityNarrative = (() => {
    const ownership = d.community.ownershipRate;
    if (ownership > 75) return `${ownership}% homeownership means you're in a primarily owner-occupied neighborhood. People who own tend to stay longer, invest in their properties, and participate more in community decisions. That translates to stability and a stronger sense of shared stake in the neighborhood.`;
    if (ownership > 50) return `${ownership}% homeownership suggests a mixed neighborhood of owners and renters. Ownership majority generally signals investment and stability, while a meaningful renter population brings diversity and change.`;
    return `${ownership}% homeownership—majority renter. Renters aren't less invested in their communities, but higher turnover is typical in rental-heavy areas. It can make it harder to build long-term neighbor relationships and often correlates with more frequent property management changes.`;
  })();

  const body = `
    <div class="prem-narrative">
      <p class="prem-narrative-lead">${ageNarrative}</p>
      ${incomeNarrative ? `<p class="prem-narrative-body">${incomeNarrative}</p>` : ''}
      <p class="prem-narrative-body">${communityNarrative}</p>
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
        ${d.community.avgHHSize ? `<div class="prem-community-item">👥 ${d.community.avgHHSize} avg household size</div>` : ''}
      </div>
    </div>
    <p class="prem-disclaimer">Data: U.S. Census Bureau American Community Survey 5-year estimates (2022). Census tract level. Provided for informational purposes only; not to be used as a basis for housing discrimination.</p>`;
  return premiumCard('Community', 'Demographics & Community', body);
}

// All premium sections in display order
function buildPremiumSectionsHTML(premium) {
  if (!premium) return '';
  return [
    buildSchoolRatingsHTML(premium.schools),
    buildCrimeHTML(premium.crime, premium.emergency),
    buildEnvironmentalHTML(premium.environment),
    buildEmergencyServicesHTML(premium.emergency),
    buildWalkabilityHTML(premium.walkability),
    buildPropertyDataHTML(premium.propertyData),
    buildDemographicsHTML(premium.demographics),
  ].join('');
}

module.exports = { getPremiumData, buildPremiumSectionsHTML };
