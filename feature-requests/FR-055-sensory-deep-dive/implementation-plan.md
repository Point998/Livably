# FR-055 Sensory L3/L4 Deep Dive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add L3 (2-tab deep dive: EPA Research Tools + Environmental Inspection) and L4 (environmental data summary table) to the Sensory & Environmental chapter.

**Architecture:** Add `buildSensoryResearchToolsTab`, `buildSensoryInspectionTab`, `buildSensoryDeepDiveHTML`, `buildSensoryResearchHTML` to `src/modules/sensory/template.js`. The `fullHTML` (9th param) to `renderChapterCard` is **already used** for the Bortle scale — L3/L4 must be **appended** to it, not replace it.

**Data shapes:**
- `env.airports`: `[{ name, distanceMiles }]` or empty
- `env.roadNoise`: `{ dnl, source, nearestRoad }` or null
- `env.rail`: `{ name, type, distanceMiles }` or null
- `env.lightPollution`: `{ bortle, label, desc }` or null
- `env.airQuality`: `{ aqi, category: { label, color, description }, primaryPollutant }` or null
- `env.waterQuality`: `{ systemName, violations: [] }` or null
- `env.radon`: `{ zone }` or null
- `env.ejscreen`: `{ flagged, superfundPct, rmpPct, tsdfPct }` or null

---

## CRITICAL: fullHTML already in use

Current final call in `buildSensoryEnvironmentalHTML`:
```js
return renderChapterCard('sensory', '12', eyeSvg, 'Sensory &amp; Environmental', '...', null, leftHTML, sectionB, bortleFullHTML, null, glanceHTML || null);
```

`bortleFullHTML` (9th arg / `fullHTML`) is the Bortle scale visualization. It must stay. Change to:
```js
const fullHTML = [bortleFullHTML, l3HTML, l4HTML].filter(Boolean).join('');
return renderChapterCard('sensory', '12', eyeSvg, 'Sensory &amp; Environmental', '...', null, leftHTML, sectionB, fullHTML || null, null, glanceHTML || null);
```

---

## File Map

| File | Change |
|------|--------|
| `src/modules/sensory/template.js` | Add 4 new functions; update final `renderChapterCard` call |
| `public/report.css` | Add `.sensory-deep-dive`, `.sensory-deep-dive-label`, `.sensory-research-item`, `.sensory-research-item-hd`, `.sensory-research-item-icon`, `.sensory-research-item-title`, `.sensory-research-item-detail` |
| `tests/modules/sensory/template.test.js` | Add L3 and L4 describe blocks |

---

## Task 1: Build L3 deep dive (2 tabs) + tests

**Files:**
- Modify: `src/modules/sensory/template.js`
- Modify: `tests/modules/sensory/template.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/modules/sensory/template.test.js` after existing tests:

```js
describe('buildSensoryEnvironmentalHTML — L3 deep dive', () => {
  test('depth-l3 wrapper present', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/depth-l3/);
  });

  test('sensory-deep-dive container rendered', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/sensory-deep-dive/);
  });

  test('EPA Research Tools tab rendered', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/EPA Research Tools/);
  });

  test('AirNow link rendered', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/airnow\.gov/);
  });

  test('EJSCREEN link rendered', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/ejscreen\.epa\.gov/);
  });

  test('EWG Tap Water link rendered', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/ewg\.org\/tapwater/);
  });

  test('radon zone shown in research tools when available', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/Zone 2/);
  });

  test('Environmental Inspection tab rendered', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/Environmental Inspection/);
  });

  test('radon test item present in inspection checklist', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/radon test/i);
  });

  test('urgent radon framing when zone 1', () => {
    const env = { ...baseEnv, radon: { zone: 1 } };
    const html = buildSensoryEnvironmentalHTML(env);
    expect(html).toMatch(/Zone 1/);
  });

  test('bortle scale still present (fullHTML append not replace)', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/prem-bortle-scale/);
    expect(html).toMatch(/depth-l3/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

Run `npx jest tests/modules/sensory/template.test.js --no-coverage` — new tests should FAIL.

- [ ] **Step 2: Add tab builder functions and `buildSensoryDeepDiveHTML`**

Add these functions before `buildSensoryEnvironmentalHTML`:

```js
function buildSensoryResearchToolsTab(env) {
  const { airQuality, waterQuality, radon, ejscreen } = env || {};
  const aqiNote = airQuality ? ` (current AQI: ${airQuality.aqi} — ${escapeHtml(airQuality.category.label)})` : '';
  const radonNote = radon ? ` This county is Radon Zone ${radon.zone}.` : '';
  const waterNote = waterQuality?.violations?.length
    ? ` ${waterQuality.violations.length} violation${waterQuality.violations.length > 1 ? 's' : ''} on record.`
    : waterQuality ? ' No violations on record.' : '';
  const ejNote = ejscreen?.flagged ? ' EJSCREEN flags elevated hazard proximity for this address.' : '';

  const items = [
    {
      icon: '💨',
      title: 'EPA AirNow',
      detail: `Real-time and historical air quality data by zip code${aqiNote}. Also shows current fire smoke conditions and forecast AQI for the week ahead.`,
      url: 'https://www.airnow.gov/',
    },
    {
      icon: '🏭',
      title: 'EPA EJSCREEN',
      detail: `Environmental screening tool showing Superfund proximity, air toxics, chemical risk facilities, and hazardous waste sites by address${ejNote}. Useful for identifying industrial neighbors.`,
      url: 'https://ejscreen.epa.gov/mapper/',
    },
    {
      icon: '🚰',
      title: 'EWG Tap Water Database',
      detail: `Search by zip code to see years of water system test results and contaminant levels${waterNote} More granular than EPA data for drinking water quality trends.`,
      url: 'https://www.ewg.org/tapwater/',
    },
    {
      icon: '☢️',
      title: 'EPA Radon Zone Map',
      detail: `County-level geologic radon potential${radonNote} Actual radon levels vary by home — testing is the only way to know your specific exposure.`,
      url: 'https://www.epa.gov/radon/find-information-about-local-radon-zones-and-state-contact-information',
    },
    {
      icon: '🗺️',
      title: 'BTS National Transportation Noise Map',
      detail: 'Interactive map of road and aviation noise levels (day-night average dB) across the US. Useful for comparing noise levels across neighborhoods.',
      url: 'https://www.bts.gov/transportation-noise',
    },
  ];

  const rows = items.map(it => `
    <div class="sensory-research-item">
      <div class="sensory-research-item-hd">
        <span class="sensory-research-item-icon">${it.icon}</span>
        <span class="sensory-research-item-title"><a href="${escapeHtml(it.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(it.title)}</a></span>
      </div>
      <p class="sensory-research-item-detail">${it.detail}</p>
    </div>`).join('');

  return `
    <p class="prem-narrative-body">These databases are public, free, and updated regularly. Each one provides a different lens on environmental quality at this address.</p>
    ${rows}`;
}

function buildSensoryInspectionTab(env) {
  const { radon, waterQuality, ejscreen } = env || {};
  const radonZone = radon?.zone;
  const hasViolations = waterQuality?.violations?.length > 0;
  const hasEJFlag = ejscreen?.flagged;

  const radonUrgency = radonZone === 1
    ? `<strong>Priority — Zone 1 county:</strong> Radon testing is strongly recommended before closing.`
    : radonZone === 2
    ? `Radon testing is recommended — Zone 2 county with moderate geologic potential.`
    : `Radon testing is a reasonable precaution even in lower-risk zones.`;

  const waterUrgency = hasViolations
    ? `<strong>Priority — water violations on record:</strong> Request the utility's Consumer Confidence Report and consider a certified water test.`
    : `Request the annual Consumer Confidence Report from the utility (required by law to be provided free on request).`;

  const items = [
    {
      icon: '☢️',
      title: 'Radon test',
      detail: `${radonUrgency} DIY kits cost $15–$30 and return results in 48–96 hours. If elevated (>4 pCi/L), mitigation systems cost $800–$2,500 installed and reduce levels by 90%+.`,
    },
    {
      icon: '🚰',
      title: 'Water quality test',
      detail: `${waterUrgency} A certified lab test ($50–$150) tests for lead, nitrates, bacteria, and common contaminants beyond what the EPA requires utilities to report.`,
    },
    {
      icon: '🌬️',
      title: 'HVAC filter and ductwork inspection',
      detail: 'Ask the inspector to note the air filter condition and whether ductwork shows signs of mold or pest activity. Compromised HVAC circulates allergens and particulates that affect daily air quality indoors.',
    },
    {
      icon: '🏭',
      title: 'EPA ECHO facility search',
      detail: `${hasEJFlag ? '<strong>Priority — EJSCREEN flagged:</strong> ' : ''}Search this address on EPA ECHO (echo.epa.gov) to see specific permitted industrial facilities within a few miles and their inspection/violation history.`,
    },
    {
      icon: '🪟',
      title: 'Visit at different times and seasons',
      detail: 'Road noise, aircraft paths, and industrial odors vary significantly by time of day, day of week, and season. A Sunday afternoon site visit can miss what Monday morning at 7am sounds like.',
    },
  ];

  const rows = items.map(it => `
    <div class="sensory-research-item">
      <div class="sensory-research-item-hd">
        <span class="sensory-research-item-icon">${it.icon}</span>
        <span class="sensory-research-item-title">${escapeHtml(it.title)}</span>
      </div>
      <p class="sensory-research-item-detail">${it.detail}</p>
    </div>`).join('');

  return `
    <p class="prem-narrative-body">Environmental data identifies risk levels — inspection turns that into specific answers for this home. Here's what to add to your due diligence scope.</p>
    ${rows}`;
}

