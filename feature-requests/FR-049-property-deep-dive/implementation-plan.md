# FR-049 Property Deep Dive (L3/L4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `fullHTML` in the Property Intelligence chapter so the depth slider shows 3 tabs at L3 (Internet Providers, Soil & Foundation, Building Age Distribution) and a data table + links at L4 (Research).

**Architecture:** `logic.js` gains `buildHousingAgeBands(get)` to transform ACS decade variables into display bands. `data.js` expands its ACS fetch to include B25034_004E–_011E and calls `buildHousingAgeBands`. `template.js` gains tab builders + deep-dive/research wrappers and passes the combined `fullHTML` to `renderChapterCard`.

**Tech Stack:** Node.js, Jest, Census ACS API (already integrated via `fetchCensusACS`), existing `renderChapterCard` / `prem-age-row` / `climate-tab-*` CSS patterns.

---

## File Map

| File | Change |
|---|---|
| `src/modules/property/logic.js` | Add `buildHousingAgeBands(get)` — pure transform, no API calls |
| `src/modules/property/data.js` | Expand ACS var list; call `buildHousingAgeBands`; return `housingAgeBands` in `propIntel` |
| `src/modules/property/template.js` | Add `buildBroadbandTab`, `buildSoilTab`, `buildHousingAgeTab`, `buildPropertyDeepDiveHTML`, `buildPropertyResearchHTML`; wire `fullHTML` in `buildPropertyIntelligenceHTML` |
| `tests/modules/property/logic.test.js` | New file — tests for `buildHousingAgeBands` |
| `tests/modules/property/template.test.js` | Add L3/L4 describe blocks |

---

## Task 1: Add `buildHousingAgeBands` to logic.js

**Files:**
- Modify: `src/modules/property/logic.js`
- Create: `tests/modules/property/logic.test.js`

The function takes a Map getter (`k => acsMap.get(k)`) and produces `{ totalUnits, bands: [{ label, count, pct }] }` or `null`. Bands group 2020+ with 2010s, keep 2000s–1960s separate, and merge Pre-1960.

ACS variable map (from spec):

| Variable | Period |
|---|---|
| B25034_001E | Total housing units |
| B25034_002E | Built 2020 or later |
| B25034_003E | Built 2010 to 2019 |
| B25034_004E | Built 2000 to 2009 |
| B25034_005E | Built 1990 to 1999 |
| B25034_006E | Built 1980 to 1989 |
| B25034_007E | Built 1970 to 1979 |
| B25034_008E | Built 1960 to 1969 |
| B25034_009E | Built 1950 to 1959 |
| B25034_010E | Built 1940 to 1949 |
| B25034_011E | Built 1939 or earlier |

- [ ] **Step 1: Write the failing tests**

Create `tests/modules/property/logic.test.js`:

```js
'use strict';
const { buildHousingAgeBands } = require('../../../src/modules/property/logic');

function makeGet(data) {
  return (k) => data[k];
}

describe('buildHousingAgeBands', () => {
  const data = {
    'B25034_001E': '1000',
    'B25034_002E': '50',   // 2020+
    'B25034_003E': '150',  // 2010s
    'B25034_004E': '200',  // 2000s
    'B25034_005E': '180',  // 1990s
    'B25034_006E': '150',  // 1980s
    'B25034_007E': '100',  // 1970s
    'B25034_008E': '70',   // 1960s
    'B25034_009E': '40',   // 1950s
    'B25034_010E': '30',   // 1940s
    'B25034_011E': '30',   // Pre-1940
  };

  test('returns 7 bands', () => {
    const result = buildHousingAgeBands(makeGet(data));
    expect(result.bands).toHaveLength(7);
  });

  test('2010+ band combines _002E and _003E', () => {
    const result = buildHousingAgeBands(makeGet(data));
    const band = result.bands.find(b => b.label === '2010+');
    expect(band.count).toBe(200); // 50 + 150
  });

  test('Pre-1960 band combines _009E + _010E + _011E', () => {
    const result = buildHousingAgeBands(makeGet(data));
    const band = result.bands.find(b => b.label === 'Pre-1960');
    expect(band.count).toBe(100); // 40 + 30 + 30
  });

  test('percentages sum to 100 (±2 for rounding)', () => {
    const result = buildHousingAgeBands(makeGet(data));
    const total = result.bands.reduce((sum, b) => sum + b.pct, 0);
    expect(total).toBeGreaterThanOrEqual(98);
    expect(total).toBeLessThanOrEqual(102);
  });

  test('totalUnits matches total variable', () => {
    const result = buildHousingAgeBands(makeGet(data));
    expect(result.totalUnits).toBe(1000);
  });

  test('returns null when total is 0', () => {
    const result = buildHousingAgeBands(makeGet({ 'B25034_001E': '0' }));
    expect(result).toBeNull();
  });

  test('returns null when total is missing', () => {
    const result = buildHousingAgeBands(makeGet({}));
    expect(result).toBeNull();
  });

  test('suppressed cells (negative values) treated as 0', () => {
    const suppressed = { ...data, 'B25034_004E': '-666666666' };
    const result = buildHousingAgeBands(makeGet(suppressed));
    const band = result.bands.find(b => b.label === '2000s');
    expect(band.count).toBe(0);
    expect(band.pct).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx jest tests/modules/property/logic.test.js --no-coverage
```

