# FR-059 Seismic Risk (Climate enhancement) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add earthquake risk to the Climate chapter — a USGS-sourced seismic-hazard band with adaptive placement (L3 tab always, L2 promoted row only when moderate+, L4 design-values table).

**Architecture:** Contained to the `climate` module + `cache.js` + `constants.js`. `data.js` fetches the USGS ASCE 7-16 design service (cell-cached, 90-day TTL) and composes a `seismic` object into the existing `climateHistory` via a pure `logic.js#getSeismicContext`. `template.js` renders it. No `chapters.js` change (seismic rides along inside `climateHistory`).

**Tech Stack:** Node.js, Express, Jest, vanilla template strings. External API: USGS `earthquake.usgs.gov` (keyless), via `fetch`.

**Run tests with:** `npx jest <path>` (Windows PowerShell).

---

### Task 1: Constants

**Files:**
- Modify: `src/utils/constants.js`

- [ ] **Step 1: Add the constants block** (before `module.exports`, then add names to the exports object)

```js
// ── FR-059: Seismic risk (Climate) ───────────────────────────────────────────
const SEISMIC_DESIGNMAPS_URL = 'https://earthquake.usgs.gov/ws/designmaps/asce7-16.json';
const SEISMIC_CACHE_TTL_DAYS = 90; // USGS hazard model updates ~every 6 years

// Peak ground acceleration (g) -> layperson band. Evaluated as: first entry
// whose `max` the PGA is strictly below. Last entry is the catch-all.
// CONSTRAINT-001: a descriptive band, never a numeric score.
const PGA_BAND_THRESHOLDS = [
  { max: 0.05,     band: 'very-low',  label: 'Very low seismic hazard',  color: 'green'  },
  { max: 0.10,     band: 'low',       label: 'Low seismic hazard',       color: 'green'  },
  { max: 0.20,     band: 'moderate',  label: 'Moderate seismic hazard',  color: 'gold'   },
  { max: 0.40,     band: 'high',      label: 'High seismic hazard',      color: 'orange' },
  { max: Infinity, band: 'very-high', label: 'Very high seismic hazard', color: 'red'    },
];
```

Add `SEISMIC_DESIGNMAPS_URL`, `SEISMIC_CACHE_TTL_DAYS`, `PGA_BAND_THRESHOLDS` to `module.exports`.

- [ ] **Step 2: Verify load**

Run: `node -e "const c=require('./src/utils/constants'); console.log(c.SEISMIC_CACHE_TTL_DAYS, c.PGA_BAND_THRESHOLDS.length, c.PGA_BAND_THRESHOLDS[2].band)"`
Expected: `90 5 moderate`

- [ ] **Step 3: Commit**

```bash
git add src/utils/constants.js
git commit -m "feat(FR-059): seismic constants (USGS URL, PGA band thresholds, TTL)"
```

---

### Task 2: Logic — `getSeismicContext`

**Files:**
- Modify: `src/modules/climate/logic.js`
- Test: `tests/modules/climate/logic.test.js` (new if absent; otherwise append)

- [ ] **Step 1: Write the failing test**

Create/append `tests/modules/climate/logic.test.js`:
```js
'use strict';
const { getSeismicContext } = require('../../../src/modules/climate/logic');

describe('getSeismicContext', () => {
  const ctx = (pga) => getSeismicContext({ pga, ss: 0.5, s1: 0.2, sds: 0.4 });

  test('PGA band boundaries map per PGA_BAND_THRESHOLDS', () => {
    expect(ctx(0.04).band).toBe('very-low');
    expect(ctx(0.05).band).toBe('low');      // 0.05 is NOT < 0.05 -> next band
    expect(ctx(0.084).band).toBe('low');     // Georgetown KY
    expect(ctx(0.10).band).toBe('moderate'); // 0.10 not < 0.10
    expect(ctx(0.15).band).toBe('moderate');
    expect(ctx(0.30).band).toBe('high');     // Bozeman MT
    expect(ctx(0.40).band).toBe('very-high');
    expect(ctx(0.9).band).toBe('very-high');
  });

  test('promote is true only for moderate and above', () => {
    expect(ctx(0.084).promote).toBe(false); // low
    expect(ctx(0.04).promote).toBe(false);  // very-low
    expect(ctx(0.15).promote).toBe(true);   // moderate
    expect(ctx(0.30).promote).toBe(true);   // high
    expect(ctx(0.5).promote).toBe(true);    // very-high
  });

  test('carries through values, label, color; narrative mentions the pga and no score words', () => {
    const r = ctx(0.30);
    expect(r.pga).toBe(0.30);
    expect(r.ss).toBe(0.5);
    expect(r.color).toBe('orange');
    expect(r.label).toMatch(/High seismic hazard/);
    expect(typeof r.narrative).toBe('string');
    expect(r.narrative).toMatch(/0\.30g/);
    expect(r.narrative.toLowerCase()).not.toMatch(/score|grade|rating|out of/);
  });

  test('returns null for missing/invalid input', () => {
    expect(getSeismicContext(null)).toBeNull();
    expect(getSeismicContext({})).toBeNull();
    expect(getSeismicContext({ pga: 0 })).toBeNull();
    expect(getSeismicContext({ pga: 'x' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx jest tests/modules/climate/logic.test.js -t getSeismicContext`
