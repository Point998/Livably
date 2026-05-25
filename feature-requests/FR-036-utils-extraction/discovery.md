# FR-036 — Phase 1 Discovery: Utilities Extraction
*Read-only audit. No code changes in this phase.*
*May 2026*

---

## Files Audited

| File | Lines | Role |
|------|-------|------|
| `src/app.js` | 2,318 | Standard chapters — does everything |
| `src/premium.js` | ~2,100+ | Premium chapters — does everything |
| `src/development-discovery.js` | ~200 | RSS news scraper for development intel |
| `src/development-intel.js` | 37 | Manual development database (Georgetown hardcoded) |
| `src/logger.js` | — | Already separated — do not touch |
| `src/errorMemory.js` | — | Already separated — do not touch |
| `src/cache.js` | — | Already separated — do not touch |
| `src/rateLimit.js` | — | Already separated — do not touch |

---

## Section 1 — Utility Functions → `src/utils/`

### 1A. Time Utilities → `src/utils/time.js`

| Function | Location | Notes |
|----------|----------|-------|
| `getNextTuesday8am()` | `app.js:73` | Returns Unix timestamp for next Tue 8am departure. Used by `getDriveTime`. |
| `getNextDayAt(targetDay, hour)` | `app.js:97` | Generic version — used by `getTrafficVariations` for Mon/Sat slots. |

Both functions belong together. `getNextTuesday8am` is a specialization of `getNextDayAt`.

---

### 1B. Text Utilities → `src/utils/text.js`

| Function | Location | Notes |
|----------|----------|-------|
| `escapeHtml(str)` | `app.js:764` | HTML entity escaping. |
| `esc(str)` | `premium.js:24` | **Duplicate** of `escapeHtml` — identical logic, different name. Must consolidate into one. |
| `formatDriveTime(minutes)` | `app.js:772` | Returns `"X min"`. Simple but used in many template functions. |
| `toTitleCase(str)` | `app.js:778` | Title-cases address input. State abbreviations kept uppercase. |
| `parseAddressParts(address)` | `app.js:785` | Splits address at first comma → `{ street, cityState }`. |
| `formatResearchDate()` | `app.js:794` | Returns `"Month DD, YYYY"` for report headers. |
| `formatMoney(n)` | `premium.js:30` | Returns `"$X,XXX"` — used in property cost calculations. |
| `slugify(text)` | `app.js:2243` | Converts text to kebab-case — used for PDF filename. |
| `getDateSlug()` | `app.js:2247` | Returns `"YYYY-MM-DD"` — used for PDF filename. |

**Critical note:** `escapeHtml` and `esc` are the same function. Two implementations exist today. The extraction must produce one canonical `escapeHtml` and update all callers.

---

### 1C. Geo Utilities → `src/utils/geo.js`

| Function | Location | Notes |
|----------|----------|-------|
| `haversineDistance(lat1, lng1, lat2, lng2)` | `premium.js:9` | Returns straight-line distance in miles. Used ~10x throughout premium.js for distanceMiles fields. |

`app.js` does not have a haversine function — it exclusively uses Google Distance Matrix for drive times. `premium.js` uses haversine for display-only distance labels (not drive times). Both approaches must be preserved.

---

### 1D. State Utilities → `src/utils/state.js`

| Constant/Function | Location | Notes |
|-------------------|----------|-------|
| `STATE_ABBRS` (Set) | `app.js:776` | 51 state abbreviations (50 states + DC). Used only by `toTitleCase` currently. |

No full state name ↔ abbreviation lookup exists. The architecture plan calls for one — it is **not in any current file** and must be created fresh in Phase 2+.

---

## Section 2 — Hardcoded Constants → `src/utils/constants.js`

These are scattered inline throughout `app.js`, `premium.js`, and `development-discovery.js`. Every one of them is a config value masquerading as a magic number or literal. They belong in one file.

### 2A. From `app.js`

