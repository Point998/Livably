# FR-012 — Custom Destinations: Implementation Plan

## Approach

Client-side form UI on the homepage; server processes destinations alongside the normal report flow. No new routes or storage — custom destinations are passed as GET query params and resolved on-demand per request.

## Files changed

- `public/index.html` — custom destinations form section + JS (toggle, row add/remove, template save/load)
- `src/app.js` — `CUSTOM_DEST_ICONS`, `buildCustomDestinationsCardHTML`, route param parsing, geocode + drive time lookups, map pin injection, `buildReportHTML` signature update, `buildLoadingHTML` fetch URL fix
- `public/report.css` — homepage form styles + report card styles for custom destinations

## Key decisions

- **GET params, not POST** — form uses `method="get"` so custom dest params ride in the URL; the loading page preserves them via `location.search` (not a hardcoded `?address=...`)
- **`buildLoadingHTML` fix** — changed fetch URL from `'/report?address=...' + '&fetch=1'` to `'/report' + location.search + '&fetch=1'` so all query params (including custom dests) are forwarded to the data fetch
- **Array params** — `customDestName[]`, `customDestAddress[]`, `customDestType[]` arrive as arrays; server normalizes with `[].concat(req.query.X || [])`
- **Cap at 10** — `Math.min(rawAddresses.length, 10)` to bound server work
- **`Promise.allSettled`** — geocode + drive-time failures for one destination don't block others or crash the report
- **localStorage templates** — saved/loaded entirely client-side; no server involvement
