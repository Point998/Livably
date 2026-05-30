# Module Restructure Plan
*May 2026 — Last updated May 2026*

## Current Status (May 2026)

### Completed
- `src/shared/google/` — geocoding, reverseGeocode, distanceMatrix, client ✅
- `src/shared/validate.js` — Logic Layer, all coherence rules ✅
- `src/shared/census.js` — Census FIPS + ACS fetching ✅
- `src/utils/` — text, geo, time, state helpers ✅
- `src/utils/constants.js` — all constants ✅
- `src/modules/access/data.js` — highway access ✅
- `src/modules/health/data.js` — hospital + urgent care ✅
- `src/modules/reachability/data.js` — grocery, pharmacy, gas station ✅
- `src/modules/recreation/data.js` — parks, coffee shops ✅
- `src/modules/schools/data.js` — school searches ✅
- `src/templates/chapters/*.js` — all 14 chapter templates extracted ✅
- `src/templates/components/` — shared components extracted ✅

### Three-Layer Pattern Note
The full four-file pattern (`data.js` / `logic.js` / `template.js` / `index.js`) is the target, but **during this migration phase**, the layers are organized as follows:
- **Data layer** (`data.js`): Per-module, extracted for 5 modules above
- **Logic layer**: Centralized in `src/shared/validate.js` rather than per-module `logic.js` files — this is intentional for cross-module coherence (CONSTRAINT-014)
- **Template layer**: Centralized in `src/templates/chapters/` rather than per-module `template.js` files
- **`index.js`**: Not yet created for any module; imports happen directly from `data.js`

The remaining data logic (demographics, climate, garden, growth, walkability, sensory, property, community) lives in `src/chapters.js` (~1,700 lines). This is the primary extraction target for the next phase.

### Still in `src/chapters.js` (extraction targets)
- getDemographics → `src/modules/community/data.js`
- getClimateHistoryData, getNOAAClimateNormals → `src/modules/climate/data.js`
- getGardenData → `src/modules/garden/data.js`
- getGrowthAndDevelopment → `src/modules/growth/data.js`
- getWalkabilityScore → `src/modules/walkability/data.js`
- getEnvironmentalData → `src/modules/sensory/data.js`
- getPropertyIntelligence → `src/modules/property/data.js`
- getEmergencyServices → merge into `src/modules/health/data.js`

---

## Goal
Extract the monolith (app.js + premium.js) into a proper module architecture where each chapter owns its domain completely.

## The Pattern (from ASAI)
Each module has four files:
- `data.js` — API calls only, returns raw data
- `logic.js` — business rules only, validates and processes data
- `template.js` — HTML generation only, renders processed data
- `index.js` — public interface, what other modules can use

## Module List

### src/modules/reachability/
Owns: grocery, pharmacy, hospital, urgent care, highway access, school, gas station
Depends on: src/shared/google/, src/shared/validate.js

### src/modules/schools/
Owns: school search, state boundary validation, private school discovery
Depends on: src/shared/google/, src/shared/validate.js
Critical: State boundary filter (PM-001)

### src/modules/health/
Owns: ER search, fire/police response, ISO context
Depends on: src/shared/google/
Critical: Drive-time verification across top 5 (PM-003)

### src/modules/climate/
Owns: FEMA flood zone, tornado risk, watershed context
Depends on: src/shared/google/ (geocoding only)

### src/modules/garden/
Owns: hardiness zone, frost dates, native plants, wildlife
Depends on: USDA, NOAA, iNaturalist, eBird APIs

### src/modules/community/
Owns: Census demographics, owner-occupancy, tenure
Depends on: Census ACS API
Critical: Fair Housing rules enforced in logic.js

### src/modules/growth/
Owns: development pipeline, commercial landscape
Depends on: Google Places, development-intel.js

### src/modules/sensory/
Owns: airports, road noise, rail, light pollution, AQI, radon
Depends on: Google Places, EPA, FAA APIs

### src/modules/walkability/
Owns: walkability score, nearby walkable destinations
Depends on: Google Places

### src/modules/costs/
Owns: property tax, carrying costs, market context
Depends on: Census, state tax data

### src/modules/utilities/ (FR-032)
Owns: electric/gas/water providers, outage history, internet
Depends on: EIA, NERC, FCC APIs

### src/modules/traffic/
Owns: traffic pattern data for key destinations
Depends on: Google Distance Matrix

### src/modules/dailylife/
Owns: daily life narrative section
Depends on: reachability module data

## Shared Layer

### src/shared/validate.js
The Logic Layer. Cross-module coherence rules.
- State boundary enforcement
- Drive time coherence checks
- Rural mode detection
- Fair Housing compliance checks

### src/shared/constants.js
All constants in one place:
- Interstate list (59 interstates)
- Retail clinic exclusions
- Distance thresholds
- Rural mode thresholds

### src/shared/utils/
- time.js (getNextTuesday8am)
- text.js (toTitleCase, escapeHtml, formatDriveTime)
- geo.js (distance calculations)
- state.js (state name/abbreviation lookup)

### src/shared/google/
- geocoding.js
- places.js
- distanceMatrix.js
- reverseGeocode.js

## Migration Order
1. Create shared/utils/ — zero risk, no behavior change
2. Create shared/constants.js — zero risk, no behavior change
3. Create shared/google/ — extract API calls, test each
4. Create shared/validate.js — the Logic Layer
5. Create modules/ one at a time, starting with schools (PM-001)
6. Delete app.js functions as modules replace them
7. Delete premium.js sections as modules replace them
8. app.js becomes ~30 lines of Express setup