| Constant | Location | Current form |
|----------|----------|-------------|
| Interstate list (59 entries) | `app.js:432–439` | `const interstates = ['I-5', 'I-8', …]` — hardcoded inside `findNearestHighwayOnRamp` |
| Highway 20-minute threshold | `app.js:499` | `r.driveTimeMinutes <= 20` — magic number inside function |
| Highway interchange fallback threshold | `app.js:504` | `r.driveTimeMinutes > 20 && r.driveTimeMinutes <= 50` — magic numbers |
| Grocery filter types | `app.js:226–229` | `['gas_station', 'convenience_store', 'lodging']` inline in `findNearestGrocery` |
| Grocery search radius | `app.js:221` | `8000` (meters) — passed via `getMitigation` with fallback |
| Hospital search radius | `app.js:303,389` | `50000` (meters) — appears twice |
| Grocery candidate count | `app.js:237` | `8` — top candidates for drive time comparison |
| Hospital candidate count | `app.js:325` | `5` — top candidates for drive time comparison |
| Elementary school exclusion terms | `app.js:741` | `['preschool', 'pre-school', 'daycare', 'day care', 'montessori', 'private']` inline |
| Elementary school search radius | `app.js:747` | `15000` (meters) inline |
| Coffee shop candidate count | `app.js:710` | `5` inline |
| Park excluded types | `app.js:660` | `['local_government_office', 'lawyer', 'insurance_agency', 'political']` module-level const — move to constants.js |
| Park leisure types | `app.js:661` | `['park', 'natural_feature', 'campground', …]` module-level const |
| `SCHOOL_PLACE_TYPES` | `app.js:580` | Module-level const Set |
| `SCHOOL_NAME_TERMS` | `app.js:581` | Module-level regex |
| Custom destination icons | `app.js:1258` | `{ work: '💼', family: '🏠', … }` module-level const |
| Error icons | `app.js:1576` | `{ ADDRESS_NOT_FOUND: '📍', … }` module-level const |
| `MAX_CONCURRENT_PDFS` | `app.js:2253` | `3` module-level const |
| Traffic variation time slots | `app.js:113–116` | `[Mon 8am, Mon 12pm, Mon 5pm, Sat 10am]` inline in `getTrafficVariations` |

### 2B. From `premium.js`

