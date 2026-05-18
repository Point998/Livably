# FR-006 — Map Visualization: Summary

## What was built

Added an interactive Google Maps panel between the hero section and the Chapter 03 card on every report page.

## Changes

**`src/app.js`** — three modifications:

1. `buildLoadingHTML` — added `reExecScripts(el)` helper inside the loading page IIFE. After the DOMParser DOM swap, scripts injected via `innerHTML` don't execute (known browser behavior). `reExecScripts` walks every `<script>` element, creates a fresh `document.createElement('script')` copy with the same attributes and content, and replaces the dead element with the live one. Called on both `document.head` and `document.body` after the swap so the map scripts fire correctly.

2. `buildReportHTML` — accepts `origin` in the destructured params. Builds a `mapData` object from `origin` (home pin) and all non-null service results. Grocery is an array so it's iterated; all other services are single objects. `<` characters in the JSON are escaped to `<` so no address or name string can form `</script>` and break the HTML parser. The map data is embedded as `<script id="map-data" type="application/json">` and read by `initMap` via `textContent` (safe from XSS). `initMap` creates the map centered on home, adds a gold circle marker for home and default markers for each service with clickable InfoWindows showing name, label, address, and drive time. `fitBounds` auto-zooms; an `idle` listener caps zoom at 15 to prevent over-zooming on close destinations. If anything throws, the map `div` is hidden — the report text remains intact.

3. `/report` route — passes `origin` to `buildReportHTML`.

**`public/report.css`** — appended `.map-section` (padding) and `.report-map` (380px height, border-radius 10px, shadow matching chapter cards).

## Test status

API key returned 403 (REQUEST_DENIED) during automated testing due to an IP restriction in Google Cloud Console — the server's IPv6 address has changed since the previous session. The code is syntactically verified (`node --check` passes) and structurally correct. Live testing requires either removing the IP restriction or adding the current server IP to the allowlist in the Google Cloud Console.

## Deviations from plan

None — all tasks executed as specified.
