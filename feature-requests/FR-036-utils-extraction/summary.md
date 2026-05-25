# FR-036 Summary — Utils Extraction (Phase 1 of 7)

**Status:** Complete and shipped  
**Commit:** ad23410  
**Date:** 2026-05-25

---

## What Was Built

Created `src/utils/` — five pure modules with no API calls, no HTML, and no side effects. Wired all three source files to import from them. Zero behavior change.

### New files

| File | Exports | Notes |
|------|---------|-------|
| `src/utils/state.js` | `STATE_ABBRS` | 51-entry Set used by text.js for title-casing state abbreviations |
| `src/utils/constants.js` | 62 named exports | All magic numbers and data tables — search radii, filter arrays, lookup tables, thresholds |
| `src/utils/geo.js` | `haversineDistance` | Pure math, no deps |
| `src/utils/time.js` | `getNextTuesday8am`, `getNextDayAt` | Timestamp helpers for Google Distance Matrix departure times |
| `src/utils/text.js` | 8 string/format helpers | `escapeHtml`, `formatDriveTime`, `toTitleCase`, `parseAddressParts`, `formatResearchDate`, `formatMoney`, `slugify`, `getDateSlug` |

### Modified files

**`src/app.js`** — 162 net lines removed. Added imports from all 5 utils files. Removed 9 inline function definitions (`escapeHtml`, `formatDriveTime`, `toTitleCase`, `parseAddressParts`, `formatResearchDate`, `slugify`, `getDateSlug`, `getNextTuesday8am`, `getNextDayAt`). Removed 8 module-level constants (`PARK_EXCLUDED_TYPES`, `PARK_LEISURE_TYPES`, `SCHOOL_PLACE_TYPES`, `SCHOOL_NAME_TERMS`, `CUSTOM_DEST_ICONS`, `ERROR_ICONS`, `MAX_CONCURRENT_PDFS`, `STATE_ABBRS`). Replaced all literal search radii, candidate counts, and highway thresholds with named constants.

**`src/premium.js`** — 413 net lines removed. Removed `haversineDistance`, `esc`, and `formatMoney` inline definitions. Renamed all 125 `esc(` call sites to `escapeHtml(`. Removed STATE_*, FROST_DATE_TABLE, wildlife filter sets, STATE_EXTENSION, airport regexes, OVERPASS_ENDPOINTS, COMMERCIAL_DEV_TYPES, RADON_ZONE_BY_STATE, TORNADO_TIER IIFE, and function-scope WALK_TYPES shadow. Replaced TECH_MAP with BROADBAND_TECH_CODES. Replaced all search radius and threshold literals with named constants.

**`src/development-discovery.js`** — Removed CACHE_TTL_MS, REQUEST_DELAY_MS, MAX_ARTICLE_AGE, TYPE_MAP, STATUS_MAP. Renamed all call sites to DEV_* equivalents.

---

## What Was Found During Execution

**PowerShell UTF-8 corruption (critical incident):** Early attempt to use PowerShell 5.1's `Get-Content -Raw` + `Set-Content -Encoding utf8` to do the `esc(` → `escapeHtml(` rename corrupted all 455 lines containing emoji. PowerShell 5.1 reads UTF-8 files as Windows-1252 by default, then writes back as UTF-8-with-BOM, double-encoding all multi-byte sequences. Required `git checkout -- src/premium.js` and full redo of Stage 3. Fixed by using Bash `sed -i` instead. **Never use PowerShell for file content manipulation in this project.**

**TORNADO_TIER IIFE pattern:** The original was an IIFE returning a function `(state) => {...}`. Cannot be exported as-is from constants.js. Converted to a plain data object `{ high: [...], moderate: [...], low: [...] }` in constants.js, with a local `getTornadoTier(state)` wrapper in premium.js that preserves identical call behavior.

