# AUDIT: Inline Style Removal & Design Token Extraction

**Date:** May 2026
**Status:** Complete

## Objective

Remove all inline design decisions from `src/app.js` and `src/premium.js` so that both files contain zero style information. All visual appearance is now controlled exclusively by `public/report.css` and `public/design-tokens.css`.

---

## What Was Created

### `public/design-tokens.css` (new file)
Single source of truth for all design values, extracted from `LIVABLY-DESIGN-BRIEF.md`:
- Core colors: `--ink`, `--ink-60`, `--ink-30`, `--ink-10`, `--ink-04`, `--white`, `--page`
- Dark surfaces: `--dark`, `--dark-mid`, `--dark-text`, `--dark-muted`, `--dark-border`
- 14 chapter color identities (3 vars each: `--ch-{name}`, `--ch-{name}-light`, `--ch-{name}-text`)
- Three-bucket system: `--bucket-check/consider/cool` and `-light` variants
- Font stacks: `--font-display`, `--font-body`
- Layout: `--inner-max`, `--inner-pad`
- Spacing scale: `--space-4` through `--space-96`
- Border radius: `--radius-sm` through `--radius-pill`
- Badge semantic colors (6 types × 2 vars)
- Response badge colors (4 types × 2 vars)
- Flood zone banner vars (3 levels × 2 vars)
- Growth project status vars (4 states)
- Walkability score vars (5 levels × 2 vars)

### `public/report.css` (modified)
- Replaced entire `:root { }` block with `@import url('./design-tokens.css')`
- Added new utility classes at end of file:
  - `.badge-{green|lightgreen|gold|orange|red|muted}` — standard badge colors
  - `.badge-response-{green|gold|orange|red}` — health/safety response badges
  - `.flood-banner--{low|moderate|high}` — flood zone banner themes; children inherit color via `color: inherit`
  - `.walk-score--{level}` — walkability number color only
  - `.walk-verdict--{level}` — walkability verdict chip color + background
  - `.project-status--{construction|approved|planned|default}` — growth project tags
  - `.services-grid` / `.services-grid-item` — additional services card grid
  - `.chapter-inner--addon` — chapter inner with top+bottom padding
  - `.chapter-inner--continuation` — chapter inner with bottom padding only
  - `.logo-link` — removes text-decoration from logo anchor

---

## Changes in `src/premium.js`

### `badgeColor()` function
**Before:** Returned inline CSS style strings (`background:rgba(...);color:#...`)  
**After:** Returns CSS class names (`badge-green`, `badge-gold`, etc.)

All 9 call sites changed from `style="${badgeColor(...)}"` to appending the class: `class="... ${badgeColor(...)}"`.

### Flood zone banner
**Before:**
```js
const bannerBg = (!flood || flood.zone === 'X') ? '#eaeff5' : (flood.risk === 'High' ...) ? '#fdf0ed' : '#fdf4e3';
const bannerColor = ...;
// style="background:${bannerBg};color:${bannerColor}"
```
**After:**
```js
const bannerClass = (!flood || flood.zone === 'X') ? 'flood-banner--low'
  : (flood.risk === 'High' || flood.risk === 'Very High') ? 'flood-banner--high'
  : 'flood-banner--moderate';
// class="prem-flood-zone-inner ${bannerClass}"
```
Child elements (`prem-flood-zone-name`, `prem-flood-zone-desc`) now use `color: inherit` in CSS.

### Walkability
**Before:** `verdictColor`/`verdictBg` lookup objects returning hex values, applied as inline styles.  
**After:**
```js
const verdictMod = ['green','lightgreen','gold','orange','red'].includes(category.color) ? category.color : 'gold';
// walk-score-num uses walk-score--${verdictMod}
// prem-walk-verdict uses walk-verdict--${verdictMod}
```

### Growth project status
**Before:** `STATUS_COLORS` object returning hex values for inline style.  
**After:** `STATUS_CLASSES` object returning CSS class names (`project-status--construction`, etc.)

### `premiumCard()` continuation div
**Before:** `style="max-width:var(--inner-max);margin:0 auto;padding:0 var(--inner-pad) 80px"`  
**After:** `class="chapter-inner chapter-inner--continuation"`

---

## Changes in `src/app.js`

### `stationRow()` in `buildHealthSafetyChapterHTML`
**Before:** `badgeStyle` ternary returning `background:#e8f5ee;color:#2a6640` style strings.  
**After:** `badgeClass` ternary returning `badge-response-green/gold/orange/red` class names.

### `buildAdditionalServicesCardHTML`
**Before:** Three nested inline styles on chapter-inner, grid div, and grid item divs.  
**After:** `chapter-inner--addon`, `services-grid`, `services-grid-item` CSS classes.

### Logo anchor elements (compare page, home page)
**Before:** `style="text-decoration:none"` on `<a>` wrapping logo.  
**After:** `class="logo-link"` (2 occurrences, replaced with `replace_all`).

---

## What Was Intentionally Kept

These inline styles are **data-driven** and cannot be moved to CSS:

| Pattern | Example | Reason |
|---|---|---|
| `style="--path-len:96"` | SVG `<path>` elements | Per-path stroke-dashoffset for draw animation — geometry value, not design |
| `style="width:100%"` | Traffic bars, age bars | Width is computed from API data |
| `style="margin-left:29%"` | Frost date indicator | Position computed from calendar date |
| `style="left:62.5%"` | Bortle map marker | Position computed from scale value |

---

## Verification

Tested on: `100 Wishing Well Path Unit 2306 Georgetown, KY 40324`

- Zero hardcoded hex/rgb/rgba color values in rendered HTML ✅
- Zero font-size/padding/margin inline style values in rendered HTML ✅
- New CSS utility classes present in rendered output ✅
- `@import url('./design-tokens.css')` in report.css ✅
- Remaining inline styles are data-driven only (confirmed legitimate) ✅
