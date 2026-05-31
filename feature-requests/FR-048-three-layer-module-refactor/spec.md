# FR-048 Spec — Three-Layer Module Refactor

**Status:** Specced
**Type:** Structural refactor — no behavior change, no new features
**Constraints enforced:** CONSTRAINT-009, CONSTRAINT-011, CONSTRAINT-013

---

## Problem

CLAUDE.md documents a three-layer module structure (`data.js` / `logic.js` / `template.js`) that does not exist on disk. Every module has only `data.js`. Templates live in a centralized `src/templates/chapters/` directory. Business rule transforms are mixed into `data.js` files alongside raw API calls. CLAUDE.md references file paths (`src/modules/health/logic.js`, etc.) that do not exist.

DR-001 flagged this as the most important open architectural question. The centralized approach was a pragmatic early decision; the per-module structure is the documented and correct target.

---

## Target State

Every module at `src/modules/<domain>/` will have exactly three files:

```
src/modules/<domain>/
  data.js      ← raw API calls only. No processing, no transforms, no HTML.
  logic.js     ← business rule transforms, classifiers, derived values.
                  May be called by data.js (for processing) or template.js (for display).
                  No API calls. No HTML.
  template.js  ← HTML generation from clean processed data.
                  No API calls. No business rules.
```

`src/templates/chapters/` is deleted. `src/shared/validate.js` is untouched — all five of its functions are legitimately cross-module.

---

## The Three-Layer Rule (precise definition)

**data.js:** Only functions that make external API calls (Google Maps, Census ACS, NOAA, FEMA, iNaturalist, eBird, USDA, FCC, EPA, BTS, Overpass). Raw results flow out unchanged or as minimally-shaped JS objects. No derived values, no classifiers, no text generation.

**logic.js:** Only functions that take plain JS objects or primitives and return processed results. No `fetch()`, no `googleMapsClient`, no `fetchCensusACS`. No HTML strings, no CSS class names. Exported and tested independently.

**template.js:** Only functions that take clean processed data objects and return HTML strings. No API clients, no database calls. No business rule thresholds — those live in logic.js. Pure string assembly.

---

## Per-Module Breakdown

### walkability
**data.js stays:** `getWalkabilityScore`
**moves to logic.js:** `getWalkCategory` (score threshold classifier)
**template.js:** move from `src/templates/chapters/walkability.js`

### safety
**data.js stays:** `getEmergencyServices`, `processStation` (makes API calls for drive time)
**moves to logic.js:** `normalizeStationName`, `estimateResponseTime`, `getSafetyLocationContext`
**template.js:** move from `src/templates/chapters/safety.js`

### schools
**data.js stays:** `findNearestSchool`, `findNearestElementarySchool`
**moves to logic.js:** `isExcludedPlaceName`, `isValidSchoolPlace`
**template.js:** move from `src/templates/chapters/schools.js`

### growth
**data.js stays:** `getBuildingPermitTrend`, `getNewConstructionContext`, `getRecentDevelopmentActivity`, `getGrowthAndDevelopment`
**moves to logic.js:** Permit trend classification logic (rising/declining/stable), percentage calculations — extract from inside `getBuildingPermitTrend` as named helpers
**template.js:** move from `src/templates/chapters/growth.js`

### health
**data.js stays:** `findNearestHospital`, `findNearestUrgentCare`
**moves to logic.js:** `isRetailEmbeddedHealth`
**template.js:** move from `src/templates/chapters/health.js`

### property
**data.js stays:** `getPropertyData`, `getSoilData`, `getBroadbandData`, `getPropertyIntelligence`
**moves to logic.js:** `getDrainageCategory`, `getBroadbandCategory`, `getConstructionEraContext`
**template.js:** move from `src/templates/chapters/property.js`

### community
**data.js stays:** `getDemographics`
**moves to logic.js:** `getIncomeLevel`, `getEducationLevel`, `getDensityType`, `getCommunityType`, `suppressed`, `groupIncomeBrackets`, `buildEducationLadder`, `buildHouseholdComposition`, `buildCommuteMode`, `buildTractFips`
**template.js:** move from `src/templates/chapters/community.js`

