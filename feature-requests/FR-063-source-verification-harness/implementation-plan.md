# FR-063 Source-Verification Harness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone `npm run verify:sources` monitor that proves each live external data source returns real data for the 5 test addresses, with monitor-grade resilience (flap tolerance, per-provider concurrency, cache bypass) and a scheduled CI workflow that alerts on failure.

**Architecture:** A thin harness (`scripts/verify-sources.js`) composes four pure, independently-tested libs (`verdict`, `evaluateCell`, `pool`, `discoverSources`) plus a context resolver. Each `src/modules/*/data.js` self-describes its external sources via an exported `SOURCES` array the harness auto-discovers. Verdict logic is pure and Jest-tested with mocks; no live calls run inside Jest.

**Tech Stack:** Node.js (CommonJS), Jest, native `fetch`/`AbortSignal`, GitHub Actions (`actions/github-script` for issue alerting). No new runtime dependencies.

---

## File Structure

**New files:**
- `scripts/verify-sources.js` — entrypoint: wires resolve → discover → pool → evaluate → verdict → render → exit.
- `scripts/lib/verdict.js` — pure: per-source verdict from coverage policy + exit-code aggregation.
- `scripts/lib/evaluateCell.js` — one source × one address, with flap tolerance + rate-limit classification.
- `scripts/lib/pool.js` — per-provider bounded-concurrency runner.
- `scripts/lib/discoverSources.js` — globs modules, collects `SOURCES`.
- `scripts/lib/resolveContext.js` — geocode/reverse-geocode/FIPS → per-address `ctx`.
- `scripts/lib/render.js` — matrix + summary string; `--json` object.
- `scripts/lib/testAddresses.js` — the 5 canonical addresses.
- `tests/verify-sources.test.js` — Jest unit tests (mocked; no live calls).
- `.github/workflows/verify-sources.yml` — scheduled + manual workflow with issue alerting.

**Modified files:**
- `src/cache.js` — honor `LIVABLY_VERIFY=1` (bypass reads + writes).
- `src/modules/*/data.js` (×14) — add `SOURCES` export.
- `src/modules/climate/data.js` — also export `WBD_BASE` (probe reuses it; no drift).
- `package.json` — add `verify:sources` script.
- `docs/IMPLEMENTATION_ROADMAP.md` — mark Track A #2 (FR-063) done.

**Deliverable docs:**
- `feature-requests/FR-063-source-verification-harness/sources-inventory.md` — the catalogued source list (Task 6).
- `feature-requests/FR-063-source-verification-harness/summary.md` — Phase 4 summary (final task).

---

## Task 1: Cache bypass via `LIVABLY_VERIFY`

**Files:**
- Modify: `src/cache.js:23-43` (the `get` and `set` methods)
- Test: `tests/cache.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/cache.test.js`:

```js
describe('LIVABLY_VERIFY cache bypass', () => {
  const { Cache } = require('../src/cache');
  afterEach(() => { delete process.env.LIVABLY_VERIFY; });

  test('get returns null and set is a no-op when LIVABLY_VERIFY=1', () => {
    const c = new Cache('verifytest', 3600);
    process.env.LIVABLY_VERIFY = '1';
    c.set('k', { v: 1 });        // no-op
    expect(c.get('k')).toBeNull(); // bypassed read
    delete process.env.LIVABLY_VERIFY;
    expect(c.get('k')).toBeNull(); // confirms nothing was written
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/cache.test.js -t "cache bypass"`
Expected: FAIL (set writes a value, so the second get returns `{v:1}` not null).

- [ ] **Step 3: Implement the bypass**

In `src/cache.js`, add as the first line inside `get(key)`:

```js
  get(key) {
    if (process.env.LIVABLY_VERIFY === '1') return null;
    const file = this._filePath(key);
```

And as the first line inside `set(key, value)`:

```js
  set(key, value) {
    if (process.env.LIVABLY_VERIFY === '1') return;
    const file = this._filePath(key);
```

- [ ] **Step 4: Run tests**

Run: `npx jest tests/cache.test.js`
Expected: PASS (all cache tests).

- [ ] **Step 5: Commit**

```bash
git add src/cache.js tests/cache.test.js
git commit -m "FR-063: cache bypass via LIVABLY_VERIFY for live verification"
```

---

## Task 2: Verdict engine (`scripts/lib/verdict.js`)

**Files:**
- Create: `scripts/lib/verdict.js`
- Test: `tests/verify-sources.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/verify-sources.test.js`:

