# FR-047 Rural Mode Activation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `detectRuralMode()` into `findNearestGrocery()` so rural/remote addresses don't get false coherence warnings on grocery drive times.

**Architecture:** Add a sequential pre-step in `reportBuilder.js` that fetches FIPS + Census tract population before the parallel batch, computes `ruralMode`, and passes it to `findNearestGrocery`. Pass the pre-fetched `fips` to `getChapterData` so `chapters.js` skips the duplicate `getCensusFIPS` call. Census pre-fetch failure falls back silently to `'suburban'`.

**Tech Stack:** Node.js, Jest (`npm test`), Census API (already integrated via `src/shared/census.js`)

**Spec:** `feature-requests/FR-047-rural-mode-activation/spec.md`

---

## File Map

| File | Change |
|---|---|
| `src/chapters.js` | Accept optional `fips` param in `getChapterData()`. Skip `getCensusFIPS` if provided. |
| `src/services/reportBuilder.js` | Add pre-step: FIPS + population fetch → `ruralMode`. Pass `ruralMode` to `findNearestGrocery`. Pass `fips` to `getChapterData`. |
| `tests/services/reportBuilder.test.js` | Mock `src/shared/census`. Add tests: ruralMode passed to grocery, rural address skips warning, fallback on Census failure, fips passed to getChapterData. |

---

## Task 1: `chapters.js` — accept optional pre-fetched `fips` — TDD

**Files:**
- Modify: `tests/services/reportBuilder.test.js` (integration test for bypass)
- Modify: `src/chapters.js`

- [ ] **Step 1: Write a failing test**

In `tests/services/reportBuilder.test.js`, add a mock for `src/shared/census` at the top (with the other mocks):

```js
const mockGetCensusFIPS = jest.fn();
const mockFetchCensusACS = jest.fn();
```

Add this jest.mock after the existing ones:

```js
jest.mock('../../src/shared/census', () => ({
  getCensusFIPS: mockGetCensusFIPS,
  fetchCensusACS: mockFetchCensusACS,
}));
```

In `beforeEach`, add defaults for the new mocks:

```js
mockGetCensusFIPS.mockResolvedValue({ state: '21', county: '077', tract: '010101' });
mockFetchCensusACS.mockResolvedValue(new Map([['B01001_001E', '5200']]));
```

Add this test inside `describe('buildReport', ...)`:

```js
test('passes pre-fetched fips to getChapterData so chapters.js skips getCensusFIPS', async () => {
  const fips = { state: '21', county: '077', tract: '010101' };
  mockGetCensusFIPS.mockResolvedValue(fips);
  mockFetchCensusACS.mockResolvedValue(new Map([['B01001_001E', '5200']]));

  await buildReport('100 Main St, Georgetown, KY');

  expect(mockGetChapterData).toHaveBeenCalledWith(
    expect.objectContaining({ fips })
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- --testPathPattern="tests/services/reportBuilder" --no-coverage
```

Expected: FAIL — `getChapterData` not called with `fips`

- [ ] **Step 3: Update `getChapterData` signature in `src/chapters.js`**

Find the `getChapterData` function signature (around line 103):

Old:
```js
async function getChapterData({ lat, lng, originLatLng, locationInfo, googleMapsClient, googleMapsApiKey, getDriveTime, highwayDriveMinutes }) {
  const fips = await getCensusFIPS(lat, lng);
```

New:
```js
async function getChapterData({ lat, lng, originLatLng, locationInfo, googleMapsClient, googleMapsApiKey, getDriveTime, highwayDriveMinutes, fips: prefetchedFips }) {
  const fips = prefetchedFips ?? await getCensusFIPS(lat, lng);
```

No other changes to `chapters.js`.

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- --testPathPattern="tests/services/reportBuilder" --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```
git add src/chapters.js tests/services/reportBuilder.test.js
git commit -m "feat(fr-047): accept optional pre-fetched fips in getChapterData"
```

---

## Task 2: `reportBuilder.js` — pre-step + ruralMode wiring — TDD

**Files:**
- Modify: `tests/services/reportBuilder.test.js`
- Modify: `src/services/reportBuilder.js`

- [ ] **Step 1: Write failing tests for ruralMode wiring**

Add to `tests/services/reportBuilder.test.js` inside `describe('buildReport', ...)`:

```js
test('passes ruralMode to findNearestGrocery based on tract population', async () => {
  // Urban population (≥5001) → 'urban' mode
  mockFetchCensusACS.mockResolvedValue(new Map([['B01001_001E', '6000']]));
  await buildReport('100 Main St, Georgetown, KY');
  expect(mockFindNearestGrocery).toHaveBeenCalledWith(
    expect.any(String),
    'urban'
  );
});

test('passes rural ruralMode for low-population tract', async () => {
  // Low population (≤200) → 'remote', (201-1000) → 'rural'
  mockFetchCensusACS.mockResolvedValue(new Map([['B01001_001E', '500']]));
  await buildReport('456 Rural Route 1, Harlan, KY');
  expect(mockFindNearestGrocery).toHaveBeenCalledWith(
    expect.any(String),
    'rural'
  );
});

test('falls back to suburban ruralMode when Census pre-fetch fails', async () => {
  mockGetCensusFIPS.mockRejectedValue(new Error('Census API error'));
  await buildReport('100 Main St, Georgetown, KY');
  // Should still call findNearestGrocery with fallback, not crash
  expect(mockFindNearestGrocery).toHaveBeenCalledWith(
    expect.any(String),
    'suburban'
  );
});

test('falls back to suburban when fetchCensusACS returns null', async () => {
  mockFetchCensusACS.mockResolvedValue(null);
  await buildReport('100 Main St, Georgetown, KY');
  expect(mockFindNearestGrocery).toHaveBeenCalledWith(
    expect.any(String),
    'suburban'
  );
});

test('falls back to suburban when tractPop is 0', async () => {
  mockFetchCensusACS.mockResolvedValue(new Map([['B01001_001E', '0']]));
  await buildReport('100 Main St, Georgetown, KY');
  expect(mockFindNearestGrocery).toHaveBeenCalledWith(
    expect.any(String),
    'suburban'
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- --testPathPattern="tests/services/reportBuilder" --no-coverage
```

