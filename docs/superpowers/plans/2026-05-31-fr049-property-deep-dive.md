# FR-049 Property Intelligence Deep Dive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add L3 (Deep Read) and L4 (Research) depth content to the Property Intelligence chapter — Internet Providers detail, Soil & Foundation, and Building Age Distribution tabs.

**Architecture:** Add `buildHousingAgeBands()` to `property/logic.js`. Expand ACS fetch in `data.js` with decade variables. Add tab builders and L3/L4 HTML to `property/template.js`. Wire `fullHTML` into `buildPropertyIntelligenceHTML()`. No new CSS — reuses `prem-age-row/fill/pct`, `climate-tab*`, `climate-research-section`, `climate-data-table` patterns.

**Tech Stack:** Node.js, Jest (`npm test`), Census ACS API, USDA SDA, FCC Broadband Map

**Spec:** `feature-requests/FR-049-property-deep-dive/spec.md`

---

## File Map

| File | Change |
|---|---|
| `src/modules/property/logic.js` | Add `buildHousingAgeBands(get)`. |
| `src/modules/property/data.js` | Add decade ACS vars to fetch. Add `housingAgeBands` to return object. |
| `src/modules/property/template.js` | Add `buildBroadbandTab()`, `buildSoilTab()`, `buildHousingAgeTab()`, `buildPropertyDeepDiveHTML()`, `buildPropertyResearchHTML()`. Update `buildPropertyIntelligenceHTML()`. |
| `tests/modules/property/logic.test.js` | New file — tests for `buildHousingAgeBands`. |
| `tests/modules/property/template.test.js` | Add L3/L4 describe blocks. |

---

## Task 1: `buildHousingAgeBands()` logic helper + data layer expansion — TDD

**Files:**
- Create: `tests/modules/property/logic.test.js`
- Modify: `src/modules/property/logic.js`
- Modify: `src/modules/property/data.js`

- [ ] **Step 1: Create `tests/modules/property/logic.test.js` with failing tests**

```js
'use strict';
const { buildHousingAgeBands } = require('../../../src/modules/property/logic');

function makeGet(map) { return (k) => map[k]; }

describe('buildHousingAgeBands', () => {
  test('returns null when total is 0', () => {
    expect(buildHousingAgeBands(makeGet({ B25034_001E: '0' }))).toBeNull();
  });

  test('returns null when total is missing', () => {
    expect(buildHousingAgeBands(makeGet({}))).toBeNull();
  });

  test('returns 7 bands', () => {
    const map = {
      B25034_001E: '1000',
      B25034_002E: '50',  B25034_003E: '100',  // 2010+ = 150
      B25034_004E: '120',                        // 2000s
      B25034_005E: '130',                        // 1990s
      B25034_006E: '200',                        // 1980s
      B25034_007E: '150',                        // 1970s
      B25034_008E: '100',                        // 1960s
      B25034_009E: '30', B25034_010E: '10', B25034_011E: '10', // Pre-1960 = 50
    };
    const result = buildHousingAgeBands(makeGet(map));
    expect(result).not.toBeNull();
    expect(result.bands).toHaveLength(7);
    expect(result.totalUnits).toBe(1000);
  });

  test('band labels are correct', () => {
    const map = { B25034_001E: '100', B25034_002E: '0', B25034_003E: '0',
      B25034_004E: '0', B25034_005E: '0', B25034_006E: '0', B25034_007E: '0',
      B25034_008E: '0', B25034_009E: '0', B25034_010E: '0', B25034_011E: '0' };
    const result = buildHousingAgeBands(makeGet(map));
    expect(result.bands[0].label).toBe('2010+');
    expect(result.bands[6].label).toBe('Pre-1960');
  });

  test('2010+ band combines B25034_002E and B25034_003E', () => {
    const map = {
      B25034_001E: '200',
      B25034_002E: '60', B25034_003E: '40',
      B25034_004E: '0', B25034_005E: '0', B25034_006E: '0', B25034_007E: '0',
      B25034_008E: '0', B25034_009E: '0', B25034_010E: '0', B25034_011E: '0',
    };
    const result = buildHousingAgeBands(makeGet(map));
    expect(result.bands[0].count).toBe(100);
    expect(result.bands[0].pct).toBe(50);
  });

  test('Pre-1960 band combines B25034_009E, _010E, _011E', () => {
    const map = {
      B25034_001E: '100',
      B25034_002E: '0', B25034_003E: '0', B25034_004E: '0', B25034_005E: '0',
      B25034_006E: '0', B25034_007E: '0', B25034_008E: '0',
      B25034_009E: '20', B25034_010E: '15', B25034_011E: '15',
    };
    const result = buildHousingAgeBands(makeGet(map));
    expect(result.bands[6].count).toBe(50);
    expect(result.bands[6].pct).toBe(50);
  });

  test('pcts are non-negative', () => {
    const map = { B25034_001E: '100', B25034_002E: '0', B25034_003E: '0',
      B25034_004E: '0', B25034_005E: '0', B25034_006E: '0', B25034_007E: '0',
      B25034_008E: '0', B25034_009E: '0', B25034_010E: '0', B25034_011E: '100' };
    const result = buildHousingAgeBands(makeGet(map));
    for (const b of result.bands) expect(b.pct).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```
