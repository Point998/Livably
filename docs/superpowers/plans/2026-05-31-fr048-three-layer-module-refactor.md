# FR-048 Three-Layer Module Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every module a `data.js` (API fetch only), `logic.js` (business rule transforms), and `template.js` (HTML generation). Delete `src/templates/chapters/`. No behavior change.

**Architecture:** Pure structural refactor. Each task: (1) create `logic.js` extracting transforms from `data.js`, (2) move template to `src/modules/<module>/template.js`, (3) update imports in `data.js`, `chapters.js`, and test files, (4) verify tests pass.

**Tech Stack:** Node.js, Jest (`npm test`)

**Spec:** `feature-requests/FR-048-three-layer-module-refactor/spec.md`

**Execution order:** Simple modules first (walkability → health → schools → safety → growth → property → reachability → access → sensory → community → garden → climate). Cleanup last.

**Critical rule for every task:** After each module refactor, run `npm test --no-coverage` and verify all tests pass before committing. Never leave tests broken between tasks.

---

## Task 1: walkability module

**Files:**
- Create: `src/modules/walkability/logic.js`
- Move/rename: `src/templates/chapters/walkability.js` → `src/modules/walkability/template.js`
- Modify: `src/modules/walkability/data.js` (update import of getWalkCategory)
- Modify: `src/chapters.js` (update import path)
- Move: `tests/templates/chapters/walkability.test.js` → `tests/modules/walkability/template.test.js`

- [ ] **Step 1: Create `src/modules/walkability/logic.js`**

Read `src/modules/walkability/data.js`. Find `getWalkCategory` (a classifier that takes a walk score and returns a category label). Move it to a new file:

```js
'use strict';

function getWalkCategory(score) {
  // copy exact implementation from data.js
}

module.exports = { getWalkCategory };
```

- [ ] **Step 2: Update `src/modules/walkability/data.js`**

