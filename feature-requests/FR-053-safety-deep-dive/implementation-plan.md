# FR-053 Safety L3/L4 Deep Dive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add L3 (2-tab deep dive: Crime Research + Home Safety Prep) and L4 (full emergency station data table) to the Safety & Emergency Response chapter.

**Architecture:** Add `buildSafetyCrimeResearchTab`, `buildSafetyHomePrepTab`, `buildSafetyDeepDiveHTML`, `buildSafetyResearchHTML` to `src/modules/safety/template.js`. Pass combined output as `fullHTML` (9th param) to `renderChapterCard` in `buildCrimeHTML`. No new API calls.

**Data available:**
- `crime`: `{ city, county }` — location strings only
- `emergency.police`: `{ name, address, distanceMiles, driveTimeMinutes, response: { estimate, category } }`
- `emergency.fire`: same

**Tech Stack:** Vanilla JS, reuses `climate-tab*` tab UI classes and `climate-research-section`/`climate-data-table` for L4.

---

## File Map

| File | Change |
|------|--------|
| `src/modules/safety/template.js` | Add 4 new functions; update `buildCrimeHTML` to wire fullHTML |
| `public/report.css` | Add `.safety-deep-dive`, `.safety-deep-dive-label`, `.safety-prep-item`, `.safety-prep-item-hd`, `.safety-prep-item-icon`, `.safety-prep-item-title`, `.safety-prep-item-detail` |
| `tests/modules/safety/template.test.js` | Add L3 and L4 describe blocks |

---

## Important: wiring in `buildCrimeHTML`

Current last line of `buildCrimeHTML`:
```js
return renderChapterCard('safety', '06', shieldSvg, 'Safety & Emergency Response', '...', null, body, null, null, null, glanceHTML || null);
```
The `null` at position 8 (9th arg) is `fullHTML`. Change it to `fullHTML || null`.

---

## Task 1: Build L3 deep dive (2 tabs) + tests

**Files:**
- Modify: `src/modules/safety/template.js`
- Modify: `tests/modules/safety/template.test.js`

The existing `baseEmergency` fixture already has fire + police. Add a slow-response fixture for testing the urgent framing path:

```js
const slowEmergency = {
  police: {
    name: 'Rural County Sheriff',
    address: '1 County Rd',
    distanceMiles: '8.4',
    driveTimeMinutes: 18,
    response: { estimate: 18, category: { label: 'Extended', color: 'red' } },
  },
  fire: {
    name: 'Volunteer Fire Station 12',
    address: '2 Fire Rd',
    distanceMiles: '7.1',
    driveTimeMinutes: 15,
    response: { estimate: 15, category: { label: 'Extended', color: 'red' } },
  },
};
```

- [ ] **Step 1: Write failing tests**

Add to `tests/modules/safety/template.test.js` after existing tests:

```js
describe('buildCrimeHTML — L3 deep dive', () => {
  test('depth-l3 wrapper present', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/depth-l3/);
  });

  test('safety-deep-dive container rendered', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/safety-deep-dive/);
  });

  test('Crime Research tab rendered', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/Crime Research/);
  });

  test('CrimeMapping link rendered', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/crimemapping\.com/);
  });

  test('SpotCrime link rendered', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/spotcrime\.com/);
  });

  test('city name used in crime research when available', () => {
    const html = buildCrimeHTML({ city: 'Georgetown', county: 'Scott County' }, baseEmergency);
    expect(html).toMatch(/Georgetown/);
  });

  test('Home Safety Prep tab rendered', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/Home Safety Prep/);
  });

  test('smoke detector content present', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/smoke detector/i);
  });

  test('urgent framing when fire response > 10 min', () => {
    const html = buildCrimeHTML(null, slowEmergency);
    expect(html).toMatch(/15 min/);
  });

  test('L3 present when no crime object', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/depth-l3/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

Run `npx jest tests/modules/safety/template.test.js --no-coverage` — new tests should FAIL.

- [ ] **Step 2: Add tab builder functions and `buildSafetyDeepDiveHTML` to template.js**

Add these functions before `buildCrimeHTML`:

```js
function buildSafetyCrimeResearchTab(crime) {
  const city   = crime?.city   || '';
  const county = crime?.county || 'your county';
  const cityQuery   = city   ? encodeURIComponent(city)   : '';
  const countyQuery = county ? encodeURIComponent(county) : '';
  const locationLabel = city || county;

  return `
    <p class="prem-narrative-body">No public crime database covers every neighborhood equally, but combining two or three sources gives a useful picture of recent incident trends on your specific block.</p>
    <div class="safety-prep-item">
      <div class="safety-prep-item-hd">
        <span class="safety-prep-item-icon">🗺️</span>
        <span class="safety-prep-item-title">CrimeMapping.com</span>
      </div>
      <p class="safety-prep-item-detail"><a href="https://www.crimemapping.com/map${cityQuery ? `?loc=${cityQuery}` : ''}" target="_blank" rel="noopener noreferrer">CrimeMapping.com</a> — Real-time incident data from participating agencies. Enter the exact address and filter to 90 days. Look at the block level, not city average.</p>
    </div>
    <div class="safety-prep-item">
      <div class="safety-prep-item-hd">
        <span class="safety-prep-item-icon">📍</span>
        <span class="safety-prep-item-title">SpotCrime</span>
      </div>
      <p class="safety-prep-item-detail"><a href="https://spotcrime.com/" target="_blank" rel="noopener noreferrer">SpotCrime.com</a> — Aggregates police department incident feeds. Search by address for a 6-month view of nearby incidents.</p>
    </div>
    <div class="safety-prep-item">
      <div class="safety-prep-item-hd">
        <span class="safety-prep-item-icon">🏛️</span>
        <span class="safety-prep-item-title">${escapeHtml(locationLabel)} Police Department</span>
      </div>
      <p class="safety-prep-item-detail">Most departments publish their own crime maps or incident logs. Search "${escapeHtml(locationLabel)} police crime map" — the official source is the most current and most granular.</p>
    </div>
    <div class="safety-prep-item">
      <div class="safety-prep-item-hd">
        <span class="safety-prep-item-icon">📞</span>
        <span class="safety-prep-item-title">Call the non-emergency line</span>
      </div>
      <p class="safety-prep-item-detail">The fastest way to get a real picture: call the non-emergency line for the ${escapeHtml(locationLabel)} Police Department and ask for the community resource officer for this area. They'll tell you more in 5 minutes than any database.</p>
    </div>
    <p class="prem-disclaimer">Crime data is reported, not exhaustive. Incidents that go unreported, or that occurred before a department joined a reporting platform, won't appear.</p>`;
}

function buildSafetyHomePrepTab(emergency) {
  const fireMins = emergency?.fire?.response?.estimate;
  const urgentNote = fireMins > 10
    ? `<p class="prem-narrative-body"><strong>With a ~${fireMins}-minute fire response time, proactive home safety measures matter more here than average.</strong> The checklist below is worth completing before your first night in the house.</p>`
    : `<p class="prem-narrative-body">Basic home safety measures take an afternoon and create meaningful margins of safety regardless of location. Complete this checklist before your first night.</p>`;

  const items = [
    { icon: '🔊', title: 'Smoke detectors — every bedroom and hallway', detail: 'One smoke detector per bedroom, plus one in each hallway. Test every detector on move-in day. Replace batteries regardless of what the seller says. Total cost: $30–60.' },
    { icon: '💨', title: 'Carbon monoxide detector — each floor', detail: 'Required in most states for homes with attached garages or gas appliances. One per floor minimum, including basement. CO is odorless — these are the only warning.' },
    { icon: '🧯', title: 'Fire extinguisher — kitchen + each floor', detail: 'A 2.5 lb ABC extinguisher handles kitchen grease fires, electrical fires, and general combustibles. Mount it visible and accessible. Most house fires start in the kitchen.' },
    { icon: '🗺️', title: 'Two-exit plan for every room', detail: 'Walk every room and confirm two ways out. For upper floors: a collapsible ladder stored near the window is ~$40 and takes 30 seconds to deploy. Practice the plan once — don\'t just draw it.' },
    { icon: '📲', title: 'Post the address visibly outside', detail: 'Emergency responders lose time searching for house numbers in low-visibility conditions. Confirm your house number is visible from the street at night. This is the cheapest safety upgrade that exists.' },
  ];

  const rows = items.map(it => `
    <div class="safety-prep-item">
      <div class="safety-prep-item-hd">
        <span class="safety-prep-item-icon">${it.icon}</span>
        <span class="safety-prep-item-title">${escapeHtml(it.title)}</span>
      </div>
      <p class="safety-prep-item-detail">${escapeHtml(it.detail)}</p>
    </div>`).join('');

  return `${urgentNote}${rows}`;
}

