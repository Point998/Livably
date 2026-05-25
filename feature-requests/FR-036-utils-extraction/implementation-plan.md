# FR-036 — Phase 3 Implementation Plan: Utilities Extraction
*Phase 3 of the architectural rebuild. No code changes in this phase.*
*May 2026*

---

## Overview

This plan executes the spec in `spec.md`. It is organized into five stages that can be verified independently. If any stage produces an error, work stops and rollback procedures apply before continuing.

**Estimated scope:**
- 5 new files created
- ~500 lines deleted from `app.js`
- ~800 lines deleted from `premium.js`
- ~30 lines deleted from `development-discovery.js`
- ~50+ `esc(` call sites renamed in `premium.js`
- Zero behavior changes

---

## Pre-Implementation Baseline

Before writing a single line of code, capture the baseline state.

### Step 0A — Verify clean working tree

```
git status
```

Must show no uncommitted changes. If there are changes, stash or commit them first. Implementation starts from a clean state.

### Step 0B — Capture baseline grep counts

Run these now and record the output. They are the "before" state for the final verification:

```
grep -c "\besc(" src/premium.js
```
Record the number. This is how many `esc(` calls will be renamed.

```
grep -c "escapeHtml(" src/app.js
```
Record the number. These calls must still work after extraction.

```
grep -c "const interstates = \[" src/app.js
```
Expected: 1. Will be 0 after extraction.

### Step 0C — Generate a baseline report

Run the Georgetown report (`100 Wishing Well Path Unit 2306, Georgetown, KY 40324`) and note the output — chapter count, no console errors. This is the before-state for all verification steps.

---

## Stage 1 — Create `src/utils/` files

**Risk level: Zero.** New files only. Nothing in `src/` knows they exist yet. Server behavior is unchanged.

### Step 1.1 — Create `src/utils/state.js`

Content: `STATE_ABBRS` Set with all 51 abbreviations, exported.

Source: Copy verbatim from `app.js:776–777`.

Verify: `node -e "const {STATE_ABBRS}=require('./src/utils/state'); console.log(STATE_ABBRS.size)"` → prints `51`.

### Step 1.2 — Create `src/utils/constants.js`

Content: All constants listed in `spec.md`, in the exact order and grouping specified. Export all at bottom.

Source: Copy values from:
- `app.js:432–439` (INTERSTATE_LIST)
- `app.js:499,504` (HIGHWAY thresholds)
- `app.js:221,226–229,237,303,389,325,695–715,736–741,747,660–661,580–581,1258,1576,2253` (app constants)
- `app.js:113–116` (TRAFFIC_VARIATION_SLOTS — adapt to object array format from spec)
- `premium.js:217,227,237,247` (STATE_* financial tables)
- `premium.js:384–391` (response time constants)
- `premium.js:451–457` (AQI_THRESHOLDS)
- `premium.js:475–487` (FEMA_FLOOD_ZONES)
- `premium.js:491` (TORNADO_TIER state arrays)
- `premium.js:633–635` (NON_AIRPORT_RE, AIRPORT_RE)
- `premium.js:639` (airport radii)
- `premium.js:677` (OVERPASS_ENDPOINTS)
- `premium.js:291,300` (WALK_TYPES, walkability radius)
- `premium.js:733–739` (DNL_THRESHOLDS)
- `premium.js:780–813` (light pollution thresholds → BORTLE_SCALE)
- `premium.js:823,846` (water quality constants)
- `premium.js:876` (RADON_ZONE_BY_STATE)
- `premium.js:1074` (COMMERCIAL_DEV_TYPES)
- `premium.js:1130` (FROST_DATE_TABLE)
- `premium.js:1167–1192` (wildlife filter sets)
- `premium.js:1197` (STATE_EXTENSION)
- `premium.js:1352–1356` (iNat radii and per-page counts)
- `premium.js:1627` (BROADBAND_TECH_CODES)
- `premium.js:418–419` (HIGHWAY_NOISE_ESTIMATE)
- `development-discovery.js:15–17` (DEV_* timing constants)
- `development-discovery.js:24` (DEV_TYPE_MAP)
- `development-discovery.js:75` (DEV_STATUS_MAP)