| Constant | Location | Current form |
|----------|----------|-------------|
| `STATE_TAX_RATES` | `premium.js:217` | 52-entry object — annual property tax rates by state (%) |
| `STATE_INSURANCE_ANNUAL` | `premium.js:227` | 52-entry object — avg homeowner insurance by state ($) |
| `STATE_UTILITIES_MONTHLY` | `premium.js:237` | 52-entry object — avg utility cost by state ($/mo) |
| `STATE_HOMESTEAD` | `premium.js:247` | 12-entry object — homestead exemption notes by state |
| `TORNADO_TIER` IIFE | `premium.js:491` | State arrays classified high/moderate/low — NOAA historical data |
| `RADON_ZONE_BY_STATE` | `premium.js:876` | State FIPS → EPA radon zone (1/2/3) |
| `FROST_DATE_TABLE` | `premium.js:1130` | 26-entry object — frost dates per USDA hardiness zone |
| `NATIVE_PLANT_EXCLUDE` (Set) | `premium.js:1167` | 10 plant genera/species to exclude from native results |
| `NATIVE_PLANT_EXCLUDE_NAMES` | `premium.js:1172` | 9 common plant names to exclude |
| `BENIGN_INTRODUCED` (Set) | `premium.js:1178` | 22 introduced species that are benign (exclude from invasive list) |
| `DOMESTIC_MAMMALS` (Set) | `premium.js:1192` | 3 domestic/aquatic species — exclude from yard wildlife list |
| `STATE_EXTENSION` | `premium.js:1197` | 51-entry object — cooperative extension office by state |
| `OVERPASS_ENDPOINTS` | `premium.js:677` | 4 Overpass API endpoint URLs |
| `NON_AIRPORT_RE` | `premium.js:633` | Regex — excludes paragliding/skydiving/etc from airport results |
| `AIRPORT_RE` | `premium.js:635` | Regex — confirms real airport names |
| `COMMERCIAL_DEV_TYPES` | `premium.js:1074` | 6 Google Places types with labels/icons for development context |
| `WALK_TYPES` | `premium.js:291` | 5 walkability categories with weights and labels |
| Response speed estimates | `premium.js:384` | `{ police: 30, fire: 35 }` mph — inline in `estimateResponseTime` |
| Response dispatch estimates | `premium.js:385` | `{ police: 2, fire: 1.5 }` min — inline |
| Response time thresholds | `premium.js:388–391` | `police: {excellent:5,good:10,fair:15}`, `fire: {excellent:5,good:8,fair:12}` |
| AQI thresholds | `premium.js:451–457` | 5 AQI breakpoints (50, 100, 150, 200) in `getAQICategory` |
| DNL thresholds | `premium.js:733–739` | 5 noise breakpoints (45, 55, 65, 70) in `getDNLCategory` |
| Bortle thresholds | `premium.js:791–813` | 8 scale tiers in `estimateBortle` + `getBortleDescription` |
| Flood zone map | `premium.js:475–487` | 9 FEMA zone → risk/insurance interpretation entries |
| Broadband tech codes | `premium.js:1627` | 12 FCC technology code → label mappings |
| Airport search radius | `premium.js:639` | `32000` meters + `20` mile max filter |
| Walkability search radius | `premium.js:300` | `800` meters |
| iNat search radii | `premium.js:1352–1356` | `16`km native plants, `32`km invasive plants, `16`km wildlife, `16`km birds |
| iNat result limits | `premium.js:1352–1356` | `30`, `25`, `15`, `20` per-page counts |
| Light pollution population thresholds | `premium.js:795–800` | `6000`, `3000`, `1200`, `400` population breakpoints |
| OSM road noise search radius | `premium.js:705` | `4000` meters in Overpass query |
| OSM rail search radius | `premium.js:746` | `4800` meters in Overpass query |
| OSM light/landuse search radius | `premium.js:780` | `800` meters |
| Highway noise estimate breakpoints | `premium.js:418–419` | `5`, `15` min → `65`, `55`, `45` dB fallback |
| Water quality cutoff years | `premium.js:846` | `5` years lookback for violations |
| Water quality search radius | `premium.js:823` | `10` miles |

### 2C. From `development-discovery.js`

| Constant | Location | Current form |
|----------|----------|-------------|
| `CACHE_TTL_MS` | `development-discovery.js:15` | `7 * 24 * 60 * 60 * 1000` (7 days) |
| `REQUEST_DELAY_MS` | `development-discovery.js:16` | `1200` ms between RSS fetches |
| `MAX_ARTICLE_AGE` | `development-discovery.js:17` | `2 * 365 * 24 * 60 * 60 * 1000` (2 years) |
| `TYPE_MAP` | `development-discovery.js:24` | 8-entry development type → keyword classification |
| `STATUS_MAP` | `development-discovery.js:75` | 4-entry development status → keyword classification |

**Note on `development-intel.js`:** The `DATABASE` object (Georgetown/KY hardcoded projects) is intentionally manual and manually curated — it is **not** a constant to extract. It should stay where it is or move to a `config/` folder as a data file.

---

## Section 3 — Google API Calls → `src/data/google/`

### 3A. `src/data/google/geocoding.js`

| Function | Location | What it calls |
|----------|----------|---------------|
| `geocodeAddress(address)` | `app.js:158` | `googleMapsClient.geocode` — address → `{lat, lng}` |
| Reverse geocode (inline, no function) | `app.js:1780–1789` | `googleMapsClient.reverseGeocode` — coordinates → locationInfo object. **Must be extracted into a named function.** |
| Reverse geocode inside highway search | `app.js:420–430` | Same API — extracts city/state for highway query context. Duplicate pattern — consolidate. |
| `findNearestHighwayOnRamp` (geocode phase) | `app.js:443–473` | 59 calls to `googleMapsClient.geocode` — one per interstate |
| Interchange geocode | `app.js:508–526` | `googleMapsClient.geocode` — I-X/I-Y junction lookup |

