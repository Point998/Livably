# FR-052 Schools L3/L4 Deep Dive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add L3 (2-tab deep dive: Research Tools + Enrollment Timeline) and L4 (full schools data table) to the Schools & Education chapter.

**Architecture:** Add `buildSchoolResearchToolsTab`, `buildSchoolEnrollmentTab`, `buildSchoolDeepDiveHTML`, and `buildSchoolResearchHTML` to `src/modules/schools/template.js`. Pass combined output as the `fullHTML` (9th) param to `renderChapterCard` in `buildSchoolRatingsHTML`. CSS in `report.css`. No new API calls.

**Tech Stack:** Vanilla JS, reuses `climate-tab*` tab UI classes and `climate-research-section` / `climate-data-table` for L4.

---

## Key: how renderChapterCard accepts L3/L4

`renderChapterCard` signature (position 0-indexed):
```
renderChapterCard(chKey, chNum, iconSvg, eyebrow, title, introHTML, leftHTML, rightHTML, fullHTML, sourceHTML, glanceHTML)
```

`fullHTML` (position 8) is rendered as `<div class="chapter-full">...</div>` between the main chapter body and the depth selector. Pass depth-l3 and depth-l4 wrappers inside it.

Current call in `buildSchoolRatingsHTML` (last line):
```js
return renderChapterCard('school', '05', bookSvg, 'Schools & Education', 'What you need to know before their first day.', null, body, null, null, null, glanceHTML || null);
```
Position 8 (`fullHTML`) is `null`. Change it to the combined L3/L4 string.

---

## File Map

| File | Change |
|------|--------|
| `src/modules/schools/template.js` | Add `buildSchoolResearchToolsTab`, `buildSchoolEnrollmentTab`, `buildSchoolDeepDiveHTML`, `buildSchoolResearchHTML`; update `buildSchoolRatingsHTML` call to pass fullHTML |
| `public/report.css` | Add `.school-deep-dive`, `.school-deep-dive-label`, `.school-research-item`, `.school-research-item-hd`, `.school-research-item-name`, `.school-research-item-link`, `.school-timeline-item`, `.school-timeline-when`, `.school-timeline-what` |
| `tests/modules/schools/template.test.js` | Add L3 and L4 describe blocks |

---

## Task 1: Build L3 deep dive (2 tabs) + tests

**Files:**
- Modify: `src/modules/schools/template.js`
- Modify: `tests/modules/schools/template.test.js`

The existing test fixture is `baseSchools`:
```js
{
  public: [{ name: 'Georgetown Elementary', level: 'Elementary', address: '100 School Rd, Georgetown, KY', distanceMiles: '1.2', driveTimeMinutes: 6 }],
  private: [],
}
```

Add a richer fixture for L3/L4 testing:

```js
const fullSchools = {
  public: [
    { name: 'Georgetown Elementary', level: 'Elementary', address: '100 School Rd, Georgetown, KY', distanceMiles: '1.2', driveTimeMinutes: 6 },
    { name: 'Georgetown Middle',     level: 'Middle',     address: '200 School Rd, Georgetown, KY', distanceMiles: '2.4', driveTimeMinutes: 9 },
    { name: 'Scott County High',     level: 'High',       address: '300 High School Dr, Georgetown, KY', distanceMiles: '3.1', driveTimeMinutes: 12 },
  ],
  private: [
    { name: 'Calvary Christian Academy', distanceMiles: '4.2', address: '10 Faith Dr, Georgetown, KY' },
  ],
};
```

- [ ] **Step 1: Write failing tests**

Add to `tests/modules/schools/template.test.js` after existing describe block:

