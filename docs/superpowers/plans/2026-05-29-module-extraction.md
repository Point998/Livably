# Module Extraction — chapters.js → per-module data.js files

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract all data-fetching logic from the `src/chapters.js` monolith into per-module `src/modules/<domain>/data.js` files, leaving `chapters.js` as a thin orchestrator (~100 lines).

**Architecture:** Each domain module owns its data fetching in `data.js` with direct imports (not parameter-passing) of the Google client, matching the pattern of the 5 already-extracted modules. `chapters.js` becomes a thin orchestrator that calls per-module functions in `Promise.allSettled` and assembles the result object. Template files and `chapters.js` are never touched for logic — only imports change.

**Tech Stack:** Node.js, Jest (TDD), existing `src/shared/google/client.js` for direct Google client import.

---

## Key Decisions Baked In

- **Direct import** for Google client: `require('../../shared/google/client')` — matches all 5 existing modules, simpler signatures, `jest.mock()` handles test isolation
- **`safeInt`** shared helper: move to `src/utils/text.js` (used by 4 modules)
- **`fetchOverpass`** stays with Sensory (only Sensory uses it)
- **Test migration**: `tests/chapters/garden-data.test.js` → `tests/modules/garden/data.test.js`; `tests/chapters/climate-data.test.js` → `tests/modules/climate/data.test.js`
- **Schools deduplication**: `getSchoolRatings` exists in both `chapters.js` and `src/modules/schools/data.js` — remove from `chapters.js`, import from module

## Extraction Order (independent within phases)

| Phase | Modules | Reason |
|---|---|---|
| 0 (prereq) | safeInt, schools dedup | Shared by many; unblocks everything |
| 1 | Garden, Community | No Google dependency, high/partial test coverage |
| 2 | Walkability, Safety, Climate | Google client, some coverage |
| 3 | Property, Growth | Multiple APIs, no coverage yet |
| 4 | Sensory | Most complex, add tests first |
| 5 | Slim chapters.js | After all modules extracted |

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/utils/text.js` | Modify | Add `safeInt` export |
| `src/modules/garden/data.js` | Create | All garden data functions |
| `src/modules/community/data.js` | Create | Demographics + helpers |
| `src/modules/walkability/data.js` | Create | Walkability score |
| `src/modules/safety/data.js` | Create | Emergency services + location context |
| `src/modules/climate/data.js` | Create | NOAA, FEMA, USGS climate functions |
| `src/modules/property/data.js` | Create | Soil, broadband, property intelligence |
| `src/modules/growth/data.js` | Create | Permits, development activity |
| `src/modules/sensory/data.js` | Create | Air, flood, noise, water, EJ, airports |
| `src/chapters.js` | Modify (each task) | Remove lifted functions, add imports |
| `tests/modules/garden/data.test.js` | Create (migrate + expand) | Garden unit tests |
| `tests/modules/community/data.test.js` | Create | Community unit tests |
| `tests/modules/walkability/data.test.js` | Create | Walkability unit tests |
| `tests/modules/safety/data.test.js` | Create | Safety unit tests |
| `tests/modules/climate/data.test.js` | Create (migrate + expand) | Climate unit tests |
| `tests/modules/property/data.test.js` | Create | Property unit tests |
| `tests/modules/growth/data.test.js` | Create | Growth unit tests |
| `tests/modules/sensory/data.test.js` | Create | Sensory unit tests |

---

## Task 0: Shared prereqs — safeInt + schools deduplication

**Files:**
- Modify: `src/utils/text.js`
- Modify: `src/chapters.js` (remove `getSchoolRatings` duplicate, import from module)

- [ ] **Step 1: Add `safeInt` to `src/utils/text.js`**

Add before `module.exports`:
```js
function safeInt(n) {
  const v = parseInt(n, 10);
  return isNaN(v) || v < 0 ? 0 : v;
}
```

Add `safeInt` to `module.exports`:
```js
module.exports = {
  escapeHtml,
  formatDriveTime,
  toTitleCase,
  parseAddressParts,
  formatResearchDate,
  formatMoney,
  slugify,
  getDateSlug,
  safeInt,
};
```

- [ ] **Step 2: Add a test for safeInt**

In `tests/` — find an appropriate existing test file or add to any utils test. A quick inline test in a new `tests/utils/text.test.js`:

```js
'use strict';
const { safeInt } = require('../../src/utils/text');

test('safeInt converts valid number string', () => expect(safeInt('42')).toBe(42));
test('safeInt returns 0 for NaN', () => expect(safeInt('abc')).toBe(0));
test('safeInt returns 0 for negative', () => expect(safeInt('-5')).toBe(0));
test('safeInt returns 0 for null', () => expect(safeInt(null)).toBe(0));
```

Run: `npx jest tests/utils/text.test.js --no-coverage`
Expected: PASS

- [ ] **Step 3: Verify schools deduplication**

Read both versions and confirm they are functionally identical:
- `src/chapters.js` lines 689–745: `getSchoolRatings`
- `src/modules/schools/data.js`: `findSchoolsByType` or similar

If identical in behavior: proceed. If different: note the discrepancy before removing.

- [ ] **Step 4: Remove `getSchoolRatings` from chapters.js and import from module**

In `src/chapters.js`:
1. Delete lines 689–745 (the `getSchoolRatings` function)
2. Add import near the top with the other module imports:
```js
const { findNearestSchool, findNearestElementarySchool } = require('./modules/schools/data');
```
3. The `getChapterData` call at line 1623 uses `getSchoolRatings` — update:
```js
// Before:
getSchoolRatings(lat, lng, originLatLng, googleMapsClient, googleMapsApiKey, getDriveTime),
// After (schools/data.js already imports Google client directly):
findNearestSchool(originLatLng, locationInfo.state),
```

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```
Expected: all pass (641+)

- [ ] **Step 6: Commit**

```bash
git add src/utils/text.js src/chapters.js tests/utils/text.test.js
git commit -m "refactor: add safeInt to text.js, remove getSchoolRatings duplicate from chapters.js"
```

---

## Task 1: Extract Garden module

**Files:**
- Create: `src/modules/garden/data.js`
- Create: `tests/modules/garden/data.test.js` (migrate from `tests/chapters/garden-data.test.js`)
- Modify: `src/chapters.js`

The garden module has 13 functions — all pure data filters plus API callers for iNaturalist and PHZ API. No Google client needed.

- [ ] **Step 1: Create `src/modules/garden/data.js`**

