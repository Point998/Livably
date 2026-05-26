# FR-037 Implementation Plan — Data Layer Extraction (Phase 3 of 7)
*Phase 3 — Planning (no code changes)*
*Date: 2026-05-25*

---

## Overview

Move all raw API-calling functions from `src/app.js` into:
- `src/shared/google/` — shared transport layer (client, geocoding, distance matrix)
- `src/shared/census.js` — Census FIPS and ACS (from premium.js)
- `src/modules/*/data.js` — one per chapter domain

Zero behavior change. Every stage is independently verifiable. Implementation is blocked until test framework is installed (CONSTRAINT-011).

**Execution rule:** Execute one stage at a time. Paste verification output after each stage before proceeding. Stop and flag if verification fails.

---

## Stage 0 — Install Jest and Prove the Framework Works

**Rationale:** CONSTRAINT-011 is non-negotiable — no data module is done without a test file. Jest must be installed and running before any source file is touched. The first commit of this FR is tests, not code.

### Steps

**0a.** Install Jest:
```
npm install --save-dev jest
```

**0b.** Add to `package.json`:
```json
"scripts": {
  "start": "node src/app.js",
  "test": "jest",
  "test:watch": "jest --watch"
},
"jest": {
  "testEnvironment": "node",
  "testMatch": ["**/tests/**/*.test.js"]
}
```

**0c.** Create the test directory tree (directories only — no files yet):
```
tests/
  shared/
    google/
  modules/
    reachability/
    access/
    health/
    schools/
    recreation/
```

**0d.** Write a smoke test at `tests/smoke.test.js`:
```js
test('jest is installed and running', () => {
  expect(1 + 1).toBe(2);
});
```

### Verification
```
npm test
```
Expected: 1 test suite, 1 passed. Zero failures.

### Commit
```
git add package.json package-lock.json tests/
git commit -m "feat(fr-037): install Jest, create test directory tree"
```

---

## Stage 1 — Create `src/shared/google/client.js`

**Rationale:** Everything else imports from here. Must exist before any data module is written. No changes to app.js yet.

### Steps

**1a.** Create directory `src/shared/google/`.

**1b.** Create `src/shared/google/client.js`:
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

**Note:** This is identical to the proxy construction already in app.js (lines 39–48). It's being extracted, not changed.

### Verification
```
node -e "require('./src/shared/google/client'); console.log('client.js: OK')"
```
Expected: `client.js: OK`

No test file required for client.js — it's a config-only module, tested indirectly through geocoding tests.

### Commit
```
git add src/shared/google/client.js
git commit -m "feat(fr-037): extract shared google client singleton (stage 1)"
```

---

## Stage 2 — Extract `geocodeAddress` → `src/shared/google/geocoding.js`

**Rationale:** Universal prerequisite. Nearly every data function needs it. Must be stable before module data files are written.

### Steps

**2a.** Create `src/shared/google/geocoding.js`.

Copy `geocodeAddress` from `src/app.js` (around line 136). The function accesses `geocodeCache`, `googleMapsClient`, and `googleMapsApiKey` as closures in app.js. In the new file they become imports:

```js
'use strict';
const { geocodeCache } = require('../../cache');
const { googleMapsClient, googleMapsApiKey } = require('./client');

async function geocodeAddress(address) {
  // [exact body from app.js — no changes]
}

module.exports = { geocodeAddress };
```

**2b.** Write `tests/shared/google/geocoding.test.js`:

```js
'use strict';
const mockClient = { geocode: jest.fn() };

jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: mockClient,
  googleMapsApiKey: 'test-key',
}));
jest.mock('../../../src/cache', () => ({
  geocodeCache: new Map(),
}));

const { geocodeAddress } = require('../../../src/shared/google/geocoding');

describe('geocodeAddress', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns { lat, lng } for valid address', async () => {
    mockClient.geocode.mockResolvedValue({
      data: { results: [{ geometry: { location: { lat: 38.2, lng: -84.5 } } }] },
    });
    const result = await geocodeAddress('100 Wishing Well Path, Georgetown, KY');
    expect(result).toEqual({ lat: 38.2, lng: -84.5 });
  });

  test('throws on empty results', async () => {
    mockClient.geocode.mockResolvedValue({ data: { results: [] } });
    await expect(geocodeAddress('invalid')).rejects.toThrow('Unable to geocode');
  });

  test('returns cached result without calling client on second call', async () => {
    mockClient.geocode.mockResolvedValue({
      data: { results: [{ geometry: { location: { lat: 38.2, lng: -84.5 } } }] },
    });
    const cache = require('../../../src/cache').geocodeCache;
    cache.clear();
    await geocodeAddress('Georgetown KY');
    await geocodeAddress('Georgetown KY');
    expect(mockClient.geocode).toHaveBeenCalledTimes(1);
  });
});
```

### Verification
```
npm test tests/shared/google/geocoding.test.js
node -e "require('./src/shared/google/geocoding'); console.log('geocoding.js: OK')"
```
Expected: 3 passing tests.

**Do not modify app.js yet** — `geocodeAddress` still lives in both places until Stage 6 wires the imports.

### Commit
```
git add src/shared/google/geocoding.js tests/shared/google/geocoding.test.js
git commit -m "feat(fr-037): extract geocodeAddress to shared/google/geocoding.js (stage 2)"
```

---

## Stage 3 — Extract reverse geocode → `src/shared/google/reverseGeocode.js`

**Rationale:** Two call sites exist — one in the `/report` route body, one inside `findNearestHighwayOnRamp`. Centralizing before extracting highway avoids having to thread the client through the highway function.

### Steps

**3a.** Create `src/shared/google/reverseGeocode.js`.

The reverse geocode logic is currently inline in the `/report` route (app.js around line 1707). Extract into a named function:

```js
'use strict';
const { googleMapsClient, googleMapsApiKey } = require('./client');

async function reverseGeocodeAddress(latLng) {
  try {
    const result = await googleMapsClient.reverseGeocode({
      params: { latlng: latLng, key: googleMapsApiKey },
    });
    const components = result.data.results[0]?.address_components || [];
    const get = (type) =>
      components.find((c) => c.types.includes(type))?.long_name || '';
    const getShort = (type) =>
      components.find((c) => c.types.includes(type))?.short_name || '';
    return {
      city: get('locality') || get('sublocality') || get('administrative_area_level_3'),
      state: getShort('administrative_area_level_1'),
      county: get('administrative_area_level_2'),
      zip: get('postal_code'),
    };
  } catch {
    return { city: '', state: '', county: '', zip: '' };
  }
}

module.exports = { reverseGeocodeAddress };
```

**Important:** Read the actual route body in app.js before writing this function. The exact field extraction logic must match what the route currently does — do not guess.

**3b.** Write `tests/shared/google/reverseGeocode.test.js`:

```js
'use strict';
const mockClient = { reverseGeocode: jest.fn() };

jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: mockClient,
  googleMapsApiKey: 'test-key',
}));

const { reverseGeocodeAddress } = require('../../../src/shared/google/reverseGeocode');

const makeComponent = (type, long, short) => ({
  types: [type],
  long_name: long,
  short_name: short || long,
});

describe('reverseGeocodeAddress', () => {
  beforeEach(() => jest.clearAllMocks());

  test('extracts city, state, county, zip from mock response', async () => {
    mockClient.reverseGeocode.mockResolvedValue({
      data: {
        results: [{
          address_components: [
            makeComponent('locality', 'Georgetown'),
            makeComponent('administrative_area_level_1', 'Kentucky', 'KY'),
            makeComponent('administrative_area_level_2', 'Scott County'),
            makeComponent('postal_code', '40324'),
          ],
        }],
      },
    });
    const result = await reverseGeocodeAddress('38.2,-84.5');
    expect(result).toEqual({
      city: 'Georgetown',
      state: 'KY',
      county: 'Scott County',
      zip: '40324',
    });
  });

  test('returns empty strings for missing components (not null, not throws)', async () => {
    mockClient.reverseGeocode.mockResolvedValue({ data: { results: [{ address_components: [] }] } });
    const result = await reverseGeocodeAddress('0,0');
    expect(result).toEqual({ city: '', state: '', county: '', zip: '' });
  });

  test('returns empty strings on network error', async () => {
    mockClient.reverseGeocode.mockRejectedValue(new Error('network'));
    const result = await reverseGeocodeAddress('0,0');
    expect(result).toEqual({ city: '', state: '', county: '', zip: '' });
  });
});
```

