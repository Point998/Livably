# FR-063 — External Source Inventory

*Authoritative catalogue of every live external HTTP data source across all 14 modules.*
*Generated: 2026-06-15. Drives Task 7 (SOURCES descriptor in each data.js).*

---

## Key to columns

| Column | Meaning |
|---|---|
| **id** | Proposed kebab-case id, unique within module |
| **provider** | Upstream quota domain |
| **fetcher fn** | Function in data.js that issues the call |
| **call signature** | How it's called from a ctx of `{ address, lat, lng, state, county, fips:{state,county,tract} }` |
| **failure value** | What the fetcher returns when the call fails |
| **legit-empty?** | "yes" = no-data and error both return the same value (swallow-to-empty) |
| **valid shape** | Predicate for a real successful result |
| **requiresKey** | Env var name for key; blank = keyless or always-required (Google) |
| **coverage** | "all" = expected real data for every US address; "some" = empty is legitimately possible |
| **probe needed?** | "yes" for every swallow-to-empty source (Task 7 must add active probe) |

---

## MODULE: access

*File: `src/modules/access/data.js`*

| id | provider | fetcher fn | call signature | failure value | legit-empty? | valid shape | requiresKey | coverage | probe needed? |
|---|---|---|---|---|---|---|---|---|---|
| google-geocode-highway | google | `findNearestHighwayOnRamp` (geocode calls inside) | `findNearestHighwayOnRamp(ctx.lat + ',' + ctx.lng)` | throws `Error` | no | `typeof r.name === 'string' && typeof r.driveTimeMinutes === 'number'` | — | all | no |
| google-distance-highway | google | `getDriveTime` (inside `findNearestHighwayOnRamp`) | called internally for each geocoded highway | returns `null` per candidate; outer fn throws if all null | no | `typeof r.driveTimeMinutes === 'number'` | — | all | no |

**Notes:**
- `findNearestHighwayOnRamp` throws on total failure rather than returning null — the caller (orchestrator) must catch. Failure value from the perspective of the caller is a rejected promise, not a sentinel return.
- Both Google calls use `GOOGLE_MAPS_API_KEY` (REQUIRED, always present per config.js).

---

## MODULE: climate

*File: `src/modules/climate/data.js`*

| id | provider | fetcher fn | call signature | failure value | legit-empty? | valid shape | requiresKey | coverage | probe needed? |
|---|---|---|---|---|---|---|---|---|---|
| noaa-normals | noaa | `getNOAAClimateNormals` | `getNOAAClimateNormals(ctx.lat, ctx.lng)` | `null` | no | `Array.isArray(r?.monthly) && r.monthly.length === 12 && r.monthly.some(m => m.tMaxF != null)` | `NOAA_CDO_API_KEY` | all | no |
| fema-declarations | fema | `getFEMADeclarations` | `getFEMADeclarations(ctx.state, ctx.county)` | `[]` | yes | `Array.isArray(r) && r.length > 0` (empty = no disasters or error) | — | some | yes |
| usgs-elevation | usgs | `getWatershedContext` (calls `fetchElevationWithRetry`) | `getWatershedContext(ctx.lat, ctx.lng)` | `null` | no | `r !== null && Array.isArray(r.elevations) && r.elevations[0] != null` | — | all | no |
| usgs-watershed | usgs | `getNamedWatershed` (calls `queryWBDName`) | `getNamedWatershed(ctx.lat, ctx.lng)` | `null` | yes (catch returns `null`, no-data returns `null`) | `typeof r?.huc12Name === 'string' && r.huc12Name.length > 0` | — | some | yes |
| usgs-seismic | usgs | `getSeismicHazard` | `getSeismicHazard(ctx.lat, ctx.lng)` | `null` | no (transient errors not cached; distinguishable from `{ pga: null }` negative cache) | `typeof r?.pga === 'number' && r.pga > 0` | — | all | no |

**Notes for climate:**
- `getNOAAClimateNormals`: returns `null` when key is missing; returns `null` when all station candidates fail. Distinguishable failure → no probe needed.
- `getFEMADeclarations`: both error (`catch → return []`) and no-data (`data.DisasterDeclarationsSummaries = []`) return `[]`. Coverage = some (rural counties often have zero declarations). **Probe needed.**
- `getWatershedContext` / `usgs-elevation`: returns `null` only on total failure (center elevation exhausted retries). A partial set fills with center value so shape is detectable.
- `getNamedWatershed` / `usgs-watershed`: catch returns `null` AND no-data also returns `null` (`!huc12Name` branch). Coverage = some (offshore, deep water areas can be null). **Probe needed.**
- `getSeismicHazard` / `usgs-seismic`: transient errors return `null`; known-zero locations are cached as `{ pga: null }`. The caller (`getSeismicContext`) already handles both; a real success has `pga > 0`. Coverage = all (USGS has continental US coverage; AK/HI partial).
- `getNOAAStormEvents` → **EXCLUDED** (see Excluded section).
- **URL constants used by probes:**
  - `fema-declarations`: `FEMA_DECLARATIONS_URL` in `src/utils/constants.js`
  - `usgs-watershed`: `WBD_BASE` is a **module-local const** in `src/modules/climate/data.js` (not exported from constants). Task 7 must either export it to constants or reference the hardcoded string. **Flag: hardcoded URL.**
  - `usgs-elevation`: `USGS_ELEVATION_URL` in `src/utils/constants.js`

