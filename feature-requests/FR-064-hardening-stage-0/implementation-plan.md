# FR-064 — Hardening Stage 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close NR-004's four Stage 0 substrate gaps — CI, startup config validation, `/admin/*` auth, and helmet + inbound throttle — without touching the state layer.

**Architecture:** Two new shared modules (`src/config.js`, `src/middleware/adminAuth.js`) plus a rate-limiter module (`src/middleware/rateLimiters.js`), wired into `src/app.js`. One GitHub Actions workflow. Pure, testable units; `app.js` only does wiring. The graceful rate-limit UX already exists (the loading page detects `<meta name="livably-error" content="RATE_LIMIT">` and auto-retries), so the limiter just reuses `buildErrorHTML('RATE_LIMIT', …)`.

**Tech Stack:** Node.js, Express, Jest, `helmet`, `express-rate-limit`, GitHub Actions.

**Key discovery notes for the implementer:**
- `app.js` calls `app.listen` directly and does **not** export `app`. We keep it that way — all new logic lives in separate, directly-unit-testable modules. No `supertest`.
- Inline `<script>` blocks exist in `reportPage.js`, `comparePage.js`, `errorPage.js`, and the loading page dynamically re-executes scripts (`reExecScripts`). A nonce/hash CSP would break the app. **Stage 0 CSP therefore uses `script-src 'unsafe-inline'` deliberately** — a documented compromise, not an oversight. Full inline-script externalization is a future pass.
- `errorPage.js` `buildErrorHTML(type, title, message, address, retryAfter)` sets `<meta name="livably-error" content="${type}">`. Passing `type='RATE_LIMIT'` is what triggers the loading page's existing countdown-retry (errorPage.js:150).

---

## Task 1: CI workflow + engines field

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `package.json` (add `engines`)

- [ ] **Step 1: Add the `engines` field to package.json**

Add a top-level `"engines"` key (place it after `"version"` or near `"scripts"`):

```json
  "engines": {
    "node": ">=20"
  },
```

- [ ] **Step 2: Create the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x, 22.x]
    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
      - run: npm ci
      - run: npm test
```

- [ ] **Step 3: Verify the exact commands CI runs succeed locally**

Run: `npm ci && npm test`
Expected: clean install, full suite passes (1,384 tests + any added in later tasks).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml package.json
git commit -m "ci(FR-064): run jest on push/PR (Node 20+22) + add engines >=20"
```

> Note: the workflow's green/red can only be confirmed on GitHub after push. The local `npm ci && npm test` is the proxy — CI runs the identical commands.

---

## Task 2: Startup config validation module

**Files:**
- Create: `src/config.js`
- Test: `tests/config.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/config.test.js`:

```js
'use strict';
const { validateConfig, ConfigError } = require('../src/config');

function fakeLogger() {
  const warnings = [];
  return { warn: (m) => warnings.push(m), warnings };
}

describe('validateConfig', () => {
  test('throws ConfigError when GOOGLE_MAPS_API_KEY is missing', () => {
    expect(() => validateConfig({}, fakeLogger())).toThrow(ConfigError);
  });

  test('throws ConfigError when GOOGLE_MAPS_API_KEY is blank/whitespace', () => {
    expect(() => validateConfig({ GOOGLE_MAPS_API_KEY: '   ' }, fakeLogger())).toThrow(ConfigError);
  });

  test('warns once per missing optional key and returns config when required present', () => {
    const logger = fakeLogger();
    const cfg = validateConfig({ GOOGLE_MAPS_API_KEY: 'k' }, logger);
    expect(logger.warnings.length).toBe(6); // all 6 optional keys missing
    expect(cfg.googleMapsApiKey).toBe('k');
  });

  test('emits no warnings when all optional keys are set', () => {
    const logger = fakeLogger();
    validateConfig({
      GOOGLE_MAPS_API_KEY: 'k', NOAA_CDO_API_KEY: 'a', NREL_API_KEY: 'b',
      EIA_API_KEY: 'c', CENSUS_API_KEY: 'd', AIRNOW_API_KEY: 'e', OPENCHARGEMAP_API_KEY: 'f',
    }, logger);
    expect(logger.warnings.length).toBe(0);
  });

  test('adminToken is null when unset and the value when set', () => {
    expect(validateConfig({ GOOGLE_MAPS_API_KEY: 'k' }, fakeLogger()).adminToken).toBeNull();
    expect(validateConfig({ GOOGLE_MAPS_API_KEY: 'k', ADMIN_TOKEN: 't' }, fakeLogger()).adminToken).toBe('t');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/config.test.js`