```js
describe('buildSchoolRatingsHTML — L3 deep dive', () => {
  test('depth-l3 wrapper present', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/depth-l3/);
  });

  test('school-deep-dive container rendered', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/school-deep-dive/);
  });

  test('Research Tools tab rendered', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/Research Tools/);
  });

  test('GreatSchools link rendered for each public school', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/greatschools\.org/);
    expect(html).toMatch(/Georgetown Elementary/);
  });

  test('NCES link rendered', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/nces\.ed\.gov/);
  });

  test('Enrollment Timeline tab rendered', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/Enrollment Timeline/);
  });

  test('timeline items present', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/private school/i);
    expect(html).toMatch(/district/i);
  });

  test('L3 present even with only one public school', () => {
    const html = buildSchoolRatingsHTML(baseSchools);
    expect(html).toMatch(/depth-l3/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

Run `npx jest tests/modules/schools/template.test.js --no-coverage` — new tests should FAIL.

- [ ] **Step 2: Add tab builder functions and `buildSchoolDeepDiveHTML` to template.js**

Add these functions before `buildSchoolRatingsHTML`:

```js
function buildSchoolResearchToolsTab(schools) {
  const publicSchools = schools?.public?.filter(Boolean) || [];

  const schoolLinks = publicSchools.map(s => {
    const query = encodeURIComponent(s.name);
    return `
      <div class="school-research-item">
        <div class="school-research-item-hd">
          <span class="school-research-item-name">${escapeHtml(s.name)}</span>
          <span class="school-research-item-level">${escapeHtml(s.level)}</span>
        </div>
        <div class="school-research-item-link">
          <a href="https://www.greatschools.org/search/search.page?q=${query}" target="_blank" rel="noopener noreferrer">Search on GreatSchools →</a>
        </div>
      </div>`;
  }).join('');

  return `
    <p class="prem-narrative-body">GreatSchools ratings summarize test performance and equity metrics — useful as a starting point, but factor in parent reviews and a site visit before drawing conclusions.</p>
    ${schoolLinks || '<p class="prem-narrative-body">No public schools found — search GreatSchools.org directly with your address.</p>'}
    <div class="school-research-item" style="">
    </div>
    <p class="prem-narrative-body"><a href="https://nces.ed.gov/ccd/schoolsearch/" target="_blank" rel="noopener noreferrer">NCES School Search</a> — Federal database of public school enrollment, demographics, and staffing data. No ratings, just raw counts.</p>
    <p class="prem-narrative-body">Your state's Department of Education publishes annual school report cards. Search "<em>[state] school report card [school name]</em>" to find the official version.</p>
    <p class="prem-disclaimer">Ratings and data are updated annually and reflect a snapshot in time. Teaching staff, programs, and school culture change faster than published data.</p>`;
}

function buildSchoolEnrollmentTab() {
  const items = [
    { when: '12–18 months before',  what: 'Start researching private school options. Most selective schools open applications in the fall for the following school year — inquiry early.' },
    { when: '6–12 months before',   what: 'Submit private school applications. Waitlists fill quickly. If you\'re targeting a specific private school, this is the window that matters.' },
    { when: 'After offer accepted',  what: 'Call the district office immediately with your exact address and ask which school your parcel is zoned to at each level. Don\'t assume — boundaries split streets.' },
    { when: 'Feb–April (most districts)', what: 'Public school enrollment windows for the coming year open. Submit any open-enrollment or magnet program applications in this window.' },
    { when: 'Before closing',        what: 'Ask the district about any pending boundary changes or redistricting plans. Changes can affect which school your children attend starting the very next year.' },
    { when: 'Before school starts',  what: 'Contact the school directly to confirm after-school care availability, pickup times, and waitlist status. These fill up fast and have direct impact on work schedules.' },
  ];

  const rows = items.map(it => `
    <div class="school-timeline-item">
      <div class="school-timeline-when">${escapeHtml(it.when)}</div>
      <div class="school-timeline-what">${escapeHtml(it.what)}</div>
    </div>`).join('');

  return `
    <p class="prem-narrative-body">School enrollment has hard deadlines that don't flex around real estate timelines. Here's the calendar to plan around.</p>
    ${rows}
    <p class="prem-disclaimer">Timelines are typical for US school districts. Verify specific dates with your district and target schools — they vary by state and district policy.</p>`;
}