Add at top: `const { getWalkCategory } = require('./logic');`
Remove the `getWalkCategory` function body.
Update `module.exports` to remove `getWalkCategory` (it's no longer defined here).

- [ ] **Step 3: Create `src/modules/walkability/template.js`**

Copy the full content of `src/templates/chapters/walkability.js` to `src/modules/walkability/template.js`. Do not delete the original yet.

- [ ] **Step 4: Update `src/chapters.js`**

Find: `const { buildWalkabilityHTML } = require('./templates/chapters/walkability');`
Replace: `const { buildWalkabilityHTML, buildWalkGlanceHTML } = require('./modules/walkability/template');`

(Check what functions chapters.js actually uses from walkability — include all of them)

- [ ] **Step 5: Move test file**

Copy `tests/templates/chapters/walkability.test.js` to `tests/modules/walkability/template.test.js`.
Update the require path inside the new file from `../../../src/templates/chapters/walkability` to `../../../src/modules/walkability/template`.

If `tests/modules/walkability/data.test.js` exists and tests `getWalkCategory`, move that test to a new `tests/modules/walkability/logic.test.js`.

- [ ] **Step 6: Run tests**

```
npm test --no-coverage
```

Expected: all tests pass. If any fail, fix before committing.

- [ ] **Step 7: Delete old template file and commit**

```
git rm src/templates/chapters/walkability.js
git rm tests/templates/chapters/walkability.test.js
git add src/modules/walkability/
git add tests/modules/walkability/
git add src/chapters.js
git commit -m "refactor(fr-048): walkability — extract logic.js, co-locate template.js"
```

---

## Task 2: health module

**Files:**
- Create: `src/modules/health/logic.js`
- Create: `src/modules/health/template.js` (from templates/chapters/health.js)
- Modify: `src/modules/health/data.js`
- Modify: `src/chapters.js`
- Move: `tests/templates/chapters/health.test.js` → `tests/modules/health/template.test.js`

- [ ] **Step 1: Create `src/modules/health/logic.js`**

Read `src/modules/health/data.js`. Find `isRetailEmbeddedHealth` (filters retail-embedded clinics from urgent care results). Move to logic.js:

```js
'use strict';

function isRetailEmbeddedHealth(place) {
  // copy exact implementation
}

module.exports = { isRetailEmbeddedHealth };
```

- [ ] **Step 2: Update `src/modules/health/data.js`**

Add: `const { isRetailEmbeddedHealth } = require('./logic');`
Remove `isRetailEmbeddedHealth` function body.

- [ ] **Step 3: Create `src/modules/health/template.js`**

Copy full content of `src/templates/chapters/health.js` → `src/modules/health/template.js`.

- [ ] **Step 4: Update `src/chapters.js`**

Update health template import to use `./modules/health/template`.

- [ ] **Step 5: Move test file**

Move `tests/templates/chapters/health.test.js` → `tests/modules/health/template.test.js`. Update require path.

- [ ] **Step 6: Run tests, delete old files, commit**

```
npm test --no-coverage
git rm src/templates/chapters/health.js
git rm tests/templates/chapters/health.test.js
git add src/modules/health/ tests/modules/health/ src/chapters.js
git commit -m "refactor(fr-048): health — extract logic.js, co-locate template.js"
```

---

## Task 3: schools module

**Files:**
- Create: `src/modules/schools/logic.js`
- Create: `src/modules/schools/template.js`
- Modify: `src/modules/schools/data.js`
- Modify: `src/chapters.js`
- Move: `tests/templates/chapters/schools.test.js` → `tests/modules/schools/template.test.js`

- [ ] **Step 1: Create `src/modules/schools/logic.js`**

Read `data.js`. Find `isExcludedPlaceName` and `isValidSchoolPlace`. Move both:

```js
'use strict';

function isExcludedPlaceName(name) { /* copy */ }
function isValidSchoolPlace(place) { /* copy */ }

module.exports = { isExcludedPlaceName, isValidSchoolPlace };
```

- [ ] **Step 2: Update `data.js`**, add logic import, remove moved functions.

- [ ] **Step 3: Create `template.js`** from `src/templates/chapters/schools.js`.

- [ ] **Step 4: Update `src/chapters.js`** import.

- [ ] **Step 5: Move test file**, update require path.

- [ ] **Step 6: Run tests, delete old files, commit**

```
npm test --no-coverage
git rm src/templates/chapters/schools.js tests/templates/chapters/schools.test.js
git add src/modules/schools/ tests/modules/schools/ src/chapters.js
git commit -m "refactor(fr-048): schools — extract logic.js, co-locate template.js"
```

---

## Task 4: safety module

**Files:**
- Create: `src/modules/safety/logic.js`
- Create: `src/modules/safety/template.js`
- Modify: `src/modules/safety/data.js`
- Modify: `src/chapters.js`
- Move: `tests/templates/chapters/safety.test.js` → `tests/modules/safety/template.test.js`

- [ ] **Step 1: Create `src/modules/safety/logic.js`**

Read `data.js`. Move `normalizeStationName`, `estimateResponseTime`, `getSafetyLocationContext`:

```js
'use strict';

function normalizeStationName(name) { /* copy */ }
function estimateResponseTime(driveTimeMinutes) { /* copy */ }
function getSafetyLocationContext(locationInfo) { /* copy */ }

module.exports = { normalizeStationName, estimateResponseTime, getSafetyLocationContext };
```

- [ ] **Step 2: Update `data.js`**, add logic import, remove moved functions.

- [ ] **Step 3: Create `template.js`** from `src/templates/chapters/safety.js`.

- [ ] **Step 4: Update `src/chapters.js`** import.

- [ ] **Step 5: Move test file**, update require path.

- [ ] **Step 6: Check if `getSafetyLocationContext` is imported anywhere outside safety** — if so, update those imports to use `./modules/safety/logic`.

- [ ] **Step 7: Run tests, delete old files, commit**

```
npm test --no-coverage
git rm src/templates/chapters/safety.js tests/templates/chapters/safety.test.js
git add src/modules/safety/ tests/modules/safety/ src/chapters.js
git commit -m "refactor(fr-048): safety — extract logic.js, co-locate template.js"
```

---

## Task 5: growth module

**Files:**
- Create: `src/modules/growth/logic.js`
- Create: `src/modules/growth/template.js`
- Modify: `src/modules/growth/data.js`
- Modify: `src/chapters.js`
- Move: `tests/templates/chapters/growth.test.js` → `tests/modules/growth/template.test.js`

- [ ] **Step 1: Create `src/modules/growth/logic.js`**

Read `data.js`. Extract permit trend classification logic — the inline logic that determines 'rising'/'declining'/'stable' based on permit counts, and percentage calculations. Create named helpers:

```js
'use strict';

function classifyPermitTrend(recentAvg, olderAvg) {
  // extract the trend classification logic from getBuildingPermitTrend
  // returns 'rising' | 'declining' | 'stable'
}

function calcPermitChangePct(recentAvg, olderAvg) {
  // extract percentage change calculation
}

module.exports = { classifyPermitTrend, calcPermitChangePct };
```

- [ ] **Step 2: Update `data.js`**, call the extracted functions instead of inline logic.

- [ ] **Step 3: Create `template.js`** from `src/templates/chapters/growth.js`.

- [ ] **Step 4: Update `src/chapters.js`** import.

- [ ] **Step 5: Move test file**, update require path.

- [ ] **Step 6: Write tests for `classifyPermitTrend` and `calcPermitChangePct` in `tests/modules/growth/logic.test.js`**

```js
const { classifyPermitTrend, calcPermitChangePct } = require('../../../src/modules/growth/logic');

describe('classifyPermitTrend', () => {
  test('rising when recent avg significantly exceeds older avg', () => {
    expect(classifyPermitTrend(120, 80)).toBe('rising');
  });
  test('declining when recent avg significantly below older avg', () => {
    expect(classifyPermitTrend(60, 100)).toBe('declining');
  });
  test('stable when averages are close', () => {
    expect(classifyPermitTrend(100, 100)).toBe('stable');
  });
});
```

Adjust thresholds to match the actual implementation.

- [ ] **Step 7: Run tests, delete old files, commit**

```
npm test --no-coverage
git rm src/templates/chapters/growth.js tests/templates/chapters/growth.test.js
git add src/modules/growth/ tests/modules/growth/ src/chapters.js
git commit -m "refactor(fr-048): growth — extract logic.js, co-locate template.js"
```

---

## Task 6: property module

**Files:**
- Create: `src/modules/property/logic.js`
- Create: `src/modules/property/template.js`
- Modify: `src/modules/property/data.js`
- Modify: `src/chapters.js`
- Move: `tests/templates/chapters/property.test.js` → `tests/modules/property/template.test.js`

- [ ] **Step 1: Create `src/modules/property/logic.js`**

Extract `getDrainageCategory`, `getBroadbandCategory`, `getConstructionEraContext`:

```js
'use strict';

function getDrainageCategory(drainageClass) { /* copy */ }
function getBroadbandCategory(downloadMbps) { /* copy */ }
function getConstructionEraContext(medianYearBuilt) { /* copy */ }

module.exports = { getDrainageCategory, getBroadbandCategory, getConstructionEraContext };
```

- [ ] **Step 2: Update `src/modules/property/data.js`**

Change: `const { getDensityType } = require('../community/data');`
To: `const { getDensityType } = require('../community/logic');`

Add: `const { getDrainageCategory, getBroadbandCategory, getConstructionEraContext } = require('./logic');`
Remove the three moved functions.

- [ ] **Step 3: Create `template.js`** from `src/templates/chapters/property.js`.

- [ ] **Step 4: Update `src/chapters.js`** import.

- [ ] **Step 5: Move test file**, update require path.

- [ ] **Step 6: Run tests, delete old files, commit**

```
npm test --no-coverage
git rm src/templates/chapters/property.js tests/templates/chapters/property.test.js
git add src/modules/property/ tests/modules/property/ src/chapters.js
git commit -m "refactor(fr-048): property — extract logic.js, co-locate template.js"
```

---

## Task 7: reachability module

**Files:**
- Create: `src/modules/reachability/logic.js`
- Create: `src/modules/reachability/template.js`
- Modify: `src/modules/reachability/data.js`
- Modify: `src/chapters.js`
- Move: `tests/templates/chapters/reachability.test.js` → `tests/modules/reachability/template.test.js`

- [ ] **Step 1: Create `src/modules/reachability/logic.js`**

Extract the grocery type exclusion predicate:

```js
'use strict';
const { GROCERY_EXCLUDED_TYPES } = require('../../utils/constants');

function isExcludedGroceryType(place) {
  const types = place.types || [];
  return GROCERY_EXCLUDED_TYPES.some((t) => types.includes(t));
}

module.exports = { isExcludedGroceryType };
```

- [ ] **Step 2: Update `data.js`**: import `isExcludedGroceryType`, replace inline filter.

- [ ] **Step 3: Create `template.js`** from `src/templates/chapters/reachability.js`.

- [ ] **Step 4: Update `src/chapters.js`**: Update reachability template import.

Note: `src/templates/pages/reportPage.js` imports from `src/templates/chapters/reachability` — update that import too.

- [ ] **Step 5: Move test file**, update require path.

- [ ] **Step 6: Run tests, delete old files, commit**

```
npm test --no-coverage
git rm src/templates/chapters/reachability.js tests/templates/chapters/reachability.test.js
git add src/modules/reachability/ tests/modules/reachability/ src/chapters.js src/templates/pages/reportPage.js
git commit -m "refactor(fr-048): reachability — extract logic.js, co-locate template.js"
```

---

## Task 8: access module

**Files:**
- Create: `src/modules/access/logic.js`
- Modify: `src/modules/access/data.js`
- (No template.js — access has no chapter template)

- [ ] **Step 1: Create `src/modules/access/logic.js`**

Read `data.js`. Extract highway name validation and filtering helpers:

```js
'use strict';

function isValidHighwayName(addressComponents, highwayNames) {
  // extract from findNearestHighwayOnRamp — the logic that checks if address components
  // match known interstate names
}

module.exports = { isValidHighwayName };
```

Extract any other named inline helper logic inside `findNearestHighwayOnRamp` into named functions.

- [ ] **Step 2: Update `data.js`**: import and call extracted helpers.

- [ ] **Step 3: Write `tests/modules/access/logic.test.js`** with at least one test per exported function.

- [ ] **Step 4: Run tests, commit**

```
npm test --no-coverage
git add src/modules/access/ tests/modules/access/
git commit -m "refactor(fr-048): access — extract logic.js"
```

---

## Task 9: sensory module

**Files:**
- Create: `src/modules/sensory/logic.js`
- Create: `src/modules/sensory/template.js`
- Modify: `src/modules/sensory/data.js`
- Modify: `src/chapters.js`
- Move: `tests/templates/chapters/sensory.test.js` → `tests/modules/sensory/template.test.js`

- [ ] **Step 1: Create `src/modules/sensory/logic.js`**

Move `getAQICategory`, `interpretFloodZone`, `estimateDNLFromRoad`, `getDNLCategory`, `estimateBortle`, `getBortleDescription`, `getRadonZone`:

```js
'use strict';

function getAQICategory(aqi) { /* copy */ }
function interpretFloodZone(zoneCode) { /* copy */ }
function estimateDNLFromRoad(roadClass, distanceMeters) { /* copy */ }
function getDNLCategory(dnl) { /* copy */ }
function estimateBortle(tractPop, landuseTypes) { /* copy */ }
function getBortleDescription(bortle) { /* copy */ }
function getRadonZone(state) { /* copy */ }

module.exports = { getAQICategory, interpretFloodZone, estimateDNLFromRoad, getDNLCategory, estimateBortle, getBortleDescription, getRadonZone };
```

- [ ] **Step 2: Update `data.js`**: add logic import, remove moved functions.

- [ ] **Step 3: Write `tests/modules/sensory/logic.test.js`**

```js
const { getAQICategory, interpretFloodZone, getDNLCategory, getRadonZone } = require('../../../src/modules/sensory/logic');

describe('getAQICategory', () => {
  test('Good for AQI 0-50', () => expect(getAQICategory(25)).toMatch(/good/i));
  test('Unhealthy for AQI 151-200', () => expect(getAQICategory(160)).toMatch(/unhealthy/i));
});

describe('interpretFloodZone', () => {
  test('AE zone returns high-risk description', () => expect(interpretFloodZone('AE')).toBeTruthy());
  test('X zone returns minimal risk', () => expect(interpretFloodZone('X')).toBeTruthy());
});

describe('getDNLCategory', () => {
  test('above 65 dB is significant', () => expect(getDNLCategory(70)).toMatch(/significant|loud|high/i));
});

describe('getRadonZone', () => {
  test('KY returns a zone value', () => expect(getRadonZone('KY')).toBeTruthy());
  test('unknown state returns fallback', () => expect(getRadonZone('XX')).toBeTruthy());
});
```

Adjust test values to match actual implementation.

- [ ] **Step 4: Create `template.js`** from `src/templates/chapters/sensory.js`.

- [ ] **Step 5: Update `src/chapters.js`** import.

- [ ] **Step 6: Move test file**, update require path.

- [ ] **Step 7: Run tests, delete old files, commit**

```
npm test --no-coverage
git rm src/templates/chapters/sensory.js tests/templates/chapters/sensory.test.js
git add src/modules/sensory/ tests/modules/sensory/ src/chapters.js
git commit -m "refactor(fr-048): sensory — extract logic.js, co-locate template.js"
```

---

## Task 10: community module

**Files:**
- Create: `src/modules/community/logic.js`
- Create: `src/modules/community/template.js`
- Modify: `src/modules/community/data.js`
- Modify: `src/chapters.js`
- Split: `tests/modules/community/data.test.js` → keep data tests, move logic tests to `tests/modules/community/logic.test.js`
- Move: `tests/templates/chapters/community.test.js` → `tests/modules/community/template.test.js`

- [ ] **Step 1: Create `src/modules/community/logic.js`**

Move `getIncomeLevel`, `getEducationLevel`, `getDensityType`, `getCommunityType`, `suppressed`, `groupIncomeBrackets`, `buildEducationLadder`, `buildHouseholdComposition`, `buildCommuteMode`, `buildTractFips`.

Export all of them.

- [ ] **Step 2: Update `src/modules/community/data.js`**

Add: `const { getIncomeLevel, getEducationLevel, getDensityType, getCommunityType, suppressed, groupIncomeBrackets, buildEducationLadder, buildHouseholdComposition, buildCommuteMode, buildTractFips } = require('./logic');`

Remove all moved functions from `data.js`.

Update `module.exports` to remove functions that are no longer defined in `data.js`. Ensure `getDemographics` still exports (it stays).

- [ ] **Step 3: Create `tests/modules/community/logic.test.js`**

Move the `describe('suppressed', ...)`, `describe('groupIncomeBrackets', ...)`, `describe('buildEducationLadder', ...)`, `describe('buildHouseholdComposition', ...)`, `describe('buildCommuteMode', ...)`, `describe('buildTractFips', ...)`, `describe('getIncomeLevel', ...)`, `describe('getEducationLevel', ...)`, `describe('getDensityType', ...)`, `describe('getCommunityType', ...)` blocks from `data.test.js` to `logic.test.js`.

Update the require in `logic.test.js` to import from `../../../src/modules/community/logic`.

- [ ] **Step 4: Update `tests/modules/community/data.test.js`**

Keep only the `describe('getDemographics', ...)` block. Update the require to import only `{ getDemographics }` from `data.js`. Remove the `buildFullMockMap` helper if it's only needed for the logic tests (check if it's also used in getDemographics tests — if so, keep it or move it to a shared test helper).