```js
'use strict';

const {
  FROST_DATE_TABLE,
  NATIVE_PLANT_EXCLUDE, NATIVE_PLANT_EXCLUDE_NAMES,
  BENIGN_INTRODUCED, DOMESTIC_MAMMALS,
  INAT_NATIVE_PLANTS_RADIUS_KM, INAT_INVASIVE_PLANTS_RADIUS_KM,
  INAT_WILDLIFE_RADIUS_KM, INAT_BIRDS_RADIUS_KM,
  INAT_NATIVE_PLANTS_PER_PAGE, INAT_INVASIVE_PLANTS_PER_PAGE,
  INAT_WILDLIFE_PER_PAGE, INAT_BIRDS_PER_PAGE,
  INAT_REPTILES_RADIUS_KM, INAT_REPTILES_PER_PAGE,
  INAT_INSECTS_RADIUS_KM, INAT_INSECTS_PER_PAGE,
  INAT_BUTTERFLIES_RADIUS_KM, INAT_BUTTERFLIES_PER_PAGE,
  PLANT_GROWTH_FORMS, MONARCH_CORRIDOR_STATES, MILKWEED_BY_STATE, FIREFLY_STATES,
} = require('../../utils/constants');
```

Then copy the following functions verbatim from `src/chapters.js` (no changes to function bodies):
- `getHardinessZone` (lines 872–891)
- `iNatSpeciesCounts` (lines 893–916)
- `filterNativePlants` (lines 918–935)
- `filterInvasivePlants` (lines 937–949)
- `filterWildlife` (lines 951–959)
- `filterBirds` (lines 961–966)
- `filterReptiles` (lines 968–973)
- `filterInsects` (lines 975–980)
- `filterButterflies` (lines 982–987)
- `categorizeSeasonalBirds` (lines 989–1030)
- `categorizePlantsByForm` (lines 1032–1043)
- `getMonarchCorridorInfo` (lines 1045–1051)
- `getFireflyHabitat` (lines 1053–1055)
- `iNatSeasonalBirds` (lines 1385–1407)
- `getGardenData` (lines 1409–1455)

End the file with:
```js
module.exports = {
  getGardenData,
  getHardinessZone,
  iNatSpeciesCounts,
  iNatSeasonalBirds,
  filterNativePlants,
  filterInvasivePlants,
  filterWildlife,
  filterBirds,
  filterReptiles,
  filterInsects,
  filterButterflies,
  categorizeSeasonalBirds,
  categorizePlantsByForm,
  getMonarchCorridorInfo,
  getFireflyHabitat,
};
```

- [ ] **Step 2: Create `tests/modules/garden/data.test.js`**

Copy all tests from `tests/chapters/garden-data.test.js` and update require path:
```js
// Change all references from:
require('../../src/utils/constants')
// To just:
require('../../../src/modules/garden/data')
// And keep the constants imports for constants-only tests
```

Add these new tests covering the pure filter functions:
```js
'use strict';
const {
  filterNativePlants, filterInvasivePlants, filterWildlife, filterBirds,
  categorizeSeasonalBirds, categorizePlantsByForm,
  getMonarchCorridorInfo, getFireflyHabitat,
} = require('../../../src/modules/garden/data');

// (migrate all existing tests from tests/chapters/garden-data.test.js here)

describe('filterNativePlants', () => {
  const makeResult = (sci, common, rank = 'species') => ({
    taxon: { name: sci, preferred_common_name: common, rank },
    count: 5,
  });

  test('filters to species rank only', () => {
    const results = [
      makeResult('quercus alba', 'White Oak', 'species'),
      makeResult('quercus', 'Oak genus', 'genus'),
    ];
    const filtered = filterNativePlants(results);
    expect(filtered.map((r) => r.name)).toContain('White Oak');
    expect(filtered.map((r) => r.sci)).not.toContain('quercus');
  });

  test('excludes results without common name', () => {
    const results = [makeResult('quercus alba', null)];
    expect(filterNativePlants(results)).toHaveLength(0);
  });

  test('returns max 6 results', () => {
    const results = Array.from({ length: 10 }, (_, i) =>
      makeResult(`species${i} sp`, `Plant ${i}`)
    );
    expect(filterNativePlants(results).length).toBeLessThanOrEqual(6);
  });
});

describe('getMonarchCorridorInfo', () => {
  test('KY is in corridor and has milkweed species', () => {
    const info = getMonarchCorridorInfo('KY');
    expect(info.inCorridor).toBe(true);
    expect(info.milkweedSpecies.length).toBeGreaterThan(0);
  });

  test('MT is not in corridor', () => {
    const info = getMonarchCorridorInfo('MT');
    expect(info.inCorridor).toBe(false);
    expect(info.milkweedSpecies).toEqual([]);
  });
});

describe('getFireflyHabitat', () => {
  test('KY has firefly habitat', () => expect(getFireflyHabitat('KY')).toBe(true));
  test('MT does not', () => expect(getFireflyHabitat('MT')).toBe(false));
});
```

- [ ] **Step 3: Run new test file**

```bash
npx jest tests/modules/garden/data.test.js --no-coverage
```
Expected: PASS

- [ ] **Step 4: Update `src/chapters.js`**

a. Add import near the other module imports at the top:
```js
const {
  getGardenData,
  filterReptiles, filterInsects, filterButterflies,
  categorizeSeasonalBirds, categorizePlantsByForm,
  getMonarchCorridorInfo, getFireflyHabitat,
} = require('./modules/garden/data');
```

b. Delete these function definitions from chapters.js (they are now in the module):
- `getHardinessZone` (lines 872–891)
- `iNatSpeciesCounts` (lines 893–916)
- `filterNativePlants`, `filterInvasivePlants`, `filterWildlife`, `filterBirds` (lines 918–966)
- `filterReptiles`, `filterInsects`, `filterButterflies` (lines 968–987)
- `categorizeSeasonalBirds`, `categorizePlantsByForm` (lines 989–1043)
- `getMonarchCorridorInfo`, `getFireflyHabitat` (lines 1045–1055)
- `iNatSeasonalBirds` (lines 1385–1407)
- `getGardenData` (lines 1409–1455)

c. `getChapterData` already calls `getGardenData(lat, lng, locationInfo)` — no signature change needed.

d. In `module.exports` at the bottom of chapters.js, the re-exports `filterReptiles, filterInsects, filterButterflies, categorizeSeasonalBirds, categorizePlantsByForm, getMonarchCorridorInfo, getFireflyHabitat` still work since they are now imported from the module.

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/modules/garden/data.js tests/modules/garden/data.test.js src/chapters.js
git commit -m "refactor: extract garden module — getGardenData + filters to src/modules/garden/data.js"
```

---

## Task 2: Extract Community module

**Files:**
- Create: `src/modules/community/data.js`
- Create: `tests/modules/community/data.test.js`
- Modify: `src/chapters.js`

Community has `getDemographics` (Census ACS, ~100 lines) + 4 pure category helpers.

- [ ] **Step 1: Create `src/modules/community/data.js`**

```js
'use strict';

