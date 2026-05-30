'use strict';

const path = require('path');
const fs   = require('fs');
const { logError } = require('../../logger');
const {
  STATE_ALERT_SYSTEMS,
  CLIMATE_SIGNIFICANT_DAMAGE_USD,
  NOAA_CDO_BASE_URL, NOAA_CDO_NORMALS_DATASET, NOAA_CDO_NORMALS_ANN,
  NOAA_STATION_SEARCH_RADII,
  FEMA_DECLARATIONS_URL, USGS_ELEVATION_URL,
  CLIMATE_STORM_LOOKBACK_YEARS, CLIMATE_FEMA_LOOKBACK_YEARS,
} = require('../../utils/constants');

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

async function fetchElevationWithRetry(url, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const value = data?.value ?? null;
      if (value === null) throw new Error('null value in response');
      return value;
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        return null;
      }
    }
  }
}

async function getWatershedContext(lat, lng) {
  const offsets = [[0, 0], [0.0036, 0], [-0.0036, 0], [0, 0.0045], [0, -0.0045]];
  const urls = offsets.map(([dlat, dlng]) =>
    `${USGS_ELEVATION_URL}?x=${(lng + dlng).toFixed(6)}&y=${(lat + dlat).toFixed(6)}&units=Feet&wkid=4326&includeDate=false`
  );

  const results = await Promise.all(urls.map(url => fetchElevationWithRetry(url)));

  // Log any point that exhausted all retries
  results.forEach((val, i) => {
    if (val === null) {
      logError(
        'getWatershedContext',
        `${lat},${lng}`,
        new Error(`elevation point ${i} (offset ${JSON.stringify(offsets[i])}) exhausted all retries`)
      );
    }
  });

  const centerElevation = results[0];
  if (centerElevation === null) return null;

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

module.exports = {
  getClimateHistoryData,
  getNOAAClimateNormals,
  getNOAAStormEvents,
  getFEMADeclarations,
  getWatershedContext,
  fetchElevationWithRetry,
  getEmergencySystem,
  getLastSignificantEvent,
  computeRarityStatement,
  classifyTopographicPosition,
};
