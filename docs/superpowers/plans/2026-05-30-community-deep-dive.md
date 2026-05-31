# Community Deep Dive (FR-046) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add L3 (Deep Read) and L4 (Research) depth content to the Community & Demographics chapter, backed by four new Census ACS data groups fetched in a new `varsBatch3`.

**Architecture:** Pure transform helpers are added to `src/modules/community/data.js` and exported for unit testing. L3 tab functions and L4 table builder are added to `src/templates/chapters/community.js`. `buildDemographicsHTML` is updated to construct `fullHTML` from the new L3/L4 output and pass it to `renderChapterCard`. No new files and no new CSS — existing tab classes from Climate and bar classes from Community L2 are reused throughout.

**Tech Stack:** Node.js, Jest (test runner: `npm test`), Census ACS API (already integrated), existing CSS classes (`climate-tab`, `climate-tab-panel`, `prem-age-row`, `prem-age-fill`, `prem-demo-note`, `climate-data-table`, `climate-table-scroll`, `climate-research-section`)

---

## File Map

| File | Change |
|---|---|
| `src/modules/community/data.js` | Add `suppressed()`, `groupIncomeBrackets()`, `buildEducationLadder()`, `buildHouseholdComposition()`, `buildCommuteMode()`, `buildTractFips()`. Add `varsBatch3`. Expand `getDemographics()` return object. Export all new helpers. |
| `src/templates/chapters/community.js` | Add `buildIncomeTab()`, `buildEducationTab()`, `buildHouseholdTab()`, `buildCommuteTab()`, `buildCommunityDeepDiveHTML()`, `buildCommunityResearchHTML()`. Update `buildDemographicsHTML()` to wire `fullHTML`. |
| `tests/modules/community/data.test.js` | Extend mock map with new variables. Add test suites for each new helper and new fields on `getDemographics()` return. |
| `tests/templates/chapters/community.test.js` | Add test suites for `buildDemographicsHTML` with L3/L4: `depth-l3`, `depth-l4`, tab presence, suppression note, no inline styles. |

---

## Task 1: `suppressed()` helper + `groupIncomeBrackets()` — TDD

**Files:**
- Modify: `tests/modules/community/data.test.js`
- Modify: `src/modules/community/data.js`

- [ ] **Step 1: Write failing tests for `suppressed()` and `groupIncomeBrackets()`**

Add to `tests/modules/community/data.test.js` (after existing imports, add the new named imports; add these `describe` blocks at the end of the file):

```js
const {
  getDemographics,
  getIncomeLevel,
  getEducationLevel,
  getDensityType,
  getCommunityType,
  suppressed,
  groupIncomeBrackets,
} = require('../../../src/modules/community/data');
```

Replace the existing require at line 9–15 with that expanded destructure, then add at the end of the file:

```js
describe('suppressed', () => {
  test('positive integer returns the integer', () => expect(suppressed('500')).toBe(500));
  test('zero returns 0', () => expect(suppressed('0')).toBe(0));
  test('ACS suppression sentinel -666666666 returns null', () => expect(suppressed('-666666666')).toBeNull());
  test('negative number returns null', () => expect(suppressed('-1')).toBeNull());
  test('NaN string returns null', () => expect(suppressed('N/A')).toBeNull());
  test('undefined returns null', () => expect(suppressed(undefined)).toBeNull());
  test('null returns null', () => expect(suppressed(null)).toBeNull());
});

describe('groupIncomeBrackets', () => {
  function makeGet(map) { return (k) => map[k]; }

  test('returns null when total is 0', () => {
    expect(groupIncomeBrackets(makeGet({ B19001_001E: '0' }))).toBeNull();
  });

  test('returns null when total is missing', () => {
    expect(groupIncomeBrackets(makeGet({}))).toBeNull();
  });

  test('brackets sum to roughly 100% when all data present', () => {
    const map = {
      B19001_001E: '1000',
      B19001_002E: '50', B19001_003E: '50', B19001_004E: '50', B19001_005E: '50',   // under 25k = 200
      B19001_006E: '50', B19001_007E: '50', B19001_008E: '50', B19001_009E: '50', B19001_010E: '50', // 25-50k = 250
      B19001_011E: '100', B19001_012E: '80',  // 50-75k = 180
      B19001_013E: '100',                      // 75-100k = 100
      B19001_014E: '50', B19001_015E: '50', B19001_016E: '100', B19001_017E: '70', // 100k+ = 270
    };
    const result = groupIncomeBrackets(makeGet(map));
    expect(result).not.toBeNull();
    expect(result.brackets).toHaveLength(5);
    const total = result.brackets.reduce((s, b) => s + b.pct, 0);
    expect(total).toBeGreaterThanOrEqual(99);
    expect(total).toBeLessThanOrEqual(101);
  });

  test('bracket labels are correct', () => {
    const map = { B19001_001E: '100', B19001_002E: '25', B19001_003E: '0', B19001_004E: '0', B19001_005E: '0' };
    const result = groupIncomeBrackets(makeGet(map));
    expect(result.brackets[0].label).toBe('Under $25k');
    expect(result.brackets[4].label).toBe('$100k+');
  });

  test('suppressed cell sets hasSuppressed and counts as 0', () => {
    const map = {
      B19001_001E: '1000',
      B19001_002E: '-666666666',
      B19001_003E: '200', B19001_004E: '0', B19001_005E: '0',
      B19001_006E: '0', B19001_007E: '0', B19001_008E: '0', B19001_009E: '0', B19001_010E: '0',
      B19001_011E: '0', B19001_012E: '0',
      B19001_013E: '0',
      B19001_014E: '0', B19001_015E: '0', B19001_016E: '0', B19001_017E: '0',
    };
    const result = groupIncomeBrackets(makeGet(map));
    expect(result.hasSuppressed).toBe(true);
    expect(result.brackets[0].count).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- --testPathPattern="tests/modules/community/data" --no-coverage
```

Expected: failures on `suppressed` and `groupIncomeBrackets` — "is not a function"

- [ ] **Step 3: Implement `suppressed()` and `groupIncomeBrackets()` in `data.js`**

Add these two functions before the `module.exports` line in `src/modules/community/data.js`:

```js
function suppressed(val) {
  const n = parseInt(val, 10);
  return (isNaN(n) || n < 0) ? null : n;
}

function groupIncomeBrackets(get) {
  const total = suppressed(get('B19001_001E'));
  if (!total || total === 0) return null;

  const buckets = [
    { label: 'Under $25k',   vars: ['B19001_002E','B19001_003E','B19001_004E','B19001_005E'] },
    { label: '$25k–$50k',    vars: ['B19001_006E','B19001_007E','B19001_008E','B19001_009E','B19001_010E'] },
    { label: '$50k–$75k',    vars: ['B19001_011E','B19001_012E'] },
    { label: '$75k–$100k',   vars: ['B19001_013E'] },
    { label: '$100k+',       vars: ['B19001_014E','B19001_015E','B19001_016E','B19001_017E'] },
  ];

  let hasSuppressed = false;
  const brackets = buckets.map(({ label, vars: names }) => {
    let count = 0;
    for (const n of names) {
      const v = suppressed(get(n));
      if (v === null) { hasSuppressed = true; }
      else { count += v; }
    }
    return { label, count, pct: Math.round(count / total * 100) };
  });

  return { totalHouseholds: total, brackets, hasSuppressed };
}
```

Add `suppressed` and `groupIncomeBrackets` to `module.exports`:

```js
module.exports = {
  getDemographics,
  getIncomeLevel,
  getEducationLevel,
  getDensityType,
  getCommunityType,
  suppressed,
  groupIncomeBrackets,
};
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- --testPathPattern="tests/modules/community/data" --no-coverage
```

Expected: all tests in `suppressed` and `groupIncomeBrackets` describe blocks PASS

- [ ] **Step 5: Commit**

```
git add src/modules/community/data.js tests/modules/community/data.test.js
git commit -m "feat(fr-046): add suppressed helper and groupIncomeBrackets transform"
```

---

## Task 2: `buildEducationLadder()` + `buildHouseholdComposition()` — TDD

**Files:**
- Modify: `tests/modules/community/data.test.js`
- Modify: `src/modules/community/data.js`

- [ ] **Step 1: Write failing tests**

Add to the imports at the top of `tests/modules/community/data.test.js`:

```js
const {
  getDemographics,
  getIncomeLevel,
  getEducationLevel,
  getDensityType,
  getCommunityType,
  suppressed,
  groupIncomeBrackets,
  buildEducationLadder,
  buildHouseholdComposition,
} = require('../../../src/modules/community/data');
```

Add at the end of the test file:

```js
describe('buildEducationLadder', () => {
  function makeGet(map) { return (k) => map[k]; }

  test('returns null when total is 0', () => {
    expect(buildEducationLadder(makeGet({ B15003_001E: '0' }))).toBeNull();
  });

  test('returns null when total is missing', () => {
    expect(buildEducationLadder(makeGet({}))).toBeNull();
  });

  test('returns 5 steps', () => {
    const map = {
      B15003_001E: '1000',
      B15003_017E: '200', B15003_018E: '50',
      B15003_019E: '80',  B15003_020E: '70', B15003_021E: '100',
      B15003_022E: '200',
      B15003_023E: '100', B15003_024E: '50', B15003_025E: '50',
    };
    const result = buildEducationLadder(makeGet(map));
    expect(result.steps).toHaveLength(5);
  });

  test('step labels match spec', () => {
    const map = { B15003_001E: '100', B15003_017E: '0', B15003_018E: '0', B15003_019E: '0', B15003_020E: '0', B15003_021E: '0', B15003_022E: '0', B15003_023E: '0', B15003_024E: '0', B15003_025E: '0' };
    const result = buildEducationLadder(makeGet(map));
    expect(result.steps[0].label).toBe('Less than high school');
    expect(result.steps[1].label).toBe('High school / GED');
    expect(result.steps[2].label).toBe("Some college / Associate's");
    expect(result.steps[3].label).toBe("Bachelor's degree");
    expect(result.steps[4].label).toBe('Graduate degree');
  });

  test('less-than-HS is derived as remainder not fetched directly', () => {
    const map = {
      B15003_001E: '1000',
      B15003_017E: '300', B15003_018E: '0',
      B15003_019E: '0',   B15003_020E: '0', B15003_021E: '0',
      B15003_022E: '400',
      B15003_023E: '0',   B15003_024E: '0', B15003_025E: '0',
    };
    // total=1000, hs=300, bach=400, everything else=0 → lessHS = 1000 - 700 = 300 → 30%
    const result = buildEducationLadder(makeGet(map));
    expect(result.steps[0].pct).toBe(30);
  });

  test('pcts are non-negative even if Census data has rounding gaps', () => {
    const map = {
      B15003_001E: '100',
      B15003_017E: '30', B15003_018E: '0', B15003_019E: '0', B15003_020E: '0', B15003_021E: '0',
      B15003_022E: '40', B15003_023E: '15', B15003_024E: '5', B15003_025E: '10',
    };
    const result = buildEducationLadder(makeGet(map));
    for (const s of result.steps) expect(s.pct).toBeGreaterThanOrEqual(0);
  });
});

describe('buildHouseholdComposition', () => {
  function makeGet(map) { return (k) => map[k]; }

  test('returns null when total is 0', () => {
    expect(buildHouseholdComposition(makeGet({ B11001_001E: '0' }))).toBeNull();
  });

  test('returns null when total is missing', () => {
    expect(buildHouseholdComposition(makeGet({}))).toBeNull();
  });

  test('familyPct is correct', () => {
    const map = {
      B11001_001E: '1000',
      B11001_002E: '700',
      B11001_003E: '500',
      B11001_005E: '100',
      B11001_006E: '100',
      B11001_007E: '300',
      B11001_008E: '200',
    };
    const result = buildHouseholdComposition(makeGet(map));
    expect(result.familyPct).toBe(70);
    expect(result.marriedCouplePct).toBe(50);
    expect(result.singleParentPct).toBe(20);
    expect(result.nonfamilyPct).toBe(30);
    expect(result.livingAlonePct).toBe(20);
    expect(result.totalHouseholds).toBe(1000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- --testPathPattern="tests/modules/community/data" --no-coverage
```

Expected: failures on `buildEducationLadder` and `buildHouseholdComposition` — "is not a function"

- [ ] **Step 3: Implement `buildEducationLadder()` and `buildHouseholdComposition()` in `data.js`**

