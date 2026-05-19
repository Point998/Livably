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

  const vars = [
    'B01001_001E', 'B01002_001E',
    'B19013_001E',
    'B25003_001E', 'B25003_002E', 'B25010_001E',
    'B15003_001E', 'B15003_017E', 'B15003_022E', 'B15003_023E', 'B15003_024E', 'B15003_025E',
    // Male age groups: <5, 5-9, 10-14, 15-17, 18-19, 20, 21, 22-24, 25-29, 30-34,
    //                  35-39, 40-44, 45-49, 50-54, 55-59, 60-61, 62-64, 65-66, 67-69, 70-74, 75-79, 80-84, 85+
    'B01001_003E','B01001_004E','B01001_005E','B01001_006E',
    'B01001_007E','B01001_008E','B01001_009E','B01001_010E','B01001_011E','B01001_012E',
    'B01001_013E','B01001_014E','B01001_015E','B01001_016E','B01001_017E','B01001_018E','B01001_019E',
    'B01001_020E','B01001_021E','B01001_022E','B01001_023E','B01001_024E','B01001_025E',
    // Female age groups (same sequence as male, starting at index 027)
    'B01001_027E','B01001_028E','B01001_029E','B01001_030E',
    'B01001_031E','B01001_032E','B01001_033E','B01001_034E','B01001_035E','B01001_036E',
    'B01001_037E','B01001_038E','B01001_039E','B01001_040E','B01001_041E','B01001_042E','B01001_043E',
    'B01001_044E','B01001_045E','B01001_046E','B01001_047E','B01001_048E','B01001_049E',
  ];

  try {
    const acs = await fetchCensusACS(fips, vars);
    if (!acs) return null;
    const { get } = acs;

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

const WALK_TYPES = [
  { type: 'grocery_or_supermarket', weight: 25 },
  { type: 'restaurant', weight: 20 },
  { type: 'transit_station', weight: 20 },
  { type: 'park', weight: 15 },
  { type: 'pharmacy', weight: 20 },
];

async function getWalkabilityScore(lat, lng, googleMapsClient, googleMapsApiKey) {
  const results = await Promise.allSettled(
    WALK_TYPES.map(({ type }) =>
      googleMapsClient.placesNearby({
        params: { key: googleMapsApiKey, location: `${lat},${lng}`, radius: 800, type },
      })
    )
  );

  let totalScore = 0;
  for (let i = 0; i < WALK_TYPES.length; i++) {
    const { weight } = WALK_TYPES[i];
    const r = results[i];
    if (r.status !== 'fulfilled') continue;
    const count = (r.value.data.results || []).length;
    totalScore += count === 0 ? 0 : count <= 2 ? Math.round(weight * 0.5) : weight;
  }

  const score = Math.min(100, totalScore);
  return { score, category: getWalkCategory(score), isProxy: true };
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

// ── FR-018: Crime Data ────────────────────────────────────────────────────────

async function getCrimeData(locationInfo) {
  const fbiKey = process.env.FBI_CRIME_API_KEY;
  if (!fbiKey) return null;
  const { city, state } = locationInfo || {};
  if (!city || !state) return null;
  try {
    const cityEnc = encodeURIComponent(city);
    const url = `https://api.usa.gov/crime/fbi/sapi/api/summarized/agencies/${state}/${cityEnc}/offenses/2022/2022?api_key=${fbiKey}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    const results = data?.results || (Array.isArray(data) ? data : null);
    if (!results?.length) return null;

    let totalViolent = 0, totalProperty = 0, totalPop = 0;
    for (const r of results) {
      totalViolent += (r.violent_crime || 0);
      totalProperty += (r.property_crime || 0);
      totalPop += (r.population || 0);
    }
    if (!totalPop) return null;

    const violentRate = ((totalViolent / totalPop) * 1000).toFixed(1);
    const propertyRate = ((totalProperty / totalPop) * 1000).toFixed(1);
    const totalRate = (((totalViolent + totalProperty) / totalPop) * 1000).toFixed(1);
    const nationalAvg = 30;
    const safetyScore = Math.round(Math.max(0, Math.min(100, 100 - (parseFloat(totalRate) / nationalAvg) * 50)));

    return {
      city, state, population: totalPop,
      violentRate, propertyRate, totalRate,
      safetyScore, grade: getCrimeGrade(safetyScore),
      comparedToNational: parseFloat(totalRate) < nationalAvg ? 'below' : 'above',
      nationalPct: Math.abs(Math.round(((parseFloat(totalRate) - nationalAvg) / nationalAvg) * 100)),
      dataYear: 2022,
    };
  } catch (err) {
    console.error('[Crime]', err.message);
    return null;
  }
}

function getCrimeGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
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

// ── HTML builders ──────────────────────────────────────────────────────────────

function badgeColor(color) {
  const map = {
    green: 'background:rgba(40,167,69,0.12);color:#1e7e34',
    lightgreen: 'background:rgba(92,184,92,0.12);color:#3a9a3a',
    gold: 'background:rgba(184,146,42,0.12);color:#8a6a10',
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
  const items = schools.map((s) => {
    if (!s) return `<div class="prem-school-card prem-school-na"><p class="prem-na">No school found nearby.</p></div>`;
    return `
    <div class="prem-school-card">
      <div class="prem-school-level">${esc(s.level)} School</div>
      <div class="prem-school-name">${esc(s.name)}</div>
      <div class="prem-school-addr">${esc(s.address)}</div>
      <div class="prem-school-meta">
        <span class="prem-school-dist">${esc(s.distanceMiles)} mi</span>
        ${s.driveTimeMinutes != null ? `<span class="prem-school-time">${s.driveTimeMinutes} min drive</span>` : ''}
      </div>
    </div>`;
  }).join('');
  const body = `
    ${items}
    <p class="prem-disclaimer">Nearest schools by distance. Assigned school for this address requires verification with the local school district.</p>`;
  return premiumCard('Schools', 'Nearby Schools', body);
}

// FR-018: Crime
function buildCrimeHTML(crime) {
  if (!crime) return '';
  const gradeColors = { A:'#1e7e34', B:'#3a9a3a', C:'#8a6a10', D:'#c0530a', F:'#a71d2a' };
  const gradeColor = gradeColors[crime.grade] || '#555';
  const body = `
    <div class="prem-crime-overview">
      <div class="prem-grade-circle" style="border-color:${gradeColor};color:${gradeColor}">${esc(crime.grade)}</div>
      <div class="prem-crime-summary">
        <div class="prem-crime-score">${crime.safetyScore}/100 Safety Score</div>
        <div class="prem-crime-city">${esc(crime.city)}, ${esc(crime.state)}</div>
        <div class="prem-crime-context">Total crime rate is ${crime.nationalPct}% ${crime.comparedToNational} the national average.</div>
      </div>
    </div>
    <div class="prem-crime-stats">
      <div class="prem-crime-stat">
        <div class="prem-stat-val">${crime.violentRate}</div>
        <div class="prem-stat-lbl">Violent crime<br>per 1,000</div>
      </div>
      <div class="prem-crime-stat">
        <div class="prem-stat-val">${crime.propertyRate}</div>
        <div class="prem-stat-lbl">Property crime<br>per 1,000</div>
      </div>
      <div class="prem-crime-stat">
        <div class="prem-stat-val">${crime.totalRate}</div>
        <div class="prem-stat-lbl">Total crime<br>per 1,000</div>
      </div>
    </div>
    <p class="prem-disclaimer">FBI Crime Data Explorer (${crime.dataYear}) for ${esc(crime.city)}. City-level data. Crime statistics are for informational purposes only and should not be the sole factor in housing decisions.</p>`;
  return premiumCard('Safety', 'Crime & Safety Data', body);
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
  const body = items.join('') + `<p class="prem-disclaimer">Air quality: EPA AirNow. Flood zone: FEMA National Flood Hazard Layer. Noise: estimate based on highway proximity.</p>`;
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

  const body =
    serviceCard('🚔', 'Police', emergency.police) +
    serviceCard('🚒', 'Fire Department', emergency.fire) +
    `<p class="prem-disclaimer">Response times are estimates based on distance to nearest stations. Actual times vary. Contact local emergency services for official data.</p>`;
  return premiumCard('Emergency Services', 'Emergency Response', body);
}

// FR-021: Walkability
function buildWalkabilityHTML(walk) {
  if (!walk) return '';
  const { score, category } = walk;
  const trackColor = {
    green: '#28a745', lightgreen: '#5cb85c', gold: '#b8922a', orange: '#fd7e14', red: '#dc3545',
  }[category.color] || '#b8922a';
  const body = `
    <div class="prem-walk-score-wrap">
      <div class="prem-walk-circle" style="border-color:${trackColor}">
        <div class="prem-walk-number" style="color:${trackColor}">${score}</div>
        <div class="prem-walk-scale">/ 100</div>
      </div>
      <div class="prem-walk-info">
        <div class="prem-walk-label">${esc(category.label)}</div>
        <div class="prem-walk-desc">${esc(category.description)}</div>
      </div>
    </div>
    <p class="prem-disclaimer">Walkability score is estimated from nearby amenities within 0.5 miles using Google Places data. Not an official Walk Score®.</p>`;
  return premiumCard('Walkability', 'Walk & Transit Score', body);
}

// FR-023: Property Data
function buildPropertyDataHTML(p) {
  if (!p) return '';
  const body = `
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
        <div class="prem-market-sub">Census tract estimate</div>
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
    <p class="prem-disclaimer">Tax rate is the state average effective property tax rate. Home values from U.S. Census Bureau ACS 5-year estimates. Not a property appraisal. Consult a licensed professional.</p>`;
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

  const body = `
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
    buildCrimeHTML(premium.crime),
    buildEnvironmentalHTML(premium.environment),
    buildEmergencyServicesHTML(premium.emergency),
    buildWalkabilityHTML(premium.walkability),
    buildPropertyDataHTML(premium.propertyData),
    buildDemographicsHTML(premium.demographics),
  ].join('');
}

module.exports = { getPremiumData, buildPremiumSectionsHTML };