Expected: FAIL — `buildHousingAgeBands is not a function`

- [ ] **Step 3: Implement `buildHousingAgeBands` in logic.js**

Append to `src/modules/property/logic.js` (before `module.exports`):

```js
function buildHousingAgeBands(get) {
  const safeCount = (v) => {
    const n = parseInt(v, 10);
    return isNaN(n) || n < 0 ? 0 : n;
  };

  const total = safeCount(get('B25034_001E'));
  if (!total) return null;

  const rawBands = [
    { label: '2010+',    count: safeCount(get('B25034_002E')) + safeCount(get('B25034_003E')) },
    { label: '2000s',    count: safeCount(get('B25034_004E')) },
    { label: '1990s',    count: safeCount(get('B25034_005E')) },
    { label: '1980s',    count: safeCount(get('B25034_006E')) },
    { label: '1970s',    count: safeCount(get('B25034_007E')) },
    { label: '1960s',    count: safeCount(get('B25034_008E')) },
    { label: 'Pre-1960', count: safeCount(get('B25034_009E')) + safeCount(get('B25034_010E')) + safeCount(get('B25034_011E')) },
  ];

  const bands = rawBands.map(b => ({
    ...b,
    pct: Math.round(b.count / total * 100),
  }));

  return { totalUnits: total, bands };
}
```

Update `module.exports` in logic.js:

```js
module.exports = { getDrainageCategory, getBroadbandCategory, getConstructionEraContext, buildHousingAgeBands };
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npx jest tests/modules/property/logic.test.js --no-coverage
```

Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```
git add src/modules/property/logic.js tests/modules/property/logic.test.js
git commit -m "feat(fr-049): add buildHousingAgeBands to property logic"
```

---

## Task 2: Expand ACS fetch in data.js

**Files:**
- Modify: `src/modules/property/data.js`

`getPropertyIntelligence` currently fetches `['B25035_001E', 'B25034_001E', 'B25034_002E', 'B25034_003E']`. We need to add `B25034_004E` through `B25034_011E` and call `buildHousingAgeBands`.

- [ ] **Step 1: Add `buildHousingAgeBands` to the require at the top of data.js**

Change line 11:
```js
const { getDrainageCategory, getBroadbandCategory, getConstructionEraContext } = require('./logic');
```
to:
```js
const { getDrainageCategory, getBroadbandCategory, getConstructionEraContext, buildHousingAgeBands } = require('./logic');
```

- [ ] **Step 2: Expand the ACS variable list in `getPropertyIntelligence`**

Change:
```js
fips
  ? fetchCensusACS(fips, ['B25035_001E', 'B25034_001E', 'B25034_002E', 'B25034_003E'])
  : Promise.resolve(null),
```
to:
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

- [ ] **Step 3: Call `buildHousingAgeBands` and add `housingAgeBands` to the return**

The existing `era` block starts at:
```js
  let era = null;
  if (acs) {
```

After the `era` block closes, add:
```js
  const housingAgeBands = acs ? buildHousingAgeBands((k) => acs.get(k)) : null;
```

Then update the return statement from:
```js
  return { soil, broadband, era, locationInfo };
```
to:
```js
  return { soil, broadband, era, housingAgeBands, locationInfo };
```

- [ ] **Step 4: Run existing tests to confirm nothing broke**

```
npx jest tests/modules/property/ --no-coverage
```

