# FR-054 Growth L3/L4 Deep Dive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add L3 (2-tab deep dive: Permit Trends + Research Guide) and L4 (named projects table + establishments table) to the Growth & Development chapter.

**Architecture:** Add `buildGrowthPermitTrendsTab`, `buildGrowthResearchGuideTab`, `buildGrowthDeepDiveHTML`, `buildGrowthResearchHTML` to `src/modules/growth/template.js`. Pass combined output as `fullHTML` (9th param) to `renderChapterCard` in `buildGrowthAndDevelopmentHTML`. No new API calls.

**Data shapes:**
- `growth.permits`: `{ current, currentYear, priorYear, trend, percentChange }` or null
- `growth.newConstruction`: `{ newConstructionPct }` or null
- `growth.namedProjects`: `[{ name, type, status, icon, impact, expectedOpening?, automated, source?, sourceUrl? }]`
- `growth.establishments`: `[{ name, icon, label, distanceMiles }]`
- `growth.locationInfo`: `{ county, city }`

---

## File Map

| File | Change |
|------|--------|
| `src/modules/growth/template.js` | Add 4 new functions; update `buildGrowthAndDevelopmentHTML` call |
| `public/report.css` | Add `.growth-deep-dive`, `.growth-deep-dive-label`, `.growth-permit-stat-row`, `.growth-permit-stat`, `.growth-permit-stat-label`, `.growth-permit-stat-val`, `.growth-permit-trend-up`, `.growth-permit-trend-down`, `.growth-permit-trend-flat` |
| `tests/modules/growth/template.test.js` | Add L3 and L4 describe blocks |

---

## Task 1: Build L3 deep dive (2 tabs) + tests

**Files:**
- Modify: `src/modules/growth/template.js`
- Modify: `tests/modules/growth/template.test.js`

Add a `fullGrowth` fixture alongside the existing `baseGrowth`:

```js
const fullGrowth = {
  namedProjects: [
    { name: 'Georgetown Commons Retail Center', type: 'Commercial', status: 'Approved', icon: '🏪', impact: 'New retail development.', automated: false },
    { name: 'Maplewood Subdivision Phase 2', type: 'Residential', status: 'Under Construction', icon: '🏗️', impact: '120-unit residential.', automated: false, expectedOpening: '2026' },
  ],
  permits: { current: 1234, currentYear: 2023, priorYear: 2022, trend: 'rising', percentChange: 15 },
  newConstruction: null,
  establishments: [
    { name: 'Walmart Supercenter', icon: '🛒', label: 'Grocery', distanceMiles: 0.4 },
    { name: 'CVS Pharmacy', icon: '💊', label: 'Pharmacy', distanceMiles: 0.6 },
  ],
  locationInfo: { county: 'Scott County', city: 'Georgetown' },
};
```

- [ ] **Step 1: Write failing tests**

Add to `tests/modules/growth/template.test.js` after existing tests:

