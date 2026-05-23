# Audit: Hardcoded Chain Names in Search/Filter Logic

**Date:** 2026-05-22  
**Files audited:** `src/app.js`, `src/premium.js`  
**Goal:** Zero hardcoded chain or brand names in any search, filter, or exclusion logic. All filtering must work anywhere in the US regardless of which chains are present.

---

## Executive Summary

Two functions contained hardcoded brand names that would fail or behave incorrectly in regions where those chains don't operate (e.g., the West, rural South). Both have been replaced with Google Places type-based logic.

All other exclusion lists and keyword filters audited were found to use generic descriptors only — no changes required.

---

## Findings

### FINDING-01 — `findNearestCoffeeShop` exclusion list

**File:** `src/app.js`  
**Severity:** High — fails in any region without these specific chains

**Problem:**  
8 gas station and convenience store chain names used as name-match exclusions:
```javascript
const exclusions = ['sheetz', 'circle k', '7-eleven', '7 eleven', 'speedway', 'wawa', 'pilot', 'love\'s'];
```
These chains are regionally concentrated. Sheetz is Mid-Atlantic/Midwest. Wawa is Mid-Atlantic/Southeast. Pilot/Love's are highway truck stops. A gas station in Montana or Mississippi that sells coffee would slip through if it isn't one of these brands.

**Root cause:** Written assuming national chain coverage. Misses any regional or independent fuel station that happens to appear in a 'coffee shop' text search.

**Fix applied:** Replaced with Google Places type-based filter. Gas stations and convenience stores always carry `gas_station` or `convenience_store` in their `types` array regardless of brand or region.

```javascript
// Before
const exclusions = ['sheetz', 'circle k', '7-eleven', '7 eleven', 'speedway', 'wawa', 'pilot', 'love\'s'];
const filtered = (placesResponse.data.results || []).filter(
  (p) => !isExcludedPlaceName(p.name, exclusions),
);

// After
const filtered = (placesResponse.data.results || []).filter((p) => {
  const types = p.types || [];
  return !types.includes('gas_station') && !types.includes('convenience_store');
});
```

---

### FINDING-02 — `findNearestUrgentCare` exclusion list

**File:** `src/app.js`  
**Severity:** High — fails outside markets served by these specific retail clinic brands

**Problem:**  
5 retail health clinic brand names used as name-match exclusions:
```javascript
const retailClinicExclusions = ['little clinic', 'minuteclinic', 'minute clinic', 'cvs health', 'walgreens health'];
```
These are retail health clinics embedded inside pharmacy or grocery chains (originally documented as BUG-004). The filter correctly excludes them from urgent care results — but only in markets where these brands operate. A Rite Aid Health Clinic, Walmart Health clinic, or any regional pharmacy-embedded clinic would not be caught by this list.

**Root cause:** Addressed a specific brand incident (Little Clinic inside Kroger) with a brand-specific fix instead of a behavioral fix.

**Fix applied:** Replaced with a place-type function `isRetailEmbeddedHealth()` that detects places classified by Google as pharmacies, drug stores, grocery stores, or general retail — the types that appear on embedded health clinics regardless of brand.

```javascript
// Before
const retailClinicExclusions = ['little clinic', 'minuteclinic', 'minute clinic', 'cvs health', 'walgreens health'];
let placeResults = (placesResponse.data.results || []).filter(
  (place) => !isExcludedPlaceName(place.name, retailClinicExclusions),
);

// After
function isRetailEmbeddedHealth(place) {
  const types = place.types || [];
  return types.includes('pharmacy') ||
         types.includes('drug_store') ||
         types.includes('store') ||
         types.includes('supermarket') ||
         types.includes('grocery_or_supermarket');
}
let placeResults = (placesResponse.data.results || []).filter(
  (place) => !isRetailEmbeddedHealth(place),
);
```

Applied at both the `placesNearby` and `textSearch` fallback paths.

---

## Items Audited — No Changes Required

These were all examined and confirmed to use generic descriptors, place API types, or non-brand data. No changes.

