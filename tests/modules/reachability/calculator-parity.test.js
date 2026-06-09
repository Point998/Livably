'use strict';
const { computeDrivingProfile } = require('../../../src/modules/reachability/logic');
const { computeProfileClient } = require('../../../public/calculator');

const RATES = {
  marginalCostPerMile: 0.2364, irsRatePerMile: 0.67, evKwhPerMile: 0.30, electricRatePerKwh: 0.16,
  tripDistances: { groceryRoundTripMiles: 12, cityRoundTripMiles: 60, schoolRoundTripMiles: 8, schoolDaysPerWeek: 5 },
};

describe('client mirror parity with server engine', () => {
  const matrix = [
    { commuteDaysPerWeek: 0, commuteOneWayMiles: 0, groceryTripsPerWeek: 0, cityTripsPerMonth: 0, hasKidsInSchool: false },
    { commuteDaysPerWeek: 5, commuteOneWayMiles: 24, groceryTripsPerWeek: 2, cityTripsPerMonth: 3, hasKidsInSchool: true },
    { commuteDaysPerWeek: 3, commuteOneWayMiles: 15, groceryTripsPerWeek: 1, cityTripsPerMonth: 1, hasKidsInSchool: false },
    { commuteDaysPerWeek: 99, commuteOneWayMiles: -5, groceryTripsPerWeek: 'x', cityTripsPerMonth: 999, hasKidsInSchool: 1 },
  ];
  matrix.forEach((inp, idx) => {
    test(`identical output for input #${idx}`, () => {
      expect(computeProfileClient(inp, RATES)).toEqual(computeDrivingProfile(inp, RATES));
    });
  });

  test('exports computeProfileClient and does not throw on require (no DOM)', () => {
    expect(typeof computeProfileClient).toBe('function');
  });
});
