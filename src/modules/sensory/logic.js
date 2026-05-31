'use strict';

const { FEMA_FLOOD_ZONES, RADON_ZONE_BY_STATE } = require('../../utils/constants');

// ── Sensory & Environmental — classifier / transform functions ───────────────

function getAQICategory(aqi) {
  if (aqi <= 50)  return { label: 'Good',                           color: 'green',  description: 'Air quality is satisfactory.' };
  if (aqi <= 100) return { label: 'Moderate',                       color: 'gold',   description: 'Acceptable for most people.' };
  if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups',  color: 'orange', description: 'May affect sensitive individuals.' };
  if (aqi <= 200) return { label: 'Unhealthy',                      color: 'red',    description: 'Everyone may experience health effects.' };
  return            { label: 'Very Unhealthy',                       color: 'red',    description: 'Health alert — everyone may be affected.' };
}

function interpretFloodZone(zone) {
  return FEMA_FLOOD_ZONES[zone] || { risk: 'Unknown', insuranceRequired: false, description: 'Flood zone data unavailable.' };
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

function getRadonZone(fips) {
  if (!fips?.state) return null;
  const zone = RADON_ZONE_BY_STATE[fips.state] ?? 2;
  return { zone };
}

module.exports = {
  getAQICategory,
  interpretFloodZone,
  estimateDNLFromRoad,
  getDNLCategory,
  estimateBortle,
  getBortleDescription,
  getRadonZone,
};