npm test -- --testPathPatterns="tests/modules/property/logic" --no-coverage
```

Expected: FAIL — `buildHousingAgeBands` is not a function

- [ ] **Step 3: Add `buildHousingAgeBands` to `src/modules/property/logic.js`**

Add this to the top of `logic.js`: `const { safeInt } = require('../../utils/text');`

Add this function before `module.exports`:

```js
function buildHousingAgeBands(get) {
  const total = safeInt(get('B25034_001E'));
  if (!total || total === 0) return null;

  const pct = (n) => Math.round(n / total * 100);
  const v   = (k) => Math.max(0, safeInt(get(k)) || 0);

  const modern  = v('B25034_002E') + v('B25034_003E');
  const s2000s  = v('B25034_004E');
  const s1990s  = v('B25034_005E');
  const s1980s  = v('B25034_006E');
  const s1970s  = v('B25034_007E');
  const s1960s  = v('B25034_008E');
  const pre1960 = v('B25034_009E') + v('B25034_010E') + v('B25034_011E');

  return {
    totalUnits: total,
    bands: [
      { label: '2010+',    count: modern,  pct: pct(modern)  },
      { label: '2000s',    count: s2000s,  pct: pct(s2000s)  },
      { label: '1990s',    count: s1990s,  pct: pct(s1990s)  },
      { label: '1980s',    count: s1980s,  pct: pct(s1980s)  },
      { label: '1970s',    count: s1970s,  pct: pct(s1970s)  },
      { label: '1960s',    count: s1960s,  pct: pct(s1960s)  },
      { label: 'Pre-1960', count: pre1960, pct: pct(pre1960) },
    ],
  };
}
```

Add `buildHousingAgeBands` to `module.exports`.

- [ ] **Step 4: Run tests — expect PASS**

```
npm test -- --testPathPatterns="tests/modules/property/logic" --no-coverage
```

- [ ] **Step 5: Expand ACS fetch in `src/modules/property/data.js`**

Find the ACS fetch inside `getPropertyIntelligence`:

Old:
```js
fips
  ? fetchCensusACS(fips, ['B25035_001E', 'B25034_001E', 'B25034_002E', 'B25034_003E'])
  : Promise.resolve(null),
```

New:
```js
fips
  ? fetchCensusACS(fips, [
      'B25035_001E',
      'B25034_001E', 'B25034_002E', 'B25034_003E',
      'B25034_004E', 'B25034_005E', 'B25034_006E', 'B25034_007E',
      'B25034_008E', 'B25034_009E', 'B25034_010E', 'B25034_011E',
    ])
  : Promise.resolve(null),