```js
'use strict';
const { computeSourceVerdict, computeExitCode } = require('../scripts/lib/verdict');

const cells = (...outcomes) => outcomes.map((outcome) => ({ outcome }));

describe('computeSourceVerdict', () => {
  test("coverage 'all' dead-at-one → FAIL", () => {
    expect(computeSourceVerdict('all', cells('OK', 'FAIL', 'OK'))).toBe('FAIL');
  });
  test("coverage 'all' all-OK → PASS", () => {
    expect(computeSourceVerdict('all', cells('OK', 'OK'))).toBe('PASS');
  });
  test("coverage 'some' dead-at-all → FAIL", () => {
    expect(computeSourceVerdict('some', cells('FAIL', 'FAIL'))).toBe('FAIL');
  });
  test("coverage 'some' partial → INFO", () => {
    expect(computeSourceVerdict('some', cells('OK', 'FAIL'))).toBe('INFO');
  });
  test("coverage 'some' all-OK → PASS", () => {
    expect(computeSourceVerdict('some', cells('OK', 'OK'))).toBe('PASS');
  });
  test('all cells skipped → SKIPPED', () => {
    expect(computeSourceVerdict('all', cells('SKIPPED', 'SKIPPED'))).toBe('SKIPPED');
  });
  test('skipped cells excluded from denominator', () => {
    expect(computeSourceVerdict('all', cells('SKIPPED', 'OK'))).toBe('PASS');
  });
});

describe('computeExitCode', () => {
  test('1 when any verdict is FAIL', () => {
    expect(computeExitCode(['PASS', 'INFO', 'FAIL'])).toBe(1);
  });
  test('0 when no FAIL', () => {
    expect(computeExitCode(['PASS', 'INFO', 'SKIPPED'])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/verify-sources.test.js -t computeSourceVerdict`
Expected: FAIL with "Cannot find module '../scripts/lib/verdict'".

- [ ] **Step 3: Implement**

Create `scripts/lib/verdict.js`:

```js
'use strict';

// cells: array of { outcome: 'OK' | 'FAIL' | 'SKIPPED' }
// coverage: 'all' | 'some'
function computeSourceVerdict(coverage, cells) {
  const active = cells.filter((c) => c.outcome !== 'SKIPPED');
  if (active.length === 0) return 'SKIPPED';
  const fails = active.filter((c) => c.outcome === 'FAIL').length;
  if (coverage === 'all') return fails > 0 ? 'FAIL' : 'PASS';
  // coverage 'some'
  if (fails === active.length) return 'FAIL';
  if (fails > 0) return 'INFO';
  return 'PASS';
}

function computeExitCode(verdicts) {
  return verdicts.some((v) => v === 'FAIL') ? 1 : 0;
}

module.exports = { computeSourceVerdict, computeExitCode };
```

- [ ] **Step 4: Run tests**

Run: `npx jest tests/verify-sources.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/verdict.js tests/verify-sources.test.js
git commit -m "FR-063: verdict engine (coverage policy + exit code)"
```

---

## Task 3: Cell evaluator with flap tolerance (`scripts/lib/evaluateCell.js`)

**Files:**
- Create: `scripts/lib/evaluateCell.js`
- Test: `tests/verify-sources.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/verify-sources.test.js`:

```js
const { evaluateCell } = require('../scripts/lib/evaluateCell');
const noSleep = { sleep: async () => {} };
const ctx = { address: 'x', lat: 1, lng: 2, state: 'KY', county: 'X County', fips: null };

describe('evaluateCell', () => {
  afterEach(() => { delete process.env.SOME_KEY; });

  test('deferred → SKIPPED(deferred)', async () => {
    const r = await evaluateCell({ status: 'deferred', run: async () => 1, isValid: () => true }, ctx, noSleep);
    expect(r).toEqual({ outcome: 'SKIPPED', reason: 'deferred' });
  });

  test('missing required key → SKIPPED(no key)', async () => {
    const r = await evaluateCell({ requiresKey: 'SOME_KEY', run: async () => 1, isValid: () => true }, ctx, noSleep);
    expect(r).toEqual({ outcome: 'SKIPPED', reason: 'no key' });
  });

  test('valid result → OK', async () => {
    const r = await evaluateCell({ run: async () => [1], isValid: (x) => x.length === 1 }, ctx, noSleep);
    expect(r.outcome).toBe('OK');
  });

  test('invalid on both attempts → FAIL', async () => {
    const r = await evaluateCell({ run: async () => null, isValid: () => false }, ctx, noSleep);
    expect(r.outcome).toBe('FAIL');
  });

  test('transient throw then success on retry → OK', async () => {
    let n = 0;
    const r = await evaluateCell({
      run: async () => { if (n++ === 0) throw new Error('blip'); return [1]; },
      isValid: (x) => Array.isArray(x),
    }, ctx, noSleep);
    expect(r.outcome).toBe('OK');
  });

  test('429 on both attempts → SKIPPED(rate-limited)', async () => {
    const r = await evaluateCell({
      run: async () => { throw new Error('HTTP 429 Too Many Requests'); },
      isValid: () => true,
    }, ctx, noSleep);
    expect(r).toEqual({ outcome: 'SKIPPED', reason: 'rate-limited' });
  });

  test('probe unreachable but payload empty → FAIL', async () => {
    const r = await evaluateCell({
      probe: async () => 503,
      run: async () => [],
      isValid: (x) => Array.isArray(x),
    }, ctx, noSleep);
    expect(r.outcome).toBe('FAIL');
  });

  test('probe reachable + valid → OK', async () => {
    const r = await evaluateCell({
      probe: async () => 200,
      run: async () => [],
      isValid: (x) => Array.isArray(x),
    }, ctx, noSleep);
    expect(r.outcome).toBe('OK');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/verify-sources.test.js -t evaluateCell`
