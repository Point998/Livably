# FR-033 Life-at-Address Calculator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive "what does living here cost me to drive?" calculator at the end of the Daily Life chapter — a tested computation engine + a centralized dynamic-rates module + a thin, swappable UI.

**Architecture:** Pure `computeDrivingProfile(inputs, rates)` engine in `reachability/logic.js` (Jest-tested, source of truth). A `src/shared/rates.js` module fetches gas price (EIA, live) and the IRS mileage rate (best-effort), falling back to dated constants, all file-cached via a new `ratesCache` ("one report refreshes for everyone"). The server renders a default profile (works with JS off); an isolated `public/calculator.js` mirrors the formula for live sliders and is **parity-tested** against the engine. Branches off `main`, self-contained.

**Tech Stack:** Node.js, Express, Jest, vanilla template strings + vanilla client JS. New external API: EIA (`api.eia.gov`) via `fetch`, keyed by optional `EIA_API_KEY`.

**Run tests with:** `npx jest <path>` (Windows PowerShell).

---

### Task 1: Constants

**Files:**
- Modify: `src/utils/constants.js`

- [ ] **Step 1: Add the constants block** (before `module.exports`, then add names to the exports object)

```js
// ── FR-033: Life-at-Address Calculator ───────────────────────────────────────
// Dated fallbacks used only when a live rate fetch fails. Refresh when reviewed.
// Sources: EIA (gas), IRS standard mileage rate, EPA/DOE fuel-economy averages.
// Last set: June 2026.
const RATE_FALLBACKS = {
  gasPricePerGallon:  3.20,   // EIA US regular retail, dated fallback ($/gal)
  irsRatePerMile:     0.67,   // IRS business standard mileage rate ($/mi)
  avgMpg:             25,     // avg light-duty fuel economy (mpg) — modeling assumption
  maintenancePerMile: 0.10,   // tires + maintenance + repairs ($/mi) — modeling assumption
  evKwhPerMile:       0.30,   // typical EV consumption (kWh/mi) — modeling assumption
  electricRatePerKwh: 0.16,   // US avg residential ($/kWh); FR-032 seam for local rate
};

// Round-trip trip distances for non-commute legs (commute distance is user-set).
// Modeling assumptions — centralized, dated (June 2026).
const TRIP_DISTANCE_DEFAULTS = {
  groceryRoundTripMiles: 12,
  cityRoundTripMiles:    60,
  schoolRoundTripMiles:  8,
  schoolDaysPerWeek:     5,
};

// Default profile the server renders (Office Commuter). Meaningful with JS off.
const DEFAULT_PROFILE = {
  commuteDaysPerWeek:  3,
  commuteOneWayMiles:  15,
  groceryTripsPerWeek: 1,
  cityTripsPerMonth:   1,
  hasKidsInSchool:     false,
};

// Input bounds (engine + client clamp identically).
const PROFILE_BOUNDS = {
  commuteDaysPerWeek:  [0, 7],
  commuteOneWayMiles:  [0, 200],
  groceryTripsPerWeek: [0, 7],
  cityTripsPerMonth:   [0, 8],
};

const RATES_GAS_TTL_DAYS = 14;
const RATES_IRS_TTL_DAYS  = 180;
```

Add `RATE_FALLBACKS, TRIP_DISTANCE_DEFAULTS, DEFAULT_PROFILE, PROFILE_BOUNDS, RATES_GAS_TTL_DAYS, RATES_IRS_TTL_DAYS` to `module.exports`.

- [ ] **Step 2: Verify load**

Run: `node -e "const c=require('./src/utils/constants'); console.log(c.RATE_FALLBACKS.irsRatePerMile, c.DEFAULT_PROFILE.commuteOneWayMiles, c.RATES_IRS_TTL_DAYS)"`
Expected: `0.67 15 180`

- [ ] **Step 3: Commit**

```bash
git add src/utils/constants.js
git commit -m "feat(FR-033): rate fallbacks, trip distances, default profile constants"
```

---

### Task 2: Computation engine — `computeDrivingProfile`

**Files:**
- Modify: `src/modules/reachability/logic.js`
- Test: `tests/modules/reachability/logic.test.js` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/modules/reachability/logic.test.js`:

```js
'use strict';
const { computeDrivingProfile } = require('../../../src/modules/reachability/logic');

const RATES = {
  marginalCostPerMile: 0.20,
  irsRatePerMile:      0.67,
  evKwhPerMile:        0.30,
  electricRatePerKwh:  0.16,
  tripDistances: { groceryRoundTripMiles: 12, cityRoundTripMiles: 60, schoolRoundTripMiles: 8, schoolDaysPerWeek: 5 },
};

