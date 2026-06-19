# FR-075 — Cost Circuit-Breaker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap estimated Google Maps spend with a tight per-SKU rolling-24h call budget enforced at the single billed chokepoint, plus a manual kill-switch.

**Architecture:** A new self-contained `src/costBreaker.js` holds all budget state (per-SKU rolling-24h windows, force-trip flag) with an injectable clock for tests. It is wired into `makeGoogleMapsRequest` in `src/rateLimit.js` — `check()` before a call (throws `BudgetExceededError`, pre-billing), `record()` after a successful one. Config is validated at boot in `src/config.js`; the breaker is surfaced and controlled via existing `/admin/*` routes behind the FR-064 guard.

**Tech Stack:** Node.js, Express, Jest. No new npm packages.

## Global Constraints

- No new npm packages (Do Not list, CLAUDE.md).
- Record on **success only** — a thrown/429/quota call is not billed and must not consume budget (spec §5/E7).
- Budget counts **calls**; Distance Matrix bills per **element** — estimated-$ multiplies `distancematrix` by `avgElementsPerCall` (default 5); documented approximation (spec §6).
- All state **in-memory** (Stage-1-aligned); resets on restart — known single-instance caveat (spec §4/E12).
- Default caps satisfy `dailyCap × 30 ≤ freeMonthly` for every bucket (spec AC7).
- `BudgetExceededError.retryable = false`; renders through the **existing** `QUOTA_EXCEEDED` capacity page — no new error template (spec §9).
- Admin mutation routes mount under the existing `app.use('/admin', makeRequireAdmin(...))` guard — no new auth (spec §8).
- The breaker must **never crash boot or a request** — config parsing warns and falls back to defaults; `check`/`record` are guard-only (spec §7).
- Test addresses for the smoke check: Georgetown KY, Harlan KY, Louisville KY, Bozeman MT, Jeffersonville IN (CONSTRAINT-011).
- `distancematrix` tier is treated as Essentials/10k-free → cap 200, **pending confirmation** (spec §3). If confirmed Pro (5k), set `freeMonthly: 5000, dailyCap: 100` in Task 1's table; the AC7 test (Task 1, Step 1, `test_default_caps_under_monthly_free`) keeps the relationship correct regardless.

---

### Task 1: Cost-breaker engine + SKU budget table

**Files:**
- Modify: `src/utils/constants.js` (add `GOOGLE_SKU_BUDGETS` + `COST_BREAKER`, export both)
- Create: `src/costBreaker.js`
- Test: `tests/costBreaker.test.js`

**Interfaces:**
- Consumes: `GOOGLE_SKU_BUDGETS`, `COST_BREAKER` from `src/utils/constants.js`.
- Produces:
  - `check(endpoint: string): void` — throws `BudgetExceededError` if `forced`, or bucket count `>= cap`.
  - `record(endpoint: string): void` — appends `clock()` to the bucket window.
  - `forceTrip(): void` / `reset(): void` — kill-switch + clear.
  - `configure({ enabled?: boolean, caps?: Record<bucket, number> }): void`.
  - `status(): { forced: boolean, buckets: Array<{ key, used, cap, pct, tripped, estCostUsd }>, totalEstCostUsd: number }`.
  - `skuFor(endpoint: string): string` — bucket key; unknown → `'other'`.
  - `class BudgetExceededError extends Error` — `{ name, retryable:false, bucket }`.
  - Test hooks: `_setClock(fn)`, `_clearAll()`.

- [ ] **Step 1: Write the failing test**

Create `tests/costBreaker.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/costBreaker.test.js`
Expected: FAIL — `Cannot find module '../src/costBreaker'` (and/or `GOOGLE_SKU_BUDGETS` undefined).

- [ ] **Step 3: Add the budget table to `src/utils/constants.js`**

Add near the other constant groups, and include both names in `module.exports`:

```js
// FR-075 — Cost circuit-breaker per-SKU budgets.
// dailyCap = round(freeMonthly / 30 * safetyMargin); 30 days at cap stays under monthly free.
// Pricing/tier are ESTIMATES (Google Maps Platform, confirmed 2026-06-18); env-overridable.
const COST_BREAKER = { safetyMargin: 0.6, warnThreshold: 0.8, avgElementsPerCall: 5 };

const GOOGLE_SKU_BUDGETS = {
  geocoding:      { tier: 'Essentials', freeMonthly: 10000, pricePerCall: 0.005, dailyCap: 200 },
  distancematrix: { tier: 'Essentials', freeMonthly: 10000, pricePerCall: 0.005, dailyCap: 200 },
  places_nearby:  { tier: 'Pro',        freeMonthly: 5000,  pricePerCall: 0.032, dailyCap: 100 },
  places_text:    { tier: 'Pro',        freeMonthly: 5000,  pricePerCall: 0.032, dailyCap: 100 },
  other:          { tier: 'Unknown',    freeMonthly: 1500,  pricePerCall: 0.010, dailyCap: 50  },
};
```