function buildSensoryDeepDiveHTML(env) {
  if (!env) return '';

  const tabs = [
    { id: 'research',   label: 'EPA Research Tools',        content: buildSensoryResearchToolsTab(env) },
    { id: 'inspection', label: 'Environmental Inspection',  content: buildSensoryInspectionTab(env) },
  ];

  const tabButtons = tabs.map((t, i) =>
    `<button class="climate-tab${i === 0 ? ' climate-tab--active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="sntab-${t.id}" id="snbtn-${t.id}">${t.label}</button>`
  ).join('');

  const tabPanels = tabs.map((t, i) =>
    `<div class="climate-tab-panel${i === 0 ? ' climate-tab-panel--active' : ''}" id="sntab-${t.id}" role="tabpanel" aria-labelledby="snbtn-${t.id}">${t.content}</div>`
  ).join('');

  return `
    <div class="sensory-deep-dive">
      <div class="sensory-deep-dive-label">Environment in Depth</div>
      <nav class="climate-tab-nav" role="tablist" aria-label="Sensory chapter deep dive">
        ${tabButtons}
      </nav>
      <div class="climate-tab-panels">
        ${tabPanels}
      </div>
    </div>`;
}
```

- [ ] **Step 3: Wire L3 into `buildSensoryEnvironmentalHTML`**

At the end of `buildSensoryEnvironmentalHTML`, before the `return renderChapterCard(...)` line, add:

```js
  const deepDiveHTML = buildSensoryDeepDiveHTML(env);
  const l3HTML = deepDiveHTML ? `<div class="depth-l3">${deepDiveHTML}</div>` : '';
  const fullHTML = [bortleFullHTML, l3HTML].filter(Boolean).join('');
```

Change the `renderChapterCard` call — replace `bortleFullHTML` (9th arg) with `fullHTML || null`:

```js
  return renderChapterCard('sensory', '12', eyeSvg, 'Sensory &amp; Environmental', 'What you can\'t discover during a showing.', null, leftHTML, sectionB, fullHTML || null, null, glanceHTML || null);