### Verification
```
npm test tests/shared/google/reverseGeocode.test.js
node -e "require('./src/shared/google/reverseGeocode'); console.log('reverseGeocode.js: OK')"
```
Expected: 3 passing tests.

### Commit
```
git add src/shared/google/reverseGeocode.js tests/shared/google/reverseGeocode.test.js
git commit -m "feat(fr-037): extract reverseGeocodeAddress to shared/google/reverseGeocode.js (stage 3)"
```

---

## Stage 4 — Extract `getDriveTime` / `getTrafficVariations` → `src/shared/google/distanceMatrix.js`

**Rationale:** Most frequently called shared function. Every module data file needs it. Must be extracted before any module data file is written.

### Steps

**4a.** Create `src/shared/google/distanceMatrix.js`.

Copy `getDriveTime` (app.js:160) and `getTrafficVariations` (app.js:92). Both access `driveTimeCache`, `googleMapsClient`, `googleMapsApiKey`, and time utilities as closures. In the new file:

```js
'use strict';
const { driveTimeCache } = require('../../cache');
const { googleMapsClient, googleMapsApiKey } = require('./client');
const { getNextTuesday8am } = require('../../utils/time');

async function getDriveTime(originLatLng, destinationLatLng) {
  // [exact body from app.js]
}

async function getTrafficVariations(originLatLng, destLocation) {
  // [exact body from app.js]
}

module.exports = { getDriveTime, getTrafficVariations };
```

**4b.** Write `tests/shared/google/distanceMatrix.test.js`:

```js
'use strict';
const mockClient = { distancematrix: jest.fn() };

jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: mockClient,
  googleMapsApiKey: 'test-key',
}));
jest.mock('../../../src/cache', () => ({
  driveTimeCache: new Map(),
}));
jest.mock('../../../src/utils/time', () => ({
  getNextTuesday8am: jest.fn().mockReturnValue(1748000000),
  getNextDayAt: jest.fn().mockReturnValue(1748000000),
}));

const { getDriveTime, getTrafficVariations } = require('../../../src/shared/google/distanceMatrix');

const makeMatrixResponse = (seconds) => ({
  data: {
    rows: [{ elements: [{ status: 'OK', duration_in_traffic: { value: seconds } }] }],
  },
});

describe('getDriveTime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    require('../../../src/cache').driveTimeCache.clear();
  });

  test('returns integer minutes', async () => {
    mockClient.distancematrix.mockResolvedValue(makeMatrixResponse(720)); // 720s = 12 min
    const result = await getDriveTime('38.2,-84.5', { lat: 38.3, lng: -84.4 });
    expect(result).toBe(12);
  });

  test('returns cached value on second call', async () => {
    mockClient.distancematrix.mockResolvedValue(makeMatrixResponse(720));
    await getDriveTime('38.2,-84.5', { lat: 38.3, lng: -84.4 });
    await getDriveTime('38.2,-84.5', { lat: 38.3, lng: -84.4 });
    expect(mockClient.distancematrix).toHaveBeenCalledTimes(1);
  });

  test('throws on non-OK element status', async () => {
    mockClient.distancematrix.mockResolvedValue({
      data: { rows: [{ elements: [{ status: 'NOT_FOUND' }] }] },
    });
    await expect(getDriveTime('38.2,-84.5', { lat: 38.3, lng: -84.4 })).rejects.toThrow();
  });
});

describe('getTrafficVariations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    require('../../../src/cache').driveTimeCache.clear();
  });

  test('returns null when all slots fail', async () => {
    mockClient.distancematrix.mockRejectedValue(new Error('timeout'));
    const result = await getTrafficVariations('38.2,-84.5', { lat: 38.3, lng: -84.4 });
    expect(result).toBeNull();
  });

  test('calculates min/max/avg correctly from successful slots', async () => {
    mockClient.distancematrix
      .mockResolvedValueOnce(makeMatrixResponse(600))   // 10 min
      .mockResolvedValueOnce(makeMatrixResponse(900))   // 15 min
      .mockResolvedValueOnce(makeMatrixResponse(1200))  // 20 min
      .mockResolvedValueOnce(makeMatrixResponse(720));  // 12 min
    const result = await getTrafficVariations('38.2,-84.5', { lat: 38.3, lng: -84.4 });
    expect(result).not.toBeNull();
    expect(result.stats.min).toBe(10);
    expect(result.stats.max).toBe(20);
  });
});
```