In the existing `module.exports = { ... }`, add `GOOGLE_SKU_BUDGETS,` and `COST_BREAKER,`.

- [ ] **Step 4: Create `src/costBreaker.js`**

```js
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest tests/costBreaker.test.js`
Expected: PASS (14 tests).

- [ ] **Step 6: Commit**

```bash
git add src/utils/constants.js src/costBreaker.js tests/costBreaker.test.js
git commit -m "FR-075: cost-breaker engine + per-SKU budget table (Task 1)"
```

---

### Task 2: Wire the breaker into the billed chokepoint

**Files:**
- Modify: `src/rateLimit.js` (require costBreaker; `check` before the call, `record` after success; re-export `BudgetExceededError`)
- Test: `tests/rateLimit.costBreaker.test.js`

**Interfaces:**
- Consumes: `costBreaker.check`, `costBreaker.record`, `costBreaker.BudgetExceededError`, `costBreaker.configure`, `costBreaker._clearAll` (Task 1).
- Produces: `makeGoogleMapsRequest` now budget-gated; `BudgetExceededError` re-exported from `src/rateLimit.js`.

- [ ] **Step 1: Write the failing test**

Create `tests/rateLimit.costBreaker.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/rateLimit.costBreaker.test.js`
Expected: FAIL — `BudgetExceededError` is `undefined` (not yet re-exported); gating absent.

- [ ] **Step 3: Wire `src/rateLimit.js`**