### 3B. `src/data/google/distanceMatrix.js`

| Function | Location | What it calls |
|----------|----------|---------------|
| `getDriveTime(originLatLng, destinationLatLng)` | `app.js:182` | `googleMapsClient.distancematrix` — single departure time (Tue 8am) |
| `getTrafficVariations(originLatLng, destLocation)` | `app.js:111` | `googleMapsClient.distancematrix` — 4 departure times (Mon rush/mid/eve, Sat) |

### 3C. `src/data/google/places.js`

| Function | Location | API method used |
|----------|----------|-----------------|
| `findNearestGrocery(originLatLng)` | `app.js:211` | `textSearch` (8km radius) + `distancematrix` for top 8 |
| `findNearestPharmacy(originLatLng)` | `app.js:262` | `placesNearby` (rankby distance, type=pharmacy) |
| `findNearestHospital(originLatLng)` | `app.js:293` | `textSearch` (50km) → `placesNearby` fallback, drive-time verify top 5 |
| `findNearestUrgentCare(originLatLng)` | `app.js:365` | `placesNearby` (keyword) → `textSearch` fallback, retail filter |
| `findNearestSchool(originLatLng)` | `app.js:589` | `placesNearby` (type=school) → `textSearch` fallback |
| `findNearestGasStation(originLatLng)` | `app.js:635` | `placesNearby` (rankby distance, type=gas_station) |
| `findNearestPark(originLatLng)` | `app.js:670` | `placesNearby` (rankby distance, type=park) |
| `findNearestCoffeeShop(originLatLng)` | `app.js:695` | `placesNearby` (type=cafe) + drive-time top 5 |
| `findNearestElementarySchool(originLatLng)` | `app.js:736` | `textSearch` ("public elementary school", 15km) |
| `getEmergencyServices` (police/fire) | `premium.js:349` | `placesNearby` (type=police, type=fire_station) |
| `getWalkabilityScore` | `premium.js:289` | 5x `placesNearby` (800m radius, one per amenity type) |
| `getAirportData` | `premium.js:637` | `placesNearby` (type=airport, 32km radius) |
| `getRecentDevelopmentActivity` | `premium.js:1083` | 6x `placesNearby` (2.4km radius, one per commercial type) |
| `getSchoolRatings` | `premium.js:938` | 3x `textSearch` (public schools) + 1x `textSearch` (private) |

**Important:** All these functions currently mix the API call with business logic (filtering, drive time calculation, result selection). In the target architecture, the data layer returns raw results and the logic layer handles filtering and selection. This boundary must be drawn carefully — Phase 1 extracts utilities only; the full data/logic split is Phase 2–3.

---

## Section 4 — Non-Google API Calls

### 4A. Census Bureau → `src/data/government/census.js`

| Function | Location | Endpoint |
|----------|----------|---------|
| `getCensusFIPS(lat, lng)` | `premium.js:38` | `geocoding.geo.census.gov/geocoder/geographies/coordinates` |
| `fetchCensusACS(fips, vars)` | `premium.js:59` | `api.census.gov/data/2022/acs/acs5` |
| `getBuildingPermitTrend(fips)` | `premium.js:998` | `api.census.gov/data/timeseries/eits/bps` |

`fetchCensusACS` is called by `getDemographics`, `getPropertyData`, `getNewConstructionContext`, `getPropertyIntelligence`, and `getLightPollution` — it is the core Census primitive. All five callers must be updated when this moves.

Requires env var: `CENSUS_API_KEY`

### 4B. FEMA → `src/data/government/fema.js`

| Function | Location | Endpoint |
|----------|----------|---------|
| `getFloodRisk(lat, lng)` | `premium.js:461` | `hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query` |

No API key required — public ArcGIS endpoint.