Expected: All existing tests PASS (data.test.js mocks `fetchCensusACS` — new vars return undefined, which `safeCount` treats as 0, which is correct)

- [ ] **Step 5: Commit**

```
git add src/modules/property/data.js
git commit -m "feat(fr-049): expand ACS fetch for housing age decade bands"
```

---

## Task 3: Build L3 tab functions and deep-dive HTML in template.js

**Files:**
- Modify: `src/modules/property/template.js`

Pattern reference: `src/modules/community/template.js` — same `climate-tab` / `climate-tab-panel` CSS classes, same `prem-age-row` bar pattern.

- [ ] **Step 1: Add `buildBroadbandTab` to template.js**

Add this function before `buildPropertyIntelligenceHTML`:

```js
function buildBroadbandTab(broadband) {
  if (!broadband?.providers?.length) {
    return `<p class="prem-narrative-body">No provider data available. Check the <a href="https://broadbandmap.fcc.gov/" target="_blank" rel="noopener">FCC National Broadband Map</a> by entering this address directly.</p>`;
  }

  const hasHighUpload = broadband.providers.some(p => p.upload >= 100);
  const remoteNote = hasHighUpload
    ? `<p class="prem-narrative-body">At least one provider offers upload speeds of 100 Mbps or higher — suitable for remote work with video conferencing and large file uploads.</p>`
    : '';

  const cards = broadband.providers.map(p => {
    const fiberBadge = p.tech === 'Fiber' ? `<span class="prem-badge prem-badge--green">Fiber</span>` : '';
    return `
      <div class="prem-intel-bb-provider prem-intel-bb-provider--full">
        <span class="prem-intel-bb-name">${escapeHtml(p.name)}</span>
        <span class="prem-intel-bb-tech">${escapeHtml(p.tech)}</span>
        ${fiberBadge}
        <span class="prem-intel-bb-speed">${p.download ? `↓ ${p.download} Mbps` : '—'}</span>
        <span class="prem-intel-bb-speed">${p.upload ? `↑ ${p.upload} Mbps` : '—'}</span>
      </div>`;
  }).join('');

  return `
    <p class="prem-narrative-body">All confirmed providers at this address. Upload speed is the key metric for remote workers — standard cable plans often advertise high download speeds but throttle uploads to 10–20 Mbps.</p>
    ${remoteNote}
    <div class="prem-intel-bb-providers">${cards}</div>
    <p class="prem-disclaimer">Source: FCC National Broadband Map. Advertised speeds; actual speeds may vary.</p>`;
}
```

- [ ] **Step 2: Add `buildSoilTab` to template.js**

```js
function buildSoilTab(soil) {
  if (!soil) {
    return `<p class="prem-narrative-body">USDA soil data was not available for this location. For site-specific drainage information, request a geotechnical report or ask the seller about any known drainage issues.</p>`;
  }

  const drainClass = soil.drainageCategory
    ? `<div class="prem-intel-soil-detail">
        <span class="prem-intel-soil-label">USDA Drainage Class</span>
        <span class="prem-badge ${badgeClass(soil.drainageCategory.color)}">${escapeHtml(soil.drainageCategory.label)}</span>
        <p class="prem-narrative-body">${escapeHtml(soil.drainageCategory.implication)}</p>
      </div>`
    : soil.drainagecl
      ? `<div class="prem-intel-soil-detail"><span class="prem-intel-soil-label">USDA Drainage Class</span> ${escapeHtml(soil.drainagecl)}</div>`
      : '';

  const hydricSection = soil.isHydric
    ? `<div class="prem-intel-soil-detail prem-intel-soil-detail--hydric">
        <span class="prem-intel-soil-label">Hydric Soil</span>
        <span class="prem-badge prem-badge--orange">Hydric — Wetland Indicator</span>
        <p class="prem-narrative-body">USDA classifies this soil as hydric, indicating it formed under saturated conditions. This is a potential wetland indicator and may affect foundation drainage, landscaping, and any planned additions or outbuildings. Discuss with your inspector and consider a drainage evaluation.</p>
      </div>`
    : '';

  return `
    <div class="prem-intel-soil-card">
      <div class="prem-intel-soil-detail">
        <span class="prem-intel-soil-label">Soil Map Unit</span>
        <span class="prem-intel-soil-value">${escapeHtml(soil.muname || 'Unknown')}</span>
      </div>
      ${drainClass}
      ${hydricSection}
    </div>
    <p class="prem-disclaimer">Source: USDA Web Soil Survey (SDA). Soil data is mapped at the map unit level, not parcel-specific. Site conditions may vary.</p>`;
}
```

