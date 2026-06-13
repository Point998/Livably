'use strict';
const crypto = require('crypto');

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function isLoopback(req) {
  const ip = req.ip || req.socket?.remoteAddress || '';
  return LOOPBACK.has(ip);
}

function tokenMatches(provided, expected) {
  if (!expected || !provided) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  // timingSafeEqual requires equal-length buffers (it throws otherwise); token length
  // is not a useful secret for an admin token, so the early length guard is acceptable.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// getToken is injected so the boot-resolved ADMIN_TOKEN can be passed in (and mocked in tests).
function makeRequireAdmin(getToken = () => process.env.ADMIN_TOKEN) {
  return function requireAdmin(req, res, next) {
    if (isLoopback(req)) return next();
    const token = getToken();
    // No token configured → loopback-only access (non-loopback always rejected).
    if (token && tokenMatches(req.get('x-admin-token'), token)) return next();
    return res.status(403).send('Forbidden');
  };
}

module.exports = { makeRequireAdmin, isLoopback, tokenMatches, LOOPBACK };