Add before `module.exports`:

```js
function buildEducationLadder(get) {
  const total = suppressed(get('B15003_001E'));
  if (!total || total === 0) return null;

  const hs     = suppressed(get('B15003_017E')) || 0;
  const ged    = suppressed(get('B15003_018E')) || 0;
  const sc1    = suppressed(get('B15003_019E')) || 0;
  const sc2    = suppressed(get('B15003_020E')) || 0;
  const assoc  = suppressed(get('B15003_021E')) || 0;
  const bach   = suppressed(get('B15003_022E')) || 0;
  const master = suppressed(get('B15003_023E')) || 0;
  const prof   = suppressed(get('B15003_024E')) || 0;
  const doc    = suppressed(get('B15003_025E')) || 0;

  const known     = hs + ged + sc1 + sc2 + assoc + bach + master + prof + doc;
  const lessHS    = Math.max(0, total - known);
  const pct = (n) => Math.round(n / total * 100);

  return {
    totalAdults: total,
    steps: [
      { label: 'Less than high school',       pct: pct(lessHS) },
      { label: 'High school / GED',           pct: pct(hs + ged) },
      { label: "Some college / Associate's",  pct: pct(sc1 + sc2 + assoc) },
      { label: "Bachelor's degree",           pct: pct(bach) },
      { label: 'Graduate degree',             pct: pct(master + prof + doc) },
    ],
  };
}

function buildHouseholdComposition(get) {
  const total = suppressed(get('B11001_001E'));
  if (!total || total === 0) return null;

  const family      = suppressed(get('B11001_002E')) || 0;
  const married     = suppressed(get('B11001_003E')) || 0;
  const maleSingle  = suppressed(get('B11001_005E')) || 0;
  const femSingle   = suppressed(get('B11001_006E')) || 0;
  const nonfamily   = suppressed(get('B11001_007E')) || 0;
  const alone       = suppressed(get('B11001_008E')) || 0;
  const pct = (n) => Math.round(n / total * 100);

  return {
    totalHouseholds: total,
    familyPct:       pct(family),
    marriedCouplePct: pct(married),
    singleParentPct:  pct(maleSingle + femSingle),
    nonfamilyPct:    pct(nonfamily),
    livingAlonePct:  pct(alone),
  };
}
```

Update `module.exports`:

```js
module.exports = {
  getDemographics,
  getIncomeLevel,
  getEducationLevel,
  getDensityType,
  getCommunityType,
  suppressed,
  groupIncomeBrackets,
  buildEducationLadder,
  buildHouseholdComposition,
};
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- --testPathPattern="tests/modules/community/data" --no-coverage
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```
git add src/modules/community/data.js tests/modules/community/data.test.js
git commit -m "feat(fr-046): add buildEducationLadder and buildHouseholdComposition transforms"
```

---

## Task 3: `buildCommuteMode()` + `buildTractFips()` — TDD

**Files:**
- Modify: `tests/modules/community/data.test.js`
- Modify: `src/modules/community/data.js`

- [ ] **Step 1: Write failing tests**

Update imports in `tests/modules/community/data.test.js` to include `buildCommuteMode` and `buildTractFips`. Add at end of file:

```js
const {
  getDemographics, getIncomeLevel, getEducationLevel, getDensityType, getCommunityType,
  suppressed, groupIncomeBrackets, buildEducationLadder, buildHouseholdComposition,
  buildCommuteMode, buildTractFips,
} = require('../../../src/modules/community/data');
```

Replace the existing require block (update in place). Then add:

```js
describe('buildCommuteMode', () => {
  function makeGet(map) { return (k) => map[k]; }

  test('returns null when total workers is 0', () => {
    expect(buildCommuteMode(makeGet({ B08006_001E: '0' }))).toBeNull();
  });

  test('returns null when total workers is missing', () => {
    expect(buildCommuteMode(makeGet({}))).toBeNull();
  });

  test('droveAlonePct is correct', () => {
    const map = {
      B08006_001E: '1000',
      B08006_002E: '700',
      B08006_003E: '100',
      B08006_008E: '50',
      B08006_014E: '10',
      B08006_015E: '40',
      B08006_016E: '20',
      B08006_017E: '80',
    };
    const result = buildCommuteMode(makeGet(map));
    expect(result.droveAlonePct).toBe(70);
    expect(result.carpoolPct).toBe(10);
    expect(result.transitPct).toBe(5);
    expect(result.wfhPct).toBe(8);
    expect(result.totalWorkers).toBe(1000);
  });

  test('suppressed cell treated as 0', () => {
    const map = {
      B08006_001E: '1000',
      B08006_002E: '-666666666',
      B08006_003E: '0', B08006_008E: '0', B08006_014E: '0',
      B08006_015E: '0', B08006_016E: '0', B08006_017E: '0',
    };
    const result = buildCommuteMode(makeGet(map));
    expect(result.droveAlonePct).toBe(0);
  });
});

