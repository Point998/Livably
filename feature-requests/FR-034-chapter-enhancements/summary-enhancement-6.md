# FR-034 Enhancement 6 — Named Watershed Context — Implementation Summary

**Status:** Complete
**Date:** June 2026
**Branch:** `fr-034-enh-6-watershed`

## What Was Built

The final FR-034 enhancement. Surfaces the **named watershed** an address sits in as deep-read context in the Climate chapter, augmenting (not replacing) the existing topographic-position feature. The always-on L1/L2 glance is unchanged — the watershed material appears only when the reader goes deeper.

- **L3 (Deep Read):** a brief "Your Watershed" callout folded into the Flood History tab — e.g. *"This home sits in the Dry Run–North Elkhorn Creek watershed."*
- **L4 (Research):** a "Watershed Context" block — what a watershed is, the larger river basin it rolls up to, and a drainage tie-back whose wording adapts to the parcel's topographic position (lowpoint / uphill / neutral).

Framed as neutral orientation ("Cool Things to Know"), never as a risk (CONSTRAINT-001).

## Scope (v1)

- **In:** named HUC-12 sub-watershed + HUC-8 basin, both from USGS WBD.
- **Deferred:** the draining stream's proper name. NLDI returns the flowline geometry + `comid` but no `gnis_name`; resolving the name needs an unverified cross-API lookup, so per PM-002/PM-004 discipline it was cut from v1 rather than shipped on an unverified assumption.

## Files Changed

| File | Change |
|------|--------|
| `src/shared/spatial.js` | Extracted `snapToCellAtResolution(latLng, resolution)`; `snapToCell` now delegates to it (behavior-preserving) |
| `src/utils/constants.js` | Added `WATERSHED_CELL_RESOLUTION` (= 7) |
| `src/cache.js` | Added `watershed` cache namespace (90-day TTL — WBD is effectively static) |
| `src/modules/climate/data.js` | Added `queryWBDName` + `getNamedWatershed` (cell-cached, negatives cached); wired into `getClimateHistoryData`; folded `named` into the `watershed` object |
| `src/modules/climate/template.js` | L3 "Your Watershed" group in `buildFloodTab`; `buildWatershedContextHTML`; restructured `buildClimateResearchHTML` to render independent of storm events |
| `tests/shared/spatial.test.js` | +3 tests for `snapToCellAtResolution` |
| `tests/modules/climate/data.test.js` | +5 tests (`getNamedWatershed` + wiring) |
| `tests/modules/climate/template.test.js` | +8 tests (L3 group, L4 block, tie-back variants, no-inline-styles); split one pre-existing research-guard test to match the new combined-guard contract |

## Architecture Notes

- **Self-contained cell caching.** The FR-058 `cell` is not threaded into the climate module, so `getNamedWatershed` snaps to an H3 cell *internally* via `snapToCellAtResolution` at a fixed watershed resolution and keys `watershedCache` by `cellId`. Neighbors share one WBD fetch; no orchestrator signature change. H3 stays the single tiling primitive (CONSTRAINT-014).
- **WBD queried at the cell centroid** so every address in a cell resolves to one consistent watershed.
- **Negative caching:** "no watershed found" is stored as `{ huc12Name: null }` to distinguish a confirmed miss from a cache miss; transient fetch errors are *not* cached.
- **`getWatershedContext` (topographic) untouched** — it still samples the real address point (centroid would lose the per-parcel drainage signal). Named watershed (cell, centroid) and topographic position (per-address) coexist in the `watershed` object.
- **Behavioral change (intended by plan):** `buildClimateResearchHTML` previously returned empty when there were no storm events, which also suppressed the 30-year normals table. The new combined guard (`!eventRows && !normalRows && !watershedHTML`) lets normals — and the watershed block — render at L4 independently. This is an improvement consistent with L4's research-data purpose.

## Live Verification — all 5 test addresses

`getNamedWatershed` against the live USGS WBD API:

| Address | HUC-12 watershed | HUC-8 basin |
|---------|------------------|-------------|
| Georgetown KY | Dry Run-North Elkhorn Creek | North Fork Elkhorn Creek |
| Harlan KY | Lower Martins Fork Cumberland River | Upper Cumberland |
| Louisville KY | Fall Run-Ohio River | Silver-Little Kentucky |
| Bozeman MT | Middle Cottonwood Creek-East Gallatin River | Gallatin |
| Jeffersonville IN (PM-001 regression) | Fall Run-Ohio River | Silver-Little Kentucky |

All five return real, sensible watersheds. Jeffersonville IN shares Louisville's HUC-12 ("Fall Run-Ohio River" spans both banks of the Ohio) — hydrologically accurate and not a CONSTRAINT-006 concern (that governs schools/hospitals, not watersheds).

**Not performed:** a full live server report render. The three integration points were verified independently instead — live data (above), template rendering (unit tests assert "Your Watershed" at L3 and "Watershed Context" at L4), and orchestrator passthrough (`chapters.js` spreads `climateHistoryVal`, preserving `watershed.named`). A one-off live render remains a reasonable final manual smoke check.

## Test Counts

- Full suite: **1,231 passed / 65 suites, 0 failures** (was 1,214 before this enhancement).

## Constraints Verified

- **CONSTRAINT-001:** No scoring — all content is descriptive/factual.
- **CONSTRAINT-008:** No inline styles — only existing CSS classes reused; grep confirms the only `style=` in `climate/template.js` is the pre-existing cloud SVG.
- **CONSTRAINT-009:** No HTML/CSS in `data.js`; no API calls in `template.js`.
- **CONSTRAINT-011:** Tests for every new unit; Jeffersonville IN exercised as the location-search regression case.
- **CONSTRAINT-014:** Tiling stays in `shared/spatial.js`.
- **CONSTRAINT-015:** `named` null → both L3 group and L4 block gracefully absent; existing content unaffected.

## API Notes

- **USGS WBD (ArcGIS):** `https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer` — layer 6 = HUC-12, layer 4 = HUC-8. No auth, no API key, no documented rate limit. 8s timeout per query, wrapped for graceful degradation.
- **No new npm dependency.** No `.env` changes.