function buildSchoolDeepDiveHTML(schools) {
  if (!schools) return '';

  const tabs = [
    { id: 'research', label: 'Research Tools',      content: buildSchoolResearchToolsTab(schools) },
    { id: 'timeline', label: 'Enrollment Timeline', content: buildSchoolEnrollmentTab() },
  ];

  const tabButtons = tabs.map((t, i) =>
    `<button class="climate-tab${i === 0 ? ' climate-tab--active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="sdtab-${t.id}" id="sdbtn-${t.id}">${t.label}</button>`
  ).join('');

  const tabPanels = tabs.map((t, i) =>
    `<div class="climate-tab-panel${i === 0 ? ' climate-tab-panel--active' : ''}" id="sdtab-${t.id}" role="tabpanel" aria-labelledby="sdbtn-${t.id}">${t.content}</div>`
  ).join('');

  return `
    <div class="school-deep-dive">
      <div class="school-deep-dive-label">Schools in Depth</div>
      <nav class="climate-tab-nav" role="tablist" aria-label="Schools chapter deep dive">
        ${tabButtons}
      </nav>
      <div class="climate-tab-panels">
        ${tabPanels}
      </div>
    </div>`;
}
```

**IMPORTANT:** `buildSchoolResearchToolsTab` above contains a stray empty div that must be removed. The correct version of that function has NO empty div — remove these lines:
```js
    <div class="school-research-item" style="">
    </div>
```

The final `buildSchoolResearchToolsTab` should go directly from `${schoolLinks || ...}` to the NCES paragraph.

- [ ] **Step 3: Wire L3 into `buildSchoolRatingsHTML`**

In `buildSchoolRatingsHTML`, add before the `return renderChapterCard(...)` line:

```js
  const deepDiveHTML = buildSchoolDeepDiveHTML(schools);
  const l3HTML = deepDiveHTML ? `<div class="depth-l3">${deepDiveHTML}</div>` : '';
```

Change the `renderChapterCard` call's 9th argument (currently `null`) to `l3HTML || null`:

```js
  return renderChapterCard('school', '05', bookSvg, 'Schools & Education', 'What you need to know before their first day.', null, body, null, l3HTML || null, null, glanceHTML || null);
