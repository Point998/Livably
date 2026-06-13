'use strict';
const { makeRequireAdmin, isLoopback, tokenMatches } = require('../../src/middleware/adminAuth');

function mockReq({ ip, headers = {} } = {}) {
  return { ip, socket: {}, get: (h) => headers[h.toLowerCase()] };
}
function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.status = (c) => { res.statusCode = c; return res; };
  res.send = (b) => { res.body = b; return res; };
  return res;
}

describe('tokenMatches', () => {
  test('false when expected token unset', () => expect(tokenMatches('x', null)).toBe(false));
  test('false when provided token absent', () => expect(tokenMatches(undefined, 'x')).toBe(false));
  test('false on length mismatch (no throw)', () => expect(tokenMatches('short', 'longer-token')).toBe(false));
  test('true on exact match', () => expect(tokenMatches('secret', 'secret')).toBe(true));
});

describe('isLoopback', () => {
  test('true for IPv4 loopback', () => expect(isLoopback(mockReq({ ip: '127.0.0.1' }))).toBe(true));
  test('true for IPv6 loopback', () => expect(isLoopback(mockReq({ ip: '::1' }))).toBe(true));
  test('false for public IP', () => expect(isLoopback(mockReq({ ip: '203.0.113.5' }))).toBe(false));
  test('true via socket.remoteAddress fallback when req.ip is absent', () =>
    expect(isLoopback({ socket: { remoteAddress: '127.0.0.1' } })).toBe(true));
});

describe('requireAdmin', () => {
  test('loopback is allowed without a token', () => {
    const next = jest.fn();
    makeRequireAdmin(() => null)(mockReq({ ip: '127.0.0.1' }), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
  test('non-loopback with matching token is allowed', () => {
    const next = jest.fn();
    makeRequireAdmin(() => 'tok')(mockReq({ ip: '203.0.113.5', headers: { 'x-admin-token': 'tok' } }), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
  test('non-loopback with wrong token is forbidden', () => {
    const next = jest.fn();
    const res = mockRes();
    makeRequireAdmin(() => 'tok')(mockReq({ ip: '203.0.113.5', headers: { 'x-admin-token': 'nope' } }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
  test('non-loopback with no token configured is forbidden', () => {
    const next = jest.fn();
    const res = mockRes();
    makeRequireAdmin(() => null)(mockReq({ ip: '203.0.113.5' }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
