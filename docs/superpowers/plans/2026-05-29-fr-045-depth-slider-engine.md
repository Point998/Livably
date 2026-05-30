# FR-045 Depth Slider Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a per-chapter depth selector (Glance / Overview / Deep Read / Research) with Glance bars for every chapter and depth-level CSS/JS infrastructure.

**Architecture:** Each `<section class="chapter">` gets a `data-depth="overview"` attribute and a depth selector dropdown in its header. CSS hides/shows `.depth-l2`, `.depth-l3`, `.depth-l4` divs based on that attribute. JS manages state via sessionStorage. Climate and Garden (which already have L3/L4 via toggle buttons) are migrated to use the new system; all other chapters get their Glance bar and the infrastructure for future L3/L4.

**Tech Stack:** Vanilla HTML/CSS/JS (no framework). Jest for unit tests. `src/templates/components/chapterCard.js` is the central rendering component used by 10 of 12 chapters.

**Out of scope:** L3/L4 content for chapters other than Climate and Garden — those are separate per-chapter FRs. Overview content improvements noted in the spec are also deferred.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/templates/components/depthSelector.js` | CREATE | Depth dropdown HTML generator |
| `src/templates/components/chapterCard.js` | MODIFY | Add `glanceHTML` param + depth selector + `data-depth` + `.depth-l2` on chapter-body |
| `src/templates/components/index.js` | MODIFY | Export `renderDepthSelector` |
| `public/report.css` | MODIFY | Depth-level visibility rules, selector styles |
| `public/ui.js` | MODIFY | Depth state management, sessionStorage, "Expand All", tab init updates |
| `src/templates/chapters/climate.js` | MODIFY | Extract glanceHTML param, wrap L3 in `.depth-l3`, wrap L4 in `.depth-l4`, remove toggle buttons |
| `src/templates/chapters/garden.js` | MODIFY | Add glance bar, wrap L3/L4, remove toggle button |
| `src/templates/chapters/health.js` | MODIFY | Add glance bar, `data-depth`, depth-l1/l2 wrappers (renders own HTML) |
| `src/templates/chapters/traffic.js` | MODIFY | Add glance bar, `data-depth`, depth-l1/l2 wrappers (renders own HTML) |
| `src/templates/chapters/schools.js` | MODIFY | Add glance bar, pass as `glanceHTML` |
| `src/templates/chapters/safety.js` | MODIFY | Add glance bar, pass as `glanceHTML` |
| `src/templates/chapters/community.js` | MODIFY | Add glance bar, pass as `glanceHTML` |
| `src/templates/chapters/growth.js` | MODIFY | Add glance bar, pass as `glanceHTML` |
| `src/templates/chapters/property.js` | MODIFY | Add glance bar, pass as `glanceHTML` |
| `src/templates/chapters/sensory.js` | MODIFY | Add glance bar, pass as `glanceHTML` |
| `src/templates/chapters/walkability.js` | MODIFY | Add glance bar, pass as `glanceHTML` |
| `src/templates/chapters/costs.js` | MODIFY | Add glance bar, pass as `glanceHTML` |
| `src/templates/pages/reportPage.js` | MODIFY | Add "Expand All to Research" button |
| `tests/templates/components/depthSelector.test.js` | CREATE | Unit tests for selector component |
| `tests/templates/chapters/climate.test.js` | MODIFY | Update tests for new depth system |
| `tests/templates/chapters/garden.test.js` | MODIFY | Update tests for new depth system |

---

## Task 1: Depth Visibility CSS

**Files:**
- Modify: `public/report.css`

No new file — append rules to the end of `public/report.css`. No Jest tests for CSS; the existing `tests/constraints/no-inline-styles.test.js` validates correct class usage.

- [ ] **Step 1: Append depth visibility rules to report.css**

Add the following block at the end of `public/report.css`:

```css
/* ── Depth Selector Component ───────────────────────────────────────── */
.chapter-depth-control {
  position: absolute;
  top: 1.5rem;
  right: var(--sp-4, 1.5rem);
  z-index: 10;
}

.chapter-depth-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.65rem;
  border: 1px solid currentColor;
  border-radius: 999px;
  background: transparent;
  font-size: 0.75rem;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  color: inherit;
  opacity: 0.7;
  transition: opacity 0.15s;
}
.chapter-depth-btn:hover { opacity: 1; }

.chapter-depth-menu {
  position: absolute;
  top: calc(100% + 0.25rem);
  right: 0;
  margin: 0;
  padding: 0.25rem 0;
  list-style: none;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 0.5rem;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  min-width: 8rem;
}