- [ ] **Step 5: Create `template.js`** from `src/templates/chapters/community.js`.

- [ ] **Step 6: Update `src/chapters.js`** import.

- [ ] **Step 7: Move template test file** → `tests/modules/community/template.test.js`. Update require path.

- [ ] **Step 8: Update `src/modules/property/data.js`** — it imports `getDensityType` from `../community/data`. Change to `../community/logic`.

- [ ] **Step 9: Run tests, delete old files, commit**

```
npm test --no-coverage
git rm src/templates/chapters/community.js tests/templates/chapters/community.test.js
git add src/modules/community/ tests/modules/community/ src/chapters.js src/modules/property/data.js
git commit -m "refactor(fr-048): community — extract logic.js, co-locate template.js"
```

---

## Task 11: garden module

**Files:**
- Create: `src/modules/garden/logic.js`
- Create: `src/modules/garden/template.js`
- Modify: `src/modules/garden/data.js`
- Modify: `src/chapters.js` (update imports + remove re-exports of filter functions)
- Move: `tests/templates/chapters/garden.test.js` → `tests/modules/garden/template.test.js`

- [ ] **Step 1: Create `src/modules/garden/logic.js`**

Move `filterNativePlants`, `filterInvasivePlants`, `filterWildlife`, `filterBirds`, `filterReptiles`, `filterInsects`, `filterButterflies`, `categorizeSeasonalBirds`, `categorizePlantsByForm`, `getMonarchCorridorInfo`, `getFireflyHabitat`.