function buildSafetyDeepDiveHTML(crime, emergency) {
  if (!emergency?.police && !emergency?.fire) return '';

  const tabs = [
    { id: 'crime',    label: 'Crime Research',   content: buildSafetyCrimeResearchTab(crime) },
    { id: 'homeprep', label: 'Home Safety Prep', content: buildSafetyHomePrepTab(emergency) },
  ];

  const tabButtons = tabs.map((t, i) =>
    `<button class="climate-tab${i === 0 ? ' climate-tab--active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="sftab-${t.id}" id="sfbtn-${t.id}">${t.label}</button>`
  ).join('');

  const tabPanels = tabs.map((t, i) =>
    `<div class="climate-tab-panel${i === 0 ? ' climate-tab-panel--active' : ''}" id="sftab-${t.id}" role="tabpanel" aria-labelledby="sfbtn-${t.id}">${t.content}</div>`
  ).join('');

  return `
    <div class="safety-deep-dive">
      <div class="safety-deep-dive-label">Safety in Depth</div>
      <nav class="climate-tab-nav" role="tablist" aria-label="Safety chapter deep dive">
        ${tabButtons}
      </nav>
      <div class="climate-tab-panels">
        ${tabPanels}
      </div>
    </div>`;
}
```

- [ ] **Step 3: Wire L3 into `buildCrimeHTML`**

In `buildCrimeHTML`, add these two lines just before the `return renderChapterCard(...)` line:

```js
  const deepDiveHTML = buildSafetyDeepDiveHTML(crime, emergency);
  const l3HTML = deepDiveHTML ? `<div class="depth-l3">${deepDiveHTML}</div>` : '';
```

Change the `renderChapterCard` call's 9th argument from `null` to `l3HTML || null`:

```js
  return renderChapterCard('safety', '06', shieldSvg, 'Safety & Emergency Response', 'Response times, fire coverage, and the things worth researching before you close.', null, body, null, l3HTML || null, null, glanceHTML || null);
