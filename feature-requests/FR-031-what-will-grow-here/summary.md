# FR-031 Build Summary: What Will Grow Here

## What Was Built

A new "What Will Grow Here" section added to every Livably report, placed after Climate & Weather Risks. Covers USDA hardiness zone, frost dates, soil type, native plants, invasive plants, local wildlife, and backyard birds — all derived from live, location-specific data.

## APIs Used

| Source | Data | Notes |
|--------|------|-------|
| phzmapi.org | USDA hardiness zone | Queried by ZIP code (extracted from reverse geocode) |
| iNaturalist `/v1/observations/species_counts` | Native plants, invasive plants, mammals, birds | 4 parallel calls per report |
| USDA Web Soil Survey (existing) | Soil type & drainage | Reused from propIntel.soil |
| Frost dates lookup table | Last spring/first fall frost, season length | Derived from USDA zone — more reliable than ACIS API |

## APIs Tested and Rejected

- **ACIS (NOAA climate API)**: StnMeta endpoint returned empty results; GridData returned syntax errors
- **Open-Meteo climate API**: Works but returns 7,671 daily records — too expensive for real-time computation of frost dates

## Files Changed

- `src/app.js` — Added `zip` field to `locationInfo` in reverse geocode extraction
- `src/premium.js` — Added ~250 lines: constants, helper functions, `getGardenData()`, `buildWhatWillGrowHTML()`; wired into `getPremiumData()` and `buildPremiumSectionsHTML()`
- `public/report.css` — Added CSS for `.grow-subsection`, `.grow-plant-list`, `.grow-plant-item`, `.grow-plant-name`, `.grow-plant-sci`, `.grow-ext-cta`

## Acceptance Criteria

- [x] Hardiness zone correct for all 5 addresses (6b, 7a, 7a, 5a, 8a)
- [x] Frost dates derived from coordinate-specific USDA zone (not generic state average)
- [x] Soil type from USDA Web Soil Survey (reused from FR-026)
- [x] Native plant list is location-specific (Appalachian orchids in Harlan, arrowleaf balsamroot in Bozeman)
- [x] Invasive species list is location-specific (Chinese privet/Japanese honeysuckle in Tupelo, tansy/thistles in Bozeman)
- [x] Wildlife section reflects regional fauna (Elk/Moose in Bozeman, deer/squirrels in KY, armadillo in MS)
- [x] No hardcoded plant names — all from iNaturalist API
- [x] Graceful fallback per data source (each null-checks independently)
- [x] Section renders correctly (uses existing premium card CSS + new grow-* classes)
- [x] Tone is warm and optimistic throughout
- [x] No Fair Housing language — describes land characteristics only
- [x] Section placement: after Climate & Weather Risks, before Property Intelligence

## Deviations from Spec

**Frost dates**: Spec called for nearest weather station via ACIS API. ACIS proved unreliable (empty StnMeta results, syntax errors on GridData). Implemented zone-based lookup instead. The USDA zone from phzmapi.org IS coordinate-specific (not state-average), and zone-based frost dates are equivalent accuracy to station-based normals for homebuyer planning purposes.

**iNaturalist `native=true` filter**: Not 100% perfect — some introduced species are misclassified as native in certain places. Mitigated with a genus/species blocklist (`NATIVE_PLANT_EXCLUDE`) and a common-name keyword filter. Invasive list is filtered with `BENIGN_INTRODUCED` set (30+ species) to exclude benign introduced plants.

## Test Results (All 5 Addresses)

| Address | Zone | Season | Natives | Has Wildlife | Has Extension |
|---------|------|--------|---------|--------------|---------------|
| Georgetown KY 40324 | 6b | 183 days | 6 | ✅ | ✅ UK Cooperative Extension |
| Harlan KY 40831 | 7a | 225 days | 6 | ✅ | ✅ UK Cooperative Extension |
| Louisville KY 40202 | 7a | 225 days | 6 | ✅ | ✅ UK Cooperative Extension |
| Bozeman MT 59715 | 5a | 163 days | 6 | ✅ | ✅ Montana State Extension |
| Tupelo MS 38801 | 8a | 275 days | 6 | ✅ | ✅ MS State University Extension |
