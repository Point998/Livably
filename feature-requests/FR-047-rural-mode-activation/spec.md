# FR-047 Spec — Rural Mode Activation

**Status:** Specced
**Constraint:** CONSTRAINT-007, CONSTRAINT-010, CONSTRAINT-014

---

## Problem

`detectRuralMode()` exists in `src/shared/validate.js` and is tested, but it is not wired into `findNearestGrocery()`. The grocery search always runs with `ruralMode = 'suburban'` (the default parameter), regardless of the actual address type.

**Root cause:** Sequencing. `reportBuilder.js` calls `findNearestGrocery(originLatLng)` in a parallel batch that fires before Census data is available. Rural mode is computed inside `getChapterData()` — which is in that same parallel batch — so rural mode is never known at the time of the grocery search.

**What this causes:** Rural and remote addresses (Harlan KY being the canonical test case) get `coherenceWarning: true` on their grocery result even when a 45-minute drive to the store is completely expected. CONSTRAINT-010 is supposed to exempt rural and remote addresses from the drive time coherence check. It currently doesn't, because `ruralMode` is always `'suburban'`.

---

## Inputs

- `origin.lat`, `origin.lng` — available immediately after geocoding in `reportBuilder.js`
- `fips` — Census FIPS identifier, currently fetched inside `getChapterData()` → `getCensusFIPS(lat, lng)`
- Census ACS `B01001_001E` (total tract population) — currently fetched inside `getDemographics()` as part of `varsBatch1`

## Outputs

- `ruralMode: 'urban' | 'suburban' | 'rural' | 'remote'` — passed to `findNearestGrocery` before the parallel batch
- No change to the grocery search result shape — only the `coherenceWarning` flag is affected
- No new data rendered to the user — this is a coherence constraint fix, not a UI change

---

## Fix

**Two-step fetch in `reportBuilder.js`:**

**Step 1 (new sequential pre-step, before the parallel batch):**
1. Call `getCensusFIPS(origin.lat, origin.lng)` → get `fips`
2. Call `fetchCensusACS(fips, ['B01001_001E'])` → get tract population
3. Extract `tractPop` from the ACS result
4. Call `detectRuralMode(tractPop)` with no drive time (drive time unknown at this point)
5. Store `ruralMode` and `fips` for use in the next step

**Step 2 (existing parallel batch, updated):**
- Pass `ruralMode` to `findNearestGrocery(originLatLng, ruralMode)`
- Pass `fips` to `getChapterData({ ..., fips })` so `chapters.js` skips the duplicate `getCensusFIPS` call

**Update `chapters.js`:**
- Accept optional `fips` parameter in `getChapterData()`
- If `fips` is provided, skip the `getCensusFIPS(lat, lng)` call
- If `fips` is null/undefined (e.g. compare tool, any caller that doesn't pre-fetch), fall back to calling `getCensusFIPS` as before — no breaking change

---

## Edge Cases

**`fetchCensusACS` returns null:** Census API failed. Fall back to `ruralMode = 'suburban'` (current behavior). Do not block report generation.

**`tractPop` is 0 or null:** `detectRuralMode` receives 0 or null. Add a guard: if tractPop is falsy, use `ruralMode = 'suburban'` fallback. Do not pass 0 to `detectRuralMode` — its thresholds assume a valid population.

**`compareBuilder.js` also calls `findNearestGrocery(originLatLng)` without ruralMode (line 12):** Out of scope. The compare tool is a separate codepath. Leave for a follow-on FR.

**Drive time unavailable for mode decision:** `detectRuralMode` works on population alone for the pre-step. Population reliably identifies remote (≤200) and urban (≥5001). For 201–5000, the function correctly classifies by population threshold alone. The `avgDriveMinutes` refinement (distinguishing suburban vs rural in the 1001–5000 range) happens later inside `getChapterData` for other uses — the pre-step only needs a good-enough classification for the coherence check.

---

## Acceptance Criteria

1. `findNearestGrocery` in `reportBuilder.js` is called with the computed `ruralMode`, not the default
2. For Harlan KY (`456 Rural Route 1, Harlan, KY 40831`), the grocery result does NOT have `coherenceWarning: true` when the drive time is reasonable for rural Appalachia
3. For Georgetown KY (suburban), a grocery store >45 min away still gets `coherenceWarning: true`
4. Census API failure in the pre-step does not crash or degrade the report — falls back to `'suburban'`
5. `getChapterData` still works correctly when called without a pre-fetched `fips` (compare tool, tests)
6. All existing tests pass
7. New tests cover: ruralMode passed to grocery, fallback on Census failure, fips bypass in chapters.js

---

## Files Changed

| File | Change |
|---|---|
| `src/services/reportBuilder.js` | Add pre-step: FIPS + population fetch → ruralMode. Pass ruralMode to findNearestGrocery, pass fips to getChapterData. |
| `src/chapters.js` | Accept optional `fips` param in `getChapterData`. Skip `getCensusFIPS` if provided. |
| `tests/services/reportBuilder.test.js` | Add tests: ruralMode passed, fallback on Census failure. |
| `tests/chapters.test.js` | Add test: fips bypass skips getCensusFIPS call. |

---

## Out of Scope

- `compareBuilder.js` — separate codepath, follow-on FR
- Changing grocery search radius based on rural mode (current behavior: radius is fixed via `getMitigation`)
- Any UI change — no new data rendered
- Passing `ruralMode` to pharmacy, gas station, or other reachability functions (those don't use the 45-min coherence check)
