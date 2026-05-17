# FR-003 Implementation Plan

## Overview

Pure mechanical refactor. No logic changes. Three steps.

## Tasks

### 1. Create `public/report.css`
Copy the CSS content from `REPORT_STYLES` (app.js lines 467–649) verbatim into a new file. Also prepend the Google Fonts `@import` so the font loading lives in the stylesheet rather than as separate `<link>` tags.

### 2. Update `buildReportHTML` and `buildSimpleHTML`
Replace:
```
<title>...</title>${FONT_LINKS}
  <style>${REPORT_STYLES}</style>
```
With:
```
<title>...</title>
  <link rel="stylesheet" href="/report.css">
```
The font preconnects and Google Fonts link move into `report.css` as `@import` (or keep as `<link>` tags in HTML — either works; keeping in CSS is cleaner).

### 3. Remove `REPORT_STYLES` and `FONT_LINKS` constants from `app.js`

### 4. Test
- Syntax check
- Start server, curl Georgetown, Harlan, Louisville
- Confirm `/report.css` is served (HTTP 200)
- Confirm rendered HTML contains `<link rel="stylesheet" href="/report.css">` and no `<style>` block

### 5. Write summary.md, commit, push

## Risks
None — Express already serves `public/` as static. The only failure mode is a typo in the CSS file, which the visual test would catch.
