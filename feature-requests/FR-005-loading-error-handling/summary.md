# FR-005 — Loading States & Error Handling UI: Summary

## What was built

Added a loading page that appears immediately on form submit, followed by structured error pages with actionable messaging.

## Changes

**`src/app.js`** — four modifications:

1. `classifyError(error)` — maps thrown errors to `ADDRESS_NOT_FOUND`, `RATE_LIMIT`, or `SERVER_ERROR` with user-friendly titles and messages.

2. `buildErrorHTML(type, title, message, address)` — replaces `buildSimpleHTML`. Renders a centered error page with ⚠️ icon, `<meta name="livably-error">` for client detection, a "Try again" link (pre-fills form with address), and a "Try a different address" home link.

3. `buildLoadingHTML(address)` — returns an immediate loading page with spinner and cycling messages. Inline JS reads the address from `data-address` (no XSS), fetches `?fetch=1`, and either swaps the DOM via DOMParser or handles rate-limit countdown and network errors inline.

4. `/report` route updated:
   - Non-fetch requests return `buildLoadingHTML` immediately.
   - Fetch requests (`?fetch=1`) run the data pipeline.
   - `Promise.all` → `Promise.allSettled` so a single failed service shows "Not available." rather than failing the whole report.
   - Error catch uses `classifyError` + `buildErrorHTML` instead of raw error messages.

**`public/report.css`** — appended loading and error styles:
- `.loading-page` / `.loading-container` / `.loading-logo` / `.loading-spinner` / `.loading-message` — spinner with CSS `@keyframes spin`, opacity-transition message paragraph.
- `.error-page` / `.error-container` / `.error-icon` / `.error-title` / `.error-message` — centered error layout.
- `.btn-primary` / `.btn-retry` — gold action buttons, shared style.

**`public/index.html`** — added one inline script that reads `?address=` from the URL and pre-fills the address input. Used by "Try again" links on error pages.

## Test results

- Valid address (`101 Cherry Hill Rd, Georgetown KY`) → loading page immediate ✓, report loads with all 6 services ✓
- Invalid address (`zzzznotanaddress`) → ADDRESS_NOT_FOUND error with "Try again" link pre-filled ✓
- No address (`/report`) → SERVER_ERROR error page, no "Try again" ✓
- `?fetch=1` direct access returns report HTML correctly ✓

## Deviations from plan

None.