```js
describe('buildGrowthAndDevelopmentHTML — L3 deep dive', () => {
  test('depth-l3 wrapper present', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/depth-l3/);
  });

  test('growth-deep-dive container rendered', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/growth-deep-dive/);
  });

  test('Permit Trends tab rendered', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/Permit Trends/);
  });

  test('permit count shown when permits available', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/1,234/);
  });

  test('percent change shown when permits available', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/15%/);
  });

  test('new construction pct shown when no permits but newConstruction', () => {
    const g = { ...fullGrowth, permits: null, newConstruction: { newConstructionPct: 22 } };
    const html = buildGrowthAndDevelopmentHTML(g);
    expect(html).toMatch(/22%/);
  });

  test('fallback text shown when no permits and no newConstruction', () => {
    const g = { ...fullGrowth, permits: null, newConstruction: null };
    const html = buildGrowthAndDevelopmentHTML(g);
    expect(html).toMatch(/Planning and Zoning/i);
  });

  test('Research Guide tab rendered', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/Research Guide/);
  });

  test('county name used in research guide', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/Scott County/);
  });

  test('L3 present even when no named projects', () => {
    const g = { ...fullGrowth, namedProjects: [] };
    const html = buildGrowthAndDevelopmentHTML(g);
    expect(html).toMatch(/depth-l3/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

Run `npx jest tests/modules/growth/template.test.js --no-coverage` — new tests should FAIL.

- [ ] **Step 2: Add tab builder functions and `buildGrowthDeepDiveHTML` to template.js**

Add these functions before `buildGrowthAndDevelopmentHTML`:

```js
function buildGrowthPermitTrendsTab(permits, newConstruction, locationInfo) {
  const county = locationInfo?.county || 'this county';

  if (permits) {
    const { current, currentYear, priorYear, trend, percentChange } = permits;
    const trendClass = trend === 'rising' ? 'growth-permit-trend-up'
                     : trend === 'declining' ? 'growth-permit-trend-down'
                     : 'growth-permit-trend-flat';
    const trendSymbol = trend === 'rising' ? '▲' : trend === 'declining' ? '▼' : '—';
    const trendLabel  = trend === 'rising' ? `+${Math.abs(percentChange)}% from ${priorYear || 'prior year'}`
                      : trend === 'declining' ? `${percentChange}% from ${priorYear || 'prior year'}`
                      : `Stable vs ${priorYear || 'prior year'}`;
    const context = trend === 'rising'
      ? `Rising permit activity in ${escapeHtml(county)} signals active investment in the area — new housing, commercial expansion, and infrastructure improvements tend to follow sustained growth.`
      : trend === 'declining'
      ? `Declining permit activity in ${escapeHtml(county)} may reflect a maturing market, rising construction costs, or broader economic conditions. Ask your agent what's driving the slowdown.`
      : `Stable permit activity in ${escapeHtml(county)} reflects a steady market — neither a boom nor a contraction.`;

    return `
      <div class="growth-permit-stat-row">
        <div class="growth-permit-stat">
          <div class="growth-permit-stat-label">${currentYear || 'Current year'}</div>
          <div class="growth-permit-stat-val">${current.toLocaleString()}</div>
          <div class="growth-permit-stat-sub">building permits</div>
        </div>
        <div class="growth-permit-stat">
          <div class="growth-permit-stat-label">Year-over-year</div>
          <div class="growth-permit-stat-val ${trendClass}">${trendSymbol} ${trendLabel}</div>
          <div class="growth-permit-stat-sub">vs ${priorYear || 'prior year'}</div>
        </div>
      </div>
      <p class="prem-narrative-body">${context}</p>
      <p class="prem-disclaimer">Source: U.S. Census Bureau Building Permits Survey. County-level data — not neighborhood-specific.</p>`;
  }

  if (newConstruction) {
    const { newConstructionPct } = newConstruction;
    const context = newConstructionPct >= 20
      ? `${newConstructionPct}% of housing in this Census tract was built after 2010 — a high share of recent construction, indicating active growth area investment.`
      : newConstructionPct >= 10
      ? `About ${newConstructionPct}% of housing in this Census tract was built after 2010, reflecting moderate new construction activity.`
      : `Only ${newConstructionPct}% of housing in this Census tract was built after 2010, indicating an established neighborhood with limited recent development.`;

    return `
      <div class="growth-permit-stat-row">
        <div class="growth-permit-stat">
          <div class="growth-permit-stat-label">Post-2010 housing</div>
          <div class="growth-permit-stat-val">${newConstructionPct}%</div>
          <div class="growth-permit-stat-sub">of tract housing</div>
        </div>
      </div>
      <p class="prem-narrative-body">${context}</p>
      <p class="prem-disclaimer">Source: U.S. Census Bureau ACS 5-year estimates. Census tract level.</p>`;
  }

  return `
    <p class="prem-narrative-body">Building permit trend data was not available for ${escapeHtml(county)} at this time.</p>
    <p class="prem-narrative-body">To get current permit activity, contact the ${escapeHtml(county)} Planning and Zoning office directly — they maintain a public database of all issued permits and can tell you what's been approved in the last 12 months.</p>`;
}

