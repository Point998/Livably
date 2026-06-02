# FR-056 Walkability L3/L4 Deep Dive — Implementation Plan

**Goal:** Add L3 (2-tab deep dive: Walk Before Closing + Research Tools) and L4 (full destinations table) to the Walkability chapter.

**Architecture:** Add `buildWalkBeforeClosingTab`, `buildWalkResearchToolsTab`, `buildWalkDeepDiveHTML`, `buildWalkResearchHTML` to `src/modules/walkability/template.js`. The `walkFullHTML` (9th param) to `renderChapterCard` is **already used** for the verdict block — L3/L4 must be **appended** to it, not replace it.

**Data shapes:**
- `walk.score`: number (0–100)
- `walk.category`: `{ label, color, description }`
- `walk.destinations`: `[{ label, icon, name, distanceMiles, walkMinutes }]` — may be empty
- No location context (county/city) available in this module

---

## CRITICAL: fullHTML already in use

Current final call in `buildWalkabilityHTML`:
```js
return renderChapterCard('walk', '13', walkSvg, 'Getting Around on Foot', '...', null, walkLeftHTML, null, walkFullHTML, null, glanceHTML || null);
```

`walkFullHTML` (9th arg / `fullHTML`) is the verdict block. It must stay. Change to:
```js
const fullHTML = [walkFullHTML, l3HTML, l4HTML].filter(Boolean).join('');
return renderChapterCard('walk', '13', walkSvg, 'Getting Around on Foot', '...', null, walkLeftHTML, null, fullHTML || null, null, glanceHTML || null);
```

---

## File Map

| File | Change |
|------|--------|
| `src/modules/walkability/template.js` | Add 4 new functions; update final `renderChapterCard` call |
| `public/report.css` | Add `.walk-deep-dive`, `.walk-deep-dive-label` |
| `tests/modules/walkability/template.test.js` | Add L3 and L4 describe blocks |

---

## Task 1: Build L3 deep dive (2 tabs) + tests

**Files:**
- Modify: `src/modules/walkability/template.js`
- Modify: `tests/modules/walkability/template.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/modules/walkability/template.test.js` after existing tests:

```js
describe('buildWalkabilityHTML — L3 deep dive', () => {
  test('depth-l3 wrapper present', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/depth-l3/);
  });

  test('walk-deep-dive container rendered', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/walk-deep-dive/);
  });

  test('Walk Before Closing tab rendered', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/Walk Before Closing/);
  });

  test('Street View mentioned in Walk Before Closing tab', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/Street View/);
  });

  test('Research Tools tab rendered', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/Research Tools/);
  });

  test('Walk Score link present', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/walkscore\.com/);
  });

  test('Google Maps link present', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/maps\.google\.com/);
  });

  test('L3 present for low-walkability address', () => {
    const lowWalk = { ...baseWalk, score: 10, category: { label: 'Very Car-Dependent', color: 'red', description: 'Almost all errands require a car.' } };
    const html = buildWalkabilityHTML(lowWalk);
    expect(html).toMatch(/depth-l3/);
  });

  test('verdict block still present (fullHTML append not replace)', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/walk-verdict-block/);
    expect(html).toMatch(/depth-l3/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildWalkabilityHTML(baseWalk);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

Run `npx jest tests/modules/walkability/template.test.js --no-coverage` — new tests should FAIL.

- [ ] **Step 2: Add tab builder functions and `buildWalkDeepDiveHTML` to template.js**

Add these functions before `buildWalkabilityHTML`:

```js
function buildWalkBeforeClosingTab(walk) {
  const { score } = walk;

  const scoreContext = score >= 70
    ? 'The destinations nearby are genuine and close. The main thing to verify is route quality — sidewalk continuity, crossing conditions, and lighting.'
    : score >= 50
    ? "Walking is situationally useful here. Before closing, identify the specific trips you'd actually make on foot and test each one."
    : 'Car-dependency is the reality here. Still worth verifying what walking looks like for exercise, leisure, and occasional short trips.';

  const items = [
    {
      icon: '🚶',
      title: 'Walk your top destinations',
      detail: `Use the estimated walk times as a starting point, then test each route yourself. Grade changes, sidewalk gaps, and intersection wait times can make a route feel longer than the numbers suggest. ${scoreContext}`,
    },
    {
      icon: '🌃',
      title: 'Visit in the evening',
      detail: "Lighting, traffic pace, and pedestrian density shift after dark. If you'd be walking to a restaurant, transit stop, or gym at night, verify the route in those conditions — not just on a sunny weekend afternoon.",
    },
    {
      icon: '📱',
      title: 'Preview routes in Street View',
      detail: 'Before your next property visit, use Google Maps Street View to walk routes from the front door. Look for sidewalk gaps that force pedestrians into the road, construction blocking paths, and intersection crossing quality.',
    },
    {
      icon: '🚌',
      title: 'Verify transit frequency if it applies',
      detail: "If you're planning to supplement walking with transit, check specific route frequency and hours — not just that a stop exists. A bus that runs twice per day changes the math significantly. Use your city's transit authority app, not just Google Maps.",
    },
    {
      icon: '♿',
      title: 'Check accessibility if relevant',
      detail: 'If anyone in your household has mobility limitations, walk each route to verify curb cuts at crossings, ramp conditions, and surface continuity. ADA compliance does not guarantee day-to-day navigability.',
    },
  ];

  const rows = items.map((it) => `
    <div class="safety-prep-item">
      <div class="safety-prep-item-hd">
        <span class="safety-prep-item-icon">${it.icon}</span>
        <span class="safety-prep-item-title">${escapeHtml(it.title)}</span>
      </div>
      <p class="safety-prep-item-detail">${it.detail}</p>
    </div>`).join('');

  return `
    <p class="prem-narrative-body">Walk time data describes the address, not the experience on foot. These are the things worth verifying in person before closing.</p>
    ${rows}`;
}