Export all.

- [ ] **Step 2: Update `src/modules/garden/data.js`**

Add: `const { filterNativePlants, ... } = require('./logic');`
Remove moved functions.

- [ ] **Step 3: Create `src/modules/garden/template.js`** from `src/templates/chapters/garden.js`.

Update the `require` at the top of `template.js` if it currently imports any filter functions from `data.js` — change those to `./logic`.

- [ ] **Step 4: Update `src/chapters.js`**

Change garden data import — remove filter functions (they are no longer exported from data.js):

Old:
```js
const { getGardenData, filterReptiles, filterInsects, filterButterflies, categorizeSeasonalBirds, categorizePlantsByForm, getMonarchCorridorInfo, getFireflyHabitat } = require('./modules/garden/data');
```

New:
```js
const { getGardenData } = require('./modules/garden/data');
const { buildWhatWillGrowHTML, buildGardenGlanceHTML } = require('./modules/garden/template');
```

Remove `filterReptiles`, `filterInsects`, `filterButterflies`, `categorizeSeasonalBirds`, `categorizePlantsByForm`, `getMonarchCorridorInfo`, `getFireflyHabitat` from `module.exports` of `chapters.js`.

- [ ] **Step 5: Check if any external caller imports these filter functions from `chapters.js`** — if so, update those callers to import from `modules/garden/logic` directly.