Expected: FAIL with "Cannot find module '../scripts/lib/evaluateCell'".

- [ ] **Step 3: Implement**

Create `scripts/lib/evaluateCell.js`:

```js
'use strict';

function isBlank(v) { return v == null || String(v).trim() === ''; }
const isRateLimit = (msg) => /\b429\b|rate.?limit/i.test(String(msg || ''));

// One attempt → { outcome: 'OK'|'FAIL'|'RATELIMIT', reason }
async function attempt(source, ctx) {
  if (typeof source.probe === 'function') {
    let status;
    try { status = await source.probe(ctx); }
    catch (e) {
      if (isRateLimit(e.message)) return { outcome: 'RATELIMIT', reason: e.message };
      return { outcome: 'FAIL', reason: `probe threw: ${e.message}` };
    }
    if (status === 429) return { outcome: 'RATELIMIT', reason: 'probe 429' };
    if (!(status >= 200 && status < 400)) return { outcome: 'FAIL', reason: `probe status ${status}` };
  }
  let result;
  try { result = await source.run(ctx); }
  catch (e) {
    if (isRateLimit(e.message)) return { outcome: 'RATELIMIT', reason: e.message };
    return { outcome: 'FAIL', reason: e.message || 'run threw' };
  }
  if (source.isValid(result)) return { outcome: 'OK', reason: '' };
  return { outcome: 'FAIL', reason: 'isValid returned false' };
}

// Full cell evaluation: skip rules → flap tolerance (retry once) → final outcome.
async function evaluateCell(source, ctx, opts = {}) {
  const sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const retryDelayMs = opts.retryDelayMs ?? 500;

  if (source.status === 'deferred') return { outcome: 'SKIPPED', reason: 'deferred' };
  if (source.requiresKey && isBlank(process.env[source.requiresKey])) {
    return { outcome: 'SKIPPED', reason: 'no key' };
  }

  let res = await attempt(source, ctx);
  if (res.outcome === 'OK') return { outcome: 'OK', reason: res.reason };

  await sleep(retryDelayMs);
  res = await attempt(source, ctx);
  if (res.outcome === 'OK') return { outcome: 'OK', reason: res.reason };
  if (res.outcome === 'RATELIMIT') return { outcome: 'SKIPPED', reason: 'rate-limited' };
  return { outcome: 'FAIL', reason: res.reason };
}

module.exports = { evaluateCell, attempt };
```

- [ ] **Step 4: Run tests**

Run: `npx jest tests/verify-sources.test.js -t evaluateCell`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/evaluateCell.js tests/verify-sources.test.js
git commit -m "FR-063: cell evaluator with flap tolerance + rate-limit classification"
```

---

## Task 4: Per-provider concurrency pool (`scripts/lib/pool.js`)

**Files:**
- Create: `scripts/lib/pool.js`
- Test: `tests/verify-sources.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/verify-sources.test.js`:

```js
const { runWithProviderLimit } = require('../scripts/lib/pool');

