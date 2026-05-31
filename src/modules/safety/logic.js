'use strict';
const {
  RESPONSE_SPEED_MPH,
  RESPONSE_DISPATCH_MINUTES,
  RESPONSE_TIME_THRESHOLDS,
} = require('../../utils/constants');

function normalizeStationName(name) {
  if (!name) return name;
  return name.replace(/Fire\s+Protction\s+Services/gi, 'Fire Protection Services');
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

async function getSafetyLocationContext(locationInfo) {
  const { state, city, county } = locationInfo || {};
  if (!state) return null;
  return { state, city, county };
}

module.exports = { normalizeStationName, estimateResponseTime, getSafetyLocationContext };