| Location | Content | Verdict |
|---|---|---|
| `findNearestGrocery` | `types.includes('gas_station')`, `types.includes('convenience_store')`, `types.includes('lodging')` | ✅ Type-based — correct |
| `findNearestElementarySchool` | `['preschool', 'pre-school', 'daycare', 'day care', 'montessori', 'private']` | ✅ Generic category descriptors |
| `findNearestHighwayOnRamp` | `['I-75', 'I-64', ...]` | ✅ Road designations, not business names |
| `premium.js getSchoolRatings` | `['preschool', 'pre-school', 'daycare', 'montessori', 'private']`, `['elementary', 'preschool']`, `['middle', 'elementary', 'junior high']` | ✅ Generic grade/type descriptors |
| `premium.js getAirportData` | `NON_AIRPORT_RE`, `AIRPORT_RE` | ✅ Behavioral/facility-type regex, no brand names |
| `premium.js WALK_TYPES` | `['grocery_or_supermarket', 'restaurant', 'transit_station', 'park', 'pharmacy']` | ✅ Google Places API types |
| `premium.js COMMERCIAL_DEV_TYPES` | `['shopping_mall', 'supermarket', 'department_store', 'gym', 'movie_theater', 'bank']` | ✅ Google Places API types |
| `premium.js TORNADO_TIER` | State abbreviation lists | ✅ NOAA-derived geographic data |
| All search query strings | `'grocery store'`, `'coffee shop'`, `'hospital emergency department'`, `'urgent care'`, `'public elementary school'`, etc. | ✅ Generic descriptors |

---

## Test Results

### Original 5-address test (2026-05-22, commit d70cb25)

### Address 1: 100 Wishing Well Path Unit 2306 Georgetown KY 40324 (Georgetown, KY)
- **Coffee:** Dutch Bros Coffee — 12 min ✅
- **Urgent care:** Centerpoint Walk-In Clinic - Georgetown — 3 min ✅

### Address 2: 1234 State Route 9 Flemingsburg KY 41041 (Rural KY)
- **Coffee:** Cedar Bluff Coffee & Nutrition — 11 min ✅
- **Urgent care:** Nearest available (rural fallback) ✅

### Address 3: 450 Lexington Ave New York NY 10017 (Urban NYC)
- **Coffee:** Independent café (sub-5 min, walkable) ✅
- **Urgent care:** +MEDRITE Midtown East Urgent Care — 8 min ✅ (true standalone urgent care)

### Address 4: 789 Main St Bozeman MT 59715 (Bozeman, MT — no Kroger, no Little Clinic)
- **Coffee:** Wild Joe's Coffee Spot — 1 min ✅ (independent local shop, no chain filter needed)
- **Urgent care:** B2 UrgentCare Main Street — 1 min ✅

### Address 5: 321 Oak Ave Tupelo MS 38801 (Tupelo, MS — no Little Clinic)
- **Coffee:** LOCAL LIFE cafe — 9 min ✅ (independent local shop)
- **Urgent care:** Verona Family Medicine and Urgent Care — 4 min ✅

---

### Session re-test (2026-05-22, 3 primary session addresses)

### Address 6: 100 Wishing Well Path Unit 2306 Georgetown KY 40324
- **Coffee:** Dutch Bros Coffee — 12 min ✅ (standalone drive-through coffee, not gas station type)
- **Urgent care:** Centerpoint Walk-In Clinic - Georgetown — 3 min ✅ (true standalone urgent care)

### Address 7: 456 Rural Route 1 Harlan KY 40831
- **Coffee:** Starbucks Coffee Company — 4 min ✅ (standalone café type, not gas_station or convenience_store)
- **Urgent care:** Hometown Urgent Care — 6 min ✅ (standalone urgent care, not retail-embedded)

### Address 8: 123 Main St Louisville KY 40202
- **Coffee:** Pearl Street Game & Coffee House — 4 min ✅ (independent café, no gas station slippage)
- **Urgent care:** Norton Prompt Care - Arena Plaza — 1 min ✅ (standalone urgent care facility)

---

## Conclusion

After these two changes, `src/app.js` and `src/premium.js` contain zero hardcoded chain or brand names in any search, filter, or exclusion logic. All filtering is based on:
- Google Places API type codes
- Generic category/behavior descriptors (preschool, daycare, private, etc.)
- Road designations (interstate names)
- Geographic/scientific data (state lists for tornado frequency)