### 4C. EPA → `src/data/government/epa.js`

| Function | Location | Endpoint |
|----------|----------|---------|
| `getAirQuality(lat, lng)` | `premium.js:436` | `www.airnowapi.org/aq/observation/latLong/current/` |
| `getWaterQuality(lat, lng)` | `premium.js:817` | `echodata.epa.gov/echo/sdw_rest_services.get_facilities` + `.get_violations` |
| `getEJScreen(lat, lng)` | `premium.js:891` | `ejscreen.epa.gov/mapper/ejscreenRESTbroker.aspx` |
| `getRadonZone(fips)` | `premium.js:883` | **No HTTP call** — static lookup from `RADON_ZONE_BY_STATE` (EPA radon zone data). Moves to `constants.js` + a pure function in `epa.js`. |

Requires env var: `AIRNOW_API_KEY`

### 4D. FCC → `src/data/government/fcc.js`

| Function | Location | Endpoint |
|----------|----------|---------|
| `getBroadbandData(lat, lng)` | `premium.js:1610` | `broadbandmap.fcc.gov/api/public/map/listAvailability` |

No API key required — public endpoint.

### 4E. USDA → `src/data/usda/`

| Function | File | Endpoint |
|----------|------|---------|
| `getSoilData(lat, lng)` | `premium.js:1555` | `sdmdataaccess.sc.egov.usda.gov/Tabular/SDMTabularService/post.rest` (USDA Soil Data Access — POST) → `src/data/usda/soilSurvey.js` |
| `getHardinessZone(zip)` | `premium.js:1251` | `phzmapi.org/${zip}.json` (third-party USDA Plant Hardiness Zone wrapper) → `src/data/usda/hardiness.js` |

No API keys required.

### 4F. OpenStreetMap (Overpass) → `src/data/government/openstreetmap.js`

| Function | Location | Notes |
|----------|----------|-------|
| `fetchOverpass(query, timeoutMs)` | `premium.js:684` | Multi-endpoint with fallback across 4 instances. Base primitive. |
| `getRoadNoiseOSM(lat, lng)` | `premium.js:702` | Overpass query for highway proximity |
| `getRailProximity(lat, lng)` | `premium.js:743` | Overpass query for rail lines |
| `fetchLanduseOSM(lat, lng)` | `premium.js:779` | Overpass query for landuse classification |

No API key required. OSM data is public domain.

**Placement note:** Overpass API serves OpenStreetMap data, which is open/public like government data but operated by a non-government entity. `src/data/government/openstreetmap.js` is the best fit given its role as a public infrastructure data source.

### 4G. Wildlife APIs → `src/data/wildlife/`

| Function | Location | Endpoint |
|----------|----------|---------|
| `iNatSpeciesCounts(lat, lng, radiusKm, taxonId, flags, perPage)` | `premium.js:1272` | `api.inaturalist.org/v1/observations/species_counts` → `src/data/wildlife/inaturalist.js` |

No API key required for iNaturalist public observations.

**Note on eBird:** The architecture doc lists `src/data/wildlife/ebird.js` but no eBird API call exists in the current codebase. iNaturalist's taxon ID 3 (birds) is being used as a proxy. eBird integration is deferred.

---

## Section 5 — What Phase 1 Does NOT Touch

Phase 1 (this FR) is utilities extraction only. The following are explicitly **out of scope** and belong to later phases:

| What | Phase | Why |
|------|-------|-----|
| Moving API calls out of app.js/premium.js | Phase 3 | Requires the logic layer to exist first (Phase 2) |
| Creating src/logic/ or src/modules/ | Phase 2 | The architecture plan sequences this deliberately |
| Splitting template HTML out of app.js | Phase 5 | Requires component layer first (Phase 4) |
| Adding tests | Phase 6 | Tests require the layers to exist |
| Moving Express routes to src/server/ | Phase 7 | Last step — after everything else is extracted |
| Splitting development-discovery.js | Phase 3 | Currently a single-file scraper — leave as-is until data layer exists |

