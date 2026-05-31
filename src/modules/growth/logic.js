'use strict';

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

module.exports = { calcPermitPercentChange, classifyPermitTrend };