### Verification
```
npm test tests/shared/google/distanceMatrix.test.js
node -e "require('./src/shared/google/distanceMatrix'); console.log('distanceMatrix.js: OK')"
```
Expected: 5 passing tests.

### Commit
```
git add src/shared/google/distanceMatrix.js tests/shared/google/distanceMatrix.test.js
git commit -m "feat(fr-037): extract getDriveTime/getTrafficVariations to shared/google/distanceMatrix.js (stage 4)"
```

---

## Stage 5 — Extract `getCensusFIPS` / `fetchCensusACS` → `src/shared/census.js`

**Rationale:** Currently in premium.js. Multiple future modules need Census FIPS. Extracting here also touches premium.js (the first edit to a source file in this FR).

### Steps

**5a.** Read `src/premium.js` lines 44–100 to capture exact implementations of `getCensusFIPS` and `fetchCensusACS` including the `fipsCache` module-level Map.

**5b.** Create `src/shared/census.js`:
```js
'use strict';

const fipsCache = new Map();

async function getCensusFIPS(lat, lng) {
  // [exact body from premium.js — fipsCache, fetch call, etc.]
}

async function fetchCensusACS(fips, vars) {
  // [exact body from premium.js]
}

module.exports = { getCensusFIPS, fetchCensusACS };
```

**5c.** Write `tests/shared/census.test.js`:
```js
'use strict';

jest.mock('node-fetch'); // if used, or mock global fetch

describe('getCensusFIPS', () => {
  test('returns { state, county, tract } on success', async () => { /* ... */ });
  test('returns null on network error', async () => { /* ... */ });
  test('returns cached result on second call', async () => { /* ... */ });
});

describe('fetchCensusACS', () => {
  test('returns null when CENSUS_API_KEY missing', async () => { /* ... */ });
  test('parses ACS response into get() accessor correctly', async () => { /* ... */ });
});
```

Flesh out test bodies by reading the function implementation — mock `fetch` to return the shape that Census returns.

**5d.** Edit `src/premium.js`:
- Add at top: `const { getCensusFIPS, fetchCensusACS } = require('./shared/census');`
- Remove `getCensusFIPS` function definition and `fipsCache` declaration
- Remove `fetchCensusACS` function definition

**5e.** Verify premium.js still loads:
```
node -e "require('./src/premium.js'); console.log('premium.js: OK')"
```

### Verification
```
npm test tests/shared/census.test.js
node -e "require('./src/shared/census'); console.log('census.js: OK')"
node -e "require('./src/premium.js'); console.log('premium.js: OK')"
```
Expected: 5 passing census tests, both modules load clean.

### Commit
```
git add src/shared/census.js tests/shared/census.test.js src/premium.js
git commit -m "feat(fr-037): extract getCensusFIPS/fetchCensusACS to shared/census.js (stage 5)"
```

---

