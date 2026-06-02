# FR-051 Traffic L3/L4 Deep Dive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add L3 (analytical narrative with best/worst departure windows) and L4 (raw data table per destination × time slot) to the Traffic Patterns chapter.

**Architecture:** Add `buildTrafficDeepDiveHTML` and `buildTrafficResearchHTML` to `src/modules/traffic/template.js`, wire both into `buildTrafficCardHTML` inside `chapter-inner` before `renderDepthSelector`, add CSS in `report.css`. No new API calls — all data already in `trafficData`.

**Tech Stack:** Vanilla JS template, reuses `climate-research-section` / `climate-data-table` for L4 tables, new CSS classes for L3 stat cards.

---

## File Map

| File | Change |
|------|--------|
| `src/modules/traffic/template.js` | Add `buildTrafficDeepDiveHTML`, `buildTrafficResearchHTML`; wire into `buildTrafficCardHTML` |
| `public/report.css` | Add `.traffic-deep-dive`, `.traffic-deep-dive-label`, `.traffic-ddi-stat-row`, `.traffic-ddi-stat`, `.traffic-ddi-stat-label`, `.traffic-ddi-stat-val`, `.traffic-ddi-stat-sub` |
| `tests/modules/traffic/template.test.js` | Add L3 and L4 describe blocks |

---

## Important: chapter structure note

Traffic's `depth-l2` lives in `<div class="chapter-full depth-l2">` OUTSIDE `<div class="chapter-inner">`. L3/L4 go INSIDE `chapter-inner`, before `${renderDepthSelector('traffic')}`. This is intentional — the analysis content is inner-width, the bar charts are full-width.

The `buildTrafficCardHTML` return template currently looks like:
```html
<section class="chapter" data-ch="traffic" data-depth="overview">
  <div class="chapter-inner">
    ...depth-l1...
    ${renderDepthSelector('traffic')}       ← L3/L4 go HERE, before this
  </div>
  <div class="chapter-full depth-l2">      ← L2 stays here
    ${sectionsHTML}
  </div>
</section>
```

---

## Task 1: Build `buildTrafficDeepDiveHTML` (L3) + tests

**Files:**
- Modify: `src/modules/traffic/template.js`
- Modify: `tests/modules/traffic/template.test.js`

### trafficData fixture for tests

The test file already has a `trafficData` fixture with one destination (`Kroger`), `stats.range: 4`. Add a second fixture with high variation for testing the annual cost and worst-window paths:

```js
const highVariationData = [
  {
    name: 'Downtown Office',
    location: { lat: 38.2, lng: -84.5 },
    traffic: {
      variations: [
        { label: 'Mon–Fri 7am', minutes: 18, percentAboveBase: 0,  display: 'Mon–Fri 7am' },
        { label: 'Mon–Fri 8am', minutes: 28, percentAboveBase: 55, display: 'Mon–Fri 8am' },
        { label: 'Mon–Fri 5pm', minutes: 32, percentAboveBase: 78, display: 'Mon–Fri 5pm' },
        { label: 'Sat 10am',    minutes: 20, percentAboveBase: 11, display: 'Sat 10am'    },
      ],
      stats: { min: 18, max: 32, avg: 24.5, range: 14 },
    },
  },
];
```

- [ ] **Step 1: Write failing tests**

Add to `tests/modules/traffic/template.test.js` after existing tests:

```js
describe('buildTrafficCardHTML — L3 deep dive', () => {
  test('depth-l3 wrapper present', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/depth-l3/);
  });

  test('traffic-deep-dive container rendered', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/traffic-deep-dive/);
  });

  test('low-variation narrative rendered when maxPct < 10', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/minimal/i);
  });

  test('high-variation narrative rendered when maxPct >= 20', () => {
    const html = buildTrafficCardHTML(highVariationData);
    expect(html).toMatch(/78%/);
  });

  test('best and worst windows shown when range > 0', () => {
    const html = buildTrafficCardHTML(highVariationData);
    expect(html).toMatch(/Best window/);
    expect(html).toMatch(/Worst window/);
    expect(html).toMatch(/Mon–Fri 7am/);
    expect(html).toMatch(/Mon–Fri 5pm/);
  });

  test('annual time cost shown when range >= 5', () => {
    const html = buildTrafficCardHTML(highVariationData);
    expect(html).toMatch(/hours per year/);
  });

  test('annual time cost absent when range < 5', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).not.toMatch(/hours per year/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildTrafficCardHTML(highVariationData);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

Run `npx jest tests/modules/traffic/template.test.js --no-coverage` — new tests should FAIL.

- [ ] **Step 2: Add `buildTrafficDeepDiveHTML` to template.js**

Add before `buildTrafficCardHTML`:

```js
function buildTrafficDeepDiveHTML(trafficData) {
  if (!trafficData || !trafficData.length) return '';

  const sorted = [...trafficData].sort((a, b) =>
    (b.traffic?.stats?.range || 0) - (a.traffic?.stats?.range || 0)
  );
  const primary = sorted[0];
  const { stats, variations } = primary.traffic;

  const maxPct = Math.max(...trafficData.flatMap(t =>
    t.traffic.variations.map(v => v.percentAboveBase || 0)
  ));

  const bestSlot  = variations.find(v => v.minutes === stats.min);
  const worstSlot = variations.find(v => v.minutes === stats.max && stats.range > 0);

  const impactNarrative = maxPct >= 20
    ? `Traffic adds up to ${maxPct}% to drive times during peak hours — a meaningful difference that compounds quickly on a daily commute.`
    : maxPct >= 10
    ? `Traffic adds up to ${maxPct}% to drive times during peak hours. Noticeable, but manageable with some schedule flexibility.`
    : `Traffic variation at this address is minimal — peak hours add less than 10% to drive times. Timing your trips matters less here than at many urban addresses.`;

  const bestWorstHTML = (bestSlot && worstSlot && stats.range > 0) ? `
    <div class="traffic-ddi-stat-row">
      <div class="traffic-ddi-stat">
        <div class="traffic-ddi-stat-label">Best window</div>
        <div class="traffic-ddi-stat-val">${escapeHtml(bestSlot.display)}</div>
        <div class="traffic-ddi-stat-sub">${stats.min} min to ${escapeHtml(primary.name)}</div>
      </div>
      <div class="traffic-ddi-stat">
        <div class="traffic-ddi-stat-label">Worst window</div>
        <div class="traffic-ddi-stat-val">${escapeHtml(worstSlot.display)}</div>
        <div class="traffic-ddi-stat-sub">${stats.max} min to ${escapeHtml(primary.name)}</div>
      </div>
    </div>` : '';

  const annualHours = Math.round(stats.range * 500 / 60);
  const annualHTML = (stats.range >= 5 && annualHours > 0) ? `
    <p class="prem-narrative-body">If you commute daily, the difference between the best and worst departure time adds up to roughly <strong>${annualHours} hours per year</strong> for the ${escapeHtml(primary.name)} trip alone. That's based on ${stats.range} min/trip × ~500 commutes/year (2 trips/day, 5 days/week, 50 weeks).</p>` : '';

  return `
    <div class="traffic-deep-dive">
      <div class="traffic-deep-dive-label">Traffic Pattern Analysis</div>
      <p class="prem-narrative-body">${impactNarrative}</p>
      ${bestWorstHTML}
      ${annualHTML}
      <p class="prem-disclaimer">Based on Google Distance Matrix departure time sampling. Actual traffic varies by day and season.</p>
    </div>`;
}
```

- [ ] **Step 3: Wire L3 into `buildTrafficCardHTML`**

Inside `buildTrafficCardHTML`, add before the `return` statement:

```js
  const deepDiveHTML = buildTrafficDeepDiveHTML(trafficData);
  const l3HTML = deepDiveHTML ? `<div class="depth-l3">${deepDiveHTML}</div>` : '';
```

In the returned template string, insert `${l3HTML}` between `depth-l1` and `renderDepthSelector`:

```html
      <div class="depth-l1">${buildTrafficGlanceHTML(trafficData)}</div>
      ${l3HTML}
      ${renderDepthSelector('traffic')}