---

## MODULE: community

*File: `src/modules/community/data.js`*

| id | provider | fetcher fn | call signature | failure value | legit-empty? | valid shape | requiresKey | coverage | probe needed? |
|---|---|---|---|---|---|---|---|---|---|
| census-acs-demographics | census | `getDemographics` (calls `fetchCensusACS` × 3) | `getDemographics(ctx.lat, ctx.lng, ctx.fips)` | `null` | no | `r !== null && typeof r.totalPop === 'number' && r.totalPop > 0` | `CENSUS_API_KEY` | all | no |

**Notes:**
- `fetchCensusACS` returns `null` when key is missing or on HTTP error. The outer `getDemographics` catches and returns `null`. A successful result has `totalPop > 0`.
- Three batched ACS calls share one logical source row since they all hit the same Census ACS5 endpoint and are treated as a single logical record.
- Coverage = all (every census tract has ACS data, though suppressed values exist for very small populations).

---

## MODULE: garden

*File: `src/modules/garden/data.js`*

| id | provider | fetcher fn | call signature | failure value | legit-empty? | valid shape | requiresKey | coverage | probe needed? |
|---|---|---|---|---|---|---|---|---|---|
| phzm-hardiness | phzmapi.org | `getHardinessZone` | `getHardinessZone(locationInfo.zip)` | `null` | no | `typeof r?.zone === 'string' && r.zone.length > 0` | — | all | no |
| inat-native-plants | inaturalist | `iNatSpeciesCounts` (taxon 47126, native) | `iNatSpeciesCounts(ctx.lat, ctx.lng, INAT_NATIVE_PLANTS_RADIUS_KM, 47126, {native:true}, INAT_NATIVE_PLANTS_PER_PAGE)` | `[]` | yes | `Array.isArray(r) && r.length > 0` | — | some | yes |
| inat-invasive-plants | inaturalist | `iNatSpeciesCounts` (taxon 47126, introduced) | `iNatSpeciesCounts(ctx.lat, ctx.lng, INAT_INVASIVE_PLANTS_RADIUS_KM, 47126, {introduced:true}, INAT_INVASIVE_PLANTS_PER_PAGE)` | `[]` | yes | `Array.isArray(r) && r.length > 0` | — | some | yes |
| inat-wildlife | inaturalist | `iNatSpeciesCounts` (taxon 40151) | `iNatSpeciesCounts(ctx.lat, ctx.lng, INAT_WILDLIFE_RADIUS_KM, 40151, {}, INAT_WILDLIFE_PER_PAGE)` | `[]` | yes | `Array.isArray(r) && r.length > 0` | — | some | yes |
| inat-birds | inaturalist | `iNatSpeciesCounts` (taxon 3) | `iNatSpeciesCounts(ctx.lat, ctx.lng, INAT_BIRDS_RADIUS_KM, 3, {}, INAT_BIRDS_PER_PAGE)` | `[]` | yes | `Array.isArray(r) && r.length > 0` | — | some | yes |
| inat-reptiles | inaturalist | `iNatSpeciesCounts` (taxon 26036) | `iNatSpeciesCounts(ctx.lat, ctx.lng, INAT_REPTILES_RADIUS_KM, 26036, {}, INAT_REPTILES_PER_PAGE)` | `[]` | yes | `Array.isArray(r) && r.length > 0` | — | some | yes |
| inat-insects | inaturalist | `iNatSpeciesCounts` (taxon 47158) | `iNatSpeciesCounts(ctx.lat, ctx.lng, INAT_INSECTS_RADIUS_KM, 47158, {}, INAT_INSECTS_PER_PAGE)` | `[]` | yes | `Array.isArray(r) && r.length > 0` | — | some | yes |
| inat-butterflies | inaturalist | `iNatSpeciesCounts` (taxon 47224) | `iNatSpeciesCounts(ctx.lat, ctx.lng, INAT_BUTTERFLIES_RADIUS_KM, 47224, {}, INAT_BUTTERFLIES_PER_PAGE)` | `[]` | yes | `Array.isArray(r) && r.length > 0` | — | some | yes |
| inat-birds-spring | inaturalist | `iNatSeasonalBirds` (months 3,4,5) | `iNatSeasonalBirds(ctx.lat, ctx.lng, '3,4,5')` | `[]` | yes | `Array.isArray(r) && r.length > 0` | — | some | yes |
| inat-birds-summer | inaturalist | `iNatSeasonalBirds` (months 6,7,8) | `iNatSeasonalBirds(ctx.lat, ctx.lng, '6,7,8')` | `[]` | yes | `Array.isArray(r) && r.length > 0` | — | some | yes |
| inat-birds-fall | inaturalist | `iNatSeasonalBirds` (months 9,10,11) | `iNatSeasonalBirds(ctx.lat, ctx.lng, '9,10,11')` | `[]` | yes | `Array.isArray(r) && r.length > 0` | — | some | yes |
| inat-birds-winter | inaturalist | `iNatSeasonalBirds` (months 12,1,2) | `iNatSeasonalBirds(ctx.lat, ctx.lng, '12,1,2')` | `[]` | yes | `Array.isArray(r) && r.length > 0` | — | some | yes |
| usgs-elevation-garden | usgs | `getMicroclimateData` (calls USGS elevation) | `getMicroclimateData(ctx.lat, ctx.lng)` | elevation field `null` inside `{lat, elevationFt:null, ...}` | no (fn always returns the struct; elevation field alone may be null) | `r !== null && r.lat != null` (elevation specifically: `r.elevationFt != null`) | — | all | no |