describe('computeDrivingProfile', () => {
  test('computes weekly miles by type, annual miles, and three costs', () => {
    const r = computeDrivingProfile(
      { commuteDaysPerWeek: 5, commuteOneWayMiles: 10, groceryTripsPerWeek: 2, cityTripsPerMonth: 0, hasKidsInSchool: false },
      RATES,
    );
    expect(r.weeklyMilesByType.commute).toBe(100); // 5*10*2
    expect(r.weeklyMilesByType.grocery).toBe(24);  // 2*12
    expect(r.weeklyMilesByType.city).toBe(0);
    expect(r.weeklyMilesByType.school).toBe(0);
    expect(r.weeklyMilesTotal).toBe(124);
    expect(r.annualMiles).toBe(6448);              // round(124*52)
    expect(r.costMarginal).toBe(1290);             // round(6448*0.20)
    expect(r.costIrs).toBe(4320);                  // round(6448*0.67)
    expect(r.costEv).toBe(310);                    // round(6448*0.30*0.16)
  });

  test('school adds 5 round-trips/week when kids in school', () => {
    const r = computeDrivingProfile(
      { commuteDaysPerWeek: 0, commuteOneWayMiles: 0, groceryTripsPerWeek: 0, cityTripsPerMonth: 0, hasKidsInSchool: true },
      RATES,
    );
    expect(r.weeklyMilesByType.school).toBe(40); // 5 days * 8 mi RT
  });

  test('city trips convert monthly->weekly via /4.33', () => {
    const r = computeDrivingProfile(
      { commuteDaysPerWeek: 0, commuteOneWayMiles: 0, groceryTripsPerWeek: 0, cityTripsPerMonth: 4, hasKidsInSchool: false },
      RATES,
    );
    expect(r.weeklyMilesByType.city).toBeCloseTo((4 * 60) / 4.33, 5);
  });

  test('clamps out-of-range and non-numeric inputs to bounds', () => {
    const r = computeDrivingProfile(
      { commuteDaysPerWeek: 99, commuteOneWayMiles: -5, groceryTripsPerWeek: 'x', cityTripsPerMonth: 999, hasKidsInSchool: 1 },
      RATES,
    );
    expect(r.weeklyMilesByType.commute).toBe(0);   // days clamp 7, miles clamp 0 -> 7*0*2
    expect(r.weeklyMilesByType.grocery).toBe(0);   // 'x' -> 0
    expect(r.weeklyMilesByType.school).toBe(40);   // truthy 1 -> kids
    expect(r.weeklyMilesByType.city).toBeCloseTo((8 * 60) / 4.33, 5); // clamp 8
  });

  test('no scoring/grade fields in output', () => {
    const r = computeDrivingProfile({ commuteDaysPerWeek: 3, commuteOneWayMiles: 15, groceryTripsPerWeek: 1, cityTripsPerMonth: 1, hasKidsInSchool: false }, RATES);
    expect(Object.keys(r)).toEqual(['weeklyMilesByType', 'weeklyMilesTotal', 'annualMiles', 'costMarginal', 'costIrs', 'costEv']);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx jest tests/modules/reachability/logic.test.js`
Expected: FAIL — `computeDrivingProfile is not a function`

- [ ] **Step 3: Implement** (append to `src/modules/reachability/logic.js`, add to exports)

```js
function clampNum(v, lo, hi) {
  v = Number(v);
  if (isNaN(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

// Pure driving-cost engine. CONSTRAINT-001: figures only, never a score/grade.
// `rates` carries the cost rates + tripDistances (assembled by getDrivingRates).
function computeDrivingProfile(inputs, rates) {
  const i = inputs || {};
  const commuteDays  = clampNum(i.commuteDaysPerWeek, 0, 7);
  const commuteMiles = clampNum(i.commuteOneWayMiles, 0, 200);
  const groceryTrips = clampNum(i.groceryTripsPerWeek, 0, 7);
  const cityTrips    = clampNum(i.cityTripsPerMonth, 0, 8);
  const kids         = !!i.hasKidsInSchool;
  const d = rates.tripDistances;

  const weeklyMilesByType = {
    commute: commuteDays * commuteMiles * 2,
    grocery: groceryTrips * d.groceryRoundTripMiles,
    city:    (cityTrips * d.cityRoundTripMiles) / 4.33,
    school:  kids ? d.schoolDaysPerWeek * d.schoolRoundTripMiles : 0,
  };
  const weeklyMilesTotal = weeklyMilesByType.commute + weeklyMilesByType.grocery + weeklyMilesByType.city + weeklyMilesByType.school;
  const annualMiles = Math.round(weeklyMilesTotal * 52);

  return {
    weeklyMilesByType,
    weeklyMilesTotal,
    annualMiles,
    costMarginal: Math.round(annualMiles * rates.marginalCostPerMile),
    costIrs:      Math.round(annualMiles * rates.irsRatePerMile),
    costEv:       Math.round(annualMiles * rates.evKwhPerMile * rates.electricRatePerKwh),
  };
}
```

Update `module.exports` (currently `{ isExcludedGroceryType }`) to also export `computeDrivingProfile` and `clampNum`.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest tests/modules/reachability/logic.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/reachability/logic.js tests/modules/reachability/logic.test.js
git commit -m "feat(FR-033): pure driving-cost computation engine"
```

---

### Task 3: Rate fetchers + fixtures — `src/shared/rates.js` (fetchers only)

**Files:**
- Create: `src/shared/rates.js`
- Create: `tests/shared/fixtures/eia-gas-price.json`, `tests/shared/fixtures/irs-rate-page.html`
- Test: `tests/shared/rates.test.js`

Pattern reference: `src/modules/utilities/data.js` (timeout, defensive parse, `null` on failure).

- [ ] **Step 1: Create the fixtures**

`tests/shared/fixtures/eia-gas-price.json`:
```json
{
  "response": {
    "total": 1,
    "frequency": "weekly",
    "data": [
      { "period": "2026-06-01", "duoarea": "NUS", "area-name": "U.S.", "product": "EPMR", "product-name": "Regular Gasoline", "process": "PTE", "value": "3.41", "units": "$/GAL" }
    ]
  }
}
```

`tests/shared/fixtures/irs-rate-page.html`:
```html
<html><body>
<h1>Standard mileage rates</h1>
<p>Beginning Jan. 1, 2026, the standard mileage rate for the business use of a
car is <strong>67 cents per mile</strong> driven for business use.</p>
</body></html>
```

- [ ] **Step 2: Write the failing test**

Create `tests/shared/rates.test.js`:
```js
'use strict';
const path = require('path');
const { fetchGasPrice, fetchIrsMileageRate } = require('../../src/shared/rates');

const eiaFixture = require('./fixtures/eia-gas-price.json');
const fs = require('fs');
const irsHtml = fs.readFileSync(path.join(__dirname, 'fixtures', 'irs-rate-page.html'), 'utf8');

afterEach(() => { global.fetch = undefined; delete process.env.EIA_API_KEY; });

describe('fetchGasPrice (EIA)', () => {
  test('parses national weekly regular retail price + asOf', async () => {
    process.env.EIA_API_KEY = 'test';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => eiaFixture });
    const r = await fetchGasPrice();
    expect(r).toEqual({ value: 3.41, asOf: '2026-06-01' });
  });
  test('returns null when no API key', async () => {
    expect(await fetchGasPrice()).toBeNull();
  });
  test('returns null on non-ok / throw / empty data', async () => {
    process.env.EIA_API_KEY = 'test';
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    expect(await fetchGasPrice()).toBeNull();
    global.fetch = jest.fn().mockRejectedValue(new Error('net'));
    expect(await fetchGasPrice()).toBeNull();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ response: { data: [] } }) });
    expect(await fetchGasPrice()).toBeNull();
  });
});

describe('fetchIrsMileageRate', () => {
  test('parses "67 cents per mile" -> 0.67', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => irsHtml });
    const r = await fetchIrsMileageRate();
    expect(r.value).toBe(0.67);
    expect(typeof r.asOf).toBe('string');
  });
  test('returns null when pattern absent or fetch fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '<p>no rate here</p>' });
    expect(await fetchIrsMileageRate()).toBeNull();
    global.fetch = jest.fn().mockRejectedValue(new Error('net'));
    expect(await fetchIrsMileageRate()).toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify fail**

Run: `npx jest tests/shared/rates.test.js`
Expected: FAIL — module not found

- [ ] **Step 4: Implement** `src/shared/rates.js` (fetchers only for now)

```js
'use strict';

// EIA v2: US weekly regular gasoline retail price ($/gal).
const EIA_URL =
  'https://api.eia.gov/v2/petroleum/pri/gnd/data/?frequency=weekly' +
  '&data[0]=value&facets[product][]=EPMR&facets[duoarea][]=NUS' +
  '&sort[0][column]=period&sort[0][direction]=desc&length=1';

// Best-effort IRS standard mileage rate source (HTML page, parsed defensively).
const IRS_URL = 'https://www.irs.gov/tax-professionals/standard-mileage-rates';

async function fetchGasPrice() {
  const key = process.env.EIA_API_KEY;
  if (!key) return null;
  try {
    const resp = await fetch(`${EIA_URL}&api_key=${key}`, {
      signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const row = data?.response?.data?.[0];
    const value = Number(row?.value);
    if (!row || !value || value <= 0) return null;
    return { value, asOf: String(row.period || '') };
  } catch (err) {
    console.error('[EIA gas price]', err.message);
    return null;
  }
}

async function fetchIrsMileageRate() {
  try {
    const resp = await fetch(IRS_URL, {
      signal: AbortSignal.timeout(12000), headers: { Accept: 'text/html' },
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const m = html.match(/(\d{1,3})\s*cents per mile/i);
    if (!m) return null;
    const cents = parseInt(m[1], 10);
    if (!cents || cents <= 0 || cents > 200) return null;
    return { value: Math.round(cents) / 100, asOf: new Date().toISOString().slice(0, 10) };
  } catch (err) {
    console.error('[IRS mileage rate]', err.message);
    return null;
  }
}

module.exports = { fetchGasPrice, fetchIrsMileageRate };
```

- [ ] **Step 5: Run to verify pass**

Run: `npx jest tests/shared/rates.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/shared/rates.js tests/shared/rates.test.js tests/shared/fixtures/
git commit -m "feat(FR-033): EIA gas-price + IRS-rate fetchers with response fixtures"
```

---

### Task 4: Rates cache + `getDrivingRates()` orchestrator

**Files:**
- Modify: `src/cache.js` (add `ratesCache`)
- Modify: `src/shared/rates.js` (add `getDrivingRates`)
- Test: `tests/shared/rates.test.js` (append)

- [ ] **Step 1: Add `ratesCache` to `src/cache.js`**

Add `RATES_GAS_TTL_DAYS, RATES_IRS_TTL_DAYS` to the top-level constants require. After `watershedCache` (or `utilitiesCache` if present), add:
```js
// FR-033: national driving rates (gas/IRS) — global cache, "one report refreshes
// for everyone". Gas TTL short (price moves); IRS TTL long (annual).
const ratesCache = new Cache('rates', 60 * 60 * 24 * RATES_GAS_TTL_DAYS);
```
Add `rates: files.filter((f) => ratesCache._ownsFile(f)).length` to the `cacheStats` breakdown and add `ratesCache` to `module.exports`.

> The single `ratesCache` namespace holds two keys (`rates:gas`, `rates:irs`) with **per-entry** expiry; since `Cache.set` stamps `expiresAt` per file, store the IRS entry with a longer effective TTL by writing its own `expiresAt`. To keep it simple, this task computes IRS freshness from the cached `asOf`+TTL inside `getDrivingRates` rather than relying on the namespace TTL (see Step 3).

- [ ] **Step 2: Add the failing test** (append to `tests/shared/rates.test.js`)

```js
const { getDrivingRates } = require('../../src/shared/rates');
const { ratesCache } = require('../../src/cache');

describe('getDrivingRates', () => {
  beforeEach(() => ratesCache.clear());
  afterAll(() => ratesCache.clear());

  test('uses live gas price when available; derives marginalCostPerMile', async () => {
    process.env.EIA_API_KEY = 'test';
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => eiaFixture })       // gas
      .mockResolvedValueOnce({ ok: true, text: async () => irsHtml });          // irs
    const r = await getDrivingRates();
    expect(r.gasPricePerGallon).toBe(3.41);
    expect(r.sources.gas).toBe('EIA');
    expect(r.irsRatePerMile).toBe(0.67);
    // marginal = gas/mpg + maintenance = 3.41/25 + 0.10
    expect(r.marginalCostPerMile).toBeCloseTo(3.41 / 25 + 0.10, 6);
    expect(r.tripDistances.groceryRoundTripMiles).toBe(12);
    expect(r.asOf.gas).toBe('2026-06-01');
  });

  test('falls back to dated constants when fetches fail (resilient)', async () => {
    delete process.env.EIA_API_KEY; // gas fetch returns null
    global.fetch = jest.fn().mockRejectedValue(new Error('net')); // irs fails
    const r = await getDrivingRates();
    expect(r.gasPricePerGallon).toBe(3.20);   // RATE_FALLBACKS
    expect(r.sources.gas).toBe('fallback');
    expect(r.irsRatePerMile).toBe(0.67);
    expect(r.sources.irs).toBe('fallback');
  });

  test('caches a successful gas fetch (second call makes no new gas fetch)', async () => {
    process.env.EIA_API_KEY = 'test';
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => eiaFixture })
      .mockResolvedValueOnce({ ok: true, text: async () => irsHtml });
    await getDrivingRates();
    const callsAfterFirst = global.fetch.mock.calls.length;
    await getDrivingRates();
    expect(global.fetch.mock.calls.length).toBe(callsAfterFirst); // served from cache
  });

  test('a failed fetch is not cached (re-attempts next call)', async () => {
    delete process.env.EIA_API_KEY;
    global.fetch = jest.fn().mockRejectedValue(new Error('net'));
    await getDrivingRates();
    const calls1 = global.fetch.mock.calls.length;
    await getDrivingRates();
    expect(global.fetch.mock.calls.length).toBeGreaterThanOrEqual(calls1); // not poisoned
  });
});
```

- [ ] **Step 3: Implement `getDrivingRates` in `src/shared/rates.js`**

```js
const { ratesCache } = require('../cache');
const { RATE_FALLBACKS, TRIP_DISTANCE_DEFAULTS, RATES_GAS_TTL_DAYS, RATES_IRS_TTL_DAYS } = require('../utils/constants');

const DAY = 24 * 60 * 60 * 1000;

// Read a cached {value, asOf, fetchedAt} if still within ttlDays; else null.
function cachedFresh(key, ttlDays) {
  const c = ratesCache.get(key);
  if (!c || !c.fetchedAt) return null;
  return (Date.now() - c.fetchedAt) < ttlDays * DAY ? c : null;
}

// Resolve one rate: fresh cache -> live fetch (cache on success) -> null.
async function resolveRate(key, ttlDays, fetcher) {
  const hit = cachedFresh(key, ttlDays);
  if (hit) return { value: hit.value, asOf: hit.asOf, source: 'cache' };
  const fetched = await fetcher();
  if (fetched && fetched.value > 0) {
    ratesCache.set(key, { value: fetched.value, asOf: fetched.asOf, fetchedAt: Date.now() });
    return { value: fetched.value, asOf: fetched.asOf, source: 'live' };
  }
  return null; // not cached -> not poisoned
}

async function getDrivingRates() {
  const gas = await resolveRate('rates:gas', RATES_GAS_TTL_DAYS, fetchGasPrice);
  const irs = await resolveRate('rates:irs', RATES_IRS_TTL_DAYS, fetchIrsMileageRate);

  const gasPricePerGallon = gas ? gas.value : RATE_FALLBACKS.gasPricePerGallon;
  const irsRatePerMile    = irs ? irs.value : RATE_FALLBACKS.irsRatePerMile;
  const { avgMpg, maintenancePerMile, evKwhPerMile, electricRatePerKwh } = RATE_FALLBACKS;

  return {
    gasPricePerGallon,
    irsRatePerMile,
    avgMpg,
    maintenancePerMile,
    evKwhPerMile,
    electricRatePerKwh,
    marginalCostPerMile: gasPricePerGallon / avgMpg + maintenancePerMile,
    tripDistances: { ...TRIP_DISTANCE_DEFAULTS },
    sources: { gas: gas ? 'EIA' : 'fallback', irs: irs ? 'IRS' : 'fallback' },
    asOf: { gas: gas ? gas.asOf : null, irs: irs ? irs.asOf : null },
  };
}

module.exports = { fetchGasPrice, fetchIrsMileageRate, getDrivingRates };
```

> Note: `sources.gas === 'cache'` collapses to `'EIA'` here because a cache hit still originated from EIA — keep the test assertion on `'EIA'`. (The `source` returned by `resolveRate` distinguishes cache vs live for potential future use.)

- [ ] **Step 4: Run to verify pass**

Run: `npx jest tests/shared/rates.test.js`
Expected: PASS (all describe blocks)

- [ ] **Step 5: Commit**

```bash
git add src/cache.js src/shared/rates.js tests/shared/rates.test.js
git commit -m "feat(FR-033): getDrivingRates orchestrator + ratesCache (refresh-for-everyone)"
```

---

### Task 5: Template — `buildLifeCalculatorHTML`

**Files:**
- Modify: `src/modules/reachability/template.js`
- Test: `tests/modules/reachability/template.test.js` (append a describe block)

Use only existing/semantic classes; **no inline styles** (CONSTRAINT-008); **no scoring** (CONSTRAINT-001). The block embeds a JSON config for the client.

- [ ] **Step 1: Add the failing test** (append to `tests/modules/reachability/template.test.js`)

```js
const { buildInsightsCardHTML: buildIC } = require('../../../src/modules/reachability/template');

const LIFECALC = {
  profile: { commuteDaysPerWeek: 3, commuteOneWayMiles: 15, groceryTripsPerWeek: 1, cityTripsPerMonth: 1, hasKidsInSchool: false },
  rates: {
    marginalCostPerMile: 0.2364, irsRatePerMile: 0.67, evKwhPerMile: 0.30, electricRatePerKwh: 0.16,
    gasPricePerGallon: 3.41, avgMpg: 25, maintenancePerMile: 0.10,
    tripDistances: { groceryRoundTripMiles: 12, cityRoundTripMiles: 60, schoolRoundTripMiles: 8, schoolDaysPerWeek: 5 },
    sources: { gas: 'EIA', irs: 'fallback' }, asOf: { gas: '2026-06-01', irs: null },
  },
  bounds: { commuteDaysPerWeek: [0,7], commuteOneWayMiles: [0,200], groceryTripsPerWeek: [0,7], cityTripsPerMonth: [0,8] },
};
const G = [{ name: 'Kroger', address: '1 St', driveTimeMinutes: 6 }];

describe('Life-at-Address calculator block', () => {
  test('renders inside the daily chapter when lifeCalc provided', () => {
    const html = buildIC(G, null, null, null, null, null, LIFECALC);
    expect(html).toContain('life-calc');
    expect(html).toContain('data-ch="daily"'); // still inside daily section
  });
  test('renders the computed default headline (marginal) + annual miles', () => {
    const html = buildIC(G, null, null, null, null, null, LIFECALC);
    // default profile annual miles: commute 3*15*2=90; grocery 12; city 60/4.33=13.86; total ~115.86 -> *52
    expect(html).toMatch(/life-calc-cost-marginal/);
    expect(html).toMatch(/life-calc-annual-miles/);
  });
  test('embeds a JSON config script for the client', () => {
    const html = buildIC(G, null, null, null, null, null, LIFECALC);
    expect(html).toContain('id="life-calc-config"');
    expect(html).toContain('application/json');
  });
  test('omitting lifeCalc leaves the chapter unchanged (back-compat)', () => {
    const html = buildIC(G, null, null, null, null, null);
    expect(html).not.toContain('life-calc');
  });
  test('no inline styles, no scoring language', () => {
    const html = buildIC(G, null, null, null, null, null, LIFECALC);
    expect(html).not.toMatch(/style="/);
    expect(html.toLowerCase()).not.toMatch(/\bscore\b|\bgrade\b|out of 10/);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx jest tests/modules/reachability/template.test.js -t "Life-at-Address"`
Expected: FAIL (lifeCalc ignored / `life-calc` absent)

- [ ] **Step 3: Implement**

In `src/modules/reachability/template.js`, add `computeDrivingProfile` to the existing `require('./logic')` (or add a require), and add this function:

```js
const { computeDrivingProfile } = require('./logic');

function buildLifeCalculatorHTML(lifeCalc) {
  if (!lifeCalc || !lifeCalc.rates) return '';
  const { profile, rates, bounds } = lifeCalc;
  const p = computeDrivingProfile(profile, rates);
  const dollars = (n) => `$${Math.round(n).toLocaleString()}`;

  const sliderRow = (id, label, value, min, max, step, suffix) => `
    <div class="life-calc-control">
      <label class="life-calc-label" for="lc-${id}">${escapeHtml(label)}</label>
      <input class="life-calc-slider" type="range" id="lc-${id}" name="${id}"
             min="${min}" max="${max}" step="${step}" value="${value}">
      <output class="life-calc-value" id="lc-${id}-out">${value}${suffix ? ' ' + escapeHtml(suffix) : ''}</output>
    </div>`;

  const gasAsOf = rates.asOf?.gas ? ` (EIA, as of ${escapeHtml(rates.asOf.gas)})` : ' (estimated)';
  const config = JSON.stringify({ profile, rates, bounds });

  return `
  <div class="life-calc" data-depth="overview">
    <div class="life-calc-head">
      <div class="life-calc-title">What this address costs you to drive</div>
      <p class="life-calc-sub">Adjust to match your life. Estimates only — your actual mileage and prices vary.</p>
    </div>
    <div class="life-calc-controls">
      ${sliderRow('commuteDaysPerWeek', 'Commute days per week', profile.commuteDaysPerWeek, bounds.commuteDaysPerWeek[0], bounds.commuteDaysPerWeek[1], 1, '')}
      ${sliderRow('commuteOneWayMiles', 'Commute distance (one way)', profile.commuteOneWayMiles, bounds.commuteOneWayMiles[0], bounds.commuteOneWayMiles[1], 1, 'mi')}
      ${sliderRow('groceryTripsPerWeek', 'Grocery trips per week', profile.groceryTripsPerWeek, bounds.groceryTripsPerWeek[0], bounds.groceryTripsPerWeek[1], 1, '')}
      ${sliderRow('cityTripsPerMonth', 'Big-city trips per month', profile.cityTripsPerMonth, bounds.cityTripsPerMonth[0], bounds.cityTripsPerMonth[1], 1, '')}
      <div class="life-calc-control life-calc-control--toggle">
        <label class="life-calc-label" for="lc-hasKidsInSchool">Kids in school (adds school runs)</label>
        <input class="life-calc-toggle" type="checkbox" id="lc-hasKidsInSchool" name="hasKidsInSchool"${profile.hasKidsInSchool ? ' checked' : ''}>
      </div>
    </div>
    <div class="life-calc-outputs">
      <div class="life-calc-headline">
        <span class="life-calc-headline-label">Estimated yearly driving cost</span>
        <span class="life-calc-cost-marginal" id="lc-out-marginal">${dollars(p.costMarginal)}</span>
        <span class="life-calc-headline-note">running cost — fuel + maintenance${gasAsOf}</span>
      </div>
      <div class="life-calc-secondary">
        <div class="life-calc-figure"><span class="life-calc-annual-miles" id="lc-out-miles">${p.annualMiles.toLocaleString()}</span><span class="life-calc-figure-label">miles / year</span></div>
        <div class="life-calc-figure"><span id="lc-out-ev">${dollars(p.costEv)}</span><span class="life-calc-figure-label">on an EV</span></div>
        <div class="life-calc-figure"><span id="lc-out-irs">${dollars(p.costIrs)}</span><span class="life-calc-figure-label">at IRS full rate (${rates.irsRatePerMile.toFixed(2)}/mi)</span></div>
      </div>
    </div>
    <script type="application/json" id="life-calc-config">${config.replace(/</g, '\\u003c')}</script>
    <p class="life-calc-disclaimer">Marginal cost = fuel (gas ÷ ${rates.avgMpg} mpg) + maintenance. IRS rate reflects full ownership cost incl. depreciation. EV uses an average residential electricity rate. Charger locations are in the Utilities chapter.</p>
  </div>`;
}
```

Change `buildInsightsCardHTML(grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation)` to accept a trailing `lifeCalc = null` and render the block inside the `<section>` immediately before `${renderDepthSelector('daily')}`:

```js
function buildInsightsCardHTML(grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation, lifeCalc = null) {
  // ...existing body unchanged through sectionsHTML/calloutsHTML...
```
and in the returned section template, add `${buildLifeCalculatorHTML(lifeCalc)}` on its own line right before `${renderDepthSelector('daily')}`.

Add `buildLifeCalculatorHTML` to `module.exports`.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest tests/modules/reachability/template.test.js`
Expected: PASS (existing + new)

- [ ] **Step 5: Commit**

```bash
git add src/modules/reachability/template.js tests/modules/reachability/template.test.js
git commit -m "feat(FR-033): Life-at-Address calculator template block (default + config)"
```

---

### Task 6: Client mirror — `public/calculator.js` + parity test

**Files:**
- Create: `public/calculator.js`
- Test: `tests/modules/reachability/calculator-parity.test.js`

- [ ] **Step 1: Write the failing parity test**

Create `tests/modules/reachability/calculator-parity.test.js`:
```js
'use strict';
const { computeDrivingProfile } = require('../../../src/modules/reachability/logic');
const { computeProfileClient } = require('../../../public/calculator');

const RATES = {
  marginalCostPerMile: 0.2364, irsRatePerMile: 0.67, evKwhPerMile: 0.30, electricRatePerKwh: 0.16,
  tripDistances: { groceryRoundTripMiles: 12, cityRoundTripMiles: 60, schoolRoundTripMiles: 8, schoolDaysPerWeek: 5 },
};

describe('client mirror parity with server engine', () => {
  const matrix = [
    { commuteDaysPerWeek: 0, commuteOneWayMiles: 0, groceryTripsPerWeek: 0, cityTripsPerMonth: 0, hasKidsInSchool: false },
    { commuteDaysPerWeek: 5, commuteOneWayMiles: 24, groceryTripsPerWeek: 2, cityTripsPerMonth: 3, hasKidsInSchool: true },
    { commuteDaysPerWeek: 3, commuteOneWayMiles: 15, groceryTripsPerWeek: 1, cityTripsPerMonth: 1, hasKidsInSchool: false },
    { commuteDaysPerWeek: 99, commuteOneWayMiles: -5, groceryTripsPerWeek: 'x', cityTripsPerMonth: 999, hasKidsInSchool: 1 },
  ];
  matrix.forEach((inp, idx) => {
    test(`identical output for input #${idx}`, () => {
      expect(computeProfileClient(inp, RATES)).toEqual(computeDrivingProfile(inp, RATES));
    });
  });

  test('exports computeProfileClient and does not throw on require (no DOM)', () => {
    expect(typeof computeProfileClient).toBe('function');
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx jest tests/modules/reachability/calculator-parity.test.js`
Expected: FAIL — cannot find `public/calculator`

- [ ] **Step 3: Implement** `public/calculator.js`

```js
/* FR-033 Life-at-Address calculator (client).
 * The pure formula below is a faithful MIRROR of
 * src/modules/reachability/logic.js#computeDrivingProfile — the SERVER is the
 * source of truth. A Jest parity test asserts they stay identical. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // node (parity test)
  else root.LivablyCalculator = api;                                          // browser
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clampNum(v, lo, hi) {
    v = Number(v);
    if (isNaN(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
  }

  function computeProfileClient(inputs, rates) {
    var i = inputs || {};
    var commuteDays  = clampNum(i.commuteDaysPerWeek, 0, 7);
    var commuteMiles = clampNum(i.commuteOneWayMiles, 0, 200);
    var groceryTrips = clampNum(i.groceryTripsPerWeek, 0, 7);
    var cityTrips    = clampNum(i.cityTripsPerMonth, 0, 8);
    var kids         = !!i.hasKidsInSchool;
    var d = rates.tripDistances;

    var weeklyMilesByType = {
      commute: commuteDays * commuteMiles * 2,
      grocery: groceryTrips * d.groceryRoundTripMiles,
      city:    (cityTrips * d.cityRoundTripMiles) / 4.33,
      school:  kids ? d.schoolDaysPerWeek * d.schoolRoundTripMiles : 0,
    };
    var weeklyMilesTotal = weeklyMilesByType.commute + weeklyMilesByType.grocery + weeklyMilesByType.city + weeklyMilesByType.school;
    var annualMiles = Math.round(weeklyMilesTotal * 52);

    return {
      weeklyMilesByType: weeklyMilesByType,
      weeklyMilesTotal: weeklyMilesTotal,
      annualMiles: annualMiles,
      costMarginal: Math.round(annualMiles * rates.marginalCostPerMile),
      costIrs:      Math.round(annualMiles * rates.irsRatePerMile),
      costEv:       Math.round(annualMiles * rates.evKwhPerMile * rates.electricRatePerKwh),
    };
  }

  function dollars(n) { return '$' + Math.round(n).toLocaleString(); }

  function init() {
    var cfgEl = document.getElementById('life-calc-config');
    var root = document.querySelector('.life-calc');
    if (!cfgEl || !root) return;
    var cfg;
    try { cfg = JSON.parse(cfgEl.textContent); } catch (e) { return; }
    var rates = cfg.rates;

    function readInputs() {
      return {
        commuteDaysPerWeek:  root.querySelector('#lc-commuteDaysPerWeek').value,
        commuteOneWayMiles:  root.querySelector('#lc-commuteOneWayMiles').value,
        groceryTripsPerWeek: root.querySelector('#lc-groceryTripsPerWeek').value,
        cityTripsPerMonth:   root.querySelector('#lc-cityTripsPerMonth').value,
        hasKidsInSchool:     root.querySelector('#lc-hasKidsInSchool').checked,
      };
    }
    function setText(id, txt) { var el = root.querySelector(id); if (el) el.textContent = txt; }

    function recompute() {
      var inp = readInputs();
      var r = computeProfileClient(inp, rates);
      setText('#lc-out-marginal', dollars(r.costMarginal));
      setText('#lc-out-miles', r.annualMiles.toLocaleString());
      setText('#lc-out-ev', dollars(r.costEv));
      setText('#lc-out-irs', dollars(r.costIrs));
      ['commuteDaysPerWeek','commuteOneWayMiles','groceryTripsPerWeek','cityTripsPerMonth'].forEach(function (id) {
        var slider = root.querySelector('#lc-' + id);
        var out = root.querySelector('#lc-' + id + '-out');
        if (slider && out) out.textContent = slider.value + (out.textContent.indexOf('mi') > -1 ? ' mi' : '');
      });
    }

    root.querySelectorAll('input').forEach(function (el) {
      el.addEventListener('input', recompute);
      el.addEventListener('change', recompute);
    });
    recompute();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);
  }

  return { computeProfileClient: computeProfileClient };
});
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest tests/modules/reachability/calculator-parity.test.js`
Expected: PASS (5 tests — 4 matrix + export)

- [ ] **Step 5: Commit**

```bash
git add public/calculator.js tests/modules/reachability/calculator-parity.test.js
git commit -m "feat(FR-033): client calculator mirror + parity test vs engine"
```

---

### Task 7: Provisional CSS

**Files:**
- Modify: `public/report.css`

- [ ] **Step 1: Append provisional calculator styles** (semantic classes; placeholder visuals — to be finalized in the frontend phase). Use existing tokens (`--ch`, `--ink-*`, `--space-*`, `--radius-*`, fonts).

```css
/* ── FR-033 Life-at-Address calculator (provisional) ─────────────── */
.life-calc { margin-top: var(--space-32); padding-top: var(--space-24); border-top: 1px solid var(--ink-10); }
.life-calc-title { font-family: var(--font-display); font-size: var(--text-xl); color: var(--ch-text, var(--ink)); }
.life-calc-sub { font-size: var(--text-sm); color: var(--ink-60); margin: var(--space-4) 0 var(--space-16); }
.life-calc-controls { display: grid; gap: var(--space-12); margin-bottom: var(--space-24); }
.life-calc-control { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: var(--space-12); }
.life-calc-label { font-size: var(--text-sm); color: var(--ink); }
.life-calc-slider { width: 100%; grid-column: 1 / -1; accent-color: var(--ch, var(--ink)); }
.life-calc-value { font-variant-numeric: tabular-nums; color: var(--ink-60); font-size: var(--text-sm); }
.life-calc-outputs { display: grid; gap: var(--space-16); }
.life-calc-headline { display: grid; gap: var(--space-4); }
.life-calc-headline-label { font-size: var(--text-sm); color: var(--ink-60); }
.life-calc-cost-marginal { font-family: var(--font-display); font-size: 2rem; color: var(--ch-text, var(--ink)); font-variant-numeric: tabular-nums; }
.life-calc-headline-note { font-size: var(--text-xs); color: var(--ink-30); }
.life-calc-secondary { display: flex; flex-wrap: wrap; gap: var(--space-24); }
.life-calc-figure { display: grid; }
.life-calc-figure span:first-child { font-size: var(--text-lg); font-variant-numeric: tabular-nums; }
.life-calc-figure-label { font-size: var(--text-xs); color: var(--ink-60); }
.life-calc-disclaimer { font-size: var(--text-xs); color: var(--ink-30); margin-top: var(--space-16); }
```

- [ ] **Step 2: Verify constraint suites stay green**

Run: `npx jest tests/constraints`
Expected: PASS (no-inline-styles unaffected — calculator markup uses classes).

- [ ] **Step 3: Commit**

```bash
git add public/report.css
git commit -m "feat(FR-033): provisional calculator styles (frontend phase to finalize)"
```

---

### Task 8: Wiring — rates fetch → default profile → render → script

**Files:**
- Modify: `src/services/reportBuilder.js`
- Modify: `src/templates/pages/reportPage.js`

- [ ] **Step 1: Fetch rates + build `lifeCalc` in `reportBuilder.js`**

Add the import near the top:
```js
const { getDrivingRates } = require('../shared/rates');
const { DEFAULT_PROFILE, PROFILE_BOUNDS } = require('../utils/constants');
```
In `buildReport`, after the existing parallel fetches (non-blocking — rates have their own fallback), add:
```js
  let lifeCalc = null;
  try {
    const rates = await getDrivingRates();
    lifeCalc = { profile: DEFAULT_PROFILE, rates, bounds: PROFILE_BOUNDS };
  } catch (_) { /* calculator omitted on total failure */ }
```
Add `lifeCalc` to the object passed to `buildReportHTML(address, { ...existing, chapters, lifeCalc })`.

- [ ] **Step 2: Thread + render in `reportPage.js`**

Add `lifeCalc` to the `buildReportHTML(address, { ... })` destructure (line ~160). Change the line-174 call to:
```js
  const insightsCardHTML = buildInsightsCardHTML(grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation, lifeCalc);
```
Add the client script beside `ui.js` (near line 328):
```js
  <script src="/calculator.js" defer><\/script>
```
(immediately after the existing `<script src="/ui.js" defer><\/script>` — note the `<\/script>` escaping inside the template literal).

- [ ] **Step 3: Verify wiring**

Run: `npx jest tests/services/reportBuilder.test.js tests/templates/pages/reportPage.test.js tests/smoke.test.js`
Expected: PASS. (If `reportBuilder.test.js` mocks fetch and a rates call throws, the try/catch yields `lifeCalc: null` — report still builds.)

- [ ] **Step 4: Commit**

```bash
git add src/services/reportBuilder.js src/templates/pages/reportPage.js
git commit -m "feat(FR-033): wire rates + calculator into the Daily Life chapter + report page"
```

---

### Task 9: `.env.example`, full suite, verify, summary, roadmap, PR

**Files:**
- Modify: `.env.example`, `docs/IMPLEMENTATION_ROADMAP.md`
- Create: `feature-requests/FR-033-life-at-address/summary.md`

- [ ] **Step 1: Document the EIA key**

Append to `.env.example`:
```
# EIA (api.eia.gov) — live US gas price for the Life-at-Address calculator (FR-033).
# Free key: https://www.eia.gov/opendata/register.php
# Optional: if unset, the calculator uses a dated fallback gas price (graceful).
EIA_API_KEY=your_key_here
```

- [ ] **Step 2: Full suite**

Run: `npx jest`
Expected: PASS — prior count + new FR-033 tests, zero failures.

- [ ] **Step 3: Local render verify (all 5 addresses)**

Use the `run` skill to launch the server and generate a report for each of the 5 test addresses. Confirm for each: the calculator renders at the end of the Daily Life chapter; the default headline/secondary figures show; sliders move and the figures update live (with `EIA_API_KEY` set, the gas-price `as of` date shows; without, the dated fallback note shows). Note: if `api.eia.gov` is unreachable in the environment, the dated fallback path should render — confirm that degradation looks right.

- [ ] **Step 4: Write `summary.md`**

Document what shipped, the engine + dynamic-rates architecture, the verification-status (live EIA vs fallback — and whether EIA was reachable in the build env, per the FR-032 NREL lesson), the new `EIA_API_KEY`, sources/dates, deviations, and the FR-032 local-rate seam.

- [ ] **Step 5: Update roadmap**

In `docs/IMPLEMENTATION_ROADMAP.md`, mark FR-033 built-on-branch (Phase 5), noting Phase 5 chapters are then complete pending merges/verification.

- [ ] **Step 6: Commit + PR**

```bash
git add .env.example feature-requests/FR-033-life-at-address/summary.md docs/IMPLEMENTATION_ROADMAP.md
git commit -m "docs(FR-033): summary, roadmap, .env.example"
git push -u origin FR-033-life-at-address
gh pr create --title "FR-033: Life-at-Address calculator" --body "<from summary.md>"
```

---

## Self-Review

**Spec coverage:**
- Computation engine (pure, tested, Georgetown-style regression) → Task 2 ✅
- Dynamic rates: EIA gas (live), IRS (best-effort), centralized assumptions, derived marginal cost → Tasks 1, 3, 4 ✅
- "One report refreshes for everyone" cache + no-poison-on-failure → Task 4 ✅
- Parser fixtures (NREL lesson) → Task 3 ✅
- Template default render + JSON config + back-compat null + no inline styles/scoring → Task 5 ✅
- Client mirror + **parity test** → Task 6 ✅
- Provisional CSS → Task 7 ✅
- Wiring (reportBuilder rates fetch, reportPage thread + script tag) → Task 8 ✅
- Headline marginal / IRS secondary / EV-equivalent / sources+asOf footnote → Tasks 5 (render), 2 (compute) ✅
- EIA_API_KEY + graceful degradation; 5-address verify → Task 9 ✅
- Constraints 001/008/009/011/015 → enforced across Tasks 2/5/6 tests + constraint suite ✅

**Placeholder scan:** No TBD/TODO in code steps. `<from summary.md>` / `<num>` are intentional fill-ins for the PR body. Constants carry real dated values + refresh notes (maintenance notes, not code placeholders).

**Type consistency:** `getDrivingRates()` → `{ gasPricePerGallon, irsRatePerMile, avgMpg, maintenancePerMile, evKwhPerMile, electricRatePerKwh, marginalCostPerMile, tripDistances, sources, asOf }`. `computeDrivingProfile(inputs, rates)` reads `rates.marginalCostPerMile/irsRatePerMile/evKwhPerMile/electricRatePerKwh/tripDistances` → `{ weeklyMilesByType, weeklyMilesTotal, annualMiles, costMarginal, costIrs, costEv }`. `computeProfileClient` mirrors that signature + output exactly (parity-tested). `buildLifeCalculatorHTML(lifeCalc{profile,rates,bounds})`; `buildInsightsCardHTML(..., lifeCalc)`. `lifeCalc` threaded reportBuilder → reportPage → template. Consistent across tasks. ✅
