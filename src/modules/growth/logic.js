'use strict';

const { COMMERCIAL_DEV_TYPES } = require('../../utils/constants');

// Label/icon sourced from COMMERCIAL_DEV_TYPES keyed by Google `type`, so the OSM
// path never drifts from the Google path's display strings.
const COMMERCIAL_TYPE_META = Object.fromEntries(
  COMMERCIAL_DEV_TYPES.map((t) => [t.type, t]),
);

// FR-071 — classify an OSM POI's raw tags into one of the COMMERCIAL_DEV_TYPES
// categories (or null to discard). Tag-only inspection (CONSTRAINT-004: no
// brand/name) — the one place the OSM tag→commercial-type rule lives. First match
// wins; gym is unioned across OSM's three inconsistent tags.
function categorizeOSMCommercialPOI(tags) {
  if (!tags) return null;
  // Skip non-operational POIs (the OSM proxy for business_status !== OPERATIONAL).
  if (Object.keys(tags).some((k) => /^(disused|abandoned|razed|demolished):/i.test(k))) return null;
  let type = null;
  if (tags.shop === 'mall') type = 'shopping_mall';
  else if (tags.shop === 'supermarket') type = 'supermarket';
  else if (tags.shop === 'department_store') type = 'department_store';
  else if (tags.leisure === 'fitness_centre' || tags.sport === 'fitness' || tags.amenity === 'gym') type = 'gym';
  else if (tags.amenity === 'cinema') type = 'movie_theater';
  else if (tags.amenity === 'bank') type = 'bank';
  if (!type) return null;
  const meta = COMMERCIAL_TYPE_META[type];
  return { type, label: meta.label, icon: meta.icon };
}

/**
 * Calculates percent change between current and prior permit counts.
 * Returns null if prior is null or zero.
 */
function calcPermitPercentChange(currentPermits, priorPermits) {
  if (priorPermits == null || priorPermits === 0) return null;
  return Math.round((currentPermits - priorPermits) / priorPermits * 100);
}

/**
 * Classifies a permit trend as 'rising', 'declining', or 'stable'
 * based on a percent change value.
 * Returns 'stable' when percentChange is null.
 */
function classifyPermitTrend(percentChange) {
  if (percentChange === null) return 'stable';
  if (percentChange >= 10)  return 'rising';
  if (percentChange <= -10) return 'declining';
  return 'stable';
}

module.exports = { calcPermitPercentChange, classifyPermitTrend, categorizeOSMCommercialPOI };