**Do not remove anything from source files yet.**

Verify: `node -e "const c=require('./src/utils/constants'); console.log(Object.keys(c).length)"` → prints the total number of exported keys (expected: ~50).

Spot-check: `node -e "const {INTERSTATE_LIST}=require('./src/utils/constants'); console.log(INTERSTATE_LIST.length)"` → prints `59`.

Spot-check: `node -e "const {STATE_TAX_RATES}=require('./src/utils/constants'); console.log(Object.keys(STATE_TAX_RATES).length)"` → prints `52` (or whatever the actual count is).

### Step 1.3 — Create `src/utils/geo.js`

Content: `haversineDistance` function, exported.

Source: Copy verbatim from `premium.js:9–22`.

Verify: 
```
node -e "
const {haversineDistance}=require('./src/utils/geo');
// Georgetown KY to Louisville KY — should be ~65 miles
console.log(haversineDistance(38.2098, -84.5581, 38.2527, -85.7585).toFixed(1));
"
```
Expected: approximately `65.0`.

### Step 1.4 — Create `src/utils/time.js`

Content: `getNextTuesday8am` and `getNextDayAt`, exported.

Source: Copy verbatim from `app.js:73–109`.

Verify:
```
node -e "
const {getNextTuesday8am, getNextDayAt}=require('./src/utils/time');
const ts = getNextTuesday8am();
console.log(typeof ts, ts > Date.now()/1000);
"
```
Expected: `number true`.

### Step 1.5 — Create `src/utils/text.js`

Content: All 8 functions from spec.md — `escapeHtml`, `formatDriveTime`, `toTitleCase`, `parseAddressParts`, `formatResearchDate`, `formatMoney`, `slugify`, `getDateSlug`. Exports all.

Internal dependency: `const { STATE_ABBRS } = require('./state');` at top of file — for `toTitleCase`.

Source:
- `escapeHtml` — copy from `app.js:764–771`
- `formatDriveTime` — copy from `app.js:772–776`
- `toTitleCase` — copy from `app.js:778–784` (update to use imported `STATE_ABBRS`)
- `parseAddressParts` — copy from `app.js:785–792`
- `formatResearchDate` — copy from `app.js:794–800`
- `formatMoney` — copy from `premium.js:30–37`
- `slugify` — copy from `app.js:2243–2245`
- `getDateSlug` — copy from `app.js:2247–2251`

Verify:
```
node -e "
const t=require('./src/utils/text');
console.log(t.escapeHtml('<b>test & \"check\"</b>'));
console.log(t.formatDriveTime(73));
console.log(t.toTitleCase('123 main st, georgetown, ky'));
console.log(t.formatMoney(1234567));
console.log(t.slugify('Georgetown KY'));
"
```
Expected output:
```
&lt;b&gt;test &amp; &quot;check&quot;&lt;/b&gt;
1 hr 13 min
123 Main St, Georgetown, KY
$1,234,567
georgetown-ky
```

### Stage 1 Checkpoint

After creating all 5 files: `node src/app.js` must start without errors. The server has not yet been changed — it is still self-contained. The utils/ files exist but nothing imports from them yet.

**Test: Georgetown standard report generates correctly** (same as baseline).

---

## Stage 2 — Wire `app.js`

**Risk level: Medium.** Modifying active code. Work in groups, verify after each group.

### Step 2.1 — Add import block to top of `app.js`

Add a single `require` block near the top of `app.js`, after existing `require` statements but before any function definitions:

```js
const { getNextTuesday8am, getNextDayAt } = require('./utils/time');
const {
  escapeHtml, formatDriveTime, toTitleCase,
  parseAddressParts, formatResearchDate, slugify, getDateSlug
} = require('./utils/text');
const {
  INTERSTATE_LIST,
  GROCERY_SEARCH_RADIUS_M, GROCERY_CANDIDATE_COUNT, GROCERY_EXCLUDED_TYPES,
  HOSPITAL_SEARCH_RADIUS_M, HOSPITAL_CANDIDATE_COUNT,
  HIGHWAY_MAX_DRIVE_MINUTES, HIGHWAY_INTERCHANGE_MAX_MINUTES,
  ELEMENTARY_SCHOOL_SEARCH_RADIUS_M, ELEMENTARY_SCHOOL_EXCLUSIONS,
  COFFEE_SHOP_CANDIDATE_COUNT,
  PARK_EXCLUDED_TYPES, PARK_LEISURE_TYPES,
  SCHOOL_PLACE_TYPES, SCHOOL_NAME_TERMS,
  TRAFFIC_VARIATION_SLOTS,
  CUSTOM_DEST_ICONS, ERROR_ICONS, MAX_CONCURRENT_PDFS,
} = require('./utils/constants');
```

**Do not remove any inline definitions yet.** This step only adds imports.

Verify: `node src/app.js` starts without errors. Node will throw immediately on any require failure or name collision. If it throws a `SyntaxError: Identifier 'X' has already been declared` error, it means an inline `const X = ...` still exists and creates a conflict — fix by removing the inline before adding it to the import list, or adjust the sequencing.

**IMPORTANT:** If any constant already exists as a module-level `const` in `app.js`, adding it to the destructure import WILL cause a redeclaration error. Those constants must be removed from `app.js` before or simultaneously with being added to the import block. Handle them in Step 2.3.

### Step 2.2 — Remove function definitions from `app.js`

Remove the inline definitions for these functions (the import block already provides them):

| Remove | Location | Confirm import exists |
|--------|----------|-----------------------|
| `function getNextTuesday8am()` | `app.js:73–96` | `time.js` |
| `function getNextDayAt()` | `app.js:97–109` | `time.js` |
| `function escapeHtml()` | `app.js:764–771` | `text.js` |
| `function formatDriveTime()` | `app.js:772–776` | `text.js` |
| `function toTitleCase()` | `app.js:778–784` | `text.js` |
| `function parseAddressParts()` | `app.js:785–792` | `text.js` |
| `function formatResearchDate()` | `app.js:794–800` | `text.js` |
| `function slugify()` | `app.js:2243–2245` | `text.js` |
| `function getDateSlug()` | `app.js:2247–2251` | `text.js` |

Remove one at a time. After each removal:
- `node -e "require('./src/app.js')"` must not throw.

### Step 2.3 — Remove and replace module-level constants from `app.js`

For each module-level `const` below, the process is:
1. Add the name to the `require('./utils/constants')` import destructuring at the top of `app.js`
2. Immediately delete the inline `const X = [...]` definition
3. Verify the server starts before moving to the next one

Order (low-risk to higher-risk, smallest to largest):

| Remove | Location | Replace with import |
|--------|----------|---------------------|
| `const MAX_CONCURRENT_PDFS = 3` | `app.js:2253` | `MAX_CONCURRENT_PDFS` |
| `const PARK_EXCLUDED_TYPES = [...]` | `app.js:660` | `PARK_EXCLUDED_TYPES` |
| `const PARK_LEISURE_TYPES = [...]` | `app.js:661` | `PARK_LEISURE_TYPES` |
| `const SCHOOL_PLACE_TYPES = new Set([...])` | `app.js:580` | `SCHOOL_PLACE_TYPES` |
| `const SCHOOL_NAME_TERMS = ...` | `app.js:581` | `SCHOOL_NAME_TERMS` |
| `const CUSTOM_DEST_ICONS = {...}` | `app.js:1258` | `CUSTOM_DEST_ICONS` |
| `const ERROR_ICONS = {...}` | `app.js:1576` | `ERROR_ICONS` |
| `STATE_ABBRS` Set | `app.js:776` | remove — now only used by `toTitleCase` inside `text.js` |