```

- [ ] **Step 4: Run tests**

```
npx jest tests/modules/traffic/template.test.js --no-coverage
```

Expected: all tests pass (5 existing + 8 new = 13 total).

- [ ] **Step 5: Commit**

```
git add src/modules/traffic/template.js tests/modules/traffic/template.test.js
git commit -m "feat(fr-051): add L3 traffic pattern analysis"
```

---

## Task 2: Build `buildTrafficResearchHTML` (L4) + tests

**Files:**
- Modify: `src/modules/traffic/template.js`
- Modify: `tests/modules/traffic/template.test.js`

- [ ] **Step 1: Write failing tests**

Add after the L3 describe block:

```js
describe('buildTrafficCardHTML — L4 research', () => {
  test('depth-l4 wrapper present', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/depth-l4/);
  });

  test('research table rendered', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/climate-data-table/);
  });

  test('destination name appears as section label', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/Kroger/);
  });

  test('time slot rows rendered', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/Mon–Fri 8am/);
    expect(html).toMatch(/12 min/);
  });

  test('percentage above baseline shown', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/\+50%/);
  });

  test('baseline row shows "baseline" label for 0% slots', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/baseline/);
  });

  test('multiple destinations produce multiple tables', () => {
    const multiData = [...trafficData, ...highVariationData];
    const html = buildTrafficCardHTML(multiData);
    expect(html).toMatch(/Kroger/);
    expect(html).toMatch(/Downtown Office/);
  });

  test('L4 absent when trafficData is empty', () => {
    const html = buildTrafficCardHTML([]);
    expect(html).toBe('');
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildTrafficCardHTML(trafficData);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

Run `npx jest tests/modules/traffic/template.test.js --no-coverage` — new tests should FAIL.

- [ ] **Step 2: Add `buildTrafficResearchHTML` to template.js**

Add immediately before `buildTrafficDeepDiveHTML`:

```js
function buildTrafficResearchHTML(trafficData) {
  if (!trafficData || !trafficData.length) return '';

  const sections = trafficData.map(t => {
    const rows = t.traffic.variations.map(v => `
      <tr>
        <td>${escapeHtml(v.display)}</td>
        <td>${v.minutes} min</td>
        <td>${v.percentAboveBase > 0 ? `+${v.percentAboveBase}%` : 'baseline'}</td>
      </tr>`).join('');

    return `
      <div class="climate-research-section">
        <div class="climate-research-section-label">${escapeHtml(t.name)}</div>
        <div class="climate-table-scroll">
          <table class="climate-data-table">
            <thead><tr><th>Departure</th><th>Drive Time</th><th>Above Baseline</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <p class="prem-narrative-body">Best: ${t.traffic.stats.min} min · Worst: ${t.traffic.stats.max} min · Avg: ${t.traffic.stats.avg} min</p>
      </div>`;
  }).join('');

  return sections;
}
```

- [ ] **Step 3: Wire L4 into `buildTrafficCardHTML`**

After the `l3HTML` line, add:

```js
  const researchHTML = buildTrafficResearchHTML(trafficData);
  const l4HTML = researchHTML ? `<div class="depth-l4">${researchHTML}</div>` : '';
```

In the template string, after `${l3HTML}`:

```html
      ${l3HTML}
      ${l4HTML}
      ${renderDepthSelector('traffic')}
```

- [ ] **Step 4: Run tests**

```
npx jest tests/modules/traffic/template.test.js --no-coverage
```

Expected: all tests pass (13 existing + 9 new = 22 total).

- [ ] **Step 5: Commit**

```
git add src/modules/traffic/template.js tests/modules/traffic/template.test.js
git commit -m "feat(fr-051): add L4 raw data table to traffic chapter"
```

---

## Task 3: CSS + verify + push

**Files:**
- Modify: `public/report.css`

- [ ] **Step 1: Locate end of traffic CSS**

Search for `traffic-warning` or `traffic-section-divider` in `public/report.css` to find the last traffic CSS rule.

- [ ] **Step 2: Add traffic L3/L4 CSS after last traffic rule**

```css
/* ── Traffic Chapter L3/L4 ─────────────────────────────────────── */
.traffic-deep-dive { margin-top: var(--space-4); }

.traffic-deep-dive-label {
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-60);
  margin-bottom: var(--space-2);
}

.traffic-ddi-stat-row {
  display: flex;
  gap: var(--space-6);
  margin: var(--space-3) 0;
}

.traffic-ddi-stat {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.traffic-ddi-stat-label {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-30);
}

.traffic-ddi-stat-val {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--ch-traffic);
}

.traffic-ddi-stat-sub {
  font-size: var(--text-xs);
  color: var(--ink-60);
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
git commit -m "feat(fr-051): add traffic L3/L4 CSS"
```

- [ ] **Step 5: Write summary and push**

Create `feature-requests/FR-051-traffic-deep-dive/summary.md` with what shipped, then:

```
git add feature-requests/FR-051-traffic-deep-dive/summary.md
git commit -m "chore(fr-051): add implementation summary"
git push
```
