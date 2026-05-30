# FR-043 Summary — Climate & Weather: Full Depth Implementation
*Merged: May 2026 — PR #6*

## What Shipped

Expanded the Climate & Weather chapter from a two-finding overview (FEMA flood zone + static tornado tier) to a full multi-level chapter with historic data and community preparedness.

**New data fetched:**
- NOAA Storm Events — pre-cached county JSON for tornadoes, floods, winter storms, heat/drought events
- FEMA OpenFEMA — weather-related disaster declarations (20-year lookback)
- NOAA CDO Climate Normals — 30-year monthly temperature, precipitation, and snowfall averages
- USGS National Elevation Service — 5-point topographic position for watershed/drainage context
- State emergency alert systems — tier-1 named systems with registration URLs

**Level 3 (Deep Read) — 6-tab section:**
1. Flood History — FEMA declarations + NOAA flood events with property damage
2. Tornado History — EF ratings, injury/death counts, basement shelter context
3. Winter Weather — snowfall/ice storm history, road priority tier
4. Heat & Drought — days above 90°F/95°F, drought events
5. Community Preparedness — emergency alert system registration, 72-hour kit guidance
6. Month by Month — 12-month risk calendar from 30-year normals + storm event history

**Level 4 (Research) — data tables:**
- Complete storm event log (30 years) — date, type, magnitude, deaths, injuries, property damage
- 30-year monthly climate normals — avg high, avg low, precip, snowfall

**Glance bar:**
- Flood zone badge + last significant event (FEMA or NOAA) + tornado tier

## Bugs Fixed During Implementation (→ PM-004, CONSTRAINT-016)

NOAA CDO station metadata is unreliable — a station appearing in a `datatypeid=MLY-TMAX-NORMAL` filtered search does not guarantee it has actual records. Fix: validate record content after fetch; iterate candidates with progressive radius expansion (25mi → 50mi → 100mi). This became PM-004 and CONSTRAINT-016.

Unit conversion fix: NOAA CDO returns temperatures in tenths of °F, precipitation in hundredths of inches, snowfall in tenths of inches. All values must be divided accordingly before display.

## Files Changed

- `src/chapters.js` — getClimateHistoryData, getNOAAStormEvents, getNOAAClimateNormals, getWatershedContext, getFEMADeclarations, getEmergencySystem, getLastSignificantEvent
- `src/templates/chapters/climate.js` — buildClimateChapterHTML, all 6 tab builders, research table builder
- `src/utils/constants.js` — NOAA_CDO_BASE_URL, CLIMATE_STORM_LOOKBACK_YEARS, STATE_ALERT_SYSTEMS, NOAA_STATION_SEARCH_RADII, CLIMATE_SIGNIFICANT_DAMAGE_USD
- `tests/templates/chapters/climate.test.js` — Level 3 and Level 4 tests
- `tests/chapters/climate-data.test.js` — data layer tests

## Test Addresses Verified

Georgetown KY, Louisville KY, Bozeman MT, Jeffersonville IN, Harlan KY