- [ ] **Step 6: Move template test**, update require path.

- [ ] **Step 7: Run tests, delete old files, commit**

```
npm test --no-coverage
git rm src/templates/chapters/garden.js tests/templates/chapters/garden.test.js
git add src/modules/garden/ tests/modules/garden/ src/chapters.js
git commit -m "refactor(fr-048): garden — extract logic.js, co-locate template.js"
```

---

## Task 12: climate module

**Files:**
- Create: `src/modules/climate/logic.js`
- Create: `src/modules/climate/template.js`
- Modify: `src/modules/climate/data.js`
- Modify: `src/chapters.js`
- Move: `tests/templates/chapters/climate.test.js` → `tests/modules/climate/template.test.js`

- [ ] **Step 1: Create `src/modules/climate/logic.js`**

Move `getEmergencySystem`, `getLastSignificantEvent`, `computeRarityStatement`, `classifyTopographicPosition`:

```js
'use strict';

function getEmergencySystem(state, county) { /* copy */ }
function getLastSignificantEvent(events) { /* copy */ }
function computeRarityStatement(eventType, count, yearsOfRecord) { /* copy */ }
function classifyTopographicPosition(elevationMeters, surroundingMeters) { /* copy */ }

module.exports = { getEmergencySystem, getLastSignificantEvent, computeRarityStatement, classifyTopographicPosition };
```