describe('runWithProviderLimit', () => {
  test('never exceeds the per-provider concurrency cap', async () => {
    let active = 0, peak = 0;
    const make = (provider) => ({
      provider,
      run: async () => {
        active++; peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--; return provider;
      },
    });
    const tasks = Array.from({ length: 6 }, () => make('google'));
    const results = await runWithProviderLimit(tasks, 2);
    expect(results).toHaveLength(6);
    expect(peak).toBeLessThanOrEqual(2);
  });

  test('different providers run concurrently and results keep input order', async () => {
    const order = [];
    const tasks = [
      { provider: 'a', run: async () => { order.push('a'); return 'a'; } },
      { provider: 'b', run: async () => { order.push('b'); return 'b'; } },
    ];
    const results = await runWithProviderLimit(tasks, 1);
    expect(results).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/verify-sources.test.js -t runWithProviderLimit`
Expected: FAIL with "Cannot find module '../scripts/lib/pool'".

- [ ] **Step 3: Implement**

Create `scripts/lib/pool.js`:

```js
'use strict';

// tasks: array of { provider: string, run: () => Promise<any> }
// Runs all providers in parallel, but caps concurrent calls *within* each
// provider at `limitPerProvider`. Returns results in the original task order.
async function runWithProviderLimit(tasks, limitPerProvider = 2) {
  const results = new Array(tasks.length);
  const byProvider = new Map();
  tasks.forEach((t, i) => {
    if (!byProvider.has(t.provider)) byProvider.set(t.provider, []);
    byProvider.get(t.provider).push(i);
  });

  const runners = [];
  for (const indices of byProvider.values()) {
    let cursor = 0;
    const worker = async () => {
      while (cursor < indices.length) {
        const idx = indices[cursor++];
        results[idx] = await tasks[idx].run();
      }
    };
    const workers = Math.min(limitPerProvider, indices.length);
    for (let k = 0; k < workers; k++) runners.push(worker());
  }
  await Promise.all(runners);
  return results;
}

module.exports = { runWithProviderLimit };
```

- [ ] **Step 4: Run tests**

Run: `npx jest tests/verify-sources.test.js -t runWithProviderLimit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/pool.js tests/verify-sources.test.js
git commit -m "FR-063: per-provider bounded-concurrency pool"
```

---

## Task 5: Discovery + test addresses + context resolver

**Files:**
- Create: `scripts/lib/discoverSources.js`, `scripts/lib/testAddresses.js`, `scripts/lib/resolveContext.js`
- Test: `tests/verify-sources.test.js` (append — discovery only; resolver is live and untested in Jest)

- [ ] **Step 1: Write the failing test (discovery)**

Append to `tests/verify-sources.test.js`:

```js
const path = require('path');
const { discoverSources } = require('../scripts/lib/discoverSources');

describe('discoverSources', () => {
  test('collects SOURCES from every module that exports them', () => {
    const dir = path.join(__dirname, '..', 'src', 'modules');
    const logger = { warn: () => {} };
    const sources = discoverSources(dir, logger);
    expect(Array.isArray(sources)).toBe(true);
    // Every discovered source carries its owning module name.
    for (const s of sources) expect(typeof s.module).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/verify-sources.test.js -t discoverSources`
Expected: FAIL with "Cannot find module '../scripts/lib/discoverSources'".

- [ ] **Step 3: Implement discovery**

Create `scripts/lib/discoverSources.js`:

```js
'use strict';
const fs = require('fs');
const path = require('path');

// Globs src/modules/<name>/data.js, requires each, flattens its SOURCES array
// (tagging each entry with its module). Modules without SOURCES are warned, not fatal.
function discoverSources(modulesDir, logger = console) {
  const out = [];
  for (const name of fs.readdirSync(modulesDir)) {
    const dataPath = path.join(modulesDir, name, 'data.js');
    if (!fs.existsSync(dataPath)) continue;
    const mod = require(dataPath);
    if (!Array.isArray(mod.SOURCES)) {
      logger.warn(`[verify] ${name}/data.js exports no SOURCES — skipped`);
      continue;
    }
    for (const s of mod.SOURCES) out.push({ module: name, ...s });
  }
  return out;
}

module.exports = { discoverSources };
```

- [ ] **Step 4: Implement test addresses**

Create `scripts/lib/testAddresses.js`:

```js
'use strict';
// The 5 canonical test addresses (CLAUDE.md). Jeffersonville IN is the PM-001
// border-city regression case.
module.exports = [
  '100 Wishing Well Path Unit 2306, Georgetown, KY 40324',
  '456 Rural Route 1, Harlan, KY 40831',
  '123 Main St, Louisville, KY 40202',
  '789 Main St, Bozeman, MT 59715',
  '1007 Stonelilly Dr, Jeffersonville, IN 47130',
];
```

- [ ] **Step 5: Implement context resolver**

Create `scripts/lib/resolveContext.js`:

```js
'use strict';
const { geocodeAddress } = require('../../src/shared/google/geocoding');
const { reverseGeocodeAddress } = require('../../src/shared/google/reverseGeocode');
const { getCensusFIPS } = require('../../src/shared/census');

// Resolve one address → ctx. Geocoding is the floor: if it fails the address is
// unusable and returned with an `error` so the harness can exclude it.
async function resolveContext(address) {
  let loc;
  try {
    loc = await geocodeAddress(address);
  } catch (e) {
    return { address, error: e.message || 'geocode failed' };
  }
  const { lat, lng } = loc;
  const info = await reverseGeocodeAddress({ lat, lng });
  const fips = await getCensusFIPS(lat, lng);
  return { address, lat, lng, state: info.state, county: info.county, fips };
}

async function resolveContexts(addresses) {
  return Promise.all(addresses.map(resolveContext));
}

module.exports = { resolveContext, resolveContexts };
```

- [ ] **Step 6: Run tests**

Run: `npx jest tests/verify-sources.test.js -t discoverSources`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/discoverSources.js scripts/lib/testAddresses.js scripts/lib/resolveContext.js tests/verify-sources.test.js
git commit -m "FR-063: source discovery, test addresses, context resolver"
```

---

## Task 6: Source inventory (read-only catalogue)

This task produces the authoritative list that drives Tasks 7–8. No code.

**Files:**
- Create: `feature-requests/FR-063-source-verification-harness/sources-inventory.md`

- [ ] **Step 1: Inventory every external endpoint**

For each `src/modules/<name>/data.js`, read the file and record one row per
**live external HTTP call** in a table with columns:

`module · id · provider · fetcher fn · call signature · failure value · legitimate-empty? · valid shape · requiresKey · coverage · probe needed?`

Rules for filling it:
- **provider**: the upstream host's quota domain — `google`, `noaa`, `census`, `usgs`, `fema`, `nrel`, `eia`, `airnow`, `opencharge`.
- **legitimate-empty? = yes** when the fetcher returns the *same* value for "no data" and "error" (e.g. `return []` in both branches). These are **swallow-to-empty** → **probe needed = yes**.
- **coverage = all** when a healthy source must return data for every US address (e.g. elevation, climate normals, seismic); **coverage = some** when emptiness is legitimate for some addresses (e.g. FEMA declarations, named watershed).
- **Exclude** calls that are not live external HTTP at runtime. Note them in an "Excluded" list with the reason. Known case: climate `getNOAAStormEvents` returns `[]` immediately (NOAA CDO has no narratives) or reads a *local* pre-cached file — it makes no live external call, so it is **excluded**.
- **requiresKey**: the env var from `src/config.js` OPTIONAL map, if the fetcher needs one (`NOAA_CDO_API_KEY`, `NREL_API_KEY`, `EIA_API_KEY`, `CENSUS_API_KEY`, `AIRNOW_API_KEY`, `OPENCHARGEMAP_API_KEY`); blank if none.

- [ ] **Step 2: Note URL-constant locations for probes**

For every `probe needed = yes` row, record which `constants.js` export holds the
endpoint URL (e.g. `FEMA_DECLARATIONS_URL`). Flag any source whose URL is
**hardcoded inside the module** rather than in constants — those need the constant
exported before a probe can reuse it. Known case: climate's `WBD_BASE` is a
module-local const (`src/modules/climate/data.js`), so Task 7 exports it.

- [ ] **Step 3: Commit**

```bash
git add feature-requests/FR-063-source-verification-harness/sources-inventory.md
git commit -m "FR-063: external source inventory across all 14 modules"
```

---

## Task 7: SOURCES descriptors — climate exemplar first, then all modules

The climate descriptor is fully worked below as the **canonical pattern**. Every
other module follows it exactly, using the inventory from Task 6. The structural
test (Task 8) is the enforcing gate — no module is "done" until it passes.

**Files:**
- Modify: `src/modules/climate/data.js` (exemplar — full code below)
- Modify: the other 13 `src/modules/*/data.js` (follow the pattern, inventory-driven)

### 7a — Climate exemplar (complete code)

- [ ] **Step 1: Export `WBD_BASE` so its probe reuses it (no drift)**

In `src/modules/climate/data.js`, the watershed base URL is a module-local const
(`const WBD_BASE = 'https://hydro.nationalmap.gov/...'`). Add it to the module's
exports so the descriptor's probe builds its URL from the same value:

```js
module.exports = {
  // ...existing exports...
  WBD_BASE,
  SOURCES,
};
```

- [ ] **Step 2: Add the `SOURCES` array**

Add near the bottom of `src/modules/climate/data.js`, **before** `module.exports`.
`require` the needed constants at the top if not already imported
(`FEMA_DECLARATIONS_URL` and `WBD_BASE` are already in scope in this file):

```js
// FR-063: source-verification descriptors. coverage 'all' = must work for every
// address; 'some' = legitimately empty for some. probe() returns an HTTP status
// (0 = network error) and is required for swallow-to-empty sources whose isValid
// can't tell a dead endpoint from genuine emptiness.
const SOURCES = [
  {
    id: 'noaa-normals',
    label: 'NOAA CDO 30-yr normals',
    provider: 'noaa',
    coverage: 'all',
    requiresKey: 'NOAA_CDO_API_KEY',
    run: (ctx) => getNOAAClimateNormals(ctx.lat, ctx.lng),
    isValid: (r) => Array.isArray(r?.monthly) && r.monthly.length === 12,
  },
  {
    id: 'fema-declarations',
    label: 'FEMA disaster declarations',
    provider: 'fema',
    coverage: 'some',
    run: (ctx) => getFEMADeclarations(ctx.state, ctx.county),
    isValid: (r) => Array.isArray(r),
    // swallow-to-empty: [] returned for both "no declarations" and errors → probe.
    probe: async () => {
      const resp = await fetch(`${FEMA_DECLARATIONS_URL}?$top=1&$format=json`, {
        signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' },
      });
      return resp.status;
    },
  },
  {
    id: 'usgs-elevation',
    label: 'USGS elevation (watershed context)',
    provider: 'usgs',
    coverage: 'all',
    run: (ctx) => getWatershedContext(ctx.lat, ctx.lng),
    isValid: (r) => Array.isArray(r?.elevations) && r.elevations.length > 0,
  },
  {
    id: 'usgs-watershed',
    label: 'USGS WBD named watershed',
    provider: 'usgs',
    coverage: 'some',
    run: (ctx) => getNamedWatershed(ctx.lat, ctx.lng),
    isValid: (r) => typeof r?.huc12Name === 'string',
    // null returned for both "no HUC-12 here" and errors → probe.
    probe: async (ctx) => {
      const params = new URLSearchParams({
        geometry: `${ctx.lng},${ctx.lat}`, geometryType: 'esriGeometryPoint',
        inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'name',
        returnGeometry: 'false', f: 'json',
      });
      const resp = await fetch(`${WBD_BASE}/6/query?${params}`, { signal: AbortSignal.timeout(8000) });
      return resp.status;
    },
  },
  {
    id: 'usgs-seismic',
    label: 'USGS ASCE seismic design',
    provider: 'usgs',
    coverage: 'all',
    run: (ctx) => getSeismicHazard(ctx.lat, ctx.lng),
    isValid: (r) => typeof r?.pga === 'number',
  },
];
```

> Note: `getNOAAStormEvents` is intentionally **not** a source — it makes no live
> external call (returns `[]` immediately or reads a local pre-cache file). See the
> Excluded list in `sources-inventory.md`.

- [ ] **Step 3: Verify climate descriptors run live**

Run (requires `GOOGLE_MAPS_API_KEY` + `NOAA_CDO_API_KEY` in `.env`):
`npm run verify:sources` *(available after Task 9 — if running this task first, defer this step to after Task 9)*
Expected: the 5 climate rows render OK/`--` with no thrown errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/climate/data.js
git commit -m "FR-063: climate SOURCES descriptors (exemplar)"
```

### 7b — Remaining 13 modules

For **each** of `access, community, garden, growth, health, property, reachability,
recreation, safety, schools, sensory, utilities, walkability`:

- [ ] **Step 1: Add the module's `SOURCES`** following the climate pattern exactly,
  using its rows from `sources-inventory.md`:
  - one entry per live external endpoint (its `run` calls the module's existing
    fetcher with `ctx`-mapped args),
  - `provider` from the inventory,
  - `requiresKey` where the inventory says so,
  - `coverage` from the inventory,
  - `isValid` asserting the real shape the fetcher returns on success,
  - `probe` (building its URL from `constants.js`) for every swallow-to-empty row,
  - `status: 'deferred'` for FCC broadband in `utilities` (FR-062 — no BDC token),
  - add `SOURCES` to the module's `module.exports`.
- [ ] **Step 2: Run** `npx jest tests/verify-sources.test.js -t "every module"`
  (the structural test from Task 8) until the module passes.
- [ ] **Step 3: Commit** per module:

```bash
git add src/modules/<name>/data.js
git commit -m "FR-063: <name> SOURCES descriptors"
```

---

## Task 8: Structural contract test

Guarantees every descriptor is well-formed regardless of which module added it.

**Files:**
- Test: `tests/verify-sources.test.js` (append)

- [ ] **Step 1: Write the test**

Append to `tests/verify-sources.test.js`:

```js
describe('SOURCES contract (every module)', () => {
  const dir = path.join(__dirname, '..', 'src', 'modules');
  const all = discoverSources(dir, { warn: () => {} });

  test('at least one module exports SOURCES', () => {
    expect(all.length).toBeGreaterThan(0);
  });

  test.each(all.map((s) => [`${s.module}/${s.id}`, s]))('descriptor %s is well-formed', (_label, s) => {
    expect(typeof s.id).toBe('string');
    expect(typeof s.label).toBe('string');
    expect(typeof s.provider).toBe('string');
    expect(['all', 'some']).toContain(s.coverage);
    expect(typeof s.run).toBe('function');
    expect(typeof s.isValid).toBe('function');
    if (s.probe !== undefined) expect(typeof s.probe).toBe('function');
    if (s.status !== undefined) expect(['active', 'deferred']).toContain(s.status);
    if (s.requiresKey !== undefined) expect(typeof s.requiresKey).toBe('string');
  });

  test('source ids are unique within each module', () => {
    const byModule = {};
    for (const s of all) (byModule[s.module] ||= []).push(s.id);
    for (const [mod, ids] of Object.entries(byModule)) {
      expect(new Set(ids).size, `duplicate id in ${mod}`).toBe(ids.length);
    }
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx jest tests/verify-sources.test.js`
Expected: PASS once Task 7 descriptors are in. (FAILs name the offending `module/id`.)

- [ ] **Step 3: Commit**

```bash
git add tests/verify-sources.test.js
git commit -m "FR-063: structural contract test for SOURCES descriptors"
```

---

## Task 9: Renderer + harness entrypoint + npm script

**Files:**
- Create: `scripts/lib/render.js`, `scripts/verify-sources.js`
- Modify: `package.json`

- [ ] **Step 1: Implement the renderer**

Create `scripts/lib/render.js`:

```js
'use strict';
const SHORT = (addr) => addr.split(',')[1]?.trim().slice(0, 4).toUpperCase() || addr.slice(0, 4);

// rows: [{ module, id, verdict, cells: [{ outcome, reason }] }]
// contexts: [{ address, error? }]
function renderMatrix(rows, contexts) {
  const usable = contexts.filter((c) => !c.error);
  const headers = usable.map((c) => SHORT(c.address).padEnd(5));
  const sym = (o) => (o === 'OK' ? 'OK  ' : o === 'FAIL' ? 'FAIL' : '--  ');
  const lines = [];
  lines.push(`${'SOURCE (module)'.padEnd(30)} ${headers.join(' ')}  VERDICT`);
  for (const r of rows) {
    const cells = r.cells.map((c) => sym(c.outcome)).join(' ');
    lines.push(`${`${r.id} (${r.module})`.padEnd(30)} ${cells}  ${r.verdict}`);
  }
  // failing-cell reasons
  const reasons = [];
  for (const r of rows) {
    r.cells.forEach((c, i) => {
      if (c.outcome === 'FAIL') reasons.push(`  ${r.module}/${r.id} @ ${SHORT(usable[i].address)}: ${c.reason}`);
    });
  }
  const tally = (v) => rows.filter((r) => r.verdict === v).length;
  lines.push('');
  lines.push(`${tally('FAIL')} FAIL · ${tally('INFO')} INFO · ${tally('PASS')} PASS · ${tally('SKIPPED')} SKIPPED`);
  for (const c of contexts.filter((c) => c.error)) lines.push(`! geocode failed: ${c.address} — ${c.error}`);
  if (reasons.length) { lines.push('', 'Failures:', ...reasons); }
  return lines.join('\n');
}

module.exports = { renderMatrix };
```

- [ ] **Step 2: Implement the entrypoint**

Create `scripts/verify-sources.js`:

```js
'use strict';
// Live verification: bypass caches BEFORE anything loads the cache module.
process.env.LIVABLY_VERIFY = '1';
require('dotenv').config();

const path = require('path');
const TEST_ADDRESSES = require('./lib/testAddresses');
const { resolveContexts } = require('./lib/resolveContext');
const { discoverSources } = require('./lib/discoverSources');
const { evaluateCell } = require('./lib/evaluateCell');
const { runWithProviderLimit } = require('./lib/pool');
const { computeSourceVerdict, computeExitCode } = require('./lib/verdict');
const { renderMatrix } = require('./lib/render');

const PROVIDER_LIMIT = 2;

async function main() {
  const asJson = process.argv.includes('--json');
  const contexts = await resolveContexts(TEST_ADDRESSES);
  const usable = contexts.filter((c) => !c.error);
  if (usable.length === 0) {
    console.error('All addresses failed to geocode — cannot verify sources.');
    process.exit(1);
  }

  const sources = discoverSources(path.join(__dirname, '..', 'src', 'modules'));

  // Build one task per (source × usable ctx), tagged by provider for the pool.
  const tasks = [];
  const index = []; // parallel: { sourceIdx, ctxIdx }
  sources.forEach((s, si) => {
    usable.forEach((ctx, ci) => {
      tasks.push({ provider: s.provider || s.module, run: () => evaluateCell(s, ctx) });
      index.push({ si, ci });
    });
  });

  const cellResults = await runWithProviderLimit(tasks, PROVIDER_LIMIT);

  // Regroup flat results back into per-source cell arrays (ctx order preserved).
  const rows = sources.map((s, si) => {
    const cells = usable.map((_, ci) => {
      const flat = index.findIndex((x) => x.si === si && x.ci === ci);
      return cellResults[flat];
    });
    return { module: s.module, id: s.id, verdict: computeSourceVerdict(s.coverage, cells), cells };
  });

  const exitCode = computeExitCode(rows.map((r) => r.verdict));

  if (asJson) {
    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      addresses: contexts.map((c) => ({ address: c.address, error: c.error || null })),
      sources: rows,
      exitCode,
    }, null, 2));
  } else {
    console.log(renderMatrix(rows, contexts));
  }
  process.exit(exitCode);
}

main().catch((e) => { console.error('verify:sources fatal:', e); process.exit(1); });
```

- [ ] **Step 3: Add the npm script**

In `package.json` `scripts`, add:

```json
    "verify:sources": "node scripts/verify-sources.js",
```

- [ ] **Step 4: Smoke-run locally**

Run: `npm run verify:sources`
Expected: a matrix prints; exit 0 if all live sources are healthy (or `--` where
keys/secrets are absent locally). Confirm no unhandled rejections.

- [ ] **Step 5: Confirm Jest still excludes the harness (no live calls in CI test)**

Run: `npm test`
Expected: full suite PASSES; `scripts/` is not matched by `testMatch` (only
`**/tests/**/*.test.js`), so no live calls run in Jest.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/render.js scripts/verify-sources.js package.json
git commit -m "FR-063: verify:sources harness entrypoint + renderer + npm script"
```

---

## Task 10: Scheduled CI workflow with issue alerting

**Files:**
- Create: `.github/workflows/verify-sources.yml`

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/verify-sources.yml`:

```yaml
name: Source Health

on:
  schedule:
    - cron: '0 6 * * 1'   # Mondays 06:00 UTC
  workflow_dispatch:

permissions:
  contents: read
  issues: write

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20.x, cache: npm }
      - run: npm ci

      - name: Run source verification
        id: verify
        run: |
          set +e   # don't let bash -e abort before we capture the exit code
          npm run verify:sources -- --json > source-health.json
          echo "exit=$?" >> "$GITHUB_OUTPUT"
        env:
          GOOGLE_MAPS_API_KEY: ${{ secrets.GOOGLE_MAPS_API_KEY }}
          NOAA_CDO_API_KEY:    ${{ secrets.NOAA_CDO_API_KEY }}
          NREL_API_KEY:        ${{ secrets.NREL_API_KEY }}
          EIA_API_KEY:         ${{ secrets.EIA_API_KEY }}
          CENSUS_API_KEY:      ${{ secrets.CENSUS_API_KEY }}
          AIRNOW_API_KEY:      ${{ secrets.AIRNOW_API_KEY }}
          OPENCHARGEMAP_API_KEY: ${{ secrets.OPENCHARGEMAP_API_KEY }}

      - uses: actions/upload-artifact@v4
        with: { name: source-health, path: source-health.json }

      - name: Open/update or resolve the source-health issue
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('source-health.json', 'utf8'));
            const failed = report.sources.filter(s => s.verdict === 'FAIL');
            const TITLE = 'Source health: dead data source(s) detected';
            const { owner, repo } = context.repo;
            const existing = (await github.rest.issues.listForRepo({
              owner, repo, state: 'open', labels: 'source-health',
            })).data[0];

            if (failed.length === 0) {
              if (existing) {
                await github.rest.issues.createComment({ owner, repo, issue_number: existing.number,
                  body: `✅ Recovered — all sources healthy as of ${report.generatedAt} (run ${context.runId}).` });
                await github.rest.issues.update({ owner, repo, issue_number: existing.number, state: 'closed' });
              }
              return;
            }

            const body = [
              `Source verification FAILED at ${report.generatedAt} (run ${context.runId}).`, '',
              ...failed.map(s => `- **${s.module}/${s.id}** → ${s.verdict}`),
              '', 'See the `source-health` artifact for full per-address detail.',
            ].join('\n');

            if (existing) {
              await github.rest.issues.update({ owner, repo, issue_number: existing.number, body });
            } else {
              await github.rest.issues.create({ owner, repo, title: TITLE, body, labels: ['source-health'] });
            }

      - name: Fail the job if any source FAILed
        if: steps.verify.outputs.exit != '0'
        run: exit 1
```

- [ ] **Step 2: Validate YAML locally**

Run: `node -e "require('js-yaml')" 2>/dev/null || npx --yes js-yaml .github/workflows/verify-sources.yml >/dev/null && echo OK`
Expected: `OK` (well-formed YAML). If `js-yaml` is unavailable, visually confirm
indentation matches `.github/workflows/ci.yml`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/verify-sources.yml
git commit -m "FR-063: scheduled source-health workflow with issue alerting"
```

- [ ] **Step 4: (Human, post-merge) add repo secrets**

In GitHub → Settings → Secrets → Actions, add the keys above so the schedule
verifies real sources. Without them, keyed sources report `SKIPPED (no key)` and
the run stays green — honest, but not yet a full monitor. Trigger once via
**Actions → Source Health → Run workflow** to confirm.

---

## Task 11: Roadmap update + summary

**Files:**
- Modify: `docs/IMPLEMENTATION_ROADMAP.md`
- Create: `feature-requests/FR-063-source-verification-harness/summary.md`

- [ ] **Step 1: Mark Track A #2 done**

In `docs/IMPLEMENTATION_ROADMAP.md`, update the Track A #2 "Source-verification
harness" line to note FR-063 shipped (script + scheduled workflow), and update the
"Where-we-left-off" / sequencing note (next: B1/B2).

- [ ] **Step 2: Write the summary**

Create `feature-requests/FR-063-source-verification-harness/summary.md` covering:
what shipped (files), the descriptor contract, the four monitor-grade properties
(flap tolerance, per-provider concurrency, cache bypass, issue alerting), test
count delta, the known swallow-to-empty-without-probe limitation, and the
post-merge secrets step.

- [ ] **Step 3: Full suite + final commit**

Run: `npm test`
Expected: PASS (includes the new `verify-sources.test.js`).

```bash
git add docs/IMPLEMENTATION_ROADMAP.md feature-requests/FR-063-source-verification-harness/summary.md
git commit -m "FR-063: roadmap update + summary"
```

- [ ] **Step 4: Open the PR**

```bash
git push -u origin FR-063-source-verification-harness
gh pr create --title "FR-063: source-verification harness" --body "<summary + test evidence>"
```

---

## Self-Review Notes

- **Spec coverage:** descriptor model (T7) · standalone script (T9) · coverage verdict (T2) · cadence/workflow (T10) · all-endpoints scope incl. unkeyed (T6/T7) · FCC deferred (T7b) · missing-key SKIPPED (T3) · swallow-to-empty `probe` (T6/T7) · flap tolerance (T3) · per-provider concurrency (T4) · liveness/cache-bypass (T1) + probe-from-constants (T7a) · notification (T10) · tests incl. structural (T8) · pure verdict lib (T2). All 11 acceptance criteria mapped.
- **Provider concurrency note:** the pool bounds *the harness's own* parallelism; a `429` despite this is still classified `SKIPPED (rate-limited)` by T3, never FAIL.
- **Known accepted limitation (carried from spec):** a swallow-to-empty source *without* a probe can read OK while dead. T6 forces a probe on every such row; the structural test can enforce probe *shape* but not the human judgment that a probe was needed — the inventory is the control.
- **Descriptor tasks (7b):** deliberately inventory-driven rather than 13× copied code blocks, because each module's fetcher signatures and success shapes are data that must be read from the actual file. The climate exemplar (full code) + the structural contract test (T8) + the inventory (T6) make this deterministic, not a placeholder.