.chapter-depth-option {
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  cursor: pointer;
}
.chapter-depth-option:hover { background: var(--color-surface-2, #f5f5f5); }
.chapter-depth-option--selected { font-weight: 600; }

/* ── Depth Level Visibility ────────────────────────────────────────── */

/* Default render: data-depth="overview" set in HTML */
.chapter[data-depth="glance"]   .depth-l2,
.chapter[data-depth="glance"]   .depth-l3,
.chapter[data-depth="glance"]   .depth-l4 { display: none; }

.chapter[data-depth="overview"] .depth-l3,
.chapter[data-depth="overview"] .depth-l4 { display: none; }

.chapter[data-depth="deepread"] .depth-l4 { display: none; }

/* research: all layers visible — no additional rules needed */

/* ── Glance Bar ─────────────────────────────────────────────────────── */
.chapter-glance {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  padding: 0.65rem 0;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
  font-size: 0.8125rem;
}
.chapter-glance-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.chapter-glance-sep {
  color: var(--color-border, #ccc);
  font-size: 0.75rem;
}

/* ── "Expand All" button ────────────────────────────────────────────── */
.report-expand-all-wrap {
  text-align: right;
  margin-bottom: 1.5rem;
}
.report-expand-all-btn {
  background: none;
  border: 1px solid currentColor;
  border-radius: 999px;
  padding: 0.4rem 1rem;
  font-size: 0.75rem;
  font-family: inherit;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.15s;
}
.report-expand-all-btn:hover { opacity: 1; }
```

- [ ] **Step 2: Ensure chapter-inner is position:relative**

Search report.css for `.chapter-inner`. If it does not already have `position: relative;`, add it:
```css
.chapter-inner { position: relative; }
```
If it does exist in a block, add `position: relative;` to that block.

- [ ] **Step 3: Commit**
```bash
git add public/report.css
git commit -m "feat(fr-045): add depth selector and depth-level visibility CSS"
```

---

## Task 2: depthSelector Component

**Files:**
- Create: `src/templates/components/depthSelector.js`
- Create: `tests/templates/components/depthSelector.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/templates/components/depthSelector.test.js`:

```js
'use strict';
const { renderDepthSelector } = require('../../../src/templates/components/depthSelector');

describe('renderDepthSelector', () => {
  test('renders all 4 depth options', () => {
    const html = renderDepthSelector('climate');
    expect(html).toMatch(/data-depth="glance"/);
    expect(html).toMatch(/data-depth="overview"/);
    expect(html).toMatch(/data-depth="deepread"/);
    expect(html).toMatch(/data-depth="research"/);
  });

  test('overview is selected by default', () => {
    const html = renderDepthSelector('climate');
    expect(html).toMatch(/chapter-depth-option--selected[^>]*>Overview/);
  });

  test('custom default depth is reflected as selected', () => {
    const html = renderDepthSelector('garden', 'deepread');
    expect(html).toMatch(/chapter-depth-option--selected[^>]*>Deep Read/);
  });

  test('includes chKey as data-ch-key attribute', () => {
    const html = renderDepthSelector('garden');
    expect(html).toMatch(/data-ch-key="garden"/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = renderDepthSelector('climate');
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });

  test('escapes chKey to prevent XSS', () => {
    const html = renderDepthSelector('"><script>alert(1)</script>');
    expect(html).not.toMatch(/<script>/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/templates/components/depthSelector.test.js --no-coverage
```
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Create the component**

Create `src/templates/components/depthSelector.js`:

```js
'use strict';
const { escapeHtml } = require('../../utils/text');

const DEPTH_LEVELS = ['glance', 'overview', 'deepread', 'research'];
const DEPTH_LABELS = {
  glance:   'Glance',
  overview: 'Overview',
  deepread: 'Deep Read',
  research: 'Research',
};

function renderDepthSelector(chKey, defaultDepth = 'overview') {
  const options = DEPTH_LEVELS.map((d) => {
    const selected = d === defaultDepth;
    return `<li role="option" class="chapter-depth-option${selected ? ' chapter-depth-option--selected' : ''}" data-depth="${d}" aria-selected="${selected}">${DEPTH_LABELS[d]}</li>`;
  }).join('');

  return `<div class="chapter-depth-control" data-ch-key="${escapeHtml(chKey)}">
  <button class="chapter-depth-btn" aria-haspopup="listbox" aria-expanded="false">
    <span class="chapter-depth-label">${DEPTH_LABELS[defaultDepth] || 'Overview'}</span>
    <span class="chapter-depth-caret" aria-hidden="true">▾</span>
  </button>
  <ul class="chapter-depth-menu" role="listbox" aria-label="Content depth" hidden>
    ${options}
  </ul>
</div>`;
}

module.exports = { renderDepthSelector, DEPTH_LABELS };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/templates/components/depthSelector.test.js --no-coverage
```
Expected: PASS (6 tests)

- [ ] **Step 5: Export from components/index.js**

Open `src/templates/components/index.js`. Add the export:
```js
const { renderDepthSelector, DEPTH_LABELS } = require('./depthSelector');
// Add to module.exports:
module.exports = {
  // ...existing exports...
  renderDepthSelector,
  DEPTH_LABELS,
};
```

- [ ] **Step 6: Commit**
```bash
git add src/templates/components/depthSelector.js tests/templates/components/depthSelector.test.js src/templates/components/index.js
git commit -m "feat(fr-045): add depthSelector component"
```

---

## Task 3: Update renderChapterCard

**Files:**
- Modify: `src/templates/components/chapterCard.js`
- Test: Verify existing chapter tests still pass; add glanceHTML test

The current signature is:
```
renderChapterCard(chKey, chNum, iconSvg, eyebrow, title, introHTML, leftHTML, rightHTML, fullHTML, sourceHTML)
```
New signature adds optional `glanceHTML` as the 11th parameter (backward-compatible — all callers pass 10 args today).

- [ ] **Step 1: Write the failing test**

There's no existing `chapterCard.test.js`. Create `tests/templates/components/chapterCard.test.js`:

```js
'use strict';
const { renderChapterCard } = require('../../../src/templates/components/chapterCard');

describe('renderChapterCard', () => {
  const base = () => renderChapterCard('test', '01', null, 'Test', 'Test Title', null, '<p>left</p>', null, null, null);

  test('renders with required args', () => {
    const html = base();
    expect(html).toMatch(/data-ch="test"/);
    expect(html).toMatch(/Test Title/);
  });

  test('has data-depth="overview" by default', () => {
    const html = base();
    expect(html).toMatch(/data-depth="overview"/);
  });

  test('renders depth selector dropdown', () => {
    const html = base();
    expect(html).toMatch(/chapter-depth-control/);
    expect(html).toMatch(/data-depth="glance"/);
  });

  test('glanceHTML is rendered in depth-l1 div when provided', () => {
    const html = renderChapterCard('test', '01', null, 'T', 'T', null, '<p>left</p>', null, null, null, '<span class="glance-test">X</span>');
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/glance-test/);
  });

  test('chapter-body has depth-l2 class', () => {
    const html = base();
    expect(html).toMatch(/class="chapter-body depth-l2"/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = base();
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/templates/components/chapterCard.test.js --no-coverage
```
Expected: FAIL on `data-depth`, `chapter-depth-control`, `depth-l1`, `depth-l2`

- [ ] **Step 3: Update chapterCard.js**

Replace the full contents of `src/templates/components/chapterCard.js`:

```js
'use strict';
const { escapeHtml } = require('../../utils/text');
const { renderDepthSelector } = require('./depthSelector');

function renderChapterCard(chKey, chNum, iconSvg, eyebrow, title, introHTML, leftHTML, rightHTML, fullHTML, sourceHTML, glanceHTML) {
  const altClass = (parseInt(chNum, 10) || 0) % 2 === 0 ? ' chapter--alt' : '';
  return `
  <section class="chapter${altClass}" data-ch="${chKey}" data-depth="overview">
    <div class="chapter-inner">
      <div class="chapter-num" aria-hidden="true">${chNum}</div>
      <header class="chapter-hd">
        <div class="chapter-eyebrow">
          ${iconSvg ? `<span class="chapter-icon">${iconSvg}</span>` : ''}
          ${escapeHtml(eyebrow)}
        </div>
        <h2 class="chapter-title">${escapeHtml(title)}</h2>
      </header>
      ${introHTML ? `<p class="chapter-intro">${introHTML}</p>` : ''}
      ${glanceHTML ? `<div class="depth-l1">${glanceHTML}</div>` : ''}
      <div class="chapter-body depth-l2">
        <div class="chapter-left">${leftHTML || ''}</div>
        ${rightHTML ? `<div class="chapter-right">${rightHTML}</div>` : '<div class="chapter-right"></div>'}
      </div>
      ${fullHTML ? `</div><div class="chapter-full">${fullHTML}</div><div class="chapter-inner chapter-inner--continuation">` : ''}
      ${renderDepthSelector(chKey)}
      ${sourceHTML ? `<div class="chapter-source">${sourceHTML}</div>` : ''}
    </div>
  </section>
  <div class="chapter-rule"></div>`;
}

module.exports = { renderChapterCard };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/templates/components/chapterCard.test.js --no-coverage
```
Expected: PASS (6 tests)

- [ ] **Step 5: Run full test suite to catch regressions**

```bash
npx jest --no-coverage
```
Expected: All existing tests pass. If any chapter template test fails because it was asserting on the old HTML structure, update those assertions to match the new structure (e.g., `chapter-body depth-l2` instead of `chapter-body`).

- [ ] **Step 6: Commit**
```bash
git add src/templates/components/chapterCard.js tests/templates/components/chapterCard.test.js
git commit -m "feat(fr-045): add depth selector + glanceHTML slot to renderChapterCard"
```

---

## Task 4: ui.js Depth State Management

**Files:**
- Modify: `public/ui.js`

This adds `initDepthSelectors()` which handles the depth dropdown for ALL chapters uniformly. Also updates `initClimateDeepDive` and `initGardenDeepDive` to remove obsolete toggle handling (toggle buttons will be removed in Tasks 5–6).

No Jest test possible (browser JS). Verify behavior manually when running the server in Task 9.

- [ ] **Step 1: Add initDepthSelectors function to ui.js**

After the `initFocusRing` function (before the `// ── Init` section), add:

```js
  // ── 13. Depth selector dropdowns ──────────────────────
  // One handler manages all chapter depth selectors.
  // Updates data-depth on the chapter <section>, saves to sessionStorage.

  function initDepthSelectors() {
    var LABELS = { glance: 'Glance', overview: 'Overview', deepread: 'Deep Read', research: 'Research' };

    function restoreFromSession() {
      try {
        var saved = sessionStorage.getItem('livably-chapter-depths');
        if (!saved) return;
        var depths = JSON.parse(saved);
        Object.keys(depths).forEach(function (chKey) {
          var section = document.querySelector('[data-ch="' + chKey + '"]');
          if (section) applyDepth(section, depths[chKey]);
        });
      } catch (e) {}
    }

    function saveToSession(chKey, depth) {
      try {
        var saved = sessionStorage.getItem('livably-chapter-depths');
        var depths = saved ? JSON.parse(saved) : {};
        depths[chKey] = depth;
        sessionStorage.setItem('livably-chapter-depths', JSON.stringify(depths));
      } catch (e) {}
    }

    function applyDepth(section, depth) {
      section.setAttribute('data-depth', depth);
      var control = section.querySelector('.chapter-depth-control');
      if (!control) return;
      var label = control.querySelector('.chapter-depth-label');
      if (label) label.textContent = LABELS[depth] || depth;
      control.querySelectorAll('.chapter-depth-option').forEach(function (opt) {
        var isSelected = opt.dataset.depth === depth;
        opt.classList.toggle('chapter-depth-option--selected', isSelected);
        opt.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      });
    }

    document.querySelectorAll('.chapter-depth-control').forEach(function (control) {
      var btn = control.querySelector('.chapter-depth-btn');
      var menu = control.querySelector('.chapter-depth-menu');
      if (!btn || !menu) return;

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        menu.hidden = expanded;
      });

      menu.addEventListener('click', function (e) {
        var opt = e.target.closest('.chapter-depth-option');
        if (!opt) return;
        var depth = opt.dataset.depth;
        var section = control.closest('.chapter');
        if (!section || !depth) return;
        applyDepth(section, depth);
        var chKey = control.dataset.chKey;
        if (chKey) saveToSession(chKey, depth);
        btn.setAttribute('aria-expanded', 'false');
        menu.hidden = true;
      });
    });

    document.addEventListener('click', function () {
      document.querySelectorAll('.chapter-depth-btn[aria-expanded="true"]').forEach(function (btn) {
        btn.setAttribute('aria-expanded', 'false');
        var menu = btn.parentElement ? btn.parentElement.querySelector('.chapter-depth-menu') : null;
        if (menu) menu.hidden = true;
      });
    });

    restoreFromSession();
  }
```

- [ ] **Step 2: Add initExpandAll function to ui.js**

After `initDepthSelectors`, add:

```js
  // ── 14. "Expand All to Research" global button ────────
  function initExpandAll() {
    var btn = document.getElementById('expandAllResearch');
    if (!btn) return;
    btn.addEventListener('click', function () {
      document.querySelectorAll('.chapter[data-depth]').forEach(function (section) {
        section.setAttribute('data-depth', 'research');
        var control = section.querySelector('.chapter-depth-control');
        if (!control) return;
        var label = control.querySelector('.chapter-depth-label');
        if (label) label.textContent = 'Research';
        control.querySelectorAll('.chapter-depth-option').forEach(function (opt) {
          var isSelected = opt.dataset.depth === 'research';
          opt.classList.toggle('chapter-depth-option--selected', isSelected);
          opt.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });
      });
      try {
        var allResearch = {};
        document.querySelectorAll('.chapter[data-ch]').forEach(function (s) {
          allResearch[s.dataset.ch] = 'research';
        });
        sessionStorage.setItem('livably-chapter-depths', JSON.stringify(allResearch));
      } catch (e) {}
    });
  }
```

- [ ] **Step 3: Update initClimateDeepDive — remove toggle handlers, keep tab switching**

Replace the entire `initClimateDeepDive` function with:

```js
  // ── Climate tab switching (toggle buttons removed in FR-045) ──

  function initClimateDeepDive() {
    document.querySelectorAll('.climate-tab-nav').forEach(function (nav) {
      var deepDive = nav.closest('.climate-deep-dive');
      var panels = deepDive ? deepDive.querySelectorAll('.climate-tab-panel') : [];
      nav.addEventListener('click', function (e) {
        var btn = e.target.closest('[role="tab"]');
        if (!btn) return;
        var tabId = btn.getAttribute('aria-controls');
        nav.querySelectorAll('[role="tab"]').forEach(function (t) {
          t.setAttribute('aria-selected', 'false');
          t.classList.remove('climate-tab--active');
        });
        btn.setAttribute('aria-selected', 'true');
        btn.classList.add('climate-tab--active');
        panels.forEach(function (panel) {
          panel.classList.remove('climate-tab-panel--active');
          panel.hidden = true;
        });
        var activePanel = deepDive ? deepDive.querySelector('[id="' + tabId + '"]') : null;
        if (activePanel) {
          activePanel.classList.add('climate-tab-panel--active');
          activePanel.hidden = false;
        }
      });
    });
  }
```

- [ ] **Step 4: Update initGardenDeepDive — remove toggle handler, keep tab switching**

Replace the entire `initGardenDeepDive` function with:

```js
  // ── Garden tab switching (toggle button removed in FR-045) ──

  function initGardenDeepDive() {
    document.querySelectorAll('.garden-tab-nav').forEach(function (nav) {
      var deepDive = nav.closest('.garden-deep-dive');
      var panels = deepDive ? deepDive.querySelectorAll('.garden-tab-panel') : [];
      nav.addEventListener('click', function (e) {
        var btn = e.target.closest('[role="tab"]');
        if (!btn) return;
        var tabId = btn.getAttribute('aria-controls');
        nav.querySelectorAll('[role="tab"]').forEach(function (t) {
          t.setAttribute('aria-selected', 'false');
          t.classList.remove('garden-tab--active');
        });
        btn.setAttribute('aria-selected', 'true');
        btn.classList.add('garden-tab--active');
        panels.forEach(function (panel) {
          panel.classList.remove('garden-tab-panel--active');
          panel.hidden = true;
        });
        var activePanel = deepDive ? deepDive.querySelector('[id="' + tabId + '"]') : null;
        if (activePanel) {
          activePanel.classList.add('garden-tab-panel--active');
          activePanel.hidden = false;
        }
      });
    });
  }
```

- [ ] **Step 5: Add initDepthSelectors and initExpandAll to run()**

In the `run()` function, add the two new calls:

```js
  function run() {
    initStickyNav();
    initInsightRows();
    initChapterReveals();
    initSVGDrawAnimations();
    initDriveTimeCounters();
    initTrafficBars();
    initAgeBars();
    initFrostTimeline();
    initBortleMarker();
    initDestItems();
    initFocusRing();
    initGardenDeepDive();
    initClimateDeepDive();
    initDepthSelectors();   // new
    initExpandAll();         // new

    if (window.lucide) window.lucide.createIcons();
  }
```

- [ ] **Step 6: Run existing tests to catch regressions**

```bash
npx jest --no-coverage
```
Expected: all pass (ui.js is not unit-tested, only reports render tests run)

- [ ] **Step 7: Commit**
```bash
git add public/ui.js
git commit -m "feat(fr-045): add depth selector JS, sessionStorage persistence, Expand All"
```

---

## Task 5: Migrate climate.js to Depth System

**Files:**
- Modify: `src/templates/chapters/climate.js`
- Modify: `tests/templates/chapters/climate.test.js`

Climate already has L3 (`buildClimateDeepDiveHTML`) and L4 (`buildClimateResearchHTML`). Currently both are wrapped in toggle-button containers. This task:
1. Extracts `glanceHTML` from `leftHTML` to pass as `renderChapterCard` param
2. Rewrites `buildClimateDeepDiveHTML` to remove the toggle wrapper (just the tabbed content)
3. Rewrites `buildClimateResearchHTML` to remove the research toggle wrapper
4. Wraps L3 content in `<div class="depth-l3">` and L4 in `<div class="depth-l4">`

- [ ] **Step 1: Update tests for new structure**

Add these tests to `tests/templates/chapters/climate.test.js`, replacing or augmenting the "Level 3 Deep Read" and "Level 4 Research" describe blocks:

```js
describe('buildClimateChapterHTML — depth system', () => {
  test('renders depth-l1 glance bar', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/climate-glance/);
  });

  test('chapter-body has depth-l2 class', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    expect(html).toMatch(/chapter-body depth-l2/);
  });

  test('L3 deep dive content is wrapped in depth-l3', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    expect(html).toMatch(/depth-l3/);
    expect(html).toMatch(/climate-deep-dive/);
  });

  test('no climate-deep-toggle button (replaced by depth selector)', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    expect(html).not.toMatch(/climate-deep-toggle/);
  });

  test('no climate-research-toggle button (replaced by depth selector)', () => {
    const h = {
      ...baseHistory,
      stormEvents: { ...baseHistory.stormEvents, allEvents: [{ begin_date: '2021-02-11', event_type: 'Ice Storm', damage_property: 500000 }] },
    };
    const html = buildClimateChapterHTML(baseEnv, h, locationInfo);
    expect(html).not.toMatch(/climate-research-toggle/);
  });

  test('L4 research tables wrapped in depth-l4 when events present', () => {
    const h = {
      ...baseHistory,
      stormEvents: { ...baseHistory.stormEvents, allEvents: [{ begin_date: '2021-02-11', event_type: 'Ice Storm', damage_property: 500000 }] },
    };
    const html = buildClimateChapterHTML(baseEnv, h, locationInfo);
    expect(html).toMatch(/depth-l4/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/templates/chapters/climate.test.js --no-coverage
```
Expected: FAIL on depth-l1, depth-l2, depth-l3, depth-l4, and toggle button tests

- [ ] **Step 3: Rewrite buildClimateDeepDiveHTML — remove toggle wrapper**

In `src/templates/chapters/climate.js`, replace `buildClimateDeepDiveHTML`:

```js
function buildClimateDeepDiveHTML(climateHistory, locationInfo) {
  if (!climateHistory) return '';
  const { stormEvents, femaDeclarations, climateNormals, preparedness, basementContext } = climateHistory;
  const county = locationInfo?.county || 'this county';

  const tabs = [
    { id: 'flood',    label: 'Flood History',         content: buildFloodTab(stormEvents.floods, femaDeclarations, county) },
    { id: 'tornado',  label: 'Tornado History',        content: buildTornadoTab(stormEvents.tornadoes, basementContext, preparedness?.emergencySystem) },
    { id: 'winter',   label: 'Winter Weather',         content: buildWinterTab(stormEvents.winterStorms, climateNormals, preparedness?.roadPriority) },
    { id: 'heat',     label: 'Heat &amp; Drought',     content: buildHeatTab(stormEvents.heatEvents, climateNormals) },
    { id: 'prepared', label: 'Community Preparedness', content: buildPreparednessTab(preparedness, county) },
    { id: 'calendar', label: 'Month by Month',         content: buildClimateCalendarTab(climateNormals, stormEvents) },
  ];

  const tabButtons = tabs.map((t, i) =>
    `<button class="climate-tab${i === 0 ? ' climate-tab--active' : ''}" role="tab" aria-selected="${i === 0}" aria-controls="ctab-${t.id}" id="cbtn-${t.id}">${t.label}</button>`
  ).join('');

  const tabPanels = tabs.map((t, i) =>
    `<div class="climate-tab-panel${i === 0 ? ' climate-tab-panel--active' : ''}" id="ctab-${t.id}" role="tabpanel" aria-labelledby="cbtn-${t.id}">${t.content}</div>`
  ).join('');

  return `
    <div class="climate-deep-dive">
      <div class="climate-deep-dive-label">Weather History &amp; Preparedness</div>
      <nav class="climate-tab-nav" role="tablist" aria-label="Climate deep dive">
        ${tabButtons}
      </nav>
      <div class="climate-tab-panels">
        ${tabPanels}
      </div>
    </div>`;
}
```

- [ ] **Step 4: Rewrite buildClimateResearchHTML — remove toggle wrapper**

Replace `buildClimateResearchHTML`:

```js
function buildClimateResearchHTML(climateHistory) {
  if (!climateHistory) return '';
  const { stormEvents, climateNormals } = climateHistory;
  if (!stormEvents?.allEvents?.length) return '';

  const eventRows = (stormEvents.allEvents || [])
    .sort((a, b) => new Date(b.begin_date) - new Date(a.begin_date))
    .map((e) => {
      const dmg = e.damage_property ? `$${Number(e.damage_property).toLocaleString()}` : '—';
      const ef  = e.magnitude != null ? `EF${e.magnitude}` : '—';
      return `<tr>
        <td>${escapeHtml(e.begin_date?.slice(0, 10) || '?')}</td>
        <td>${escapeHtml(e.event_type || '?')}</td>
        <td>${ef}</td>
        <td>${e.deaths_direct ?? 0}</td>
        <td>${e.injuries_direct ?? 0}</td>
        <td>${dmg}</td>
      </tr>`;
    }).join('');

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const normalRows = (climateNormals?.monthly || []).map((m) =>
    `<tr>
      <td>${MONTH_NAMES[m.month - 1]}</td>
      <td>${m.tMaxF !== null ? Math.round(m.tMaxF) + '°F' : '—'}</td>
      <td>${m.tMinF !== null ? Math.round(m.tMinF) + '°F' : '—'}</td>
      <td>${m.precipIn !== null ? m.precipIn + '"' : '—'}</td>
      <td>${m.snowIn !== null ? m.snowIn + '"' : '—'}</td>
    </tr>`
  ).join('');

  return `
    <div class="climate-research-section-label">Complete Storm Event Log (${CLIMATE_STORM_LOOKBACK_YEARS} years)</div>
    ${eventRows ? `
    <div class="climate-table-scroll">
      <table class="climate-data-table">
        <thead><tr><th>Date</th><th>Event</th><th>Magnitude</th><th>Deaths</th><th>Injuries</th><th>Property Damage</th></tr></thead>
        <tbody>${eventRows}</tbody>
      </table>
    </div>` : ''}
    ${normalRows ? `
    <div class="climate-research-section-label">30-Year Monthly Climate Normals${climateNormals?.stationName ? ' — ' + escapeHtml(climateNormals.stationName) : ''}</div>
    <div class="climate-table-scroll">
      <table class="climate-data-table">
        <thead><tr><th>Month</th><th>Avg High</th><th>Avg Low</th><th>Precip</th><th>Snowfall</th></tr></thead>
        <tbody>${normalRows}</tbody>
      </table>
    </div>` : ''}
    <p class="prem-disclaimer">Source: NOAA Storm Events Database, NOAA Climate Normals.</p>`;
}
```

- [ ] **Step 5: Rewrite buildClimateChapterHTML — extract glance, wrap L3/L4**

In `buildClimateChapterHTML`, update the final assembly:

```js
  // (keep all existing code that builds leftHTML, tornadoHTML, etc.)
  // Then replace the final assembly block:

  const cloudSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="--path-len:80" aria-hidden="true"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" style="--path-len:80"/></svg>`;

  const deepDiveHTML = buildClimateDeepDiveHTML(climateHistory, locationInfo);
  const researchDataHTML = buildClimateResearchHTML(climateHistory);

  const fullHTML = [
    floodBannerHTML ? `<div class="depth-l3">${floodBannerHTML}${deepDiveHTML}</div>` : (deepDiveHTML ? `<div class="depth-l3">${deepDiveHTML}</div>` : ''),
    researchDataHTML ? `<div class="depth-l4">${researchDataHTML}</div>` : '',
  ].filter(Boolean).join('');

  // Pass glanceHTML as the 11th parameter
  return renderChapterCard('climate', '09', cloudSvg, 'Climate & Weather Risks', 'The risks that come with the address, not just the house.', null, leftHTML, null, fullHTML || null, null, glanceHTML);
```

And update the function signature to use the existing `glanceHTML` local variable (it's already built as `buildClimateGlanceHTML(environment, climateHistory)` inside the function — just ensure it's passed as the last arg above instead of being embedded in `leftHTML`).

To do this: in `buildClimateChapterHTML`, find where `glanceHTML` is used in `leftHTML` and remove it from there:
```js
  // Remove glanceHTML from leftHTML:
  const leftHTML = `
    ${tornadoHTML}
    <div class="prem-narrative">
      <p class="prem-narrative-lead">${floodPara}</p>
      ${femaCountHTML}
      ${watershedHTML}
    </div>
    ...rest of leftHTML (no glanceHTML here)...`;

  // glanceHTML is passed separately as 11th param to renderChapterCard
```

- [ ] **Step 6: Run tests**

```bash
npx jest tests/templates/chapters/climate.test.js --no-coverage
```
Expected: PASS. If "renders without climateHistory" test fails because glance bar is now null — that's fine, update assertion to not require the glance bar when climateHistory is null.

- [ ] **Step 7: Run full suite**

```bash
npx jest --no-coverage
```
Expected: all pass

- [ ] **Step 8: Commit**
```bash
git add src/templates/chapters/climate.js tests/templates/chapters/climate.test.js
git commit -m "feat(fr-045): migrate climate chapter to depth system — L3/L4 in depth divs"
```

---

## Task 6: Migrate garden.js to Depth System

**Files:**
- Modify: `src/templates/chapters/garden.js`
- Modify: `tests/templates/chapters/garden.test.js`

Garden already has L3 (`buildGardenDeepDiveHTML`) rendered inside `combinedFullHTML` with a toggle wrapper. This task adds a glance bar and removes the toggle wrapper in favour of the depth system.

- [ ] **Step 1: Add failing tests to tests/templates/chapters/garden.test.js**

Open `tests/templates/chapters/garden.test.js`. Add:

```js
describe('buildWhatWillGrowHTML — depth system (FR-045)', () => {
  const baseGarden = {
    hardinessZone: { zone: '6b', tempRange: '-5 to 0', frost: { lastSpring: 'April 15', firstFall: 'October 15', days: 183 } },
    nativePlants: [{ name: 'Red Maple', sci: 'Acer rubrum', count: 42 }],
    invasivePlants: [],
    wildlife: [],
    birds: [],
    nativePlantsByForm: { trees: [], shrubs: [], perennials: [], grasses: [], vines: [] },
    reptiles: [], insects: [], butterflies: [],
    birdsBySeason: { yearRound: [], spring: [], summer: [], fall: [], winter: [] },
    monarchCorridor: { inCorridor: false, milkweedSpecies: [] },
    fireflyHabitat: false,
  };
  const locationInfo = { state: 'KY', county: 'Scott County', zip: '40324' };

  test('renders depth-l1 glance bar', () => {
    const html = buildWhatWillGrowHTML(baseGarden, null, locationInfo);
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/chapter-glance/);
  });

  test('glance bar shows zone and species count', () => {
    const html = buildWhatWillGrowHTML(baseGarden, null, locationInfo);
    expect(html).toMatch(/6b/);
    expect(html).toMatch(/183.+days|days.+183/i);
  });

  test('no garden-deep-toggle button (replaced by depth selector)', () => {
    const html = buildWhatWillGrowHTML(baseGarden, null, locationInfo);
    expect(html).not.toMatch(/garden-deep-toggle/);
  });

  test('deep dive content wrapped in depth-l3', () => {
    const html = buildWhatWillGrowHTML(baseGarden, null, locationInfo);
    expect(html).toMatch(/depth-l3/);
    expect(html).toMatch(/garden-deep-dive/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildWhatWillGrowHTML(baseGarden, null, locationInfo);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/templates/chapters/garden.test.js --no-coverage
```
Expected: FAIL on depth-l1, chapter-glance, garden-deep-toggle, depth-l3

- [ ] **Step 3: Add buildGardenGlanceHTML to garden.js**

Add before `buildWhatWillGrowHTML`:

```js
function buildGardenGlanceHTML(gardenData) {
  if (!gardenData) return '';
  const zone = gardenData.hardinessZone?.zone;
  const days = gardenData.hardinessZone?.frost?.days;
  const nativeCount = gardenData.nativePlants?.length || 0;

  const items = [
    zone ? `<span class="chapter-glance-item">Zone ${escapeHtml(zone)}</span>` : '',
    days != null ? `<span class="chapter-glance-sep">·</span><span class="chapter-glance-item">${days}-day growing season</span>` : '',
    nativeCount > 0 ? `<span class="chapter-glance-sep">·</span><span class="chapter-glance-item">${nativeCount} native species documented nearby</span>` : '',
  ].filter(Boolean).join('');

  return items ? `<div class="chapter-glance">${items}</div>` : '';
}
```

- [ ] **Step 4: Update the garden deep dive builder — remove toggle wrapper**

Find `buildGardenDeepDiveHTML` in garden.js. Replace its return statement to remove the outer `<div class="garden-deep-wrap">` toggle wrapper:

```js
  // Return just the inner content — depth-l3 wrapper is applied in buildWhatWillGrowHTML
  return `
    <div class="garden-deep-dive">
      <nav class="garden-tab-nav" role="tablist" aria-label="Garden deep dive">
        ${tabButtons}
      </nav>
      <div class="garden-tab-panels">
        ${tabPanels}
      </div>
    </div>`;
```

- [ ] **Step 5: Update buildWhatWillGrowHTML — pass glance, wrap deep dive**

At the end of `buildWhatWillGrowHTML`, change the assembly:

```js
  // Build the deep dive content (L3)
  const deepDiveContent = buildGardenDeepDiveHTML(gardenData, locationInfo);
  const combinedFullHTML = deepDiveContent ? `<div class="depth-l3">${deepDiveContent}</div>` : '';

  // Build glance bar
  const glanceHTML = buildGardenGlanceHTML(gardenData);

  return renderChapterCard('garden', '10', leafSvg, 'What Will Grow Here', 'Your yard\'s potential — soil, season, and native species.', null, gardenBody, null, combinedFullHTML || null, null, glanceHTML);
```

- [ ] **Step 6: Run tests**

```bash
npx jest tests/templates/chapters/garden.test.js --no-coverage
```
Expected: PASS

- [ ] **Step 7: Run full suite**

```bash
npx jest --no-coverage
```
Expected: all pass

- [ ] **Step 8: Commit**
```bash
git add src/templates/chapters/garden.js tests/templates/chapters/garden.test.js
git commit -m "feat(fr-045): migrate garden chapter to depth system — glance bar + depth-l3"
```

---

## Task 7: Add Glance Bars to renderChapterCard Chapters

**Files:**
- Modify: `src/templates/chapters/schools.js`, `safety.js`, `community.js`, `growth.js`, `property.js`, `sensory.js`, `walkability.js`, `costs.js`
- Test: Modify corresponding test files in `tests/templates/chapters/`

Each chapter gets a `buildXGlanceHTML(data)` function that returns a `<div class="chapter-glance">` bar. The glance HTML is passed as the 11th param to `renderChapterCard`.

**Glance content spec per chapter (from FR-045 spec):**
- **schools**: "Assigned school requires verification" warning + nearest school drive time
- **safety**: Police response badge + Fire response badge
- **community**: Owner-occupancy % · Median tenure · Income vs national median
- **growth**: Named confirmed projects OR "No confirmed projects within 1 mile"
- **property**: Construction era short label · Soil drainage label
- **sensory**: AQI label · Radon Zone badge · Nearest airport distance (if any)
- **walkability**: Walk category label (Car-Dependent / Somewhat Walkable / Very Walkable)
- **costs**: Monthly carrying costs at $300k home price

For each chapter, follow the same pattern. Full example for **schools**, then abbreviated for the others:

### 7a: schools.js

- [ ] **Step 1: Write failing test — add to tests/templates/chapters/schools.test.js**

If the file doesn't exist, create it. Add:

```js
'use strict';
const { buildSchoolRatingsHTML } = require('../../../src/templates/chapters/schools');

const schools = {
  public: [
    { level: 'Elementary', name: 'Georgetown Elementary', address: '100 School St', distanceMiles: '1.2', driveTimeMinutes: 5 },
    { level: 'Middle', name: 'Georgetown Middle', address: '200 School St', distanceMiles: '2.1', driveTimeMinutes: 8 },
    { level: 'High', name: 'Georgetown High', address: '300 School St', distanceMiles: '3.0', driveTimeMinutes: 12 },
  ],
  private: [],
};

describe('buildSchoolRatingsHTML — depth system (FR-045)', () => {
  test('renders depth-l1 glance bar', () => {
    const html = buildSchoolRatingsHTML(schools);
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/chapter-glance/);
  });

  test('glance bar shows nearest school drive time', () => {
    const html = buildSchoolRatingsHTML(schools);
    expect(html).toMatch(/5\s*min/i);
  });

  test('glance bar shows verification required warning', () => {
    const html = buildSchoolRatingsHTML(schools);
    expect(html).toMatch(/verification|verify/i);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildSchoolRatingsHTML(schools);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

```bash
npx jest tests/templates/chapters/schools.test.js --no-coverage
```

- [ ] **Step 3: Add buildSchoolGlanceHTML to schools.js and wire it in**

Add to `src/templates/chapters/schools.js` before `buildSchoolRatingsHTML`:

```js
function buildSchoolGlanceHTML(schools) {
  if (!schools) return '';
  const first = (schools.public || []).find(Boolean);
  const driveMins = first?.driveTimeMinutes != null ? `${first.driveTimeMinutes} min` : null;

  return `<div class="chapter-glance">
    <span class="chapter-glance-item">⚠ Assigned school requires district verification</span>
    ${driveMins ? `<span class="chapter-glance-sep">·</span><span class="chapter-glance-item">Nearest: ${escapeHtml(first.name)} — ${escapeHtml(driveMins)}</span>` : ''}
  </div>`;
}
```

At the end of `buildSchoolRatingsHTML`, change the `renderChapterCard` call to pass `buildSchoolGlanceHTML(schools)` as the 11th argument:

```js
  return renderChapterCard('school', '05', bookSvg, 'Schools & Education', '...', null, body, null, null, null, buildSchoolGlanceHTML(schools));
```

- [ ] **Step 4: Run tests**

```bash
npx jest tests/templates/chapters/schools.test.js --no-coverage
```
Expected: PASS

### 7b–7h: Remaining renderChapterCard chapters

Follow the exact same 4-step pattern for each chapter:

**safety.js** — `buildSafetyGlanceHTML(safetyLocation, emergency)`:
```js
function buildSafetyGlanceHTML(safetyLocation, emergency) {
  const fire   = emergency?.fire;
  const police = emergency?.police;
  if (!fire && !police) return '';

  const item = (label, station) => {
    if (!station) return '';
    const { estimate, category } = station.response;
    return `<span class="chapter-glance-item">${label}: ~${estimate} min <span class="prem-badge badge-${category.color}">${escapeHtml(category.label)}</span></span>`;
  };

  const fireItem   = item('Fire', fire);
  const policeItem = item('Police', police);
  const sep = fireItem && policeItem ? '<span class="chapter-glance-sep">·</span>' : '';

  return `<div class="chapter-glance">${fireItem}${sep}${policeItem}</div>`;
}
```
Wire: `renderChapterCard(..., null, buildSafetyGlanceHTML(safetyLocation, emergency))`

**community.js** — `buildCommunityGlanceHTML(demographics)`:
```js
function buildCommunityGlanceHTML(demographics) {
  if (!demographics) return '';
  const { ownershipRate, medianTenureYears } = demographics.community || {};
  const income = demographics.income;

  const items = [
    ownershipRate != null ? `<span class="chapter-glance-item">${ownershipRate}% owner-occupied</span>` : '',
    medianTenureYears != null ? `<span class="chapter-glance-sep">·</span><span class="chapter-glance-item">Median ${medianTenureYears}-yr tenure</span>` : '',
    income?.level?.label ? `<span class="chapter-glance-sep">·</span><span class="chapter-glance-item prem-badge badge-${income.level.color}">${escapeHtml(income.level.label)}</span>` : '',
  ].filter(Boolean).join('');

  return items ? `<div class="chapter-glance">${items}</div>` : '';
}
```
Wire: `renderChapterCard(..., null, body, null, null, null, buildCommunityGlanceHTML(demographics))`

**growth.js** — `buildGrowthGlanceHTML(growth)`:
```js
function buildGrowthGlanceHTML(growth) {
  if (!growth) return '';
  const named = (growth.namedProjects || []).filter((p) => p.confirmed);
  const text = named.length > 0
    ? named.slice(0, 2).map((p) => escapeHtml(p.name)).join(', ')
    : 'No confirmed development projects within 1 mile';
  return `<div class="chapter-glance"><span class="chapter-glance-item">${text}</span></div>`;
}
```
Wire: `renderChapterCard(..., null, body, null, null, null, buildGrowthGlanceHTML(growth))`

**property.js** — `buildPropertyGlanceHTML(propIntel)`:
```js
function buildPropertyGlanceHTML(propIntel) {
  if (!propIntel) return '';
  const eraLabel = propIntel.era?.context?.era;
  const drain = propIntel.soil?.drainageCategory;

  const items = [
    eraLabel ? `<span class="chapter-glance-item">${escapeHtml(eraLabel.split(' ').slice(0, 3).join(' '))}</span>` : '',
    drain?.label ? `<span class="chapter-glance-sep">·</span><span class="chapter-glance-item">${escapeHtml(drain.label)}</span>` : '',
  ].filter(Boolean).join('');

  return items ? `<div class="chapter-glance">${items}</div>` : '';
}
```
Wire: `renderChapterCard(..., null, body, null, null, null, buildPropertyGlanceHTML(propIntel))`

**sensory.js** — `buildSensoryGlanceHTML(environment)`:
```js
function buildSensoryGlanceHTML(environment) {
  if (!environment) return '';
  const aqi    = environment.airQuality;
  const radon  = environment.radon;
  const apt    = (environment.airports || [])[0];

  const items = [
    aqi?.category?.label ? `<span class="chapter-glance-item">AQI: <span class="prem-badge badge-${aqi.category.color}">${escapeHtml(aqi.category.label)}</span></span>` : '',
    radon?.zone != null  ? `<span class="chapter-glance-sep">·</span><span class="chapter-glance-item">Radon Zone ${radon.zone}</span>` : '',
    apt?.distanceMiles   ? `<span class="chapter-glance-sep">·</span><span class="chapter-glance-item">Nearest airport: ${Math.round(apt.distanceMiles)} mi</span>` : '',
  ].filter(Boolean).join('');

  return items ? `<div class="chapter-glance">${items}</div>` : '';
}
```
Wire: `renderChapterCard('sensory', ..., null, leftHTML, sectionB, bortleFullHTML, null, buildSensoryGlanceHTML(environment))`

**walkability.js** — `buildWalkGlanceHTML(walk)`:
```js
function buildWalkGlanceHTML(walk) {
  if (!walk?.category) return '';
  return `<div class="chapter-glance">
    <span class="chapter-glance-item"><span class="prem-badge badge-${walk.category.color}">${escapeHtml(walk.category.label)}</span></span>
    <span class="chapter-glance-sep">·</span>
    <span class="chapter-glance-item">${escapeHtml(walk.category.description)}</span>
  </div>`;
}
```
Wire: `renderChapterCard('walk', ..., null, walkLeftHTML, null, walkFullHTML, null, buildWalkGlanceHTML(walk))`

**costs.js** — `buildCostsGlanceHTML(p)`:
```js
function buildCostsGlanceHTML(p) {
  if (!p) return '';
  const price = 300000;
  const taxMo = Math.round(price * (p.taxRate / 100) / 12);
  const insMo = Math.round(p.insuranceYear / 12);
  const total = taxMo + insMo + p.utilitiesMo;
  return `<div class="chapter-glance">
    <span class="chapter-glance-item">~$${total.toLocaleString()}/mo carrying costs at $300k (before mortgage)</span>
  </div>`;
}
```
Wire: `renderChapterCard('costs', ..., null, body, null, null, null, buildCostsGlanceHTML(p))`

- [ ] **Step 5: For each chapter — run its tests after wiring in the glance function**

```bash
npx jest tests/templates/chapters/safety.test.js --no-coverage
npx jest tests/templates/chapters/community.test.js --no-coverage
# etc. (run the test file for each chapter as you complete it)
```

If no test file exists for a chapter, create a minimal one that tests the glance bar:
```js
'use strict';
const { buildXHTML } = require('../../../src/templates/chapters/x');
describe('buildXHTML — depth system', () => {
  test('renders chapter-glance in depth-l1', () => {
    const html = buildXHTML(minimalMockData);
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/chapter-glance/);
  });
  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildXHTML(minimalMockData);
    expect(html.match(/style="(?!--)[^"]+"/g)).toBeNull();
  });
});
```

- [ ] **Step 6: Run full suite**

```bash
npx jest --no-coverage
```
Expected: all pass

- [ ] **Step 7: Commit all chapter glance bars**

```bash
git add src/templates/chapters/schools.js src/templates/chapters/safety.js src/templates/chapters/community.js src/templates/chapters/growth.js src/templates/chapters/property.js src/templates/chapters/sensory.js src/templates/chapters/walkability.js src/templates/chapters/costs.js tests/templates/chapters/
git commit -m "feat(fr-045): add glance bars to all renderChapterCard chapters"
```

---

## Task 8: Add Glance + Depth to health.js and traffic.js

**Files:**
- Modify: `src/templates/chapters/health.js`
- Modify: `src/templates/chapters/traffic.js`
- Test: `tests/templates/chapters/health.test.js` (create if missing), `tests/templates/chapters/traffic.test.js` (create if missing)

These two chapters render their own `<section class="chapter">` HTML rather than calling `renderChapterCard`. They need:
1. `data-depth="overview"` on the `<section>` tag
2. Depth selector HTML (call `renderDepthSelector(chKey)`)
3. Glance bar in `<div class="depth-l1">`
4. Existing body content wrapped in `<div class="chapter-body depth-l2">`

### 8a: health.js

- [ ] **Step 1: Write failing test**

Create `tests/templates/chapters/health.test.js`:

```js
'use strict';
const { buildHealthSafetyChapterHTML } = require('../../../src/templates/chapters/health');

const hospital = { name: 'Georgetown Hospital', driveTimeMinutes: 12, address: '100 Hospital Dr' };
const emergency = {
  fire:   { name: 'Georgetown Fire', distanceMiles: '1.2', response: { estimate: 5, category: { label: 'Excellent', color: 'green' } } },
  police: { name: 'Georgetown Police', distanceMiles: '0.8', response: { estimate: 4, category: { label: 'Excellent', color: 'green' } } },
};

describe('buildHealthSafetyChapterHTML — depth system (FR-045)', () => {
  test('renders depth-l1 glance bar', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency);
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/chapter-glance/);
  });

  test('glance bar shows ER drive time', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency);
    expect(html).toMatch(/12\s*min/i);
  });

  test('section has data-depth="overview"', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency);
    expect(html).toMatch(/data-depth="overview"/);
  });

  test('chapter-body has depth-l2 class', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency);
    expect(html).toMatch(/class="chapter-body depth-l2"/);
  });

  test('depth selector rendered', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency);
    expect(html).toMatch(/chapter-depth-control/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

```bash
npx jest tests/templates/chapters/health.test.js --no-coverage
```

- [ ] **Step 3: Update health.js**

Add imports at the top of health.js:
```js
const { renderDepthSelector } = require('../components/depthSelector');
```

Add `buildHealthGlanceHTML` before `buildHealthSafetyChapterHTML`:
```js
function buildHealthGlanceHTML(hospital, emergency) {
  const fire = emergency?.fire;
  const erItem = hospital
    ? `<span class="chapter-glance-item">ER: ${escapeHtml(hospital.name)} — ${hospital.driveTimeMinutes} min</span>`
    : '';
  const fireItem = fire
    ? `<span class="chapter-glance-sep">·</span><span class="chapter-glance-item">Fire: ~${fire.response.estimate} min <span class="prem-badge badge-${fire.response.category.color}">${escapeHtml(fire.response.category.label)}</span></span>`
    : '';
  return `<div class="chapter-glance">${erItem}${fireItem}</div>`;
}
```

Update the returned HTML in `buildHealthSafetyChapterHTML`:
```js
  return `
  <section class="chapter" data-ch="health" data-depth="overview">
    <div class="chapter-inner">
      <div class="chapter-num" aria-hidden="true">01</div>
      <header class="chapter-hd">
        <div class="chapter-eyebrow">
          <span class="chapter-icon">${erSvg}</span>
          Health &amp; Safety
        </div>
        <h2 class="chapter-title">When it matters most, proximity is everything.</h2>
      </header>
      <p class="chapter-intro">Emergency access shapes real outcomes. These are the numbers that matter most if something goes wrong.</p>
      <div class="depth-l1">${buildHealthGlanceHTML(hospital, emergency)}</div>
      <div class="chapter-body depth-l2">
        <div class="chapter-left">
          ${erHTML}
          ${checksHTML ? `<div class="ch01-checks"><div class="ch01-checks-label">Things to Check Before You Close</div>${checksHTML}</div>` : ''}
          <div class="key-takeaway">
            <span class="kt-icon">🔑</span>
            <div class="kt-body"><strong>Key Takeaway:</strong> ${escapeHtml(takeaway)}</div>
          </div>
          <p class="ch01-disclaimer">Response times are estimates based on station distance and typical dispatch speeds. Actual times vary by call volume and unit availability. Research date: ${today}.</p>
        </div>
        <div class="chapter-right">
          ${stationsHTML ? `<div class="snapshot-card"><div class="snapshot-card-label">Emergency Response</div><div class="ch01-stations">${stationsHTML}</div></div>` : ''}
        </div>
      </div>
      ${renderDepthSelector('health')}
    </div>
  </section>
  <div class="chapter-rule"></div>`;
```

- [ ] **Step 4: Run tests**

```bash
npx jest tests/templates/chapters/health.test.js --no-coverage
```
Expected: PASS

### 8b: traffic.js

- [ ] **Step 5: Write failing test for traffic.js**

Open `src/templates/chapters/traffic.js` to see what function it exports. Then create `tests/templates/chapters/traffic.test.js` using the same pattern:

```js
'use strict';
const { buildTrafficCardHTML } = require('../../../src/templates/chapters/traffic');

const trafficData = [
  {
    name: 'Kroger',
    location: { lat: 38.2, lng: -84.5 },
    traffic: {
      variations: [
        { label: 'Mon–Fri 8am', minutes: 8, percentAboveBase: 0 },
        { label: 'Mon–Fri 5pm', minutes: 12, percentAboveBase: 50 },
        { label: 'Sat 10am',    minutes: 9,  percentAboveBase: 12 },
      ],
    },
  },
];

describe('buildTrafficCardHTML — depth system (FR-045)', () => {
  test('renders section with data-depth="overview"', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/data-depth="overview"/);
  });

  test('renders depth-l1 glance bar', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/depth-l1/);
  });

  test('chapter-body has depth-l2 class', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/depth-l2/);
  });

  test('depth selector rendered', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/chapter-depth-control/);
  });
});
```

- [ ] **Step 6: Run to verify FAIL**

```bash
npx jest tests/templates/chapters/traffic.test.js --no-coverage
```

- [ ] **Step 7: Update traffic.js**

Read `src/templates/chapters/traffic.js` fully, then add:
- `const { renderDepthSelector } = require('../components/depthSelector');` at top
- `buildTrafficGlanceHTML(trafficData)` function
- `data-depth="overview"` on the `<section>` tag
- `<div class="depth-l1">` wrapper for glance
- `depth-l2` class on `chapter-body`
- `${renderDepthSelector('traffic')}` inside `.chapter-inner`

The glance bar for traffic should show the peak vs off-peak difference:
```js
function buildTrafficGlanceHTML(trafficData) {
  if (!trafficData || !trafficData.length) return '';
  const t = trafficData[0];
  const variations = t.traffic?.variations || [];
  const maxPct = Math.max(...variations.map((v) => v.percentAboveBase || 0));
  const glanceText = maxPct < 15
    ? 'No meaningful rush hour at this address'
    : `Peak adds ~${maxPct}% to commute times`;
  return `<div class="chapter-glance"><span class="chapter-glance-item">${escapeHtml(glanceText)}</span></div>`;
}
```

- [ ] **Step 8: Run tests**

```bash
npx jest tests/templates/chapters/traffic.test.js --no-coverage
```
Expected: PASS

- [ ] **Step 9: Run full suite**

```bash
npx jest --no-coverage
```
Expected: all pass

- [ ] **Step 10: Commit**
```bash
git add src/templates/chapters/health.js src/templates/chapters/traffic.js tests/templates/chapters/health.test.js tests/templates/chapters/traffic.test.js
git commit -m "feat(fr-045): add glance bars + depth system to health and traffic chapters"
```

---

## Task 9: Add "Expand All to Research" Button

**Files:**
- Modify: `src/templates/pages/reportPage.js`

- [ ] **Step 1: Read the chapter list section in reportPage.js**

Locate where `buildChaptersHTML(chapters)` output is used in the report template (around line 200+). The "Expand All" button should appear just before the chapters section.

- [ ] **Step 2: Add the button HTML**

In the `buildReportHTML` function, find where `chaptersHTML` (or `buildChaptersHTML(chapters)`) is inserted into the report. Add the button wrapper immediately before it:

```js
const expandAllHTML = `
  <div class="report-expand-all-wrap">
    <button id="expandAllResearch" class="report-expand-all-btn">Set all chapters to Research</button>
  </div>`;
```

Then in the template string, add `${expandAllHTML}` before `${buildChaptersHTML(chapters)}` (or wherever chapters HTML is injected).

- [ ] **Step 3: Run constraint tests**

```bash
npx jest tests/constraints/ --no-coverage
```
Expected: all pass

- [ ] **Step 4: Commit**
```bash
git add src/templates/pages/reportPage.js
git commit -m "feat(fr-045): add Expand All to Research button to report page"
```

---

## Task 10: Integration Test on All 5 Addresses

**Files:**
- No code changes — testing only

- [ ] **Step 1: Start the server**

```bash
node src/app.js
```
(or `npm start`)

- [ ] **Step 2: Test Georgetown KY — verify depth selector on all chapters**

Open `http://localhost:3000` and request report for:
`100 Wishing Well Path Unit 2306, Georgetown, KY 40324`

Check each chapter:
- Depth selector `[Overview ▾]` visible in top-right of every chapter card
- Glance bar visible (compact summary line) for every chapter
- Select "Glance" — chapter body disappears, only glance bar remains
- Select "Deep Read" on Climate — tabbed deep dive appears
- Select "Deep Read" on Garden — tabbed deep dive appears
- Select "Research" on Climate — data tables appear
- "Set all chapters to Research" button works

- [ ] **Step 3: Test Harlan KY (rural)**

`456 Rural Route 1, Harlan, KY 40831`

Verify: report generates, glance bars show appropriate values for rural context, no empty/null crashes

- [ ] **Step 4: Test Louisville KY (urban)**

`123 Main St, Louisville, KY 40202`

Verify: walkability glance bar shows "Very Walkable" (expected for urban address)

- [ ] **Step 5: Test Bozeman MT**

`789 Main St, Bozeman, MT 59715`

Verify: climate glance bar shows different tornado tier (MT = low), garden glance bar shows different zone (Zone 4–5)

- [ ] **Step 6: Test Jeffersonville IN (PM-001 regression)**

`1007 Stonelilly Dr, Jeffersonville, IN 47130`

Verify: schools glance bar says "IN" school (no cross-state result), report generates without error

- [ ] **Step 7: Commit final test notes if any fixes were made**

If any bugs were found during integration testing, fix them and commit. Document any issues discovered as postmortems if they qualify.

```bash
git add -p
git commit -m "fix(fr-045): [describe specific fix if needed]"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Per-chapter depth selector with 4 levels
- [x] Glance level shown for every chapter
- [x] All depth level data fetched at report generation (no lazy loading — existing data only used for glance)
- [x] Level changes instant (CSS show/hide, no loading states)
- [x] SessionStorage persists depth selections within session
- [x] "Expand All to Research" button functional
- [ ] Mobile segmented control G/O/D/R — **not in this plan** (CSS-only variant possible but deferred)
- [ ] Garden Research level complete spec items — **deferred to chapter-specific FR**
- [ ] Climate Research additional items — **partially complete via existing FR-043 data**

**Gaps vs spec:**
- Mobile segmented control (G/O/D/R) — the dropdown works on mobile but spec calls for a segmented control. This is a follow-on CSS/HTML change with no data dependency.
- L3/L4 content for 10 chapters (schools, health, reachability, traffic, safety, community, growth, property, sensory, walkability, costs) — these require additional data fetching and are separate FRs per chapter.

**Constraint compliance:**
- CONSTRAINT-001 (no scoring): glance bars use labels only, no numerical scores
- CONSTRAINT-002 (Fair Housing): community glance uses income level label only
- CONSTRAINT-008 (no inline styles): all new HTML uses class names only
- CONSTRAINT-009 (no design in data/logic): all new code is in template layer
- CONSTRAINT-011 (tests required): every new HTML generator has at least one test
- CONSTRAINT-013 (4-phase workflow): this plan is Phase 3; Phase 1 discovery and Phase 2 spec were completed before writing this plan
