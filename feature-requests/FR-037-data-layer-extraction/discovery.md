# FR-037 Discovery — Data Layer Extraction
*Phase 1 of 4 (no code changes)*
*Date: 2026-05-25*

---

## Architecture Conflict: Two Competing Target Structures

Before cataloguing what to move, there's a structural question to resolve.

**LIVABLY-ARCHITECTURE.md** proposes a flat data layer:
```
src/data/google/geocoding.js
src/data/google/places.js
src/data/government/fema.js
src/data/government/census.js
...
```

**docs/plans/module-restructure.md** (CLAUDE.md's declared "Architecture reference") proposes a module pattern:
```
src/modules/reachability/data.js
src/modules/health/data.js
src/modules/garden/data.js
...
src/shared/google/geocoding.js
src/shared/google/places.js
```

These are meaningfully different. The flat structure (`src/data/`) groups by API provider. The module structure groups by domain chapter. The CLAUDE.md says module-restructure.md is the architecture reference. The module pattern also aligns with the "each chapter owns its domain" principle in CLAUDE.md.

**This needs an explicit decision before spec writing.** The recommendation is to follow module-restructure.md, but the spec must document which structure was chosen and why.

---

## Section 1: Google API Calls

All Google API calls go through the `googleMapsClient` proxy in app.js (lines 39–48). The proxy wraps every method call through `makeGoogleMapsRequest()` for rate limiting and retry logic. This matters: **data modules cannot instantiate their own raw `Client`** — they must receive the proxy or an equivalent.

### 1.1 Geocoding

**Function:** `geocodeAddress(address)` — `src/app.js:136`

- **API:** `googleMapsClient.geocode`
- **Client access:** closure (module-level `googleMapsClient`, `googleMapsApiKey`)
- **Cache:** `geocodeCache` keyed by normalized address string
- **Returns:** `{ lat, lng }` Google geometry location
- **Called by:** `/report` route (line 1701), `generateComparisonData` (line 1926), custom destination loop (line 1744)
- **Note:** This is the universal prerequisite. Nothing works without it.

### 1.2 Reverse Geocoding

**Two call sites, different shapes:**

**Call site A:** Inside `findNearestHighwayOnRamp` — `src/app.js:396`
- `googleMapsClient.reverseGeocode({ latlng: originLatLng })`
- Extracts city, state for highway search context
- Closure access

**Call site B:** In `/report` route body — `src/app.js:1707`
- `googleMapsClient.reverseGeocode({ latlng: originLatLng })`
- Extracts `{ city, state, county, zip }` → `locationInfo` object
- Closure access
- `locationInfo` is passed to every premium data function

These are logically the same operation with different consumers. In the module structure, this becomes `src/shared/google/reverseGeocode.js`.

### 1.3 Distance Matrix (Drive Time)

**Function:** `getDriveTime(originLatLng, destinationLatLng)` — `src/app.js:160`

- **API:** `googleMapsClient.distancematrix`
- **Client access:** closure
- **Cache:** `driveTimeCache` keyed by `origin:dest` string
- **Departure time:** `getNextTuesday8am()` — always future, always 8am
- **Returns:** integer minutes
- **Called by:** every `find*` function that needs a drive time; also `getEmergencyServices` and `getSchoolRatings` in premium.js (passed as a function argument — see Section 4)

**Function:** `getTrafficVariations(originLatLng, destLocation)` — `src/app.js:92`

- **API:** `googleMapsClient.distancematrix` (4 slots: Mon 8am, Mon 12pm, Mon 5pm, Sat 10am)
- **Client access:** closure
- **Cache:** `driveTimeCache` keyed by `traffic:{origin}:{dest}:{label}`
- **Returns:** `{ variations: [...], stats: { min, max, avg, range } }`
- **Called by:** `/report` route (line 1762) for grocery, hospital, and work-type custom destinations

### 1.4 Places Search — `src/app.js` Functions

| Function | API method | Query type | closure/param |
|----------|-----------|-----------|--------------|
| `findNearestGrocery` | `textSearch` | `'grocery store'`, radius 8000m | closure |
| `findNearestPharmacy` | `placesNearby` | rankby distance, type `pharmacy` | closure |
| `findNearestHospital` | `textSearch` → fallback `placesNearby` | `'hospital emergency department'`, radius 50000m | closure |
| `findNearestUrgentCare` | `placesNearby` → fallback `textSearch` | keyword `'urgent care'` | closure |
| `findNearestSchool` | `placesNearby` → fallback `textSearch` | type `school` / query `'school'` | closure |
| `findNearestGasStation` | `placesNearby` | rankby distance, type `gas_station` | closure |
| `findNearestPark` | `placesNearby` | rankby distance, type `park` | closure |
| `findNearestCoffeeShop` | `placesNearby` | rankby distance, type `cafe` | closure |
| `findNearestElementarySchool` | `textSearch` | `'public elementary school'`, radius 8000m | closure |

**Geocoding calls within highway search:**
- `findNearestHighwayOnRamp` makes up to 59 geocode calls (one per interstate) + up to N interchange geocode calls — `src/app.js:411,475`

### 1.5 Places Search — `src/premium.js` Functions

All premium Google Places functions take `(googleMapsClient, googleMapsApiKey)` as **explicit parameters**, not closures.

| Function | API method | Parameters | Notes |
|----------|-----------|-----------|-------|
| `getWalkabilityScore` | `placesNearby` × 5 types | `(lat, lng, googleMapsClient, googleMapsApiKey)` | WALK_TYPES: grocery, restaurant, transit, park, pharmacy |
| `getEmergencyServices` | `placesNearby` × 2 | `(lat, lng, originLatLng, googleMapsClient, googleMapsApiKey, getDriveTime)` | police + fire_station |
| `getAirportData` | `placesNearby` | `(lat, lng, googleMapsClient, googleMapsApiKey)` | type: airport, radius AIRPORT_SEARCH_RADIUS_M |
| `getSchoolRatings` | `textSearch` × 3 + `textSearch` | `(lat, lng, originLatLng, googleMapsClient, googleMapsApiKey, getDriveTime)` | elem/middle/high + private, radii 20000/16000 |
| `getRecentDevelopmentActivity` | `placesNearby` × 6 types | `(lat, lng, googleMapsClient, googleMapsApiKey)` | COMMERCIAL_DEV_TYPES, radius 2400m |

**`getDriveTime` injection:** `getEmergencyServices` and `getSchoolRatings` receive `getDriveTime` as an explicit function argument, passed down from `getPremiumData`, which receives it from the `/report` route. This is the cleanest pattern in the codebase — functions that need drive time calculation have it injected rather than using a closure.

---

## Section 2: Non-Google API Calls

All non-Google calls use native `fetch()` with `AbortSignal.timeout`.

### 2.1 Census APIs (two endpoints)

**Census FIPS Geocoder** — `getCensusFIPS` (`src/premium.js:44`)
- **URL:** `https://geocoding.geo.census.gov/geocoder/geographies/coordinates`
- **Params:** `x={lng}&y={lat}&benchmark=Public_AR_Current&vintage=Current_Current`
- **Auth:** none
- **Returns:** `{ state: FIPS, county: FIPS, tract: FIPS }` — the key used by all Census ACS calls
- **Cache:** module-level `Map` (fipsCache), keyed by `lat,lng` rounded to 4 decimals
- **Called by:** `getPremiumData` as the first sequential await before the parallel fan-out

**Census ACS 5-Year Estimates** — `fetchCensusACS` (`src/premium.js:65`)
- **URL:** `https://api.census.gov/data/2022/acs/acs5`
- **Auth:** `CENSUS_API_KEY` env var (optional — works without it but may be rate-limited)
- **Called by:** `getDemographics` (two batches, 36 variables total), `getPropertyData`, `getPropertyIntelligence`, `getNewConstructionContext`, `getLightPollution`, `getBuildingPermitTrend`

**Census Building Permits API** — `getBuildingPermitTrend` (`src/premium.js:910`)
- **URL:** `https://api.census.gov/data/timeseries/eits/bps`
- **Auth:** `CENSUS_API_KEY` env var (optional)
- **Sequential:** loops over 3 years (current - 0, -1, -2) with separate requests per year

### 2.2 FEMA

**FEMA NFHL (Flood Map Service Center)** — `getFloodRisk` (`src/premium.js:410`)
- **URL:** `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query`
- **Params:** point geometry, outFields: FLD_ZONE, STUDY_TYP
- **Auth:** none
- **Returns:** `{ zone, risk, insuranceRequired, description }` (via `interpretFloodZone`)

### 2.3 EPA

**AirNow API** — `getAirQuality` (`src/premium.js:385`)
- **URL:** `https://www.airnowapi.org/aq/observation/latLong/current/`
- **Auth:** `AIRNOW_API_KEY` env var — returns `null` silently if key missing
- **Returns:** `{ aqi, category, primaryPollutant }`

**EPA EJSCREEN** — `getEJScreen` (`src/premium.js:803`)
- **URL:** `https://ejscreen.epa.gov/mapper/ejscreenRESTbroker.aspx`
- **Auth:** none
- **Returns:** `{ superfundPct, rmpPct, tsdfPct, flagged }` — percentile ranks
- **Note in code:** URL may migrate; domain flagged as potentially unstable

**EPA ECHO / SDWIS (Water Quality)** — `getWaterQuality` (`src/premium.js:736`)
- **Two-step:** (1) get facility list, (2) get violations for the facility's PWS ID
- **URLs:** `https://echodata.epa.gov/echo/sdw_rest_services.get_facilities` → `sdw_rest_services.get_violations`
- **Auth:** none
- **Note in code:** sdw_rest_services may be deprecated; verify endpoint

### 2.4 BTS (Bureau of Transportation Statistics)

**National Transportation Noise Map** — `getRoadNoise` (`src/premium.js:581`)
- **URL:** `https://gis.bts.gov/arcgis/rest/services/National_Transportation_Noise_Map/MapServer/0/query`
- **Auth:** none
- **Returns:** `{ dnl, source: 'BTS', category, nearestRoad: null }`
- **Fallback:** if BTS fails or returns null → `getRoadNoiseOSM` (OSM Overpass)

### 2.5 OpenStreetMap / Overpass API

**Overpass API** — `fetchOverpass` (`src/premium.js:603`)
- **Endpoints:** 4 in round-robin — overpass-api.de, lz4.overpass-api.de, overpass.kumi.systems, overpass.openstreetmap.fr
- **Used by three functions:**
  - `getRoadNoiseOSM`: roads within `OSM_ROAD_NOISE_RADIUS_M` (4000m)
  - `getRailProximity`: rail lines within `OSM_RAIL_RADIUS_M` (4800m)
  - `fetchLanduseOSM`: landuse within `OSM_LANDUSE_RADIUS_M` (800m) — used for light pollution estimation

### 2.6 USDA / NRCS

**Soil Data Access (SDA)** — `getSoilData` (`src/premium.js:1337`)
- **URL:** `https://sdmdataaccess.sc.egov.usda.gov/Tabular/SDMTabularService/post.rest`
- **Method:** POST with SQL query using `SDA_Get_Mukey_from_intersection_with_WktWgs84`
- **Auth:** none
- **Returns:** `{ muname, drainagecl, hydricrating, isHydric, drainageCategory }`

**USDA Plant Hardiness Zone API** — `getHardinessZone` (`src/premium.js:1033`)
- **URL:** `https://phzmapi.org/{zip}.json`
- **Auth:** none
- **Input:** ZIP code (from `locationInfo.zip`)
- **Returns:** `{ zone, tempRange, frost }` (frost from FROST_DATE_TABLE lookup)

### 2.7 iNaturalist

**Species Counts** — `iNatSpeciesCounts` (`src/premium.js:1054`)
- **URL:** `https://api.inaturalist.org/v1/observations/species_counts`
- **Auth:** none
- **Called 4 times** by `getGardenData` with different taxon IDs and radii:
  - Native plants (taxon 47126, native flag, radius 16km, per_page 30)
  - Invasive plants (taxon 47126, introduced flag, radius 32km, per_page 25)
  - Wildlife (taxon 40151, no flag, radius 16km, per_page 15)
  - Birds (taxon 3, no flag, radius 16km, per_page 20)

### 2.8 FCC Broadband Map

**FCC Broadband Availability** — `getBroadbandData` (`src/premium.js:1392`)
- **URL:** `https://broadbandmap.fcc.gov/api/public/map/listAvailability`
- **Auth:** none
- **Returns:** `{ providers: [...], maxDownloadMbps, hasFiber, category }`

### 2.9 Google News RSS (via development-discovery.js)

**Google News RSS** — `fetchRSS` (`src/development-discovery.js:221`)
- **URL:** `https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en`
- **Auth:** none (user-agent header set)
- **Called 3 times** per city with 1.2s delay between requests
- **Cached:** 7-day file cache in `.cache/development-intel/`
- **Called by:** `getGrowthAndDevelopment` in premium.js (passing city, state from locationInfo)

---

## Section 3: Dependency Chain

### 3.1 App.js Standard Report — Sequential + Parallel

```
/report GET handler
│
├─① geocodeAddress(address)           [Google Geocoding — SEQUENTIAL, prerequisite]
│    └─ returns { lat, lng }
│
├─② reverseGeocode(originLatLng)      [Google Reverse Geocoding — SEQUENTIAL]
│    └─ returns locationInfo { city, state, county, zip }
│
├─③ Promise.allSettled([              [PARALLEL — all 10 fire at once]
│     findNearestGrocery(originLatLng)
│     │  ├─ textSearch('grocery store')
│     │  └─ getDriveTime() × up to 8 candidates
│     findNearestPharmacy(originLatLng)
│     │  ├─ placesNearby(pharmacy)
│     │  └─ getDriveTime() × 1
│     findNearestHospital(originLatLng)
│     │  ├─ textSearch('hospital emergency department')
│     │  └─ getDriveTime() × up to 5 candidates
│     findNearestUrgentCare(originLatLng)
│     │  ├─ placesNearby(urgent care)
│     │  └─ getDriveTime() × 1
│     findNearestHighwayOnRamp(originLatLng)
│     │  ├─ reverseGeocode(originLatLng)     [second reverse geocode]
│     │  ├─ geocode() × up to 59             [one per interstate]
│     │  ├─ getDriveTime() × up to 59
│     │  └─ geocode() × N interchange checks
│     findNearestSchool(originLatLng)
│     │  ├─ placesNearby(school)
│     │  └─ getDriveTime() × 1
│     findNearestGasStation(originLatLng)
│     │  ├─ placesNearby(gas_station)
│     │  └─ getDriveTime() × 1
│     findNearestPark(originLatLng)
│     │  ├─ placesNearby(park)
│     │  └─ getDriveTime() × 1
│     findNearestCoffeeShop(originLatLng)
│     │  ├─ placesNearby(cafe)
│     │  └─ getDriveTime() × up to 5 candidates
│     findNearestElementarySchool(originLatLng)
│        ├─ textSearch('public elementary school')
│        └─ getDriveTime() × 1
│   ])
│
├─④ Custom destinations loop           [SEQUENTIAL per dest, each does geocode+driveTime]
│
├─⑤ getTrafficVariations() × N targets [PARALLEL per target, 4 Distance Matrix slots each]
│
└─⑥ getPremiumData({...})             [see 3.2 below]
```

### 3.2 getPremiumData Internal Chain

```
getPremiumData(lat, lng, originLatLng, locationInfo, googleMapsClient, googleMapsApiKey, getDriveTime, highwayDriveMinutes)
│
├─① getCensusFIPS(lat, lng)            [Census FIPS Geocoder — SEQUENTIAL, prerequisite]
│    └─ returns fips { state, county, tract }
│
└─② Promise.allSettled([              [PARALLEL — all 10 fire at once]
      getDemographics(lat, lng, fips)
      │  └─ fetchCensusACS × 2 batches (parallel)
      getPropertyData(fips, locationInfo)
      │  └─ fetchCensusACS × 1
      getWalkabilityScore(lat, lng, googleMapsClient, googleMapsApiKey)
      │  └─ placesNearby × 5 types (parallel)
      getEmergencyServices(lat, lng, originLatLng, googleMapsClient, googleMapsApiKey, getDriveTime)
      │  ├─ placesNearby(police) + placesNearby(fire_station) [parallel]
      │  └─ getDriveTime × 2
      getEnvironmentalData(lat, lng, highwayDriveMinutes, fips, googleMapsClient, googleMapsApiKey)
      │  └─ Promise.allSettled([
      │       getAirQuality()        → AirNow API (needs AIRNOW_API_KEY)
      │       getFloodRisk()         → FEMA NFHL ArcGIS
      │       getAirportData()       → Google Places (placesNearby, airport type)
      │       getRoadNoise()         → BTS Noise Map → fallback OSM Overpass
      │       getRailProximity()     → OSM Overpass
      │       getLightPollution()    → Census ACS (pop) + OSM Overpass (landuse)
      │       getWaterQuality()      → EPA ECHO × 2 requests
      │       getRadonZone()         → local lookup only (no API call)
      │       getEJScreen()          → EPA EJSCREEN REST
      │     ])
      getSafetyLocationContext()     → no API call, returns locationInfo fields
      getSchoolRatings(lat, lng, originLatLng, googleMapsClient, googleMapsApiKey, getDriveTime)
      │  ├─ textSearch × 3 (elem/middle/high, parallel)
      │  ├─ textSearch × 1 (private)
      │  └─ getDriveTime × up to 4
      getGrowthAndDevelopment(lat, lng, fips, locationInfo, googleMapsClient, googleMapsApiKey)
      │  ├─ getBuildingPermitTrend(fips)     → Census BPS API × 3 years (sequential)
      │  ├─ getNewConstructionContext(fips)   → fetchCensusACS × 1
      │  ├─ getRecentDevelopmentActivity()   → Google placesNearby × 6 types (parallel)
      │  └─ discoverDevelopments(city, state) → Google News RSS × 3 queries (sequential w/ delay)
      getPropertyIntelligence(lat, lng, fips, locationInfo)
      │  ├─ getSoilData()            → USDA SDA (POST)
      │  ├─ getBroadbandData()       → FCC Broadband Map
      │  └─ fetchCensusACS()        → Census ACS × 1
      getGardenData(lat, lng, locationInfo)
         ├─ getHardinessZone(zip)   → phzmapi.org
         ├─ iNatSpeciesCounts × 4   → iNaturalist API (parallel)
         └─ (soil: NOT fetched here — getSoilData is in getPropertyIntelligence)
    ])
```

### 3.3 Data Flows Between Layers

Key hand-offs that must be preserved:

1. **`geocodeAddress` → `originLatLng`** — string `"lat,lng"` used as cache key and as Google API param
2. **`reverseGeocode` → `locationInfo`** — `{ city, state, county, zip }` passed to nearly every premium function
3. **`getCensusFIPS` → `fips`** — `{ state, county, tract }` FIPS codes used by all Census ACS calls
4. **`fips.state`** — two-digit state FIPS string (e.g., `"21"` for KY) used for radon zone lookup
5. **`highwayDriveMinutes`** — passed from app.js to `getPremiumData`, passed into `getEnvironmentalData` (currently unused inside: parameter named `_highwayDriveMinutes`)
6. **`getDriveTime` as injected function** — passed from app.js → `getPremiumData` → `getEmergencyServices`, `getSchoolRatings`

---

## Section 4: The `googleMapsClient` Injection Problem

### Current state

In **app.js**, `googleMapsClient` and `googleMapsApiKey` are module-level constants (lines 37, 40–48):
```js
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
const googleMapsClient = new Proxy(_rawMapsClient, { ... }); // rate limiter proxy
```

Every function in app.js that uses them accesses them as **closures** — no injection, no parameter passing.

In **premium.js**, all Google-using functions take `googleMapsClient` and `googleMapsApiKey` as **explicit function parameters**. This is already the clean pattern. The `/report` handler passes them down: `getPremiumData({ ..., googleMapsClient, googleMapsApiKey, getDriveTime })`.

### The problem for data layer extraction

When `findNearestGrocery`, `getDriveTime`, etc. move out of app.js into module data files, they lose access to the closure variables. They need the client injected.

### Two clean solutions

**Option A — Module singleton (simplest)**
Create `src/shared/google/client.js`:
```js
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
Each data module does `const { googleMapsClient, googleMapsApiKey } = require('../../shared/google/client')`. Simple, no injection required. Matches how premium.js already handles it — they just get injected differently.

**Downside:** The module is initialized once at require time. Key must be in env before first require. Harder to test (need to mock the module).

**Option B — Explicit injection (testable)**
Each data function takes `(client, apiKey)` as parameters, like premium.js already does. The `/report` route and `generateComparisonData` pass them in. Tests can inject mock clients.

**Downside:** More parameter passing at call sites. But this is what premium.js already does — it's a proven pattern.

**Recommendation:** Option A for the shared Google transport layer (`client.js`), Option B's parameter pattern for individual data functions that need testability (following premium.js's existing convention). The route handler currently passes `googleMapsClient` and `googleMapsApiKey` to `getPremiumData` — keep that pattern and extend it to standard chapter data calls too.

### `getDriveTime` special case

`getDriveTime` is in app.js and used by premium.js data functions via injection. After extraction, `getDriveTime` should live in `src/shared/google/distanceMatrix.js` (or `src/modules/shared/driveTime.js`). Premium functions that receive it as a parameter continue to work unchanged — they don't care where it lives.

---

## Section 5: Test Coverage — CONSTRAINT-011 Analysis

**No test directory exists.** `ls tests/` returns "No such file or directory."

CONSTRAINT-011: *Every new module must have a corresponding test file in tests/. Every business rule in logic.js must have at least one test. The Jeffersonville IN address must be a test case for any module that searches by location.*

### Current coverage: zero

Every data function currently has zero automated test coverage. Bugs are found manually by running reports. This is how PM-001 (cross-state school), PM-002 (highway boat ramp), and PM-003 (wrong hospital) all made it to a real report.

### What must exist before a data function is considered "done"

CONSTRAINT-011 makes this unambiguous: a data function that has been moved to a module without a test file is **not done**. The commit that moves `findNearestHospital` to `src/modules/health/data.js` must include `tests/modules/health/data.test.js` with at minimum:

1. A smoke test that the function exists and exports correctly
2. A test with mocked Google client that verifies the drive-time-sort behavior (CONSTRAINT-003)
3. The Jeffersonville IN address as a named test case

### Minimum test requirement per function, by constraint

| Function | Constraint | Required test |
|----------|-----------|--------------|
| `findNearestHospital` | CONSTRAINT-003 | Returns nearest by drive time, not by Google rank |
| `findNearestUrgentCare` | CONSTRAINT-004 | Retail health clinics filtered out |
| `findNearestHighwayOnRamp` | CONSTRAINT-005 | No text search; geocoding strategy only |
| `findNearestSchool` | CONSTRAINT-006 | Cross-state school rejected (Jeffersonville case) |
| `getDriveTime` | CONSTRAINT-010 | Drive time >45 min triggers coherence check (or flag) |
| All location searches | CONSTRAINT-007 | Rural address (Harlan KY) handled without failure |
| Any module data file | CONSTRAINT-011 | tests/ file must exist |

### Recommended test framework

The project has no test framework installed. **Jest** is the recommendation:
- Zero config for Node.js
- Easy module mocking (critical for Google client)
- Built-in async/await support
- No existing test infrastructure to conflict with

Required npm packages: `jest`, `@jest/globals` (or just Jest's implicit globals).

### Test strategy for API-calling functions

Data functions that call external APIs cannot be unit-tested without mocks. Two valid approaches:

1. **Mock the Google client** — inject a mock `googleMapsClient` that returns fixture data. Tests the function logic, not the API.
2. **Integration test against real APIs** — runs only in CI with real API keys, tagged `@integration`. Tests the actual response shape.

For Phase 2 (data layer extraction), mock-based unit tests are the minimum. Integration tests can come later.

---

## Section 6: Structural Observations and Risks

### Risk 1: `fipsCache` is module-level state in premium.js

`getCensusFIPS` uses an in-memory `Map` (`fipsCache`) at module scope. After extraction, if `getCensusFIPS` moves to a data module, the cache persists for the process lifetime — which is the current behavior. This is fine. But the cache should move with the function, not stay in the old location.

### Risk 2: `getBuildingPermitTrend` is sequential over 3 years

Unlike most data functions which fan out in parallel, `getBuildingPermitTrend` loops over `[currentYear, currentYear-1, currentYear-2]` with separate sequential `fetch()` calls per year. This is a deliberate API usage pattern (Census timeseries endpoint), not a bug. It adds ~3 × 500ms = ~1.5s to the parallel fan-out that `getGrowthAndDevelopment` runs in.

### Risk 3: `googleMapsApiKey` accessed inside premium.js via `process.env` twice

`fetchCensusACS` reads `CENSUS_API_KEY` from `process.env` at call time (not at module load). Same for `getAirQuality` with `AIRNOW_API_KEY`. These are safe — env access at call time is fine. But it's inconsistent with `googleMapsApiKey` which is read once at module load in app.js. After extraction, all API keys should follow the same pattern: read at module init in a config module, not scattered across data functions.

### Risk 4: `discoverDevelopments` has a 3-request sequential delay built in

`scrapeGoogleNews` in development-discovery.js fires 3 RSS queries with `DEV_REQUEST_DELAY_MS` (1200ms) between each. Total worst-case: ~3.6s. This is one item in the `getGrowthAndDevelopment` parallel fan-out. It's the slowest item and caps the fan-out's wall clock time. The file cache (7-day TTL) usually absorbs this for repeated addresses.

### Risk 5: `getEnvironmentalData` takes `_highwayDriveMinutes` but doesn't use it

The parameter is prefixed with `_` indicating intentional non-use. Originally planned for something (noise-distance correlation?). Can be removed during extraction, or preserved as a no-op parameter for future use. Not a blocker.

### Risk 6: `findNearestHighwayOnRamp` makes up to 59 + N API calls

This is by far the most API-intensive function. The geocoding strategy (CONSTRAINT-005) requires geocoding each interstate individually. With caching warm this is instant. Cold, it can hit the rate limiter hard. The `makeGoogleMapsRequest` rate limiter in `rateLimit.js` handles this, but it's worth flagging for the spec.

### Risk 7: Premium school radii are hardcoded magic numbers

`getSchoolRatings` uses `radius: 20000` (public) and `radius: 16000` (private) — both literals, not yet moved to constants. These should become named constants in the spec (e.g., `PUBLIC_SCHOOL_SEARCH_RADIUS_M`, `PRIVATE_SCHOOL_SEARCH_RADIUS_M`).

### Risk 8: Two competing architecture documents

LIVABLY-ARCHITECTURE.md (`src/data/`) vs. module-restructure.md (`src/modules/`). CLAUDE.md names module-restructure.md as authoritative. **Spec must pick one and commit to it.** Both are workable; the module pattern aligns better with the stated goal of "each chapter owns its domain."

---

## Section 7: Module Groupings (Using module-restructure.md Pattern)

Based on the dependency and domain analysis, the natural extraction groupings are:

### Shared / prerequisite (extract first)

| Target | Functions | APIs |
|--------|-----------|------|
| `src/shared/google/client.js` | (config only — client + proxy setup) | Google Maps SDK |
| `src/shared/google/geocoding.js` | `geocodeAddress` | Google Geocoding |
| `src/shared/google/reverseGeocode.js` | reverse geocode (currently inline) | Google Reverse Geocoding |
| `src/shared/google/distanceMatrix.js` | `getDriveTime`, `getTrafficVariations` | Google Distance Matrix |
| `src/shared/census.js` | `getCensusFIPS`, `fetchCensusACS` | Census FIPS Geocoder, Census ACS |

### Module data files (extract after shared layer is stable)

| Target | Functions | APIs |
|--------|-----------|------|
| `src/modules/reachability/data.js` | `findNearestGrocery`, `findNearestPharmacy`, `findNearestGasStation` | Google Places |
| `src/modules/access/data.js` | `findNearestHighwayOnRamp` | Google Geocoding (59×) |
| `src/modules/health/data.js` | `findNearestHospital`, `findNearestUrgentCare` | Google Places |
| `src/modules/schools/data.js` | `findNearestSchool`, `findNearestElementarySchool`, `getSchoolRatings` | Google Places |
| `src/modules/recreation/data.js` | `findNearestPark`, `findNearestCoffeeShop` | Google Places |
| `src/modules/emergency/data.js` | `getEmergencyServices` | Google Places |
| `src/modules/walkability/data.js` | `getWalkabilityScore` | Google Places |
| `src/modules/sensory/data.js` | `getAirQuality`, `getFloodRisk`, `getAirportData`, `getRoadNoise`, `getRailProximity`, `getLightPollution`, `getWaterQuality`, `getEJScreen` | AirNow, FEMA, Google Places, BTS, OSM, EPA ECHO, EPA EJSCREEN |
| `src/modules/garden/data.js` | `getHardinessZone`, `iNatSpeciesCounts`, `getSoilData` | phzmapi.org, iNaturalist, USDA SDA |
| `src/modules/community/data.js` | `getDemographics` | Census ACS |
| `src/modules/costs/data.js` | `getPropertyData` | Census ACS |
| `src/modules/growth/data.js` | `getGrowthAndDevelopment`, `getRecentDevelopmentActivity`, `getBuildingPermitTrend`, `getNewConstructionContext` | Google Places, Census BPS, Google News RSS |
| `src/modules/intelligence/data.js` | `getPropertyIntelligence`, `getBroadbandData` | FCC, USDA SDA, Census ACS |

---

## Section 8: Open Questions for Spec

1. **Which target structure?** `src/data/` flat (LIVABLY-ARCHITECTURE.md) or `src/modules/*/data.js` (module-restructure.md)? CLAUDE.md says module-restructure.md. Confirm before writing spec.

2. **What is the boundary for this FR?** Options:
   - (a) Shared layer only (geocoding, reverseGeocode, distanceMatrix, census FIPS) — safest, smallest
   - (b) Shared layer + app.js `find*` functions only — medium scope
   - (c) Everything including premium.js data functions — large, high risk
   FR-036 summary recommends starting with shared layer + app.js `find*` functions. Premium.js data functions are already partially separated (they accept injected clients) and may warrant their own FR.

3. **Test framework.** Decision needed before Phase 3 (Planning): Jest (recommended) or another? The test file structure should be agreed before any data file is written.

4. **Where does `generateComparisonData` go?** It's an orchestrator that calls multiple `find*` functions. It belongs in `src/services/reportBuilder.js` or equivalent. Not a data layer function.

5. **`fipsCache` lifetime.** Should the Census FIPS cache survive server restarts? Currently in-memory (no). If moved to a module, behavior unchanged. If a caching layer is added later, FIPS lookups are excellent candidates.

6. **What to do with `getSafetyLocationContext`?** It makes no API calls — it just returns fields from `locationInfo`. It's a pure function that belongs in a logic layer, not a data layer. It should not be part of FR-037.

---

## Summary: What FR-037 Is and Isn't

**Is:** Moving raw API-calling functions out of app.js and premium.js into organized module data files, with proper exports, consistent injection patterns, and test coverage per CONSTRAINT-011.

**Is not:**
- Business logic (that's FR-035 / logic layer)
- HTML generation (that's FR-038/039 / template layer)
- Behavior changes to any existing function
- New API integrations (those are their own FRs)

**Prerequisite:** Resolve the architecture document conflict and decide on the module grouping target structure before writing spec.

**Blocking risk:** CONSTRAINT-011. No data file can be considered done without a test file. The test framework installation and first test file should be the first commit of implementation, not the last.
