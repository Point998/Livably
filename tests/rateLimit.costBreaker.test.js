'use strict';
const cb = require('../src/costBreaker');
const { makeGoogleMapsRequest, BudgetExceededError } = require('../src/rateLimit');

describe('makeGoogleMapsRequest budget gating', () => {
  beforeEach(() => { cb._clearAll(); cb.configure({ caps: { places_nearby: 1 } }); });

  test('re-exports BudgetExceededError', () => {
    expect(BudgetExceededError).toBe(cb.BudgetExceededError);
  });

  test('allows under cap, records on success, blocks over cap without calling fn', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(makeGoogleMapsRequest(fn, 'placesNearby')).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);

    const fn2 = jest.fn().mockResolvedValue('ok');
    await expect(makeGoogleMapsRequest(fn2, 'placesNearby')).rejects.toThrow(BudgetExceededError);
    expect(fn2).not.toHaveBeenCalled();
  });

  test('a failed call does not consume budget', async () => {
    cb.configure({ caps: { geocoding: 2 } });
    const boom = jest.fn().mockRejectedValue(new Error('network'));
    await expect(makeGoogleMapsRequest(boom, 'geocode', 1)).rejects.toThrow('network');
    expect(cb.status().buckets.find((b) => b.key === 'geocoding').used).toBe(0);
  });
});