## Stage 6 — Wire `src/app.js` to the Shared Layer

**Rationale:** This is the first edit to app.js. It removes the Client proxy construction block and replaces `geocodeAddress`, `getDriveTime`, `getTrafficVariations` with imports from the shared layer. The inline reverse geocode in the route handler becomes a call to `reverseGeocodeAddress`. The data functions themselves are not moved yet — that's Stages 7–11.

### Steps

**6a.** Read current app.js imports block (lines 1–55) and proxy construction.

**6b.** Edit `src/app.js`:

At the top, replace:
```js
const { Client } = require('@googlemaps/google-maps-services-js');
// ... proxy construction block (~10 lines) ...
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
```
With:
```js
const { googleMapsClient, googleMapsApiKey } = require('./shared/google/client');
```

Add imports (before the `find*` function definitions):
```js
const { geocodeAddress } = require('./shared/google/geocoding');
const { reverseGeocodeAddress } = require('./shared/google/reverseGeocode');
const { getDriveTime, getTrafficVariations } = require('./shared/google/distanceMatrix');
```

Remove the three function definitions from app.js:
- `geocodeAddress` (~10 lines)
- `getDriveTime` (~20 lines)
- `getTrafficVariations` (~40 lines)

Find the inline reverse geocode in the `/report` route body (around line 1707). Replace:
```js
const revResult = await googleMapsClient.reverseGeocode({ params: { latlng: originLatLng, key: googleMapsApiKey } });
// ... inline component extraction ...
const locationInfo = { city, state, county, zip };
```
With:
```js
const locationInfo = await reverseGeocodeAddress(originLatLng);
```

Also replace the inline reverse geocode call inside `findNearestHighwayOnRamp` (app.js:396) with `await reverseGeocodeAddress(originLatLng)`. (This will move with the function in Stage 8, but the import is needed now.)

**6c.** Verify:
```
node -e "require('./src/app.js'); console.log('app.js: OK')"
```

**Note:** This starts the server — use `node -e "require('./src/app.js')"` which will start listening, or use:
```
node -e "
  process.env.GOOGLE_MAPS_API_KEY = 'test';
  const mod = require('./src/app.js');
  console.log('app.js: OK');
  process.exit(0);
"
```

Actually, for a load-only check use: `node --check src/app.js` (syntax only) then test the server starts with `curl http://localhost:3000/` in a separate terminal.

### Verification
```
node --check src/app.js
```
Then start the server briefly and confirm HTTP 200 from the root route:
```
node src/app.js &
sleep 2
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
kill %1
```
Expected: `200`

### Commit
```
git add src/app.js
git commit -m "feat(fr-037): wire app.js to shared google layer — remove local proxy/geocode/driveTime (stage 6)"
```

---

## Stage 7 — Extract `src/modules/reachability/data.js`

Functions: `findNearestGrocery`, `findNearestPharmacy`, `findNearestGasStation`
Helper: `isExcludedPlaceName`

### Steps

**7a.** Create directory `src/modules/reachability/`.

**7b.** Create `src/modules/reachability/data.js`.

Copy the three functions plus `isExcludedPlaceName` from app.js. Replace closure access with imports:
```js
'use strict';
const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { getDriveTime } = require('../../shared/google/distanceMatrix');
const { placesCache } = require('../../cache');
const { getMitigation } = require('../../errorMemory');
const { logError } = require('../../logger');
const {
  GROCERY_SEARCH_RADIUS_M, GROCERY_CANDIDATE_COUNT,
  PHARMACY_SEARCH_RADIUS_M,
  GAS_SEARCH_RADIUS_M,
  GROCERY_EXCLUDED_TYPES,
  // ... whatever constants these functions use
} = require('../../utils/constants');

function isExcludedPlaceName(name) { /* ... */ }
async function findNearestGrocery(originLatLng) { /* ... */ }
async function findNearestPharmacy(originLatLng) { /* ... */ }
async function findNearestGasStation(originLatLng) { /* ... */ }

module.exports = { findNearestGrocery, findNearestPharmacy, findNearestGasStation };
```