function buildWalkResearchToolsTab() {
  const items = [
    {
      icon: '📊',
      title: 'Walk Score',
      detail: 'The industry-standard walkability database. Enter any US address to see Walk Score, Transit Score, and Bike Score with a breakdown of nearby amenities. More granular than proximity estimates for comparing walkability across addresses.',
      url: 'https://www.walkscore.com/',
    },
    {
      icon: '🗺️',
      title: 'Google Maps Street View',
      detail: 'Walk your routes before visiting. Drag the orange pegman onto any street to see ground-level conditions — sidewalk continuity, crossing infrastructure, and grade changes. Useful for previewing routes to the destinations listed above.',
      url: 'https://maps.google.com/',
    },
    {
      icon: '🚌',
      title: 'City transit trip planner',
      detail: "Search \"[your city] transit trip planner\" to find your local transit authority's official app. More accurate than Google Maps for real schedules and real-time service status. Check frequency and hours, not just whether a route exists.",
      url: null,
    },
    {
      icon: '🗂️',
      title: 'OpenStreetMap pedestrian layer',
      detail: 'A detailed community-mapped database of pedestrian infrastructure — sidewalks, footpaths, crossings, and pedestrian zones. Use the Transport map layer to see pedestrian routing in your specific area.',
      url: 'https://www.openstreetmap.org/',
    },
    {
      icon: '📋',
      title: 'City 311 / sidewalk inventory',
      detail: 'Search "[your city] 311 sidewalk" or "[your city] sidewalk inventory." Many cities maintain public records of reported sidewalk damage, planned repairs, and infrastructure gaps.',
      url: null,
    },
  ];

  const rows = items.map((it) => {
    const titleContent = it.url
      ? `<a href="${escapeHtml(it.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(it.title)}</a>`
      : escapeHtml(it.title);
    return `
    <div class="sensory-research-item">
      <div class="sensory-research-item-hd">
        <span class="sensory-research-item-icon">${it.icon}</span>
        <span class="sensory-research-item-title">${titleContent}</span>
      </div>
      <p class="sensory-research-item-detail">${it.detail}</p>
    </div>`;
  }).join('');

  return `
    <p class="prem-narrative-body">These tools let you go deeper on walkability and pedestrian conditions at this specific address.</p>
    ${rows}`;
}

function buildWalkDeepDiveHTML(walk) {
  if (!walk) return '';

  const tabs = [
    { id: 'verify',   label: 'Walk Before Closing', content: buildWalkBeforeClosingTab(walk) },
    { id: 'research', label: 'Research Tools',       content: buildWalkResearchToolsTab() },
  ];

  const tabButtons = tabs.map((t, i) =>
    `<button class="climate-tab${i === 0 ? ' climate-tab--active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="wktab-${t.id}" id="wkbtn-${t.id}">${t.label}</button>`
  ).join('');

  const tabPanels = tabs.map((t, i) =>
    `<div class="climate-tab-panel${i === 0 ? ' climate-tab-panel--active' : ''}" id="wktab-${t.id}" role="tabpanel" aria-labelledby="wkbtn-${t.id}">${t.content}</div>`
  ).join('');

  return `
    <div class="walk-deep-dive">
      <div class="walk-deep-dive-label">Walking in Depth</div>
      <nav class="climate-tab-nav" role="tablist" aria-label="Walkability chapter deep dive">
        ${tabButtons}
      </nav>
      <div class="climate-tab-panels">
        ${tabPanels}
      </div>
    </div>`;
}
```

- [ ] **Step 3: Wire L3 into `buildWalkabilityHTML`**

At the end of `buildWalkabilityHTML`, before the `return renderChapterCard(...)` line, add:

```js
  const deepDiveHTML = buildWalkDeepDiveHTML(walk);
  const l3HTML = deepDiveHTML ? `<div class="depth-l3">${deepDiveHTML}</div>` : '';
  const fullHTML = [walkFullHTML, l3HTML].filter(Boolean).join('');
