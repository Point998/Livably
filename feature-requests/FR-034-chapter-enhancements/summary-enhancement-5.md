# FR-034 Enhancement 5 — Summary: Air Traffic Direction

**Status:** Complete  
**Date:** June 2026

## What Was Built

Added directional context to the airport narrative in the Sensory & Environmental chapter. Buyers now see which direction an airport is from their home ("to the north", "to the southwest"), not just how many miles away it is.

**Before:**
> "The nearest airport, Cincinnati/Northern Kentucky International, is 22.5 miles away. At that distance, aircraft are at altitude and not meaningfully audible at ground level."

**After:**
> "The nearest airport, Cincinnati/Northern Kentucky International, is 22.5 miles to the north. At that distance, aircraft are at altitude and not meaningfully audible at ground level."

Secondary airports also include direction: "Blue Grass Airport (8.2 mi to the southwest) is also in the region."

## Files Changed

| File | Change |
|------|--------|
| `src/utils/geo.js` | Added `computeBearing(lat1, lng1, lat2, lng2)` and `bearingToCompass(degrees)` |
| `src/modules/sensory/data.js` | Added `lat`, `lng`, `_homeLat`, `_homeLng` to env data shape |
| `src/modules/sensory/template.js` | Added directional language using the new geo functions |
| `tests/utils/geo.test.js` | New file — 36 tests for haversineDistance, computeBearing, bearingToCompass |
| `tests/modules/sensory/template.test.js` | Updated base fixture with coords; added 7 direction tests |

## Design Decisions

**Abbreviation → word mapping in template:** `bearingToCompass` returns abbreviated compass codes ('N', 'SW', etc.) — cleaner for programmatic use. A `COMPASS_WORDS` map in the template converts to full English words for prose output.

**`_homeLat`/`_homeLng` via env object:** Rather than threading lat/lng through several additional function params (reportPage → chapterCard → template), the home coordinates are bundled into the env data object with a `_` prefix marking them as infrastructure fields, not API data. Minimal diff, no cascading signature changes.

**8-point compass only:** 16-point compass ("NNW", "ESE") would be more precise but is harder to read in prose and doesn't meaningfully improve buyer decision-making at this scale. 8-point is right.

**Graceful degradation:** If airport lat/lng is null (shouldn't happen with current Google Places code but guarded), or home coords are null, the direction is silently omitted and the distance-only narrative is used. No crash, no placeholder text.

## Deferred

**FAA runway orientation:** Telling buyers whether they're *in* an approach corridor (vs. beside the airport) would require mapping the Google Place to an FAA ICAO identifier and fetching runway headings. This is doable (FAA has a free API at `api.faa.gov`) but adds significant complexity: fuzzy name-to-ID matching, a new API call per airport, and runway geometry math. Scoped as a future enhancement.

## Tests

- 36 new tests in `tests/utils/geo.test.js`
- 7 new tests in `tests/modules/sensory/template.test.js`
- Full suite: 1,157 tests, all passing
