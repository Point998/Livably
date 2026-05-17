# FR-005 Implementation Plan

## Overview

Three files change: `src/app.js`, `public/report.css`, `public/index.html`. No new dependencies.

## Tasks

### 1. Add loading + error CSS to `public/report.css`

Append:
- `.loading-page` — flex centering (mirrors `.form-page`)
- `.loading-container` — wrapper with padding
- `.loading-logo` — Fraunces logo above spinner
- `.loading-spinner` — rotating CSS ring animation using `--gold` accent color
- `.loading-message` — muted text with `transition: opacity` for fade swap
- `.error-page` / `.error-container` — centered error layout
- `.error-icon` — large ⚠️ display
- `.error-title` — Fraunces heading
- `.error-message` — muted body text
- `.btn-primary` — full-width gold button (shared with form submit styling)
- `.btn-retry` — same as btn-primary, used on retry actions

### 2. Add `buildLoadingHTML(address)` to `app.js`

Returns an immediate HTML page with:
- Livably logo + CSS spinner + cycling message paragraph
- Inline `<script>` that:
  1. Cycles 4 messages every 2.5s with opacity fade: "Finding your address..." → "Locating nearby services..." → "Calculating drive times..." → "Generating your report..."
  2. After 15s: "This is taking longer than usual..."
  3. `fetch('/report?address=ENCODED&fetch=1')` → on success, replaces DOM via DOMParser
  4. On network failure: replaces message with connection error + retry link
  5. Detects rate-limit response via `<meta name="livably-error">` tag in response, shows countdown + auto-retry after 30s

Address value stored in `data-address` attribute (not interpolated into JS string — avoids XSS).

### 3. Add `buildErrorHTML(title, message, address)` to `app.js`

Replaces `buildSimpleHTML`. Returns a styled error page with:
- `<meta name="livably-error" content="TYPE">` for client-side detection
- ⚠️ icon, title, message
- "Try again" link → `/?address=ENCODED` (pre-fills form)
- "Try a different address" link → `/`

### 4. Add `classifyError(error)` helper

Maps thrown errors to types:
- `'Unable to geocode'` in message → `ADDRESS_NOT_FOUND`
- `error.response?.status === 429` or 'quota'/'rate limit' in message → `RATE_LIMIT`
- Everything else → `SERVER_ERROR`

User-friendly titles/messages per type:
| Type | Title | Message |
|------|-------|---------|
| ADDRESS_NOT_FOUND | We couldn't find that address | Check the spelling and try again. |
| RATE_LIMIT | High demand right now | Please try again in a moment. |
| SERVER_ERROR | Something went wrong | An error occurred generating your report. |

### 5. Modify `/report` route in `app.js`

```javascript
app.get('/report', async (req, res) => {
  const address = req.query.address;
  const isFetch = req.query.fetch === '1';

  if (!address) { ... }
  if (!googleMapsApiKey) { ... }

  // Return loading page immediately; JS fetches ?fetch=1 in background
  if (!isFetch) {
    return res.send(buildLoadingHTML(address));
  }

  // Actual data work — reached only via ?fetch=1
  try {
    const origin = await geocodeAddress(address);
    const originLatLng = `${origin.lat},${origin.lng}`;

    const results = await Promise.allSettled([...]);
    const [grocery, pharmacy, hospital, urgentCare, highwayRamp, school] =
      results.map(r => r.status === 'fulfilled' ? r.value : null);

    return res.send(buildReportHTML(address, { ... }));
  } catch (error) {
    const { type, title, message } = classifyError(error);
    return res.send(buildErrorHTML(type, title, message, address));
  }
});
```

### 6. Address prefill in `public/index.html`

Add small inline script that reads `?address=` from URL on page load and pre-fills the input:
```javascript
const p = new URLSearchParams(location.search).get('address');
if (p) document.querySelector('input[name="address"]').value = p;
```

### 7. Test

- Valid address → loading page appears → report loads ✓
- Invalid address → loading → address-not-found error with "Try again" pre-filled ✓
- `?fetch=1` direct access still works (reports render correctly) ✓
- Network error (kill server mid-load) → connection error message in loading page ✓
- Rate limit simulation (hard to trigger; verify error HTML structure) ✓
- No-address / no-API-key paths still work ✓

### 8. Write summary.md, commit, push

## Risks

**`document.write` vs DOMParser**: Using DOMParser + innerHTML replacement to swap in the new page. This won't execute `<script>` tags in the incoming HTML — acceptable since report and error pages have no scripts.

**Rate limit countdown auto-retry**: Loading page JS checks for `<meta name="livably-error" content="RATE_LIMIT">` in the fetched HTML. If detected, shows a 30s countdown and retries automatically.

**`buildSimpleHTML` removal**: `buildSimpleHTML` is currently used for 4 cases (no address, no API key, error). Replacing all calls. The no-address / no-API-key paths use `buildErrorHTML` directly (no `address` to pre-fill for those).