Expected: FAIL — `Cannot find module '../src/config'`.

- [ ] **Step 3: Write the implementation**

Create `src/config.js`:

```js
'use strict';

const REQUIRED = ['GOOGLE_MAPS_API_KEY'];

const OPTIONAL = {
  NOAA_CDO_API_KEY: 'Climate — 30-year normals',
  NREL_API_KEY: 'Utilities — electric rate + EV charging',
  EIA_API_KEY: 'Costs — live gas price',
  CENSUS_API_KEY: 'Community/Growth — ACS demographics',
  AIRNOW_API_KEY: 'Sensory — air quality',
  OPENCHARGEMAP_API_KEY: 'Utilities — EV charging fallback',
};

class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

function isBlank(v) {
  return v == null || String(v).trim() === '';
}

function validateConfig(env = process.env, logger = console) {
  const missing = REQUIRED.filter((k) => isBlank(env[k]));
  if (missing.length) {
    throw new ConfigError(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
      `Set them in .env (see .env.example) before starting the server.`,
    );
  }
  for (const [key, chapter] of Object.entries(OPTIONAL)) {
    if (isBlank(env[key])) {
      logger.warn(`[config] WARN: ${key} not set — ${chapter} will run degraded (graceful fallback).`);
    }
  }
  return {
    googleMapsApiKey: env.GOOGLE_MAPS_API_KEY,
    adminToken: isBlank(env.ADMIN_TOKEN) ? null : env.ADMIN_TOKEN,
    port: env.PORT || 3000,
  };
}

module.exports = { validateConfig, ConfigError, REQUIRED, OPTIONAL };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/config.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config.js tests/config.test.js
git commit -m "feat(FR-064): startup config validation (crash on required, warn on optional)"
```

---

## Task 3: Wire config validation into boot

**Files:**
- Modify: `src/app.js` (top, near lines 24-25)

- [ ] **Step 1: Add the boot-time validation call**

In `src/app.js`, immediately after the requires block and before `const app = express();`, add:

```js
const { validateConfig } = require('./config');

let config;
try {
  config = validateConfig();
} catch (err) {
  console.error(`[config] FATAL: ${err.message}`);
  process.exit(1);
}
```

- [ ] **Step 2: Use the validated port**

Replace `const port = process.env.PORT || 3000;` with:

```js
const port = config.port;
```

(Leave the existing `const { googleMapsApiKey } = require('./shared/google/client');` and the per-request check at line 36 as-is — now redundant but harmless.)

- [ ] **Step 3: Verify boot behavior manually**

Run (required key present): `npm start` → server starts, prints any optional-key WARN lines, listens. Stop it.
Run (required key missing): `$env:GOOGLE_MAPS_API_KEY=''; node src/app.js` (PowerShell) → prints `[config] FATAL: Missing required environment variable(s): GOOGLE_MAPS_API_KEY…` and exits non-zero; does NOT listen.

- [ ] **Step 4: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app.js
git commit -m "feat(FR-064): fail loud at boot on missing required config"
```

---

## Task 4: Admin auth middleware

**Files:**
- Create: `src/middleware/adminAuth.js`
- Test: `tests/middleware/adminAuth.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/middleware/adminAuth.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/middleware/adminAuth.test.js`
Expected: FAIL — `Cannot find module '../../src/middleware/adminAuth'`.

- [ ] **Step 3: Write the implementation**

Create `src/middleware/adminAuth.js`:

```js
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
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// getToken is injected so the boot-resolved ADMIN_TOKEN can be passed in (and mocked in tests).
function makeRequireAdmin(getToken = () => process.env.ADMIN_TOKEN) {
  return function requireAdmin(req, res, next) {
    if (isLoopback(req)) return next();
    const token = getToken();
    if (token && tokenMatches(req.get('x-admin-token'), token)) return next();
    return res.status(403).send('Forbidden');
  };
}

module.exports = { makeRequireAdmin, isLoopback, tokenMatches, LOOPBACK };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/middleware/adminAuth.test.js`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/middleware/adminAuth.js tests/middleware/adminAuth.test.js
git commit -m "feat(FR-064): admin auth middleware (loopback OR timing-safe token)"
```

