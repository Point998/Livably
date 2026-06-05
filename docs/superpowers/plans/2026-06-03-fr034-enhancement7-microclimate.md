# FR-034 Enhancement 7 — Microclimate Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Your Microclimate" subsection to the Garden chapter Overview showing elevation at the address and solar noon angles for summer and winter solstice — giving buyers actionable context for garden orientation and season extension.

**Architecture:** `getMicroclimateData(lat, lng)` added to `garden/data.js` fetches a single USGS elevation point and computes solar angles from latitude (pure math). The result is stored as `microclimate` on the `gardenData` object. `buildMicroclimateHTML(microclimate)` in `garden/template.js` renders it as an existing-style `grow-subsection`. No new CSS classes needed — all classes exist.

**Tech Stack:** Node.js, Jest, USGS EPQS elevation API (`USGS_ELEVATION_URL` already in constants.js), vanilla HTML, existing CSS classes (`.grow-subsection`, `.grow-subsection-label`, `.prem-narrative-body`).

---

## File Map

| File | Change |
|------|--------|
| `src/modules/garden/data.js` | Add `getMicroclimateData(lat, lng)` + wire into `getGardenData` |
| `src/modules/garden/template.js` | Add `buildMicroclimateHTML(microclimate)` + insert call in `buildWhatWillGrowHTML` |
| `tests/modules/garden/data.test.js` | Add `getMicroclimateData` tests |
| `tests/modules/garden/template.test.js` | Add microclimate rendering tests |

No new CSS. No changes to `chapters.js`, `reportBuilder.js`, or `reportPage.js` — the data flows through the existing `gardenData` object.

---

## Task 1: Add `getMicroclimateData` to garden/data.js

**Files:**
- Modify: `src/modules/garden/data.js`
- Test: `tests/modules/garden/data.test.js`

### Background

`getGardenData(lat, lng, locationInfo)` runs a `Promise.allSettled` batch. We add one more fetch to it. The returned object already has ~12 keys; we add `microclimate`.

`USGS_ELEVATION_URL = 'https://epqs.nationalmap.gov/v1/json'` is in `src/utils/constants.js` (already imported by climate, not yet by garden).

Solar angle formula — solar noon elevation above horizon:
```
angle = 90 - |lat - declination|
```
- Summer solstice declination: +23.5°
- Winter solstice declination: −23.5°

Example at lat 38° (Georgetown KY):
- Summer: `90 - |38 - 23.5|` = 75.5° → rounds to 76°
- Winter: `90 - |38 - (-23.5)|` = 28.5° → rounds to 29°

Shadow length for a 6-foot reference object at winter noon:
```
shadowFt = Math.round(6 / Math.tan(winterDeg * Math.PI / 180))
```
At 29° → 11 feet. At 21° (Bozeman MT, lat 46°) → 16 feet.

### Steps

- [ ] **Step 1: Write the failing tests for `getMicroclimateData`**

Add to `tests/modules/garden/data.test.js` (append after the existing filter tests):

```js
const { getMicroclimateData } = require('../../../src/modules/garden/data');

describe('getMicroclimateData', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns solar angles and elevation when USGS succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ value: 900.5 }),
    });
    const result = await getMicroclimateData(38, -84.5);
    expect(result.solarSummerDeg).toBe(76);   // 90 - |38 - 23.5| = 75.5 → 76
    expect(result.solarWinterDeg).toBe(29);   // 90 - |38 + 23.5| = 28.5 → 29
    expect(result.elevationFt).toBe(901);     // Math.round(900.5)
    expect(result.lat).toBe(38);
  });

  test('returns null elevationFt when USGS fails, solar angles still computed', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
    const result = await getMicroclimateData(38, -84.5);
    expect(result.elevationFt).toBeNull();
    expect(result.solarSummerDeg).toBe(76);
    expect(result.solarWinterDeg).toBe(29);
    expect(result.lat).toBe(38);
  });

  test('returns null elevationFt when USGS returns ok:false', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const result = await getMicroclimateData(38, -84.5);
    expect(result.elevationFt).toBeNull();
    expect(result.solarSummerDeg).toBe(76);
  });

  test('solar angles at Bozeman MT latitude (46°)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ value: 4820 }),
    });
    const result = await getMicroclimateData(46, -111.0);
    expect(result.solarSummerDeg).toBe(68);   // 90 - |46 - 23.5| = 66.5 → 67... wait
    // 90 - |46 - 23.5| = 90 - 22.5 = 67.5 → Math.round(67.5) = 68
    expect(result.solarWinterDeg).toBe(21);   // 90 - |46 + 23.5| = 90 - 69.5 = 20.5 → 21
    expect(result.elevationFt).toBe(4820);
  });

  test('returns null elevationFt when USGS value is null', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ value: null }),
    });
    const result = await getMicroclimateData(38, -84.5);
    expect(result.elevationFt).toBeNull();
  });

  test('returns null elevationFt when USGS value is -9999 (no-data sentinel)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ value: -9999 }),
    });
    const result = await getMicroclimateData(38, -84.5);
    expect(result.elevationFt).toBeNull();
  });
});
```

