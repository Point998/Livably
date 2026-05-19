# FR-010 — Compare Addresses: Summary

## What was built

A `/compare` page that accepts 2–3 addresses, runs them in parallel, and renders a side-by-side drive-time comparison table. Same loading-page UX as `/report`.

## Changes

**`src/app.js`**:

1. `generateComparisonData(address)` — geocodes one address and runs `Promise.allSettled` on the 6 core services (grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation). Returns `{ address, origin, services }`. Throws on geocode failure so the route can catch it per-address.

2. `buildCompareFormHTML()` — comparison form with two required and one optional address inputs. JS intercepts submit and redirects to `/compare?addresses=ADDR1|ADDR2|ADDR3`.

3. `buildCompareLoadingHTML(addressesParam)` — loading page storing the pipe-separated addresses in `data-addresses`; fetches `?fetch=1` and does the same `DOMParser` swap as the report loading page.

4. `buildCompareResultsHTML(reports)` — renders address header cards (gold top border, street + city/state; muted with "Address not found" for failed geocodes) and a comparison table. For each service row, finds the minimum non-null drive time across all addresses and marks those cells with a gold tint + ✓. Null services (lookup failed) show "—".

5. `GET /compare` route — form with no params; loading page with `?addresses` but no `?fetch=1`; results with both. Uses `Promise.allSettled` per address so a single bad address doesn't kill the whole comparison.

**`public/report.css`** — added compare-page styles: `body.compare-page { max-width: 960px }`, form inputs matching the existing address form, address header card grid, comparison table with gold best-time highlighting, horizontal scroll on narrow viewports, single-column stack below 600px.

## Deviations from spec

- No numeric livability scores displayed (FR-008 replaced scoring with narrative; scores don't exist).
- Additional services (park, coffee, school) excluded from comparison to avoid 30 API calls per comparison.
- Loading page added (spec didn't require it, but comparison can take 15–30s).
