'use strict';
const { meteredSkip } = require('../../src/middleware/rateLimiters');

function req({ fetch, ip }) {
  return { query: fetch ? { fetch } : {}, ip, socket: {} };
}

describe('meteredSkip', () => {
  test('counts a billed build (fetch=1, public IP) → not skipped', () => {
    expect(meteredSkip(req({ fetch: '1', ip: '203.0.113.5' }))).toBe(false);
  });
  test('skips the loading-page render (no fetch param)', () => {
    expect(meteredSkip(req({ ip: '203.0.113.5' }))).toBe(true);
  });
  test('skips loopback traffic (e.g. PDF route fetching /report internally)', () => {
    expect(meteredSkip(req({ fetch: '1', ip: '127.0.0.1' }))).toBe(true);
  });
});