```

- [ ] **Step 4: Run tests**

```
npx jest tests/modules/safety/template.test.js --no-coverage
```

Expected: all 16 tests pass (5 existing + 11 new).

- [ ] **Step 5: Commit**

```
git add src/modules/safety/template.js tests/modules/safety/template.test.js
git commit -m "feat(fr-053): add L3 deep dive to safety chapter (crime research + home prep)"
```

---

## Task 2: Build L4 research table + tests

**Files:**
- Modify: `src/modules/safety/template.js`
- Modify: `tests/modules/safety/template.test.js`

- [ ] **Step 1: Write failing tests**

Add after the L3 describe block:

```js
describe('buildCrimeHTML — L4 research', () => {
  test('depth-l4 wrapper present', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/depth-l4/);
  });

  test('station data table rendered', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/climate-data-table/);
  });

  test('police station name in table', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/Georgetown Police Department/);
  });

  test('fire station name in table', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/Georgetown Fire Station 1/);
  });

  test('response estimate shown in table', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/~6 min/);
    expect(html).toMatch(/~7 min/);
  });

  test('L4 absent when no emergency', () => {
    const html = buildCrimeHTML(null, null);
    expect(html).toBe('');
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

Run `npx jest tests/modules/safety/template.test.js --no-coverage` — new tests should FAIL.

- [ ] **Step 2: Add `buildSafetyResearchHTML` to template.js**

Add before `buildSafetyDeepDiveHTML`:

```js
function buildSafetyResearchHTML(emergency) {
  if (!emergency?.police && !emergency?.fire) return '';

  function stationRow(type, station) {
    if (!station) return '';
    const driveTime = station.driveTimeMinutes != null ? `${station.driveTimeMinutes} min drive` : '—';
    return `
      <tr>
        <td>${escapeHtml(type)}</td>
        <td>${escapeHtml(station.name)}</td>
        <td>${escapeHtml(station.address)}</td>
        <td>${escapeHtml(station.distanceMiles)} mi</td>
        <td>~${station.response.estimate} min</td>
        <td>${driveTime}</td>
      </tr>`;
  }

  const rows = [
    stationRow('Police / EMS', emergency.police),
    stationRow('Fire Station', emergency.fire),
  ].filter(Boolean).join('');

  if (!rows) return '';

  return `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Emergency Stations — Full Data</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Type</th><th>Name</th><th>Address</th><th>Distance</th><th>Est. Response</th><th>Drive Time</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="prem-disclaimer">Response estimates are calculated from station distance using typical dispatch speeds. Drive time is door-to-door from the subject address. Actual response varies with call volume and unit availability.</p>
    </div>`;
}
```

- [ ] **Step 3: Wire L4 into `buildCrimeHTML`**

After the `l3HTML` line, add:

```js
  const researchHTML = buildSafetyResearchHTML(emergency);
  const l4HTML = researchHTML ? `<div class="depth-l4">${researchHTML}</div>` : '';
  const fullHTML = [l3HTML, l4HTML].filter(Boolean).join('');
```

Change the `renderChapterCard` call to use `fullHTML`:

```js
  return renderChapterCard('safety', '06', shieldSvg, 'Safety & Emergency Response', 'Response times, fire coverage, and the things worth researching before you close.', null, body, null, fullHTML || null, null, glanceHTML || null);
```

- [ ] **Step 4: Run tests**

```
npx jest tests/modules/safety/template.test.js --no-coverage
```

Expected: all 23 tests pass (16 existing + 7 new).

- [ ] **Step 5: Commit**

```
git add src/modules/safety/template.js tests/modules/safety/template.test.js
git commit -m "feat(fr-053): add L4 station data table to safety chapter"
```

---

## Task 3: CSS + verify + push

**Files:**
- Modify: `public/report.css`

- [ ] **Step 1: Find end of safety CSS**

Search for `prem-safety-action-detail` or `prem-emergency` to locate the last safety CSS block.

- [ ] **Step 2: Add safety L3/L4 CSS**

```css
/* ── Safety Chapter L3/L4 ──────────────────────────────────────── */
.safety-deep-dive { margin-top: var(--space-4); }

.safety-deep-dive-label {
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-60);
  margin-bottom: var(--space-2);
}

.safety-prep-item {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--ink-10);
}

.safety-prep-item:last-of-type { border-bottom: none; }

.safety-prep-item-hd {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.safety-prep-item-icon {
  font-size: var(--text-base);
  flex-shrink: 0;
}

.safety-prep-item-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink);
}

.safety-prep-item-detail {
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
git commit -m "feat(fr-053): add safety L3/L4 CSS"

# create feature-requests/FR-053-safety-deep-dive/summary.md
git add feature-requests/FR-053-safety-deep-dive/summary.md
git commit -m "chore(fr-053): add implementation summary"
git push
```