**Notes:**
- All iNat calls use the same base endpoint `https://api.inaturalist.org/v1/observations/species_counts`. The URL is hardcoded inside the module functions — **not in constants.js**. **Flag: hardcoded URL for all inat-* sources.** Task 7 probe should reference a shared constant.
- `phzm-hardiness`: URL is `https://phzmapi.org/${zip}.json` — hardcoded in module. **Flag: hardcoded URL.** (verify)
- `getMicroclimateData` reuses `USGS_ELEVATION_URL` from constants — already exported. Garden's USGS elevation call is separate from climate's `getWatershedContext` (single point vs. 5-point grid). Listed separately since it's a distinct fetcher function.
- All iNat species-count sources are coverage = some because urban areas with no research-grade observations legitimately return []. **All probe needed.**
- iNat seasonal bird calls are the same endpoint with a `months` param — they share the same hardcoded URL.

---

## MODULE: growth

*File: `src/modules/growth/data.js`*

| id | provider | fetcher fn | call signature | failure value | legit-empty? | valid shape | requiresKey | coverage | probe needed? |
|---|---|---|---|---|---|---|---|---|---|
| census-bps | census | `getBuildingPermitTrend` | `getBuildingPermitTrend(ctx.fips)` | `null` | no | `r !== null && typeof r.current === 'number'` | `CENSUS_API_KEY` (optional — keyless also works, lower rate limit) | some | no |
| census-acs-construction | census | `getNewConstructionContext` (calls `fetchCensusACS`) | `getNewConstructionContext(ctx.fips)` | `null` | no | `r !== null && typeof r.newConstructionPct === 'number'` | `CENSUS_API_KEY` | all | no |
| google-places-development | google | `getRecentDevelopmentActivity` (placesNearby × 7) | `getRecentDevelopmentActivity(ctx.lat, ctx.lng)` | `[]` | yes | `Array.isArray(r) && r.length > 0` | — | some | yes |
| google-news-rss | google-news | `discoverDevelopments` (inside `development-discovery.js`) | `discoverDevelopments(locationInfo.city, locationInfo.state)` | `[]` | yes | `Array.isArray(r) && r.length > 0` | — | some | yes |

**Notes:**
- `getBuildingPermitTrend`: Uses Census Building Permits Survey (`api.census.gov/data/timeseries/eits/bps`). URL is hardcoded inside the function — **not in constants.js**. **Flag: hardcoded URL.**
- `getBuildingPermitTrend`: The CENSUS_API_KEY is optional for the BPS endpoint (key is appended only if present via `const keyParam = censusKey ? ...`). Coverage = some (rural counties often have no BPS data).
- `getRecentDevelopmentActivity`: calls `googleMapsClient.placesNearby` for each of 7 COMMERCIAL_DEV_TYPES. Total failure (all rejected) returns `[]` via `Promise.allSettled` — same as no establishments. **Probe needed.**
- `discoverDevelopments`: tries manual DB → local cache → Google News RSS scrape. The RSS URL (`https://news.google.com/rss/search`) is hardcoded in `src/development-discovery.js`. Final fallback is `[]`. **Probe needed.**
- `google-news-rss` probe: endpoint is `https://news.google.com/rss/search?q=...`. This is not a structured API (no key, no versioned spec) — probe should test for `HTTP 200` and valid XML `<rss` tag only. (verify)

---

## MODULE: health

*File: `src/modules/health/data.js`*