**Note:** `isExcludedPlaceName` is NOT exported — it's private to this module.

**7c.** Write `tests/modules/reachability/data.test.js`:
```js
// Mock client and distanceMatrix at the top, then:
describe('findNearestGrocery', () => {
  test('returns top 3 sorted by drive time', async () => { /* ... */ });
  test('filters GROCERY_EXCLUDED_TYPES', async () => { /* ... */ });
  test('throws when no results after filtering', async () => { /* ... */ });
});
describe('findNearestPharmacy', () => {
  test('returns name/address/location/driveTimeMinutes', async () => { /* ... */ });
});
describe('findNearestGasStation', () => {
  test('returns nearest result', async () => { /* ... */ });
});
// Note: Jeffersonville IN is a required test address per CONSTRAINT-011.
// Since these functions require real API calls, document the manual test address
// in a comment block at the top of the file.
```

**7d.** Edit app.js:
- Add: `const { findNearestGrocery, findNearestPharmacy, findNearestGasStation } = require('./modules/reachability/data');`
- Remove: `isExcludedPlaceName`, `findNearestGrocery`, `findNearestPharmacy`, `findNearestGasStation` definitions

### Verification
```
npm test tests/modules/reachability/data.test.js
node --check src/app.js
node -e "require('./src/modules/reachability/data'); console.log('reachability/data.js: OK')"
```
Expected: all tests pass, both modules load.

### Commit
```
git add src/modules/reachability/data.js tests/modules/reachability/data.test.js src/app.js
git commit -m "feat(fr-037): extract reachability data layer (stage 7)"
```

---

## Stage 8 — Extract `src/modules/access/data.js`

Function: `findNearestHighwayOnRamp`

**Note:** This is the most complex and API-intensive function. It makes up to 59 geocode calls + N interchange geocode calls. The inline reverse geocode call at app.js:396 was already updated to `reverseGeocodeAddress` in Stage 6.

### Steps

**8a.** Create `src/modules/access/`.

**8b.** Create `src/modules/access/data.js`:
```js
'use strict';
const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client');
const { geocodeAddress } = require('../../shared/google/geocoding');
const { reverseGeocodeAddress } = require('../../shared/google/reverseGeocode');
const { getDriveTime } = require('../../shared/google/distanceMatrix');
const { placesCache } = require('../../cache');
const { INTERSTATE_LIST, /* other constants */ } = require('../../utils/constants');

async function findNearestHighwayOnRamp(originLatLng) { /* exact body */ }

module.exports = { findNearestHighwayOnRamp };
```

**CONSTRAINT-005:** This function must NOT use text search for highways. The geocoding strategy is mandatory per PM-002.

**8c.** Write `tests/modules/access/data.test.js`:
```js
describe('findNearestHighwayOnRamp', () => {
  test('returns primary highway with driveTimeMinutes', async () => { /* ... */ });
  test('validates formatted_address contains highway number (rejects false geocode match)', async () => { /* ... */ });
  test('othersNote lists additional highways within 20 minutes', async () => { /* ... */ });
  // Manual test addresses (require real API):
  // Georgetown KY → should find I-75
  // Jeffersonville IN → listed as required test address per CONSTRAINT-011
});
```

**8d.** Edit app.js:
- Add: `const { findNearestHighwayOnRamp } = require('./modules/access/data');`
- Remove: `findNearestHighwayOnRamp` definition

### Verification
```
npm test tests/modules/access/data.test.js
node --check src/app.js
node -e "require('./src/modules/access/data'); console.log('access/data.js: OK')"
```

### Commit
```
git add src/modules/access/data.js tests/modules/access/data.test.js src/app.js
git commit -m "feat(fr-037): extract highway access data layer (stage 8)"
```

---

## Stage 9 — Extract `src/modules/health/data.js`

Functions: `findNearestHospital`, `findNearestUrgentCare`
Helper: `isRetailEmbeddedHealth`

