# FR-050 Health L3/L4 Deep Dive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add L3 (3-tab Deep Read) and L4 (facilities table) content to the Health & Safety chapter, and thread `urgentCare` data through to the chapter template.

**Architecture:** Add two builder functions (`buildHealthDeepDiveHTML`, `buildHealthResearchHTML`) to `src/modules/health/template.js`, update the function signature to accept `urgentCare` as a third parameter, update the one call site in `reportPage.js`, add CSS in `report.css`, and add tests alongside each builder.

**Tech Stack:** Vanilla JS (Node), no new dependencies. Reuses `climate-tab*` CSS classes for the tab UI and `climate-research-section` / `climate-data-table` for L4 tables.

---

## File Map

| File | Change |
|------|--------|
| `src/modules/health/template.js` | Add `buildUrgentCareTab`, `buildStationDetailsTab`, `buildISOTab`, `buildHealthDeepDiveHTML`, `buildHealthResearchHTML`; update `buildHealthSafetyChapterHTML` signature and body |
| `src/templates/pages/reportPage.js` | Pass `urgentCare` as 3rd arg to `buildHealthSafetyChapterHTML` |
| `public/report.css` | Add `.health-deep-dive`, `.health-deep-dive-label`, `.health-station-detail`, `.health-station-detail-hd`, `.health-iso-grid`, `.health-iso-row`, `.health-iso-class`, `.health-iso-desc` |
| `tests/modules/health/template.test.js` | Add L3 and L4 describe blocks |

---

## Task 1: Add urgentCare to function signature and call site

**Files:**
- Modify: `src/modules/health/template.js:16`
- Modify: `src/templates/pages/reportPage.js:179`

- [ ] **Step 1: Write the failing test**

Add to `tests/modules/health/template.test.js`, after existing tests:

```js
describe('buildHealthSafetyChapterHTML — urgentCare threading', () => {
  test('accepts urgentCare as third param without error', () => {
    const uc = { name: 'FastCare Urgent Care', address: '5 Clinic Rd', driveTimeMinutes: 8 };
    expect(() => buildHealthSafetyChapterHTML(hospital, emergency, uc)).not.toThrow();
  });
  test('accepts undefined urgentCare without error', () => {
    expect(() => buildHealthSafetyChapterHTML(hospital, emergency, undefined)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest tests/modules/health/template.test.js --no-coverage
```

Expected: tests pass (adding a param to a function that ignores it doesn't throw — but we're setting the stage for later steps)

- [ ] **Step 3: Update function signature in template.js**

Change line 16 of `src/modules/health/template.js`:
```js
// Before:
function buildHealthSafetyChapterHTML(hospital, emergency) {

// After:
function buildHealthSafetyChapterHTML(hospital, emergency, urgentCare) {
```

- [ ] **Step 4: Update call site in reportPage.js**

Change line 179 of `src/templates/pages/reportPage.js`:
```js
// Before:
const healthSafetyChapterHTML = buildHealthSafetyChapterHTML(hospital, chapters?.emergency);

// After:
const healthSafetyChapterHTML = buildHealthSafetyChapterHTML(hospital, chapters?.emergency, urgentCare);
```

- [ ] **Step 5: Run tests**

```
npx jest tests/modules/health/template.test.js --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```
git add src/modules/health/template.js src/templates/pages/reportPage.js tests/modules/health/template.test.js
git commit -m "feat(fr-050): thread urgentCare param to health chapter template"
```

---

## Task 2: Build `buildHealthDeepDiveHTML` and its three tab builders

**Files:**
- Modify: `src/modules/health/template.js`
- Modify: `tests/modules/health/template.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/modules/health/template.test.js`:

```js
const urgentCare = { name: 'FastCare Urgent Care', address: '5 Clinic Rd', driveTimeMinutes: 8 };
const urgentCareCrossState = {
  name: 'Ohio Urgent Care', address: '1 Ohio St', driveTimeMinutes: 22,
  crossStateWarning: true, crossStateNote: 'This urgent care is in OH. No in-state facility found within the search radius.',
};

