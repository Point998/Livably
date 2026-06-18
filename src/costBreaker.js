'use strict';

const { GOOGLE_SKU_BUDGETS, COST_BREAKER } = require('./utils/constants');

const DAY_MS = 24 * 60 * 60 * 1000;

const ENDPOINT_TO_BUCKET = {
  geocode: 'geocoding',
  reverseGeocode: 'geocoding',
  distancematrix: 'distancematrix',
  placesNearby: 'places_nearby',
  textSearch: 'places_text',
};

class BudgetExceededError extends Error {
  constructor(bucket) {
    super(`Daily API budget reached for ${bucket}.`);
    this.name = 'BudgetExceededError';
    this.retryable = false;
    this.bucket = bucket;
  }
}

let clock = () => Date.now();
let enabled = true;
let forced = false;
let caps = defaultCaps();
const windows = new Map();        // bucketKey -> number[] (timestamps, ascending)
const warned = new Set();         // buckets currently in the >=80% warned state
const unknownLogged = new Set();

function defaultCaps() {
  const out = {};
  for (const [k, v] of Object.entries(GOOGLE_SKU_BUDGETS)) out[k] = v.dailyCap;
  return out;
}

function skuFor(endpoint) {
  const key = ENDPOINT_TO_BUCKET[endpoint];
  if (key) return key;
  if (!unknownLogged.has(endpoint)) {
    console.warn(`[costBreaker] unmapped endpoint "${endpoint}" -> bucket "other"`);
    unknownLogged.add(endpoint);
  }
  return 'other';
}

function capFor(bucket) {
  return bucket in caps ? caps[bucket] : (caps.other != null ? caps.other : GOOGLE_SKU_BUDGETS.other.dailyCap);
}

function countFor(bucket) {
  const arr = windows.get(bucket);
  if (!arr) return 0;
  const cutoff = clock() - DAY_MS;
  while (arr.length && arr[0] < cutoff) arr.shift();
  return arr.length;
}

function check(endpoint) {
  if (!enabled) return;
  if (forced) throw new BudgetExceededError('all (force-trip)');
  const bucket = skuFor(endpoint);
  if (countFor(bucket) >= capFor(bucket)) throw new BudgetExceededError(bucket);
}

function record(endpoint) {
  const bucket = skuFor(endpoint);
  if (!windows.has(bucket)) windows.set(bucket, []);
  windows.get(bucket).push(clock());
  const count = countFor(bucket);
  const cap = capFor(bucket);
  if (cap > 0 && count >= cap * COST_BREAKER.warnThreshold) {
    if (!warned.has(bucket)) {
      warned.add(bucket);
      console.warn(`[costBreaker] ${bucket} at ${count}/${cap} (>=${COST_BREAKER.warnThreshold * 100}% of daily budget)`);
    }
  } else {
    warned.delete(bucket);
  }
}

function forceTrip() { forced = true; }
function reset() { forced = false; }

function configure(opts = {}) {
  if (typeof opts.enabled === 'boolean') enabled = opts.enabled;
  if (opts.caps) caps = { ...defaultCaps(), ...opts.caps };
}

function estCostFor(bucket, count) {
  const meta = GOOGLE_SKU_BUDGETS[bucket];
  if (!meta) return 0;
  const elements = bucket === 'distancematrix' ? COST_BREAKER.avgElementsPerCall : 1;
  return count * meta.pricePerCall * elements;
}

function status() {
  const buckets = Object.keys(GOOGLE_SKU_BUDGETS).map((key) => {
    const used = countFor(key);
    const cap = capFor(key);
    return {
      key,
      used,
      cap,
      pct: cap > 0 ? used / cap : 1,
      tripped: forced || used >= cap,
      estCostUsd: estCostFor(key, used),
    };
  });
  const totalEstCostUsd = buckets.reduce((s, b) => s + b.estCostUsd, 0);
  return { forced, buckets, totalEstCostUsd };
}

// Test-only hooks.
function _setClock(fn) { clock = fn; }
function _clearAll() {
  windows.clear();
  warned.clear();
  unknownLogged.clear();
  forced = false;
  enabled = true;
  caps = defaultCaps();
}

module.exports = {
  check, record, forceTrip, reset, configure, status, skuFor,
  BudgetExceededError, _setClock, _clearAll,
};