**CONSTRAINT-003 is the critical correctness requirement here.** The test must prove drive-time-sort behavior, not Google rank order.

### Steps

**9a.** Create `src/modules/health/` and `src/modules/health/data.js`.

**9b.** Write `tests/modules/health/data.test.js`:

The CONSTRAINT-003 test is mandatory:
```js
test('findNearestHospital returns nearest by drive time not by Google search rank', async () => {
  // Google returns [hospitalB, hospitalA] in that order
  // getDriveTime returns 25min for B, 12min for A
  // Expect result to be hospitalA
  mockTextSearch.mockResolvedValue({
    data: {
      results: [
        { name: 'Hospital B', place_id: 'B', geometry: { location: { lat: 38.3, lng: -84.4 } }, vicinity: 'addr B' },
        { name: 'Hospital A', place_id: 'A', geometry: { location: { lat: 38.2, lng: -84.5 } }, vicinity: 'addr A' },
      ],
    },
  });
  mockGetDriveTime
    .mockResolvedValueOnce(25)   // Hospital B
    .mockResolvedValueOnce(12);  // Hospital A
  const result = await findNearestHospital('38.15,-84.55');
  expect(result.name).toBe('Hospital A');
  expect(result.driveTimeMinutes).toBe(12);
});
```

**9c.** Edit app.js to remove definitions and add import.

### Verification
```
npm test tests/modules/health/data.test.js
node --check src/app.js
```
Expected: CONSTRAINT-003 test passes. All health tests pass.

### Commit
```
git add src/modules/health/data.js tests/modules/health/data.test.js src/app.js
git commit -m "feat(fr-037): extract health data layer with CONSTRAINT-003 test coverage (stage 9)"
```

---

## Stage 10 — Extract `src/modules/schools/data.js`

Functions: `findNearestSchool`, `findNearestElementarySchool`
Helper: `isValidSchoolPlace`

**CONSTRAINT-006 note:** Cross-state filtering does NOT belong at this layer (belongs in validate.js). Tests document this explicitly.

### Steps

**10a.** Create `src/modules/schools/data.js`.

**10b.** Write `tests/modules/schools/data.test.js`:
```js
// NOTE: Cross-state school filtering (CONSTRAINT-006) is NOT implemented at this layer.
// These functions return raw API results. Cross-state rejection happens in validate.js.
// Jeffersonville IN is a required test address per CONSTRAINT-011.
describe('findNearestSchool', () => {
  test('requires both school place type AND school name term', async () => { /* ... */ });
  test('falls back to textSearch when placesNearby returns no valid school', async () => { /* ... */ });
});
describe('findNearestElementarySchool', () => {
  test('filters ELEMENTARY_SCHOOL_EXCLUSIONS', async () => { /* ... */ });
  test('result includes driveTimeMinutes and disclaimer note', async () => { /* ... */ });
});
```

**10c.** Edit app.js to remove definitions and add import.

### Verification
```
npm test tests/modules/schools/data.test.js
node --check src/app.js
```

### Commit
```
git add src/modules/schools/data.js tests/modules/schools/data.test.js src/app.js
git commit -m "feat(fr-037): extract schools data layer (stage 10)"
```

---

## Stage 11 — Extract `src/modules/recreation/data.js`

Functions: `findNearestPark`, `findNearestCoffeeShop`
Helper: `isValidPark`

### Steps

**11a.** Create `src/modules/recreation/data.js`.

**11b.** Write `tests/modules/recreation/data.test.js`:
```js
describe('findNearestPark', () => {
  test('filters PARK_EXCLUDED_TYPES', async () => { /* ... */ });
  test('filters establishment-typed places not in PARK_LEISURE_TYPES', async () => { /* ... */ });
});
describe('findNearestCoffeeShop', () => {
  test('returns nearest by drive time from top 5 candidates', async () => { /* ... */ });
});
```

**11c.** Edit app.js to remove definitions and add import.

### Verification
```
npm test tests/modules/recreation/data.test.js
node --check src/app.js
```