Expected: FAIL — `getSeismicContext is not a function`

- [ ] **Step 3: Implement** (append to `src/modules/climate/logic.js`; add `getSeismicContext` to its `module.exports`)

```js
const { PGA_BAND_THRESHOLDS } = require('../../utils/constants');

// Pure: USGS ASCE 7-16 design values -> layperson seismic band + narrative.
// CONSTRAINT-001: descriptive band, never a numeric score.
function getSeismicContext(raw) {
  const pga = Number(raw && raw.pga);
  if (!pga || isNaN(pga) || pga <= 0) return null;

  const t = PGA_BAND_THRESHOLDS.find((b) => pga < b.max) || PGA_BAND_THRESHOLDS[PGA_BAND_THRESHOLDS.length - 1];
  const promote = t.band === 'moderate' || t.band === 'high' || t.band === 'very-high';
  const pgaG = pga.toFixed(2);

  let narrative;
  if (t.band === 'very-low' || t.band === 'low') {
    narrative =
      `USGS models ${t.band === 'very-low' ? 'very low' : 'low'} earthquake ground motion here ` +
      `— peak ground acceleration about ${pgaG}g. Standard residential construction is well within ` +
      `tolerance; seismic upgrades aren't a concern at this address.`;
  } else if (t.band === 'moderate') {
    narrative =
      `USGS models moderate earthquake ground motion here — peak ground acceleration about ${pgaG}g. ` +
      `Worth confirming the home meets current building code; ask the inspector about foundation ` +
      `bracing and a strapped water heater.`;
  } else {
    narrative =
      `This is seismically active country — USGS models ${t.band === 'very-high' ? 'very high' : 'high'} ` +
      `ground motion (peak ground acceleration about ${pgaG}g). Confirm the home was built to or ` +
      `retrofitted for modern seismic code, and ask specifically about foundation anchoring, ` +
      `cripple-wall bracing, and a strapped water heater.`;
  }

  return {
    pga,
    ss:  Number(raw.ss)  || null,
    s1:  Number(raw.s1)  || null,
    sds: Number(raw.sds) || null,
    band: t.band,
    label: t.label,
    color: t.color,
    promote,
    narrative,
  };
}
```

> The existing `module.exports = { ... }` in `logic.js` lists several helpers — add `getSeismicContext` to it without removing the others.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest tests/modules/climate/logic.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/climate/logic.js tests/modules/climate/logic.test.js
git commit -m "feat(FR-059): getSeismicContext — PGA band + narrative (logic)"
```

---

### Task 3: Data — cache + `getSeismicHazard` + wire into `getClimateHistoryData`

**Files:**
- Modify: `src/cache.js` (add `seismicCache`)
- Modify: `src/modules/climate/data.js`
- Test: `tests/modules/climate/data.test.js` (new if absent; otherwise append)

- [ ] **Step 1: Add `seismicCache` to `src/cache.js`**

Add `SEISMIC_CACHE_TTL_DAYS` to the top-level `require('./utils/constants')` destructure. After `watershedCache`, add:
```js
// FR-059: USGS seismic hazard is effectively static — cache long, keyed by cell.
const seismicCache = new Cache('seismic', 60 * 60 * 24 * SEISMIC_CACHE_TTL_DAYS); // 90 days
```
Add `seismic: files.filter((f) => seismicCache._ownsFile(f)).length` to the `cacheStats()` breakdown, and add `seismicCache` to `module.exports`.

- [ ] **Step 2: Write the failing test**