function buildGrowthResearchGuideTab(locationInfo) {
  const county = locationInfo?.county || 'your county';
  const city   = locationInfo?.city   || county;

  const items = [
    {
      icon: '🏛️',
      title: `${county} Planning & Zoning`,
      detail: `Search "${county} planning and zoning" to find the county planning department portal. Pending permit applications, approved zoning changes, and variance requests are all public record — but you have to ask.`,
    },
    {
      icon: '🗺️',
      title: 'GIS Zoning Map',
      detail: `Search "${county} GIS zoning map" or "${city} zoning map." These interactive maps show current zoning classifications and often have a layer for approved developments. Rezoning of adjacent parcels can significantly affect what gets built next door.`,
    },
    {
      icon: '🛣️',
      title: 'State DOT Road Projects',
      detail: `Road widening, new interchanges, and highway extensions are announced years in advance. Search "[state] DOT statewide transportation improvement program" (STIP) — it's a federally mandated list of funded projects with timelines.`,
    },
    {
      icon: '📰',
      title: 'Local news + planning meeting minutes',
      detail: `County planning commission minutes are public record and often the first place a major development surfaces before it reaches any database. Search "${city} planning commission minutes" to find recent agendas.`,
    },
  ];

  const rows = items.map(it => `
    <div class="safety-prep-item">
      <div class="safety-prep-item-hd">
        <span class="safety-prep-item-icon">${it.icon}</span>
        <span class="safety-prep-item-title">${escapeHtml(it.title)}</span>
      </div>
      <p class="safety-prep-item-detail">${escapeHtml(it.detail)}</p>
    </div>`).join('');

  return `
    <p class="prem-narrative-body">The developments that most affect your quality of life — road widenings, large apartment complexes, commercial pads adjacent to your lot — live in planning databases that no API exposes. Here's how to find them.</p>
    ${rows}`;
}

function buildGrowthDeepDiveHTML(growth) {
  if (!growth) return '';
  const { permits, newConstruction, locationInfo } = growth;

  const tabs = [
    { id: 'permits',  label: 'Permit Trends',   content: buildGrowthPermitTrendsTab(permits, newConstruction, locationInfo) },
    { id: 'research', label: 'Research Guide',  content: buildGrowthResearchGuideTab(locationInfo) },
  ];

  const tabButtons = tabs.map((t, i) =>
    `<button class="climate-tab${i === 0 ? ' climate-tab--active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="grtab-${t.id}" id="grbtn-${t.id}">${t.label}</button>`
  ).join('');

  const tabPanels = tabs.map((t, i) =>
    `<div class="climate-tab-panel${i === 0 ? ' climate-tab-panel--active' : ''}" id="grtab-${t.id}" role="tabpanel" aria-labelledby="grbtn-${t.id}">${t.content}</div>`
  ).join('');

  return `
    <div class="growth-deep-dive">
      <div class="growth-deep-dive-label">Growth in Depth</div>
      <nav class="climate-tab-nav" role="tablist" aria-label="Growth chapter deep dive">
        ${tabButtons}
      </nav>
      <div class="climate-tab-panels">
        ${tabPanels}
      </div>
    </div>`;
}
```

**Note:** `buildGrowthResearchGuideTab` reuses `safety-prep-item` CSS classes (already defined in report.css from FR-053). This is intentional — same visual pattern, no duplication needed.

- [ ] **Step 3: Wire L3 into `buildGrowthAndDevelopmentHTML`**

Add before the `return renderChapterCard(...)` line:

```js
  const deepDiveHTML = buildGrowthDeepDiveHTML(growth);
  const l3HTML = deepDiveHTML ? `<div class="depth-l3">${deepDiveHTML}</div>` : '';
```

Change the `renderChapterCard` call's 9th argument from `null` to `l3HTML || null`:

```js
  return renderChapterCard('growth', '08', craneSvg, 'Growth &amp; Development', 'What\'s being built around you — and what to watch for.', null, body, null, l3HTML || null, null, glanceHTML || null);