- [ ] **Step 3: Add `buildHousingAgeTab` to template.js**

```js
function buildHousingAgeTab(housingAgeBands, era) {
  if (!housingAgeBands?.bands?.length) {
    return `<p class="prem-narrative-body">Housing age distribution data was not available for this Census tract.</p>`;
  }

  const ERA_RISK = [
    { beforeYear: 1960, label: 'Pre-1960',    note: 'Pre-1978 homes: lead paint presumed in original surfaces. Homes pre-1960 may have original plumbing and electrical.' },
    { beforeYear: 1978, label: '1960s–1970s', note: 'Pre-1978: lead paint likely in original finishes. Asbestos common in floor tiles, insulation, or textured ceilings.' },
    { beforeYear: 1990, label: '1980s',        note: 'Polybutylene plumbing was common (recalled for failure risk). Asbestos possible in textured surfaces or tiles.' },
  ];

  const bars = housingAgeBands.bands.map(b => `
    <div class="prem-age-row">
      <span class="prem-age-label">${escapeHtml(b.label)}</span>
      <div class="prem-age-track"><div class="prem-age-fill" data-w="${b.pct}"></div></div>
      <span class="prem-age-pct">${b.pct}%</span>
    </div>`).join('');

  const medianNote = era?.medianYearBuilt
    ? `<p class="prem-narrative-body">Median year built in this Census tract: <strong>${era.medianYearBuilt}</strong>. Distribution below shows the full decade breakdown.</p>`
    : '<p class="prem-narrative-body">Decade distribution of housing units in this Census tract.</p>';

  const riskNotes = ERA_RISK
    .filter(r => {
      const band = housingAgeBands.bands.find(b => b.label === r.label || b.label === 'Pre-1960');
      return band && band.pct > 5;
    })
    .map(r => `<div class="prem-intel-era-note">${escapeHtml(r.note)}</div>`)
    .join('');

  return `
    ${medianNote}
    ${bars}
    ${riskNotes}
    <p class="prem-disclaimer">Source: U.S. Census Bureau ACS 5-year estimates, Table B25034. Tract-level data — not specific to this parcel.</p>`;
}
```

- [ ] **Step 4: Add `buildPropertyDeepDiveHTML` to template.js**