Create/append `tests/modules/climate/data.test.js`:
```js
'use strict';
const { getSeismicHazard } = require('../../../src/modules/climate/data');
const { seismicCache } = require('../../../src/cache');

const RESP = (data) => ({ ok: true, json: async () => ({ response: { data } }) });

beforeEach(() => seismicCache.clear());
afterEach(() => { global.fetch = undefined; });
afterAll(() => seismicCache.clear());

describe('getSeismicHazard', () => {
  test('parses pga/ss/s1/sds from the USGS designmaps response', async () => {
    global.fetch = jest.fn().mockResolvedValue(RESP({ pga: 0.3, ss: 0.68, s1: 0.213, sds: 0.569 }));
    const r = await getSeismicHazard(45.68, -111.04);
    expect(r).toEqual({ pga: 0.3, ss: 0.68, s1: 0.213, sds: 0.569 });
  });

  test('cell-caches: second call for the same cell makes no new fetch', async () => {
    global.fetch = jest.fn().mockResolvedValue(RESP({ pga: 0.084, ss: 0.168, s1: 0.082, sds: 0.179 }));
    await getSeismicHazard(38.2098, -84.5588);
    const calls = global.fetch.mock.calls.length;
    await getSeismicHazard(38.2098, -84.5588);
    expect(global.fetch.mock.calls.length).toBe(calls);
  });

  test('caches a negative (ok response, no pga) and serves null without re-fetch', async () => {
    global.fetch = jest.fn().mockResolvedValue(RESP({}));
    expect(await getSeismicHazard(10, 10)).toBeNull();
    const calls = global.fetch.mock.calls.length;
    expect(await getSeismicHazard(10, 10)).toBeNull();
    expect(global.fetch.mock.calls.length).toBe(calls); // negative cached
  });

  test('non-ok response returns null and is NOT cached (transient)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    expect(await getSeismicHazard(20, 20)).toBeNull();
    const calls = global.fetch.mock.calls.length;
    await getSeismicHazard(20, 20);
    expect(global.fetch.mock.calls.length).toBeGreaterThan(calls); // re-attempted
  });

  test('searches from the cell centroid (not the raw point)', async () => {
    const seen = [];
    global.fetch = jest.fn((url) => { seen.push(url); return Promise.resolve(RESP({ pga: 0.1 })); });
    await getSeismicHazard(45.68, -111.04);
    // centroid coords differ from the raw 45.68/-111.04; just assert a USGS designmaps URL was hit
    expect(seen[0]).toContain('earthquake.usgs.gov/ws/designmaps/asce7-16.json');
    expect(seen[0]).toContain('latitude=');
  });
});
```

- [ ] **Step 3: Run to verify fail**

Run: `npx jest tests/modules/climate/data.test.js -t getSeismicHazard`
Expected: FAIL — `getSeismicHazard is not a function`

- [ ] **Step 4: Implement in `src/modules/climate/data.js`**

Add to the constants import at the top of the file:
```js
const { SEISMIC_DESIGNMAPS_URL } = require('../../utils/constants');
```
(The file already imports `WATERSHED_CELL_RESOLUTION`, `snapToCellAtResolution`, and from `../../cache`. Add `seismicCache` to the existing `require('../../cache')` destructure, and `getSeismicContext` to the existing `require('./logic')` destructure.)

Add the fetcher (near `getNamedWatershed`, which it mirrors):
```js
// Cell-cached (FR-058): USGS ASCE 7-16 seismic design values. Negatives cached
// as { pga: null } (mirrors getNamedWatershed); transient errors not cached.
async function getSeismicHazard(lat, lng) {
  const { cellId, centroid } = snapToCellAtResolution({ lat, lng }, WATERSHED_CELL_RESOLUTION);

  const cached = seismicCache.get(cellId);
  if (cached) return cached.pga != null ? cached : null;

  try {
    const url =
      `${SEISMIC_DESIGNMAPS_URL}?latitude=${centroid.lat}&longitude=${centroid.lng}` +
      `&riskCategory=II&siteClass=D&title=livably`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json' } });
    if (!resp.ok) return null; // transient — not cached
    const data = await resp.json();
    const d = data?.response?.data || {};
    const pga = Number(d.pga);
    if (!pga || isNaN(pga)) { seismicCache.set(cellId, { pga: null }); return null; }
    const result = { pga, ss: Number(d.ss) || null, s1: Number(d.s1) || null, sds: Number(d.sds) || null };
    seismicCache.set(cellId, result);
    return result;
  } catch {
    return null; // transient errors not cached
  }
}
```

