'use strict';
const { haversineDistance, computeBearing, bearingToCompass } = require('../../src/utils/geo');

describe('haversineDistance', () => {
  test('same point returns 0', () => {
    expect(haversineDistance(38.2109, -84.5592, 38.2109, -84.5592)).toBeCloseTo(0, 5);
  });

  test('known distance: Georgetown KY to Louisville KY ≈ 55 mi', () => {
    const d = haversineDistance(38.2109, -84.5592, 38.2527, -85.7585);
    expect(d).toBeGreaterThan(50);
    expect(d).toBeLessThan(70);
  });
});

describe('computeBearing', () => {
  test('due north returns ~0', () => {
    expect(computeBearing(0, 0, 1, 0)).toBeCloseTo(0, 0);
  });

  test('due east returns ~90', () => {
    expect(computeBearing(0, 0, 0, 1)).toBeCloseTo(90, 0);
  });

  test('due south returns ~180', () => {
    expect(computeBearing(1, 0, 0, 0)).toBeCloseTo(180, 0);
  });

  test('due west returns ~270', () => {
    expect(computeBearing(0, 1, 0, 0)).toBeCloseTo(270, 0);
  });

  test('northeast quadrant: result between 0 and 90', () => {
    const b = computeBearing(38, -84, 39, -83);
    expect(b).toBeGreaterThan(0);
    expect(b).toBeLessThan(90);
  });

  test('southwest quadrant: result between 180 and 270', () => {
    const b = computeBearing(39, -83, 38, -84);
    expect(b).toBeGreaterThan(180);
    expect(b).toBeLessThan(270);
  });

  test('always returns value in 0–360 range', () => {
    const pairs = [[0,0,1,1],[1,1,0,0],[0,1,1,0],[1,0,0,1],[-10,-10,10,10]];
    for (const [la, lo, la2, lo2] of pairs) {
      const b = computeBearing(la, lo, la2, lo2);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(360);
    }
  });

  test('Georgetown KY → CVG airport is roughly north', () => {
    // Georgetown KY ≈ 38.21, -84.56; CVG ≈ 39.05, -84.67
    const b = computeBearing(38.21, -84.56, 39.05, -84.67);
    expect(b).toBeGreaterThan(340);  // nearly due north with slight west lean
  });
});

describe('bearingToCompass', () => {
  const cases = [
    [0,   'N'],
    [22,  'N'],
    [23,  'NE'],
    [45,  'NE'],
    [67,  'NE'],
    [68,  'E'],
    [90,  'E'],
    [112, 'E'],
    [113, 'SE'],
    [135, 'SE'],
    [157, 'SE'],
    [158, 'S'],
    [180, 'S'],
    [202, 'S'],
    [203, 'SW'],
    [225, 'SW'],
    [247, 'SW'],
    [248, 'W'],
    [270, 'W'],
    [292, 'W'],
    [293, 'NW'],
    [315, 'NW'],
    [337, 'NW'],
    [338, 'N'],
    [359, 'N'],
  ];

  test.each(cases)('%i° → %s', (deg, expected) => {
    expect(bearingToCompass(deg)).toBe(expected);
  });

  test('handles 360 same as 0', () => {
    expect(bearingToCompass(360)).toBe('N');
  });
});
