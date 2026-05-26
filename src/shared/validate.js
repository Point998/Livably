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

module.exports = { detectRuralMode, checkCrossState, checkDriveTimeCoherence };