Expected: FAIL — `findNearestGrocery` called with only one argument, not two

- [ ] **Step 3: Add the pre-step and wiring to `src/services/reportBuilder.js`**

Add these requires at the top of the file, with the other requires:

```js
const { getCensusFIPS, fetchCensusACS } = require('../shared/census');
const { detectRuralMode } = require('../shared/validate');
```

In `buildReport`, find the line after `const originState = locationInfo.state;` (around line 45) and before the `const results = await Promise.allSettled([` line. Insert the pre-step:

```js
  // Pre-fetch FIPS + tract population to compute rural mode before parallel batch.
  // CONSTRAINT-007: classify address before narrative generation.
  // Falls back to 'suburban' silently if Census is unavailable.
  let ruralMode = 'suburban';
  let prefetchedFips = null;
  try {
    prefetchedFips = await getCensusFIPS(origin.lat, origin.lng);
    if (prefetchedFips) {
      const popMap = await fetchCensusACS(prefetchedFips, ['B01001_001E']);
      const tractPop = popMap ? parseInt(popMap.get('B01001_001E'), 10) : 0;
      if (tractPop > 0) {
        ruralMode = detectRuralMode(tractPop).mode;
      }
    }
  } catch (_) {
    // Census pre-fetch failed — ruralMode stays 'suburban'
  }
```

Update the `findNearestGrocery` call in the parallel batch (currently line 47):

Old:
```js
    findNearestGrocery(originLatLng),
```

New:
```js
    findNearestGrocery(originLatLng, ruralMode),
```

Update the `getChapterData` call (around line 101) to pass `fips`:

Old:
```js
    chapters = await getChapterData({
      lat: origin.lat,
      lng: origin.lng,
      originLatLng,
      locationInfo,
      googleMapsClient,
      googleMapsApiKey,
      getDriveTime,
      highwayDriveMinutes,
    });
```

New:
```js
    chapters = await getChapterData({
      lat: origin.lat,
      lng: origin.lng,
      originLatLng,
      locationInfo,
      googleMapsClient,
      googleMapsApiKey,
      getDriveTime,
      highwayDriveMinutes,
      fips: prefetchedFips,
    });
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- --testPathPattern="tests/services/reportBuilder" --no-coverage
```

Expected: all tests PASS

- [ ] **Step 5: Run full test suite**

```
npm test --no-coverage
```

Expected: all tests PASS — no regressions

- [ ] **Step 6: Commit**

```
git add src/services/reportBuilder.js tests/services/reportBuilder.test.js
git commit -m "feat(fr-047): wire ruralMode into findNearestGrocery via Census pre-step"
```

---

## Task 3: Write FR summary + commit docs

**Files:**
- Create: `feature-requests/FR-047-rural-mode-activation/summary.md`

- [ ] **Step 1: Write summary**

Create `feature-requests/FR-047-rural-mode-activation/summary.md`:

```markdown
# FR-047 Summary — Rural Mode Activation

**Status:** Complete
**Commits:** feat(fr-047): accept optional pre-fetched fips in getChapterData
            feat(fr-047): wire ruralMode into findNearestGrocery via Census pre-step

## What Changed

`findNearestGrocery` now receives the correct rural mode classification instead of defaulting to 'suburban'. Rural and remote addresses (Harlan KY) no longer get a false `coherenceWarning` on grocery drive times that are expected for their location type.

## How It Works

Before the main parallel API batch, `reportBuilder.js` now:
1. Fetches FIPS via `getCensusFIPS` (was already fetched again inside chapters.js — now shared)
2. Fetches tract population (`B01001_001E`) from Census ACS
3. Calls `detectRuralMode(tractPop)` to classify the address
4. Passes the result to `findNearestGrocery`

The pre-fetched FIPS is also passed to `getChapterData` so `chapters.js` skips the duplicate `getCensusFIPS` call — one fewer Census API request per report.

## Fallback

If Census pre-fetch fails for any reason, `ruralMode` stays `'suburban'` and the report generates normally. No degradation.

## Constraints Activated

- CONSTRAINT-007: Rural mode classification now runs before narrative generation
- CONSTRAINT-010: Drive time coherence check now correctly exempts rural/remote addresses
```

- [ ] **Step 2: Commit docs**

```
git add feature-requests/FR-047-rural-mode-activation/
git add docs/superpowers/plans/2026-05-31-fr047-rural-mode-activation.md
git commit -m "docs: add FR-047 spec, plan, and summary"
git push
```

---

## Self-Review

**Spec coverage:**
- ✅ ruralMode passed to findNearestGrocery — Task 2
- ✅ Fallback on Census failure — Task 2 (try/catch + tests)
- ✅ Fallback on null tractPop — Task 2 (tractPop > 0 guard + tests)
- ✅ getChapterData fips bypass — Task 1
- ✅ compareBuilder.js out of scope — not touched
- ✅ No UI change — only coherenceWarning flag affected
- ✅ All existing tests pass — Task 2 Step 5

**No placeholders.** All steps contain actual code.
