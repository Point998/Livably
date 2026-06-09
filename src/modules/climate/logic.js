'use strict';

const {
  STATE_ALERT_SYSTEMS,
  CLIMATE_SIGNIFICANT_DAMAGE_USD,
  PGA_BAND_THRESHOLDS,
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

// Pure: USGS ASCE 7-16 design values -> layperson seismic band + narrative.
// CONSTRAINT-001: descriptive band, never a numeric score.
function getSeismicContext(raw) {
  const pga = Number(raw && raw.pga);
  if (!pga || isNaN(pga) || pga <= 0) return null;

  const t = PGA_BAND_THRESHOLDS.find((b) => pga < b.max) || PGA_BAND_THRESHOLDS[PGA_BAND_THRESHOLDS.length - 1];
  const promote = t.band === 'moderate' || t.band === 'high' || t.band === 'very-high';
  const pgaG = pga.toFixed(2);

  let narrative;
  if (t.band === 'very-low' || t.band === 'low') {
    narrative =
      `USGS models ${t.band === 'very-low' ? 'very low' : 'low'} earthquake ground motion here ` +
      `— peak ground acceleration about ${pgaG}g. Standard residential construction is well within ` +
      `tolerance; seismic upgrades aren't a concern at this address.`;
  } else if (t.band === 'moderate') {
    narrative =
      `USGS models moderate earthquake ground motion here — peak ground acceleration about ${pgaG}g. ` +
      `Worth confirming the home meets current building code; ask the inspector about foundation ` +
      `bracing and a strapped water heater.`;
  } else {
    narrative =
      `This is seismically active country — USGS models ${t.band === 'very-high' ? 'very high' : 'high'} ` +
      `ground motion (peak ground acceleration about ${pgaG}g). Confirm the home was built to or ` +
      `retrofitted for modern seismic code, and ask specifically about foundation anchoring, ` +
      `cripple-wall bracing, and a strapped water heater.`;
  }

  return {
    pga,
    ss:  Number(raw.ss)  || null,
    s1:  Number(raw.s1)  || null,
    sds: Number(raw.sds) || null,
    band: t.band,
    label: t.label,
    color: t.color,
    promote,
    narrative,
  };
}

module.exports = {
  getEmergencySystem,
  getLastSignificantEvent,
  computeRarityStatement,
  classifyTopographicPosition,
  getSeismicContext,
};