---

## Task 5: Mount the admin guard on all four routes

**Files:**
- Modify: `src/app.js` (admin section, lines ~83-107)

- [ ] **Step 1: Import the guard**

Add to the requires/wiring near the top of `src/app.js`:

```js
const { makeRequireAdmin } = require('./middleware/adminAuth');
```

- [ ] **Step 2: Mount it before the admin routes**

Directly above the `// ── Admin ──` route definitions, add:

```js
app.use('/admin', makeRequireAdmin(() => config.adminToken));
```

- [ ] **Step 3: Remove the now-redundant inline IP check in `/admin/health`**

In the `/admin/health` handler, delete these two lines (the guard now covers it):

```js
  const ip = req.ip || req.socket?.remoteAddress || '';
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) return res.status(403).send('Forbidden');
```

- [ ] **Step 4: Verify manually**

Run `npm start`, then in another shell:
- `curl http://localhost:3000/admin/cache-stats` → JSON (loopback allowed).
- Confirm a non-loopback request would be blocked (covered by unit tests; loopback can't easily be spoofed locally).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app.js
git commit -m "feat(FR-064): guard all /admin/* routes (incl. clear-cache POST)"
```

---

## Task 6: Helmet security headers (tailored CSP)

**Files:**
- Modify: `src/app.js` (just after `const app = express();`)
- Modify: `package.json` (dependency)

- [ ] **Step 1: Install helmet**

Run: `npm install helmet`

- [ ] **Step 2: Add helmet as the first middleware**

In `src/app.js`, immediately after `const app = express();` (before `app.use(express.static(...))`), add:

```js
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // 'unsafe-inline' is REQUIRED: report/compare/error/loading templates emit
      // inline <script> and the loading page dynamically re-executes scripts.
      // Nonce/hash CSP would break rendering. Stage 0 compromise — externalizing
      // inline scripts to enable a strict script-src is a future hardening pass.
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
```

- [ ] **Step 3: Smoke-test a rendered report under CSP**

Run `npm start`, open `http://localhost:3000/report?address=123%20Main%20St,%20Louisville,%20KY%2040202` in a browser. Verify: fonts load, layout intact, icons render (lucide from unpkg), no CSP errors in the devtools console that break content. (Use the project `run` skill if preferred.)

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app.js package.json package-lock.json
git commit -m "feat(FR-064): helmet security headers with Google-Fonts/unpkg CSP"
```

---

## Task 7: Inbound rate limiters

**Files:**
- Create: `src/middleware/rateLimiters.js`
- Test: `tests/middleware/rateLimiters.test.js`
- Modify: `src/app.js`
- Modify: `package.json` (dependency)

- [ ] **Step 1: Install express-rate-limit**

Run: `npm install express-rate-limit`

- [ ] **Step 2: Write the failing test for the skip predicate**

Create `tests/middleware/rateLimiters.test.js`:

```js
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest tests/middleware/rateLimiters.test.js`
Expected: FAIL — `Cannot find module '../../src/middleware/rateLimiters'`.

- [ ] **Step 4: Write the implementation**

Create `src/middleware/rateLimiters.js`:

```js
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/middleware/rateLimiters.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Wire the limiters into app.js**

In `src/app.js`, add the import near the other requires:

```js
const { globalLimiter, meteredLimiter } = require('./middleware/rateLimiters');
```

Then, just after the helmet `app.use(...)` (Task 6) and before `app.use(express.static(...))`, add the global limiter:

```js
app.use(globalLimiter);
```

And immediately after the static line, mount the metered limiter on the two billed routes (this must appear before the `/report` and `/compare` route definitions):

```js
app.use(['/report', '/compare'], meteredLimiter);
```

Add a `trust proxy` note near the top wiring (leave default for Stage 0):

```js
// app.set('trust proxy', 1); // Stage 1: enable when running behind a load balancer/proxy
```

- [ ] **Step 7: Verify the throttle manually**

Run `npm start`. In PowerShell, fire 12 billed builds quickly:

```powershell
1..12 | ForEach-Object { (Invoke-WebRequest "http://localhost:3000/report?address=test&fetch=1" -SkipHttpErrorCheck).StatusCode }
```

Expected: first ~10 return 200, then 429s appear. (Loopback is exempt in `meteredSkip`, so to see throttling you must temporarily test from a non-loopback context OR comment out the loopback exemption — note this; the unit test already proves the predicate. If verifying purely locally, confirm at minimum that normal single requests still return 200.)

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app.js src/middleware/rateLimiters.js tests/middleware/rateLimiters.test.js package.json package-lock.json
git commit -m "feat(FR-064): inbound throttle (tight on metered builds, loose global)"
```

---

## Task 8: Documentation — .env.example + env gaps

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add ADMIN_TOKEN to .env.example**

Append:

```bash
# ADMIN_TOKEN — optional. Unlocks /admin/* routes from non-loopback hosts (sent as the
# x-admin-token request header). If unset, admin routes are localhost-only. Set a long
# random value on any deployed host.
ADMIN_TOKEN=your_admin_token_here
```

- [ ] **Step 2: Add the two undocumented optional keys**

Append:

```bash
# AIRNOW_API_KEY — optional. Sensory chapter air-quality (AirNow). Free key:
# https://docs.airnowapi.org/account/request/ . If unset: air-quality runs degraded.
AIRNOW_API_KEY=your_key_here

# CENSUS_API_KEY — optional. Community/Growth chapters (ACS demographics). Free key:
# https://api.census.gov/data/key_signup.html . If unset: those sections run degraded.
CENSUS_API_KEY=your_key_here
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs(FR-064): document ADMIN_TOKEN, AIRNOW_API_KEY, CENSUS_API_KEY in .env.example"
```

---

## Task 9: Final verification + summary

**Files:**
- Create: `feature-requests/FR-064-hardening-stage-0/summary.md`

- [ ] **Step 1: Run the full suite one final time**

Run: `npm test`
Expected: PASS — 1,384 existing + 19 new (5 config + 11 adminAuth + 3 rateLimiters).

- [ ] **Step 2: Confirm clean boot with warnings**

Run: `npm start` with at least one optional key unset → confirm WARN lines print and the server still listens. Stop it.

- [ ] **Step 3: Smoke-test a report renders under helmet/CSP**

Confirm a rendered report (Louisville test address) displays correctly in a browser (fonts, icons, layout). Record the result in summary.md.

- [ ] **Step 4: Write summary.md**

Document: what shipped (4 components), the 2 new npm packages (`helmet`, `express-rate-limit`), the **CSP `'unsafe-inline'` compromise and why** (inline + dynamically re-executed scripts), what was explicitly deferred (state layer → Stage 1; spend ceiling → FR-065), test counts, and the 5-address note (no location-search logic touched; verification was CSP render + boot behavior).

- [ ] **Step 5: Commit**

```bash
git add feature-requests/FR-064-hardening-stage-0/summary.md
git commit -m "docs(FR-064): Stage 0 hardening summary"
```

- [ ] **Step 6: Push and open PR**

```bash
git push -u origin FR-064-hardening-stage-0
gh pr create --title "FR-064: Hardening Stage 0 (CI, config validation, admin auth, helmet + throttle)" --body "Implements NR-004 Stage 0. State layer (Stage 1) and spend ceiling (FR-065) deliberately deferred. See feature-requests/FR-064-hardening-stage-0/."
```

---

## Risks & Watch-outs

- **CSP is the one fragile spot.** Verified inline scripts exist; Stage 0 uses `'unsafe-inline'` script-src by design. If the smoke test still shows a blanked report, check the devtools console for the specific blocked directive (likely `unpkg.com` or a `data:`/`blob:` source) and widen that one directive — do **not** silently disable CSP without noting it in summary.md.
- **trust proxy** stays default (single instance). Revisit in Stage 1 — `express-rate-limit` keys on `req.ip`, which is wrong behind an un-trusted proxy.
- **Do not** touch `.cache`, `data/reports.json`, `usageLog`, or the PDF route — all out of scope (Stage 1 / FR-065).

## Spec Coverage Check

- Component 1 (CI) → Task 1 ✓
- Component 2 (config validation) → Tasks 2-3 ✓ (+ .env.example gaps in Task 8)
- Component 3 (admin guard) → Tasks 4-5 ✓
- Component 4a (helmet/CSP) → Task 6 ✓
- Component 4b (throttle) → Task 7 ✓
- Testing requirements → Tasks 2,4,7 (unit) + Tasks 6,9 (smoke) ✓
- Package documentation → Tasks 6,7,9 ✓