Verify after each: `node src/app.js` starts without errors.

### Step 2.4 — Replace magic numbers with named constants in `app.js`

These are inline literals inside function bodies, not module-level declarations. They can be replaced without redeclaration risk.

| Replace | Location | With |
|---------|----------|------|
| `8000` (grocery radius fallback) | `app.js:221` | `GROCERY_SEARCH_RADIUS_M` |
| `['gas_station', ...]` (grocery excluded types) | `app.js:226–229` | `GROCERY_EXCLUDED_TYPES` |
| `8` (grocery candidates) | `app.js:237` | `GROCERY_CANDIDATE_COUNT` |
| `50000` (hospital radius) | `app.js:303` | `HOSPITAL_SEARCH_RADIUS_M` |
| `50000` (hospital radius, second occurrence) | `app.js:389` | `HOSPITAL_SEARCH_RADIUS_M` |
| `5` (hospital candidates) | `app.js:325` | `HOSPITAL_CANDIDATE_COUNT` |
| `5` (coffee shop candidates) | `app.js:710` | `COFFEE_SHOP_CANDIDATE_COUNT` |
| `15000` (elementary school radius) | `app.js:747` | `ELEMENTARY_SCHOOL_SEARCH_RADIUS_M` |
| `['preschool', ...]` (elementary exclusions) | `app.js:741` | `ELEMENTARY_SCHOOL_EXCLUSIONS` |
| `20` (highway minute threshold) | `app.js:499` | `HIGHWAY_MAX_DRIVE_MINUTES` |
| `50` (highway interchange fallback) | `app.js:504` | `HIGHWAY_INTERCHANGE_MAX_MINUTES` |
| `const interstates = ['I-5', ...]` (59-entry inline array) | `app.js:432–439` | `INTERSTATE_LIST` |
| Traffic variation time slots | `app.js:113–116` | `TRAFFIC_VARIATION_SLOTS` |

**Note on `INTERSTATE_LIST`:** This is declared with `const` inside a function body, not at module level. Delete the local `const interstates = [...]` declaration and replace the usage with `INTERSTATE_LIST`. This is not a redeclaration conflict because it's function-scoped.

Verify after this group: `node src/app.js` starts without errors.

### Stage 2 Checkpoint — Test Georgetown + Harlan

After all `app.js` changes are complete:

```
# Start server and generate reports for:
# 1. Georgetown KY — standard report (suburban)
# 2. Harlan KY — standard report (rural/remote)
```

Georgetown report: All chapters render. Drive times present. No console errors.
Harlan report: Renders with rural framing. No console errors.

If either report fails, stop. Do not continue to Stage 3. See rollback procedures.

---

## Stage 3 — Wire `premium.js`: Text utilities and `escapeHtml` migration

**Risk level: High.** This stage contains the 50+ `esc(` rename operation. It is the highest-risk change in the entire plan and must be done carefully.

### Step 3.1 — Add import block to top of `premium.js`

Add the require block from `spec.md` near the top of `premium.js`, after existing requires. Import only the text utilities and geo utility for now — constants come in Stage 4.

```js
const { haversineDistance } = require('./utils/geo');
const { escapeHtml, formatMoney } = require('./utils/text');
```

Do not yet add constants imports. Do not yet remove any inline definitions.

Verify: `node -e "require('./src/premium.js')"` must not throw.

### Step 3.2 — Count and document `esc(` occurrences

Before touching a single `esc(` call site, run:

```
grep -n "\besc(" src/premium.js
```

Record the exact line numbers and count. This is the change manifest — every line on this list must be renamed. Keep this list open during the next step.

### Step 3.3 — Replace `esc(` with `escapeHtml(` throughout `premium.js`

This is a **find-and-replace-all** operation, not a manual edit. Use a single automated substitution to rename all call sites simultaneously:

- Find: `\besc(` (word-boundary-anchored to avoid matching `escape(` or other words)
- Replace: `escapeHtml(`
- Scope: `src/premium.js` only

After replacement:

```
grep -n "\besc(" src/premium.js
```

Must return **zero results**. If any remain, find and fix them before proceeding. Do not proceed past this step with any remaining `esc(` calls.

Also verify no false replacements:
```
grep -n "escapeHtmlape\|escapeHtmlaped\|escapeHtmlaping" src/premium.js
```
Must return zero (this would catch if `escape(` or `escaped` was wrongly matched).

### Step 3.4 — Remove inline `esc` function definition from `premium.js`

Delete `function esc(str)` at `premium.js:24` (or wherever it now is after the import addition).

Verify: `node -e "require('./src/premium.js')"` must not throw.

### Step 3.5 — Remove inline `haversineDistance` from `premium.js`

Delete `function haversineDistance(lat1, lng1, lat2, lng2)` at `premium.js:9–22`.

Verify: `node -e "require('./src/premium.js')"` must not throw.

### Step 3.6 — Remove inline `formatMoney` from `premium.js`

Delete `function formatMoney(n)` at `premium.js:30–37`.

Verify: `node -e "require('./src/premium.js')"` must not throw.

### Stage 3 Checkpoint — Georgetown Premium Report

After all Stage 3 changes:

```
# Generate Georgetown premium report
# 100 Wishing Well Path Unit 2306, Georgetown, KY 40324
```

Every premium chapter must render. Pay specific attention to chapters that use `escapeHtml` (formerly `esc`) extensively — property costs, community data, garden chapter. No console errors. No missing data.

If the report fails, see rollback procedures. Do not continue to Stage 4.

---

## Stage 4 — Wire `premium.js`: Constants migration

**Risk level: Medium.** Removing large data blocks. Done in groups, verified after each.

### Step 4.0 — Add constants import block to `premium.js`

Add the full constants import from `spec.md` to the top of `premium.js`, after the text/geo imports added in Stage 3. Import all constants from the spec at once — this is safe because none of them are module-level `const` declarations that would conflict (we verify that assumption in Step 4.1).

```js
const {
  STATE_TAX_RATES, STATE_INSURANCE_ANNUAL, STATE_UTILITIES_MONTHLY,
  STATE_HOMESTEAD, STATE_EXTENSION,
  TORNADO_TIER,
  RADON_ZONE_BY_STATE,
  FROST_DATE_TABLE,
  NATIVE_PLANT_EXCLUDE, NATIVE_PLANT_EXCLUDE_NAMES,
  BENIGN_INTRODUCED, DOMESTIC_MAMMALS,
  OVERPASS_ENDPOINTS,
  NON_AIRPORT_RE, AIRPORT_RE,
  AIRPORT_SEARCH_RADIUS_M, AIRPORT_MAX_DISTANCE_MILES,
  WALKABILITY_SEARCH_RADIUS_M, WALK_TYPES,
  DEVELOPMENT_ACTIVITY_SEARCH_RADIUS_M, COMMERCIAL_DEV_TYPES,
  RESPONSE_SPEED_MPH, RESPONSE_DISPATCH_MINUTES, RESPONSE_TIME_THRESHOLDS,
  AQI_THRESHOLDS,
  DNL_THRESHOLDS, HIGHWAY_NOISE_ESTIMATE,
  BORTLE_SCALE,
  FEMA_FLOOD_ZONES,
  BROADBAND_TECH_CODES,
  OSM_ROAD_NOISE_RADIUS_M, OSM_RAIL_RADIUS_M, OSM_LANDUSE_RADIUS_M,
  WATER_QUALITY_SEARCH_RADIUS_MILES,
  INAT_NATIVE_PLANTS_RADIUS_KM, INAT_INVASIVE_PLANTS_RADIUS_KM,
  INAT_WILDLIFE_RADIUS_KM, INAT_BIRDS_RADIUS_KM,
  INAT_NATIVE_PLANTS_PER_PAGE, INAT_INVASIVE_PLANTS_PER_PAGE,
  INAT_WILDLIFE_PER_PAGE, INAT_BIRDS_PER_PAGE,
  GROCERY_SEARCH_RADIUS_M,
} = require('./utils/constants');
```