- [ ] **Step 5: Wire into `getClimateHistoryData`**

The function runs a `Promise.allSettled([...])`. Append `getSeismicHazard(lat, lng)` as the LAST element of that array and `seismicResult` as the LAST destructured entry (existing positions unchanged). After the `val(...)` extractions, add:
```js
  const seismic = getSeismicContext(val(seismicResult, null));
```
Add `seismic,` to the returned object (alongside `climateNormals`, `watershed`, etc.).

Export `getSeismicHazard` in `data.js`'s `module.exports`.

- [ ] **Step 6: Run to verify pass**

Run: `npx jest tests/modules/climate/data.test.js`
Expected: PASS. Also run `npx jest tests/cache.test.js` (cache change) and `npx jest tests/chapters/climate-data.test.js` if it exists (wiring didn't break composition).

- [ ] **Step 7: Commit**

```bash
git add src/cache.js src/modules/climate/data.js tests/modules/climate/data.test.js
git commit -m "feat(FR-059): cell-cached getSeismicHazard + wire seismic into climateHistory"
```

---

### Task 4: Template — L2 row + L3 tab + L4 table

**Files:**
- Modify: `src/modules/climate/template.js`
- Test: `tests/modules/climate/template.test.js` (append)

Semantic classes only, **no inline styles** (CONSTRAINT-008); **no scoring** (CONSTRAINT-001). Reuse existing classes (`prem-climate-row`, `prem-badge`, `climate-tab`, `climate-event-group`, `climate-research-section`, `climate-data-table`, `prem-disclaimer`).

- [ ] **Step 1: Write the failing test** (append to `tests/modules/climate/template.test.js`)

```js
const { buildClimateChapterHTML } = require('../../../src/modules/climate/template');

const baseEnv = { floodRisk: { zone: 'X', risk: 'Minimal', insuranceRequired: false, description: 'x' } };
const loc = { state: 'MT', county: 'Gallatin' };
const seismicHistory = (band, promote, color) => ({
  stormEvents: { tornadoes: [], floods: [], winterStorms: [], heatEvents: [], allEvents: [] },
  femaDeclarations: { weatherRelated: [], all: [], count: 0 },
  climateNormals: null, preparedness: {}, basementContext: null, watershed: null,
  glance: { lastSignificantEvent: null },
  seismic: { pga: 0.30, ss: 0.68, s1: 0.213, sds: 0.569, band, label: `${band} seismic hazard`, color, promote, narrative: `USGS models ${band} ground motion ~0.30g.` },
});

describe('Climate seismic placement', () => {
  test('L2 promoted row appears when promote=true (moderate+)', () => {
    const html = buildClimateChapterHTML(baseEnv, seismicHistory('high', true, 'orange'), loc);
    expect(html).toMatch(/Earthquake Risk/);
    expect(html).toContain('prem-climate-row');
  });
  test('L2 row absent when promote=false (low), but L3 Earthquake tab still present', () => {
    const html = buildClimateChapterHTML(baseEnv, seismicHistory('low', false, 'green'), loc);
    expect(html).not.toMatch(/Earthquake Risk/);   // no promoted L2 row
    expect(html).toMatch(/id="ctab-seismic"/);     // L3 tab still there
  });
  test('L4 design-values table present when seismic present', () => {
    const html = buildClimateChapterHTML(baseEnv, seismicHistory('high', true, 'orange'), loc);
    expect(html).toMatch(/Seismic Design Values/);
    expect(html.toLowerCase()).toContain('peak ground acceleration');
  });
  test('no seismic -> no tab, no row, no table', () => {
    const noSeis = seismicHistory('high', true, 'orange'); delete noSeis.seismic;
    const html = buildClimateChapterHTML(baseEnv, noSeis, loc);
    expect(html).not.toMatch(/ctab-seismic/);
    expect(html).not.toMatch(/Seismic Design Values/);
  });
  test('no scoring language, no extra inline styles in seismic output', () => {
    const html = buildClimateChapterHTML(baseEnv, seismicHistory('high', true, 'orange'), loc);
    expect(html.toLowerCase()).not.toMatch(/seismic score|hazard score|out of 10/);
    // sun/cloud SVGs use --path-len custom props (tolerated); assert no NON-custom-prop styles slipped in via seismic
    expect(html).not.toMatch(/<div class="prem-climate-row"[^>]*style="/);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx jest tests/modules/climate/template.test.js -t "Climate seismic"`
Expected: FAIL (no seismic markup yet)

- [ ] **Step 3: Implement — L2 row**

In `buildClimateChapterHTML`, after the `tornadoHTML` constant, add:
```js
  // ── Seismic row (promoted to L2 only when moderate+) ──────────────────────
  const seismic = climateHistory?.seismic || null;
  const seismicRowHTML = (seismic && seismic.promote) ? `
    <div class="prem-climate-row">
      <div class="prem-climate-row-label">
        🌐 Earthquake Risk
        <span class="prem-badge ${badgeClass(seismic.color)}">${escapeHtml(seismic.label)}</span>
      </div>
      <p class="prem-climate-row-body">${escapeHtml(seismic.narrative)}</p>
    </div>` : '';
```
In `leftHTML`, add `${seismicRowHTML}` on its own line immediately after `${tornadoHTML}`.

- [ ] **Step 4: Implement — L3 tab**

In `buildClimateDeepDiveHTML`, add `seismic` to the destructure:
```js
  const { stormEvents, femaDeclarations, climateNormals, preparedness, basementContext, watershed, seismic } = climateHistory;
```
After the `tabs` array is defined, append the seismic tab conditionally (before computing `tabButtons`/`tabPanels`):
```js
  if (seismic) tabs.push({ id: 'seismic', label: 'Earthquake', content: buildSeismicTab(seismic) });
```
Add the helper:
```js
function buildSeismicTab(seismic) {
  const pgaG = seismic.pga.toFixed(2);
  return `
    <p class="prem-narrative-body"><span class="prem-badge ${badgeClass(seismic.color)}">${escapeHtml(seismic.label)}</span></p>
    <p class="prem-narrative-body">${escapeHtml(seismic.narrative)}</p>
    <div class="climate-event-group">
      <div class="climate-event-group-label">What the numbers mean</div>
      <p class="prem-narrative-body">Peak ground acceleration (PGA) of about <strong>${pgaG}g</strong> is the shaking intensity engineers design for — higher means stronger expected ground motion. S<sub>S</sub> and S<sub>1</sub> are the short- and long-period spectral accelerations used to design earthquake-resistant structures.</p>
    </div>
    <p class="prem-disclaimer">Source: USGS Seismic Design Maps (ASCE 7-16), risk category II, site class D (default stiff soil — a geotechnical test determines the actual site class). Modeled hazard, not a parcel inspection.</p>`;
}
```

- [ ] **Step 5: Implement — L4 table**

In `buildClimateResearchHTML`, add `seismic` to the destructure:
```js
  const { stormEvents, climateNormals, watershed, seismic } = climateHistory;
```
Add the table HTML (after `watershedHTML` is built):
```js
  const seismicTableHTML = seismic ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Seismic Design Values (ASCE 7-16)</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Parameter</th><th>Value (g)</th></tr></thead>
          <tbody>
            <tr><td>PGA — peak ground acceleration</td><td>${seismic.pga.toFixed(3)}</td></tr>
            <tr><td>S<sub>S</sub> — 0.2s spectral</td><td>${seismic.ss != null ? seismic.ss.toFixed(3) : '—'}</td></tr>
            <tr><td>S<sub>1</sub> — 1.0s spectral</td><td>${seismic.s1 != null ? seismic.s1.toFixed(3) : '—'}</td></tr>
            <tr><td>S<sub>DS</sub> — design short-period</td><td>${seismic.sds != null ? seismic.sds.toFixed(3) : '—'}</td></tr>
          </tbody>
        </table>
      </div>
      <p class="prem-disclaimer">Source: <a href="https://www.usgs.gov/programs/earthquake-hazards/science/seismic-design-maps" target="_blank" rel="noopener noreferrer">USGS Seismic Design Maps</a> (ASCE 7-16, risk category II, site class D).</p>
    </div>` : '';
```
Update the early-return guard to include seismic, and add the table to the output. Change:
```js
  if (!eventRows && !normalRows && !watershedHTML) return '';
```
to:
```js
  if (!eventRows && !normalRows && !watershedHTML && !seismicTableHTML) return '';
```
and add `${seismicTableHTML}` to the returned template (e.g., right after `${watershedHTML}`).

- [ ] **Step 6: Run to verify pass**

Run: `npx jest tests/modules/climate/template.test.js`
Expected: PASS (existing + new). Also run `npx jest tests/constraints/no-inline-styles.test.js tests/constraints/no-scoring.test.js` — must stay green.

- [ ] **Step 7: Commit**

```bash
git add src/modules/climate/template.js tests/modules/climate/template.test.js
git commit -m "feat(FR-059): seismic L2 row + L3 Earthquake tab + L4 design-values table"
```

---

### Task 5: Full suite, live verify, summary, roadmap, PR

**Files:**
- Create: `feature-requests/FR-059-seismic-risk/summary.md`
- Modify: `docs/IMPLEMENTATION_ROADMAP.md`

- [ ] **Step 1: Full suite**

Run: `npx jest`
Expected: PASS — prior count + new FR-059 tests, zero failures.

- [ ] **Step 2: Live 5-address verify**

Run a small script (USGS is reachable — verified during discovery) hitting `getSeismicHazard` + `getSeismicContext` for the 5 test coordinates and confirm bands:
```bash
node -e '
const { getSeismicHazard } = require("./src/modules/climate/data");
const { getSeismicContext } = require("./src/modules/climate/logic");
const pts = [["Georgetown KY",38.2098,-84.5588],["Harlan KY",36.8407,-83.3216],["Louisville KY",38.2542,-85.7594],["Bozeman MT",45.6796,-111.0386],["Jeffersonville IN",38.2776,-85.7372]];
(async()=>{for(const [n,la,ln] of pts){const raw=await getSeismicHazard(la,ln);const c=getSeismicContext(raw);console.log(`${n}: ${c?`${c.band} (pga ${c.pga}) promote=${c.promote}`:"null"}`);}})();
'
```
Confirm: Bozeman → `high`/`moderate` with `promote=true`; the four KY/IN addresses → `low`/`very-low` with `promote=false`. (If USGS is unreachable in the environment, note it — the chapter omits seismic gracefully; verify the unit + cache tests instead.)

- [ ] **Step 3: Write `summary.md`**

Document: what shipped, the adaptive placement, the USGS source + cell-cache, the live 5-address bands (or note if USGS unreachable), the modeling assumptions (riskCategory II / siteClass D), and that it's an enhancement to Climate (not a new chapter, per the fit-data-into-existing-chapters principle).

- [ ] **Step 4: Update roadmap**

In `docs/IMPLEMENTATION_ROADMAP.md`, note FR-059 (seismic risk added to Climate) under the appropriate section, and that the Sketch (Phase 6) is deferred.

- [ ] **Step 5: Commit + PR**

```bash
git add feature-requests/FR-059-seismic-risk/summary.md docs/IMPLEMENTATION_ROADMAP.md
git commit -m "docs(FR-059): summary + roadmap"
git push -u origin FR-059-seismic-risk
gh pr create --title "FR-059: Seismic risk in the Climate chapter" --body "<from summary.md>"
```

---

## Self-Review

**Spec coverage:**
- Data: `getSeismicHazard` (USGS, cell-cached, negatives cached) → Task 3 ✅
- Logic: `getSeismicContext` (PGA→band, promote, narrative, null) → Task 2 ✅
- Constants (URL, thresholds, TTL) → Task 1 ✅
- Cache (`seismicCache`) → Task 3 ✅
- Wiring into `getClimateHistoryData` (`seismic` in `climateHistory`) → Task 3 ✅
- L2 promoted row (moderate+ only) → Task 4 ✅
- L3 "Earthquake" tab (always when present) → Task 4 ✅
- L4 design-values table + USGS source w/ assumptions → Task 4 ✅
- Graceful null omission (no tab/row/table) → Task 4 test ✅
- Constraints 001/008/009/011/015 + cost cell-cache → Tasks 2/3/4 tests + constraint suite ✅
- All 5 addresses + Bozeman-promotes verify → Task 5 ✅

**Placeholder scan:** No TBD/TODO in code steps. `<from summary.md>` is the intentional PR-body fill-in.

**Type consistency:** `getSeismicHazard` → `{pga,ss,s1,sds}|null`; `getSeismicContext({pga,ss,s1,sds})` → `{pga,ss,s1,sds,band,label,color,promote,narrative}|null`; `climateHistory.seismic` consumed by template L2 (`promote`,`color`,`label`,`narrative`), L3 (`buildSeismicTab` reads `pga`,`color`,`label`,`narrative`), L4 (`pga`,`ss`,`s1`,`sds`). `PGA_BAND_THRESHOLDS` is the single threshold source (logic + tests). Consistent across tasks. ✅
