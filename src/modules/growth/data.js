'use strict';

const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { fetchCensusACS } = require('../../shared/census');
const { haversineDistance } = require('../../utils/geo');
const { safeInt } = require('../../utils/text');
const { discoverDevelopments, GOOGLE_NEWS_RSS_URL } = require('../../development-discovery');
const {
  COMMERCIAL_DEV_TYPES,
  DEVELOPMENT_ACTIVITY_SEARCH_RADIUS_M,
} = require('../../utils/constants');
const { calcPermitPercentChange, classifyPermitTrend } = require('./logic');

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
    const percentChange = calcPermitPercentChange(
      current.permits,
      prior?.permits ?? null,
    );
    const trend = classifyPermitTrend(percentChange);
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

async function getRecentDevelopmentActivity(lat, lng) {
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

async function getGrowthAndDevelopment(lat, lng, fips, locationInfo) {
  const [permitRes, newConstRes, activityRes, discoveryRes] = await Promise.allSettled([
    getBuildingPermitTrend(fips),
    getNewConstructionContext(fips),
    getRecentDevelopmentActivity(lat, lng),
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

const SOURCES = [
  { id: 'census-bps', label: 'Census Building Permits Survey', provider: 'census', coverage: 'some',
    run: (ctx) => getBuildingPermitTrend(ctx.fips),
    isValid: (r) => r !== null && typeof r?.current === 'number' },
  { id: 'census-acs-construction', label: 'Census ACS5 new construction share', provider: 'census', coverage: 'all', requiresKey: 'CENSUS_API_KEY',
    run: (ctx) => getNewConstructionContext(ctx.fips),
    isValid: (r) => r !== null && typeof r?.newConstructionPct === 'number' },
  { id: 'google-places-development', label: 'Google Places nearby (commercial development)', provider: 'google', coverage: 'some',
    run: (ctx) => getRecentDevelopmentActivity(ctx.lat, ctx.lng),
    isValid: (r) => Array.isArray(r) && r.length > 0,
    probe: async (ctx) => { const { googleMapsApiKey } = require('../../shared/google/client'); const resp = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${ctx.lat},${ctx.lng}&radius=1000&type=restaurant&key=${googleMapsApiKey}`, { signal: AbortSignal.timeout(8000) }); return resp.status; } },
  { id: 'google-news-rss', label: 'Google News RSS (development news)', provider: 'google-news', coverage: 'some',
    run: (ctx) => discoverDevelopments(ctx.county?.replace(/\s+County\s*$/i, '') || ctx.state, ctx.state),
    isValid: (r) => Array.isArray(r) && r.length > 0,
    probe: async (ctx) => { const q = encodeURIComponent(`"${ctx.state}" development construction`); const resp = await fetch(`${GOOGLE_NEWS_RSS_URL}?q=${q}&hl=en-US&gl=US&ceid=US:en`, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Livably/1.0' } }); return resp.status; } },
];

module.exports = {
  getGrowthAndDevelopment,
  getBuildingPermitTrend,
  getNewConstructionContext,
  getRecentDevelopmentActivity,
  SOURCES,
};