**Module-scope vs function-scope conflicts:** Adding `const { X } = require(...)` at module scope while `const X = ...` or `function X()` still exists causes a SyntaxError. Every constant and function had to be removed atomically with its import. Node surfaced these one at a time — the fix was to run `node -e "require('./src/file')"` after each removal group, not at the end.

**FEMA_FLOOD_ZONES:** The original `interpretFloodZone()` held a local `const map = {}` inside the function body. Extracting it to constants.js and simplifying the function to `return FEMA_FLOOD_ZONES[zone] || fallback` was straightforward but required reading the full function to identify.

**WALK_TYPES function-scope shadow:** A local `const WALK_TYPES = [...]` inside `getWalkabilityScore()` shadowed the module-level import. JavaScript doesn't throw on this — it silently uses the local. Removed the local and updated `radius: 800` → `WALKABILITY_SEARCH_RADIUS_M` at the same time.

---

## Verification Results

```
constants exports: 62
text exports: escapeHtml, formatDriveTime, toTitleCase, parseAddressParts,
              formatResearchDate, formatMoney, slugify, getDateSlug
INTERSTATE_LIST.length: 59
STATE_TAX_RATES keys: 51
TORNADO_TIER.high.length: 16
esc( calls remaining: 0
escapeHtml( calls in premium.js: 125
app.js: OK
premium.js: OK
development-discovery.js: OK
Server HTTP 200
```

---

## Notes for FR-037: Data Layer Extraction

FR-037 is Phase 2 of 7. It extracts the API-calling functions from `src/app.js` into `src/modules/*/data.js` files, following the three-layer rule: `data.js` fetches raw API data only.

### Scope

The `find*` and `get*` async functions in app.js are the targets. Natural module groupings:

| Module | Functions to extract |
|--------|---------------------|
| `modules/convenience/` | `findNearestGrocery`, `findNearestPharmacy`, `findNearestGasStation` |
| `modules/access/` | `findNearestHighwayOnRamp`, `getTrafficVariations` |
| `modules/health/` | `findNearestHospital`, `findNearestUrgentCare` |
| `modules/schools/` | `findNearestSchool`, `findNearestElementarySchool` |
| `modules/recreation/` | `findNearestPark`, `findNearestCoffeeShop` |
| `src/shared/` | `geocodeAddress`, `getDriveTime` — used by all modules |

Helper predicates (`isExcludedPlaceName`, `isRetailEmbeddedHealth`, `isValidSchoolPlace`, `isValidPark`) move with the functions that call them.

### What stays in app.js for now

- Express route handlers (`app.get`, `app.post`)
- Report persistence (`loadReports`, `saveReport`, `getReport`, `updateReportAccess`)
- `generateComparisonData` — touches multiple modules, extract last
- All `build*HTML` functions — these are the template layer, Phase 4

### Key risks to assess in Phase 2 discovery

1. **`googleMapsClient` and `googleMapsApiKey` threading:** Currently in app.js scope, passed as params to some functions and accessed as closure by others. Data modules will need them injected — check every call site before moving.

2. **`getMitigation` calls inside data functions:** Several `find*` functions call `getMitigation('findNearestGrocery', 'searchRadiusM', GROCERY_SEARCH_RADIUS_M)`. After extraction, `getMitigation` must be importable from the data module. Confirm `errorMemory.js` has no circular dependency risk.

3. **`geocodeAddress` is a prerequisite:** Nearly every data function depends on a geocoded lat/lng. It should move to `src/shared/geocoder.js` and be extracted first, before any module data files.

4. **premium.js data functions:** `getPremiumData` in premium.js is a large parallel data-fetch orchestrator. It may stay as-is through Phase 2 and be broken up in Phase 3 (logic) or later, depending on complexity.

5. **Test coverage gap:** No tests exist for the `find*` functions. Phase 2 discovery should enumerate which functions have zero test coverage and flag them as blocking risks (CONSTRAINT-011).