Verify: `node -e "require('./src/premium.js')"` must not throw. A redeclaration error at this point means one of the listed names is declared as a module-level `const` in premium.js — resolve by identifying the conflict and adjusting the order of operations (remove inline first, then add to import).

### Step 4.1 — Remove STATE_* financial tables (Group A)

Remove from `premium.js`:
- `STATE_TAX_RATES` object (line ~217)
- `STATE_INSURANCE_ANNUAL` object (line ~227)
- `STATE_UTILITIES_MONTHLY` object (line ~237)
- `STATE_HOMESTEAD` object (line ~247)

These are all declared in the same area of the file. Remove all four as a group.

Verify: `node -e "require('./src/premium.js')"` must not throw.

**Spot-check:** `grep -n "STATE_TAX_RATES\|STATE_INSURANCE" src/premium.js` — should find only usage sites (references), not definition sites.

### Step 4.2 — Remove wildlife filter lists (Group B)

Remove from `premium.js`:
- `NATIVE_PLANT_EXCLUDE` Set (line ~1167)
- `NATIVE_PLANT_EXCLUDE_NAMES` array (line ~1172)
- `BENIGN_INTRODUCED` Set (line ~1178)
- `DOMESTIC_MAMMALS` Set (line ~1192)

Verify: server starts.

### Step 4.3 — Remove FROST_DATE_TABLE (Group C)

Remove from `premium.js`:
- `FROST_DATE_TABLE` object (line ~1130)

This is a 26-entry object. Remove cleanly — no partial removal.

Verify: server starts.

**Spot-check:** `grep -n "FROST_DATE_TABLE" src/premium.js` — should return only usage sites.

### Step 4.4 — Remove risk tables (Group D)

Remove from `premium.js`:
- `TORNADO_TIER` IIFE (line ~491) — the state arrays. Note: the IIFE may wrap some logic. Remove only the data; the function that uses it should now reference the imported `TORNADO_TIER` constant.
- `RADON_ZONE_BY_STATE` object (line ~876)

Verify: server starts.

### Step 4.5 — Remove environmental threshold tables (Group E)

Remove from `premium.js` the inline definitions for:
- AQI category breakpoints (line ~451–457)
- DNL breakpoints (line ~733–739)
- Bortle scale thresholds (lines ~791–813) — this may be split between `estimateBortle` and `getBortleDescription`. Replace both inline arrays/objects with the single `BORTLE_SCALE` constant.
- Flood zone map (line ~475–487)
- Highway noise estimate breakpoints (line ~418–419)

Verify: server starts. Run Georgetown premium report — environmental chapters (sensory/noise, flood, air quality) must render correctly.

### Step 4.6 — Remove infrastructure constants (Group F)

Remove from `premium.js`:
- `OVERPASS_ENDPOINTS` (line ~677)
- `NON_AIRPORT_RE` (line ~633)
- `AIRPORT_RE` (line ~635)
- `BROADBAND_TECH_CODES` (line ~1627)
- `STATE_EXTENSION` (line ~1197)

Verify: server starts.

### Step 4.7 — Remove operational constants (Group G)

Remove from `premium.js`:
- `WALK_TYPES` (line ~291)
- `COMMERCIAL_DEV_TYPES` (line ~1074)
- Response speed/dispatch/threshold values (lines ~384–391)
- All inline search radius magic numbers and candidate counts (airport, walkability, iNat radii, water quality)

For magic numbers inside function bodies (not declared as module-level `const`): replace the literal value with the imported constant name.

Verify: server starts. Run Georgetown premium report — walkability, development, health response chapters must render.

### Stage 4 Checkpoint — Full Premium Report + Bozeman