- [ ] **Step 2: Update `data.js`**: import from logic, remove moved functions. Also update module.exports — check if chapters.js currently imports `computeRarityStatement` or similar directly from climate/data — update those.

- [ ] **Step 3: Create `template.js`** from `src/templates/chapters/climate.js`.

- [ ] **Step 4: Update `src/chapters.js`**: update import for climate template. Check if any logic functions are imported from climate/data by chapters.js and update those to climate/logic.

- [ ] **Step 5: Move template test**, update require path.

- [ ] **Step 6: Run tests, delete old files, commit**

```
npm test --no-coverage
git rm src/templates/chapters/climate.js tests/templates/chapters/climate.test.js
git add src/modules/climate/ tests/modules/climate/ src/chapters.js
git commit -m "refactor(fr-048): climate — extract logic.js, co-locate template.js"
```

---

## Task 13: costs module (template only)

costs.js is a template for property cost/market data. There is no `costs` module folder — it's a template over data from the property module.

- [ ] **Step 1: Confirm where costs template data comes from**

Read `src/templates/chapters/costs.js`. It generates HTML from `propertyData` (from the property module). There is no `src/modules/costs/` folder.

Two options:
- Move `costs.js` into `src/modules/property/` as `costs-template.js`
- Create `src/modules/costs/` with just `template.js` (no data.js or logic.js needed)