> **Note on Bozeman (lat 46°):** `90 - |46 - 23.5| = 90 - 22.5 = 67.5` → `Math.round(67.5) = 68`. `90 - |46 + 23.5| = 90 - 69.5 = 20.5` → `Math.round(20.5) = 21`. The test comment above has a stray `// wait` — remove it when writing the actual test.

- [ ] **Step 2: Run tests to confirm they fail**

```
npx jest tests/modules/garden/data.test.js --no-coverage
```

Expected: 6 new failing tests with `TypeError: getMicroclimateData is not a function`.

- [ ] **Step 3: Implement `getMicroclimateData` in `src/modules/garden/data.js`**

Add the `USGS_ELEVATION_URL` import at the top of the file:

```js
const {
  FROST_DATE_TABLE,
  INAT_NATIVE_PLANTS_RADIUS_KM, INAT_INVASIVE_PLANTS_RADIUS_KM,
  INAT_WILDLIFE_RADIUS_KM, INAT_BIRDS_RADIUS_KM,
  INAT_NATIVE_PLANTS_PER_PAGE, INAT_INVASIVE_PLANTS_PER_PAGE,
  INAT_WILDLIFE_PER_PAGE, INAT_BIRDS_PER_PAGE,
  INAT_REPTILES_RADIUS_KM, INAT_REPTILES_PER_PAGE,
  INAT_INSECTS_RADIUS_KM, INAT_INSECTS_PER_PAGE,
  INAT_BUTTERFLIES_RADIUS_KM, INAT_BUTTERFLIES_PER_PAGE,
  USGS_ELEVATION_URL,
} = require('../../utils/constants');
```

Then add the new function after `iNatSeasonalBirds` and before `getGardenData`:

```js
async function getMicroclimateData(lat, lng) {
  const summerDeg = Math.round(90 - Math.abs(lat - 23.5));
  const winterDeg = Math.round(90 - Math.abs(lat + 23.5));

  let elevationFt = null;
  try {
    const url = `${USGS_ELEVATION_URL}?x=${lng.toFixed(6)}&y=${lat.toFixed(6)}&units=Feet&wkid=4326&includeDate=false`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (resp.ok) {
      const data = await resp.json();
      const v = data?.value ?? null;
      if (v !== null && v > -1000) elevationFt = Math.round(v);
    }
  } catch {
    // elevation is optional — solar angles are always returned
  }

  return { lat, elevationFt, solarSummerDeg: summerDeg, solarWinterDeg: winterDeg };
}
```

Then wire it into `getGardenData`. The destructured array currently ends at `birdWinterRes`. Add `microclimateres` and the call:

```js
async function getGardenData(lat, lng, locationInfo) {
  const zip = locationInfo?.zip || '';
  const state = locationInfo?.state || null;

  const [
    zoneRes, nativePlantsRes, invasivePlantsRes, wildlifeRes, birdsRes,
    reptilesRes, insectsRes, butterfliesRes,
    birdSpringRes, birdSummerRes, birdFallRes, birdWinterRes,
    microclimateRes,
  ] = await Promise.allSettled([
    getHardinessZone(zip),
    iNatSpeciesCounts(lat, lng, INAT_NATIVE_PLANTS_RADIUS_KM,    47126, { native: true },     INAT_NATIVE_PLANTS_PER_PAGE),
    iNatSpeciesCounts(lat, lng, INAT_INVASIVE_PLANTS_RADIUS_KM,  47126, { introduced: true }, INAT_INVASIVE_PLANTS_PER_PAGE),
    iNatSpeciesCounts(lat, lng, INAT_WILDLIFE_RADIUS_KM,          40151, {},                  INAT_WILDLIFE_PER_PAGE),
    iNatSpeciesCounts(lat, lng, INAT_BIRDS_RADIUS_KM,             3,    {},                  INAT_BIRDS_PER_PAGE),
    iNatSpeciesCounts(lat, lng, INAT_REPTILES_RADIUS_KM,          26036, {},                  INAT_REPTILES_PER_PAGE),
    iNatSpeciesCounts(lat, lng, INAT_INSECTS_RADIUS_KM,           47158, {},                  INAT_INSECTS_PER_PAGE),
    iNatSpeciesCounts(lat, lng, INAT_BUTTERFLIES_RADIUS_KM,       47224, {},                  INAT_BUTTERFLIES_PER_PAGE),
    iNatSeasonalBirds(lat, lng, '3,4,5'),
    iNatSeasonalBirds(lat, lng, '6,7,8'),
    iNatSeasonalBirds(lat, lng, '9,10,11'),
    iNatSeasonalBirds(lat, lng, '12,1,2'),
    getMicroclimateData(lat, lng),
  ]);

  const val = (r, fallback) => r.status === 'fulfilled' ? r.value : fallback;
  const rawNativePlants = val(nativePlantsRes, []);
  const filteredNativePlants = filterNativePlants(rawNativePlants);

  return {
    hardinessZone:  val(zoneRes, null),
    nativePlants:   filteredNativePlants,
    invasivePlants: filterInvasivePlants(val(invasivePlantsRes, [])),
    wildlife:       filterWildlife(val(wildlifeRes, [])),
    birds:          filterBirds(val(birdsRes, [])),
    nativePlantsByForm: categorizePlantsByForm(filteredNativePlants),
    reptiles:       filterReptiles(val(reptilesRes, [])),
    insects:        filterInsects(val(insectsRes, [])),
    butterflies:    filterButterflies(val(butterfliesRes, [])),
    birdsBySeason:  categorizeSeasonalBirds({
      spring: val(birdSpringRes, []),
      summer: val(birdSummerRes, []),
      fall:   val(birdFallRes, []),
      winter: val(birdWinterRes, []),
    }),
    monarchCorridor: getMonarchCorridorInfo(state),
    fireflyHabitat:  getFireflyHabitat(state),
    microclimate:    val(microclimateRes, null),
  };
}
```

Also add `getMicroclimateData` to the `module.exports`:

```js
module.exports = {
  getGardenData,
  getHardinessZone,
  getMicroclimateData,
  iNatSpeciesCounts,
  iNatSeasonalBirds,
  // Re-exported for backward compatibility (chapters.js imports these)
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

- [ ] **Step 4: Run tests to confirm they pass**

```
npx jest tests/modules/garden/data.test.js --no-coverage
```

Expected: all 6 new tests pass. All prior tests in the file pass.

- [ ] **Step 5: Run full suite to confirm no regressions**

```
npx jest --no-coverage
```

Expected: all tests pass (was 1,157 before this session).

- [ ] **Step 6: Commit**

```
git add src/modules/garden/data.js tests/modules/garden/data.test.js
git commit -m "feat(fr-034): add getMicroclimateData (USGS elevation + solar angles) to garden data"
```

---

## Task 2: Add `buildMicroclimateHTML` to garden/template.js

**Files:**
- Modify: `src/modules/garden/template.js`
- Test: `tests/modules/garden/template.test.js`

### Background

The template uses existing CSS classes — no new CSS needed:
- `.grow-subsection` — margin-bottom: 28px (line 2860 of report.css)
- `.grow-subsection-label` — subsection heading style (line 2862)
- `.prem-narrative-body` — body text style (global, defined near other prem-* classes)

`buildMicroclimateHTML` is a pure function that receives the `microclimate` object from `gardenData`. It builds a two-sentence paragraph: one about elevation (optional, shown only when `elevationFt` is non-null) and one about solar angles (always shown). The shadow calculation for the 6-foot reference object adds a concrete, useful detail.

The function is inserted as a call in `buildWhatWillGrowHTML`, between the conditions lead paragraph and the soil subsection.

### Steps

- [ ] **Step 1: Write the failing template tests**

Add to `tests/modules/garden/template.test.js`, after the existing test blocks:

```js
const microclimateLat38 = { lat: 38, elevationFt: 900, solarSummerDeg: 76, solarWinterDeg: 29 };
const microclimateLat46 = { lat: 46, elevationFt: 4820, solarSummerDeg: 68, solarWinterDeg: 21 };