### garden
**data.js stays:** `getHardinessZone`, `iNatSpeciesCounts`, `iNatSeasonalBirds`, `getGardenData`
**moves to logic.js:** `filterNativePlants`, `filterInvasivePlants`, `filterWildlife`, `filterBirds`, `filterReptiles`, `filterInsects`, `filterButterflies`, `categorizeSeasonalBirds`, `categorizePlantsByForm`, `getMonarchCorridorInfo`, `getFireflyHabitat`
**template.js:** move from `src/templates/chapters/garden.js`

### climate
**data.js stays:** `getNOAAStormEvents`, `getNOAAClimateNormals`, `fetchElevationWithRetry`, `getWatershedContext`, `getFEMADeclarations`, `getClimateHistoryData`
**moves to logic.js:** `getEmergencySystem`, `getLastSignificantEvent`, `computeRarityStatement`, `classifyTopographicPosition`
**template.js:** move from `src/templates/chapters/climate.js`

### sensory
**data.js stays:** `getAirQuality`, `getFloodRisk`, `getAirportData`, `getRoadNoise`, `getRoadNoiseOSM`, `getRailProximity`, `getLightPollution`, `fetchLanduseOSM`, `getWaterQuality`, `getEJScreen`, `fetchOverpass`, `getEnvironmentalData`
**moves to logic.js:** `getAQICategory`, `interpretFloodZone`, `estimateDNLFromRoad`, `getDNLCategory`, `estimateBortle`, `getBortleDescription`, `getRadonZone`
**template.js:** move from `src/templates/chapters/sensory.js`

### reachability
**data.js stays:** `findNearestGrocery`, `findNearestPharmacy`, `findNearestGasStation`
**moves to logic.js:** grocery type exclusion filter (extract the inline filter predicate as `isExcludedGroceryType`)
**template.js:** move from `src/templates/chapters/reachability.js`

### access
**data.js stays:** `findNearestHighwayOnRamp`
**moves to logic.js:** `isValidHighwayName`, highway drive-time threshold filter, interchange fallback logic — extract as named helpers
**template.js:** none (access module has no chapter template currently)

---

## Import Chain Changes

### `src/chapters.js`
- Remove all imports from `./templates/chapters/*`
- Add per-module template imports: `require('./modules/<domain>/template')`
- Garden filter functions (`filterReptiles`, `filterInsects`, `filterButterflies`, `categorizeSeasonalBirds`, `categorizePlantsByForm`, `getMonarchCorridorInfo`, `getFireflyHabitat`) move from `garden/data` to `garden/logic` — update import source
- Remove these from `module.exports` (they are internal to garden/template now, not needed by orchestrator)

### `src/modules/property/data.js`
- `getDensityType` currently imported from `../community/data` → update to `../community/logic`

### Test files
- All `tests/templates/chapters/*.test.js` → move to `tests/modules/<domain>/template.test.js`
- All `tests/modules/<domain>/data.test.js` that test logic functions → split: logic tests move to `tests/modules/<domain>/logic.test.js`

### Deletion
- `src/templates/chapters/` (all 14 files including `index.js`)

---

## CLAUDE.md Corrections Required

1. Architecture section: update module structure description to reflect actual three files per module
2. Three-layer rule: update file path examples to match new locations
3. CONSTRAINT-002: fix `src/modules/community/logic.js` reference (was `logic.js` but the constraint was previously unenforceable because the file didn't exist)
4. CONSTRAINT-003: fix `src/modules/health/logic.js` reference
5. CONSTRAINT-009: fix file path examples
6. CONSTRAINT-011: fix "every business rule in logic.js" — now actually enforced
7. Any other references to `templates/chapters/` paths

---

## Acceptance Criteria

1. Every module has `data.js`, `logic.js`, `template.js`
2. `src/templates/chapters/` directory does not exist
3. No `data.js` file generates HTML or CSS class names
4. No `template.js` file makes API calls or contains business rule thresholds
5. No `logic.js` file makes API calls or generates HTML
6. All existing tests pass with updated import paths
7. New `logic.test.js` files exist for every module with logic content
8. CLAUDE.md file path references match actual disk locations
9. `npm test` passes with same or higher test count

---

## Out of Scope

- `src/templates/components/` (badge, buckets, chapterCard, etc.) — these are shared UI primitives, not chapter-specific. Out of scope.
- `src/templates/pages/reportPage.js` — page template, not chapter template. Out of scope.
- `compareBuilder.js` — separate codepath. Out of scope.
- Any behavior changes — this is a pure structural refactor
- New chapter content or L3/L4 additions
