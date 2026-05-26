# FR-037 Spec — Data Layer Extraction (Phase 2 of 7)
*Phase 2 — Specification (no code changes)*
*Date: 2026-05-25*

---

## What This FR Does

Extracts all raw API-calling functions from `src/app.js` into a proper shared infrastructure layer and module data files, following the `docs/plans/module-restructure.md` pattern. Zero behavior change. No new API integrations. No business logic changes.

**Scope: shared layer + app.js only.** Premium.js data functions (already partially separated with injected clients) are deferred to FR-038.

---

## Architecture Target

Target structure per `docs/plans/module-restructure.md` (CLAUDE.md's declared architecture reference):

```
src/
  shared/
    google/
      client.js          ← proxy-wrapped Maps client + key, imported by all data modules
      geocoding.js        ← geocodeAddress()
      reverseGeocode.js   ← reverseGeocodeAddress() (extracted from inline route code)
      distanceMatrix.js   ← getDriveTime(), getTrafficVariations()
    census.js             ← getCensusFIPS(), fetchCensusACS() (moved from premium.js)
  modules/
    reachability/
      data.js             ← findNearestGrocery(), findNearestPharmacy(), findNearestGasStation()
    access/
      data.js             ← findNearestHighwayOnRamp()
    health/
      data.js             ← findNearestHospital(), findNearestUrgentCare()
    schools/
      data.js             ← findNearestSchool(), findNearestElementarySchool()
    recreation/
      data.js             ← findNearestPark(), findNearestCoffeeShop()
tests/
  shared/
    google/
      geocoding.test.js
      distanceMatrix.test.js
  modules/
    reachability/
      data.test.js
    access/
      data.test.js
    health/
      data.test.js
    schools/
      data.test.js
    recreation/
      data.test.js
```

---

## Inputs and Outputs

### Inputs (what each data function receives)

All extracted functions accept only the data they need to fetch. No HTML, no narrative, no business decisions.

**Shared Google functions:** receive `(client, apiKey)` explicitly — no closures.

**Module data functions:** receive `(originLatLng, client, apiKey)` and call shared functions for drive times.

**`getDriveTime` signature stays the same:** `(originLatLng, destinationLatLng)` where both are `"{lat},{lng}"` strings. Shared functions import it directly from `distanceMatrix.js` rather than receiving it as an injected argument (eliminating the closure problem cleanly).

### Outputs (what each data function returns)

Identical to current return shapes. Zero changes to the data contract. `buildReportHTML` receives the same objects it receives today.

---

## Detailed Function Specifications

### `src/shared/google/client.js`

**Purpose:** Single place where the Maps SDK client is constructed and proxy-wrapped. Every data module imports from here.

**Exports:** `{ googleMapsClient, googleMapsApiKey }`

**Implementation:**
```js
'use strict';
const { Client } = require('@googlemaps/google-maps-services-js');
const { makeGoogleMapsRequest } = require('../../rateLimit');

const _raw = new Client({});
const googleMapsClient = new Proxy(_raw, {
  get(target, prop) {
    const val = Reflect.get(target, prop);
    if (typeof val === 'function') {
      return (...args) => makeGoogleMapsRequest(() => Reflect.apply(val, target, args), prop);
    }
    return val;
  },
});
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

module.exports = { googleMapsClient, googleMapsApiKey };
```

**Used by:** all other data modules that need Google APIs. `app.js` imports from here too — removing its own client construction and proxy code (those ~10 lines become a single require).

**Test requirement:** None (config-only module). Tested indirectly via geocoding tests.

---

### `src/shared/google/geocoding.js`

**Purpose:** Address string → `{ lat, lng }` geometry location.

**Exports:** `{ geocodeAddress }`

**Signature:** `geocodeAddress(address: string): Promise<{ lat: number, lng: number }>`

**Behavior:** Identical to current `geocodeAddress` in app.js:136. Checks `geocodeCache`, calls `googleMapsClient.geocode`, caches result, throws if no results. Imports `{ geocodeCache }` from `../../cache` and `{ googleMapsClient, googleMapsApiKey }` from `./client`.

**Edge cases:**
- Empty result array → throws `'Unable to geocode the address.'`
- Network timeout → propagates, caught by route handler

**Tests required:**
```
geocoding.test.js:
  ✓ returns { lat, lng } for valid address (mock client)
  ✓ throws on empty results
  ✓ returns cached result without calling client on second call
```

---

### `src/shared/google/reverseGeocode.js`

**Purpose:** `"{lat},{lng}"` string → `{ city, state, county, zip }` locationInfo.

**Exports:** `{ reverseGeocodeAddress }`

**Signature:** `reverseGeocodeAddress(latLng: string): Promise<{ city: string, state: string, county: string, zip: string }>`

**Behavior:** Extracted from the inline `try {}` block in the `/report` route (app.js:1706–1715). Same address component extraction logic. Returns empty strings for missing components rather than throwing — matches current silent-catch behavior.

**Note:** `findNearestHighwayOnRamp` also does a reverse geocode internally (app.js:396) to get `city` and `state` for its search context. After extraction that call should use this shared function.

**Tests required:**
```
reverseGeocode.test.js:
  ✓ extracts city, state, county, zip from mock response
  ✓ returns empty strings for missing components (not null, not throws)
```

---

### `src/shared/google/distanceMatrix.js`

**Purpose:** Drive time calculations between two lat/lng points, including traffic variations.

**Exports:** `{ getDriveTime, getTrafficVariations }`

**`getDriveTime` signature:** `(originLatLng: string, destinationLatLng: { lat, lng }): Promise<number>` — returns minutes as integer.

**`getTrafficVariations` signature:** `(originLatLng: string, destLocation: { lat, lng }): Promise<{ variations, stats } | null>`

**Behavior:** Identical to current implementations in app.js:160 and app.js:92. Both import from `./client` for client access. Both import from `../../cache` for `driveTimeCache`. Both import from `../../utils/time` for departure timestamp functions.

**Breaking change to watch:** `getDriveTime` currently takes `destinationLatLng` as `{ lat, lng }` object. After extraction, `getEmergencyServices` and `getSchoolRatings` in premium.js receive `getDriveTime` as an injected argument. **This injection stays** — premium.js's API is not changed in this FR. The injected `getDriveTime` will now come from this module.

**Tests required:**
```
distanceMatrix.test.js:
  ✓ getDriveTime returns integer minutes (mock client)
  ✓ getDriveTime returns cached value on second call
  ✓ getDriveTime throws on non-OK element status
  ✓ getTrafficVariations returns null when all slots fail
  ✓ getTrafficVariations calculates min/max/avg correctly
```

---

### `src/shared/census.js`

**Purpose:** Census FIPS lookup and ACS data fetching. Currently in premium.js — moves to shared because multiple future modules will need it.

**Exports:** `{ getCensusFIPS, fetchCensusACS }`

**`getCensusFIPS` signature:** `(lat: number, lng: number): Promise<{ state: string, county: string, tract: string } | null>`

**`fetchCensusACS` signature:** `(fips: { state, county, tract }, vars: string[]): Promise<{ get: Function, headers: string[], values: string[] } | null>`

**Behavior:** Identical to current implementations in premium.js:44 and premium.js:65. `getCensusFIPS` keeps its module-level `fipsCache` Map. `fetchCensusACS` reads `CENSUS_API_KEY` from `process.env` at call time (keep as-is — do not centralize env reads in this FR).

**Immediate consumers after extraction:** `getPremiumData` in premium.js imports `getCensusFIPS` from here instead of defining it locally.

**Tests required:**
```
census.test.js:
  ✓ getCensusFIPS returns { state, county, tract } on success (mock fetch)
  ✓ getCensusFIPS returns null on network error
  ✓ getCensusFIPS returns cached result on second call
  ✓ fetchCensusACS returns null when CENSUS_API_KEY missing
  ✓ fetchCensusACS parses ACS response into get() accessor correctly
```

---

### `src/modules/reachability/data.js`

**Purpose:** Nearest grocery, pharmacy, and gas station with drive times.

**Exports:** `{ findNearestGrocery, findNearestPharmacy, findNearestGasStation }`

**Signatures:** unchanged from current app.js. Each takes `(originLatLng: string)`.

**Behavior:** Identical to current functions. Each imports:
- `{ googleMapsClient, googleMapsApiKey }` from `../../shared/google/client`
- `{ getDriveTime }` from `../../shared/google/distanceMatrix`
- `{ placesCache }` from `../../cache`
- `{ getMitigation }` from `../../errorMemory`
- `{ logError }` from `../../logger`
- Constants from `../../utils/constants`

**Helper moved with functions:** `isExcludedPlaceName` (app.js:155) — private to this module, not exported.

**Tests required:**
```
reachability/data.test.js:
  ✓ findNearestGrocery returns top 3 sorted by drive time (mock client + getDriveTime)
  ✓ findNearestGrocery filters GROCERY_EXCLUDED_TYPES
  ✓ findNearestGrocery throws when no results
  ✓ findNearestPharmacy returns name/address/location/driveTimeMinutes
  ✓ findNearestGasStation returns nearest result
  ✓ [Jeffersonville IN] reachability data.js must be listed as a test address
```

---

### `src/modules/access/data.js`

**Purpose:** Nearest interstate highway on-ramp via geocoding strategy.

**Exports:** `{ findNearestHighwayOnRamp }`

**Signature:** `(originLatLng: string): Promise<{ name, address, location, driveTimeMinutes, note }>`

**Behavior:** Identical to current function. This is the most complex function in scope — it makes up to 59 geocode calls + N interchange geocode calls. Imports:
- `{ googleMapsClient, googleMapsApiKey }` from `../../shared/google/client`
- `{ getDriveTime }` from `../../shared/google/distanceMatrix`
- `{ reverseGeocodeAddress }` from `../../shared/google/reverseGeocode` — **replaces the inline reverseGeocode call** at app.js:396
- `{ placesCache }` from `../../cache`
- Constants from `../../utils/constants`

**CONSTRAINT-005 note:** This function must NOT use text search for highways. The geocoding strategy (geocode each interstate by name) is the deliberate implementation mandated by CONSTRAINT-005 (BUG-003 postmortem).

**Tests required:**
```
access/data.test.js:
  ✓ findNearestHighwayOnRamp returns primary highway with driveTimeMinutes
  ✓ validates returned address contains highway number (filters false geocode matches)
  ✓ falls back to interchange geocoding for highways 20–50 min away
  ✓ othersNote lists additional highways within 20 minutes
  ✓ [Georgetown KY] I-75 should appear (known nearby interstate)
  ✓ [Jeffersonville IN] must be a listed test case
```

---

### `src/modules/health/data.js`

**Purpose:** Nearest hospital (drive-time verified) and nearest urgent care.

**Exports:** `{ findNearestHospital, findNearestUrgentCare }`

**Signatures:** each takes `(originLatLng: string)`.

**Behavior:** Identical to current functions. `findNearestHospital` implements CONSTRAINT-003: fetches top 5 candidates, calculates drive time to each, returns the one with the shortest drive time — never Google's rank order.

**Helper moved with functions:** `isRetailEmbeddedHealth` (app.js:332) — private to this module, not exported.

**CONSTRAINT-003 note:** The drive-time-sort logic is the most critical correctness requirement in the codebase. The test for it must demonstrate that when Google returns hospital B before hospital A but hospital A has a shorter drive time, `findNearestHospital` returns hospital A.

**Tests required:**
```
health/data.test.js:
  ✓ findNearestHospital returns nearest by drive time, not by Google search rank
    (mock: Google returns hospital[B, A], driveTime[B]=25, driveTime[A]=12 → returns A)
  ✓ findNearestHospital falls back to placesNearby when textSearch returns empty
  ✓ findNearestUrgentCare filters retail-embedded health (pharmacy/drugstore types)
  ✓ findNearestUrgentCare falls back to textSearch when placesNearby returns only retail
  ✓ [Jeffersonville IN] must be a listed test case
```

---

### `src/modules/schools/data.js`

**Purpose:** Nearest public school and nearest public elementary school.

**Exports:** `{ findNearestSchool, findNearestElementarySchool }`

**Signatures:** each takes `(originLatLng: string)`.

**Behavior:** Identical to current functions. Both add the drive-time disclaimer note.

**Helper moved with functions:** `isValidSchoolPlace` (app.js:547) — private to this module, not exported.

**CONSTRAINT-006 note:** Cross-state school filtering is NOT implemented in these data functions — that belongs in the logic layer (FR-035). These functions return raw results. The Jeffersonville IN test case is required, but the expected behavior at this layer is that the function returns whatever Google provides — cross-state rejection happens in validate.js. Document this clearly in the test file.

**Tests required:**
```
schools/data.test.js:
  ✓ findNearestSchool requires both school place type AND school name term
  ✓ findNearestSchool falls back to textSearch when placesNearby returns no valid school
  ✓ findNearestElementarySchool filters ELEMENTARY_SCHOOL_EXCLUSIONS (preschool, private, etc.)
  ✓ result includes driveTimeMinutes and disclaimer note
  ✓ [Jeffersonville IN] listed as test address (note: cross-state filtering not at this layer)
```

---

### `src/modules/recreation/data.js`

**Purpose:** Nearest park and nearest coffee shop.

**Exports:** `{ findNearestPark, findNearestCoffeeShop }`

**Signatures:** each takes `(originLatLng: string)`.

**Behavior:** Identical to current functions. `findNearestCoffeeShop` fetches top 5 candidates and returns the nearest by drive time.

**Helper moved with functions:** `isValidPark` (app.js:625) — private to this module, not exported.

**Tests required:**
```
recreation/data.test.js:
  ✓ findNearestPark filters PARK_EXCLUDED_TYPES
  ✓ findNearestPark filters establishment-typed places not in PARK_LEISURE_TYPES
  ✓ findNearestCoffeeShop returns nearest by drive time from top 5 candidates
  ✓ [Jeffersonville IN] listed as test case
```

---

## What Changes in `src/app.js`

After extraction, `app.js` removes:

1. The `Client` import and proxy construction block (lines 39–48) → replaced with `require('./shared/google/client')`
2. `geocodeAddress` function definition
3. `getDriveTime` function definition
4. `getTrafficVariations` function definition
5. The inline `reverseGeocode` call in the route handler → replaced with `reverseGeocodeAddress(originLatLng)`
6. `findNearestGrocery`, `findNearestPharmacy`, `findNearestGasStation`
7. `isExcludedPlaceName` helper
8. `findNearestHospital`, `findNearestUrgentCare`
9. `isRetailEmbeddedHealth` helper
10. `findNearestHighwayOnRamp`
11. `isValidSchoolPlace` helper
12. `findNearestSchool`, `findNearestElementarySchool`
13. `isValidPark` helper
14. `findNearestPark`, `findNearestCoffeeShop`
15. `generateComparisonData` imports of the above

And adds imports at the top:
```js
const { googleMapsClient, googleMapsApiKey } = require('./shared/google/client');
const { geocodeAddress } = require('./shared/google/geocoding');
const { reverseGeocodeAddress } = require('./shared/google/reverseGeocode');
const { getDriveTime, getTrafficVariations } = require('./shared/google/distanceMatrix');
const { findNearestGrocery, findNearestPharmacy, findNearestGasStation } = require('./modules/reachability/data');
const { findNearestHighwayOnRamp } = require('./modules/access/data');
const { findNearestHospital, findNearestUrgentCare } = require('./modules/health/data');
const { findNearestSchool, findNearestElementarySchool } = require('./modules/schools/data');
const { findNearestPark, findNearestCoffeeShop } = require('./modules/recreation/data');
```

`getPremiumData` call in the route handler gains two changes:
```js
premium = await getPremiumData({
  lat: origin.lat,
  lng: origin.lng,
  originLatLng,
  locationInfo,
  googleMapsClient,        // now imported from shared/google/client
  googleMapsApiKey,        // now imported from shared/google/client
  getDriveTime,            // now imported from shared/google/distanceMatrix
  highwayDriveMinutes,
});
```
This is unchanged in shape — `googleMapsClient` and `getDriveTime` now come from imports instead of local definitions, but the values are the same proxy-wrapped objects.

---

## What Changes in `src/premium.js`

Two functions move **out** of premium.js in this FR:
- `getCensusFIPS` → `src/shared/census.js`
- `fetchCensusACS` → `src/shared/census.js`

Premium.js adds at the top:
```js
const { getCensusFIPS, fetchCensusACS } = require('./shared/census');
```

And removes the two function definitions (~40 lines).

Everything else in premium.js is unchanged in this FR.

---

## Test Framework: Jest

**Install:**
```
npm install --save-dev jest
```

**package.json addition:**
```json
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch"
},
"jest": {
  "testEnvironment": "node",
  "testMatch": ["**/tests/**/*.test.js"]
}
```

**Mock pattern for Google client:**
```js
// tests/modules/health/data.test.js
const mockClient = {
  textSearch: jest.fn(),
  placesNearby: jest.fn(),
};
jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: mockClient,
  googleMapsApiKey: 'test-key',
}));
```

**Mock pattern for getDriveTime:**
```js
jest.mock('../../../src/shared/google/distanceMatrix', () => ({
  getDriveTime: jest.fn().mockResolvedValue(12),
  getTrafficVariations: jest.fn(),
}));
```

---

## Edge Cases

| Scenario | Expected behavior |
|----------|------------------|
| Google Places returns 0 results | function throws with descriptive message |
| All drive time lookups fail | function throws (hospital/grocery) or returns null candidate (park/coffee) |
| `getCensusFIPS` returns null | all Census ACS calls skip; premium sections render with null data |
| `AIRNOW_API_KEY` not set | `getAirQuality` returns null silently |
| `CENSUS_API_KEY` not set | `fetchCensusACS` returns null silently |
| Overpass all 4 endpoints fail | `getRoadNoiseOSM` returns null; `getRoadNoise` returns null |
| Highway geocoder returns unrelated location | `findNearestHighwayOnRamp` validates formatted_address contains highway number |
| All 59 interstate geocodes fail | throws `'No interstate highways found near that address.'` |

---

## Acceptance Criteria

1. `node -e "require('./src/app.js')"` loads without error (server already running — use load test, not start)
2. `node -e "require('./src/premium.js')"` loads without error
3. All module data files load independently: `node -e "require('./src/modules/*/data.js')"`
4. `npm test` runs and passes all tests
5. Georgetown KY report renders correctly (spot-check grocery, hospital, highway sections)
6. Jeffersonville IN report renders correctly (spot-check school section)
7. Harlan KY report renders correctly without crashing (rural address)
8. Bozeman MT report renders correctly (different climate region)
9. Louisville KY report renders correctly (urban address)
10. Zero `grep -r "function findNearest\|function getDriveTime\|function geocodeAddress"` matches in `src/app.js`

---

## Out of Scope

- Premium.js data functions (`getWalkabilityScore`, `getEmergencyServices`, `getEnvironmentalData`, `getSchoolRatings`, `getGrowthAndDevelopment`, `getPropertyIntelligence`, `getGardenData`) — deferred to FR-038
- Business logic changes (cross-state filtering, coherence checks) — FR-035
- HTML generation changes — FR-038/039
- New API integrations — their own FRs
- `generateComparisonData` — stays in app.js for now (orchestrator, not a data function)
- `src/server/` directory restructure — FR-041

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| `findNearestHighwayOnRamp` breaks after extraction (59 geocode calls, complex logic) | Medium | High | Extensive test coverage; test Georgetown KY (known I-75/I-64 result) |
| Cache key collisions after function moves (cache uses string keys) | Low | Medium | Cache keys unchanged — still `"grocery:{latLng}"` etc. |
| `getDriveTime` injection to premium.js breaks | Low | High | Verify `getPremiumData` call site in app.js passes new import, not local |
| Module circular dependency (data module → shared → data module) | Low | High | Shared layer imports nothing from modules |
| Jest mock interferes with module-level `fipsCache` Map | Low | Low | Reset cache between tests with `beforeEach` |