describe('buildWhatWillGrowHTML — microclimate subsection', () => {
  test('renders microclimate section when present', () => {
    const gd = { ...gardenData, microclimate: microclimateLat38 };
    const html = buildWhatWillGrowHTML(gd, soil, locationInfo);
    expect(html).toMatch(/Your Microclimate/);
  });

  test('shows solar angles in narrative', () => {
    const gd = { ...gardenData, microclimate: microclimateLat38 };
    const html = buildWhatWillGrowHTML(gd, soil, locationInfo);
    expect(html).toMatch(/76°/);
    expect(html).toMatch(/29°/);
  });

  test('shows elevation when elevationFt is not null', () => {
    const gd = { ...gardenData, microclimate: microclimateLat38 };
    const html = buildWhatWillGrowHTML(gd, soil, locationInfo);
    expect(html).toMatch(/900 feet/);
  });

  test('omits elevation text when elevationFt is null', () => {
    const gd = { ...gardenData, microclimate: { lat: 38, elevationFt: null, solarSummerDeg: 76, solarWinterDeg: 29 } };
    const html = buildWhatWillGrowHTML(gd, soil, locationInfo);
    expect(html).toMatch(/Your Microclimate/);
    expect(html).not.toMatch(/feet in elevation/);
  });

  test('microclimate absent when microclimate is null', () => {
    const gd = { ...gardenData, microclimate: null };
    const html = buildWhatWillGrowHTML(gd, soil, locationInfo);
    expect(html).not.toMatch(/Your Microclimate/);
  });

  test('shadow length shown in narrative', () => {
    const gd = { ...gardenData, microclimate: microclimateLat38 };
    const html = buildWhatWillGrowHTML(gd, soil, locationInfo);
    // At lat 38°, winter 29°: 6/tan(29°) ≈ 11 feet
    expect(html).toMatch(/11[- ]foot/);
  });

  test('higher-latitude shadow length shown for Bozeman', () => {
    const gd = { ...gardenData, microclimate: microclimateLat46 };
    const html = buildWhatWillGrowHTML(gd, soil, locationInfo);
    // At lat 46°, winter 21°: 6/tan(21°) ≈ 16 feet
    expect(html).toMatch(/16[- ]foot/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const gd = { ...gardenData, microclimate: microclimateLat38 };
    const html = buildWhatWillGrowHTML(gd, soil, locationInfo);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });

  test('microclimate absent when gardenData has no microclimate key (backward compat)', () => {
    // gardenData without microclimate key — existing fixture
    const html = buildWhatWillGrowHTML(gardenData, soil, locationInfo);
    expect(html).not.toMatch(/Your Microclimate/);
  });
});
```

> **Shadow test note:** The regex `/11[- ]foot/` matches "11-foot" or "11 foot". If your narrative uses "11-foot", use `/11-foot/`. Adjust to match the exact wording you write in Step 3.

- [ ] **Step 2: Run tests to confirm they fail**

```
npx jest tests/modules/garden/template.test.js --no-coverage
```

Expected: 9 new failing tests. All prior tests pass.

- [ ] **Step 3: Implement `buildMicroclimateHTML` in `src/modules/garden/template.js`**

Add this function before `buildWhatWillGrowHTML` (around line 21, after the `require` statements):

```js
function buildMicroclimateHTML(microclimate) {
  if (!microclimate) return '';
  const { lat, elevationFt, solarSummerDeg, solarWinterDeg } = microclimate;

  const elevNote = elevationFt !== null
    ? `This address sits at approximately ${Math.round(elevationFt / 10) * 10} feet in elevation. `
    : '';

  const shadowFt = Math.round(6 / Math.tan(solarWinterDeg * Math.PI / 180));
  const latRound = Math.round(lat);

  const sunNote = `At latitude ${latRound}°, the noon sun reaches about ${solarSummerDeg}° above the horizon in late June — near-overhead, flooding the yard with light. By late December that drops to ${solarWinterDeg}°, meaning a 6-foot fence or hedge on the south side of a garden casts about a ${shadowFt}-foot shadow at midday.`;

  const practical = `South-facing beds and cold frames capture the most winter light — orient them toward the south for the best yield in early spring and late fall.`;

  return `
    <div class="grow-subsection">
      <div class="grow-subsection-label">☀️ Your Microclimate</div>
      <p class="prem-narrative-body">${elevNote}${sunNote} ${practical}</p>
    </div>`;
}
```

Then insert the call in `buildWhatWillGrowHTML`. Find the `gardenBody` template string (around line 151). It currently opens with `<p class="prem-narrative-lead">${conditionsPara}</p>`. Insert `${buildMicroclimateHTML(gardenData?.microclimate)}` on the next line, before the soil subsection:

```js
  const gardenBody = `
    <p class="prem-narrative-lead">${conditionsPara}</p>
    ${buildMicroclimateHTML(gardenData?.microclimate)}
    ${soilPara ? `
    <div class="grow-subsection">
      ...
```

Only change the `gardenBody` template string — nothing else in the function.

- [ ] **Step 4: Run template tests**

```
npx jest tests/modules/garden/template.test.js --no-coverage
```

Expected: all 9 new tests pass. All prior tests pass.

- [ ] **Step 5: Run full suite**

```
npx jest --no-coverage
```

Expected: all tests pass. Test count should be 1,157 + 6 (data) + 9 (template) = 1,172.

- [ ] **Step 6: Commit**

```
git add src/modules/garden/template.js tests/modules/garden/template.test.js
git commit -m "feat(fr-034): add microclimate subsection to garden overview (elevation + solar angles)"
```

---

## Task 3: Write summary and close out

**Files:**
- Create: `feature-requests/FR-034-chapter-enhancements/spec-enhancement-7.md`
- Create: `feature-requests/FR-034-chapter-enhancements/summary-enhancement-7.md`

- [ ] **Step 1: Write spec-enhancement-7.md**

```markdown
# FR-034 Enhancement 7 — Microclimate Context

## Goal
Add a "Your Microclimate" subsection to the Garden chapter Overview.

## What it shows
1. Elevation at the address (from USGS EPQS, optional — graceful degradation to omit when unavailable)
2. Solar noon angle at summer solstice (~76° at lat 38°) vs winter solstice (~29° at lat 38°)
3. Shadow length for a 6-foot reference object at winter noon
4. One-sentence practical implication for garden orientation

## Data sources
- USGS EPQS: `https://epqs.nationalmap.gov/v1/json` — single-point elevation in feet
- Solar math: pure calculation from latitude, no API

## New function
`getMicroclimateData(lat, lng)` in `src/modules/garden/data.js`
Returns: `{ lat, elevationFt, solarSummerDeg, solarWinterDeg }`

## Template
`buildMicroclimateHTML(microclimate)` in `src/modules/garden/template.js`
Uses existing CSS classes — no new CSS needed.

## Constraints
- CONSTRAINT-008: no inline styles
- CONSTRAINT-015: section absent when microclimate is null (USGS failure doesn't crash the chapter — solar angles are always computable, but the full object could be null if the whole `getMicroclimateData` call fails)
```

- [ ] **Step 2: Write summary-enhancement-7.md** after implementation is complete (fill in actual test count and any deviations from plan).

- [ ] **Step 3: Run the app and visually verify**

Use the `/run` skill or:
```
node src/server/app.js
```
Navigate to a report for `100 Wishing Well Path Unit 2306, Georgetown, KY 40324` and verify:
- "Your Microclimate" subsection appears in the Garden chapter Overview
- Shows elevation (approximately 780–900 ft for Georgetown)
- Shows solar angles (approximately 76° summer, 29° winter)
- Shows shadow length (approximately 11 feet)
- No inline styles, no layout breaks

- [ ] **Step 4: Test all 5 addresses** — confirm the section renders for all test addresses and gracefully absent when USGS fails (not easily testable manually, but covered by tests).

- [ ] **Step 5: Commit summary**

```
git add feature-requests/FR-034-chapter-enhancements/spec-enhancement-7.md
git add feature-requests/FR-034-chapter-enhancements/summary-enhancement-7.md
git commit -m "chore(fr-034): add spec and summary for enhancement 7 (microclimate context)"
```

- [ ] **Step 6: Push**

```
git push origin main
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Elevation from USGS → `getMicroclimateData` fetches it
- [x] Solar angles → computed from lat in `getMicroclimateData`
- [x] Shadow length → computed in `buildMicroclimateHTML` from `solarWinterDeg`
- [x] Practical garden advice → rendered as final sentence
- [x] Graceful degradation when USGS fails → `elevationFt` is null, section still renders

**Constraint coverage:**
- [x] CONSTRAINT-008 (no inline styles) → tested explicitly
- [x] CONSTRAINT-009 (no HTML in data.js) → `getMicroclimateData` returns a plain object
- [x] CONSTRAINT-015 (graceful degradation) → null microclimate → empty string from `buildMicroclimateHTML`

**Type consistency:**
- `getMicroclimateData` returns `{ lat, elevationFt, solarSummerDeg, solarWinterDeg }`
- `buildMicroclimateHTML` destructures the same keys
- `gardenData.microclimate` is set from `val(microclimateRes, null)` — consistent null fallback

**No placeholders:** All code blocks in this plan are complete implementations.
