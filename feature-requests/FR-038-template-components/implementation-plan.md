# FR-038 Implementation Plan — Template Components

**Branch:** `fr-038-template-components`
**Approach:** TDD — tests written first.

---

## Discovered HTML Patterns

### keyTakeaway — from premium.js line ~510
```html
<div class="key-takeaway">
  <span class="kt-icon">🔑</span>
  <div class="kt-body"><strong>Key Takeaway:</strong> text</div>
</div>
```

### badge — from premium.js `badgeColor()` + `prem-badge` usages
```html
<span class="prem-badge badge-green">Label</span>
<!-- inline variant -->
<span class="prem-inline-badge badge-gold">Label</span>
```
Color map: green → badge-green, lightgreen → badge-lightgreen, gold → badge-gold,
orange → badge-orange, red → badge-red, muted → badge-muted

### buckets — from app.js + report.css
```html
<div class="bucket bucket--check">
  <div class="bucket-label">Things to Check</div>
  <div class="bucket-text">text</div>
</div>
```
Variants: `bucket--check`, `bucket--consider`, `bucket--cool`

### checklist — from premium.js flood/health action pattern (line ~459)
```html
<div class="prem-safety-actions">
  <div class="prem-safety-actions-label">Heading</div>
  <div class="prem-safety-action">
    <span class="prem-safety-action-icon">🗺️</span>
    <div class="prem-safety-action-text">
      <div class="prem-safety-action-label">Label</div>
      <div class="prem-safety-action-detail">Detail</div>
    </div>
  </div>
</div>
```

### destCard — from app.js `buildDestSection` (line ~106)
```html
<div class="dest-section">
  <div class="dest-label">Label</div>
  <div class="dest-row">
    <div>
      <div class="dest-name">Name</div>
      <div class="dest-address">Address</div>
    </div>
    <div class="drive-time">X min</div>
  </div>
  <!-- optional note -->
  <p class="dest-note">Note text</p>
</div>
```

### footer — from premium.js `premiumCard` sourceHTML + prem-disclaimer
```html
<p class="prem-disclaimer">Source: Name. Research date: May 2026.</p>
```

---

## Ordered Stages

### Stage 1 — Create branch
```
git checkout -b fr-038-template-components
```

### Stage 2 — Write tests (tests/templates/components/*.test.js)
Write ALL tests before any implementation. Six test files:
- `keyTakeaway.test.js`
- `badge.test.js`
- `buckets.test.js`
- `checklist.test.js`
- `destCard.test.js`
- `footer.test.js`

Each test asserts:
- Returns a string
- Contains expected CSS class names (from patterns above)
- No `style=""` attributes (CONSTRAINT-008)
- Handles null/empty inputs gracefully (no throw, renders fallback)
- Uses `escapeHtml` for all user-facing strings (no XSS)

### Stage 3 — Create directory structure
```
src/templates/components/
  keyTakeaway.js
  badge.js
  buckets.js
  checklist.js
  destCard.js
  footer.js
  index.js
```

### Stage 4 — Implement components (one at a time, tests green after each)
Order: keyTakeaway → badge → buckets → checklist → destCard → footer → index.js

Each file:
- `'use strict'`
- Imports `escapeHtml` from `../../utils/text`
- `destCard.js` also imports `formatDriveTime` from `../../utils/text`
- Pure function, returns string
- No API calls, no business logic

### Stage 5 — Run full test suite
`npm test` — all 70 existing tests must still pass, new component tests must pass.

### Stage 6 — Verify no inline styles
Quick grep: `grep -r 'style="' src/templates/` — must return nothing.

### Stage 7 — Write summary.md and commit

---

## Files Created

| File | Purpose |
|------|---------|
| `src/templates/components/keyTakeaway.js` | Key takeaway callout |
| `src/templates/components/badge.js` | Excellent/Good/Fair/Consider badge |
| `src/templates/components/buckets.js` | Three-bucket finding framework |
| `src/templates/components/checklist.js` | Action item checklist |
| `src/templates/components/destCard.js` | Destination drive-time card |
| `src/templates/components/footer.js` | Chapter source/research footer |
| `src/templates/components/index.js` | Re-exports all components |
| `tests/templates/components/keyTakeaway.test.js` | |
| `tests/templates/components/badge.test.js` | |
| `tests/templates/components/buckets.test.js` | |
| `tests/templates/components/checklist.test.js` | |
| `tests/templates/components/destCard.test.js` | |
| `tests/templates/components/footer.test.js` | |

## Files NOT Modified
- `src/app.js` — callers not updated yet (that's FR-039)
- `src/premium.js` — callers not updated yet (that's FR-039)
- Any existing module files

## Definition of Done
- [ ] All 6 components exist in `src/templates/components/`
- [ ] `index.js` re-exports all 6
- [ ] Zero `style=""` in any component output
- [ ] All component tests pass
- [ ] All 70 existing tests still pass
- [ ] summary.md written, committed, pushed