```

- [ ] **Step 4: Run tests**

```
npx jest tests/modules/growth/template.test.js --no-coverage
```

Expected: all 16 tests pass (5 existing + 11 new).

- [ ] **Step 5: Commit**

```
git add src/modules/growth/template.js tests/modules/growth/template.test.js
git commit -m "feat(fr-054): add L3 deep dive to growth chapter (permit trends + research guide)"
```

---

## Task 2: Build L4 research tables + tests

**Files:**
- Modify: `src/modules/growth/template.js`
- Modify: `tests/modules/growth/template.test.js`

- [ ] **Step 1: Write failing tests**

Add after the L3 describe block:

```js
describe('buildGrowthAndDevelopmentHTML — L4 research', () => {
  test('depth-l4 wrapper present when named projects exist', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/depth-l4/);
  });

  test('named projects table rendered', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/climate-data-table/);
  });

  test('named project names appear in table', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/Georgetown Commons Retail Center/);
    expect(html).toMatch(/Maplewood Subdivision Phase 2/);
  });

  test('project status appears in table', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/Under Construction/);
    expect(html).toMatch(/Approved/);
  });

  test('expected opening shown when available', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/2026/);
  });

  test('establishments table rendered when establishments present', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/Walmart Supercenter/);
    expect(html).toMatch(/CVS Pharmacy/);
  });

  test('L4 absent when no named projects and no establishments', () => {
    const g = { ...fullGrowth, namedProjects: [], establishments: [] };
    const html = buildGrowthAndDevelopmentHTML(g);
    expect(html).not.toMatch(/depth-l4/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

Run `npx jest tests/modules/growth/template.test.js --no-coverage` — new tests should FAIL.

- [ ] **Step 2: Add `buildGrowthResearchHTML` to template.js**

Add before `buildGrowthDeepDiveHTML`:

```js
function buildGrowthResearchHTML(growth) {
  if (!growth) return '';
  const { namedProjects = [], establishments = [] } = growth;

  const projectRows = namedProjects.map(p => `
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.type)}</td>
      <td>${escapeHtml(p.status)}</td>
      <td>${escapeHtml(p.expectedOpening || '—')}</td>
    </tr>`).join('');

  const projectsTable = projectRows ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Named Development Projects</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Project</th><th>Type</th><th>Status</th><th>Expected</th></tr></thead>
          <tbody>${projectRows}</tbody>
        </table>
      </div>
    </div>` : '';

  const establishmentRows = establishments.map(e => `
    <tr>
      <td>${escapeHtml(e.name)}</td>
      <td>${escapeHtml(e.label)}</td>
      <td>${e.distanceMiles.toFixed(1)} mi</td>
    </tr>`).join('');

  const establishmentsTable = establishmentRows ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Commercial Establishments Within 1.5 Miles</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Name</th><th>Category</th><th>Distance</th></tr></thead>
          <tbody>${establishmentRows}</tbody>
        </table>
      </div>
    </div>` : '';

  const content = [projectsTable, establishmentsTable].filter(Boolean).join('');
  return content || '';
}
```

- [ ] **Step 3: Wire L4 into `buildGrowthAndDevelopmentHTML`**

After the `l3HTML` line, add:

```js
  const researchHTML = buildGrowthResearchHTML(growth);
  const l4HTML = researchHTML ? `<div class="depth-l4">${researchHTML}</div>` : '';
  const fullHTML = [l3HTML, l4HTML].filter(Boolean).join('');
```

Change the `renderChapterCard` call to use `fullHTML`:

```js
  return renderChapterCard('growth', '08', craneSvg, 'Growth &amp; Development', 'What\'s being built around you — and what to watch for.', null, body, null, fullHTML || null, null, glanceHTML || null);
```

- [ ] **Step 4: Run tests**

```
npx jest tests/modules/growth/template.test.js --no-coverage
```

Expected: all 24 tests pass (16 existing + 8 new).

- [ ] **Step 5: Commit**

```
git add src/modules/growth/template.js tests/modules/growth/template.test.js
git commit -m "feat(fr-054): add L4 data tables to growth chapter"
```

---

## Task 3: CSS + verify + push

**Files:**
- Modify: `public/report.css`

- [ ] **Step 1: Find end of growth CSS in `public/report.css`**

Search for `prem-growth-source-link` or `prem-growth-automated-note` to locate the last growth CSS block.

- [ ] **Step 2: Add growth L3/L4 CSS after last growth rule**

```css
/* ── Growth Chapter L3/L4 ──────────────────────────────────────── */
.growth-deep-dive { margin-top: var(--space-4); }

.growth-deep-dive-label {
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-60);
  margin-bottom: var(--space-2);
}

.growth-permit-stat-row {
  display: flex;
  gap: var(--space-6);
  margin: var(--space-3) 0;
}

.growth-permit-stat {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.growth-permit-stat-label {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-30);
}

.growth-permit-stat-val {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--ch-growth);
}

.growth-permit-stat-sub {
  font-size: var(--text-xs);
  color: var(--ink-60);
}

.growth-permit-trend-up   { color: var(--badge-green-color); }
.growth-permit-trend-down { color: var(--badge-red-color); }
.growth-permit-trend-flat { color: var(--ink-60); }
```

- [ ] **Step 3: Run full test suite**

```
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 4: Commit CSS, write summary, push**

```
git add public/report.css
git commit -m "feat(fr-054): add growth L3/L4 CSS"

# create feature-requests/FR-054-growth-deep-dive/summary.md
git add feature-requests/FR-054-growth-deep-dive/summary.md
git commit -m "chore(fr-054): add implementation summary"
git push
```
