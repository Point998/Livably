'use strict';
// CONSTRAINT-014: This file is the single place where cross-module coherence rules live.
// No module may implement its own cross-state filtering, rural detection, or drive time
// coherence check independently.
const { reverseGeocodeAddress } = require('./google/reverseGeocode');
const {
  RURAL_MODE_URBAN_POP_MIN,
  RURAL_MODE_SUBURBAN_POP_MIN,
  RURAL_MODE_REMOTE_POP_MAX,
  RURAL_MODE_SUBURBAN_MAX_DRIVE_MINUTES,
  DRIVE_TIME_COHERENCE_THRESHOLD_MINUTES,
} = require('../utils/constants');

// CONSTRAINT-007: Classify address as urban/suburban/rural/remote before narrative generation.
// tractPopulation: Census tract total population (integer)
// avgDriveMinutes: drive time to nearest grocery (float | null when unavailable)
function detectRuralMode(tractPopulation, avgDriveMinutes) {
  const hasDrive = avgDriveMinutes !== null && avgDriveMinutes !== undefined;

  if (tractPopulation <= RURAL_MODE_REMOTE_POP_MAX) {
    return { mode: 'remote', label: 'Remote' };
  }
  if (hasDrive && avgDriveMinutes > DRIVE_TIME_COHERENCE_THRESHOLD_MINUTES) {
    return { mode: 'remote', label: 'Remote' };
  }
  if (tractPopulation >= RURAL_MODE_URBAN_POP_MIN) {
    return { mode: 'urban', label: 'Urban' };
  }
  if (tractPopulation >= RURAL_MODE_SUBURBAN_POP_MIN && (!hasDrive || avgDriveMinutes <= RURAL_MODE_SUBURBAN_MAX_DRIVE_MINUTES)) {
    return { mode: 'suburban', label: 'Suburban' };
  }
  return { mode: 'rural', label: 'Rural' };
}

// CONSTRAINT-006: Reject results from a different state than the origin address.
// Fails open (returns valid) on API errors or missing origin state so callers are never blocked.
// resultLatLng: { lat, lng } object or "lat,lng" string
// originState: 2-letter abbreviation from reverse geocoding at report start
async function checkCrossState(resultLatLng, originState) {
  if (!originState) return { valid: true, resultState: '' };

  try {
    const latLng = typeof resultLatLng === 'string'
      ? resultLatLng
      : `${resultLatLng.lat},${resultLatLng.lng}`;
    const { state: resultState } = await reverseGeocodeAddress(latLng);
    if (!resultState) return { valid: true, resultState: '' };
    return { valid: resultState === originState, resultState };
  } catch {
    return { valid: true, resultState: '' };
  }
}

// CONSTRAINT-010: Flag daily destinations >45 min for non-rural addresses.
// driveTimeMinutes: number
// destinationLabel: human-readable name for the reason string
// ruralMode: 'urban' | 'suburban' | 'rural' | 'remote'
function checkDriveTimeCoherence(driveTimeMinutes, destinationLabel, ruralMode) {
  if (ruralMode === 'rural' || ruralMode === 'remote') {
    return { ok: true, reason: '' };
  }
  if (driveTimeMinutes > DRIVE_TIME_COHERENCE_THRESHOLD_MINUTES) {
    return {
      ok: false,
      reason: `${destinationLabel} drive time of ${driveTimeMinutes} min exceeds ${DRIVE_TIME_COHERENCE_THRESHOLD_MINUTES} min threshold for ${ruralMode} address`,
    };
  }
  return { ok: true, reason: '' };
}

// CONSTRAINT-007 + CONSTRAINT-014: Basement detection — region-aware, rural mode checked first.
// Rural construction patterns can run opposite to suburban patterns — never apply suburban
// era-based rules to rural addresses without checking region first.
// constructionEra: string year ('1985') or null
// state: 2-letter abbreviation
// ruralMode: 'urban' | 'suburban' | 'rural' | 'remote'
function getBasementContext(constructionEra, state, ruralMode) {
  const APPALACHIAN  = new Set(['KY', 'WV', 'TN', 'VA']);
  const GREAT_PLAINS = new Set(['KS', 'NE', 'OK']);
  const WESTERN      = new Set(['MT', 'CO', 'WY', 'ID', 'NM', 'UT', 'AZ', 'NV']);

  if (ruralMode === 'rural' || ruralMode === 'remote') {
    if (APPALACHIAN.has(state)) {
      return 'Hillside construction in this region makes basements common regardless of build year — verify with the seller. Appalachian homes often have full walk-out basements that double as effective storm shelters.';
    }
    if (GREAT_PLAINS.has(state)) {
      return 'Storm shelter culture in this region means most rural homes have a basement or dedicated underground shelter regardless of build year — verify with the seller.';
    }
    if (WESTERN.has(state)) {
      return 'Foundation types in rural western properties vary significantly with lot topography and local practice — verify foundation type and any shelter options directly with the seller.';
    }
    return 'Rural homes in this region often have full basements regardless of era — more common than suburban construction of the same period. Verify with seller.';
  }

  if (!constructionEra) return null;
  const year = parseInt(constructionEra, 10);
  if (isNaN(year)) return null;

  if (WESTERN.has(state)) {
    return 'Basement prevalence in this region varies by lot topography and builder practice — verify directly with the seller.';
  }
  if (year < 1980 && ['KY', 'IN', 'OH', 'TN'].includes(state)) {
    return 'Homes of this era in this region frequently have full basements — verify with the seller before assuming storm shelter availability.';
  }
  if (year >= 1980 && year < 2000 && ['KY', 'IN'].includes(state)) {
    return 'Homes of this era vary significantly — some have basements, many are slab. Confirm with seller before your inspection.';
  }
  if (year >= 2000 && ['KY', 'IN'].includes(state)) {
    return 'Most homes built after 2000 in central Kentucky and southern Indiana are slab construction without basements. If confirmed, identify your interior storm shelter plan before move-in.';
  }
  return null;
}

// CONSTRAINT-014: Road priority classification — belongs here so all chapters use the same logic.
// addressComponents: Google geocoding address_components array
// Returns: 'primary' | 'secondary' | 'residential' | null
function getRoadPriority(addressComponents) {
  if (!addressComponents || !addressComponents.length) return null;
  const routes = addressComponents.filter((c) => c.types.includes('route'));
  if (!routes.length) return null;
  const name = routes[0].short_name || '';
  if (/^(US|I|SR|SH|KY|MT|IN|OH|TN|CA|TX|FL|NY|PA|AL|AK|AZ|AR|CO|CT|DE|GA|HI|ID|IL|IA|KS|LA|ME|MD|MA|MI|MN|MS|MO|NE|NV|NH|NJ|NM|NC|ND|OK|OR|RI|SC|SD|UT|VT|VA|WA|WB|WI|WY)-?\d+/i.test(name)) return 'primary';
  if (/^(CR|CO\s*RD|COUNTY\s*RD?)-?\s*\d+/i.test(name)) return 'secondary';
  return 'residential';
}

module.exports = { detectRuralMode, checkCrossState, checkDriveTimeCoherence, getBasementContext, getRoadPriority };