describe('buildHealthSafetyChapterHTML — L3 deep dive', () => {
  test('depth-l3 wrapper present when hospital present', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/depth-l3/);
  });

  test('health-deep-dive container rendered', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/health-deep-dive/);
  });

  test('Urgent Care tab rendered with name and drive time', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/Urgent Care/);
    expect(html).toMatch(/FastCare Urgent Care/);
    expect(html).toMatch(/8/);
  });

  test('Urgent Care tab shows fallback links when urgentCare is null', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, null);
    expect(html).toMatch(/solvhealth\.com/);
  });

  test('cross-state note shown when urgentCare is cross-state', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCareCrossState);
    expect(html).toMatch(/OH/);
  });

  test('Station Details tab rendered with fire station name', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/Station Details/);
    expect(html).toMatch(/Georgetown Fire Station 1/);
  });

  test('ISO Fire Rating tab always rendered', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/ISO Fire Rating/);
    expect(html).toMatch(/Public Protection Classification/);
  });

  test('ISO tab includes response time when fire data available', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/5.*min/);
  });

  test('Station Details tab absent when emergency is null', () => {
    const html = buildHealthSafetyChapterHTML(hospital, null, urgentCare);
    expect(html).not.toMatch(/Station Details/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx jest tests/modules/health/template.test.js --no-coverage
```

Expected: new tests FAIL (functions don't exist yet).

- [ ] **Step 3: Add tab builder functions to template.js**

Add these four functions to `src/modules/health/template.js`, before `buildHealthSafetyChapterHTML`:

```js
function buildUrgentCareTab(urgentCare, hospital) {
  if (!urgentCare) {
    return `
      <p class="prem-narrative-body">No urgent care clinic was found within the search radius for this address.</p>
      <p class="prem-narrative-body">To find nearby options, visit <a href="https://www.solvhealth.com/" target="_blank" rel="noopener noreferrer">Solv Health</a> or the <a href="https://www.urgentcarelocations.com/" target="_blank" rel="noopener noreferrer">Urgent Care Association directory</a> and enter this address directly.</p>`;
  }

  const comparison = hospital
    ? urgentCare.driveTimeMinutes < hospital.driveTimeMinutes
      ? `${urgentCare.driveTimeMinutes} min away — closer than the nearest ER (${hospital.driveTimeMinutes} min). For non-emergencies, urgent care is often the faster and lower-cost first stop.`
      : `${urgentCare.driveTimeMinutes} min away. For non-emergencies — ear infections, cuts, sprains, flu — urgent care handles most situations faster and at lower cost than an ER.`
    : `${urgentCare.driveTimeMinutes} min away.`;

  const crossStateNote = urgentCare.crossStateWarning
    ? `<p class="prem-narrative-body">${escapeHtml(urgentCare.crossStateNote)}</p>`
    : '';

  return `
    <p class="prem-narrative-body"><strong>${escapeHtml(urgentCare.name)}</strong> — ${comparison}</p>
    <p class="prem-narrative-body">${escapeHtml(urgentCare.address)}</p>
    ${crossStateNote}
    <p class="prem-disclaimer">Source: Google Places. Urgent care locations and hours change — confirm before visiting.</p>`;
}

function buildStationDetailsTab(emergency) {
  const fire   = emergency?.fire;
  const police = emergency?.police;

  function stationDetail(icon, type, station) {
    if (!station) return '';
    const { estimate, category } = station.response;
    const bc = category.color === 'green'  ? 'badge-response-green'
             : category.color === 'gold'   ? 'badge-response-gold'
             : category.color === 'orange' ? 'badge-response-orange'
             :                               'badge-response-red';
    return `
      <div class="health-station-detail">
        <div class="health-station-detail-hd">
          <span>${icon} ${escapeHtml(type)}</span>
          <span class="ch01-response-badge ${bc}">~${estimate} min · ${escapeHtml(category.label)}</span>
        </div>
        <p class="prem-narrative-body">${escapeHtml(station.name)}</p>
        <p class="prem-narrative-body">${escapeHtml(station.address)} · ${station.distanceMiles} mi</p>
      </div>`;
  }

  return `
    ${stationDetail('🚒', 'Fire Station', fire)}
    ${stationDetail('🚔', 'Police / EMS', police)}
    <p class="prem-disclaimer">Response times are estimates based on station distance and typical dispatch speeds. Actual times vary with call volume and unit availability.</p>`;
}

function buildISOTab(fire) {
  const responseNote = fire
    ? `<p class="prem-narrative-body">The nearest fire station is ~${fire.response.estimate} minutes away. Response time is one factor in your PPC rating — along with staffing, equipment, and water supply infrastructure.</p>`
    : '';

  return `
    <p class="prem-narrative-body">The Insurance Services Office (ISO) assigns every US address a <strong>Public Protection Classification (PPC)</strong> from 1 to 10. Your rating directly determines your homeowner's fire coverage cost.</p>
    <div class="health-iso-grid">
      <div class="health-iso-row"><span class="health-iso-class">Class 1–4</span><span class="health-iso-desc">Excellent protection — best rates</span></div>
      <div class="health-iso-row"><span class="health-iso-class">Class 5–8</span><span class="health-iso-desc">Standard protection — typical rates</span></div>
      <div class="health-iso-row"><span class="health-iso-class">Class 9</span><span class="health-iso-desc">Limited protection — higher premiums</span></div>
      <div class="health-iso-row"><span class="health-iso-class">Class 10</span><span class="health-iso-desc">No recognized protection — highest premiums</span></div>
    </div>
    ${responseNote}
    <p class="prem-narrative-body"><strong>How to get your rating:</strong> Call your homeowner's insurance agent and ask for the ISO PPC rating for this specific address. It takes one phone call, it's free, and it's address-specific — not neighborhood-level.</p>
    <p class="prem-disclaimer">Source: ISO/Verisk. Ratings are updated periodically. Your agent has the most current value for your address.</p>`;
}

function buildHealthDeepDiveHTML(hospital, emergency, urgentCare) {
  const hasFire   = !!(emergency?.fire);
  const hasPolice = !!(emergency?.police);

  const tabs = [
    { id: 'urgentcare', label: 'Urgent Care',       content: buildUrgentCareTab(urgentCare, hospital) },
    (hasFire || hasPolice)
      ? { id: 'stations', label: 'Station Details',  content: buildStationDetailsTab(emergency) }
      : null,
    { id: 'iso',        label: 'ISO Fire Rating',   content: buildISOTab(emergency?.fire) },
  ].filter(Boolean);

  const tabButtons = tabs.map((t, i) =>
    `<button class="climate-tab${i === 0 ? ' climate-tab--active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="hdtab-${t.id}" id="hdbtn-${t.id}">${t.label}</button>`
  ).join('');

  const tabPanels = tabs.map((t, i) =>
    `<div class="climate-tab-panel${i === 0 ? ' climate-tab-panel--active' : ''}" id="hdtab-${t.id}" role="tabpanel" aria-labelledby="hdbtn-${t.id}">${t.content}</div>`
  ).join('');

  return `
    <div class="health-deep-dive">
      <div class="health-deep-dive-label">Medical Access in Depth</div>
      <nav class="climate-tab-nav" role="tablist" aria-label="Health chapter deep dive">
        ${tabButtons}
      </nav>
      <div class="climate-tab-panels">
        ${tabPanels}
      </div>
    </div>`;
}
```

- [ ] **Step 4: Wire L3 into `buildHealthSafetyChapterHTML`**

In `src/modules/health/template.js`, just before the `return` statement of `buildHealthSafetyChapterHTML`, add:

```js
  const deepDiveHTML = buildHealthDeepDiveHTML(hospital, emergency, urgentCare);
  const l3HTML = deepDiveHTML ? `<div class="depth-l3">${deepDiveHTML}</div>` : '';
```

Then in the returned template string, insert `${l3HTML}` between `${renderDepthSelector('health')}` and the line above it:

```js
      // Before (at the end of chapter-inner div):
      ${renderDepthSelector('health')}
    </div>
  </section>

      // After:
      ${l3HTML}
      ${renderDepthSelector('health')}
    </div>
  </section>
```

- [ ] **Step 5: Run tests**

```
npx jest tests/modules/health/template.test.js --no-coverage
```

Expected: all L3 tests pass. 

- [ ] **Step 6: Commit**

```
git add src/modules/health/template.js tests/modules/health/template.test.js
git commit -m "feat(fr-050): add L3 deep dive HTML to health chapter (3 tabs)"
```

---

## Task 3: Build `buildHealthResearchHTML` (L4)

**Files:**
- Modify: `src/modules/health/template.js`
- Modify: `tests/modules/health/template.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/modules/health/template.test.js`:

```js
describe('buildHealthSafetyChapterHTML — L4 research', () => {
  test('depth-l4 wrapper present when hospital present', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/depth-l4/);
  });

  test('facilities table rendered', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/climate-data-table/);
  });

  test('ER row in research table', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/Emergency Room/);
    expect(html).toMatch(/Georgetown Community Hospital/);
  });

  test('urgent care row in research table when provided', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/Urgent Care/);
    expect(html).toMatch(/FastCare Urgent Care/);
  });

  test('urgent care row absent when urgentCare is null', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, null);
    // ER row still present, urgent care row absent
    expect(html).toMatch(/Emergency Room/);
    expect(html).not.toMatch(/FastCare/);
  });

  test('fire station row in research table', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/Fire Station/);
    expect(html).toMatch(/Georgetown Fire Station 1/);
  });

  test('L4 absent when no data at all', () => {
    const html = buildHealthSafetyChapterHTML(null, null, null);
    expect(html).toBe('');
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx jest tests/modules/health/template.test.js --no-coverage
```

Expected: new L4 tests FAIL.

- [ ] **Step 3: Add `buildHealthResearchHTML` to template.js**

Add before `buildHealthSafetyChapterHTML`:

```js
function buildHealthResearchHTML(hospital, emergency, urgentCare) {
  const rows = [
    hospital
      ? `<tr><td>Emergency Room</td><td>${escapeHtml(hospital.name)}</td><td>${escapeHtml(hospital.address)}</td><td>${hospital.driveTimeMinutes} min drive</td></tr>`
      : '',
    urgentCare
      ? `<tr><td>Urgent Care</td><td>${escapeHtml(urgentCare.name)}</td><td>${escapeHtml(urgentCare.address)}</td><td>${urgentCare.driveTimeMinutes} min drive</td></tr>`
      : '',
    emergency?.fire
      ? `<tr><td>Fire Station</td><td>${escapeHtml(emergency.fire.name)}</td><td>${escapeHtml(emergency.fire.address)}</td><td>~${emergency.fire.response.estimate} min response</td></tr>`
      : '',
    emergency?.police
      ? `<tr><td>Police / EMS</td><td>${escapeHtml(emergency.police.name)}</td><td>${escapeHtml(emergency.police.address)}</td><td>~${emergency.police.response.estimate} min response</td></tr>`
      : '',
  ].filter(Boolean).join('');

  if (!rows) return '';

  return `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Emergency Facilities — Full Data</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Type</th><th>Name</th><th>Address</th><th>Time</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}
```

- [ ] **Step 4: Wire L4 into `buildHealthSafetyChapterHTML`**

After the existing `l3HTML` line, add:

```js
  const researchHTML = buildHealthResearchHTML(hospital, emergency, urgentCare);
  const l4HTML = researchHTML ? `<div class="depth-l4">${researchHTML}</div>` : '';
```

And in the template string:

```js
      ${l3HTML}
      ${l4HTML}
      ${renderDepthSelector('health')}
```

- [ ] **Step 5: Run tests**

```
npx jest tests/modules/health/template.test.js --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```
git add src/modules/health/template.js tests/modules/health/template.test.js
git commit -m "feat(fr-050): add L4 research table to health chapter"
```

---

## Task 4: Add CSS

**Files:**
- Modify: `public/report.css`

- [ ] **Step 1: Locate the health CSS section**

Find the existing health chapter CSS block. Search for `ch01-` in `public/report.css` to locate the section end, then append the new rules immediately after.

- [ ] **Step 2: Add health L3/L4 CSS**

Find the last `.ch01-` rule block and add after it:

```css
/* ── Health Chapter L3/L4 ──────────────────────────────────────── */
.health-deep-dive { margin-top: var(--space-4); }

.health-deep-dive-label {
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-60);
  margin-bottom: var(--space-2);
}

.health-station-detail {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--ink-10);
}

.health-station-detail:last-of-type { border-bottom: none; }

.health-station-detail-hd {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-1);
}

.health-iso-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: var(--space-3) 0;
}

.health-iso-row {
  display: flex;
  gap: var(--space-3);
  align-items: baseline;
}

.health-iso-class {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--ch-health);
  min-width: 80px;
}

.health-iso-desc {
  font-size: var(--text-sm);
  color: var(--ink-60);
}
```

- [ ] **Step 3: Run full test suite to confirm no regressions**

```
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```
git add public/report.css
git commit -m "feat(fr-050): add health L3/L4 CSS tokens"
```

---

## Task 5: Verify and push

- [ ] **Step 1: Run full test suite**

```
npx jest --no-coverage
```

Expected: all tests pass (936+ tests).

- [ ] **Step 2: Push**

```
git push
```

- [ ] **Step 3: Write summary.md**

Create `feature-requests/FR-050-health-deep-dive/summary.md` with what shipped, what was skipped, and any notes for future chapters.