### Commit
```
git add src/modules/recreation/data.js tests/modules/recreation/data.test.js src/app.js
git commit -m "feat(fr-037): extract recreation data layer (stage 11)"
```

---

## Stage 12 — Full Verification

### 12a. Acceptance criteria check

```
# 1. All modules load
node -e "require('./src/app.js'); process.exit(0)"
node -e "require('./src/premium.js'); process.exit(0)"
node -e "require('./src/modules/reachability/data'); console.log('reachability: OK')"
node -e "require('./src/modules/access/data'); console.log('access: OK')"
node -e "require('./src/modules/health/data'); console.log('health: OK')"
node -e "require('./src/modules/schools/data'); console.log('schools: OK')"
node -e "require('./src/modules/recreation/data'); console.log('recreation: OK')"

# 2. All tests pass
npm test

# 3. No find*/getDriveTime/geocodeAddress definitions remain in app.js
grep -n "^async function findNearest\|^async function getDriveTime\|^async function geocodeAddress\|^async function getTrafficVariations" src/app.js
# Expected: no matches

# 4. Server HTTP 200
node src/app.js &
sleep 2 && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ && kill %1
```

### 12b. Manual test on all 5 addresses

Start the server and generate reports for:
1. `100 Wishing Well Path Unit 2306, Georgetown, KY 40324` — spot check: grocery, hospital, highway (I-75)
2. `456 Rural Route 1, Harlan, KY 40831` — must not crash (rural mode)
3. `123 Main St, Louisville, KY 40202` — urban address
4. `789 Main St, Bozeman, MT 59715` — western US
5. `1007 Stonelilly Dr, Jeffersonville, IN 47130` — school section must not return KY school

### Commit
```
git add -A
git commit -m "docs(fr-037): verification complete — full test suite passing, all 5 addresses verified"
git push
```

---

## Final File Count

New files created:

| File | Type |
|------|------|
| `src/shared/google/client.js` | Config |
| `src/shared/google/geocoding.js` | Data |
| `src/shared/google/reverseGeocode.js` | Data |
| `src/shared/google/distanceMatrix.js` | Data |
| `src/shared/census.js` | Data |
| `src/modules/reachability/data.js` | Data |
| `src/modules/access/data.js` | Data |
| `src/modules/health/data.js` | Data |
| `src/modules/schools/data.js` | Data |
| `src/modules/recreation/data.js` | Data |
| `tests/smoke.test.js` | Test |
| `tests/shared/google/geocoding.test.js` | Test |
| `tests/shared/google/reverseGeocode.test.js` | Test |
| `tests/shared/google/distanceMatrix.test.js` | Test |
| `tests/shared/census.test.js` | Test |
| `tests/modules/reachability/data.test.js` | Test |
| `tests/modules/access/data.test.js` | Test |
| `tests/modules/health/data.test.js` | Test |
| `tests/modules/schools/data.test.js` | Test |
| `tests/modules/recreation/data.test.js` | Test |

Modified files: `src/app.js`, `src/premium.js`, `package.json`

---

## Risks and Mitigations

| Risk | Stage | Mitigation |
|------|-------|-----------|
| `findNearestHighwayOnRamp` breaks (59 geocode calls, complex logic) | 8 | Georgetown KY smoke test; verify I-75 result |
| `getDriveTime` injection to premium.js breaks | 6 | Verify `getPremiumData` call site in app.js still passes getDriveTime correctly |
| Module-scope const redeclaration (same failure mode as FR-036) | All | Remove old definition BEFORE or simultaneously with adding import; run `node --check` after each |
| Cache key collisions after move | All | Cache keys are string-based and unchanged — `"grocery:{latLng}"` etc. |
| `reverseGeocodeAddress` field extraction doesn't match current inline code | 3 | Read the exact inline code before writing the function |
| Jest mock module caching between tests | All | Use `jest.resetModules()` or `beforeEach(jest.clearAllMocks)` |