```

- [ ] **Step 4: Run tests**

```
npx jest tests/modules/schools/template.test.js --no-coverage
```

Expected: all 15 tests pass (6 existing + 9 new).

- [ ] **Step 5: Commit**

```
git add src/modules/schools/template.js tests/modules/schools/template.test.js
git commit -m "feat(fr-052): add L3 deep dive to schools chapter (research tools + enrollment timeline)"
```

---

## Task 2: Build L4 research table + tests

**Files:**
- Modify: `src/modules/schools/template.js`
- Modify: `tests/modules/schools/template.test.js`

- [ ] **Step 1: Write failing tests**

Add after the L3 describe block:

```js
describe('buildSchoolRatingsHTML — L4 research', () => {
  test('depth-l4 wrapper present', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/depth-l4/);
  });

  test('schools data table rendered', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/climate-data-table/);
  });

  test('all three public school levels appear in table', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/Georgetown Elementary/);
    expect(html).toMatch(/Georgetown Middle/);
    expect(html).toMatch(/Scott County High/);
  });

  test('private school appears in table', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/Calvary Christian Academy/);
  });

  test('drive time shown in table for schools that have it', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/6 min/);
  });

  test('table shows em-dash for private schools with no drive time', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/—/);
  });

  test('L4 absent when schools is null', () => {
    const html = buildSchoolRatingsHTML(null);
    expect(html).toBe('');
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

Run `npx jest tests/modules/schools/template.test.js --no-coverage` — new tests should FAIL.

- [ ] **Step 2: Add `buildSchoolResearchHTML` to template.js**

Add before `buildSchoolDeepDiveHTML`:

```js
function buildSchoolResearchHTML(schools) {
  if (!schools) return '';

  const publicSchools  = schools.public?.filter(Boolean) || [];
  const privateSchools = schools.private || [];

  if (!publicSchools.length && !privateSchools.length) return '';

  const publicRows = publicSchools.map(s => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td>Public</td>
      <td>${escapeHtml(s.level)}</td>
      <td>${escapeHtml(s.distanceMiles)} mi</td>
      <td>${s.driveTimeMinutes != null ? `${s.driveTimeMinutes} min` : '—'}</td>
    </tr>`).join('');

  const privateRows = privateSchools.map(s => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td>Private</td>
      <td>—</td>
      <td>${escapeHtml(s.distanceMiles)} mi</td>
      <td>—</td>
    </tr>`).join('');

  return `
    <div class="climate-research-section">
      <div class="climate-research-section-label">All Schools Found — Full Data</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Name</th><th>Type</th><th>Level</th><th>Distance</th><th>Drive Time</th></tr></thead>
          <tbody>${publicRows}${privateRows}</tbody>
        </table>
      </div>
      <p class="prem-disclaimer">Nearest schools by distance. Assigned school requires verification with the district. Private school list is not exhaustive.</p>
    </div>`;
}
```

- [ ] **Step 3: Wire L4 into `buildSchoolRatingsHTML`**

After the `l3HTML` line, add:

```js
  const researchHTML = buildSchoolResearchHTML(schools);
  const l4HTML = researchHTML ? `<div class="depth-l4">${researchHTML}</div>` : '';
  const fullHTML = [l3HTML, l4HTML].filter(Boolean).join('');
```

Change the `renderChapterCard` call to use `fullHTML`:

```js
  return renderChapterCard('school', '05', bookSvg, 'Schools & Education', 'What you need to know before their first day.', null, body, null, fullHTML || null, null, glanceHTML || null);
```

- [ ] **Step 4: Run tests**

```
npx jest tests/modules/schools/template.test.js --no-coverage
```

Expected: all 23 tests pass (6 existing + 9 L3 + 8 L4).

- [ ] **Step 5: Commit**

```
git add src/modules/schools/template.js tests/modules/schools/template.test.js
git commit -m "feat(fr-052): add L4 data table to schools chapter"
```

---

## Task 3: CSS + verify + push

**Files:**
- Modify: `public/report.css`

- [ ] **Step 1: Find end of schools CSS**

Search for `prem-school-choice` or `prem-school-assigned` to locate the last schools CSS block.

- [ ] **Step 2: Add schools L3/L4 CSS after last schools rule**

```css
/* ── Schools Chapter L3/L4 ─────────────────────────────────────── */
.school-deep-dive { margin-top: var(--space-4); }

.school-deep-dive-label {
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-60);
  margin-bottom: var(--space-2);
}

.school-research-item {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--ink-10);
}

.school-research-item:last-of-type { border-bottom: none; }

.school-research-item-hd {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.school-research-item-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink);
}

.school-research-item-level {
  font-size: var(--text-xs);
  color: var(--ink-60);
}

.school-research-item-link {
  font-size: var(--text-sm);
}

.school-timeline-item {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--ink-10);
}

.school-timeline-item:last-of-type { border-bottom: none; }

.school-timeline-when {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--ch-school);
  padding-top: 2px;
}

.school-timeline-what {
  font-size: var(--text-sm);
  color: var(--ink);
}

@media (max-width: 600px) {
  .school-timeline-item { grid-template-columns: 1fr; gap: var(--space-1); }
}
```

- [ ] **Step 3: Run full test suite**

```
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 4: Commit CSS**

```
git add public/report.css
git commit -m "feat(fr-052): add schools L3/L4 CSS"
```

- [ ] **Step 5: Write summary and push**

Create `feature-requests/FR-052-schools-deep-dive/summary.md`, then:

```
git add feature-requests/FR-052-schools-deep-dive/summary.md
git commit -m "chore(fr-052): add implementation summary"
git push
```