```
# Generate reports for:
# 1. Georgetown KY — premium report — all chapters
# 2. Bozeman MT — premium report — garden/nature chapters especially
```

Georgetown: All chapters render. Property costs, walkability, development, sensory chapters all present and correct.
Bozeman: All chapters render. Native plants, hardiness zone, frost dates, wildlife must render with Montana-specific data.

If either fails, see rollback procedures.

---

## Stage 5 — Wire `development-discovery.js`

**Risk level: Low.** Small file, isolated changes.

### Step 5.1 — Add import to `development-discovery.js`

```js
const {
  DEV_CACHE_TTL_MS,
  DEV_REQUEST_DELAY_MS,
  DEV_MAX_ARTICLE_AGE,
  DEV_TYPE_MAP,
  DEV_STATUS_MAP,
} = require('./utils/constants');
```

### Step 5.2 — Remove inline constant definitions

Remove from `development-discovery.js`:
- `CACHE_TTL_MS` at line ~15 — replace usages with `DEV_CACHE_TTL_MS`
- `REQUEST_DELAY_MS` at line ~16 — replace usages with `DEV_REQUEST_DELAY_MS`
- `MAX_ARTICLE_AGE` at line ~17 — replace usages with `DEV_MAX_ARTICLE_AGE`
- `TYPE_MAP` at line ~24 — replace usages with `DEV_TYPE_MAP`
- `STATUS_MAP` at line ~75 — replace usages with `DEV_STATUS_MAP`

Note: the renamed constants use a `DEV_` prefix in constants.js. Rename the usage sites in development-discovery.js to match.

Verify: `node -e "require('./src/development-discovery.js')"` must not throw.

### Stage 5 Checkpoint

`node src/app.js` starts without errors.

---

## Stage 6 — Final Verification

### Step 6.1 — Structural grep checks

Run all of these. Every one must pass:

```bash
# 1. Interstate list no longer inline
grep -r "const interstates = \[" src/
# Expected: zero results

# 2. escapeHtml defined in exactly one place
grep -rn "function escapeHtml\|const escapeHtml" src/
# Expected: exactly one result — src/utils/text.js

# 3. esc() completely gone
grep -n "\besc(" src/premium.js
# Expected: zero results

# 4. No inline esc function
grep -rn "function esc\b" src/
# Expected: zero results

# 5. No magic 8000 for grocery radius
grep -n "searchRadiusM, 8000\|= 8000" src/app.js
# Expected: zero results (the getMitigation call now uses GROCERY_SEARCH_RADIUS_M)

# 6. utils/ files exist
ls src/utils/
# Expected: constants.js  geo.js  state.js  text.js  time.js
```

### Step 6.2 — Module integrity checks

```bash
node -e "require('./src/utils/constants')" && echo "constants OK"
node -e "require('./src/utils/text')"      && echo "text OK"
node -e "require('./src/utils/geo')"       && echo "geo OK"
node -e "require('./src/utils/time')"      && echo "time OK"
node -e "require('./src/utils/state')"     && echo "state OK"
```

All five must print their OK message.

### Step 6.3 — Test all five addresses

Generate a report (standard or premium as appropriate) for every test address:

| Address | Report type | What to check |
|---------|-------------|---------------|
| `100 Wishing Well Path Unit 2306, Georgetown, KY 40324` | Both | All chapters present, no console errors, drive times correct |
| `456 Rural Route 1, Harlan, KY 40831` | Standard | Rural framing renders, no errors |
| `123 Main St, Louisville, KY 40202` | Standard | Urban report renders, no errors |
| `789 Main St, Bozeman, MT 59715` | Premium | Garden chapter has MT-specific data, frost dates render |
| `1007 Stonelilly Dr, Jeffersonville, IN 47130` | Standard | IN state boundary filter active, no KY school cross-contamination |

No address may produce a console error. No chapter may be missing data it previously had.

### Step 6.4 — Commit

Only after all 5 addresses pass:

```
git add src/utils/
git add src/app.js src/premium.js src/development-discovery.js
git status  # verify no unintended files staged
git commit -m "refactor(FR-036): extract utils and constants from app.js and premium.js

Creates src/utils/ (time.js, text.js, geo.js, state.js, constants.js).
Consolidates escapeHtml/esc into one canonical function.
Moves 59-entry interstate list, 72+ constants to named exports.
Zero behavior changes — same inputs produce same outputs."
git push
```

---

## Rollback Procedures

### If Stage 1 fails (utils/ files created but something wrong)

```
git checkout -- src/
rm -rf src/utils/
```

The server was never changed. State is identical to before Stage 1.

### If Stage 2 or 3 fails mid-way (app.js or premium.js partially changed)

```
git stash
```

This restores `app.js` and `premium.js` to their pre-Stage state. The `src/utils/` files remain — they are new files not in git and are not affected by stash. Resume from the beginning of the stage that failed after diagnosing the cause.

Alternatively, to see exactly which lines changed:
```
git diff src/app.js
git diff src/premium.js
```

### If a report generates wrong data after a stage

1. Stop immediately. Do not continue to the next stage.
2. `git diff src/app.js` (or premium.js) to see exactly what changed.
3. Identify whether the wrong output is from a constant value being wrong in constants.js, or from a call site using the wrong constant name.
4. Fix in constants.js or the call site, not by reverting.
5. Re-verify the failing report before continuing.

### If `esc(` rename produces a wrong output in premium.js

This would mean `esc` was not always the HTML-escape function, or a variable named `esc` was renamed. Check the grep output from Step 3.2 (the before-state list) against the actual output to find what was renamed incorrectly.

### Nuclear option — full reset

If multiple stages are partially done and the state is unclear:

```
git checkout -- src/app.js src/premium.js src/development-discovery.js
rm -rf src/utils/
```

This returns to a completely clean state. The utils/ files must be recreated from scratch. Use only if `git stash` and selective checkout are not sufficient.

---

## Sequencing Rules

These rules prevent the most likely mistakes:

1. **Never remove an inline definition before its import is in place.** If the inline is gone and the import hasn't been added yet, every caller will get `undefined` and the server will start but produce corrupted reports — which is worse than a startup error.

2. **Never add a `const X = require(...)` import for a name that still has an inline `const X = ...` at module level in the same file.** Node throws a redeclaration error immediately. This is a feature, not a bug — it forces you to do the removal and import atomically.

3. **Never batch multiple stages together.** Each stage has an independent checkpoint. Batching prevents identifying which change introduced a regression.

4. **Never use `grep -r` across all of `src/` to verify stage completion — it will find the definitions in `utils/`.** Always scope grep checks to the specific source file being migrated (e.g., `grep -n "\besc(" src/premium.js`).

5. **Do the `esc(` rename before removing the `esc` function definition.** If you delete the function first, the server fails before you have a chance to verify the rename worked.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `esc(` matched inside a string literal or comment | Low | Low | The word-boundary regex `\besc(` anchors on the function call pattern. Review matches before replacing. |
| Module-level `const` in premium.js conflicts with import | Medium | Low | Server throws a clear redeclaration error on startup. Fix by removing inline before adding to import. |
| `TORNADO_TIER` IIFE contains logic mixed with data | Medium | Medium | Inspect the IIFE carefully before removing. Extract only the state arrays; leave any logic in place and reference the imported constant. |
| `BORTLE_SCALE` is split across two functions | Medium | Low | Consolidate into a single `BORTLE_SCALE` array in constants.js; both functions reference the same import. |
| Value copied from source to constants.js with a typo | Low | High | Spot-check critical constants (STATE_TAX_RATES, INTERSTATE_LIST) with node one-liners after Stage 1. |
| Report regression not caught until final verification | Medium | Medium | The per-stage checkpoints catch regressions early. Georgetown runs after Stage 2 and Stage 3; all 5 addresses run in Step 6.3. |