describe('buildTractFips', () => {
  test('returns null when fips is null', () => {
    expect(buildTractFips(null)).toBeNull();
  });

  test('returns null when any component is missing', () => {
    expect(buildTractFips({ state: '21', county: '077' })).toBeNull();
  });

  test('pads state to 2 digits, county to 3, tract to 6', () => {
    const result = buildTractFips({ state: '1', county: '1', tract: '1' });
    expect(result.state).toBe('01');
    expect(result.county).toBe('001');
    expect(result.tract).toBe('000001');
  });

  test('censusExplorerUrl contains all FIPS components', () => {
    const result = buildTractFips({ state: '21', county: '077', tract: '010101' });
    expect(result.censusExplorerUrl).toBe('https://data.census.gov/table?g=1400000US21077010101');
  });

  test('does not mutate the input fips object', () => {
    const fips = { state: '21', county: '077', tract: '010101' };
    buildTractFips(fips);
    expect(fips.state).toBe('21');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- --testPathPattern="tests/modules/community/data" --no-coverage
```

Expected: failures on `buildCommuteMode` and `buildTractFips` — "is not a function"

- [ ] **Step 3: Implement in `data.js`**

Add before `module.exports`:

```js
function buildCommuteMode(get) {
  const total = suppressed(get('B08006_001E'));
  if (!total || total === 0) return null;

  const pct = (varName) => Math.round((suppressed(get(varName)) || 0) / total * 100);

  return {
    totalWorkers:  total,
    droveAlonePct: pct('B08006_002E'),
    carpoolPct:    pct('B08006_003E'),
    transitPct:    pct('B08006_008E'),
    bicyclePct:    pct('B08006_014E'),
    walkedPct:     pct('B08006_015E'),
    otherPct:      pct('B08006_016E'),
    wfhPct:        pct('B08006_017E'),
  };
}

function buildTractFips(fips) {
  if (!fips?.state || !fips?.county || !fips?.tract) return null;
  const state  = String(fips.state).padStart(2, '0');
  const county = String(fips.county).padStart(3, '0');
  const tract  = String(fips.tract).padStart(6, '0');
  return {
    state,
    county,
    tract,
    censusExplorerUrl: `https://data.census.gov/table?g=1400000US${state}${county}${tract}`,
  };
}
```

Update `module.exports`:

```js
module.exports = {
  getDemographics,
  getIncomeLevel,
  getEducationLevel,
  getDensityType,
  getCommunityType,
  suppressed,
  groupIncomeBrackets,
  buildEducationLadder,
  buildHouseholdComposition,
  buildCommuteMode,
  buildTractFips,
};
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- --testPathPattern="tests/modules/community/data" --no-coverage
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```
git add src/modules/community/data.js tests/modules/community/data.test.js
git commit -m "feat(fr-046): add buildCommuteMode and buildTractFips transforms"
```

---

## Task 4: Expand `getDemographics()` — `varsBatch3` + new return fields — TDD

**Files:**
- Modify: `tests/modules/community/data.test.js`
- Modify: `src/modules/community/data.js`

- [ ] **Step 1: Write failing tests for new return fields**

In `tests/modules/community/data.test.js`, find the `getDemographics` describe block and update the mock to include batch3 variables, then add assertions for new fields:

Replace the entire `describe('getDemographics', ...)` block with:

```js
describe('getDemographics', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns null when fetchCensusACS returns null', async () => {
    fetchCensusACS.mockResolvedValue(null);
    const result = await getDemographics(38.2, -84.5, { state: '21', county: '077', tract: '0101' });
    expect(result).toBeNull();
  });

  test('returns structured object with existing L2 fields', async () => {
    const mockMap = buildFullMockMap();
    fetchCensusACS.mockResolvedValue(mockMap);
    const result = await getDemographics(38.2, -84.5, { state: '21', county: '077', tract: '0101' });
    expect(result).not.toBeNull();
    expect(result.income.median).toBe(65000);
    expect(result.community.ownershipRate).toBe(75);
    expect(result).toHaveProperty('age');
    expect(result).toHaveProperty('education');
  });

  test('returns incomeDistribution with brackets', async () => {
    const mockMap = buildFullMockMap();
    fetchCensusACS.mockResolvedValue(mockMap);
    const result = await getDemographics(38.2, -84.5, { state: '21', county: '077', tract: '0101' });
    expect(result).toHaveProperty('incomeDistribution');
    expect(result.incomeDistribution.brackets).toHaveLength(5);
  });

  test('returns educationLadder with 5 steps', async () => {
    const mockMap = buildFullMockMap();
    fetchCensusACS.mockResolvedValue(mockMap);
    const result = await getDemographics(38.2, -84.5, { state: '21', county: '077', tract: '0101' });
    expect(result).toHaveProperty('educationLadder');
    expect(result.educationLadder.steps).toHaveLength(5);
  });

  test('returns householdComposition', async () => {
    const mockMap = buildFullMockMap();
    fetchCensusACS.mockResolvedValue(mockMap);
    const result = await getDemographics(38.2, -84.5, { state: '21', county: '077', tract: '0101' });
    expect(result).toHaveProperty('householdComposition');
    expect(result.householdComposition).toHaveProperty('familyPct');
  });

  test('returns commuteMode', async () => {
    const mockMap = buildFullMockMap();
    fetchCensusACS.mockResolvedValue(mockMap);
    const result = await getDemographics(38.2, -84.5, { state: '21', county: '077', tract: '0101' });
    expect(result).toHaveProperty('commuteMode');
    expect(result.commuteMode).toHaveProperty('droveAlonePct');
  });

  test('returns tractFips with censusExplorerUrl', async () => {
    const mockMap = buildFullMockMap();
    fetchCensusACS.mockResolvedValue(mockMap);
    const result = await getDemographics(38.2, -84.5, { state: '21', county: '077', tract: '010101' });
    expect(result).toHaveProperty('tractFips');
    expect(result.tractFips.censusExplorerUrl).toContain('data.census.gov');
  });
});
```

Add the helper function `buildFullMockMap` at the top of the describe block (or as a module-level helper before the describe blocks):

```js
function buildFullMockMap() {
  const vars = [
    // Existing L2 variables
    ['B01001_001E', '5000'], ['B01002_001E', '38'],
    ['B19013_001E', '65000'], ['B25003_001E', '2000'],
    ['B25003_002E', '1500'], ['B25010_001E', '2.5'],
    ['B15003_001E', '3000'], ['B15003_017E', '500'],
    ['B15003_022E', '400'], ['B15003_023E', '200'],
    ['B15003_024E', '50'], ['B15003_025E', '50'],
    ['B25039_001E', '2010'],
    // Education new
    ['B15003_018E', '100'], ['B15003_019E', '80'],
    ['B15003_020E', '70'],  ['B15003_021E', '100'],
    // Income distribution — total 1000 households
    ['B19001_001E', '1000'],
    ['B19001_002E', '50'], ['B19001_003E', '50'], ['B19001_004E', '50'], ['B19001_005E', '50'],
    ['B19001_006E', '50'], ['B19001_007E', '50'], ['B19001_008E', '50'], ['B19001_009E', '50'], ['B19001_010E', '50'],
    ['B19001_011E', '100'], ['B19001_012E', '80'],
    ['B19001_013E', '100'],
    ['B19001_014E', '50'], ['B19001_015E', '50'], ['B19001_016E', '100'], ['B19001_017E', '70'],
    // Household composition — total 1000 households
    ['B11001_001E', '1000'], ['B11001_002E', '700'], ['B11001_003E', '500'],
    ['B11001_005E', '100'], ['B11001_006E', '100'], ['B11001_007E', '300'], ['B11001_008E', '200'],
    // Commute mode — total 2000 workers
    ['B08006_001E', '2000'], ['B08006_002E', '1400'], ['B08006_003E', '200'],
    ['B08006_008E', '100'], ['B08006_014E', '20'], ['B08006_015E', '80'],
    ['B08006_016E', '40'],  ['B08006_017E', '160'],
  ];
  // Age variables (B01001 sex-by-age detail)
  for (let i = 3; i <= 25; i++) vars.push([`B01001_0${String(i).padStart(2,'0')}E`, '100']);
  for (let i = 27; i <= 49; i++) vars.push([`B01001_0${String(i).padStart(2,'0')}E`, '100']);
  return new Map(vars);
}
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- --testPathPattern="tests/modules/community/data" --no-coverage
```

Expected: failures on new `getDemographics` tests — the new fields are missing from the return object

- [ ] **Step 3: Expand `getDemographics()` in `data.js`**

In `src/modules/community/data.js`, find the `async function getDemographics(lat, lng, fips)` function and make these changes:

**3a.** Add `varsBatch3` after the existing `varsBatch2`:

```js
const varsBatch3 = [
  // Income distribution (B19001)
  'B19001_001E','B19001_002E','B19001_003E','B19001_004E','B19001_005E',
  'B19001_006E','B19001_007E','B19001_008E','B19001_009E','B19001_010E',
  'B19001_011E','B19001_012E','B19001_013E','B19001_014E','B19001_015E',
  'B19001_016E','B19001_017E',
  // Education additions (B15003)
  'B15003_018E','B15003_019E','B15003_020E','B15003_021E',
  // Household composition (B11001)
  'B11001_001E','B11001_002E','B11001_003E','B11001_005E',
  'B11001_006E','B11001_007E','B11001_008E',
  // Commute mode (B08006)
  'B08006_001E','B08006_002E','B08006_003E','B08006_008E',
  'B08006_014E','B08006_015E','B08006_016E','B08006_017E',
];
```

**3b.** Replace the `Promise.all` call and the `get` function:

Old:
```js
const [acs1, acs2] = await Promise.all([
  fetchCensusACS(fips, varsBatch1),
  fetchCensusACS(fips, varsBatch2),
]);
if (!acs1) return null;
const get = (name) => acs1.get(name) ?? (acs2 ? acs2.get(name) : undefined);
```

New:
```js
const [acs1, acs2, acs3] = await Promise.all([
  fetchCensusACS(fips, varsBatch1),
  fetchCensusACS(fips, varsBatch2),
  fetchCensusACS(fips, varsBatch3),
]);
if (!acs1) return null;
const get = (name) => acs1.get(name) ?? acs2?.get(name) ?? acs3?.get(name);
```

**3c.** In the `return { ... }` at the end of the try block, add four new fields after the existing ones:

```js
    return {
      totalPop,
      medianAge,
      age: { under18: under18Pct, age18to34: age18to34Pct, age35to64: age35to64Pct, age65plus: age65plusPct, primaryGroup },
      income: { median: medianIncome > 0 ? medianIncome : null, level: getIncomeLevel(medianIncome) },
      education: { bachelor: bachelorPct, graduate: graduatePct, collegePct, level: getEducationLevel(collegePct) },
      community: {
        ownershipRate,
        avgHHSize,
        medianTenureYears,
        type: getCommunityType(ownershipRate, avgHHSize),
        densityType: getDensityType(totalPop),
      },
      incomeDistribution:    groupIncomeBrackets(get),
      educationLadder:       buildEducationLadder(get),
      householdComposition:  buildHouseholdComposition(get),
      commuteMode:           buildCommuteMode(get),
      tractFips:             buildTractFips(fips),
    };
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- --testPathPattern="tests/modules/community/data" --no-coverage
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```
git add src/modules/community/data.js tests/modules/community/data.test.js
git commit -m "feat(fr-046): expand getDemographics with varsBatch3 and new return fields"
```

---

## Task 5: L3 tab builder functions — TDD

**Files:**
- Modify: `tests/templates/chapters/community.test.js`
- Modify: `src/templates/chapters/community.js`

The tab functions are private helpers (not exported) — they are tested indirectly through `buildDemographicsHTML`. Write the tests first to describe expected output, then implement.

- [ ] **Step 1: Add a complete demographics fixture with L3 fields to the test file**

In `tests/templates/chapters/community.test.js`, add a new fixture after `baseDemographics`:

```js
const fullDemographics = {
  ...baseDemographics,
  incomeDistribution: {
    totalHouseholds: 1000,
    hasSuppressed: false,
    brackets: [
      { label: 'Under $25k',  pct: 18, count: 180 },
      { label: '$25k–$50k',   pct: 22, count: 220 },
      { label: '$50k–$75k',   pct: 20, count: 200 },
      { label: '$75k–$100k',  pct: 15, count: 150 },
      { label: '$100k+',      pct: 25, count: 250 },
    ],
  },
  educationLadder: {
    totalAdults: 3000,
    steps: [
      { label: 'Less than high school',      pct: 10 },
      { label: 'High school / GED',          pct: 28 },
      { label: "Some college / Associate's", pct: 22 },
      { label: "Bachelor's degree",          pct: 25 },
      { label: 'Graduate degree',            pct: 15 },
    ],
  },
  householdComposition: {
    totalHouseholds: 1000,
    familyPct: 65,
    marriedCouplePct: 45,
    singleParentPct: 20,
    nonfamilyPct: 35,
    livingAlonePct: 22,
  },
  commuteMode: {
    totalWorkers: 2000,
    droveAlonePct: 72,
    carpoolPct: 10,
    transitPct: 4,
    bicyclePct: 1,
    walkedPct: 3,
    otherPct: 2,
    wfhPct: 8,
  },
  tractFips: {
    state: '21',
    county: '077',
    tract: '010101',
    censusExplorerUrl: 'https://data.census.gov/table?g=1400000US21077010101',
  },
};
```

- [ ] **Step 2: Write failing tests for L3/L4 output in `buildDemographicsHTML`**

Add a new describe block at the end of `tests/templates/chapters/community.test.js`:

```js
describe('buildDemographicsHTML — L3 deep dive', () => {
  test('depth-l3 wrapper present when incomeDistribution present', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/depth-l3/);
  });

  test('community-deep-dive container rendered', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/community-deep-dive/);
  });

  test('Income Distribution tab rendered', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/Income Distribution/);
  });

  test('Education Ladder tab rendered', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/Education Ladder/);
  });

  test('Household Types tab rendered', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/Household Types/);
  });

  test('How People Get to Work tab rendered', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/How People Get to Work/);
  });

  test('income bracket labels appear in output', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/Under \$25k/);
    expect(html).toMatch(/\$100k\+/);
  });

  test('education step labels appear in output', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/Less than high school/);
    expect(html).toMatch(/Graduate degree/);
  });

  test('household composition stats appear', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/65%/);   // familyPct
  });

  test('commute mode stats appear', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/72%/);   // droveAlonePct
  });

  test('suppressed note shown when hasSuppressed is true', () => {
    const d = { ...fullDemographics, incomeDistribution: { ...fullDemographics.incomeDistribution, hasSuppressed: true } };
    const html = buildDemographicsHTML(d);
    expect(html).toMatch(/suppressed/i);
  });

  test('L3 absent when all deep-dive fields are null', () => {
    const d = { ...baseDemographics, incomeDistribution: null, educationLadder: null, householdComposition: null, commuteMode: null, tractFips: null };
    const html = buildDemographicsHTML(d);
    expect(html).not.toMatch(/community-deep-dive/);
  });

  test('missing commuteMode does not render commute tab', () => {
    const d = { ...fullDemographics, commuteMode: null };
    const html = buildDemographicsHTML(d);
    expect(html).not.toMatch(/How People Get to Work/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildDemographicsHTML(fullDemographics);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

describe('buildDemographicsHTML — L4 research', () => {
  test('depth-l4 wrapper present when incomeDistribution present', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/depth-l4/);
  });

  test('income raw count table rendered', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/climate-research-section/);
    expect(html).toMatch(/climate-data-table/);
  });

  test('census explorer link rendered', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/data\.census\.gov/);
  });

  test('L4 absent when no deep-dive data', () => {
    const d = { ...baseDemographics, incomeDistribution: null, educationLadder: null, tractFips: null };
    const html = buildDemographicsHTML(d);
    expect(html).not.toMatch(/depth-l4/);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```
npm test -- --testPathPattern="tests/templates/chapters/community" --no-coverage
```

Expected: failures — `depth-l3`, `community-deep-dive`, tab labels not found

- [ ] **Step 4: Implement tab builder functions in `src/templates/chapters/community.js`**

Add these functions before `buildDemographicsHTML`:

```js
function buildIncomeTab(dist, medianIncome) {
  const national = [22, 23, 18, 14, 23];
  const medianNote = medianIncome ? `Median household income in this tract: ${formatMoney(medianIncome)}.` : '';
  const suppressedNote = dist.hasSuppressed ? ' Some income brackets had suppressed data (small cell counts) and are shown as 0.' : '';

  const bars = dist.brackets.map((b, i) => {
    const diff = b.pct - national[i];
    const diffLabel = diff > 2 ? `(${diff} pts above US avg)`
      : diff < -2 ? `(${Math.abs(diff)} pts below US avg)`
      : '(near US avg)';
    return `
      <div class="prem-age-row">
        <span class="prem-age-label">${escapeHtml(b.label)}</span>
        <div class="prem-age-track"><div class="prem-age-fill" data-w="${b.pct}"></div></div>
        <span class="prem-age-pct">${b.pct}%</span>
      </div>
      <div class="prem-demo-note">${escapeHtml(diffLabel)}</div>`;
  }).join('');

  return `
    <p class="prem-narrative-body">${medianNote} Distribution of households across income brackets for this Census tract.${suppressedNote}</p>
    ${bars}
    <p class="prem-disclaimer">Source: U.S. Census Bureau ACS 5-year estimates, Table B19001. US averages: approx. 22% under $25k, 23% $25–50k, 18% $50–75k, 14% $75–100k, 23% over $100k.</p>`;
}

function buildEducationTab(ladder) {
  const national = [12, 27, 20, 20, 13];
  const bars = ladder.steps.map((s, i) => {
    const diff = s.pct - national[i];
    const diffLabel = diff > 2 ? `(${diff} pts above US avg)`
      : diff < -2 ? `(${Math.abs(diff)} pts below US avg)`
      : '(near US avg)';
    return `
      <div class="prem-age-row">
        <span class="prem-age-label">${escapeHtml(s.label)}</span>
        <div class="prem-age-track"><div class="prem-age-fill" data-w="${s.pct}"></div></div>
        <span class="prem-age-pct">${s.pct}%</span>
      </div>
      <div class="prem-demo-note">${escapeHtml(diffLabel)}</div>`;
  }).join('');

  return `
    <p class="prem-narrative-body">Educational attainment for adults 25 and older in this Census tract.</p>
    ${bars}
    <p class="prem-disclaimer">Source: U.S. Census Bureau ACS 5-year estimates, Table B15003. US averages approximate.</p>`;
}

function buildHouseholdTab(comp) {
  const items = [
    { label: 'Family households',       pct: comp.familyPct },
    { label: 'Married-couple families', pct: comp.marriedCouplePct },
    { label: 'Single-parent families',  pct: comp.singleParentPct },
    { label: 'Non-family households',   pct: comp.nonfamilyPct },
    { label: 'Living alone',            pct: comp.livingAlonePct },
  ];

  const bars = items.map(it => `
    <div class="prem-age-row">
      <span class="prem-age-label">${escapeHtml(it.label)}</span>
      <div class="prem-age-track"><div class="prem-age-fill" data-w="${it.pct}"></div></div>
      <span class="prem-age-pct">${it.pct}%</span>
    </div>`).join('');

  return `
    <p class="prem-narrative-body">Household structure across the ${comp.totalHouseholds.toLocaleString()} households in this Census tract.</p>
    ${bars}
    <p class="prem-disclaimer">Source: U.S. Census Bureau ACS 5-year estimates, Table B11001.</p>`;
}

function buildCommuteTab(commute) {
  const modes = [
    { label: 'Drove alone',      pct: commute.droveAlonePct },
    { label: 'Carpooled',        pct: commute.carpoolPct },
    { label: 'Public transit',   pct: commute.transitPct },
    { label: 'Walked',           pct: commute.walkedPct },
    { label: 'Bicycle',          pct: commute.bicyclePct },
    { label: 'Worked from home', pct: commute.wfhPct },
    { label: 'Other',            pct: commute.otherPct },
  ].filter(m => m.pct > 0);

  const bars = modes.map(m => `
    <div class="prem-age-row">
      <span class="prem-age-label">${escapeHtml(m.label)}</span>
      <div class="prem-age-track"><div class="prem-age-fill" data-w="${m.pct}"></div></div>
      <span class="prem-age-pct">${m.pct}%</span>
    </div>`).join('');

  const transitNote = commute.transitPct > 10
    ? ` Transit at ${commute.transitPct}% suggests viable public transit infrastructure nearby.` : '';
  const wfhNote = commute.wfhPct > 25
    ? ` With ${commute.wfhPct}% working from home, expect higher daytime neighborhood activity than in drive-to-work areas.` : '';

  return `
    <p class="prem-narrative-body">How the ${commute.totalWorkers.toLocaleString()} workers in this tract commute.${transitNote}${wfhNote}</p>
    ${bars}
    <p class="prem-disclaimer">Source: U.S. Census Bureau ACS 5-year estimates, Table B08006.</p>`;
}
```

- [ ] **Step 5: Implement `buildCommunityDeepDiveHTML()` in `src/templates/chapters/community.js`**

Add after the four tab functions:

```js
function buildCommunityDeepDiveHTML(d) {
  if (!d) return '';

  const tabs = [
    d.incomeDistribution
      ? { id: 'income',    label: 'Income Distribution',      content: buildIncomeTab(d.incomeDistribution, d.income?.median) }
      : null,
    d.educationLadder
      ? { id: 'education', label: 'Education Ladder',          content: buildEducationTab(d.educationLadder) }
      : null,
    d.householdComposition
      ? { id: 'household', label: 'Household Types',           content: buildHouseholdTab(d.householdComposition) }
      : null,
    d.commuteMode
      ? { id: 'commute',   label: 'How People Get to Work',    content: buildCommuteTab(d.commuteMode) }
      : null,
  ].filter(Boolean);

  if (!tabs.length) return '';

  const tabButtons = tabs.map((t, i) =>
    `<button class="climate-tab${i === 0 ? ' climate-tab--active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="cdtab-${t.id}" id="cdbtn-${t.id}">${t.label}</button>`
  ).join('');

  const tabPanels = tabs.map((t, i) =>
    `<div class="climate-tab-panel${i === 0 ? ' climate-tab-panel--active' : ''}" id="cdtab-${t.id}" role="tabpanel" aria-labelledby="cdbtn-${t.id}">${t.content}</div>`
  ).join('');

  return `
    <div class="community-deep-dive">
      <div class="community-deep-dive-label">Demographics in Depth</div>
      <nav class="climate-tab-nav" role="tablist" aria-label="Community demographics deep dive">
        ${tabButtons}
      </nav>
      <div class="climate-tab-panels">
        ${tabPanels}
      </div>
    </div>`;
}
```

- [ ] **Step 6: Run tests to verify they pass**

```
npm test -- --testPathPattern="tests/templates/chapters/community" --no-coverage
```

Expected: all tests in the new `L3 deep dive` describe block PASS; no regressions in the existing `FR-045 glance bar` suite

- [ ] **Step 7: Commit**

```
git add src/templates/chapters/community.js tests/templates/chapters/community.test.js
git commit -m "feat(fr-046): add L3 tab builder functions and buildCommunityDeepDiveHTML"
```

---

## Task 6: `buildCommunityResearchHTML()` + wire `fullHTML` — TDD

**Files:**
- Modify: `src/templates/chapters/community.js`
- Modify: `tests/templates/chapters/community.test.js`

Tests for L4 were already written in Task 5 Step 2. This task implements the function and wires everything into `buildDemographicsHTML`.

- [ ] **Step 1: Implement `buildCommunityResearchHTML()` in `src/templates/chapters/community.js`**

Add after `buildCommunityDeepDiveHTML`:

```js
function buildCommunityResearchHTML(d) {
  if (!d) return '';

  const incomeTable = d.incomeDistribution?.brackets?.length ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Income Distribution — Raw Data (ACS B19001)</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Bracket</th><th>Households</th><th>% of Tract</th></tr></thead>
          <tbody>
            ${d.incomeDistribution.brackets.map(b =>
              `<tr><td>${escapeHtml(b.label)}</td><td>${b.count.toLocaleString()}</td><td>${b.pct}%</td></tr>`
            ).join('')}
            ${d.incomeDistribution.hasSuppressed
              ? '<tr><td colspan="3"><em>Note: Some brackets had suppressed Census data and may be understated.</em></td></tr>'
              : ''}
          </tbody>
        </table>
      </div>
    </div>` : '';

  const eduTable = d.educationLadder?.steps?.length ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Educational Attainment — Adults 25+ (ACS B15003)</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Attainment Level</th><th>% of Adults 25+</th></tr></thead>
          <tbody>
            ${d.educationLadder.steps.map(s =>
              `<tr><td>${escapeHtml(s.label)}</td><td>${s.pct}%</td></tr>`
            ).join('')}
          </tbody>
        </table>
      </div>
    </div>` : '';

  const tractLink = d.tractFips ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Census Tract Reference</div>
      <p class="prem-narrative-body">All data on this page covers the Census tract containing this address (Tract ${escapeHtml(d.tractFips.tract)}, FIPS ${escapeHtml(d.tractFips.state + d.tractFips.county + d.tractFips.tract)}).</p>
      <p class="prem-narrative-body"><a href="${escapeHtml(d.tractFips.censusExplorerUrl)}" target="_blank" rel="noopener">View full ACS data for this tract at data.census.gov →</a></p>
    </div>` : '';

  if (!incomeTable && !eduTable && !tractLink) return '';

  return `${incomeTable}${eduTable}${tractLink}
    <p class="prem-disclaimer">Source: U.S. Census Bureau American Community Survey 5-year estimates. Census tract level.</p>`;
}
```

- [ ] **Step 2: Wire `fullHTML` into `buildDemographicsHTML`**

In `buildDemographicsHTML`, find the final `return renderChapterCard(...)` call (currently near line 130). Replace it with:

```js
  const deepDiveHTML     = buildCommunityDeepDiveHTML(d);
  const researchHTML     = buildCommunityResearchHTML(d);

  const fullHTML = [
    deepDiveHTML  ? `<div class="depth-l3">${deepDiveHTML}</div>`  : '',
    researchHTML  ? `<div class="depth-l4">${researchHTML}</div>`  : '',
  ].filter(Boolean).join('');

  const peopleSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  const glanceHTML = buildCommunityGlanceHTML(d);
  return renderChapterCard('community', '07', peopleSvg, 'Demographics & Community', 'Who lives here, and what that means for daily life.', null, body, null, fullHTML || null, null, glanceHTML || null);
```

- [ ] **Step 3: Run the full community test suite**

```
npm test -- --testPathPattern="tests/templates/chapters/community|tests/modules/community" --no-coverage
```

Expected: all tests PASS — L3 deep dive, L4 research, existing glance bar, no regressions

- [ ] **Step 4: Run the full test suite**

```
npm test --no-coverage
```

Expected: all tests PASS — no regressions in other modules

- [ ] **Step 5: Commit**

```
git add src/templates/chapters/community.js
git commit -m "feat(fr-046): add buildCommunityResearchHTML and wire L3/L4 fullHTML into buildDemographicsHTML"
```

---

## Task 7: Integration test — all 5 addresses

This task is manual. Start the server and load each address at Depth 3 (Deep Read) and Depth 4 (Research). No code changes expected — this is a verification pass.

- [ ] **Step 1: Start the server**

```
npm start
```

- [ ] **Step 2: Test Georgetown KY (suburban)**

Load `100 Wishing Well Path Unit 2306, Georgetown, KY 40324`.

Verify:
- Community chapter depth selector renders
- At Depth 2: existing cards render normally (no regression)
- At Depth 3: tab bar shows all 4 tabs (Income Distribution, Education Ladder, Household Types, How People Get to Work); clicking each tab switches content; bars render with widths (not zero-width); no "NaN%", "-666,666,666", or undefined values visible
- At Depth 4: income table shows rows with real counts; education table shows 5 rows; Census explorer link is valid
- No inline styles in DOM (inspect element)

- [ ] **Step 3: Test Harlan KY (rural — suppression likely)**

Load `456 Rural Route 1, Harlan, KY 40831`.

Verify:
- Chapter renders without crash at all depths
- Any suppressed ACS cells produce 0% in bars, not error text
- If a tab has no data (e.g., commuteMode returns null due to all-suppressed cells), that tab is absent from the tab bar — not present as an empty broken panel

- [ ] **Step 4: Test Louisville KY (urban)**

Load `123 Main St, Louisville, KY 40202`.

Verify:
- All 4 tabs render with substantive data
- Depth 4 income table shows realistic household counts

- [ ] **Step 5: Test Bozeman MT (western US)**

Load `789 Main St, Bozeman, MT 59715`.

Verify:
- All data is Montana census tract, not Kentucky (tractFips.state should be '30' for Montana)
- Census explorer link opens to a Montana tract URL

- [ ] **Step 6: Test Jeffersonville IN (border city — CONSTRAINT-006 regression)**

Load `1007 Stonelilly Dr, Jeffersonville, IN 47130`.

Verify:
- tractFips.state is Indiana FIPS ('18'), not Kentucky ('21')
- Census explorer URL contains '18' (Indiana) not '21' (Kentucky)
- Income and education data reflects Indiana tract, not Louisville KY

- [ ] **Step 7: Verify Fair Housing compliance (CONSTRAINT-002)**

Read through the L3 content for one address and verify:
- No language describing the area as "wealthy," "poor," "working-class," or any economic class characterization
- No language about demographic composition ("diverse," "homogeneous," "predominantly X")
- All income framing is "X% above/below US average" — purely distributional

- [ ] **Step 8: Commit and push**

```
git add -A
git commit -m "feat(fr-046): community L3/L4 deep dive — income, education, household, commute tabs"
git push
```

---

## Self-Review Checklist

### Spec Coverage

| Spec Requirement | Task |
|---|---|
| varsBatch3 with all new ACS variables | Task 4 |
| `incomeDistribution` return field | Task 4 |
| `educationLadder` return field (less-than-HS derived as remainder) | Task 4 |
| `householdComposition` return field | Task 4 |
| `commuteMode` return field | Task 4 |
| `tractFips` with censusExplorerUrl | Task 4 |
| Suppression sentinel (-666666666) → null | Task 1 |
| L3 tab: Income Distribution | Task 5 |
| L3 tab: Education Ladder | Task 5 |
| L3 tab: Household Types | Task 5 |
| L3 tab: How People Get to Work | Task 5 |
| L4: income raw count table | Task 6 |
| L4: education attainment table | Task 6 |
| L4: Census tract link | Task 6 |
| Tabs absent when data is null (edge case) | Task 5 tests |
| hasSuppressed note in income tab and L4 table | Task 5 tests + Task 6 |
| CONSTRAINT-008: no inline styles | Task 5 tests |
| CONSTRAINT-009: no HTML in data.js | Enforced by architecture — transform helpers return plain JS objects |
| All 5 test addresses | Task 7 |
| Jeffersonville IN regression | Task 7 Step 6 |
| Fair Housing compliance | Task 7 Step 7 |

### No New CSS Confirmed
- Income bars: `prem-age-row`, `prem-age-track`, `prem-age-fill`, `prem-age-pct` — all used in L2 already
- Tab structure: `climate-tab`, `climate-tab--active`, `climate-tab-nav`, `climate-tab-panel`, `climate-tab-panel--active`, `climate-tab-panels` — all from climate chapter
- Research tables: `climate-research-section`, `climate-research-section-label`, `climate-table-scroll`, `climate-data-table` — all from climate chapter
- Comparison notes: `prem-demo-note` — already in community L2
- New CSS classes introduced: `community-deep-dive`, `community-deep-dive-label` — these are container/label classes only. **Check:** do any existing `.climate-deep-dive` styles in `report.css` need a parallel `.community-deep-dive` rule, or does the container have no visual style of its own? If Climate's `.climate-deep-dive` has padding/border styles, `community-deep-dive` needs the same. Inspect `report.css` before Task 5 Step 4 and copy the `.climate-deep-dive` rule if it exists.
