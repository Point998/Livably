# FR-036 Summary — Utils Extraction (Phase 1 of 7)

**Status:** Complete  
**Date:** 2026-05-25

## What Was Done

Extracted all pure utility functions and hardcoded constants from `src/app.js`, `src/premium.js`, and `src/development-discovery.js` into `src/utils/`. Zero behavior changes.

## Files Created

| File | Contents |
|------|----------|
| `src/utils/state.js` | `STATE_ABBRS` Set (51 entries) |
| `src/utils/constants.js` | 62 named constants (search radii, candidate counts, filter arrays, lookup tables, thresholds) |
| `src/utils/geo.js` | `haversineDistance` |
| `src/utils/time.js` | `getNextTuesday8am`, `getNextDayAt` |
| `src/utils/text.js` | `escapeHtml`, `formatDriveTime`, `toTitleCase`, `parseAddressParts`, `formatResearchDate`, `formatMoney`, `slugify`, `getDateSlug` |

## Files Modified

**`src/app.js`** — Added imports from all 5 utils/ files. Removed 9 inline function definitions and 8 module-level constants. Replaced all magic numbers with named constants.

**`src/premium.js`** — Added imports from utils/geo, utils/text, and utils/constants. Removed inline `haversineDistance`, `esc`, and `formatMoney` functions. Renamed all 125 `esc(` call sites to `escapeHtml(`. Removed all module-level constants (STATE_*, FROST_DATE_TABLE, wildlife sets, STATE_EXTENSION, airport regexes, OVERPASS_ENDPOINTS, COMMERCIAL_DEV_TYPES, RADON_ZONE_BY_STATE, TORNADO_TIER IIFE). Replaced magic numbers with named constants. Converted TORNADO_TIER from a function-returning IIFE to a plain object in constants.js with a local `getTornadoTier()` wrapper. Simplified `interpretFloodZone()` to use imported `FEMA_FLOOD_ZONES`. Replaced local `TECH_MAP` with imported `BROADBAND_TECH_CODES`. Removed function-scope `WALK_TYPES` shadow, using module-level import instead.

**`src/development-discovery.js`** — Added imports from utils/constants. Removed `CACHE_TTL_MS`, `REQUEST_DELAY_MS`, `MAX_ARTICLE_AGE`, `TYPE_MAP`, `STATUS_MAP`. Renamed all call sites to DEV_* equivalents.

## Key Decisions

- **`esc` → `escapeHtml` rename:** Used Bash `sed` for 125 call-site renames (not PowerShell, which corrupted UTF-8 emoji in a prior attempt).
- **TORNADO_TIER:** Converted from IIFE-returning-function pattern to plain data object in constants.js + local `getTornadoTier()` helper in premium.js. Maintains same behavior, removes the unusual pattern.
- **`FEMA_FLOOD_ZONES`:** Extracted local `const map = {}` from inside `interpretFloodZone()` into constants.js; function simplified to a single lookup.
- **`DEV_TYPE_MAP` / `DEV_STATUS_MAP`:** Same data as inline, just prefixed. Keywords and entries unchanged.

## Verification

- All 5 utils/ modules: correct exports confirmed
- `INTERSTATE_LIST.length` = 59
- `STATE_TAX_RATES` keys = 51
- `TORNADO_TIER.high.length` = 16
- 0 `esc(` calls remaining across all files
- 62 constants exported from constants.js
- All three source modules load clean: `node -e "require('./src/[file]')"` → OK
