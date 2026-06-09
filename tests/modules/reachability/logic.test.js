'use strict';
const { computeDrivingProfile, clampNum } = require('../../../src/modules/reachability/logic');

describe('clampNum', () => {
  test('passes through in-range floats', () => { expect(clampNum(3.5, 0, 7)).toBe(3.5); });
  test('clamps below low and above high', () => {
    expect(clampNum(-2, 0, 7)).toBe(0);
    expect(clampNum(99, 0, 7)).toBe(7);
  });
  test('non-numeric returns the low bound', () => {
    expect(clampNum('x', 0, 7)).toBe(0);
    expect(clampNum(undefined, 2, 7)).toBe(2);
    expect(clampNum(NaN, 1, 7)).toBe(1);
  });
});

const RATES = {
  marginalCostPerMile: 0.20,
  irsRatePerMile:      0.67,
  evKwhPerMile:        0.30,
  electricRatePerKwh:  0.16,
  tripDistances: { groceryRoundTripMiles: 12, cityRoundTripMiles: 60, schoolRoundTripMiles: 8, schoolDaysPerWeek: 5 },
};

describe('computeDrivingProfile', () => {
  test('computes weekly miles by type, annual miles, and three costs', () => {
    const r = computeDrivingProfile(
      { commuteDaysPerWeek: 5, commuteOneWayMiles: 10, groceryTripsPerWeek: 2, cityTripsPerMonth: 0, hasKidsInSchool: false },
      RATES,
    );
    expect(r.weeklyMilesByType.commute).toBe(100);
    expect(r.weeklyMilesByType.grocery).toBe(24);
    expect(r.weeklyMilesByType.city).toBe(0);
    expect(r.weeklyMilesByType.school).toBe(0);
    expect(r.weeklyMilesTotal).toBe(124);
    expect(r.annualMiles).toBe(6448);
    expect(r.costMarginal).toBe(1290);
    expect(r.costIrs).toBe(4320);
    expect(r.costEv).toBe(310);
  });

  test('school adds 5 round-trips/week when kids in school', () => {
    const r = computeDrivingProfile(
      { commuteDaysPerWeek: 0, commuteOneWayMiles: 0, groceryTripsPerWeek: 0, cityTripsPerMonth: 0, hasKidsInSchool: true },
      RATES,
    );
    expect(r.weeklyMilesByType.school).toBe(40);
  });

  test('city trips convert monthly->weekly via /4.33', () => {
    const r = computeDrivingProfile(
      { commuteDaysPerWeek: 0, commuteOneWayMiles: 0, groceryTripsPerWeek: 0, cityTripsPerMonth: 4, hasKidsInSchool: false },
      RATES,
    );
    expect(r.weeklyMilesByType.city).toBeCloseTo((4 * 60) / 4.33, 5);
  });

  test('clamps out-of-range and non-numeric inputs to bounds', () => {
    const r = computeDrivingProfile(
      { commuteDaysPerWeek: 99, commuteOneWayMiles: -5, groceryTripsPerWeek: 'x', cityTripsPerMonth: 999, hasKidsInSchool: 1 },
      RATES,
    );
    expect(r.weeklyMilesByType.commute).toBe(0);
    expect(r.weeklyMilesByType.grocery).toBe(0);
    expect(r.weeklyMilesByType.school).toBe(40);
    expect(r.weeklyMilesByType.city).toBeCloseTo((8 * 60) / 4.33, 5);
  });

  test('no scoring/grade fields in output', () => {
    const r = computeDrivingProfile({ commuteDaysPerWeek: 3, commuteOneWayMiles: 15, groceryTripsPerWeek: 1, cityTripsPerMonth: 1, hasKidsInSchool: false }, RATES);
    expect(Object.keys(r)).toEqual(['weeklyMilesByType', 'weeklyMilesTotal', 'annualMiles', 'costMarginal', 'costIrs', 'costEv']);
  });
});
