'use strict';
const rateLimit = require('express-rate-limit');
const { isLoopback } = require('./adminAuth');
const { toTitleCase } = require('../utils/text');
const { buildErrorHTML } = require('../templates/pages/errorPage');

// Only the billed build path (fetch=1) counts; loopback (PDF route, local dev) is exempt.
function meteredSkip(req) {
  return req.query.fetch !== '1' || isLoopback(req);
}

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const meteredLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: meteredSkip,
  handler: (req, res) => {
    const address = req.query.address ? toTitleCase(String(req.query.address).trim()) : null;
    // type 'RATE_LIMIT' sets <meta name="livably-error" content="RATE_LIMIT">, which the
    // loading page detects and turns into a 30s countdown-retry (errorPage.js).
    res.status(429).send(buildErrorHTML(
      'RATE_LIMIT',
      'Too many requests',
      "You've made a lot of requests in a short time. Please wait a moment and try again.",
      address,
      30,
    ));
  },
});

module.exports = { globalLimiter, meteredLimiter, meteredSkip };
