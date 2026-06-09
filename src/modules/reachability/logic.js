'use strict';
const { GROCERY_EXCLUDED_TYPES } = require('../../utils/constants');

function isExcludedGroceryType(place) {
  const types = place.types || [];
  return GROCERY_EXCLUDED_TYPES.some((t) => types.includes(t));
}

function clampNum(v, lo, hi) {
  v = Number(v);
  if (isNaN(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

// Pure driving-cost engine. CONSTRAINT-001: figures only, never a score/grade.
// `rates` carries the cost rates + tripDistances (assembled by getDrivingRates).
function computeDrivingProfile(inputs, rates) {
  const i = inputs || {};
  const commuteDays  = clampNum(i.commuteDaysPerWeek, 0, 7);
  const commuteMiles = clampNum(i.commuteOneWayMiles, 0, 200);
  const groceryTrips = clampNum(i.groceryTripsPerWeek, 0, 7);
  const cityTrips    = clampNum(i.cityTripsPerMonth, 0, 8);
  const kids         = !!i.hasKidsInSchool;
  const d = rates.tripDistances;

  const weeklyMilesByType = {
    commute: commuteDays * commuteMiles * 2,
    grocery: groceryTrips * d.groceryRoundTripMiles,
    city:    (cityTrips * d.cityRoundTripMiles) / 4.33,
    school:  kids ? d.schoolDaysPerWeek * d.schoolRoundTripMiles : 0,
  };
  const weeklyMilesTotal = weeklyMilesByType.commute + weeklyMilesByType.grocery + weeklyMilesByType.city + weeklyMilesByType.school;
  const annualMiles = Math.round(weeklyMilesTotal * 52);

  return {
    weeklyMilesByType,
    weeklyMilesTotal,
    annualMiles,
    costMarginal: Math.round(annualMiles * rates.marginalCostPerMile),
    costIrs:      Math.round(annualMiles * rates.irsRatePerMile),
    costEv:       Math.round(annualMiles * rates.evKwhPerMile * rates.electricRatePerKwh),
  };
}

module.exports = { isExcludedGroceryType, computeDrivingProfile, clampNum };
