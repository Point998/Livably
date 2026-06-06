# FR-034 Enhancement 6 — Named Watershed Context — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the named HUC-12 watershed (+ HUC-8 basin) for an address as L3/L4 deep-read context in the Climate chapter, augmenting the existing topographic-position feature.

**Architecture:** A new free USGS WBD fetch (`getNamedWatershed`) snaps the coordinate to an H3 cell *inside the data layer* (so neighbors share one fetch via a new file cache namespace), queries the Watershed Boundary Dataset at the cell centroid, and folds a `named` field into the existing `climateHistory.watershed` object. The template renders a brief factual callout at L3 (inside the Flood History tab) and an interpretive block at L4 (research), both gracefully absent when data is unavailable.

**Tech Stack:** Node.js, `fetch` + `AbortSignal.timeout`, `h3-js` (already a dependency), file-backed `Cache`, Jest.

---

## File Structure

- `src/shared/spatial.js` — add `snapToCellAtResolution(latLng, resolution)`; refactor `snapToCell` to use it. (Keeps H3 as the single tiling primitive — CONSTRAINT-014.)
- `src/utils/constants.js` — add `WATERSHED_CELL_RESOLUTION`.
- `src/cache.js` — add a `watershed` cache namespace (90-day TTL; WBD boundaries are effectively static).
- `src/modules/climate/data.js` — add `getNamedWatershed(lat, lng)`; wire into `getClimateHistoryData`; extend the returned `watershed` object with `named`.
- `src/modules/climate/template.js` — thread `namedWatershed` into `buildFloodTab` (L3 group); add `buildWatershedContextHTML` + restructure `buildClimateResearchHTML` (L4 block).
- Tests: `tests/shared/spatial.test.js`, `tests/modules/climate/data.test.js`, `tests/modules/climate/template.test.js`.

**No orchestrator (`chapters.js`) change:** `getChapterData` spreads `climateHistoryVal`, so the new `watershed.named` field flows through to the template untouched. Task 8 verifies this.

---

## Task 1: `snapToCellAtResolution` helper in spatial.js

**Files:**
- Modify: `src/shared/spatial.js`
- Test: `tests/shared/spatial.test.js`

- [ ] **Step 1: Write the failing test**

Add to `tests/shared/spatial.test.js` (create the file if it does not exist, with `const { snapToCell, snapToCellAtResolution } = require('../../src/shared/spatial');` at top):

```javascript
describe('snapToCellAtResolution', () => {
  test('returns a cellId, the resolution, and a centroid for a fixed resolution', () => {
    const out = snapToCellAtResolution({ lat: 38.2098, lng: -84.5588 }, 7);
    expect(typeof out.cellId).toBe('string');
    expect(out.cellId.length).toBeGreaterThan(0);
    expect(out.resolution).toBe(7);
    expect(out.centroid.lat).toBeCloseTo(38.2, 1);
    expect(out.centroid.lng).toBeCloseTo(-84.56, 1);
  });

  test('neighboring coordinates within the same cell share a cellId', () => {
    const a = snapToCellAtResolution({ lat: 38.2098, lng: -84.5588 }, 7);
    const b = snapToCellAtResolution({ lat: 38.2099, lng: -84.5589 }, 7);
    expect(a.cellId).toBe(b.cellId);
    expect(a.centroid).toEqual(b.centroid);
  });

  test('accepts a "lat,lng" string', () => {
    const out = snapToCellAtResolution('38.2098,-84.5588', 7);
    expect(out.resolution).toBe(7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/shared/spatial.test.js -t snapToCellAtResolution`
Expected: FAIL — `snapToCellAtResolution is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/shared/spatial.js`, add the function and refactor `snapToCell` to use it (DRY):