const { getCensusFIPS, fetchCensusACS } = require('../../shared/census');
const { safeInt } = require('../../utils/text');
```

Copy verbatim from `src/chapters.js`:
- `getDemographics` (lines 58–163) — uses `safeInt` and `fetchCensusACS`
- `getIncomeLevel` (lines 165–171)
- `getEducationLevel` (lines 173–178)
- `getDensityType` (lines 180–184)
- `getCommunityType` (lines 186–191)

End with:
```js
module.exports = {
  getDemographics,
  getIncomeLevel,
  getEducationLevel,
  getDensityType,
  getCommunityType,
};
```

- [ ] **Step 2: Create `tests/modules/community/data.test.js`**

```js
'use strict';
const {
  getDemographics,
  getIncomeLevel,
  getEducationLevel,
  getDensityType,
  getCommunityType,
} = require('../../../src/modules/community/data');

jest.mock('../../../src/shared/census', () => ({
  getCensusFIPS: jest.fn(),
  fetchCensusACS: jest.fn(),
}));

const { fetchCensusACS } = require('../../../src/shared/census');

describe('getIncomeLevel', () => {
  test('above 100k is gold', () => expect(getIncomeLevel(120000).color).toBe('gold'));
  test('zero returns muted', () => expect(getIncomeLevel(0).color).toBe('muted'));
  test('null returns muted', () => expect(getIncomeLevel(null).color).toBe('muted'));
});

describe('getEducationLevel', () => {
  test('above 60% is green', () => expect(getEducationLevel(65).color).toBe('green'));
  test('25-40% is gold', () => expect(getEducationLevel(30).color).toBe('gold'));
});

describe('getDensityType', () => {
  test('population > 5000 is Urban', () => expect(getDensityType(6000).label).toBe('Urban'));
  test('population 2001-5000 is Suburban', () => expect(getDensityType(3000).label).toBe('Suburban'));
  test('population <= 2000 is Rural', () => expect(getDensityType(1000).label).toBe('Rural'));
});

describe('getCommunityType', () => {
  test('high ownership + large household = established family', () => {
    const r = getCommunityType(75, 3.0);
    expect(r.label).toMatch(/family/i);
  });
  test('low ownership = renter community', () => {
    const r = getCommunityType(35, 2.5);
    expect(r.label).toMatch(/renter/i);
  });
});