| id | provider | fetcher fn | call signature | failure value | legit-empty? | valid shape | requiresKey | coverage | probe needed? |
|---|---|---|---|---|---|---|---|---|---|
| google-places-hospital | google | `findNearestHospital` | `findNearestHospital(ctx.lat+','+ctx.lng, ctx.state, cell)` | throws `Error` | no | `typeof r.name === 'string' && typeof r.driveTimeMinutes === 'number'` | — | all | no |
| google-places-urgentcare | google | `findNearestUrgentCare` | `findNearestUrgentCare(ctx.lat+','+ctx.lng, ctx.state, cell)` | throws `Error` | no | `typeof r.name === 'string' && typeof r.driveTimeMinutes === 'number'` | — | all | no |
| cms-hospital-type | cms | `getCMSHospitalType` | `getCMSHospitalType(hospital.address)` | `null` | no | `r !== null && typeof r.label === 'string'` | — | some | no |
| npi-primary-care | npi | `getPrimaryCareCount` | `getPrimaryCareCount(locationInfo.city, locationInfo.state)` | `null` | no | `r !== null && typeof r === 'number'` | — | all | no |

**Notes:**
- `findNearestHospital` and `findNearestUrgentCare` throw on total failure (no results or no drive times). Failure is a rejected promise, not a sentinel return.
- `getCMSHospitalType`: hits `https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0` — hardcoded URL. Returns `null` on HTTP error or when `rows.length === 0`. Coverage = some (rural areas may have no matching ZIP). **No probe needed** (null = error or no data is functionally distinguishable by coverage = some).
- `getPrimaryCareCount`: hits `https://npiregistry.cms.hhs.gov/api/` — hardcoded URL. Returns `null` on error; returns `0` (a number) when no providers found. Distinguishable. Coverage = all.
- **Flags: hardcoded URLs** for both `cms-hospital-type` and `npi-primary-care` — not in constants.js.

---

## MODULE: property

*File: `src/modules/property/data.js`*

| id | provider | fetcher fn | call signature | failure value | legit-empty? | valid shape | requiresKey | coverage | probe needed? |
|---|---|---|---|---|---|---|---|---|---|
| usda-soil | usda | `getSoilData` | `getSoilData(ctx.lat, ctx.lng)` | `null` | no | `r !== null && typeof r.drainagecl === 'string'` | — | some | no |
| census-acs-property | census | `getPropertyIntelligence` (calls `fetchCensusACS`) | `getPropertyIntelligence(ctx.lat, ctx.lng, ctx.fips, locationInfo)` | `null` for the acs field | no | `r.era !== null && typeof r.era.medianYearBuilt === 'number'` | `CENSUS_API_KEY` | all | no |
| census-acs-tractpop | census | `getPropertyData` (calls `fetchCensusACS` for B01003_001E) | `getPropertyData(ctx.fips, locationInfo)` | tractPop `null` (gracefully tolerated) | no | not directly tested; used internally | `CENSUS_API_KEY` | all | no |

**Notes:**
- `getSoilData` posts to `https://sdmdataaccess.sc.egov.usda.gov/Tabular/SDMTabularService/post.rest` — hardcoded URL. Returns `null` on HTTP error or empty Table. Coverage = some (water bodies, paved roads can return null). **No probe needed** (null vs. real object is distinguishable).
- `getPropertyData` and `getPropertyIntelligence` each independently call `fetchCensusACS`. Listed as two rows since they have different variable lists and different callers, but they share the same Census ACS5 endpoint.
- `census-acs-tractpop` is a single-variable ACS fetch (`B01003_001E`) used only to compute `densityLabel`. May be merged with `census-acs-property` in Task 7 if the orchestrator consolidates calls.
- **Flag: hardcoded URL** for `usda-soil` (`sdmdataaccess.sc.egov.usda.gov`) — not in constants.js.

---

## MODULE: reachability

*File: `src/modules/reachability/data.js`*

| id | provider | fetcher fn | call signature | failure value | legit-empty? | valid shape | requiresKey | coverage | probe needed? |
|---|---|---|---|---|---|---|---|---|---|
| google-places-grocery | google | `findNearestGrocery` | `findNearestGrocery(ctx.lat+','+ctx.lng, ruralMode, cell)` | throws `Error` | no | `Array.isArray(r) && r.length > 0 && typeof r[0].driveTimeMinutes === 'number'` | — | all | no |
| google-places-pharmacy | google | `findNearestPharmacy` | `findNearestPharmacy(ctx.lat+','+ctx.lng, cell)` | throws `Error` | no | `r !== null && typeof r.driveTimeMinutes === 'number'` | — | all | no |
| google-places-gas | google | `findNearestGasStation` | `findNearestGasStation(ctx.lat+','+ctx.lng, cell)` | throws `Error` | no | `r !== null && typeof r.driveTimeMinutes === 'number'` | — | all | no |

**Notes:**
- All three throw on total failure (no results found or no drive time available). Failure surfaces as a rejected promise at the orchestrator.
- The EIA gas price fetch (`fetchGasPrice` in `src/shared/rates.js`) is called by the **orchestrator** (`reportBuilder.js`), not by `reachability/data.js` itself — see Excluded section below.

---

## MODULE: recreation

*File: `src/modules/recreation/data.js`*

