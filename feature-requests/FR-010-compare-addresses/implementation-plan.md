# FR-010 — Compare Addresses: Implementation Plan

## Approach

New `/compare` route with the same loading-page pattern as `/report`. No numeric scores (FR-008 philosophy). Six core services compared (grocery–gas station); additional services excluded to keep API calls manageable (max 3 addresses × 6 services = 18 calls).

## New functions

- `generateComparisonData(address)` — geocodes address, runs `Promise.allSettled` on 6 core service lookups, returns `{ address, origin, services }`
- `buildCompareFormHTML()` — blank comparison form (2 required + 1 optional address inputs)
- `buildCompareLoadingHTML(addressesParam)` — loading page that fetches `?fetch=1`, same DOM-swap pattern as report
- `buildCompareResultsHTML(reports)` — address header cards + drive-time comparison table; best time per row highlighted gold with ✓

## Route

`GET /compare`:
- No `?addresses` param → form
- With `?addresses` but no `?fetch=1` → loading page
- With both → runs `Promise.allSettled` per address; failed geocodes become `{ address, error }` objects and show "Address not found" in the results rather than crashing the whole comparison

## CSS

`body.compare-page` overrides the global 480px max-width to 960px. Address header cards use a 2- or 3-column grid (`.compare-cols-2` / `.compare-cols-3`). Best-time cells use gold background tint matching the design system. Table scrolls horizontally on narrow viewports.
