# FR-012 — Custom Destinations: Summary

## What was built

A custom destinations feature that lets users add up to 10 personal locations (office, family, medical, etc.) on the homepage form. Each destination is geocoded and drive-timed during report generation, then displayed in a dedicated card on the report page. Destinations are passed as URL query parameters, so the report URL is shareable. A localStorage template system lets users save and reuse sets of destinations.

## Changes

**`public/index.html`** — added inside the address form:
- Toggle button (`+ Add custom destinations`) to expand/collapse the section
- Hidden `#customDestsSection` with `#customDestRows` container
- Per-row inputs: label (name), address, type dropdown (Work/Family/Medical/Recreation/Other), remove button (×)
- Templates bar: "Load template" select + "Save template" button (both localStorage-backed)
- JS: `toggleCustomDests()`, `addDestRow()`, `removeDestRow()`, `refreshTemplatesBar()`, `saveTemplate()`, `loadTemplate()`

**`src/app.js`** — multiple additions:
1. `CUSTOM_DEST_ICONS` — emoji map keyed by dest type
2. `buildCustomDestinationsCardHTML(customDestinations)` — renders a `custom-dests-card` with one row per destination (icon, name, address, drive time)
3. `/report` route — parses `customDestName[]`, `customDestAddress[]`, `customDestType[]` from query; geocodes + drive-times all in parallel via `Promise.allSettled`; injects custom dest pins into the map alongside standard services
4. `buildReportHTML` — updated signature to accept `customDestinations`; injects `customDestinationsCardHTML` after `additionalServicesCardHTML`
5. `buildLoadingHTML` — fixed fetch URL from hardcoded `?address=...&fetch=1` to `location.search + '&fetch=1'` so custom dest params survive the loading-page redirect

**`public/report.css`** — added:
- Homepage form: `.custom-dests-toggle`, `.custom-dests-section`, `.custom-dests-label`, `.custom-dest-row`, `.custom-dest-input`, `.custom-dest-select`, `.custom-dest-remove`, `.custom-dests-controls`, `.custom-add-btn`, `.custom-templates-wrap`, `.custom-template-select`, `.custom-save-tpl-btn`
- Report card: `.custom-dests-card`, `.custom-dests-card-header`, `.custom-dests-card-eyebrow`, `.custom-dests-card-title`, `.custom-dest-item`, `.custom-dest-icon`, `.custom-dest-info`, `.custom-dest-name`, `.custom-dest-addr`, `.custom-dest-time`, `.custom-dest-time-na`

## Deviations from spec

- Templates are localStorage-only (no server-side persistence); this matches the spec's implied scope.
- Max 10 destinations enforced on both client (UI hides add button) and server (hard cap in route handler).