```

Change the `renderChapterCard` call — replace `walkFullHTML` (9th arg) with `fullHTML || null`:

```js
  return renderChapterCard('walk', '13', walkSvg, 'Getting Around on Foot', "What's reachable without a car — and what that means for daily life.", null, walkLeftHTML, null, fullHTML || null, null, glanceHTML || null);
```

- [ ] **Step 4: Run tests**

```
npx jest tests/modules/walkability/template.test.js --no-coverage
```

Expected: all 17 tests pass (7 existing + 10 new).

- [ ] **Step 5: Commit**

```
git add src/modules/walkability/template.js tests/modules/walkability/template.test.js
git commit -m "feat(fr-056): add L3 deep dive to walkability chapter (walk audit + research tools)"
```

---

## Task 2: Build L4 destinations table + tests

**Files:**
- Modify: `src/modules/walkability/template.js`
- Modify: `tests/modules/walkability/template.test.js`

- [ ] **Step 1: Write failing tests**

Add after the L3 describe block:

```js
describe('buildWalkabilityHTML — L4 research', () => {
  test('depth-l4 wrapper present when destinations exist', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/depth-l4/);
  });

  test('destinations table rendered', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/climate-data-table/);
  });

  test('destination name appears in table', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/Kroger/);
    expect(html).toMatch(/Starbucks/);
  });

  test('walk time appears in table', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/14 min/);
    expect(html).toMatch(/8 min/);
  });

  test('distance displayed in table', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/0\.7 mi/);
  });

  test('verdict block still present alongside L4', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/walk-verdict-block/);
    expect(html).toMatch(/depth-l4/);
  });

  test('L4 absent when no destinations', () => {
    const noDestWalk = { ...baseWalk, destinations: [] };
    const html = buildWalkabilityHTML(noDestWalk);
    expect(html).not.toMatch(/depth-l4/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildWalkabilityHTML(baseWalk);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

Run `npx jest tests/modules/walkability/template.test.js --no-coverage` — new tests should FAIL.

- [ ] **Step 2: Add `buildWalkResearchHTML` to template.js**

Add before `buildWalkDeepDiveHTML`:

```js
function buildWalkResearchHTML(walk) {
  if (!walk?.destinations?.length) return '';
  const { destinations } = walk;

  const rows = destinations.map((d) => {
    const distDisplay = d.distanceMiles < 0.2
      ? `${Math.round(d.distanceMiles * 5280)} ft`
      : `${d.distanceMiles.toFixed(1)} mi`;
    return `
    <tr>
      <td>${escapeHtml(d.label)}</td>
      <td>${escapeHtml(d.name)}</td>
      <td>${d.walkMinutes} min</td>
      <td>${distDisplay}</td>
    </tr>`;
  }).join('');

  return `
    <div class="climate-research-section">
      <div class="climate-research-section-label">All Walkable Destinations</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Category</th><th>Name</th><th>Walk Time</th><th>Distance</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="prem-disclaimer">Walk times estimated from straight-line distance at average pedestrian pace. Not based on official Walk Score® data. Source: Google Places API.</p>
    </div>`;
}
```

- [ ] **Step 3: Wire L4 into `buildWalkabilityHTML`**

Replace the Task 1 wiring with the updated version that includes L4:

```js
  const deepDiveHTML = buildWalkDeepDiveHTML(walk);
  const l3HTML = deepDiveHTML ? `<div class="depth-l3">${deepDiveHTML}</div>` : '';
  const researchHTML = buildWalkResearchHTML(walk);
  const l4HTML = researchHTML ? `<div class="depth-l4">${researchHTML}</div>` : '';
  const fullHTML = [walkFullHTML, l3HTML, l4HTML].filter(Boolean).join('');
```

The `renderChapterCard` call stays the same as Task 1 (uses `fullHTML || null`).

- [ ] **Step 4: Run tests**

```
npx jest tests/modules/walkability/template.test.js --no-coverage
```

Expected: all 25 tests pass (17 existing + 8 new).

- [ ] **Step 5: Commit**

```
git add src/modules/walkability/template.js tests/modules/walkability/template.test.js
git commit -m "feat(fr-056): add L4 destinations table to walkability chapter"
```

---

## Task 3: CSS + verify + push

**Files:**
- Modify: `public/report.css`

- [ ] **Step 1: Add walkability L3/L4 CSS**

After `.prem-walk-feat-note` rule (before `/* ── Garden Subsections ──`):

```css
/* ── Walkability Chapter L3/L4 ─────────────────────────────────── */
.walk-deep-dive { margin-top: var(--space-4); }

.walk-deep-dive-label {
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-60);
  margin-bottom: var(--space-2);
}
```

- [ ] **Step 2: Run full test suite**

```
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Commit CSS, write summary, push**

```
git add public/report.css
git commit -m "feat(fr-056): add walkability L3/L4 CSS"

# create feature-requests/FR-056-walkability-deep-dive/summary.md
git add feature-requests/FR-056-walkability-deep-dive/
git commit -m "chore(fr-056): add spec, implementation plan, and summary"
git push
```