```javascript
// snapToCellAtResolution(latLng, resolution) -> { cellId, resolution, centroid }
// Resolution-parameterized tiling. snapToCell layers mode-driven resolution on top.
function snapToCellAtResolution(latLng, resolution) {
  const { lat, lng } = parseLatLng(latLng);
  const cellId = h3.latLngToCell(lat, lng, resolution);
  const [cLat, cLng] = h3.cellToLatLng(cellId);
  return { cellId, resolution, centroid: { lat: cLat, lng: cLng } };
}

function snapToCell(latLng, mode) {
  return snapToCellAtResolution(latLng, CELL_RESOLUTION_BY_MODE[mode]);
}
```

Update the exports line:

```javascript
module.exports = { snapToCell, snapToCellAtResolution, cellSearchOrigin, cellDriveOpts };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/shared/spatial.test.js`
Expected: PASS (including any pre-existing `snapToCell` tests — the refactor is behavior-preserving).

- [ ] **Step 5: Commit**

```bash
git add src/shared/spatial.js tests/shared/spatial.test.js
git commit -m "feat(fr-034): add snapToCellAtResolution tiling helper"
```

---

## Task 2: Watershed constant + cache namespace

**Files:**
- Modify: `src/utils/constants.js`
- Modify: `src/cache.js`

- [ ] **Step 1: Add the resolution constant**

In `src/utils/constants.js`, add (near the other FR-058/cell constants):

```javascript
// FR-034 enh 6: fixed H3 resolution for watershed caching. HUC-12 watersheds
// (~100+ km2) far exceed a res-7 cell (~5 km2), so neighbors reliably share one
// WBD fetch. Watershed is mode-independent, so this is fixed (not mode-driven).
const WATERSHED_CELL_RESOLUTION = 7;
```

Add `WATERSHED_CELL_RESOLUTION` to that file's `module.exports`.

- [ ] **Step 2: Add the cache namespace**

In `src/cache.js`, after the `driveTimeCellCache` definition, add:

```javascript
// FR-034 enh 6: USGS Watershed Boundary Dataset is effectively static — cache long.
const watershedCache = new Cache('watershed', 60 * 60 * 24 * 90); // 90 days
```

Add `watershedCache` to the `module.exports` object.

- [ ] **Step 3: Verify it loads**

Run: `node -e "console.log(require('./src/cache').watershedCache.namespace, require('./src/utils/constants').WATERSHED_CELL_RESOLUTION)"`
Expected: `watershed 7`

- [ ] **Step 4: Commit**

```bash
git add src/utils/constants.js src/cache.js
git commit -m "feat(fr-034): add watershed cache namespace and cell resolution constant"
```

---

## Task 3: `getNamedWatershed` data fetch