```

- [ ] **Step 4: Run tests**

```
npx jest tests/modules/sensory/template.test.js --no-coverage
```

Expected: all 19 tests pass (7 existing + 12 new).

- [ ] **Step 5: Commit**

```
git add src/modules/sensory/template.js tests/modules/sensory/template.test.js
git commit -m "feat(fr-055): add L3 deep dive to sensory chapter (research tools + inspection)"
```

---

## Task 2: Build L4 data table + tests

**Files:**
- Modify: `src/modules/sensory/template.js`
- Modify: `tests/modules/sensory/template.test.js`

- [ ] **Step 1: Write failing tests**

Add after the L3 describe block:

```js
describe('buildSensoryEnvironmentalHTML — L4 research', () => {
  test('depth-l4 wrapper present', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/depth-l4/);
  });

  test('environmental data table rendered', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/climate-data-table/);
  });

  test('AQI value in table', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/42/);
  });

  test('road noise dB in table', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/52 dB/);
  });

  test('radon zone in table', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/Zone 2/);
  });

  test('water system name in table', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/Georgetown Water Works/);
  });

  test('bortle scale still present alongside L4 (append not replace)', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/prem-bortle-scale/);
    expect(html).toMatch(/depth-l4/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

Run `npx jest tests/modules/sensory/template.test.js --no-coverage` — new tests should FAIL.

- [ ] **Step 2: Add `buildSensoryResearchHTML` to template.js**

Add before `buildSensoryDeepDiveHTML`:

```js
function buildSensoryResearchHTML(env) {
  if (!env) return '';
  const { airQuality, roadNoise, lightPollution, radon, waterQuality, ejscreen, airports } = env;

  const rows = [
    airQuality
      ? `<tr><td>Air Quality (AQI)</td><td>${airQuality.aqi}</td><td>${escapeHtml(airQuality.category.label)}</td><td>EPA AirNow</td></tr>`
      : `<tr><td>Air Quality (AQI)</td><td>—</td><td>Data unavailable</td><td>EPA AirNow</td></tr>`,
    roadNoise
      ? `<tr><td>Road Noise</td><td>${roadNoise.dnl} dB</td><td>${roadNoise.dnl < 55 ? 'Low' : roadNoise.dnl < 65 ? 'Moderate' : 'Elevated'}</td><td>BTS Noise Map</td></tr>`
      : `<tr><td>Road Noise</td><td>—</td><td>Data unavailable</td><td>BTS Noise Map</td></tr>`,
    lightPollution
      ? `<tr><td>Light Pollution</td><td>Bortle ${lightPollution.bortle}</td><td>${escapeHtml(lightPollution.label)}</td><td>Census / OSM (estimated)</td></tr>`
      : null,
    radon
      ? `<tr><td>Radon Risk</td><td>Zone ${radon.zone}</td><td>${radon.zone === 1 ? 'High' : radon.zone === 2 ? 'Moderate' : 'Lower'}</td><td>EPA Radon Map (county)</td></tr>`
      : null,
    waterQuality
      ? `<tr><td>Water Quality</td><td>${escapeHtml(waterQuality.systemName)}</td><td>${waterQuality.violations.length === 0 ? 'No violations (5 yr)' : `${waterQuality.violations.length} violation${waterQuality.violations.length > 1 ? 's' : ''}`}</td><td>EPA SDWIS</td></tr>`
      : `<tr><td>Water Quality</td><td>—</td><td>Data unavailable</td><td>EPA SDWIS</td></tr>`,
    ejscreen
      ? `<tr><td>Hazard Proximity</td><td>${ejscreen.flagged ? 'Flagged' : 'No flags'}</td><td>${ejscreen.flagged ? 'Above 75th pct on 1+ metrics' : 'Below 75th pct all metrics'}</td><td>EPA EJSCREEN</td></tr>`
      : null,
    airports?.length
      ? `<tr><td>Nearest Airport</td><td>${airports[0].distanceMiles.toFixed(1)} mi</td><td>${escapeHtml(airports[0].name)}</td><td>Google Places</td></tr>`
      : null,
  ].filter(Boolean).join('');

  return `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Environmental Data — Full Summary</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Category</th><th>Value</th><th>Status</th><th>Source</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="prem-disclaimer">Data collected at report generation time. Air quality, noise, and water quality can change — sources listed above provide current readings.</p>
    </div>`;
}
```

- [ ] **Step 3: Wire L4 into `buildSensoryEnvironmentalHTML`**

Replace the Task 1 wiring with the updated version that includes L4:

```js
  const deepDiveHTML = buildSensoryDeepDiveHTML(env);
  const l3HTML = deepDiveHTML ? `<div class="depth-l3">${deepDiveHTML}</div>` : '';
  const researchHTML = buildSensoryResearchHTML(env);
  const l4HTML = researchHTML ? `<div class="depth-l4">${researchHTML}</div>` : '';
  const fullHTML = [bortleFullHTML, l3HTML, l4HTML].filter(Boolean).join('');
```

The `renderChapterCard` call stays the same as Task 1 (uses `fullHTML || null`).

- [ ] **Step 4: Run tests**

```
npx jest tests/modules/sensory/template.test.js --no-coverage
```

Expected: all 27 tests pass (19 existing + 8 new).

- [ ] **Step 5: Commit**

```
git add src/modules/sensory/template.js tests/modules/sensory/template.test.js
git commit -m "feat(fr-055): add L4 data table to sensory chapter"
```

---

## Task 3: CSS + verify + push

**Files:**
- Modify: `public/report.css`

- [ ] **Step 1: Find end of sensory CSS**

Search for `prem-sensory-section` or `prem-bortle` to locate the last sensory CSS block.

- [ ] **Step 2: Add sensory L3/L4 CSS**

```css
/* ── Sensory Chapter L3/L4 ─────────────────────────────────────── */
.sensory-deep-dive { margin-top: var(--space-4); }

.sensory-deep-dive-label {
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-60);
  margin-bottom: var(--space-2);
}

.sensory-research-item {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--ink-10);
}

.sensory-research-item:last-of-type { border-bottom: none; }

.sensory-research-item-hd {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.sensory-research-item-icon {
  font-size: var(--text-base);
  flex-shrink: 0;
}

.sensory-research-item-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink);
}

.sensory-research-item-detail {
  font-size: var(--text-sm);
  color: var(--ink-60);
  margin: 0;
  padding-left: calc(var(--text-base) + var(--space-2));
}
```

- [ ] **Step 3: Run full test suite**

```
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 4: Commit CSS, write summary, push**

```
git add public/report.css
git commit -m "feat(fr-055): add sensory L3/L4 CSS"

# create feature-requests/FR-055-sensory-deep-dive/summary.md
git add feature-requests/FR-055-sensory-deep-dive/summary.md
git commit -m "chore(fr-055): add implementation summary"
git push
```
