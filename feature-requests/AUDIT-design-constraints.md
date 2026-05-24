# AUDIT: Legacy Design Constraints in src/app.js and src/premium.js

Catalogues every inline style, hardcoded color, and CSS class name that references
the old design system — patterns that predated the ground-up redesign and
LIVABLY-DESIGN-BRIEF.md becoming the sole design reference.

This is a documentation-only audit. Nothing here is broken or blocking — these
patterns are noted so future redesign passes know where to look.

---

## src/app.js

### 1. Dead function — `buildHeroQuickStatsHTML` (lines 1440–1466)
Produces `.hero-stat`, `.hero-stat-icon`, `.hero-stat-label`, `.hero-stat-value` markup.
This function is **never called** — `quickStatsHTML` was removed from the report template
during the redesign but the function itself was not deleted.
**Action:** Delete `buildHeroQuickStatsHTML` on next pass.

### 2. `buildKeyInsightsHTML` renders old chapter-card wrapper (lines 1031–1120)
```html
<div class="chapter-card key-insights-card" style="--chapter-color: var(--gold)">
```
This function is still live and renders a standalone "At a Glance" chapter card.
The new design moves these insights into the hero via `buildHeroInsightRowsHTML`.
Both functions currently coexist; `buildKeyInsightsHTML` output is no longer injected
into the report template (`${keyInsightsHTML}` was removed), but the function still
exists as dead code.
**Action:** Delete `buildKeyInsightsHTML` on next pass.

### 3. `.ch01-response-badge` inline badge style (line 1217–1228)
```javascript
const badgeStyle = category.color === 'green'  ? 'background:#e8f5ee;color:#2a6640'
                 : category.color === 'gold'   ? 'background:#fdf3dc;color:#7a5c10'
                 : category.color === 'orange' ? 'background:#fff0e0;color:#8a4f10'
                 :                               'background:#fee;color:#8a1010';
```
Hardcoded hex colors applied as inline style on `.ch01-response-badge`. These values
are not drawn from the design token system in LIVABLY-DESIGN-BRIEF.md.
**Action:** Convert to CSS classes with token-based colors on next pass.

### 4. `buildInsightsCardHTML` chapter color (line 1267)
```html
<div class="chapter-card" style="--chapter-color: var(--rust)">
```
Uses `--rust` token — this is correct and defined in the new design system. Not a legacy issue.

### 5. `buildAdditionalServicesCardHTML` chapter color (line 1376)
```html
<div class="chapter-card" style="--chapter-color: var(--forest)">
```
Uses `--forest` token. Correct per new system.

### 6. `buildTrafficCardHTML` chapter color (line 1428)
```html
<div class="chapter-card" style="--chapter-color: var(--amber)">
```
Uses `--amber` token. Correct per new system.

### 7. Report content chapter card (line 1578)
```html
<div class="chapter-card" style="--chapter-color: var(--teal)">
```
Uses `--teal` token. Correct per new system.

### 8. `.traffic-bar` inline width (line 1408)
```html
<div class="traffic-bar ${barClass}" style="width:${widthPct}%">
```
Inline width is intentional — `ui.js` reads `bar.style.width` as the animation target,
stores it in `data-final-width`, then animates from 0. This is a deliberate pattern,
not a legacy artifact.

### 9. Admin/diagnostic dashboard inline styles (lines 1958–2090)
The `/admin` and `/health` routes produce internal diagnostic HTML with extensive
inline styles (table padding, colors `#555`, `#888`, `#c0392b`, `#fff3cd`, etc.).
These are intentionally self-contained admin views and are outside the report design system.
**No action needed.**

---

## src/premium.js

### 10. `badgeColor()` function — hardcoded hex palette (lines 1728–1738)
```javascript
function badgeColor(color) {
  const map = {
    green:      'background:rgba(40,167,69,0.12);color:#1e7e34',
    lightgreen: 'background:rgba(92,184,92,0.12);color:#3a9a3a',
    gold:       'background:rgba(184,149,106,0.14);color:#8a6a40',
    orange:     'background:rgba(253,126,20,0.12);color:#c0530a',
    red:        'background:rgba(220,53,69,0.12);color:#a71d2a',
    muted:      'background:rgba(107,107,107,0.1);color:#555',
  };
  return map[color] || map.muted;
}
```
Returns raw inline style strings with hardcoded hex values. Used on `.prem-badge` and
`.prem-inline-badge` elements throughout premium chapters. These colors are not drawn
from the LIVABLY-DESIGN-BRIEF.md token system.
Call sites: lines 540, 591, 1898, 1911, 2190, 2432, 2433, 2745, 2771.
**Action:** Replace with CSS class variants (`.prem-badge--green`, etc.) using token
colors on next premium redesign pass.

### 11. `.prem-walk-verdict` inline color/background (line 2312)
```javascript
<div class="prem-walk-verdict" style="color:${verdictColor};background:${verdictBg}">
```
Where `verdictColor`/`verdictBg` are computed from a local color map, not design tokens.
**Action:** Convert to CSS class variants on next pass.

### 12. `.prem-growth-named-project-status` inline border-color (line 2578)
```javascript
<div class="prem-growth-named-project-status" style="color:${color};border-color:${color}">
```
Where `color` is drawn from a local status-color map (`#2a7d6e`, `#b8922a`, etc.).
The teal and gold values happen to match design tokens but are not referenced by
variable name.
**Action:** Use CSS custom property or token-aligned class on next pass.

### 13. `.prem-age-fill` inline width (line 2427)
```javascript
<div class="prem-age-fill" style="width:${pct}%">
```
Same intentional pattern as `.traffic-bar` — `ui.js` reads this and animates from 0.
**No action needed.**

---

## Summary Table

| # | File | Location | Issue | Action |
|---|------|----------|-------|--------|
| 1 | app.js | L1440–1466 | Dead function `buildHeroQuickStatsHTML` | Delete |
| 2 | app.js | L1031–1120 | Dead function `buildKeyInsightsHTML` | Delete |
| 3 | app.js | L1217–1228 | `.ch01-response-badge` hardcoded hex badge styles | Convert to CSS classes |
| 10 | premium.js | L1728–1738 | `badgeColor()` returns hardcoded hex strings | CSS class variants |
| 11 | premium.js | L2312 | `.prem-walk-verdict` inline color/bg | CSS class variants |
| 12 | premium.js | L2578 | `.prem-growth-named-project-status` inline color | Token-aligned class |

Items 4–9 and 13 are intentional patterns — not legacy issues.
