# FR-004 Implementation Plan

## Overview

Two file changes. No `app.js` changes. No new dependencies.

## Tasks

### 1. Add form-specific styles to `public/report.css`

Append a section at the bottom for the form page layout. Using existing CSS variables throughout. Styles needed:
- `.form-page` — vertically centered layout via flexbox on `body`
- `.form-container` — max-width already handled by `body` in `report.css`; just padding
- `.form-logo` — large Fraunces logo (reuses `.logo-gold` class for the gold span)
- `.form-tagline` — muted small text
- `.address-form input` — full-width, gold focus ring, matches design system
- `.address-form button` — full-width, gold background, DM Sans

### 2. Rewrite `public/index.html`

Replace current plain form with:
- Link to `/report.css` (fonts + tokens + form styles)
- `<body class="form-page">`
- Logo div reusing `.logo-gold` class
- Tagline paragraph
- Form: `action="/report"` `method="get"`, single input `name="address"`, submit button
- No label, no extra copy — clean

### 3. Test

- `npm start` already running — load `http://localhost:3000/` in browser or curl
- Submit Georgetown address, confirm report opens
- Check HTML head: one `<link>`, no `<style>` block

### 4. Write summary.md, commit, push

## Risks

None. Static file changes with no server logic involved.