```js
function buildPropertyDeepDiveHTML(propIntel) {
  if (!propIntel) return '';

  const tabs = [
    { id: 'internet',  label: 'Internet Providers',    content: buildBroadbandTab(propIntel.broadband) },
    { id: 'soil',      label: 'Soil & Foundation',     content: buildSoilTab(propIntel.soil) },
    { id: 'buildingage', label: 'Building Age',        content: buildHousingAgeTab(propIntel.housingAgeBands, propIntel.era) },
  ];

  const tabButtons = tabs.map((t, i) =>
    `<button class="climate-tab${i === 0 ? ' climate-tab--active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="pdtab-${t.id}" id="pdbtn-${t.id}">${t.label}</button>`
  ).join('');

  const tabPanels = tabs.map((t, i) =>
    `<div class="climate-tab-panel${i === 0 ? ' climate-tab-panel--active' : ''}" id="pdtab-${t.id}" role="tabpanel" aria-labelledby="pdbtn-${t.id}">${t.content}</div>`
  ).join('');

  return `
    <div class="property-deep-dive">
      <div class="community-deep-dive-label">Property Intelligence in Depth</div>
      <nav class="climate-tab-nav" role="tablist" aria-label="Property intelligence deep dive">
        ${tabButtons}
      </nav>
      <div class="climate-tab-panels">
        ${tabPanels}
      </div>
    </div>`;
}
```

- [ ] **Step 5: Add `buildPropertyResearchHTML` to template.js**

```js
function buildPropertyResearchHTML(propIntel) {
  if (!propIntel) return '';

  const { broadband, soil, housingAgeBands, locationInfo } = propIntel;
  const county = locationInfo?.county || 'this county';
  const state  = locationInfo?.state  || '';

  const assessorUrl  = `https://www.google.com/search?q=${encodeURIComponent(`${county} county assessor property records`)}`;
  const buildingUrl  = `https://www.google.com/search?q=${encodeURIComponent(`${county} county building department permit records`)}`;
  const fccUrl       = `https://broadbandmap.fcc.gov/`;
  const soilSurveyUrl = `https://websoilsurvey.sc.egov.usda.gov/`;
  const censusUrl    = `https://data.census.gov/table?id=B25034`;

  const providerTable = broadband?.providers?.length ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Broadband Providers — All Data (FCC)</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Provider</th><th>Technology</th><th>Download (Mbps)</th><th>Upload (Mbps)</th></tr></thead>
          <tbody>
            ${broadband.providers.map(p => `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.tech)}</td><td>${p.download || '—'}</td><td>${p.upload || '—'}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : '';

  const soilSection = soil ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">USDA Soil Reference</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Field</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Map Unit Name</td><td>${escapeHtml(soil.muname || '—')}</td></tr>
            <tr><td>Drainage Class</td><td>${escapeHtml(soil.drainagecl || '—')}</td></tr>
            <tr><td>Hydric Rating</td><td>${escapeHtml(soil.hydricrating || '—')}</td></tr>
          </tbody>
        </table>
      </div>
      <p class="prem-disclaimer">Full soil data: <a href="${soilSurveyUrl}" target="_blank" rel="noopener noreferrer">USDA Web Soil Survey</a></p>
    </div>` : '';

  const ageTable = housingAgeBands?.bands?.length ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Housing Age Distribution — Raw Counts (ACS B25034)</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Period</th><th>Units</th><th>% of Tract</th></tr></thead>
          <tbody>
            ${housingAgeBands.bands.map(b => `<tr><td>${escapeHtml(b.label)}</td><td>${b.count.toLocaleString()}</td><td>${b.pct}%</td></tr>`).join('')}
            <tr><td><strong>Total</strong></td><td><strong>${housingAgeBands.totalUnits.toLocaleString()}</strong></td><td>—</td></tr>
          </tbody>
        </table>
      </div>
      <p class="prem-disclaimer">Full Census table: <a href="${censusUrl}" target="_blank" rel="noopener noreferrer">Census data.census.gov — Table B25034</a></p>
    </div>` : '';

  const linksSection = `
    <div class="climate-research-section">
      <div class="climate-research-section-label">County Records — Direct Links</div>
      <ul class="climate-research-links">
        <li><a href="${assessorUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(county)} County Assessor — Property Tax Records</a></li>
        <li><a href="${buildingUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(county)} County Building Department — Permit History</a></li>
        <li><a href="${fccUrl}" target="_blank" rel="noopener noreferrer">FCC National Broadband Map — Search This Address</a></li>
      </ul>
    </div>`;

  const content = [providerTable, soilSection, ageTable, linksSection].filter(Boolean).join('');
  return content || '';
}
```

- [ ] **Step 6: Wire `fullHTML` in `buildPropertyIntelligenceHTML`**

Find the last 3 lines of `buildPropertyIntelligenceHTML`:
```js
  const glanceHTML = buildPropertyGlanceHTML(propIntel);
  return renderChapterCard('property', '11', homeSvg, 'Property Intelligence', 'Soil, broadband, permits, and the details that listings don\'t show.', null, body, null, null, null, glanceHTML || null);
```

Replace with:
```js
  const glanceHTML    = buildPropertyGlanceHTML(propIntel);
  const deepDiveHTML  = buildPropertyDeepDiveHTML(propIntel);
  const researchHTML  = buildPropertyResearchHTML(propIntel);
  const fullHTML = [
    deepDiveHTML ? `<div class="depth-l3">${deepDiveHTML}</div>` : '',
    researchHTML ? `<div class="depth-l4">${researchHTML}</div>` : '',
  ].filter(Boolean).join('');

  return renderChapterCard('property', '11', homeSvg, 'Property Intelligence', 'Soil, broadband, permits, and the details that listings don\'t show.', null, body, null, fullHTML || null, null, glanceHTML || null);
```

- [ ] **Step 7: Update `module.exports` in template.js**

```js
module.exports = { buildPropertyIntelligenceHTML, buildPropertyGlanceHTML };
```

No change needed — the new functions are internal and not exported.

- [ ] **Step 8: Run existing property template tests**

```
npx jest tests/modules/property/template.test.js --no-coverage
```

Expected: All existing PASS. (no change to function signatures — only `fullHTML` gets populated now)

- [ ] **Step 9: Commit**

```
git add src/modules/property/template.js
git commit -m "feat(fr-049): add L3/L4 deep dive HTML for property chapter"
```

---

## Task 4: Add L3/L4 tests to template.test.js

**Files:**
- Modify: `tests/modules/property/template.test.js`

- [ ] **Step 1: Add `housingAgeBands` to the base fixture and add L3/L4 describe blocks**

Append to `tests/modules/property/template.test.js`:

```js
const basePropIntelWithBands = {
  ...basePropIntel,
  housingAgeBands: {
    totalUnits: 1000,
    bands: [
      { label: '2010+',    count: 200, pct: 20 },
      { label: '2000s',    count: 200, pct: 20 },
      { label: '1990s',    count: 180, pct: 18 },
      { label: '1980s',    count: 150, pct: 15 },
      { label: '1970s',    count: 100, pct: 10 },
      { label: '1960s',    count: 70,  pct:  7 },
      { label: 'Pre-1960', count: 100, pct: 10 },
    ],
  },
};

describe('buildPropertyIntelligenceHTML — L3 deep dive', () => {
  test('renders depth-l3 container', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/depth-l3/);
  });

  test('renders Internet Providers tab button', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/Internet Providers/);
  });

  test('renders Soil &amp; Foundation tab button', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/Soil.*Foundation/);
  });

  test('renders Building Age tab button', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/Building Age/);
  });

  test('shows upload speed in broadband tab', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/↑/);
  });

  test('shows hydric badge when isHydric is true', () => {
    const hydricIntel = {
      ...basePropIntelWithBands,
      soil: { ...basePropIntel.soil, isHydric: true },
    };
    const html = buildPropertyIntelligenceHTML(hydricIntel);
    expect(html).toMatch(/Hydric/);
  });

  test('shows decade bar for 2010+', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/2010\+/);
  });

  test('shows Pre-1960 band', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/Pre-1960/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

describe('buildPropertyIntelligenceHTML — L4 research', () => {
  test('renders depth-l4 container', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/depth-l4/);
  });

  test('renders provider table with download and upload columns', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/Download.*Upload|Upload.*Download/);
  });

  test('renders USDA soil reference table', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/USDA Soil Reference/);
  });

  test('renders housing age raw counts table', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/Housing Age Distribution/);
  });

  test('renders assessor link for county', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/Scott County.*Assessor|Assessor.*Scott County/);
  });

  test('renders FCC broadband map link', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/broadbandmap\.fcc\.gov/);
  });
});
```

- [ ] **Step 2: Run all property tests**

```
npx jest tests/modules/property/ --no-coverage
```

Expected: All PASS

- [ ] **Step 3: Run full test suite to confirm no regressions**

```
npx jest --no-coverage
```

Expected: All PASS

- [ ] **Step 4: Commit**

```
git add tests/modules/property/template.test.js
git commit -m "test(fr-049): add L3/L4 template tests for property chapter"
```

---

## Task 5: Manual verification on all 5 test addresses

Run the dev server and generate reports for all 5 addresses. Check that the Property Intelligence chapter depth slider works at all levels.

**Start the server:**
```
node src/server/index.js
```

**Test addresses:**
1. `100 Wishing Well Path Unit 2306, Georgetown, KY 40324`
2. `456 Rural Route 1, Harlan, KY 40831` (rural — possible ACS suppression)
3. `123 Main St, Louisville, KY 40202` (urban)
4. `789 Main St, Bozeman, MT 59715`
5. `1007 Stonelilly Dr, Jeffersonville, IN 47130`

**For each address, verify:**
- [ ] L1 (Glance): chapter-glance bar still renders
- [ ] L2 (Overview): existing content unchanged
- [ ] L3 (Deep Read): 3 tabs render — Internet Providers, Soil & Foundation, Building Age
  - Internet Providers tab shows download AND upload speeds for each provider
  - Soil & Foundation tab shows map unit name, drainage badge, hydric status
  - Building Age tab shows decade bars that visually fill
- [ ] L4 (Research): provider table, USDA soil table, housing age counts table, county assessor links
- [ ] Harlan KY: graceful degradation if ACS data is suppressed — no empty panels, no crashes

- [ ] **Commit summary.md**

```
git add feature-requests/FR-049-property-deep-dive/
git commit -m "docs(fr-049): add implementation plan and summary"
```

- [ ] **Push**

```
git push
```
