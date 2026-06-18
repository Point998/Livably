'use strict';
const cb = require('../src/costBreaker');
const { GOOGLE_SKU_BUDGETS, COST_BREAKER } = require('../src/utils/constants');

describe('costBreaker', () => {
  let now;
  beforeEach(() => {
    cb._clearAll();
    now = 1_000_000_000_000;
    cb._setClock(() => now);
  });

  test('skuFor maps endpoints to buckets; unknown -> other', () => {
    expect(cb.skuFor('geocode')).toBe('geocoding');
    expect(cb.skuFor('reverseGeocode')).toBe('geocoding');
    expect(cb.skuFor('distancematrix')).toBe('distancematrix');
    expect(cb.skuFor('placesNearby')).toBe('places_nearby');
    expect(cb.skuFor('textSearch')).toBe('places_text');
    expect(cb.skuFor('somethingNew')).toBe('other');
  });

  test('under cap allows; record increments usage', () => {
    cb.configure({ caps: { places_nearby: 3 } });
    expect(() => cb.check('placesNearby')).not.toThrow();
    cb.record('placesNearby');
    cb.record('placesNearby');
    const b = cb.status().buckets.find((x) => x.key === 'places_nearby');
    expect(b.used).toBe(2);
    expect(() => cb.check('placesNearby')).not.toThrow();
  });

  test('at cap, check throws BudgetExceededError', () => {
    cb.configure({ caps: { places_nearby: 2 } });
    cb.record('placesNearby');
    cb.record('placesNearby');
    expect(() => cb.check('placesNearby')).toThrow(cb.BudgetExceededError);
    try { cb.check('placesNearby'); } catch (e) { expect(e.bucket).toBe('places_nearby'); }
  });

  test('rolling expiry frees budget after 24h', () => {
    cb.configure({ caps: { places_nearby: 1 } });
    cb.record('placesNearby');
    expect(() => cb.check('placesNearby')).toThrow();
    now += 24 * 60 * 60 * 1000 + 1;
    expect(() => cb.check('placesNearby')).not.toThrow();
    expect(cb.status().buckets.find((x) => x.key === 'places_nearby').used).toBe(0);
  });

  test('per-SKU isolation: one bucket tripping does not block another', () => {
    cb.configure({ caps: { places_nearby: 1, geocoding: 5 } });
    cb.record('placesNearby');
    expect(() => cb.check('placesNearby')).toThrow();
    expect(() => cb.check('geocode')).not.toThrow();
  });

  test('geocode and reverseGeocode share the geocoding budget', () => {
    cb.configure({ caps: { geocoding: 2 } });
    cb.record('geocode');
    cb.record('reverseGeocode');
    expect(() => cb.check('geocode')).toThrow();
  });

  test('forceTrip blocks all buckets; reset restores per-bucket behavior', () => {
    cb.configure({ caps: { geocoding: 100 } });
    cb.forceTrip();
    expect(() => cb.check('geocode')).toThrow(cb.BudgetExceededError);
    expect(() => cb.check('placesNearby')).toThrow();
    cb.reset();
    expect(() => cb.check('geocode')).not.toThrow();
  });

  test('reset does not zero rolling windows', () => {
    cb.configure({ caps: { geocoding: 100 } });
    cb.record('geocode');
    cb.forceTrip();
    cb.reset();
    expect(cb.status().buckets.find((x) => x.key === 'geocoding').used).toBe(1);
  });

  test('cap override of 0 blocks the first call', () => {
    cb.configure({ caps: { places_text: 0 } });
    expect(() => cb.check('textSearch')).toThrow(cb.BudgetExceededError);
  });

  test('enabled:false makes check a no-op even over cap', () => {
    cb.configure({ enabled: false, caps: { places_nearby: 1 } });
    cb.record('placesNearby');
    cb.record('placesNearby');
    expect(() => cb.check('placesNearby')).not.toThrow();
  });

  test('estimated cost: distancematrix multiplies by avgElementsPerCall', () => {
    cb.record('distancematrix');
    cb.record('distancematrix');
    const b = cb.status().buckets.find((x) => x.key === 'distancematrix');
    const expected = 2 * GOOGLE_SKU_BUDGETS.distancematrix.pricePerCall * COST_BREAKER.avgElementsPerCall;
    expect(b.estCostUsd).toBeCloseTo(expected, 6);
  });

  test('status shape: pct and tripped flags', () => {
    cb.configure({ caps: { geocoding: 2 } });
    cb.record('geocode');
    const s = cb.status();
    expect(s).toHaveProperty('forced', false);
    expect(s).toHaveProperty('totalEstCostUsd');
    const b = s.buckets.find((x) => x.key === 'geocoding');
    expect(b.pct).toBeCloseTo(0.5, 6);
    expect(b.tripped).toBe(false);
  });

  test('default caps satisfy cap*30 <= freeMonthly (AC7)', () => {
    for (const [key, v] of Object.entries(GOOGLE_SKU_BUDGETS)) {
      if (key === 'other') continue; // no real monthly free allotment
      expect(v.dailyCap * 30).toBeLessThanOrEqual(v.freeMonthly);
    }
  });
});