**Files:**
- Modify: `src/modules/climate/data.js`
- Test: `tests/modules/climate/data.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `tests/modules/climate/data.test.js`. At the top of the file ensure these requires exist:

```javascript
const { getNamedWatershed } = require('../../../src/modules/climate/data');
const { watershedCache } = require('../../../src/cache');
```

Then add:

```javascript
describe('getNamedWatershed', () => {
  // WBD layer 6 = HUC-12 (name), layer 4 = HUC-8 (basin name)
  const wbd = (name) => ({
    ok: true,
    json: async () => ({ features: name ? [{ attributes: { name } }] : [] }),
  });

  beforeEach(() => {
    watershedCache.clear();
    jest.restoreAllMocks();
  });

  test('returns huc12Name and basinName when both queries succeed', async () => {
    jest.spyOn(global, 'fetch').mockImplementation((url) =>
      Promise.resolve(/MapServer\/6\//.test(url)
        ? wbd('Dry Run-North Elkhorn Creek')
        : wbd('North Fork Elkhorn Creek')));
    const out = await getNamedWatershed(38.2098, -84.5588);
    expect(out).toEqual({ huc12Name: 'Dry Run-North Elkhorn Creek', basinName: 'North Fork Elkhorn Creek' });
  });

  test('returns basinName null when the HUC-8 query yields no feature', async () => {
    jest.spyOn(global, 'fetch').mockImplementation((url) =>
      Promise.resolve(/MapServer\/6\//.test(url) ? wbd('Dry Run-North Elkhorn Creek') : wbd(null)));
    const out = await getNamedWatershed(38.2098, -84.5588);
    expect(out).toEqual({ huc12Name: 'Dry Run-North Elkhorn Creek', basinName: null });
  });

  test('returns null when the HUC-12 query yields no feature', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(() => Promise.resolve(wbd(null)));
    const out = await getNamedWatershed(38.2098, -84.5588);
    expect(out).toBeNull();
  });

  test('returns null and does not throw when fetch rejects', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network'));
    const out = await getNamedWatershed(38.2098, -84.5588);
    expect(out).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/modules/climate/data.test.js -t getNamedWatershed`
Expected: FAIL — `getNamedWatershed is not a function`.

- [ ] **Step 3: Write the implementation**

In `src/modules/climate/data.js`:

Add to the constants require at the top of the file:

```javascript
const { WATERSHED_CELL_RESOLUTION } = require('../../utils/constants');
const { snapToCellAtResolution } = require('../../shared/spatial');
const { watershedCache } = require('../../cache');
```

Add the functions (place near `getWatershedContext`):

```javascript
const WBD_BASE = 'https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer';

// Query one WBD layer at a point; return the watershed unit's `name` or null.
async function queryWBDName(layer, lat, lng) {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'name',
    returnGeometry: 'false',
    f: 'json',
  });
  const resp = await fetch(`${WBD_BASE}/${layer}/query?${params}`, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data?.features?.[0]?.attributes?.name ?? null;
}

// getNamedWatershed(lat, lng) -> { huc12Name, basinName } | null
// Cell-cached (neighbors share one fetch). Queries WBD at the cell centroid so
// every address in the cell resolves to the same watershed. Layer 6 = HUC-12,
// layer 4 = HUC-8 basin.
async function getNamedWatershed(lat, lng) {
  const { cellId, centroid } = snapToCellAtResolution({ lat, lng }, WATERSHED_CELL_RESOLUTION);

  const cached = watershedCache.get(cellId);
  if (cached) return cached.huc12Name ? cached : null; // negatives cached as { huc12Name: null }

  try {
    const [huc12Name, basinName] = await Promise.all([
      queryWBDName(6, centroid.lat, centroid.lng),
      queryWBDName(4, centroid.lat, centroid.lng),
    ]);
    if (!huc12Name) {
      watershedCache.set(cellId, { huc12Name: null, basinName: null });
      return null;
    }
    const result = { huc12Name, basinName: basinName || null };
    watershedCache.set(cellId, result);
    return result;
  } catch {
    return null; // transient errors are not cached
  }
}
```

Add `getNamedWatershed` (and optionally `queryWBDName`) to `module.exports`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/modules/climate/data.test.js -t getNamedWatershed`
Expected: PASS (all 4).

- [ ] **Step 5: Commit**

```bash
git add src/modules/climate/data.js tests/modules/climate/data.test.js
git commit -m "feat(fr-034): add getNamedWatershed WBD fetch (cell-cached)"
```

---

## Task 4: Wire `named` into the watershed object

**Files:**
- Modify: `src/modules/climate/data.js` (`getClimateHistoryData`)
- Test: `tests/modules/climate/data.test.js`

- [ ] **Step 1: Write the failing test**

Add to `tests/modules/climate/data.test.js`:

```javascript
describe('getClimateHistoryData — named watershed wiring', () => {
  beforeEach(() => { watershedCache.clear(); jest.restoreAllMocks(); });

  test('attaches named watershed to the watershed object', async () => {
    // Topographic elevation points (EPQS) + WBD queries all go through fetch.
    jest.spyOn(global, 'fetch').mockImplementation((url) => {
      if (/MapServer\/6\//.test(url)) return Promise.resolve({ ok: true, json: async () => ({ features: [{ attributes: { name: 'Dry Run-North Elkhorn Creek' } }] }) });
      if (/MapServer\/4\//.test(url)) return Promise.resolve({ ok: true, json: async () => ({ features: [{ attributes: { name: 'North Fork Elkhorn Creek' } }] }) });
      // EPQS elevation
      return Promise.resolve({ ok: true, json: async () => ({ value: 900 }) });
    });
    const out = await getClimateHistoryData(38.2098, -84.5588, { state: 'KY', county: 'Scott County' }, {});
    expect(out.watershed.named).toEqual({ huc12Name: 'Dry Run-North Elkhorn Creek', basinName: 'North Fork Elkhorn Creek' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/modules/climate/data.test.js -t "named watershed wiring"`
Expected: FAIL — `out.watershed.named` is undefined.

- [ ] **Step 3: Modify `getClimateHistoryData`**

Add `getNamedWatershed(lat, lng)` to the `Promise.allSettled` batch and fold the result in. Update the batch:

```javascript
  const [stormResult, femaResult, normalsResult, watershedResult, namedResult] =
    await Promise.allSettled([
      getNOAAStormEvents(stateFips, countyFips),
      getFEMADeclarations(state, county),
      getNOAAClimateNormals(lat, lng),
      getWatershedContext(lat, lng),
      getNamedWatershed(lat, lng),
    ]);
```

After the existing `const watershed = val(watershedResult, null);` line, add:

```javascript
  const named = val(namedResult, null);
```

Replace the existing `watershed:` field in the returned object with:

```javascript
    watershed: (watershed || named)
      ? {
          topographicPosition: watershed ? watershed.position : null,
          elevations: watershed ? watershed.elevations : null,
          named: named,
        }
      : null,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/modules/climate/data.test.js`
Expected: PASS (new test + all pre-existing climate data tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/climate/data.js tests/modules/climate/data.test.js
git commit -m "feat(fr-034): fold named watershed into climate watershed object"
```

---

## Task 5: L3 — "Your Watershed" group in the Flood History tab

**Files:**
- Modify: `src/modules/climate/template.js`
- Test: `tests/modules/climate/template.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `tests/modules/climate/template.test.js`. The L3 deep dive is reachable through `buildClimateChapterHTML`; assert on the rendered string. Use a minimal climateHistory with a `named` watershed:

```javascript
const { buildClimateChapterHTML } = require('../../../src/modules/climate/template');

function climateHistoryWith(named) {
  return {
    stormEvents: { tornadoes: [], floods: [], winterStorms: [], heatEvents: [], allEvents: [] },
    femaDeclarations: { weatherRelated: [], all: [], count: 0 },
    climateNormals: null,
    glance: { lastSignificantEvent: null },
    preparedness: { emergencySystem: null, roadPriority: null },
    watershed: named ? { topographicPosition: 'lowpoint', elevations: null, named } : null,
    basementContext: null,
  };
}

describe('L3 Your Watershed group', () => {
  const env = { floodRisk: { zone: 'X', risk: 'Minimal' } };

  test('renders the watershed name in the deep dive when named is present', () => {
    const html = buildClimateChapterHTML(env, climateHistoryWith({ huc12Name: 'Dry Run-North Elkhorn Creek', basinName: 'North Fork Elkhorn Creek' }), { state: 'KY', county: 'Scott County' });
    expect(html).toContain('Your Watershed');
    expect(html).toContain('Dry Run');
  });

  test('omits the Your Watershed group when named is absent', () => {
    const html = buildClimateChapterHTML(env, climateHistoryWith(null), { state: 'KY', county: 'Scott County' });
    expect(html).not.toContain('Your Watershed');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/modules/climate/template.test.js -t "Your Watershed"`
Expected: FAIL — string `Your Watershed` not found in the present case.

- [ ] **Step 3: Implement**

In `src/modules/climate/template.js`:

In `buildClimateDeepDiveHTML`, add `watershed` to the destructure and pass `watershed?.named` into `buildFloodTab`:

```javascript
  const { stormEvents, femaDeclarations, climateNormals, preparedness, basementContext, watershed } = climateHistory;
  ...
    { id: 'flood', label: 'Flood History', content: buildFloodTab(stormEvents.floods, femaDeclarations, county, watershed?.named) },
```

Update `buildFloodTab`'s signature and append the group (en-dash for the hyphenated compound name):

```javascript
function buildFloodTab(floods, femaDeclarations, county, namedWatershed) {
  ...
  const watershedGroup = namedWatershed?.huc12Name
    ? `<div class="climate-event-group">
        <div class="climate-event-group-label">Your Watershed</div>
        <p class="prem-narrative-body">This home sits in the <strong>${escapeHtml(namedWatershed.huc12Name).replace(/-/g, '&ndash;')}</strong> watershed.</p>
      </div>`
    : '';

  return `
    <p class="prem-narrative-body">${escapeHtml(rarityStmt)} The question isn't whether it will happen — it's whether this specific property drains well enough to avoid it.</p>
    ${watershedGroup}
    ${femaItems ? `<div class="climate-event-group"><div class="climate-event-group-label">Federal Disaster Declarations</div>${femaItems}</div>` : ''}
    ${floodItems ? `<div class="climate-event-group"><div class="climate-event-group-label">Significant Flood Events</div>${floodItems}</div>` : ''}
    <div class="climate-event-group">
      <div class="climate-event-group-label">Ask the Seller</div>
      <p class="prem-narrative-body">Has water ever entered the basement, crawlspace, or garage? Have neighboring properties experienced yard flooding during heavy rain? These questions aren't on any standard inspection checklist.</p>
    </div>
    <p class="prem-disclaimer">Source: NOAA Storm Events Database, FEMA OpenFEMA. ${escapeHtml(county)}, last ${CLIMATE_STORM_LOOKBACK_YEARS} years.</p>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/modules/climate/template.test.js -t "Your Watershed"`
Expected: PASS (both).

- [ ] **Step 5: Commit**

```bash
git add src/modules/climate/template.js tests/modules/climate/template.test.js
git commit -m "feat(fr-034): add L3 Your Watershed group to Flood History tab"
```

---

## Task 6: L4 — Watershed Context block

**Files:**
- Modify: `src/modules/climate/template.js`
- Test: `tests/modules/climate/template.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `tests/modules/climate/template.test.js` (reuse `climateHistoryWith` / `buildClimateChapterHTML`):

```javascript
describe('L4 Watershed Context block', () => {
  const env = { floodRisk: { zone: 'X', risk: 'Minimal' } };
  const named = { huc12Name: 'Dry Run-North Elkhorn Creek', basinName: 'North Fork Elkhorn Creek' };

  function historyWith(named, position) {
    const h = climateHistoryWith(named);
    if (h.watershed) h.watershed.topographicPosition = position;
    return h;
  }

  test('renders watershed meaning, basin, and lowpoint tie-back', () => {
    const html = buildClimateChapterHTML(env, historyWith(named, 'lowpoint'), { state: 'KY', county: 'Scott County' });
    expect(html).toContain('Watershed Context');
    expect(html).toContain('North Fork Elkhorn Creek'); // basin
    expect(html).toMatch(/drainage|drains|runoff/i);    // tie-back present
  });

  test('omits the basin clause when basinName is null', () => {
    const html = buildClimateChapterHTML(env, historyWith({ huc12Name: 'Dry Run-North Elkhorn Creek', basinName: null }, 'lowpoint'), { state: 'KY', county: 'Scott County' });
    expect(html).toContain('Watershed Context');
    expect(html).not.toContain('part of the larger');
  });

  test('uses uphill wording for an uphill parcel, not low-point language', () => {
    const html = buildClimateChapterHTML(env, historyWith(named, 'uphill'), { state: 'KY', county: 'Scott County' });
    expect(html).toMatch(/above the surrounding terrain|away from/i);
    expect(html).not.toMatch(/low-lying position/i);
  });

  test('renders the watershed block even with no storm events', () => {
    // climateHistoryWith already has empty allEvents; the block must still appear.
    const html = buildClimateChapterHTML(env, historyWith(named, 'neutral'), { state: 'KY', county: 'Scott County' });
    expect(html).toContain('Watershed Context');
  });

  test('omits the watershed block when named is absent', () => {
    const html = buildClimateChapterHTML(env, climateHistoryWith(null), { state: 'KY', county: 'Scott County' });
    expect(html).not.toContain('Watershed Context');
  });

  test('the watershed block contains no inline styles', () => {
    const html = buildClimateChapterHTML(env, historyWith(named, 'lowpoint'), { state: 'KY', county: 'Scott County' });
    const block = html.slice(html.indexOf('Watershed Context'));
    expect(block).not.toMatch(/style="/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/modules/climate/template.test.js -t "Watershed Context"`
Expected: FAIL — `Watershed Context` not found.

- [ ] **Step 3: Implement**

In `src/modules/climate/template.js`, add the builder:

```javascript
function buildWatershedContextHTML(watershed) {
  const named = watershed?.named;
  if (!named?.huc12Name) return '';
  const name = escapeHtml(named.huc12Name).replace(/-/g, '&ndash;');
  const basinClause = named.basinName
    ? ` This home's watershed — <strong>${name}</strong> — is part of the larger <strong>${escapeHtml(named.basinName).replace(/-/g, '&ndash;')}</strong> basin.`
    : ` This home's watershed is <strong>${name}</strong>.`;

  let tieBack = '';
  if (watershed.topographicPosition === 'lowpoint') {
    tieBack = ' Combined with the parcel\'s low-lying position noted above, runoff from uphill in this same basin moves toward and past this property — which is why local drainage, not just the FEMA zone, governs how this lot handles heavy rain.';
  } else if (watershed.topographicPosition === 'uphill') {
    tieBack = ' With the parcel sitting above the surrounding terrain, runoff tends to drain away from the home rather than toward it.';
  }

  return `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Watershed Context</div>
      <p class="prem-narrative-body">A watershed is the area of land where all rainfall drains to a common point.${basinClause}${tieBack}</p>
      <p class="prem-disclaimer">Source: USGS Watershed Boundary Dataset (HUC-12 / HUC-8).</p>
    </div>`;
}
```

Restructure `buildClimateResearchHTML` so the watershed block renders independently of storm events. Replace its early guard and final return:

```javascript
function buildClimateResearchHTML(climateHistory) {
  if (!climateHistory) return '';
  const { stormEvents, climateNormals, watershed } = climateHistory;

  const watershedHTML = buildWatershedContextHTML(watershed);

  const eventRows = (stormEvents?.allEvents || [])
    .sort((a, b) => new Date(b.begin_date) - new Date(a.begin_date))
    .map((e) => { /* ...unchanged row mapping... */ }).join('');

  // ...unchanged normalRows mapping...

  // Nothing to show at all -> render nothing (keeps the depth-l4 div absent).
  if (!eventRows && !normalRows && !watershedHTML) return '';

  return `
    ${watershedHTML}
    ${eventRows ? `...unchanged storm table...` : ''}
    ${normalRows ? `...unchanged normals table...` : ''}
    <p class="prem-disclaimer">Source: NOAA Storm Events Database, NOAA Climate Normals.</p>`;
}
```

> Implementer note: keep the existing `eventRows`/`normalRows` mapping and table markup exactly as-is; only (a) add `watershed` to the destructure, (b) compute `watershedHTML`, (c) replace the `if (!stormEvents?.allEvents?.length) return ''` guard with the combined guard above, and (d) prepend `${watershedHTML}` in the return. Place the final NOAA disclaimer only when a NOAA table is present, or leave as-is — it is acceptable for it to remain.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/modules/climate/template.test.js -t "Watershed Context"`
Expected: PASS (all 6).

- [ ] **Step 5: Commit**

```bash
git add src/modules/climate/template.js tests/modules/climate/template.test.js
git commit -m "feat(fr-034): add L4 Watershed Context block, render independent of storm events"
```

---

## Task 7: Full suite + lint guard

**Files:** none (verification)

- [ ] **Step 1: Run the full test suite**

Run: `npx jest`
Expected: PASS, 0 failures. Test count increases by the number added (≈ 3 + 4 + 1 + 2 + 6 = 16).

- [ ] **Step 2: Grep for accidental inline styles in the new code**

Run: `npx grep -n "style=" src/modules/climate/template.js` (or use the Grep tool)
Expected: no new `style="` occurrences (CONSTRAINT-008).

- [ ] **Step 3: Commit (if any fixes were needed)**

```bash
git add -A && git commit -m "test(fr-034): full suite green for enhancement 6"
```

---

## Task 8: Live verification on all 5 addresses

**Files:** none (manual/integration) — CONSTRAINT-011, CONSTRAINT-013

- [ ] **Step 1: Confirm WBD resolves for each test address**

For each of the 5 test coordinates, confirm `getNamedWatershed` returns a non-null `huc12Name` against the live API (network required). Quick check script:

```bash
node -e "const {getNamedWatershed}=require('./src/modules/climate/data');(async()=>{for(const [n,la,lo] of [['Georgetown',38.2098,-84.5588],['Harlan',36.8431,-83.3216],['Louisville',38.2527,-85.7585],['Bozeman',45.6770,-111.0429],['Jeffersonville',38.2776,-85.7372]]){console.log(n, await getNamedWatershed(la,lo));}})()"
```

Expected: each prints a `{ huc12Name, basinName }`. **Jeffersonville IN is the explicit regression case** — confirm it returns an Indiana-side watershed (not silently null). If any return null, note it in summary.md as a coverage gap (graceful degradation already handles it — the section simply omits).

- [ ] **Step 2: Verify the orchestrator passes `named` through**

Confirm `chapters.js` `getChapterData` does not strip `watershed.named` (it spreads `climateHistoryVal`, so it should survive). Render a report for Georgetown and confirm "Your Watershed" appears at L3 and "Watershed Context" at L4. Use the project's run skill / server.

- [ ] **Step 3: Write the summary**

Create `feature-requests/FR-034-chapter-enhancements/summary-enhancement-6.md` documenting: what was built, files changed, test counts before/after, constraints verified (001/008/009/011/015), the v1 scope (name-only; stream name deferred), API notes (WBD endpoints, no key, no npm dep), and the per-address verification results.

- [ ] **Step 4: Commit**

```bash
git add feature-requests/FR-034-chapter-enhancements/summary-enhancement-6.md
git commit -m "docs(fr-034): add enhancement 6 summary"
```

---

## Self-Review

**Spec coverage:**
- L3 callout in Flood tab → Task 5 ✅
- L4 meaning + basin + topography-matched tie-back → Task 6 ✅
- `getNamedWatershed` via WBD, no npm dep → Task 3 ✅
- Cell-cached (neighbors share) → Tasks 1–3 (snapToCellAtResolution + watershedCache) ✅
- Extends existing `watershed` object → Task 4 ✅
- L4 renders independent of storm events → Task 6 (combined guard) ✅
- Graceful degradation (named null → both sections absent) → Tasks 5/6 omit-when-null ✅
- Basin clause omitted when basinName null → Task 6 ✅
- Tie-back matches topographicPosition → Task 6 (lowpoint/uphill/neutral) ✅
- All 5 addresses, Jeffersonville regression → Task 8 ✅
- No scoring / no inline styles / no HTML-in-data / no API-in-template → Tasks 3/5/6 + Task 7 grep ✅

**Placeholder scan:** The only abbreviated code is the *unchanged* storm/normals table markup in Task 6, explicitly marked "keep as-is" with an implementer note — not new logic. No TBD/TODO in new code.

**Type consistency:** `getNamedWatershed` returns `{ huc12Name, basinName }` everywhere; `watershed.named` reads the same shape in data (Task 4), L3 (`namedWatershed.huc12Name`, Task 5), and L4 (`watershed.named.huc12Name` / `.basinName`, Task 6). `snapToCellAtResolution` returns `{ cellId, resolution, centroid }`, consumed as `{ cellId, centroid }` in Task 3. Consistent.