```

Also update `data.js` to import `buildHousingAgeBands` from `./logic`:

Change:
```js
const { getDrainageCategory, getBroadbandCategory, getConstructionEraContext } = require('./logic');
```
To:
```js
const { getDrainageCategory, getBroadbandCategory, getConstructionEraContext, buildHousingAgeBands } = require('./logic');
```

Update the `era` block inside `getPropertyIntelligence` to add `housingAgeBands` to the return:

Old return:
```js
return { soil, broadband, era, locationInfo };
```

New return:
```js
const get = acs ? (k) => acs.get(k) : () => undefined;
const housingAgeBands = acs ? buildHousingAgeBands(get) : null;
return { soil, broadband, era, housingAgeBands, locationInfo };
```

- [ ] **Step 6: Run full tests**

```
npm test --no-coverage
```

Expected: all pass

- [ ] **Step 7: Commit**

```
git add src/modules/property/logic.js src/modules/property/data.js tests/modules/property/logic.test.js
git commit -m "feat(fr-049): add buildHousingAgeBands logic helper and expand ACS fetch"
```

---

## Task 2: L3 tab builders + `buildPropertyDeepDiveHTML()` — TDD

**Files:**
- Modify: `tests/modules/property/template.test.js`
- Modify: `src/modules/property/template.js`

- [ ] **Step 1: Add `fullPropertyData` fixture and failing L3 tests**

Read `tests/modules/property/template.test.js` to find `basePropIntel` or similar fixture. Add a new `fullPropIntel` fixture after it:

```js
const fullPropIntel = {
  soil: {
    muname: 'Maury silt loam',
    drainagecl: 'well drained',
    hydricrating: 'no',
    isHydric: false,
    drainageCategory: { label: 'Well drained', color: 'green', implication: 'Water drains readily.' },
  },
  broadband: {
    providers: [
      { name: 'AT&T Fiber', tech: 'Fiber', download: 1000, upload: 1000 },
      { name: 'Xfinity',    tech: 'Cable', download: 400,  upload: 20   },
    ],
    maxDownloadMbps: 1000,
    hasFiber: true,
    category: { label: 'Gigabit available', color: 'green', desc: 'Fiber available.' },
  },
  era: {
    medianYearBuilt: 1985,
    newConstructionPct: 8,
    context: { era: '1980s–90s construction', cautions: ['Polybutylene plumbing possible'] },
  },
  housingAgeBands: {
    totalUnits: 1000,
    bands: [
      { label: '2010+',    count: 80,  pct: 8  },
      { label: '2000s',    count: 120, pct: 12 },
      { label: '1990s',    count: 150, pct: 15 },
      { label: '1980s',    count: 300, pct: 30 },
      { label: '1970s',    count: 200, pct: 20 },
      { label: '1960s',    count: 100, pct: 10 },
      { label: '2010+',    count: 50,  pct: 5  },
    ],
  },
  locationInfo: { state: 'KY', county: 'Scott' },
};
```

Add these describe blocks at the end of the test file:

```js
describe('buildPropertyIntelligenceHTML — L3 deep dive', () => {
  test('depth-l3 present when broadband data available', () => {
    const html = buildPropertyIntelligenceHTML(fullPropIntel);
    expect(html).toMatch(/depth-l3/);
  });

  test('property-deep-dive container rendered', () => {
    const html = buildPropertyIntelligenceHTML(fullPropIntel);
    expect(html).toMatch(/property-deep-dive/);
  });

  test('Internet Providers tab rendered', () => {
    const html = buildPropertyIntelligenceHTML(fullPropIntel);
    expect(html).toMatch(/Internet Providers/);
  });

  test('Soil & Foundation tab rendered', () => {
    const html = buildPropertyIntelligenceHTML(fullPropIntel);
    expect(html).toMatch(/Soil/);
  });

  test('Building Age tab rendered', () => {
    const html = buildPropertyIntelligenceHTML(fullPropIntel);
    expect(html).toMatch(/Building Age/);
  });

  test('provider upload speeds appear in output', () => {
    const html = buildPropertyIntelligenceHTML(fullPropIntel);
    expect(html).toMatch(/1000.*Mbps|Upload/i);
  });

  test('soil muname appears in output', () => {
    const html = buildPropertyIntelligenceHTML(fullPropIntel);
    expect(html).toMatch(/Maury silt loam/);
  });

  test('housing age decade bands appear', () => {
    const html = buildPropertyIntelligenceHTML(fullPropIntel);
    expect(html).toMatch(/1980s/);
  });

  test('L3 absent when all deep-dive data is null', () => {
    const d = { soil: null, broadband: null, era: null, housingAgeBands: null, locationInfo: { state: 'KY', county: 'Scott' } };
    const html = buildPropertyIntelligenceHTML(d);
    expect(html).not.toMatch(/property-deep-dive/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildPropertyIntelligenceHTML(fullPropIntel);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

describe('buildPropertyIntelligenceHTML — L4 research', () => {
  test('depth-l4 present when data available', () => {
    const html = buildPropertyIntelligenceHTML(fullPropIntel);
    expect(html).toMatch(/depth-l4/);
  });

  test('provider research table rendered', () => {
    const html = buildPropertyIntelligenceHTML(fullPropIntel);
    expect(html).toMatch(/climate-data-table/);
  });

  test('assessor link rendered', () => {
    const html = buildPropertyIntelligenceHTML(fullPropIntel);
    expect(html).toMatch(/assessor|county.*records/i);
  });

  test('L4 absent when no data', () => {
    const d = { soil: null, broadband: null, era: null, housingAgeBands: null, locationInfo: { state: 'KY', county: 'Scott' } };
    const html = buildPropertyIntelligenceHTML(d);
    expect(html).not.toMatch(/depth-l4/);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```
npm test -- --testPathPatterns="tests/modules/property/template" --no-coverage
```

Expected: failures — depth-l3, property-deep-dive not found

- [ ] **Step 3: Add tab builder functions to `src/modules/property/template.js`**

Add these four functions before `buildPropertyIntelligenceHTML`:

```js
function buildBroadbandTab(broadband) {
  if (!broadband?.providers?.length) {
    return '<p class="prem-narrative-body">No broadband provider data confirmed at this address via FCC data.</p>';
  }

  const hasUpload = broadband.providers.some((p) => p.upload > 0);
  const remoteNote = broadband.providers.some((p) => p.upload >= 100)
    ? '<p class="prem-narrative-body">Upload speeds of 100+ Mbps are available — sufficient for video conferencing, cloud backup, and most remote work.</p>'
    : '<p class="prem-narrative-body">Upload speeds at this address may limit remote work performance. Confirm with provider before committing.</p>';

  const rows = broadband.providers.map((p) => `
    <div class="prem-age-row">
      <span class="prem-age-label">${escapeHtml(p.name)}</span>
      <span class="prem-age-pct">${p.download}↓ / ${p.upload}↑ Mbps</span>
    </div>
    <div class="prem-demo-note">${escapeHtml(p.tech)}</div>`).join('');

  return `
    <p class="prem-narrative-body">Max advertised speeds per provider.${hasUpload ? ' Down↓ / Up↑ Mbps shown.' : ''}</p>
    ${rows}
    ${remoteNote}
    <p class="prem-disclaimer">Source: FCC Broadband Map. Advertised speeds may differ from actual performance. Confirm with provider.</p>`;
}

function buildSoilTab(soil) {
  if (!soil) {
    return '<p class="prem-narrative-body">Soil data unavailable for this location from USDA Web Soil Survey.</p>';
  }

  const hydricWarning = soil.isHydric
    ? `<div class="prem-badge prem-badge--red">Hydric Soil Indicator</div>
       <p class="prem-narrative-body">Hydric soils form under saturated or flooded conditions — a wetland indicator. Verify with a licensed soil scientist before any foundation work, grading, or major landscaping.</p>`
    : '';

  return `
    ${soil.muname ? `<p class="prem-narrative-body"><strong>Soil unit:</strong> ${escapeHtml(soil.muname)}</p>` : ''}
    ${soil.drainagecl ? `<p class="prem-narrative-body"><strong>Drainage class:</strong> ${escapeHtml(soil.drainagecl)}</p>` : ''}
    ${soil.drainageCategory?.implication ? `<p class="prem-narrative-body">${escapeHtml(soil.drainageCategory.implication)}</p>` : ''}
    ${hydricWarning}
    <p class="prem-disclaimer">Source: USDA Web Soil Survey. Point-level spatial query — reflects soil conditions at the coordinates, not the specific parcel boundary.</p>`;
}

function buildHousingAgeTab(housingAgeBands, era) {
  if (!housingAgeBands) {
    return '<p class="prem-narrative-body">Housing age data unavailable for this Census tract.</p>';
  }

  const medianNote = era?.medianYearBuilt
    ? `<p class="prem-narrative-body">Median year built in this Census tract: <strong>${era.medianYearBuilt}</strong>.</p>`
    : '';

  const bars = housingAgeBands.bands.map((b) => `
    <div class="prem-age-row">
      <span class="prem-age-label">${escapeHtml(b.label)}</span>
      <div class="prem-age-track"><div class="prem-age-fill" data-w="${b.pct}"></div></div>
      <span class="prem-age-pct">${b.pct}%</span>
    </div>`).join('');

  return `
    ${medianNote}
    <p class="prem-narrative-body">Share of housing units by construction decade in this Census tract (${housingAgeBands.totalUnits.toLocaleString()} total units).</p>
    ${bars}
    <p class="prem-disclaimer">Source: U.S. Census Bureau ACS 5-year estimates, Table B25034. Census tract level — not parcel-specific.</p>`;
}

function buildPropertyDeepDiveHTML(d) {
  if (!d) return '';

  const tabs = [
    d.broadband
      ? { id: 'broadband', label: 'Internet Providers', content: buildBroadbandTab(d.broadband) }
      : null,
    d.soil
      ? { id: 'soil', label: 'Soil & Foundation', content: buildSoilTab(d.soil) }
      : null,
    d.housingAgeBands
      ? { id: 'age', label: 'Building Age', content: buildHousingAgeTab(d.housingAgeBands, d.era) }
      : null,
  ].filter(Boolean);

  if (!tabs.length) return '';

  const tabButtons = tabs.map((t, i) =>
    `<button class="climate-tab${i === 0 ? ' climate-tab--active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="ptab-${t.id}" id="pbtn-${t.id}">${t.label}</button>`
  ).join('');

  const tabPanels = tabs.map((t, i) =>
    `<div class="climate-tab-panel${i === 0 ? ' climate-tab-panel--active' : ''}" id="ptab-${t.id}" role="tabpanel" aria-labelledby="pbtn-${t.id}">${t.content}</div>`
  ).join('');

  return `
    <div class="property-deep-dive">
      <div class="property-deep-dive-label">Property Intelligence in Depth</div>
      <nav class="climate-tab-nav" role="tablist" aria-label="Property deep dive">
        ${tabButtons}
      </nav>
      <div class="climate-tab-panels">
        ${tabPanels}
      </div>
    </div>`;
}
```

- [ ] **Step 4: Run template tests**

```
npm test -- --testPathPatterns="tests/modules/property/template" --no-coverage
```

Expected: L3 tests pass. L4 tests still failing (buildPropertyResearchHTML not implemented yet).

---

## Task 3: `buildPropertyResearchHTML()` + wire `fullHTML` — TDD

**Files:**
- Modify: `src/modules/property/template.js`

The L4 test cases were already written in Task 2 Step 1. Implement and wire.

- [ ] **Step 1: Add `buildPropertyResearchHTML()` after `buildPropertyDeepDiveHTML`**

```js
function buildPropertyResearchHTML(d) {
  if (!d) return '';

  const providerTable = d.broadband?.providers?.length ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Internet Providers — Full Detail (FCC Broadband Map)</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Provider</th><th>Technology</th><th>Download (Mbps)</th><th>Upload (Mbps)</th></tr></thead>
          <tbody>
            ${d.broadband.providers.map((p) =>
              `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.tech)}</td><td>${p.download}</td><td>${p.upload}</td></tr>`
            ).join('')}
          </tbody>
        </table>
      </div>
    </div>` : '';

  const housingTable = d.housingAgeBands?.bands?.length ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Housing Units by Construction Decade (ACS B25034)</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Period</th><th>Units</th><th>% of Tract</th></tr></thead>
          <tbody>
            ${d.housingAgeBands.bands.map((b) =>
              `<tr><td>${escapeHtml(b.label)}</td><td>${b.count.toLocaleString()}</td><td>${b.pct}%</td></tr>`
            ).join('')}
          </tbody>
        </table>
      </div>
    </div>` : '';

  const assessorLink = d.locationInfo?.county && d.locationInfo?.state ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">County Records</div>
      <p class="prem-narrative-body">Property tax assessment, permit history, and deed records are maintained by ${escapeHtml(d.locationInfo.county)} County, ${escapeHtml(d.locationInfo.state)}. Search the county assessor or property appraiser website for parcel-level data.</p>
      <p class="prem-narrative-body"><a href="https://www.google.com/search?q=${encodeURIComponent(d.locationInfo.county + ' County ' + d.locationInfo.state + ' property assessor')}" target="_blank" rel="noopener">Search for ${escapeHtml(d.locationInfo.county)} County assessor →</a></p>
    </div>` : '';

  if (!providerTable && !housingTable && !assessorLink) return '';

  return `${providerTable}${housingTable}${assessorLink}
    <p class="prem-disclaimer">Source: FCC Broadband Map, U.S. Census Bureau ACS 5-year estimates. Data is point-level or Census tract level.</p>`;
}
```

- [ ] **Step 2: Wire `fullHTML` into `buildPropertyIntelligenceHTML`**

Find the final `return renderChapterCard(...)` call in `buildPropertyIntelligenceHTML`. Replace it with:

```js
  const deepDiveHTML  = buildPropertyDeepDiveHTML(d);
  const researchHTML  = buildPropertyResearchHTML(d);

  const fullHTML = [
    deepDiveHTML ? `<div class="depth-l3">${deepDiveHTML}</div>` : '',
    researchHTML ? `<div class="depth-l4">${researchHTML}</div>` : '',
  ].filter(Boolean).join('');

  const wrenchSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`;
  return renderChapterCard('property', '11', wrenchSvg, 'Property Intelligence', 'What the data says about the physical property.', null, body, null, fullHTML || null, null, glanceHTML || null);
```

Note: Read the actual current `buildPropertyIntelligenceHTML` to confirm the exact `renderChapterCard` call signature and SVG icon — copy the existing icon, just add `fullHTML` as the 9th parameter.

- [ ] **Step 3: Run full community template suite**

```
npm test -- --testPathPatterns="tests/modules/property" --no-coverage
```

Expected: all tests PASS including L3 and L4

- [ ] **Step 4: Run full test suite**

```
npm test --no-coverage
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```
git add src/modules/property/ tests/modules/property/
git commit -m "feat(fr-049): property L3/L4 — broadband, soil, and building age deep dive"
```

---

## Task 4: Write summary + push

- [ ] **Step 1: Create `feature-requests/FR-049-property-deep-dive/summary.md`**

```markdown
# FR-049 Summary — Property Intelligence Deep Dive (L3/L4)

**Status:** Complete

## What Was Added

Three L3 tabs and an L4 research panel for the Property Intelligence chapter.

**L3 — Internet Providers tab**
Upload + download speeds for all providers. Remote work note when upload ≥ 100 Mbps available.
Data was already being fetched (upload field was discarded after L2).

**L3 — Soil & Foundation tab**
USDA soil map unit name, drainage class with plain-English implication, hydric indicator.
Data was already being fetched (muname and hydricrating were unused).

**L3 — Building Age tab**
Decade-by-decade distribution of housing construction in the Census tract.
Required expanding the ACS fetch with B25034_004E–_011E (8 new variables).

**L4 — Research**
Full provider table (all speeds), housing unit count table by decade, county assessor search link.

## New Logic

`buildHousingAgeBands(get)` in `property/logic.js` — transforms ACS decade variables into
7 display bands (2010+, 2000s, 1990s, 1980s, 1970s, 1960s, Pre-1960).
```

- [ ] **Step 2: Commit and push**

```
git add feature-requests/FR-049-property-deep-dive/
git add docs/superpowers/plans/2026-05-31-fr049-property-deep-dive.md
git commit -m "docs: add FR-049 spec, plan, and summary"
git push
```

---

## Self-Review

**Spec coverage:**
- ✅ L3 tab: Internet Providers (upload speeds) — Task 2-3
- ✅ L3 tab: Soil & Foundation (muname, hydric) — Task 2-3
- ✅ L3 tab: Building Age (decade bands) — Tasks 1+2+3
- ✅ L4: provider table — Task 3
- ✅ L4: housing age raw counts — Task 3
- ✅ L4: assessor link — Task 3
- ✅ `buildHousingAgeBands` logic helper tested — Task 1
- ✅ No inline styles (CONSTRAINT-008) — tested in Task 2
- ✅ No API calls in template — enforced by architecture
- ✅ fullHTML wired into renderChapterCard — Task 3
- ✅ Tabs absent when data is null — tested in Task 2
