'use strict';

// FR-066 — shared Overpass client (extracted from sensory). Multi-endpoint
// failover: individual Overpass mirrors are flaky (429/HTML/unreachable), the
// pool succeeds. Proven necessary in FR-066 discovery probing.

const { fetchOverpass } = require('../../src/shared/overpass');

describe('fetchOverpass', () => {
  afterEach(() => jest.restoreAllMocks());

  test('returns the first endpoint response when it is ok', async () => {
    const resp = { ok: true, status: 200 };
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue(resp);
    const out = await fetchOverpass('[out:json];', 1000);
    expect(out).toBe(resp);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('falls over to the next endpoint when the first is rate-limited (429)', async () => {
    const good = { ok: true, status: 200 };
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce(good);
    const out = await fetchOverpass('[out:json];', 1000);
    expect(out).toBe(good);
  });

  test('falls over when an endpoint throws (unreachable)', async () => {
    const good = { ok: true, status: 200 };
    jest.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(good);
    const out = await fetchOverpass('[out:json];', 1000);
    expect(out).toBe(good);
  });

  test('returns null when every endpoint fails', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 504 });
    const out = await fetchOverpass('[out:json];', 1000);
    expect(out).toBeNull();
  });

  test('sends a descriptive User-Agent (Overpass blocks the default fetch UA → 406)', async () => {
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200 });
    await fetchOverpass('[out:json];', 1000);
    const opts = spy.mock.calls[0][1] || {};
    expect(opts.headers && opts.headers['User-Agent']).toMatch(/Livably/);
  });
});