**Decision:** Create `src/modules/costs/template.js`. Add a minimal `src/modules/costs/data.js` that just re-exports from property (or leave empty with a comment). Do NOT create a logic.js if there is no logic to put there.

- [ ] **Step 2: Create `src/modules/costs/template.js`** from `src/templates/chapters/costs.js`.

- [ ] **Step 3: Update `src/chapters.js`**: update costs template import.

- [ ] **Step 4: Move test file** → `tests/modules/costs/template.test.js`. Update require path.

- [ ] **Step 5: Run tests, delete old files, commit**

```
npm test --no-coverage
git rm src/templates/chapters/costs.js tests/templates/chapters/costs.test.js
git add src/modules/costs/ tests/modules/costs/ src/chapters.js
git commit -m "refactor(fr-048): costs — co-locate template.js"
```

---

## Task 14: traffic module (template only)

traffic.js is a template. There is no `src/modules/traffic/` folder.

- [ ] **Step 1: Create `src/modules/traffic/template.js`** from `src/templates/chapters/traffic.js`.

- [ ] **Step 2: Update `src/chapters.js`**: update traffic template import.

- [ ] **Step 3: Move test file** → `tests/modules/traffic/template.test.js`. Update require path.

- [ ] **Step 4: Run tests, delete old files, commit**

```
npm test --no-coverage
git rm src/templates/chapters/traffic.js tests/templates/chapters/traffic.test.js
git add src/modules/traffic/ tests/modules/traffic/ src/chapters.js
git commit -m "refactor(fr-048): traffic — co-locate template.js"
```

---

## Task 15: Cleanup — delete `src/templates/chapters/`, update CLAUDE.md

- [ ] **Step 1: Verify `src/templates/chapters/` contains only `index.js`**

```
ls src/templates/chapters/
```

Expected: only `index.js` remaining (all others moved in Tasks 1–14).

- [ ] **Step 2: Delete the directory**

```
git rm src/templates/chapters/index.js
git rm -r src/templates/chapters/
```

If any remaining files exist, they were missed — add them to the appropriate module first.

- [ ] **Step 3: Update CLAUDE.md**

Find and fix these sections:

**Architecture section** — update the module structure description:

Replace:
```
modules/         ← One folder per chapter/domain
```
With:
```
modules/         ← One folder per chapter/domain
                   Each module: data.js (API fetch) + logic.js (business rules) + template.js (HTML)
```

**Three-layer rule** — update to describe actual file locations:
```
1. `data.js` — fetches raw API data only. No transforms, no HTML.
2. `logic.js` — validates and processes data, applies business rules. No API calls, no HTML.
3. `template.js` — generates HTML from clean processed data. No API calls, no business logic.
```

**CONSTRAINT-002** — fix file path:
`src/modules/community/logic.js` (was previously the non-existent file; now it exists)

**CONSTRAINT-003** — fix file path:
`src/modules/health/logic.js` (now exists)

**CONSTRAINT-009** — update description to name the correct layer files.

**CONSTRAINT-011** — update "every business rule in logic.js" — now actually enforceable.

**Do Not section** — update to list the now-deleted `src/templates/chapters/` path if mentioned.

- [ ] **Step 4: Run full test suite**

```
npm test --no-coverage
```

Expected: same or higher count as start. All pass.

- [ ] **Step 5: Final commit and push**

```
git add CLAUDE.md
git commit -m "refactor(fr-048): delete templates/chapters/, correct CLAUDE.md architecture docs"
git push
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Every module has data.js + logic.js + template.js — Tasks 1–14
- ✅ data.js contains no HTML — enforced by moving all template functions out
- ✅ template.js contains no API calls — enforced by moving templates from centralized location
- ✅ logic.js contains no API calls and no HTML — enforced by extraction rules
- ✅ src/templates/chapters/ deleted — Task 15
- ✅ CLAUDE.md corrected — Task 15
- ✅ All tests pass after each task — verified in each task's run step
- ✅ costs and traffic (template-only modules) handled — Tasks 13–14
- ✅ access (logic-only, no template) handled — Task 8
- ✅ property/data.js getDensityType import fixed — Task 6
- ✅ garden filter functions removed from chapters.js exports — Task 11

**No behavior changes.** Every function is moved, not modified. Tests prove equivalence.