At the top, after the class definitions / `usageLog` setup, add the require (place it after the `RateLimitError` class so the file's own classes are defined first):

```js
const costBreaker = require('./costBreaker');
```

In `makeGoogleMapsRequest`, add the budget check as the **first** line of the function body (before the `for` loop):

```js
async function makeGoogleMapsRequest(fn, endpoint = 'unknown', maxRetries = 3) {
  costBreaker.check(endpoint); // FR-075 — throws BudgetExceededError before billing; not retried
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await rateLimiter.execute(fn);
      logApiCall(endpoint, true);
      costBreaker.record(endpoint); // FR-075 — count billed successes only
      return result;
    } catch (error) {
      // ... unchanged ...
```

Update the exports line:

```js
module.exports = { makeGoogleMapsRequest, QuotaExceededError, RateLimitError, BudgetExceededError: costBreaker.BudgetExceededError, getUsageStats };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/rateLimit.costBreaker.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/rateLimit.js tests/rateLimit.costBreaker.test.js
git commit -m "FR-075: gate makeGoogleMapsRequest on the cost-breaker (Task 2)"
```

---

### Task 3: Validate breaker config at boot

**Files:**
- Modify: `src/config.js` (parse + validate `COST_BREAKER_ENABLED` and `COST_BREAKER_CAP_<BUCKET>`; add to return)
- Test: `tests/config.test.js` (add cases to the existing suite)

**Interfaces:**
- Consumes: nothing new.
- Produces: `validateConfig(env, logger)` return gains `costBreaker: { enabled: boolean, caps: Record<bucket, number> }`. Never throws for breaker config (warns + defaults).

- [ ] **Step 1: Write the failing test**

Add to `tests/config.test.js` (create the file if it does not exist, requiring `validateConfig` from `../src/config` and always passing a valid `GOOGLE_MAPS_API_KEY`):

```js
const { validateConfig } = require('../src/config');

const base = { GOOGLE_MAPS_API_KEY: 'k' };
const silent = { warn: () => {} };

describe('validateConfig costBreaker block', () => {
  test('defaults: enabled true, empty cap overrides', () => {
    const c = validateConfig({ ...base }, silent);
    expect(c.costBreaker.enabled).toBe(true);
    expect(c.costBreaker.caps).toEqual({});
  });

  test('COST_BREAKER_ENABLED=false disables', () => {
    const c = validateConfig({ ...base, COST_BREAKER_ENABLED: 'false' }, silent);
    expect(c.costBreaker.enabled).toBe(false);
  });

  test('valid per-bucket override is parsed as integer', () => {
    const c = validateConfig({ ...base, COST_BREAKER_CAP_PLACES_NEARBY: '40' }, silent);
    expect(c.costBreaker.caps.places_nearby).toBe(40);
  });

  test('malformed override warns and is ignored (no throw)', () => {
    const warn = jest.fn();
    const c = validateConfig({ ...base, COST_BREAKER_CAP_GEOCODING: 'abc' }, { warn });
    expect(c.costBreaker.caps.geocoding).toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  test('cap override of 0 is preserved (block-all)', () => {
    const c = validateConfig({ ...base, COST_BREAKER_CAP_PLACES_TEXT: '0' }, silent);
    expect(c.costBreaker.caps.places_text).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/config.test.js`
Expected: FAIL — `c.costBreaker` is `undefined`.

- [ ] **Step 3: Implement in `src/config.js`**

Add the parser above `validateConfig`:

```js
const COST_BREAKER_BUCKETS = ['geocoding', 'distancematrix', 'places_nearby', 'places_text', 'other'];

function parseCostBreaker(env, logger) {
  const enabled = String(env.COST_BREAKER_ENABLED ?? 'true').toLowerCase() !== 'false';
  const caps = {};
  for (const bucket of COST_BREAKER_BUCKETS) {
    const raw = env[`COST_BREAKER_CAP_${bucket.toUpperCase()}`];
    if (raw == null || String(raw).trim() === '') continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) {
      logger.warn(`[config] WARN: COST_BREAKER_CAP_${bucket.toUpperCase()}="${raw}" is not a non-negative integer — using default.`);
      continue;
    }
    caps[bucket] = n;
  }
  return { enabled, caps };
}
```

In `validateConfig`, add `costBreaker` to the returned object:

```js
  return {
    googleMapsApiKey: env.GOOGLE_MAPS_API_KEY,
    adminToken: isBlank(env.ADMIN_TOKEN) ? null : env.ADMIN_TOKEN,
    port: Number(env.PORT) || 3000,
    costBreaker: parseCostBreaker(env, logger),
  };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/config.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config.js tests/config.test.js
git commit -m "FR-075: validate cost-breaker config at boot (Task 3)"
```

---

### Task 4: Classify `BudgetExceededError` to the graceful capacity page

**Files:**
- Modify: `src/services/reportBuilder.js` (import `BudgetExceededError`; add `classifyError` branch)
- Test: `tests/services/reportBuilder.classify.test.js` (or extend an existing reportBuilder test)

**Interfaces:**
- Consumes: `BudgetExceededError` from `../rateLimit` (re-exported in Task 2).
- Produces: `classifyError(BudgetExceededError)` → `{ type: 'QUOTA_EXCEEDED', title: 'Service at capacity', message, retryAfter: null }`.

- [ ] **Step 1: Write the failing test**

Create `tests/services/reportBuilder.classify.test.js`:

```js
'use strict';
const { classifyError } = require('../../src/services/reportBuilder');
const { BudgetExceededError } = require('../../src/rateLimit');

test('BudgetExceededError classifies as a graceful capacity page', () => {
  const out = classifyError(new BudgetExceededError('places_nearby'));
  expect(out.type).toBe('QUOTA_EXCEEDED');
  expect(out.retryAfter).toBeNull();
  expect(out.title).toMatch(/capacity/i);
});
```

> If `classifyError` is not currently exported from `src/services/reportBuilder.js`, add it to that file's `module.exports` as part of Step 3 (it is already imported by name in `src/app.js`).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/services/reportBuilder.classify.test.js`
Expected: FAIL — returns `SERVER_ERROR` (falls through) instead of `QUOTA_EXCEEDED`.

- [ ] **Step 3: Implement in `src/services/reportBuilder.js`**

Update the import on line 17:

```js
const { QuotaExceededError, RateLimitError, BudgetExceededError } = require('../rateLimit');
```

Add this branch at the **top** of `classifyError` (before the `QuotaExceededError` check):

```js
  if (error instanceof BudgetExceededError) {
    return { type: 'QUOTA_EXCEEDED', title: 'Service at capacity', message: "We've reached today's data-fetch limit. Please try again later.", retryAfter: null };
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/services/reportBuilder.classify.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/reportBuilder.js tests/services/reportBuilder.classify.test.js
git commit -m "FR-075: classify BudgetExceededError to graceful capacity page (Task 4)"
```

---

### Task 5: Boot wiring, admin kill-switch routes, and health panel

**Files:**
- Modify: `src/app.js` (require costBreaker; `configure` at boot; two POST routes; pass `status()` to the health page)
- Modify: `src/templates/pages/adminPage.js` (render the Cost Breaker panel)

**Interfaces:**
- Consumes: `costBreaker.configure/forceTrip/reset/status` (Task 1); `config.costBreaker` (Task 3).
- Produces: `POST /admin/cost-breaker/trip` → `{ forced: true }`; `POST /admin/cost-breaker/reset` → `{ forced: false }`; `buildAdminHealthHTML` accepts a `costBreaker` field.

- [ ] **Step 1: Wire boot configuration in `src/app.js`**

Add the require alongside the other `src/` requires (e.g. near line 27):

```js
const costBreaker = require('./costBreaker');
```

Immediately after the `validateConfig()` try/catch block (after line 36), configure the breaker:

```js
costBreaker.configure(config.costBreaker); // FR-075 — apply env caps + enabled flag
```

- [ ] **Step 2: Add the admin mutation routes (under the existing guard)**

After the existing `app.get('/admin/cache-stats', ...)` line, add:

```js
app.post('/admin/cost-breaker/trip', (req, res) => { costBreaker.forceTrip(); res.json({ forced: true }); });
app.post('/admin/cost-breaker/reset', (req, res) => { costBreaker.reset(); res.json({ forced: false }); });
```

(These sit below `app.use('/admin', makeRequireAdmin(...))`, so they inherit the FR-064 guard.)

- [ ] **Step 3: Pass breaker status into the health page**

In the `/admin/health` handler, add to the object passed to `buildAdminHealthHTML`:

```js
  return res.send(buildAdminHealthHTML({ patterns, mitigations, recentErrors, usage, degradation, costBreaker: costBreaker.status() }));
```

- [ ] **Step 4: Render the panel in `src/templates/pages/adminPage.js`**

Change the signature to destructure `costBreaker`:

```js
function buildAdminHealthHTML({ patterns, mitigations, recentErrors, usage, degradation, costBreaker }) {
```

Before the final `return` template literal, build the rows (matching the file's existing inline-style pattern — this internal dashboard is the codebase's inline-style exception):

```js
  const cbBuckets = costBreaker?.buckets || [];
  const cbRows = cbBuckets.map((b) => `
      <tr style="background:${b.tripped ? '#fff3cd' : 'transparent'}">
        <td style="padding:6px 10px;font-family:monospace;font-size:13px">${b.key}</td>
        <td style="padding:6px 10px;text-align:right;font-weight:${b.tripped ? '600' : '400'};color:${b.tripped ? '#b8922a' : '#1a1a1a'}">${b.used} / ${b.cap}</td>
        <td style="padding:6px 10px;text-align:right">${(b.pct * 100).toFixed(0)}%</td>
        <td style="padding:6px 10px;text-align:right">$${b.estCostUsd.toFixed(2)}</td>
        <td style="padding:6px 10px;text-align:center">${b.tripped ? '⛔ tripped' : 'ok'}</td>
      </tr>`).join('');
```

Insert this section into the body, immediately after the API-usage section (after the `API Usage by Endpoint` block, line ~129):

```js
  <h2>Cost Breaker (24h, per Google SKU)</h2>
  <div class="meta">${costBreaker?.forced ? '⛔ FORCE-TRIP ACTIVE — all billed Google calls are paused.' : 'Estimated spend today'} · total est. $${(costBreaker?.totalEstCostUsd || 0).toFixed(2)} · Distance Matrix est. assumes ~5 elements/call</div>
  ${cbRows ? `<table><thead><tr><th>SKU bucket</th><th style="text-align:right">Used / Cap</th><th style="text-align:right">%</th><th style="text-align:right">Est. $</th><th style="text-align:center">State</th></tr></thead><tbody>${cbRows}</tbody></table>` : '<p class="empty">Cost breaker unavailable.</p>'}
```

- [ ] **Step 5: Run the full suite to verify nothing regressed**

Run: `npx jest`
Expected: PASS — all existing suites + the new costBreaker / rateLimit / config / classify tests. (`adminPage` has no dedicated test; it is covered by the manual check in Task 6.)

- [ ] **Step 6: Commit**

```bash
git add src/app.js src/templates/pages/adminPage.js
git commit -m "FR-075: boot wiring + admin kill-switch routes + health panel (Task 5)"
```

---

### Task 6: Document env vars + full verification

**Files:**
- Modify: `.env.example` (document the new vars)

- [ ] **Step 1: Document the env vars in `.env.example`**

Append:

```bash
# FR-075 — Cost circuit-breaker (per-SKU daily Google API budget).
# Master switch (default true). Set to false to disable enforcement entirely.
COST_BREAKER_ENABLED=true
# Optional per-SKU daily call-cap overrides (integers >= 0; 0 blocks that SKU).
# Defaults derive from each SKU's monthly free allotment / 30 * 0.6.
# COST_BREAKER_CAP_GEOCODING=200
# COST_BREAKER_CAP_DISTANCEMATRIX=200
# COST_BREAKER_CAP_PLACES_NEARBY=100
# COST_BREAKER_CAP_PLACES_TEXT=100
# COST_BREAKER_CAP_OTHER=50
```

- [ ] **Step 2: Full test suite**

Run: `npx jest`
Expected: PASS — full suite green (prior baseline 1,627 + ~22 new tests).

- [ ] **Step 3: Manual admin + breaker smoke (loopback)**

Start the server (`node src/app.js`), then from loopback:

```bash
curl -s localhost:3000/admin/api-usage            # 200 JSON (guard allows loopback)
curl -s -X POST localhost:3000/admin/cost-breaker/trip   # {"forced":true}
curl -s "localhost:3000/report?address=1007+Stonelilly+Dr,+Jeffersonville,+IN+47130&fetch=1" | head -c 400
#   -> graceful "Service at capacity" page (force-trip blocks billed calls; Jeffersonville = PM-001 regression address)
curl -s -X POST localhost:3000/admin/cost-breaker/reset  # {"forced":false}
```

Then load `localhost:3000/admin/health` in a browser and confirm the **Cost Breaker** panel renders per-SKU rows + estimated $.

- [ ] **Step 4: 5-address coherence smoke (CONSTRAINT-011)**

With the breaker at defaults (not tripped), generate a report for each test address and confirm it still renders end-to-end (the breaker is in-path but well under cap for single reports): Georgetown KY, Harlan KY, Louisville KY, Bozeman MT, Jeffersonville IN. Prefer keyless/live verification per project norms.

- [ ] **Step 5: Commit**

```bash
git add .env.example
git commit -m "FR-075: document cost-breaker env vars (Task 6)"
```

---

## Risks & unknowns

- **Distance Matrix tier** — treated as Essentials/10k-free (cap 200); confirm against Google's current SKU list during Task 1. If Pro (5k), set `freeMonthly: 5000, dailyCap: 100`. The AC7 test enforces the invariant regardless. *(Global Constraints)*
- **Element vs call accounting** — `distancematrix` budget counts calls, under-counting true element spend; mitigated by a conservative cap + the `avgElementsPerCall` estimate in the $ readout. *(spec §6)*
- **Check→record non-atomic** — concurrent calls can overshoot a cap slightly; acceptable at this tier, absorbed by the conservative margin. *(spec §E11)*
- **In-memory reset on restart** — budgets + force-trip clear on restart; single-instance caveat, resolved when Stage 1 externalizes `usageLog`'s substrate. *(spec §4/E12)*
- **`classifyError` export** — confirm it is exported from `reportBuilder.js`; add to exports if missing (Task 4 note).

## Self-review (against spec)

- Spec §3 SKU table → Task 1 Step 3 (constants) + `ENDPOINT_TO_BUCKET` (Step 4). ✓
- §3 default caps + AC7 → Task 1 table + `test_default_caps...`. ✓
- §4 costBreaker API (check/record/forceTrip/reset/configure/status/skuFor + error + hooks) → Task 1 Step 4. ✓
- §5 chokepoint wiring, success-only record → Task 2. ✓
- §6 element approximation → constants `avgElementsPerCall` + `estCostFor` + panel label. ✓
- §7 config (enabled + overrides, warn-not-fatal) → Task 3. ✓
- §8 admin panel + trip/reset routes under guard → Task 5. ✓
- §9 graceful error classification → Task 4. ✓
- §11 edge cases E1–E12 → covered across Task 1 tests (E1–E10, E12) + Task 2 (E7) + documented (E11). ✓
- §12 acceptance criteria AC1–AC12 → Task 2 (AC1/AC5), Task 1 (AC2/AC3/AC4/AC6/AC7), Task 4 (AC8), Task 5/6 (AC9), Task 3 (AC10), Task 6 (AC11/AC12). ✓
- §15 files touched → Tasks 1–6 cover all nine. ✓
- Placeholder scan: no TBD/TODO; all code blocks complete. ✓
- Type consistency: `BudgetExceededError`, `skuFor`, bucket keys, `status()` shape consistent across Tasks 1/2/4/5. ✓