describe('getDemographics', () => {
  test('returns null when fetchCensusACS returns null', async () => {
    fetchCensusACS.mockResolvedValue(null);
    const result = await getDemographics(38.2, -84.5, { state: '21', county: '077', tract: '0101' });
    expect(result).toBeNull();
  });

  test('returns structured object when Census data available', async () => {
    const mockMap = new Map([
      ['B01001_001E', '5000'], ['B01002_001E', '38'],
      ['B19013_001E', '65000'], ['B25003_001E', '2000'],
      ['B25003_002E', '1500'], ['B25010_001E', '2.5'],
      ['B15003_001E', '3000'], ['B15003_017E', '500'],
      ['B15003_022E', '400'], ['B15003_023E', '200'],
      ['B15003_024E', '50'], ['B15003_025E', '50'],
      ['B25039_001E', '2010'],
      ...Array.from({ length: 22 }, (_, i) => [`B01001_00${i + 3}E`, '100']),
    ]);
    fetchCensusACS.mockResolvedValue(mockMap);
    const result = await getDemographics(38.2, -84.5, { state: '21', county: '077', tract: '0101' });
    expect(result).not.toBeNull();
    expect(result.income.median).toBe(65000);
    expect(result.community.ownershipRate).toBe(75);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx jest tests/modules/community/data.test.js --no-coverage
```
Expected: PASS

- [ ] **Step 4: Update `src/chapters.js`**

a. Add import:
```js
const { getDemographics } = require('./modules/community/data');
```

b. Delete from chapters.js:
- `getDemographics` (lines 58–163)
- `getIncomeLevel` (165–171)
- `getEducationLevel` (173–178)
- `getDensityType` (180–184)
- `getCommunityType` (186–191)

c. `getChapterData` calls `getDemographics(lat, lng, fips)` — no change needed.

d. Remove `safeInt` from chapters.js (lines 51–54) and replace its import at the top:
```js
const { escapeHtml, formatMoney, safeInt } = require('./utils/text');
```

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/modules/community/data.js tests/modules/community/data.test.js src/chapters.js
git commit -m "refactor: extract community module — getDemographics + helpers to src/modules/community/data.js"
```

---

## Task 3: Extract Walkability module

**Files:**
- Create: `src/modules/walkability/data.js`
- Create: `tests/modules/walkability/data.test.js`
- Modify: `src/chapters.js`

Walkability has 2 functions: `getWalkabilityScore` (Google Places) and `getWalkCategory` (pure helper).

- [ ] **Step 1: Create `src/modules/walkability/data.js`**

```js
'use strict';

const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { haversineDistance } = require('../../utils/geo');
const { WALKABILITY_SEARCH_RADIUS_M, WALK_TYPES } = require('../../utils/constants');
```

Copy from `src/chapters.js`:
- `getWalkabilityScore` (lines 224–259) — remove `googleMapsClient, googleMapsApiKey` params since they are now imported directly:

```js
// BEFORE (in chapters.js):
async function getWalkabilityScore(lat, lng, googleMapsClient, googleMapsApiKey) {

// AFTER (in module — client imported at top):
async function getWalkabilityScore(lat, lng) {
```

- `getWalkCategory` (lines 261–267) — copy verbatim

End with:
```js
module.exports = { getWalkabilityScore, getWalkCategory };
```

- [ ] **Step 2: Create `tests/modules/walkability/data.test.js`**

```js
'use strict';

jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: {
    placesNearby: jest.fn(),
  },
  googleMapsApiKey: 'test-key',
}));

const { googleMapsClient } = require('../../../src/shared/google/client');
const { getWalkabilityScore, getWalkCategory } = require('../../../src/modules/walkability/data');

describe('getWalkCategory', () => {
  test('90+ is Walkers Paradise', () => expect(getWalkCategory(90).label).toMatch(/paradise/i));
  test('70-89 is Very Walkable', () => expect(getWalkCategory(75).label).toMatch(/very walkable/i));
  test('50-69 is Somewhat Walkable', () => expect(getWalkCategory(55).label).toMatch(/somewhat/i));
  test('25-49 is Car-Dependent', () => expect(getWalkCategory(30).label).toMatch(/car-dependent/i));
  test('below 25 is Very Car-Dependent', () => expect(getWalkCategory(10).label).toMatch(/very car/i));
});

describe('getWalkabilityScore', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns score=0 and empty destinations when all searches fail', async () => {
    googleMapsClient.placesNearby.mockRejectedValue(new Error('API error'));
    const result = await getWalkabilityScore(38.2, -84.5);
    expect(result.score).toBe(0);
    expect(result.destinations).toEqual([]);
  });

  test('returns non-zero score when places found', async () => {
    googleMapsClient.placesNearby.mockResolvedValue({
      data: {
        results: [
          { name: 'Kroger', geometry: { location: { lat: 38.201, lng: -84.501 } } },
          { name: 'CVS', geometry: { location: { lat: 38.202, lng: -84.502 } } },
        ],
      },
    });
    const result = await getWalkabilityScore(38.2, -84.5);
    expect(result.score).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx jest tests/modules/walkability/data.test.js --no-coverage
```
Expected: PASS

- [ ] **Step 4: Update `src/chapters.js`**

a. Add import:
```js
const { getWalkabilityScore } = require('./modules/walkability/data');
```

b. Delete from chapters.js:
- `getWalkabilityScore` (lines 224–259)
- `getWalkCategory` (lines 261–267)

c. Update `getChapterData` call — remove the googleMapsClient/googleMapsApiKey params:
```js
// Before:
getWalkabilityScore(lat, lng, googleMapsClient, googleMapsApiKey),
// After:
getWalkabilityScore(lat, lng),
```

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/modules/walkability/data.js tests/modules/walkability/data.test.js src/chapters.js
git commit -m "refactor: extract walkability module — getWalkabilityScore to src/modules/walkability/data.js"
```

---

## Task 4: Extract Safety module

**Files:**
- Create: `src/modules/safety/data.js`
- Create: `tests/modules/safety/data.test.js`
- Modify: `src/chapters.js`

Safety has `getEmergencyServices` (Google Places + Distance Matrix), `getSafetyLocationContext` (pure extraction), and 2 helpers.

- [ ] **Step 1: Create `src/modules/safety/data.js`**

```js
'use strict';

const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { getDriveTime } = require('../../shared/google/distanceMatrix');
const { haversineDistance } = require('../../utils/geo');
const {
  RESPONSE_SPEED_MPH,
  RESPONSE_DISPATCH_MINUTES,
  RESPONSE_TIME_THRESHOLDS,
} = require('../../utils/constants');
```

Copy from `src/chapters.js`:
- `normalizeStationName` (lines 271–274) — verbatim
- `getEmergencyServices` (lines 276–308) — remove `googleMapsClient, googleMapsApiKey, getDriveTime` params (all now imported):
```js
// BEFORE:
async function getEmergencyServices(lat, lng, originLatLng, googleMapsClient, googleMapsApiKey, getDriveTime) {
// AFTER:
async function getEmergencyServices(lat, lng, originLatLng) {
```
- `estimateResponseTime` (lines 310–319) — verbatim
- `getSafetyLocationContext` (lines 681–685) — verbatim

End with:
```js
module.exports = {
  getEmergencyServices,
  getSafetyLocationContext,
  estimateResponseTime,
};
```

- [ ] **Step 2: Create `tests/modules/safety/data.test.js`**

```js
'use strict';

jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: { placesNearby: jest.fn() },
  googleMapsApiKey: 'test-key',
}));
jest.mock('../../../src/shared/google/distanceMatrix', () => ({
  getDriveTime: jest.fn(),
}));

const { googleMapsClient } = require('../../../src/shared/google/client');
const { getDriveTime } = require('../../../src/shared/google/distanceMatrix');
const { getEmergencyServices, getSafetyLocationContext, estimateResponseTime } = require('../../../src/modules/safety/data');

describe('estimateResponseTime', () => {
  test('fire <= 5 min is Excellent', () => {
    const r = estimateResponseTime(0.5, 'fire');
    expect(r.category.label).toBe('Excellent');
  });
  test('police > 15 min is Delayed', () => {
    const r = estimateResponseTime(5.0, 'police');
    expect(r.category.label).toBe('Delayed');
  });
});

describe('getSafetyLocationContext', () => {
  test('returns state, city, county from locationInfo', () => {
    const r = getSafetyLocationContext({ state: 'KY', city: 'Georgetown', county: 'Scott County' });
    expect(r.state).toBe('KY');
    expect(r.city).toBe('Georgetown');
  });
  test('returns null when no locationInfo', async () => {
    const r = await getSafetyLocationContext(null);
    expect(r).toBeNull();
  });
});

describe('getEmergencyServices', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns null fire and police when no places found', async () => {
    googleMapsClient.placesNearby.mockResolvedValue({ data: { results: [] } });
    getDriveTime.mockResolvedValue(5);
    const result = await getEmergencyServices(38.2, -84.5, '38.2,-84.5');
    expect(result.fire).toBeNull();
    expect(result.police).toBeNull();
  });

  test('returns fire station with response estimate', async () => {
    googleMapsClient.placesNearby.mockResolvedValue({
      data: {
        results: [{
          name: 'Georgetown Fire Station',
          vicinity: '100 Fire St',
          geometry: { location: { lat: 38.201, lng: -84.501 } },
        }],
      },
    });
    getDriveTime.mockResolvedValue(4);
    const result = await getEmergencyServices(38.2, -84.5, '38.2,-84.5');
    expect(result.fire).not.toBeNull();
    expect(result.fire.name).toBe('Georgetown Fire Station');
    expect(result.fire.response.estimate).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx jest tests/modules/safety/data.test.js --no-coverage
```
Expected: PASS

- [ ] **Step 4: Update `src/chapters.js`**

a. Add import:
```js
const { getEmergencyServices, getSafetyLocationContext } = require('./modules/safety/data');
```

b. Delete from chapters.js:
- `normalizeStationName` (lines 271–274)
- `getEmergencyServices` (lines 276–308)
- `estimateResponseTime` (lines 310–319)
- `getSafetyLocationContext` (lines 681–685)

c. Update `getChapterData` calls:
```js
// Before:
getEmergencyServices(lat, lng, originLatLng, googleMapsClient, googleMapsApiKey, getDriveTime),
getSafetyLocationContext(locationInfo),
// After (client + driveTime now imported in module):
getEmergencyServices(lat, lng, originLatLng),
getSafetyLocationContext(locationInfo),
```

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/modules/safety/data.js tests/modules/safety/data.test.js src/chapters.js
git commit -m "refactor: extract safety module — getEmergencyServices to src/modules/safety/data.js"
```

---

## Task 5: Extract Climate module

**Files:**
- Create: `src/modules/climate/data.js`
- Create: `tests/modules/climate/data.test.js` (migrate from `tests/chapters/climate-data.test.js`)
- Modify: `src/chapters.js`

Climate has 9 functions: NOAA, FEMA, USGS elevation, watershed, emergency system, and pure helpers.

- [ ] **Step 1: Create `src/modules/climate/data.js`**

```js
'use strict';

const path = require('path');
const fs   = require('fs');
const { logError } = require('../../logger');
const {
  STATE_ALERT_SYSTEMS,
  CLIMATE_SIGNIFICANT_DAMAGE_USD,
  NOAA_CDO_BASE_URL, NOAA_CDO_NORMALS_DATASET, NOAA_CDO_NORMALS_ANN,
  NOAA_STATION_SEARCH_RADII,
  FEMA_DECLARATIONS_URL, USGS_ELEVATION_URL,
  CLIMATE_STORM_LOOKBACK_YEARS, CLIMATE_FEMA_LOOKBACK_YEARS,
} = require('../../utils/constants');
```

Copy verbatim from `src/chapters.js`:
- `getEmergencySystem` (lines 1058–1076)
- `getLastSignificantEvent` (lines 1080–1107)
- `computeRarityStatement` (lines 1110–1116)
- `classifyTopographicPosition` (lines 1120–1128)
- `getNOAAStormEvents` (lines 1136–1151) — update the file path to be relative to this new location:
  ```js
  // Before: path.join(__dirname, '..', 'data', 'noaa-storm-events', ...)
  // After: path.join(__dirname, '..', '..', '..', 'data', 'noaa-storm-events', ...)
  ```
- `getNOAAClimateNormals` (lines 1153–1249)
- `fetchElevationWithRetry` (lines 1251–1268)
- `getWatershedContext` (lines 1270–1296)
- `getFEMADeclarations` (lines 1298–1329)
- `getClimateHistoryData` (lines 1331–1383)

End with:
```js
module.exports = {
  getClimateHistoryData,
  getNOAAClimateNormals,
  getNOAAStormEvents,
  getFEMADeclarations,
  getWatershedContext,
  fetchElevationWithRetry,
  getEmergencySystem,
  getLastSignificantEvent,
  computeRarityStatement,
  classifyTopographicPosition,
};
```

- [ ] **Step 2: Create `tests/modules/climate/data.test.js`**

Migrate all tests from `tests/chapters/climate-data.test.js`. Update all require paths from `../../src/chapters` to `../../../src/modules/climate/data`. Example:

```js
'use strict';
const {
  getEmergencySystem,
  getLastSignificantEvent,
  computeRarityStatement,
  classifyTopographicPosition,
  fetchElevationWithRetry,
  getWatershedContext,
} = require('../../../src/modules/climate/data');

// All existing tests from tests/chapters/climate-data.test.js go here with updated require paths
```

- [ ] **Step 3: Run new test file**

```bash
npx jest tests/modules/climate/data.test.js --no-coverage
```
Expected: PASS

- [ ] **Step 4: Update `src/chapters.js`**

a. Add import:
```js
const {
  getClimateHistoryData,
  getEmergencySystem,
  getLastSignificantEvent,
  computeRarityStatement,
  classifyTopographicPosition,
  getWatershedContext,
  fetchElevationWithRetry,
} = require('./modules/climate/data');
```

b. Delete all 9 functions from chapters.js (lines 1058–1383).

c. The `module.exports` at the bottom re-exports `getEmergencySystem, getLastSignificantEvent, computeRarityStatement, classifyTopographicPosition, getWatershedContext, fetchElevationWithRetry` — these still work since they're now imported from the module.

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```
Expected: all pass. The old `tests/chapters/climate-data.test.js` can be deleted now (or kept as a smoke test — your choice; the module tests replace it).

- [ ] **Step 6: Commit**

```bash
git add src/modules/climate/data.js tests/modules/climate/data.test.js src/chapters.js
git commit -m "refactor: extract climate module — NOAA/FEMA/USGS functions to src/modules/climate/data.js"
```

---

## Task 6: Extract Property module

**Files:**
- Create: `src/modules/property/data.js`
- Create: `tests/modules/property/data.test.js`
- Modify: `src/chapters.js`

Property has 6 functions: soil (USDA), broadband (FCC), construction era context, property intelligence orchestrator.

- [ ] **Step 1: Create `src/modules/property/data.js`**

```js
'use strict';

const { fetchCensusACS } = require('../../shared/census');
const { safeInt } = require('../../utils/text');
const {
  STATE_TAX_RATES, STATE_INSURANCE_ANNUAL, STATE_UTILITIES_MONTHLY,
  STATE_HOMESTEAD,
  BROADBAND_TECH_CODES,
} = require('../../utils/constants');
```

Copy verbatim from `src/chapters.js`:
- `getPropertyData` (lines 195–220)
- `getSoilData` (lines 1461–1502)
- `getDrainageCategory` (lines 1504–1514)
- `getBroadbandData` (lines 1516–1560)
- `getBroadbandCategory` (lines 1562–1568)
- `getConstructionEraContext` (lines 1570–1579)
- `getPropertyIntelligence` (lines 1581–1608)

End with:
```js
module.exports = {
  getPropertyData,
  getPropertyIntelligence,
  getSoilData,
  getDrainageCategory,
  getBroadbandData,
  getBroadbandCategory,
  getConstructionEraContext,
};
```

- [ ] **Step 2: Create `tests/modules/property/data.test.js`**

```js
'use strict';

jest.mock('../../../src/shared/census', () => ({
  fetchCensusACS: jest.fn(),
}));

const { fetchCensusACS } = require('../../../src/shared/census');
const {
  getDrainageCategory,
  getBroadbandCategory,
  getConstructionEraContext,
  getPropertyData,
} = require('../../../src/modules/property/data');

describe('getDrainageCategory', () => {
  test('well drained returns green', () => expect(getDrainageCategory('well drained').color).toBe('green'));
  test('poorly drained returns red', () => expect(getDrainageCategory('poorly drained').color).toBe('red'));
  test('null returns null', () => expect(getDrainageCategory(null)).toBeNull());
});

describe('getBroadbandCategory', () => {
  test('fiber returns green', () => expect(getBroadbandCategory(1000, true).color).toBe('green'));
  test('200Mbps returns lightgreen', () => expect(getBroadbandCategory(250, false).color).toBe('lightgreen'));
  test('25Mbps returns gold', () => expect(getBroadbandCategory(25, false).color).toBe('gold'));
  test('0Mbps returns muted', () => expect(getBroadbandCategory(0, false).color).toBe('muted'));
});

describe('getConstructionEraContext', () => {
  test('2015 is Modern', () => expect(getConstructionEraContext(2015).era).toMatch(/modern/i));
  test('1965 has lead paint caution', () => {
    const ctx = getConstructionEraContext(1965);
    expect(ctx.cautions.some((c) => /lead/i.test(c))).toBe(true);
  });
  test('null returns null', () => expect(getConstructionEraContext(null)).toBeNull());
});

describe('getPropertyData', () => {
  test('returns KY tax rate for KY address', async () => {
    fetchCensusACS.mockResolvedValue(new Map([['B01003_001E', '3000']]));
    const result = await getPropertyData({ state: '21', county: '077', tract: '0101' }, { state: 'KY' });
    expect(result.state).toBe('KY');
    expect(typeof result.taxRate).toBe('number');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx jest tests/modules/property/data.test.js --no-coverage
```
Expected: PASS

- [ ] **Step 4: Update `src/chapters.js`**

a. Add import:
```js
const { getPropertyData, getPropertyIntelligence } = require('./modules/property/data');
```

b. Delete from chapters.js:
- `getPropertyData` (lines 195–220)
- `getSoilData`, `getDrainageCategory`, `getBroadbandData`, `getBroadbandCategory`, `getConstructionEraContext` (lines 1461–1579)
- `getPropertyIntelligence` (lines 1581–1608)

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/modules/property/data.js tests/modules/property/data.test.js src/chapters.js
git commit -m "refactor: extract property module — soil, broadband, construction era to src/modules/property/data.js"
```

---

## Task 7: Extract Growth module

**Files:**
- Create: `src/modules/growth/data.js`
- Create: `tests/modules/growth/data.test.js`
- Modify: `src/chapters.js`

Growth has 4 functions: building permits (Census BPS), new construction context (Census ACS), development activity (Google Places), and the orchestrator.

- [ ] **Step 1: Create `src/modules/growth/data.js`**

```js
'use strict';

const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { fetchCensusACS } = require('../../shared/census');
const { haversineDistance } = require('../../utils/geo');
const { safeInt } = require('../../utils/text');
const { discoverDevelopments } = require('../../development-discovery');
const {
  COMMERCIAL_DEV_TYPES,
  DEVELOPMENT_ACTIVITY_SEARCH_RADIUS_M,
} = require('../../utils/constants');
```

Copy from `src/chapters.js`:
- `getBuildingPermitTrend` (lines 749–811) — verbatim
- `getNewConstructionContext` (lines 813–823) — verbatim
- `getRecentDevelopmentActivity` (lines 825–850) — remove `googleMapsClient, googleMapsApiKey` params:
  ```js
  // BEFORE:
  async function getRecentDevelopmentActivity(lat, lng, googleMapsClient, googleMapsApiKey) {
  // AFTER:
  async function getRecentDevelopmentActivity(lat, lng) {
  ```
- `getGrowthAndDevelopment` (lines 852–868) — remove `googleMapsClient, googleMapsApiKey` params:
  ```js
  // BEFORE:
  async function getGrowthAndDevelopment(lat, lng, fips, locationInfo, googleMapsClient, googleMapsApiKey) {
  // AFTER:
  async function getGrowthAndDevelopment(lat, lng, fips, locationInfo) {
  ```
  Also update the internal call to `getRecentDevelopmentActivity` (remove googleMapsClient, googleMapsApiKey args) and the condition `googleMapsClient ? getRecentDevelopmentActivity(...) : Promise.resolve([])` becomes just `getRecentDevelopmentActivity(lat, lng)`.

End with:
```js
module.exports = {
  getGrowthAndDevelopment,
  getBuildingPermitTrend,
  getNewConstructionContext,
  getRecentDevelopmentActivity,
};
```

- [ ] **Step 2: Create `tests/modules/growth/data.test.js`**

```js
'use strict';

jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: { placesNearby: jest.fn() },
  googleMapsApiKey: 'test-key',
}));
jest.mock('../../../src/shared/census', () => ({ fetchCensusACS: jest.fn() }));
jest.mock('../../../src/development-discovery', () => ({ discoverDevelopments: jest.fn() }));

const { googleMapsClient } = require('../../../src/shared/google/client');
const { fetchCensusACS } = require('../../../src/shared/census');
const { discoverDevelopments } = require('../../../src/development-discovery');
const {
  getGrowthAndDevelopment,
  getNewConstructionContext,
} = require('../../../src/modules/growth/data');

describe('getNewConstructionContext', () => {
  test('returns null when Census fails', async () => {
    fetchCensusACS.mockResolvedValue(null);
    const result = await getNewConstructionContext({ state: '21', county: '077', tract: '0101' });
    expect(result).toBeNull();
  });

  test('calculates newConstructionPct from Census data', async () => {
    fetchCensusACS.mockResolvedValue(new Map([
      ['B25034_001E', '1000'],
      ['B25034_002E', '100'],
      ['B25034_003E', '50'],
    ]));
    const result = await getNewConstructionContext({ state: '21', county: '077', tract: '0101' });
    expect(result.newConstructionPct).toBe(15);
  });
});

describe('getGrowthAndDevelopment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchCensusACS.mockResolvedValue(null);
    googleMapsClient.placesNearby.mockResolvedValue({ data: { results: [] } });
    discoverDevelopments.mockResolvedValue([]);
  });

  test('returns all four keys', async () => {
    const result = await getGrowthAndDevelopment(38.2, -84.5, null, { city: 'Georgetown', state: 'KY' });
    expect(result).toHaveProperty('permits');
    expect(result).toHaveProperty('newConstruction');
    expect(result).toHaveProperty('establishments');
    expect(result).toHaveProperty('namedProjects');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx jest tests/modules/growth/data.test.js --no-coverage
```
Expected: PASS

- [ ] **Step 4: Update `src/chapters.js`**

a. Add import:
```js
const { getGrowthAndDevelopment } = require('./modules/growth/data');
```

b. Delete from chapters.js:
- `getBuildingPermitTrend` (lines 749–811)
- `getNewConstructionContext` (lines 813–823)
- `getRecentDevelopmentActivity` (lines 825–850)
- `getGrowthAndDevelopment` (lines 852–868)

c. Update `getChapterData`:
```js
// Before:
getGrowthAndDevelopment(lat, lng, fips, locationInfo, googleMapsClient, googleMapsApiKey),
// After:
getGrowthAndDevelopment(lat, lng, fips, locationInfo),
```

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/modules/growth/data.js tests/modules/growth/data.test.js src/chapters.js
git commit -m "refactor: extract growth module — permits, development activity to src/modules/growth/data.js"
```

---

## Task 8: Extract Sensory module

**Files:**
- Create: `src/modules/sensory/data.js`
- Create: `tests/modules/sensory/data.test.js`
- Modify: `src/chapters.js`

Sensory is the largest extraction: 20+ functions, 8 external APIs (AirNow, FEMA, BTS, OSM Overpass, EPA ECHO, EPA EJSCREEN, airports, radon), zero existing test coverage. **Add tests before extracting.**

- [ ] **Step 1: Write tests against chapters.js FIRST (TDD pre-extraction)**

Create `tests/modules/sensory/data.test.js` importing from chapters.js temporarily:

```js
'use strict';

// Temporarily import from chapters.js until extraction; require path updated in Step 5
const {
  // These are not yet exported from chapters.js - we will test the module after extraction.
  // For now write the tests that will pass once the module exists.
} = require('../../../src/modules/sensory/data');
```

Actually — create the test file targeting the module path (it won't resolve yet) and run it to confirm FAIL:

```js
'use strict';

// These will fail until the module is created — that is correct for TDD.
const sensory = require('../../../src/modules/sensory/data');

describe('getAQICategory', () => {
  const { getAQICategory } = sensory;
  test('AQI 0-50 is Good', () => expect(getAQICategory(25).label).toBe('Good'));
  test('AQI 51-100 is Moderate', () => expect(getAQICategory(75).label).toBe('Moderate'));
  test('AQI 101-150 is Unhealthy for Sensitive Groups', () => expect(getAQICategory(120).label).toMatch(/sensitive/i));
  test('AQI 151-200 is Unhealthy', () => expect(getAQICategory(170).label).toBe('Unhealthy'));
  test('AQI 200+ is Very Unhealthy', () => expect(getAQICategory(250).label).toMatch(/very unhealthy/i));
});

describe('getDNLCategory', () => {
  const { getDNLCategory } = sensory;
  test('DNL < 45 is Very Quiet', () => expect(getDNLCategory(40).label).toMatch(/very quiet/i));
  test('DNL 55-64 is Moderate', () => expect(getDNLCategory(60).label).toBe('Moderate'));
  test('DNL 65-69 is Elevated', () => expect(getDNLCategory(67).label).toBe('Elevated'));
  test('DNL 70+ is Significant', () => expect(getDNLCategory(75).label).toBe('Significant'));
});

describe('getBortleDescription', () => {
  const { getBortleDescription } = sensory;
  test('Bortle 1-2 is exceptional dark sky', () => expect(getBortleDescription(2).label).toMatch(/exceptional/i));
  test('Bortle 5 is suburban sky', () => expect(getBortleDescription(5).label).toMatch(/suburban/i));
  test('Bortle 8 is urban sky', () => expect(getBortleDescription(8).label).toMatch(/urban/i));
});

describe('getEnvironmentalData', () => {
  const { getEnvironmentalData } = sensory;

  // Mock all external calls
  jest.mock('../../../src/shared/google/client', () => ({
    googleMapsClient: { placesNearby: jest.fn().mockResolvedValue({ data: { results: [] } }) },
    googleMapsApiKey: 'test-key',
  }));
  jest.mock('../../../src/shared/census', () => ({
    fetchCensusACS: jest.fn().mockResolvedValue(null),
  }));

  test('returns object with all expected keys', async () => {
    // AirNow, FEMA, BTS, OSM etc. will all return null/empty without API keys
    const result = await getEnvironmentalData(38.2, -84.5, null, null);
    expect(result).toHaveProperty('airQuality');
    expect(result).toHaveProperty('floodRisk');
    expect(result).toHaveProperty('airports');
    expect(result).toHaveProperty('roadNoise');
    expect(result).toHaveProperty('rail');
    expect(result).toHaveProperty('lightPollution');
    expect(result).toHaveProperty('waterQuality');
    expect(result).toHaveProperty('radon');
    expect(result).toHaveProperty('ejscreen');
  });
});
```

Run: `npx jest tests/modules/sensory/data.test.js --no-coverage`
Expected: FAIL with "Cannot find module"

- [ ] **Step 2: Create `src/modules/sensory/data.js`**

```js
'use strict';

const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { fetchCensusACS } = require('../../shared/census');
const { haversineDistance } = require('../../utils/geo');
const { safeInt } = require('../../utils/text');
const {
  NON_AIRPORT_RE, AIRPORT_RE,
  AIRPORT_SEARCH_RADIUS_M, AIRPORT_MAX_DISTANCE_MILES,
  FEMA_FLOOD_ZONES,
  OSM_ROAD_NOISE_RADIUS_M, OSM_RAIL_RADIUS_M, OSM_LANDUSE_RADIUS_M,
  WATER_QUALITY_SEARCH_RADIUS_MILES,
  OVERPASS_ENDPOINTS,
  RADON_ZONE_BY_STATE,
  BROADBAND_TECH_CODES,
} = require('../../utils/constants');
```

Copy verbatim from `src/chapters.js`:
- `getAirQuality` (lines 357–370)
- `getAQICategory` (lines 372–378)
- `getFloodRisk` (lines 382–393)
- `interpretFloodZone` (lines 395–397)
- `getAirportData` (lines 403–416) — remove `googleMapsClient, googleMapsApiKey` params
- `getRoadNoise` (lines 420–440)
- `fetchOverpass` (lines 442–458)
- `getRoadNoiseOSM` (lines 460–481)
- `estimateDNLFromRoad` (lines 483–489)
- `getDNLCategory` (lines 491–497)
- `getRailProximity` (lines 501–522)
- `getLightPollution` (lines 526–535)
- `fetchLanduseOSM` (lines 537–547)
- `estimateBortle` (lines 549–561)
- `getBortleDescription` (lines 563–571)
- `getWaterQuality` (lines 575–629)
- `getRadonZone` (lines 634–638)
- `getEJScreen` (lines 642–677)
- `getEnvironmentalData` (lines 323–353) — remove `googleMapsClient, googleMapsApiKey` params; update internal call to `getAirportData`:
  ```js
  // BEFORE:
  async function getEnvironmentalData(lat, lng, _highwayDriveMinutes, fips, googleMapsClient, googleMapsApiKey) {
    ...
    googleMapsClient ? getAirportData(lat, lng, googleMapsClient, googleMapsApiKey) : Promise.resolve(null),
  // AFTER:
  async function getEnvironmentalData(lat, lng, _highwayDriveMinutes, fips) {
    ...
    getAirportData(lat, lng),
  ```

End with:
```js
module.exports = {
  getEnvironmentalData,
  getAirQuality,
  getAQICategory,
  getFloodRisk,
  getAirportData,
  getRoadNoise,
  getRailProximity,
  getLightPollution,
  getWaterQuality,
  getRadonZone,
  getEJScreen,
  getDNLCategory,
  getBortleDescription,
};
```

- [ ] **Step 3: Run sensory tests**

```bash
npx jest tests/modules/sensory/data.test.js --no-coverage
```
Expected: PASS

- [ ] **Step 4: Run full suite**

```bash
npx jest --no-coverage
```
Expected: all pass (sensory module not yet wired into chapters.js — existing tests still pass because chapters.js still has the functions)

- [ ] **Step 5: Update `src/chapters.js`**

a. Add import:
```js
const { getEnvironmentalData } = require('./modules/sensory/data');
```

b. Delete all sensory functions from chapters.js (lines 323–677).

c. Update `getChapterData`:
```js
// Before:
getEnvironmentalData(lat, lng, highwayDriveMinutes, fips, googleMapsClient, googleMapsApiKey),
// After:
getEnvironmentalData(lat, lng, highwayDriveMinutes, fips),
```

d. The `buildClimateChapterHTML` in `chapters.js` at line ~1692 references `chapters.environment` which includes `floodRisk`. This is data flow via the `environment` object returned from `getEnvironmentalData` — no change needed, the module returns the same shape.

- [ ] **Step 6: Run full suite**

```bash
npx jest --no-coverage
```
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add src/modules/sensory/data.js tests/modules/sensory/data.test.js src/chapters.js
git commit -m "refactor: extract sensory module — 20 functions to src/modules/sensory/data.js"
```

---

## Task 9: Slim chapters.js to orchestrator only

**Files:**
- Modify: `src/chapters.js`

After Tasks 0–8, `chapters.js` should be mostly cleared of domain logic. This task verifies the final state and cleans up any remaining artifacts.

- [ ] **Step 1: Check remaining function count in chapters.js**

```bash
grep -c "^async function\|^function " src/chapters.js
```

Expected: 2–3 functions remaining (`buildChaptersHTML`, `getChapterData`, and minor helpers).

- [ ] **Step 2: Clean up unused imports at top of chapters.js**

After extraction, many constants and requires at the top of chapters.js are no longer used locally. Remove any `require` statements that are no longer referenced. The remaining imports should only be what `getChapterData` and `buildChaptersHTML` directly need:

```js
'use strict';

const { getCensusFIPS } = require('./shared/census');
const { getBasementContext, detectRuralMode } = require('./shared/validate');
const { logError } = require('./logger');

// Module imports (all domain functions now live here)
const { getDemographics } = require('./modules/community/data');
const { getPropertyData } = require('./modules/property/data');
const { getWalkabilityScore } = require('./modules/walkability/data');
const { getEmergencyServices, getSafetyLocationContext } = require('./modules/safety/data');
const { getEnvironmentalData } = require('./modules/sensory/data');
const { findNearestSchool, findNearestElementarySchool } = require('./modules/schools/data');
const { getGrowthAndDevelopment } = require('./modules/growth/data');
const { getPropertyIntelligence } = require('./modules/property/data');
const { getGardenData, filterReptiles, filterInsects, filterButterflies,
        categorizeSeasonalBirds, categorizePlantsByForm,
        getMonarchCorridorInfo, getFireflyHabitat } = require('./modules/garden/data');
const { getClimateHistoryData,
        getEmergencySystem, getLastSignificantEvent, computeRarityStatement,
        classifyTopographicPosition, getWatershedContext, fetchElevationWithRetry } = require('./modules/climate/data');

// Template builders
const { buildClimateChapterHTML } = require('./templates/chapters/climate');
const { buildWhatWillGrowHTML } = require('./templates/chapters/garden');
const { buildSchoolRatingsHTML } = require('./templates/chapters/schools');
const { buildCrimeHTML, buildEmergencyServicesHTML } = require('./templates/chapters/safety');
const { buildSensoryEnvironmentalHTML } = require('./templates/chapters/sensory');
const { buildWalkabilityHTML } = require('./templates/chapters/walkability');
const { buildPropertyDataHTML } = require('./templates/chapters/costs');
const { buildDemographicsHTML } = require('./templates/chapters/community');
const { buildGrowthAndDevelopmentHTML } = require('./templates/chapters/growth');
const { buildPropertyIntelligenceHTML } = require('./templates/chapters/property');
```

- [ ] **Step 3: Verify chapters.js line count**

```bash
wc -l src/chapters.js
```

Expected: under 200 lines (was 1,709). The file should contain only `getChapterData`, `buildChaptersHTML`, and `module.exports`.

- [ ] **Step 4: Run full suite**

```bash
npx jest --no-coverage
```
Expected: all pass

- [ ] **Step 5: Update module-restructure.md status**

In `docs/plans/module-restructure.md`, update the Current Status section to mark all 8 domains as ✅ extracted.

- [ ] **Step 6: Commit**

```bash
git add src/chapters.js docs/plans/module-restructure.md
git commit -m "refactor: slim chapters.js to orchestrator — all domain logic extracted to modules"
```

---

## Self-Review

**Spec coverage:**
- [x] Garden: 13 functions extracted with tests
- [x] Community: 5 functions extracted with tests
- [x] Walkability: 2 functions extracted with tests
- [x] Safety: 4 functions extracted with tests
- [x] Climate: 9 functions extracted with tests (migrated from existing)
- [x] Property: 7 functions extracted with tests
- [x] Growth: 4 functions extracted with tests
- [x] Sensory: 20 functions extracted with tests (added from scratch)
- [x] safeInt moved to text.js
- [x] Schools deduplication resolved
- [x] chapters.js slimmed to orchestrator
- [x] Direct import pattern throughout (no googleMapsClient param threading)
- [x] All test files create/migrate per module

**Consistency check:**
- `getEnvironmentalData` signature in chapters.js call and module definition are aligned (remove googleMapsClient, googleMapsApiKey)
- `getGrowthAndDevelopment` same
- `getWalkabilityScore` same
- `getEmergencyServices` same (add, no googleMapsClient param in module)
- All modules import `{ googleMapsClient, googleMapsApiKey } = require('../../shared/google/client')` directly

**No placeholders found.** Every task has exact file paths, exact line ranges to copy, exact function signatures showing what changes.
