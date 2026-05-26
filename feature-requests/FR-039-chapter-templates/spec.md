# FR-039 Spec — Chapter Templates
*Phase 4b of the Module Restructure*
*Status: Spec*

---

## What This Is

Extract all HTML generation from `src/premium.js` into `src/templates/chapters/` — one file per chapter. Each file imports from `src/templates/components/` (FR-038) and `src/utils/`. `premium.js` becomes an orchestrator of ~50 lines that calls these template files.

This is the critical prerequisite for the design rebuild: once templates are separated, Claude Design outputs can slot directly into chapter files without touching data or logic.

---

## Chapter Template Files

```
src/templates/chapters/
  health.js
  reachability.js
  schools.js
  climate.js
  garden.js
  community.js
  growth.js
  sensory.js
  walkability.js
  costs.js
  access.js
  recreation.js
  dailylife.js
  index.js         ← re-exports all chapter template functions
```

---

## The Pattern

Each chapter template file exports one function:

```js
// Example: src/templates/chapters/health.js
function renderHealthChapter(data) {
  // data is the validated, processed output from the health module's logic.js
  // Returns complete chapter HTML string
}
module.exports = { renderHealthChapter };
```

Each function:
- Imports components from `src/templates/components/`
- Imports `escapeHtml`, `formatDriveTime`, etc. from `src/utils/text.js`
- Contains zero API calls (CONSTRAINT-009)
- Contains zero business rules (CONSTRAINT-009)
- Contains zero `style=""` attributes (CONSTRAINT-008)
- Returns a complete HTML string for the chapter

---

## Migration Strategy

1. Read the existing `build*HTML` function in premium.js for the chapter
2. Extract it to `src/templates/chapters/<chapter>.js` unchanged
3. Replace the inline function in premium.js with a call to the extracted version
4. Verify: `npm test` still passes, report renders identically
5. Move to next chapter

One chapter at a time. Each extraction is a separate commit. No behavior changes.

---

## What premium.js Looks Like After FR-039

```js
// premium.js — ~50 lines after extraction
const { renderHealthChapter } = require('./templates/chapters/health');
// ... 12 more imports ...

async function getPremiumData(address, options) {
  const data = await orchestrateDataFetch(address, options);
  return {
    health:       renderHealthChapter(data.health),
    reachability: renderReachabilityChapter(data.reachability),
    // ...
  };
}
```

---

## Acceptance Criteria

- [ ] All `build*HTML` functions removed from premium.js
- [ ] Each chapter has a corresponding file in `src/templates/chapters/`
- [ ] premium.js is ≤ 100 lines after extraction
- [ ] Zero `style=""` attributes in any template output (CONSTRAINT-008)
- [ ] Zero API calls in any template file (CONSTRAINT-009)
- [ ] Zero business rules in any template file (CONSTRAINT-009)
- [ ] All existing reports render identically before and after extraction
- [ ] Tests in `tests/templates/chapters/` for each chapter template
- [ ] Server HTTP 200 on all 5 test addresses after extraction

---

## Why This Matters

After FR-039:
- Claude Design can produce complete chapter HTML files that slot in directly
- Design changes never touch data or logic
- Each chapter can be restyled independently
- The three-layer rule (data / logic / template) is fully enforced across the entire codebase