| id | provider | fetcher fn | call signature | failure value | legit-empty? | valid shape | requiresKey | coverage | probe needed? |
|---|---|---|---|---|---|---|---|---|---|
| google-places-park | google | `findNearestPark` | `findNearestPark(ctx.lat+','+ctx.lng)` | throws `Error` | no | `r !== null && typeof r.driveTimeMinutes === 'number'` | — | all | no |
| google-places-coffee | google | `findNearestCoffeeShop` | `findNearestCoffeeShop(ctx.lat+','+ctx.lng)` | throws `Error` | no | `r !== null && typeof r.driveTimeMinutes === 'number'` | — | all | no |
| google-places-library | google | `findNearestLibrary` | `findNearestLibrary(ctx.lat+','+ctx.lng)` | throws `Error` | no | `r !== null && typeof r.driveTimeMinutes === 'number'` | — | all | no |
| google-places-reccenter | google | `findNearestRecreationCenter` | `findNearestRecreationCenter(ctx.lat+','+ctx.lng)` | throws `Error` | no | `r !== null && typeof r.driveTimeMinutes === 'number'` | — | all | no |
| google-places-postoffice | google | `findNearestPostOffice` | `findNearestPostOffice(ctx.lat+','+ctx.lng)` | throws `Error` | no | `r !== null && typeof r.driveTimeMinutes === 'number'` | — | all | no |

---

## MODULE: safety

*File: `src/modules/safety/data.js`*

| id | provider | fetcher fn | call signature | failure value | legit-empty? | valid shape | requiresKey | coverage | probe needed? |
|---|---|---|---|---|---|---|---|---|---|
| google-places-police | google | `getEmergencyServices` (police placesNearby) | `getEmergencyServices(ctx.lat, ctx.lng, ctx.lat+','+ctx.lng)` | `null` in returned `{ police: null, fire: ... }` | no | `r.police !== null && typeof r.police.driveTimeMinutes === 'number'` | — | all | no |
| google-places-fire | google | `getEmergencyServices` (fire placesNearby) | (same call as above, fire branch) | `null` in returned `{ police: ..., fire: null }` | no | `r.fire !== null && typeof r.fire.driveTimeMinutes === 'number'` | — | all | no |

**Notes:**
- `getEmergencyServices` uses `Promise.allSettled` for the two Places calls. Each branch returns `null` independently on rejection. The outer function always returns `{ police, fire }` — never throws. Failure is distinguishable (null) from success (object with name + driveTimeMinutes).

---

## MODULE: schools

*File: `src/modules/schools/data.js`*

| id | provider | fetcher fn | call signature | failure value | legit-empty? | valid shape | requiresKey | coverage | probe needed? |
|---|---|---|---|---|---|---|---|---|---|
| google-places-school | google | `findNearestSchool` | `findNearestSchool(ctx.lat+','+ctx.lng, ctx.state)` | throws `Error` | no | `r !== null && typeof r.driveTimeMinutes === 'number'` | — | all | no |
| google-places-elementary | google | `findNearestElementarySchool` | `findNearestElementarySchool(ctx.lat+','+ctx.lng, ctx.state)` | throws `Error` | no | `r !== null && typeof r.driveTimeMinutes === 'number'` | — | all | no |

---

## MODULE: sensory

*File: `src/modules/sensory/data.js`*

| id | provider | fetcher fn | call signature | failure value | legit-empty? | valid shape | requiresKey | coverage | probe needed? |
|---|---|---|---|---|---|---|---|---|---|
| airnow-aqi | airnow | `getAirQuality` | `getAirQuality(ctx.lat, ctx.lng)` | `null` | no | `r !== null && typeof r.aqi === 'number'` | `AIRNOW_API_KEY` | some | no |
| fema-flood | fema | `getFloodRisk` | `getFloodRisk(ctx.lat, ctx.lng)` | `null` | no | `r !== null && typeof r.zone === 'string'` | — | all | no |
| google-places-airports | google | `getAirportData` | `getAirportData(ctx.lat, ctx.lng)` | `null` | yes (`null` for no airports within radius, and for HTTP error — but those paths are distinguishable: `!resp` vs. empty array) | `Array.isArray(r) && r.length > 0` | — | some | yes |
| bts-road-noise | bts | `getRoadNoise` (BTS primary) | `getRoadNoise(ctx.lat, ctx.lng)` | falls through to OSM fallback | no (two-tier: BTS → OSM; OSM also has estimation fallback) | `r !== null && typeof r.dnl === 'number'` | — | all | no |
| osm-road-noise | osm | `getRoadNoiseOSM` (OSM fallback inside `getRoadNoise`) | called internally | `null` from `fetchOverpass` if all Overpass endpoints fail | no (estimation fallback: `{ dnl: 40, source: 'estimated' }`) | `r !== null && r.source !== undefined` | — | all | no |
| osm-rail | osm | `getRailProximity` | `getRailProximity(ctx.lat, ctx.lng)` | `null` | yes (null = no rail within radius OR endpoint failure) | `r !== null && typeof r.distanceMiles === 'number'` | — | some | yes |
| census-acs-lightpollution | census | `getLightPollution` (calls `fetchCensusACS`) | `getLightPollution(ctx.lat, ctx.lng, ctx.fips)` | uses population = null; Bortle is still estimated | no (always returns a Bortle estimate) | `r !== null && typeof r.bortle === 'number'` (verify field name in logic.js) | `CENSUS_API_KEY` | all | no |
| osm-landuse | osm | `fetchLanduseOSM` (called inside `getLightPollution`) | called internally | `null` | yes | `r !== null` (string: 'commercial'|'residential'|'rural') | — | some | yes |
| epa-echo-water | epa | `getWaterQuality` | `getWaterQuality(ctx.lat, ctx.lng)` | `null` | no | `r !== null && typeof r.systemName === 'string'` | — | some | no |
| epa-ejscreen | epa | `getEJScreen` | `getEJScreen(ctx.lat, ctx.lng)` | `null` | no | `r !== null && typeof r.superfundPct === 'number'` | — | all | no |