---

## Section 6 — Risks and Dependencies

### Risk 1: The `escapeHtml` / `esc` Duplicate
Two functions with the same behavior exist in two files. When consolidated, every call to `esc()` in premium.js must be updated to `escapeHtml()`. There are approximately **50+ call sites** in premium.js. Easy to miss one.

**Mitigation:** Run `grep -n '\besc(' src/premium.js` after extraction to verify zero remaining uses of the old function name.

### Risk 2: Cache Dependencies
`getDriveTime` and `findNearestGrocery` etc. currently reference `driveTimeCache`, `placesCache`, `geocodeCache` from `src/cache.js` directly. When these functions move to `src/data/google/`, the cache imports must move with them or be re-wired. Phase 1 does not move these functions — but the new `constants.js` and utility files must not introduce cache imports.

### Risk 3: `getMitigation` in `findNearestGrocery`
The grocery search radius uses `getMitigation('findNearestGrocery', 'searchRadiusM', 8000)` — a dynamic override system from `src/errorMemory.js`. The constant `8000` is the fallback default. When the radius is extracted to `constants.js`, it should be the fallback value, with `getMitigation` still able to override it.

### Risk 4: `FROST_DATE_TABLE` Size
The frost date table (26 entries) is data, not logic. It must go to `constants.js`. It is currently deeply embedded in `buildWhatWillGrowHTML`. Make sure the template function can import it cleanly from the new location.

### Risk 5: `STATE_*` Tables in premium.js
`STATE_TAX_RATES`, `STATE_INSURANCE_ANNUAL`, `STATE_UTILITIES_MONTHLY`, `STATE_HOMESTEAD`, `STATE_EXTENSION` — all five are large lookup tables embedded inline in `premium.js`. They are data, not logic. Moving them to `constants.js` is a large block of text that must be moved cleanly without corruption.

### Risk 6: Circular Import Risk
`constants.js` must not import from any other `src/` file — it is the foundation. All other files import from it; it imports from nothing.

---

## Section 7 — What Phase 1 Delivers

After FR-036 is complete, the following new files exist and are wired into existing code with no behavior change:

```
src/utils/
  time.js        → getNextTuesday8am, getNextDayAt
  text.js        → escapeHtml (canonical), formatDriveTime, toTitleCase,
                   parseAddressParts, formatResearchDate, formatMoney, slugify, getDateSlug
  geo.js         → haversineDistance
  state.js       → STATE_ABBRS
  constants.js   → All hardcoded arrays, objects, thresholds, magic numbers listed in Section 2
```

`app.js` and `premium.js` are updated to import from these modules. All behavior is identical. No API calls change. No HTML changes. No narrative changes. This is a pure structural refactor — the same inputs produce the same outputs.

**Acceptance criteria for Phase 1:**
- All 5 utility files exist with correct exports
- `app.js` imports from `src/utils/` for every function/constant listed above
- `premium.js` imports from `src/utils/` for every function/constant listed above
- `esc()` in premium.js is fully replaced by `escapeHtml()` — no remaining uses of `esc`
- Development server starts without errors
- Georgetown report generates correctly
- `grep -r "const interstates = \[" src/` returns zero results
- `grep -rn "function escapeHtml\|function esc" src/` returns exactly one result (in `utils/text.js`)

---

## Summary

**27 utility functions** across 4 categories ready to extract.
**72+ hardcoded constants** across 3 source files ready to centralize.
**14 Google API call sites** mapped to 3 target files.
**11 non-Google API functions** across 6 APIs mapped to `src/data/government/`, `src/data/usda/`, and `src/data/wildlife/`.

The interstate list alone (59 entries, currently inside a function body) is the clearest single example of why this work matters — it cannot be tested, updated, or referenced from anywhere else in its current location.

Phase 1 is the safest possible first step: extract pure data and pure utility functions. No behavior changes. No API wiring changes. Build the foundation that Phases 2–7 depend on.
