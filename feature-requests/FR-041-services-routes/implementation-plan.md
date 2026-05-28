# FR-041 Services and Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract all business logic and HTML generation from `src/app.js` into dedicated service and template files, leaving app.js as a thin Express config + route shell (~80–120 lines).

**Architecture:** Three new service files handle data orchestration, report persistence, and comparison; five new page template files own all HTML generation; app.js route handlers become thin wrappers that call services and send the result. `originState` (already extracted by the existing `reverseGeocodeAddress` call) is wired into module data functions that already accept it (`findNearestSchool`, `findNearestHospital`, `findNearestUrgentCare`, `findNearestElementarySchool`).

**Tech Stack:** Node.js, Express, Jest (same as existing codebase)

---

## File Map

### New Files

| File | Responsibility |
|---|---|
| `src/services/reportStore.js` | File-based report persistence — save, load, get, update |
| `src/services/reportBuilder.js` | Report orchestration — geocode → fetch → render → return `{html}` |
| `src/services/compareBuilder.js` | Compare orchestration — geocode + data fetch for 1–3 addresses |
| `src/templates/pages/reportPage.js` | `buildReportHTML` + section helpers (grocery, dest, school, hero) |
| `src/templates/pages/errorPage.js` | `buildErrorHTML`, `buildLoadingHTML` |
| `src/templates/pages/comparePage.js` | `buildCompareFormHTML`, `buildCompareLoadingHTML`, `buildCompareResultsHTML` |
| `src/templates/pages/adminPage.js` | `buildAdminHealthHTML` (extracted from `/admin/health` route) |

### Modified Files

| File | What Changes |
|---|---|
| `src/app.js` | Remove all extracted functions; route handlers become thin wrappers |

### New Test Files

| File | What It Tests |
|---|---|
| `tests/services/reportStore.test.js` | saveReport, getReport, updateReportAccess |
| `tests/services/reportBuilder.test.js` | buildReport orchestration, originState wiring |
| `tests/templates/pages/reportPage.test.js` | buildReportHTML structure, CONSTRAINT-008, section helper null handling |
| `tests/templates/pages/errorPage.test.js` | buildErrorHTML, buildLoadingHTML return valid HTML |

---

## Known Constraints and Risks

- **CONSTRAINT-008:** No inline styles. The `/admin/health` route currently generates HTML with inline `style="..."` throughout — this is pre-existing and out of scope for FR-041. Extract the admin HTML faithfully as-is; fix the styles in a dedicated FR.
- **CONSTRAINT-009:** `buildHeroInsightRowsHTML` (app.js:149–220) mixes business rules with HTML — extract faithfully as-is; splitting it is out of scope.
- **ruralMode wiring:** `detectRuralMode` needs census `tractPopulation`, which is fetched in `premium.js`. Since that data isn't available before the main fetch, `findNearestGrocery` will continue to default to `ruralMode='suburban'` for now. Pass `originState` only (achievable in this FR). Activate ruralMode in FR-040 or later when census data is hoisted.
- **PDF route:** Calls `http://localhost:${port}/report?...` internally. No URL change — safe.
- **Line count target:** The spec says ≤40 lines but lists 8+ routes. Realistic target is ~80–120 lines; the real goal is zero HTML generation and zero business logic in app.js.

---

## Task 1: Create Branch

- [ ] **Create the feature branch**

```bash
git checkout -b fr-041-services-routes
```

---

## Task 2: reportStore.js

**Files:**
- Create: `src/services/reportStore.js`
- Create: `tests/services/reportStore.test.js`

The five file-persistence functions currently at `src/app.js:43–78`.

- [ ] **Write the failing test** at `tests/services/reportStore.test.js`

```js
'use strict';

const fs = require('fs');
jest.mock('fs');

beforeEach(() => {
  jest.resetAllMocks();
  fs.existsSync.mockReturnValue(true);
  fs.readFileSync.mockReturnValue('{}');
  fs.writeFileSync.mockImplementation(() => {});
  fs.mkdirSync.mockImplementation(() => {});
});

// Isolate module between tests so the require cache doesn't bleed
let reportStore;
beforeEach(() => {
  jest.isolateModules(() => {
    reportStore = require('../../src/services/reportStore');
  });
});

describe('saveReport', () => {
  test('returns an 8-character hex string', () => {
    const id = reportStore.saveReport('100 Main St, Louisville, KY');
    expect(typeof id).toBe('string');
    expect(id).toHaveLength(8);
  });

  test('writes the address to the reports file', () => {
    reportStore.saveReport('100 Main St, Louisville, KY');
    expect(fs.writeFileSync).toHaveBeenCalled();
    const written = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
    const entry = Object.values(written)[0];
    expect(entry.address).toBe('100 Main St, Louisville, KY');
  });
});

describe('getReport', () => {
  test('returns null for unknown ID', () => {
    const result = reportStore.getReport('deadbeef');
    expect(result).toBeNull();
  });

  test('returns saved report entry', () => {
    fs.readFileSync.mockReturnValue(JSON.stringify({
      abc12345: { address: '100 Main St', createdAt: '2026-01-01T00:00:00.000Z', lastAccessed: '2026-01-01T00:00:00.000Z' },
    }));
    const result = reportStore.getReport('abc12345');
    expect(result.address).toBe('100 Main St');
  });
});

describe('updateReportAccess', () => {
  test('updates lastAccessed for known ID', () => {
    fs.readFileSync.mockReturnValue(JSON.stringify({
      abc12345: { address: '100 Main St', createdAt: '2026-01-01T00:00:00.000Z', lastAccessed: '2026-01-01T00:00:00.000Z' },
    }));
    reportStore.updateReportAccess('abc12345');
    expect(fs.writeFileSync).toHaveBeenCalled();
    const written = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
    expect(written.abc12345.lastAccessed).not.toBe('2026-01-01T00:00:00.000Z');
  });

  test('does nothing for unknown ID', () => {
    reportStore.updateReportAccess('unknown');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Run to verify it fails**

```bash
npm test -- --testPathPattern=reportStore
```

Expected: FAIL — module not found.

- [ ] **Implement `src/services/reportStore.js`**

```js
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../../data');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');

function ensureReportsFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(REPORTS_FILE)) fs.writeFileSync(REPORTS_FILE, '{}', 'utf8');
}

function loadReports() {
  try {
    return JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveReport(address) {
  ensureReportsFile();
  const reports = loadReports();
  let id;
  do { id = crypto.randomBytes(4).toString('hex'); } while (reports[id]);
  const now = new Date().toISOString();
  reports[id] = { address, createdAt: now, lastAccessed: now };
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf8');
  return id;
}

function getReport(reportId) {
  return loadReports()[reportId] || null;
}

function updateReportAccess(reportId) {
  ensureReportsFile();
  const reports = loadReports();
  if (reports[reportId]) {
    reports[reportId].lastAccessed = new Date().toISOString();
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf8');
  }
}

module.exports = { ensureReportsFile, loadReports, saveReport, getReport, updateReportAccess };
```

- [ ] **Run tests to verify they pass**

```bash
npm test -- --testPathPattern=reportStore
```

Expected: all 6 tests pass.

- [ ] **Commit**

```bash
git add src/services/reportStore.js tests/services/reportStore.test.js
git commit -m "feat(fr-041): extract reportStore.js — file-based report persistence"
```

---

## Task 3: templates/pages/reportPage.js

**Files:**
- Create: `src/templates/pages/reportPage.js`
- Create: `tests/templates/pages/reportPage.test.js`

Extracts the following from `src/app.js`:
- `buildGrocerySection` (app.js:91–107)
- `buildDestSection` (app.js:109–127)
- `buildSchoolSection` (app.js:129–146)
- `buildHeroInsightRowsHTML` (app.js:149–220)
- `buildReportHTML` (app.js:223–388)

- [ ] **Write the failing tests** at `tests/templates/pages/reportPage.test.js`

```js
'use strict';

const {
  buildGrocerySection,
  buildDestSection,
  buildSchoolSection,
  buildReportHTML,
} = require('../../../src/templates/pages/reportPage');

describe('buildGrocerySection', () => {
  test('returns fallback with Google Maps link when stores is null', () => {
    const html = buildGrocerySection(null);
    expect(html).toContain('google.com/maps/search/grocery');
  });

  test('renders store name and drive time when stores provided', () => {
    const stores = [{ name: 'Kroger', address: '100 Main', driveTimeMinutes: 8 }];
    const html = buildGrocerySection(stores);
    expect(html).toContain('Kroger');
    expect(html).toContain('8 min');
  });
});

describe('buildDestSection', () => {
  test('returns fallback with search link when result is null', () => {
    const html = buildDestSection('Pharmacy', null);
    expect(html).toContain('google.com/maps/search/');
    expect(html).toContain('Pharmacy');
  });

  test('renders name and drive time when result provided', () => {
    const result = { name: 'CVS', address: '200 Oak', driveTimeMinutes: 5 };
    const html = buildDestSection('Pharmacy', result);
    expect(html).toContain('CVS');
    expect(html).toContain('5 min');
  });
});

describe('buildSchoolSection', () => {
  test('returns district contact fallback when school is null', () => {
    const html = buildSchoolSection(null);
    expect(html).toContain('school district');
  });

  test('renders school name and drive time', () => {
    const school = { name: 'Lincoln Elementary', address: '300 Elm', driveTimeMinutes: 7, note: null };
    const html = buildSchoolSection(school);
    expect(html).toContain('Lincoln Elementary');
  });
});

describe('buildReportHTML', () => {
  const minData = {
    grocery: null, pharmacy: null, hospital: null, urgentCare: null,
    highwayRamp: null, school: null, gasStation: null, park: null,
    coffeeShop: null, elementarySchool: null, customDestinations: [],
    trafficData: [], origin: { lat: 38.3, lng: -84.4 }, reportId: null, premium: null,
  };

  test('returns a complete HTML document', () => {
    const html = buildReportHTML('100 Main St, Louisville, KY', minData);
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('</html>');
  });

  test('contains no inline style attributes (CONSTRAINT-008)', () => {
    const html = buildReportHTML('100 Main St, Louisville, KY', minData);
    expect(html).not.toMatch(/style="/);
  });

  test('escapes address in title', () => {
    const html = buildReportHTML('<script>alert(1)</script>', minData);
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
```

- [ ] **Run to verify it fails**

```bash
npm test -- --testPathPattern=reportPage
```

Expected: FAIL — module not found.

- [ ] **Create `src/templates/pages/reportPage.js`**

Copy the five functions from `src/app.js` exactly as-is (lines 91–388). Add the module header and imports, and remove them from app.js scope:

```js
'use strict';

const { escapeHtml, formatDriveTime, parseAddressParts, formatResearchDate } = require('../../utils/text');
const { HIGHWAY_MAX_DRIVE_MINUTES } = require('../../utils/constants');
const { buildInsightsCardHTML, buildCustomDestinationsCardHTML, buildAdditionalServicesCardHTML } = require('../chapters/reachability');
const { buildTrafficCardHTML } = require('../chapters/traffic');
const { buildHealthSafetyChapterHTML } = require('../chapters/health');
const { buildPremiumSectionsHTML } = require('../../premium');
```

Then paste the five functions unchanged, and add at the bottom:

```js
module.exports = {
  buildGrocerySection,
  buildDestSection,
  buildSchoolSection,
  buildHeroInsightRowsHTML,
  buildReportHTML,
};
```

Note: `buildPremiumSectionsHTML` is imported from `../../premium` (premium.js exports it). `buildHeroInsightRowsHTML` contains business logic — it is extracted faithfully and flagged as a CONSTRAINT-009 technical debt item.

- [ ] **Run tests to verify they pass**

```bash
npm test -- --testPathPattern=reportPage
```

Expected: all 8 tests pass.

- [ ] **Run full suite to check for regressions**

```bash
npm test
```

Expected: 145 tests pass (the new tests are additive).

- [ ] **Commit**

```bash
git add src/templates/pages/reportPage.js tests/templates/pages/reportPage.test.js
git commit -m "feat(fr-041): extract reportPage.js — main report HTML template"
```

---

## Task 4: templates/pages/errorPage.js

**Files:**
- Create: `src/templates/pages/errorPage.js`
- Create: `tests/templates/pages/errorPage.test.js`

Extracts `buildErrorHTML` (app.js:409–456) and `buildLoadingHTML` (app.js:458–586).

- [ ] **Write the failing tests** at `tests/templates/pages/errorPage.test.js`

```js
'use strict';

const { buildErrorHTML, buildLoadingHTML } = require('../../../src/templates/pages/errorPage');

describe('buildErrorHTML', () => {
  test('returns a complete HTML document', () => {
    const html = buildErrorHTML('SERVER_ERROR', 'Something went wrong', 'Please try again.', null, null);
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('</html>');
  });

  test('escapes the error message', () => {
    const html = buildErrorHTML('SERVER_ERROR', '<b>Bad</b>', 'msg', null, null);
    expect(html).not.toContain('<b>Bad</b>');
  });

  test('includes Try again link when address is provided', () => {
    const html = buildErrorHTML('ADDRESS_NOT_FOUND', 'Not found', 'msg', '100 Main St', null);
    expect(html).toContain('Try again');
  });
});

describe('buildLoadingHTML', () => {
  test('returns a complete HTML document', () => {
    const html = buildLoadingHTML('100 Main St, Louisville, KY');
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('</html>');
  });

  test('includes the address in the page', () => {
    const html = buildLoadingHTML('100 Main St, Louisville, KY');
    expect(html).toContain('100 Main St, Louisville, KY');
  });
});
```

- [ ] **Run to verify it fails**

```bash
npm test -- --testPathPattern=errorPage
```

Expected: FAIL — module not found.

- [ ] **Create `src/templates/pages/errorPage.js`**

```js
'use strict';

const { escapeHtml } = require('../../utils/text');
const { ERROR_ICONS } = require('../../utils/constants');
```

Then paste `buildErrorHTML` (app.js:409–456) and `buildLoadingHTML` (app.js:458–586) unchanged, then add:

```js
module.exports = { buildErrorHTML, buildLoadingHTML };
```

- [ ] **Run tests to verify they pass**

```bash
npm test -- --testPathPattern=errorPage
```

Expected: all 5 tests pass.

- [ ] **Run full suite**

```bash
npm test
```

Expected: 150 tests pass.

- [ ] **Commit**

```bash
git add src/templates/pages/errorPage.js tests/templates/pages/errorPage.test.js
git commit -m "feat(fr-041): extract errorPage.js — error and loading HTML templates"
```

---

## Task 5: comparePage.js and compareBuilder.js

**Files:**
- Create: `src/templates/pages/comparePage.js`
- Create: `src/services/compareBuilder.js`

Extracts `buildCompareFormHTML`, `buildCompareLoadingHTML`, `buildCompareResultsHTML` (app.js:836–1007) and `generateComparisonData` (app.js:820–834).

- [ ] **Write the failing tests** at `tests/templates/pages/comparePage.test.js`

```js
'use strict';

const { buildCompareFormHTML, buildCompareLoadingHTML, buildCompareResultsHTML } = require('../../../src/templates/pages/comparePage');

describe('buildCompareFormHTML', () => {
  test('returns a complete HTML document', () => {
    const html = buildCompareFormHTML();
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('</html>');
  });
});

describe('buildCompareLoadingHTML', () => {
  test('returns a complete HTML document', () => {
    const html = buildCompareLoadingHTML('100 Main|200 Oak');
    expect(html).toMatch(/^<!DOCTYPE html>/);
  });
});

describe('buildCompareResultsHTML', () => {
  test('renders address cards for each report', () => {
    const reports = [
      { address: '100 Main St, Louisville, KY', services: { grocery: null, pharmacy: null, hospital: null, urgentCare: null, highwayRamp: null, gasStation: null } },
      { address: '200 Oak Ave, Louisville, KY', services: { grocery: null, pharmacy: null, hospital: null, urgentCare: null, highwayRamp: null, gasStation: null } },
    ];
    const html = buildCompareResultsHTML(reports);
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('100 Main St');
    expect(html).toContain('200 Oak Ave');
  });
});
```

- [ ] **Run to verify it fails**

```bash
npm test -- --testPathPattern=comparePage
```

Expected: FAIL — module not found.

- [ ] **Create `src/templates/pages/comparePage.js`**

```js
'use strict';

const { escapeHtml, parseAddressParts } = require('../../utils/text');
```

Paste `buildCompareFormHTML`, `buildCompareLoadingHTML`, `buildCompareResultsHTML` from app.js:836–1007 unchanged, then:

```js
module.exports = { buildCompareFormHTML, buildCompareLoadingHTML, buildCompareResultsHTML };
```

- [ ] **Create `src/services/compareBuilder.js`**

```js
'use strict';

const { geocodeAddress } = require('../shared/google/geocoding');
const { getDriveTime } = require('../shared/google/distanceMatrix');
const { findNearestGrocery, findNearestPharmacy, findNearestGasStation } = require('../modules/reachability/data');
const { findNearestHighwayOnRamp } = require('../modules/access/data');
const { findNearestHospital, findNearestUrgentCare } = require('../modules/health/data');

async function generateComparisonData(address) {
  const origin = await geocodeAddress(address);
  const originLatLng = `${origin.lat},${origin.lng}`;
  const results = await Promise.allSettled([
    findNearestGrocery(originLatLng),
    findNearestPharmacy(originLatLng),
    findNearestHospital(originLatLng),
    findNearestUrgentCare(originLatLng),
    findNearestHighwayOnRamp(originLatLng),
    findNearestGasStation(originLatLng),
  ]);
  const [grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation] =
    results.map((r) => (r.status === 'fulfilled' ? r.value : null));
  return { address, origin, services: { grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation } };
}

module.exports = { generateComparisonData };
```

- [ ] **Run tests to verify they pass**

```bash
npm test -- --testPathPattern=comparePage
```

Expected: all 3 tests pass.

- [ ] **Run full suite**

```bash
npm test
```

Expected: 153+ tests pass.

- [ ] **Commit**

```bash
git add src/templates/pages/comparePage.js src/services/compareBuilder.js tests/templates/pages/comparePage.test.js
git commit -m "feat(fr-041): extract comparePage.js and compareBuilder.js — compare feature"
```

---

## Task 6: templates/pages/adminPage.js

**Files:**
- Create: `src/templates/pages/adminPage.js`

Extracts the admin HTML generation from the `/admin/health` route handler (app.js:698–818). The existing HTML has inline styles — pre-existing CONSTRAINT-008 violation, extracted faithfully.

- [ ] **Create `src/templates/pages/adminPage.js`**

```js
'use strict';

const { escapeHtml } = require('../../utils/text');
```

Extract the `res.send(` call in the `/admin/health` handler (app.js:751–817) into a named function:

```js
function buildAdminHealthHTML({ patterns, mitigations, recentErrors, usage }) {
  const pct = (n) => (n == null ? 'N/A' : `${(n * 100).toFixed(1)}%`);
  const flagged = Object.entries(patterns?.functions || {}).filter(([, f]) => f.flagged);

  const fnRows = Object.entries(patterns?.functions || {})
    .sort(([, a], [, b]) => b.failureRate - a.failureRate)
    .map(([fn, f]) => `
      <tr style="background:${f.flagged ? '#fff3cd' : 'transparent'}">
        <td style="padding:6px 10px;font-family:monospace;font-size:13px">${fn}</td>
        <td style="padding:6px 10px;text-align:right">${f.failures}</td>
        <td style="padding:6px 10px;text-align:right;color:${f.flagged ? '#b8922a' : '#1a1a1a'};font-weight:${f.flagged ? '600' : '400'}">${pct(f.failureRate)}</td>
        <td style="padding:6px 10px;font-size:12px;color:#555">${f.topErrors[0] || '–'}</td>
      </tr>`).join('');

  const mitRows = Object.entries(mitigations)
    .filter(([k]) => k !== 'updatedAt')
    .map(([fn, m]) => `
      <tr>
        <td style="padding:6px 10px;font-family:monospace;font-size:13px">${fn}</td>
        <td style="padding:6px 10px">${JSON.stringify(Object.fromEntries(Object.entries(m).filter(([k]) => !['reason','appliedAt'].includes(k))))}</td>
        <td style="padding:6px 10px;font-size:12px;color:#555">${m.reason || '–'}</td>
        <td style="padding:6px 10px;font-size:12px;color:#888">${m.appliedAt ? new Date(m.appliedAt).toLocaleDateString() : '–'}</td>
      </tr>`).join('');

  const errorRows = recentErrors.map((e) => `
    <tr>
      <td style="padding:5px 10px;font-size:12px;color:#888">${new Date(e.ts).toLocaleTimeString()}</td>
      <td style="padding:5px 10px;font-family:monospace;font-size:12px">${e.fn || '–'}</td>
      <td style="padding:5px 10px;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(e.address || '')}">${escapeHtml((e.address || '').slice(0, 40))}</td>
      <td style="padding:5px 10px;font-size:12px;color:#c0392b">${escapeHtml(e.errorMsg || '')}</td>
    </tr>`).join('');

  const apiRows = Object.entries(usage.byEndpoint || {})
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([ep, s]) => `
      <tr>
        <td style="padding:5px 10px;font-family:monospace;font-size:12px">${ep}</td>
        <td style="padding:5px 10px;text-align:right">${s.total}</td>
        <td style="padding:5px 10px;text-align:right">${s.total > 0 ? pct(s.success / s.total) : 'N/A'}</td>
      </tr>`).join('');

  const stats = patterns?.requestStats;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Livably – Health Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 24px; background: #faf8f4; color: #1a1a1a; font-family: 'DM Sans', sans-serif; font-size: 14px; }
    h1 { font-family: 'Fraunces', serif; font-size: 24px; margin: 0 0 4px; }
    h2 { font-family: 'Fraunces', serif; font-size: 16px; margin: 28px 0 10px; color: #1a1a1a; border-bottom: 1px solid #e0dcd4; padding-bottom: 6px; }
    .meta { color: #888; font-size: 12px; margin-bottom: 24px; }
    .cards { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
    .card { background: #fff; border: 1px solid #e0dcd4; border-radius: 8px; padding: 14px 20px; min-width: 140px; }
    .card-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .5px; }
    .card-value { font-size: 26px; font-weight: 600; margin-top: 2px; }
    .card-value.warn { color: #b8922a; }
    .card-value.ok { color: #2e7d32; }
    .flag-banner { background: #fff3cd; border: 1px solid #b8922a; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e0dcd4; border-radius: 8px; overflow: hidden; }
    th { text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #888; background: #f4f1eb; border-bottom: 1px solid #e0dcd4; }
    tr + tr td { border-top: 1px solid #f0ece4; }
    .empty { color: #aaa; font-size: 13px; padding: 16px; text-align: center; }
  </style>
</head>
<body>
  <h1>Livably Health Dashboard</h1>
  <div class="meta">7-day window · analyzed ${patterns?.analyzedAt ? new Date(patterns.analyzedAt).toLocaleString() : 'never'} · API usage resets on restart</div>

  ${flagged.length ? `<div class="flag-banner">⚠️ <strong>${flagged.length} function${flagged.length > 1 ? 's' : ''} flagged:</strong> ${flagged.map(([fn, f]) => `${fn} (${pct(f.failureRate)})`).join(', ')}</div>` : ''}

  <div class="cards">
    <div class="card"><div class="card-label">Total Requests (7d)</div><div class="card-value">${stats?.total ?? '–'}</div></div>
    <div class="card"><div class="card-label">Success Rate (7d)</div><div class="card-value ${stats?.successRate >= 0.9 ? 'ok' : 'warn'}">${pct(stats?.successRate)}</div></div>
    <div class="card"><div class="card-label">Errors (7d)</div><div class="card-value ${(stats?.error || 0) > 0 ? 'warn' : 'ok'}">${stats?.error ?? '–'}</div></div>
    <div class="card"><div class="card-label">API Calls (24h)</div><div class="card-value">${usage.last24h}</div></div>
    <div class="card"><div class="card-label">API Success (24h)</div><div class="card-value">${usage.successRate}</div></div>
  </div>

  <h2>Function Failure Rates (7d)</h2>
  ${fnRows ? `<table><thead><tr><th>Function</th><th style="text-align:right">Failures</th><th style="text-align:right">Rate</th><th>Top Error</th></tr></thead><tbody>${fnRows}</tbody></table>` : '<p class="empty">No function errors recorded yet.</p>'}

  <h2>Active Mitigations</h2>
  ${mitRows ? `<table><thead><tr><th>Function</th><th>Value</th><th>Reason</th><th>Applied</th></tr></thead><tbody>${mitRows}</tbody></table>` : '<p class="empty">No mitigations active.</p>'}

  <h2>Recent Errors (today, last 20)</h2>
  ${errorRows ? `<table><thead><tr><th>Time</th><th>Function</th><th>Address</th><th>Error</th></tr></thead><tbody>${errorRows}</tbody></table>` : '<p class="empty">No errors logged today.</p>'}

  <h2>API Usage by Endpoint (24h)</h2>
  ${apiRows ? `<table><thead><tr><th>Endpoint</th><th style="text-align:right">Calls</th><th style="text-align:right">Success Rate</th></tr></thead><tbody>${apiRows}</tbody></table>` : '<p class="empty">No API calls recorded.</p>'}
</body>
</html>`;
}

module.exports = { buildAdminHealthHTML };
```

- [ ] **Verify it loads**

```bash
node -e "require('./src/templates/pages/adminPage')"
```

Expected: no output (clean load).

- [ ] **Commit**

```bash
git add src/templates/pages/adminPage.js
git commit -m "feat(fr-041): extract adminPage.js — admin health dashboard HTML"
```

---

## Task 7: services/reportBuilder.js

**Files:**
- Create: `src/services/reportBuilder.js`
- Create: `tests/services/reportBuilder.test.js`

This is the main orchestrator. Extracts the data-fetching and rendering logic from the `/report` GET handler (app.js:604–693). Key addition: passes `originState` from `locationInfo.state` to all module data functions that accept it.

- [ ] **Write the failing tests** at `tests/services/reportBuilder.test.js`

```js
'use strict';

const mockGeocodeAddress = jest.fn();
const mockReverseGeocode = jest.fn();
const mockGetDriveTime = jest.fn();
const mockGetTrafficVariations = jest.fn();
const mockFindNearestGrocery = jest.fn();
const mockFindNearestPharmacy = jest.fn();
const mockFindNearestGasStation = jest.fn();
const mockFindNearestHighwayOnRamp = jest.fn();
const mockFindNearestHospital = jest.fn();
const mockFindNearestUrgentCare = jest.fn();
const mockFindNearestSchool = jest.fn();
const mockFindNearestElementarySchool = jest.fn();
const mockFindNearestPark = jest.fn();
const mockFindNearestCoffeeShop = jest.fn();
const mockGetPremiumData = jest.fn();
const mockSaveReport = jest.fn();
const mockLogRequest = jest.fn();
const mockLogError = jest.fn();
const mockLogAnalysis = jest.fn();
const mockBuildReportHTML = jest.fn();

jest.mock('../../src/shared/google/geocoding', () => ({ geocodeAddress: mockGeocodeAddress }));
jest.mock('../../src/shared/google/reverseGeocode', () => ({ reverseGeocodeAddress: mockReverseGeocode }));
jest.mock('../../src/shared/google/distanceMatrix', () => ({ getDriveTime: mockGetDriveTime, getTrafficVariations: mockGetTrafficVariations }));
jest.mock('../../src/shared/google/client', () => ({ googleMapsClient: {}, googleMapsApiKey: 'test-key' }));
jest.mock('../../src/modules/reachability/data', () => ({ findNearestGrocery: mockFindNearestGrocery, findNearestPharmacy: mockFindNearestPharmacy, findNearestGasStation: mockFindNearestGasStation }));
jest.mock('../../src/modules/access/data', () => ({ findNearestHighwayOnRamp: mockFindNearestHighwayOnRamp }));
jest.mock('../../src/modules/health/data', () => ({ findNearestHospital: mockFindNearestHospital, findNearestUrgentCare: mockFindNearestUrgentCare }));
jest.mock('../../src/modules/schools/data', () => ({ findNearestSchool: mockFindNearestSchool, findNearestElementarySchool: mockFindNearestElementarySchool }));
jest.mock('../../src/modules/recreation/data', () => ({ findNearestPark: mockFindNearestPark, findNearestCoffeeShop: mockFindNearestCoffeeShop }));
jest.mock('../../src/premium', () => ({ getPremiumData: mockGetPremiumData, buildPremiumSectionsHTML: jest.fn().mockReturnValue('') }));
jest.mock('../../src/services/reportStore', () => ({ saveReport: mockSaveReport }));
jest.mock('../../src/logger', () => ({ logRequest: mockLogRequest, logError: mockLogError, logAnalysis: mockLogAnalysis }));
jest.mock('../../src/templates/pages/reportPage', () => ({ buildReportHTML: mockBuildReportHTML }));
jest.mock('../../src/errorMemory', () => ({ loadMitigations: jest.fn().mockReturnValue({}) }));

const { buildReport } = require('../../src/services/reportBuilder');

const defaultOrigin = { lat: 38.3, lng: -84.4 };
const defaultLocationInfo = { city: 'Georgetown', state: 'KY', county: 'Scott', zip: '40324' };

beforeEach(() => {
  jest.clearAllMocks();
  mockGeocodeAddress.mockResolvedValue(defaultOrigin);
  mockReverseGeocode.mockResolvedValue(defaultLocationInfo);
  mockFindNearestGrocery.mockResolvedValue([{ name: 'Kroger', driveTimeMinutes: 8, location: defaultOrigin }]);
  mockFindNearestPharmacy.mockResolvedValue({ name: 'CVS', driveTimeMinutes: 5 });
  mockFindNearestHospital.mockResolvedValue({ name: 'Georgetown Comm Hospital', driveTimeMinutes: 12, location: defaultOrigin });
  mockFindNearestUrgentCare.mockResolvedValue(null);
  mockFindNearestHighwayOnRamp.mockResolvedValue({ name: 'I-75', driveTimeMinutes: 6 });
  mockFindNearestSchool.mockResolvedValue({ name: 'Georgetown Middle', driveTimeMinutes: 9 });
  mockFindNearestGasStation.mockResolvedValue({ name: 'Shell', driveTimeMinutes: 3 });
  mockFindNearestPark.mockResolvedValue(null);
  mockFindNearestCoffeeShop.mockResolvedValue(null);
  mockFindNearestElementarySchool.mockResolvedValue(null);
  mockGetPremiumData.mockResolvedValue(null);
  mockGetTrafficVariations.mockResolvedValue(null);
  mockSaveReport.mockReturnValue('abc12345');
  mockBuildReportHTML.mockReturnValue('<html>report</html>');
});

describe('buildReport', () => {
  test('calls geocodeAddress with the provided address', async () => {
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockGeocodeAddress).toHaveBeenCalledWith('100 Main St, Georgetown, KY');
  });

  test('passes originState to findNearestSchool (CONSTRAINT-006)', async () => {
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockFindNearestSchool).toHaveBeenCalledWith(expect.any(String), 'KY');
  });

  test('passes originState to findNearestHospital (CONSTRAINT-006)', async () => {
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockFindNearestHospital).toHaveBeenCalledWith(expect.any(String), 'KY');
  });

  test('passes originState to findNearestUrgentCare (CONSTRAINT-006)', async () => {
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockFindNearestUrgentCare).toHaveBeenCalledWith(expect.any(String), 'KY');
  });

  test('passes originState to findNearestElementarySchool (CONSTRAINT-006)', async () => {
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockFindNearestElementarySchool).toHaveBeenCalledWith(expect.any(String), 'KY');
  });

  test('returns an object with an html property', async () => {
    const result = await buildReport('100 Main St, Georgetown, KY');
    expect(result).toHaveProperty('html');
    expect(typeof result.html).toBe('string');
  });

  test('handles a data module failure gracefully (null result)', async () => {
    mockFindNearestGrocery.mockRejectedValue(new Error('API down'));
    const result = await buildReport('100 Main St, Georgetown, KY');
    expect(result).toHaveProperty('html');
  });
});
```

- [ ] **Run to verify it fails**

```bash
npm test -- --testPathPattern=reportBuilder
```

Expected: FAIL — module not found.

- [ ] **Implement `src/services/reportBuilder.js`**

```js
'use strict';

const { geocodeAddress } = require('../shared/google/geocoding');
const { reverseGeocodeAddress } = require('../shared/google/reverseGeocode');
const { getDriveTime, getTrafficVariations } = require('../shared/google/distanceMatrix');
const { googleMapsClient, googleMapsApiKey } = require('../shared/google/client');
const { findNearestGrocery, findNearestPharmacy, findNearestGasStation } = require('../modules/reachability/data');
const { findNearestHighwayOnRamp } = require('../modules/access/data');
const { findNearestHospital, findNearestUrgentCare } = require('../modules/health/data');
const { findNearestSchool, findNearestElementarySchool } = require('../modules/schools/data');
const { findNearestPark, findNearestCoffeeShop } = require('../modules/recreation/data');
const { getPremiumData } = require('../premium');
const { saveReport } = require('./reportStore');
const { logRequest, logError, logAnalysis } = require('../logger');
const { buildReportHTML } = require('../templates/pages/reportPage');
const { QuotaExceededError, RateLimitError } = require('../rateLimit');

function classifyError(error) {
  if (error instanceof QuotaExceededError) {
    return { type: 'QUOTA_EXCEEDED', title: 'Quota limit reached', message: error.message, retryAfter: null };
  }
  if (error instanceof RateLimitError) {
    return { type: 'RATE_LIMIT', title: "We're experiencing high demand", message: error.message, retryAfter: error.retryAfter || 30 };
  }
  const msg = (error.message || '').toLowerCase();
  const status = error.response?.status;
  if (msg.includes('unable to geocode')) {
    return { type: 'ADDRESS_NOT_FOUND', title: "We couldn't find that address", message: 'Check the spelling and try again.', retryAfter: null };
  }
  if (status === 429 || msg.includes('quota') || msg.includes('rate limit')) {
    return { type: 'RATE_LIMIT', title: 'High demand right now', message: 'Please try again in a moment.', retryAfter: 30 };
  }
  return { type: 'SERVER_ERROR', title: 'Something went wrong', message: 'An error occurred generating your report.', retryAfter: null };
}

async function buildReport(address, options = {}) {
  const _reqStart = Date.now();

  const origin = await geocodeAddress(address);
  const originLatLng = `${origin.lat},${origin.lng}`;
  const locationInfo = await reverseGeocodeAddress(originLatLng);
  const originState = locationInfo.state;

  const results = await Promise.allSettled([
    findNearestGrocery(originLatLng),
    findNearestPharmacy(originLatLng),
    findNearestHospital(originLatLng, originState),
    findNearestUrgentCare(originLatLng, originState),
    findNearestHighwayOnRamp(originLatLng),
    findNearestSchool(originLatLng, originState),
    findNearestGasStation(originLatLng),
    findNearestPark(originLatLng),
    findNearestCoffeeShop(originLatLng),
    findNearestElementarySchool(originLatLng, originState),
  ]);

  const [grocery, pharmacy, hospital, urgentCare, highwayRamp, school, gasStation, park, coffeeShop, elementarySchool] =
    results.map((r) => (r.status === 'fulfilled' ? r.value : null));

  const rawNames     = [].concat(options.customDestName    || []);
  const rawAddresses = [].concat(options.customDestAddress || []);
  const rawTypes     = [].concat(options.customDestType    || []);
  const rawCustomDests = [];
  for (let i = 0; i < Math.min(rawAddresses.length, 10); i++) {
    const addr = (rawAddresses[i] || '').trim();
    if (addr) rawCustomDests.push({ name: (rawNames[i] || 'Destination').trim(), address: addr, type: rawTypes[i] || 'other' });
  }

  const customDestResults = await Promise.allSettled(
    rawCustomDests.map(async ({ name, address: destAddr, type }) => {
      const location = await geocodeAddress(destAddr);
      const driveTimeMinutes = await getDriveTime(originLatLng, location);
      return { name, address: destAddr, type, location, driveTimeMinutes };
    }),
  );
  const customDestinations = customDestResults
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);

  const g0 = Array.isArray(grocery) ? grocery[0] : grocery;
  const trafficTargets = [];
  if (g0?.location) trafficTargets.push({ name: g0.name, location: g0.location });
  if (hospital?.location) trafficTargets.push({ name: hospital.name, location: hospital.location });
  customDestinations
    .filter((d) => d.type === 'work' && d.location)
    .forEach((d) => trafficTargets.push({ name: d.name, location: d.location }));

  const trafficResults = await Promise.allSettled(
    trafficTargets.map((t) => getTrafficVariations(originLatLng, t.location)),
  );
  const trafficData = trafficTargets
    .map((t, i) => ({ ...t, traffic: trafficResults[i].status === 'fulfilled' ? trafficResults[i].value : null }))
    .filter((t) => t.traffic !== null);

  const highwayDriveMinutes = highwayRamp?.driveTimeMinutes ?? null;
  let premium = null;
  try {
    premium = await getPremiumData({
      lat: origin.lat,
      lng: origin.lng,
      originLatLng,
      locationInfo,
      googleMapsClient,
      googleMapsApiKey,
      getDriveTime,
      highwayDriveMinutes,
    });
  } catch (premErr) {
    console.error('[Premium] fetch error:', premErr.message);
    logError('getPremiumData', address, premErr);
  }

  let reportId = null;
  try { reportId = saveReport(address); } catch {}
  logRequest(address, 'success', Date.now() - _reqStart);
  logAnalysis();

  const html = buildReportHTML(address, {
    grocery, pharmacy, hospital, urgentCare, highwayRamp, school, gasStation,
    park, coffeeShop, elementarySchool, customDestinations, trafficData,
    origin, reportId, premium,
  });

  return { html, reportId, address };
}

module.exports = { buildReport, classifyError };
```

- [ ] **Run tests to verify they pass**

```bash
npm test -- --testPathPattern=reportBuilder
```

Expected: all 7 tests pass.

- [ ] **Run full suite**

```bash
npm test
```

Expected: 160+ tests pass, no regressions.

- [ ] **Commit**

```bash
git add src/services/reportBuilder.js tests/services/reportBuilder.test.js
git commit -m "feat(fr-041): extract reportBuilder.js — report orchestration, wire originState"
```

---

## Task 8: Slim app.js

**Files:**
- Modify: `src/app.js`

Remove all extracted functions from app.js. Route handlers become thin wrappers. app.js should contain: imports, Express setup, static file serving, route definitions, app.listen.

- [ ] **Replace `src/app.js` entirely with the slimmed version**

```js
'use strict';

const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const { cacheStats, geocodeCache, placesCache, driveTimeCache } = require('./cache');
const { getUsageStats } = require('./rateLimit');
const { googleMapsApiKey } = require('./shared/google/client');
const { toTitleCase } = require('./utils/text');
const { MAX_CONCURRENT_PDFS } = require('./utils/constants');
const { logError, logRequest, logAnalysis, readRecentLogs } = require('./logger');
const { loadMitigations } = require('./errorMemory');
const { slugify, getDateSlug } = require('./utils/text');

const { buildReport, classifyError } = require('./services/reportBuilder');
const { saveReport, getReport, updateReportAccess } = require('./services/reportStore');
const { generateComparisonData } = require('./services/compareBuilder');
const { buildErrorHTML, buildLoadingHTML } = require('./templates/pages/errorPage');
const { buildCompareFormHTML, buildCompareLoadingHTML, buildCompareResultsHTML } = require('./templates/pages/comparePage');
const { buildAdminHealthHTML } = require('./templates/pages/adminPage');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../public')));

// ── Report ────────────────────────────────────────────────────────────────────

app.get('/report', async (req, res) => {
  const address = req.query.address ? toTitleCase(req.query.address.trim()) : '';
  const isFetch = req.query.fetch === '1';

  if (!address) return res.send(buildErrorHTML('SERVER_ERROR', 'No address provided', 'Please go back and enter an address.', null, null));
  if (!googleMapsApiKey) return res.send(buildErrorHTML('SERVER_ERROR', 'Configuration error', 'The server is missing required API credentials.', null, null));
  if (!isFetch) return res.send(buildLoadingHTML(address));

  const _reqStart = Date.now();
  try {
    const options = {
      customDestName: req.query.customDestName,
      customDestAddress: req.query.customDestAddress,
      customDestType: req.query.customDestType,
    };
    const { html } = await buildReport(address, options);
    return res.send(html);
  } catch (error) {
    const { type, title, message, retryAfter } = classifyError(error);
    logError('report', address, error);
    logRequest(address, 'error', Date.now() - _reqStart, type);
    logAnalysis();
    return res.send(buildErrorHTML(type, title, message, address, retryAfter));
  }
});

app.get('/r/:reportId', (req, res) => {
  const report = getReport(req.params.reportId);
  if (!report) return res.status(404).send(buildErrorHTML('SERVER_ERROR', 'Report not found', 'This link may have expired or is invalid.', null, null));
  try { updateReportAccess(req.params.reportId); } catch {}
  return res.redirect(`/report?address=${encodeURIComponent(report.address)}`);
});

// ── Compare ───────────────────────────────────────────────────────────────────

app.get('/compare', async (req, res) => {
  const addressesParam = req.query.addresses;
  if (!addressesParam) return res.send(buildCompareFormHTML());
  if (req.query.fetch !== '1') return res.send(buildCompareLoadingHTML(addressesParam));

  const addresses = addressesParam.split('|').map((a) => a.trim()).filter(Boolean).slice(0, 3);
  if (addresses.length < 2) return res.send(buildErrorHTML('SERVER_ERROR', 'At least 2 addresses required', 'Please go back and enter at least 2 addresses.', null, null));

  const reportResults = await Promise.allSettled(addresses.map((addr) => generateComparisonData(addr)));
  const reports = reportResults.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { address: addresses[i], error: r.reason?.message || 'Unknown error' },
  );
  return res.send(buildCompareResultsHTML(reports));
});

// ── Admin ─────────────────────────────────────────────────────────────────────

app.get('/admin/health', (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || '';
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) return res.status(403).send('Forbidden');

  let patterns = null;
  try { patterns = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/error-patterns.json'), 'utf8')); } catch {}
  const mitigations = loadMitigations();
  const recentErrors = readRecentLogs(1).filter((e) => e.type === 'error').slice(-20).reverse();
  const usage = getUsageStats();

  return res.send(buildAdminHealthHTML({ patterns, mitigations, recentErrors, usage }));
});

app.get('/admin/api-usage', (req, res) => res.json(getUsageStats()));
app.post('/admin/clear-cache', (req, res) => {
  geocodeCache.clear(); placesCache.clear(); driveTimeCache.clear();
  res.json({ success: true, message: 'All caches cleared' });
});
app.get('/admin/cache-stats', (req, res) => res.json(cacheStats()));

// ── History ───────────────────────────────────────────────────────────────────

app.get('/history', (req, res) => res.sendFile(path.join(__dirname, '../public/history.html')));

// ── PDF Export ────────────────────────────────────────────────────────────────

let activePDFs = 0;

app.get('/report/pdf', async (req, res) => {
  const address = req.query.address ? toTitleCase(req.query.address.trim()) : '';
  if (!address) return res.status(400).send('Address required');

  while (activePDFs >= MAX_CONCURRENT_PDFS) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  activePDFs++;

  let browser;
  try {
    const params = new URLSearchParams(req.query);
    params.set('fetch', '1');
    const reportUrl = `http://localhost:${port}/report?${params.toString()}`;

    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const url = r.url();
      if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) r.abort();
      else r.continue();
    });
    await page.emulateMediaType('print');
    await page.goto(reportUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdf = await page.pdf({ format: 'Letter', printBackground: true, margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' } });

    const filename = `livably-report-${slugify(address)}-${getDateSlug()}.pdf`;
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"`, 'Content-Length': pdf.length });
    res.send(pdf);
  } catch (error) {
    console.error('[PDF] generation error:', error.message);
    res.status(500).send(buildErrorHTML('SERVER_ERROR', 'PDF generation failed', 'Unable to generate PDF. Please try again.', address, null));
  } finally {
    if (browser) await browser.close().catch(() => {});
    activePDFs--;
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(port, () => console.log(`Livably app running at http://localhost:${port}`));
```

- [ ] **Verify the server loads**

```bash
node -e "require('./src/app')"
```

Expected: no errors (clean exit).

- [ ] **Run full test suite**

```bash
npm test
```

Expected: all tests pass (same count as before this task + new tests from Tasks 2–7).

- [ ] **Check app.js line count**

```bash
wc -l src/app.js
```

Expected: substantially reduced from 1128 lines.

- [ ] **Commit**

```bash
git add src/app.js
git commit -m "feat(fr-041): slim app.js — pure Express config and route shells"
```

---

## Task 9: Verification and Summary

- [ ] **Run the full test suite**

```bash
npm test
```

Expected: all tests pass, no regressions.

- [ ] **Verify acceptance criteria**

```bash
# app.js contains no HTML generation
grep -n "<!DOCTYPE\|return \`<html\|res\.send(\`" src/app.js
# Expected: zero matches

# app.js contains no API calls
grep -n "require('axios')\|require('@googlemaps')\|googleMapsClient\." src/app.js
# Expected: zero matches

# originState is wired
grep -n "originState" src/services/reportBuilder.js
# Expected: multiple matches showing it being passed to school/health functions
```

- [ ] **Write `feature-requests/FR-041-services-routes/summary.md`**

Fill in what was done, list files created/modified, and note the deferred items (ruralMode wiring, admin inline styles).

- [ ] **Final commit**

```bash
git add feature-requests/FR-041-services-routes/summary.md
git commit -m "docs(fr-041): add summary — services and routes extraction complete"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Covered by |
|---|---|
| `reportBuilder.js` exports `buildReport` | Task 7 |
| `reportStore.js` exports `saveReport`, `getReport`, `loadReports`, `updateReportAccess` | Task 2 |
| `app.js` ≤ 40 lines | Task 8 (realistic target is ~100 lines given route count; goal of zero HTML/logic/API is met) |
| `app.js` contains no HTML generation | Task 8 (verified by grep) |
| `app.js` contains no API calls | Task 8 (verified by grep) |
| `originState` passed to all data modules that accept it | Task 7 (school, elementarySchool, hospital, urgentCare) |
| `ruralMode` passed to `findNearestGrocery` | Deferred — needs census data not available before main fetch |
| Server HTTP 200 on all 5 test addresses | Covered by smoke.test.js + manual spot-check |
| `tests/services/reportBuilder.test.js` covers orchestration | Task 7 |

**Deferred items documented:**
- ruralMode wiring — needs census tractPopulation, currently only in premium.js. Deferred to FR-040 or dedicated FR.
- Admin dashboard inline styles — CONSTRAINT-008 violation, pre-existing, deferred.
- `buildHeroInsightRowsHTML` business logic in template — CONSTRAINT-009 violation, pre-existing, deferred.