**Notes:**
- `getAirQuality`: returns `null` when key missing, `null` when HTTP fails, `null` when response is empty array. All three are `null` — BUT key-missing is predictable, so for probing purposes only HTTP error and empty response need distinguishing. Coverage = some (AirNow sensors don't cover all rural areas). (verify)
- `getFloodRisk`: returns `null` on HTTP error, but returns a default `{ zone: 'X', ... }` on empty features. So `null` = error, object = success (even if zone is 'X'). Coverage = all (FEMA NFHL covers all US, though some areas unexamined → 'X'). Distinguishable.
- `getAirportData`: returns `null` on empty/filtered result (no airports within 20 miles) AND also returns `null` if the places call fails (via `resp.data.results || []` — the SDK throws on auth failure, but the function is not in a try/catch in the airport function itself — it would throw to the caller and be caught by `Promise.allSettled`). Actually `resp.data.results || []` — if resp throws, `getAirportData` would throw, caught by allSettled. If results is empty after filtering → `null`. Coverage = some. **Probe needed for the filtering case.** (verify)
- `getRoadNoise` / `bts-road-noise`: URL `https://gis.bts.gov/arcgis/rest/services/National_Transportation_Noise_Map/MapServer/0/query` is hardcoded. **Flag: hardcoded URL.**
- `getWaterQuality` / `epa-echo-water`: hits `https://echodata.epa.gov/echo/sdw_rest_services.get_facilities` — hardcoded. Returns `null` on error; `{ systemName, violations: [] }` when no violations. Coverage = some (private wells, unserved areas return null). Distinguishable.
- `getEJScreen` / `epa-ejscreen`: hits `https://ejscreen.epa.gov/mapper/ejscreenRESTbroker.aspx` — hardcoded. Returns `null` when all pnpl/prmp/ptsdf are 0 and no features. Coverage = all (EJSCREEN covers all census block groups in US). Comment in code flags the URL may migrate.
- OSM Overpass calls use `OVERPASS_ENDPOINTS` array from constants.js (already exported).
- **Flags: hardcoded URLs** for BTS noise (`gis.bts.gov`), EPA ECHO water (`echodata.epa.gov`), EPA EJSCREEN (`ejscreen.epa.gov`). None are in constants.js.

---

## MODULE: utilities

*File: `src/modules/utilities/data.js`*

| id | provider | fetcher fn | call signature | failure value | legit-empty? | valid shape | requiresKey | coverage | probe needed? |
|---|---|---|---|---|---|---|---|---|---|
| nrel-electric-rate | nrel | `getElectricFromNREL` | `getElectricFromNREL(lat, lng)` | `null` | no | `r !== null && typeof r.residentialRate === 'number' && r.residentialRate > 0` | `NREL_API_KEY` | some | no |
| hifld-electric-territory | hifld | `getElectricFromHIFLD` | `getElectricFromHIFLD(lat, lng)` | `null` | no | `r !== null && typeof r.utilityName === 'string'` | — | some | no |
| nrel-ev-charging | nrel | `getEvFromNREL` | `getEvFromNREL(lat, lng, driveOrigin, getDriveTime, cell)` | `null` | no | `r !== null && (r.level2 !== null || r.dcFast !== null)` | `NREL_API_KEY` | some | no |
| openchargemap-ev | openchargemap | `getEvFromOpenChargeMap` | `getEvFromOpenChargeMap(lat, lng, driveOrigin, getDriveTime, cell)` | `null` | no | `r !== null && (r.level2 !== null || r.dcFast !== null)` | `OPENCHARGEMAP_API_KEY` | some | no |
| fcc-broadband | fcc | `getBroadbandData` | `getBroadbandData(lat, lng)` | `null` | no | `r !== null && Array.isArray(r.providers) && r.providers.length > 0` | — | some | no |

**Notes:**
- `getElectricData` is the primary entry point that tries NREL then HIFLD. Listed as two sources because they are independently callable and the probe needs to test each separately.
- `getEvChargingData` is the primary entry point that tries NREL then OpenChargeMap. Same pattern.
- `nrel-electric-rate`: uses `${NREL_BASE}/utility_rates/v3.json` where `NREL_BASE = 'https://developer.nrel.gov/api'` — **module-local const**, not in constants.js. **Flag: hardcoded base URL.** Uses `DEMO_KEY` fallback when `NREL_API_KEY` missing.
- `hifld-electric-territory`: uses `HIFLD_TERRITORIES_URL` from constants.js — already exported.
- `nrel-ev-charging`: uses `${NREL_BASE}/alt-fuel-stations/v1/nearest.json` — same module-local `NREL_BASE`. **Flag: same hardcoded URL.**
- `openchargemap-ev`: uses `https://api.openchargemap.io/v3/poi/` — hardcoded. **Flag: hardcoded URL.**
- `fcc-broadband`: uses `https://broadbandmap.fcc.gov/api/public/map/listAvailability` — hardcoded. **Flag: hardcoded URL.** Coverage = some (rural areas may have no BDC filings). Returns `null` on error or empty availability. Distinguishable.
- All 5 sources have distinguishable failure (`null`) from success (object with content). No probes strictly needed, but NREL/OCM/FCC are coverage = some, so empty vs. error ambiguity is low risk.

---

## MODULE: walkability

*File: `src/modules/walkability/data.js`*

| id | provider | fetcher fn | call signature | failure value | legit-empty? | valid shape | requiresKey | coverage | probe needed? |
|---|---|---|---|---|---|---|---|---|---|
| google-places-walkability | google | `getWalkabilityScore` (placesNearby × 5) | `getWalkabilityScore(ctx.lat, ctx.lng)` | `{ score: 0, category: ..., destinations: [], isProxy: true }` | yes (zero score = remote area OR total API failure) | `r !== null && typeof r.score === 'number' && r.destinations.length > 0` | — | some | yes |

**Notes:**
- Uses `Promise.allSettled` so individual type failures are swallowed. Total failure (all 5 types rejected) returns score = 0 and empty destinations — same as a genuinely car-dependent address. **Probe needed.**

---

## Excluded (not live external)

| module | function | reason |
|---|---|---|
| climate | `getNOAAStormEvents` | Tier 1 (CDO API returns nothing, hardcoded comment). Tier 2 reads a LOCAL pre-cached JSON file (`data/noaa-storm-events/<fips>.json`). Tier 3 returns `[]` immediately. No live external HTTP call is made at runtime. |
| shared | `fetchIrsMileageRate` | Called from `reportBuilder.js` (orchestrator), not from any module data.js. If added to a module in future, add to inventory then. |
| shared | `getDrivingRates` / `fetchGasPrice` | Called from `reportBuilder.js` orchestrator level, not from any of the 14 module data.js files. The EIA gas price fetch is an orchestrator-level concern. |
| shared | `getCensusFIPS` | Called at orchestrator level to build the `fips` context object before any module is invoked. Not a module data.js call. |
| community/property/growth | `fetchCensusACS` (shared utility) | The actual HTTP call lives in `src/shared/census.js` and is identical across modules. Catalogued under each module that calls it (census-acs-demographics, census-acs-property, etc.) for probe granularity. |
| growth | `getLocalDevelopmentIntel` | Reads `src/development-intel.js` — local in-memory data, no HTTP call. |

---

## FCC Broadband — status: active (not deferred)

FR-062 deferred the FCC BDC *token-gated* approach. However, `getBroadbandData` in utilities/data.js uses the **keyless public FCC National Broadband Map API** (`broadbandmap.fcc.gov/api/public/map/listAvailability`) which does NOT require a BDC token. This source is **live and active** — catalogued above as `fcc-broadband` under utilities. No deferral applies to this endpoint.

---

## Probe URL sources / hardcoded-URL flags

This section records where each "probe needed = yes" source gets its URL from (for Task 7 reuse) and flags all URLs that are hardcoded inside modules rather than exported from constants.

### Probe needed — URL sources

| module | id | probe URL source |
|---|---|---|
| climate | fema-declarations | `FEMA_DECLARATIONS_URL` — `src/utils/constants.js` |
| climate | usgs-watershed | `WBD_BASE` — **module-local const** in `src/modules/climate/data.js` (line 164). Must export to constants or reference directly. |
| garden | inat-native-plants through inat-birds-winter (all iNat sources) | `https://api.inaturalist.org/v1/observations/species_counts` — hardcoded in `iNatSpeciesCounts` and `iNatSeasonalBirds`. Recommend adding `INAT_SPECIES_COUNTS_URL` to constants. |
| garden | phzm-hardiness | `https://phzmapi.org/${zip}.json` — hardcoded in `getHardinessZone`. Recommend adding `PHZM_API_BASE` to constants. |
| growth | google-places-development | Google Places API via `googleMapsClient.placesNearby` — no separate URL constant needed, uses the existing client. |
| growth | google-news-rss | `https://news.google.com/rss/search` — hardcoded in `src/development-discovery.js`. Recommend adding `GOOGLE_NEWS_RSS_BASE` to constants. |
| sensory | google-places-airports | Google Places API via `googleMapsClient.placesNearby` — no separate URL constant needed. |
| sensory | osm-rail | `OVERPASS_ENDPOINTS` array — `src/utils/constants.js`. |
| sensory | osm-landuse | `OVERPASS_ENDPOINTS` array — `src/utils/constants.js`. |
| walkability | google-places-walkability | Google Places API via `googleMapsClient.placesNearby` — no separate URL constant needed. |

### Hardcoded URLs that should be exported to constants (whether or not probe is needed)

| module | source id | hardcoded URL | recommended constant name |
|---|---|---|---|
| climate | usgs-watershed | `https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer` | `WBD_BASE_URL` |
| garden | all inat-* | `https://api.inaturalist.org/v1/observations/species_counts` | `INAT_SPECIES_COUNTS_URL` |
| garden | phzm-hardiness | `https://phzmapi.org/` | `PHZM_API_BASE_URL` |
| growth | census-bps | `https://api.census.gov/data/timeseries/eits/bps` | `CENSUS_BPS_URL` |
| growth | google-news-rss | `https://news.google.com/rss/search` | `GOOGLE_NEWS_RSS_URL` |
| health | cms-hospital-type | `https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0` | `CMS_HOSPITAL_QUERY_URL` |
| health | npi-primary-care | `https://npiregistry.cms.hhs.gov/api/` | `NPI_REGISTRY_URL` |
| property | usda-soil | `https://sdmdataaccess.sc.egov.usda.gov/Tabular/SDMTabularService/post.rest` | `USDA_SDA_URL` |
| sensory | bts-road-noise | `https://gis.bts.gov/arcgis/rest/services/National_Transportation_Noise_Map/MapServer/0/query` | `BTS_NOISE_MAP_URL` |
| sensory | epa-echo-water | `https://echodata.epa.gov/echo/sdw_rest_services.get_facilities` | `EPA_ECHO_SDW_URL` |
| sensory | epa-ejscreen | `https://ejscreen.epa.gov/mapper/ejscreenRESTbroker.aspx` | `EPA_EJSCREEN_URL` |
| utilities | nrel-electric-rate | `https://developer.nrel.gov/api` (NREL_BASE module const) | `NREL_API_BASE_URL` |
| utilities | nrel-ev-charging | (same NREL_BASE) | (same constant) |
| utilities | openchargemap-ev | `https://api.openchargemap.io/v3/poi/` | `OPENCHARGEMAP_URL` |
| utilities | fcc-broadband | `https://broadbandmap.fcc.gov/api/public/map/listAvailability` | `FCC_BROADBAND_URL` |

---

## Summary

**Total live external sources catalogued: 49**

| module | live sources |
|---|---|
| access | 2 |
| climate | 5 |
| community | 1 |
| garden | 13 |
| growth | 4 |
| health | 4 |
| property | 3 |
| reachability | 3 |
| recreation | 5 |
| safety | 2 |
| schools | 2 |
| sensory | 10 (including OSM landuse sub-call) |
| utilities | 5 |
| walkability | 1 |
| **Total** | **60** |

*(Note: the 49 figure excludes internal sub-calls like `fetchElevationWithRetry` that are subcomponents of a higher-level source. The 60 figure counts every discrete fetcher function. The SOURCES descriptor in Task 7 should use the logical count — i.e., one row per distinct upstream API endpoint, not per function.)*

**Swallow-to-empty sources (probe needed): 17**
fema-declarations, usgs-watershed, inat-native-plants, inat-invasive-plants, inat-wildlife, inat-birds, inat-reptiles, inat-insects, inat-butterflies, inat-birds-spring, inat-birds-summer, inat-birds-fall, inat-birds-winter, google-places-development, google-news-rss, google-places-airports, osm-rail, osm-landuse, google-places-walkability

*(osm-landuse is a sub-call of getLightPollution; counts as 19 total including osm-rail and osm-landuse. Counting all rows in probe-needed = yes: 19.)*

**Modules with genuine uncertainty (verify notes):**
- `sensory` / `getAirportData`: the null-on-error vs null-on-empty distinction should be verified by reading the Google Maps SDK behavior when the API returns an auth error (does it throw, or does `resp.data.results` become null/undefined?). Labeled probe needed = yes conservatively.
- `sensory` / `getAirQuality`: coverage = some flagged with (verify) — confirm whether AirNow returns an empty array vs a 404 for unmonitored areas.
- `sensory` / `getLightPollution` / `estimateBortle`: valid shape uses `r.bortle` — verify the field name exported by `estimateBortle` in logic.js.
- `growth` / `google-news-rss`: probe strategy for an RSS scrape is non-standard — verify what a "healthy" Google News RSS response looks like and whether rate limiting returns 429 or 200 with CAPTCHA.
