# FR-027 — Sensory & Environmental (Chapter 8)

## What
This spec EXPANDS existing FR-019 (Environmental Data) into a full chapter. FR-019 covers air quality, noise estimation, and flood risk. FR-027 adds flight path analysis, detailed road noise, rail proximity and schedule, light pollution, water quality violations, radon zone, and EPA EJSCREEN data — and reorganizes everything into a cohesive narrative about what living at this address actually sounds and feels like day-to-day.

**Relationship to FR-019:** FR-027 supersedes FR-019. The implementation of FR-019 (if completed) is absorbed here. Do not build FR-019 separately — build FR-027 as the complete chapter.

## Problem
Every home shows well at 2pm on a sunny Sunday. The listing photos are taken without planes overhead. The open house is on a weekend when the adjacent rail yard is quiet. The industrial facility 0.8 miles away has its HVAC running at 60% capacity. The neighborhood looks peaceful at noon and sounds like O'Hare at 6am.

Sensory and environmental factors are the category of home characteristic that buyers most frequently cite in post-purchase regret surveys: "I didn't know about the planes," "I didn't know the train came through at 3am," "I didn't know about the light from the parking lot next door." These things are knowable, but require specific investigation that buyers don't know to do.

---

## Gate 1: Conceptual Review

### Quality Checks

**Actionable — Does this change their decision or preparation?**
Yes. A flight path passing at 6-7am on weekdays is a dealbreaker for light sleepers — and the fix (moving) is not cheap. A rail line with freight trains on no fixed schedule affects sleep and outdoor enjoyment. A radon zone 1 designation changes whether a buyer needs to budget $1,500-$3,000 for mitigation. An EPA water quality violation in the last 3 years requires follow-up with the utility. These findings change offers, inspection scopes, and sometimes decisions.

**Revealing — Does this show something hidden or invisible?**
Yes, this is the core strength of this chapter. Flight paths require checking FAA sectional charts and airport traffic procedures — non-trivial for a buyer. Rail schedules require checking freight line ownership and surface operations. Light pollution is invisible in daylight. Radon zones are not disclosed in listings. EPA water violations are public record but buried in the EPA ECHO database. None of this is surfaced by any consumer real estate platform.

**Avoids Regret — Does this prevent an "I wish I had known" moment?**
Yes, directly and specifically. This chapter maps almost 1:1 to the most common post-purchase environmental regrets:
- "I didn't know about the planes" → flight path analysis
- "I didn't know the train came through at night" → rail analysis  
- "I didn't know there was a water violation" → EPA SDWIS lookup
- "I didn't know the highway was so loud at night" → road noise model
- "I didn't know the lights from the shopping center lit up our bedroom" → light pollution
- "I didn't know this was a high-radon area" → EPA radon zone

**Exclusive — Can they get this elsewhere easily?**
No. Each individual data source is technically public, but the aggregation across FAA, EPA, FRA, light pollution databases, and road noise models does not exist in any consumer product. HowLoud provides noise data as a paid API. Nothing provides the full combination Livably assembles here.

### Score: 4/4
### Decision: MUST HAVE

---

## Gate 2: Data Source Validation

### Source 1: FAA — Flight Path Analysis
- **Type:** Government data, free
- **URL:** https://oeaaa.faa.gov/ and https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/
- **What it provides:** Airport locations, instrument approach procedures, standard terminal arrival routes (STARs), standard instrument departures (SIDs)
- **Accuracy:** High — official FAA data
- **Freshness:** Updated with AIRAC cycles (every 28 days)
- **Legal Status:** Public domain
- **Cost:** Free
- **Implementation approach:**
  - Find all airports within 20 miles using Google Places API (type: airport)
  - For each airport, calculate bearing and distance from subject property
  - Use airport traffic patterns (typically left-hand pattern at 1,000 AGL) to estimate if subject property falls under approach or departure paths
  - Cross-reference with FAA digital aeronautical chart data for precision
- **Limitation:** Exact flight tracks require FAA ASDI data (restricted). Approach/departure path geometry is a reliable proxy.

```javascript
// Find airports within 20 miles, assess flight path exposure
async function analyzeFlightPaths(lat, lng) {
  // Step 1: Find nearby airports via Places API
  const airports = await findNearbyPlaces(lat, lng, 32000, 'airport');
  
  // Step 2: For each airport, calculate bearing from property
  // Step 3: Compare bearing to typical runway headings
  // Step 4: Estimate if property is within 3nm of approach/departure path
  // Step 5: Assess altitude at property position (property closer = lower altitude = louder)
  
  return airports.map(airport => ({
    name: airport.name,
    distanceMiles: airport.distance,
    bearing: calculateBearing(lat, lng, airport.lat, airport.lng),
    underApproachPath: estimatePathExposure(lat, lng, airport),
    estimatedAltitudeOverhead: estimateAltitude(airport.distance, airport.runwayHeadings)
  }));
}
```

### Source 2: Road Noise — USDOT/FHWA Noise Contours
- **Type:** Government data, free
- **URL:** https://www.bts.gov/topics/national-transportation-noise-map
- **What it provides:** Day-Night Average Sound Level (DNL) in dB for road and rail, pre-calculated for US
- **Accuracy:** High — modeled from actual traffic counts and road geometry
- **Freshness:** 2020 data (stable reference)
- **Legal Status:** Public domain
- **Cost:** Free
- **API access:** Available via BTS GIS services
- **Use:** Pull actual modeled noise level at coordinates, not an estimate from proximity

```javascript
// BTS National Transportation Noise Map - road noise query
async function getRoadNoiseLevel(lat, lng) {
  // BTS exposes GIS map services - query by point
  const url = `https://gis.bts.gov/arcgis/rest/services/` +
    `National_Transportation_Noise_Map/MapServer/0/query` +
    `?geometry=${lng},${lat}&geometryType=esriGeometryPoint` +
    `&spatialRel=esriSpatialRelIntersects&outFields=DNL_RD` +
    `&returnGeometry=false&f=json`;
  // Returns DNL value in dB(A)
}
```

### Source 3: Rail — Federal Railroad Administration
- **Type:** Government data, free
- **URL:** https://www.bts.gov/topics/national-transportation-noise-map (same as road)
- **What it provides:** Rail noise contours (DNL), rail line locations, ownership
- **Accuracy:** High — modeled from track geometry and traffic
- **Freshness:** 2020 data
- **Legal Status:** Public domain
- **Cost:** Free
- **Supplement:** OpenRailwayMap (https://www.openrailwaymap.org/) via Overpass API for rail line identification and operator lookup
- **Limitation:** Freight schedule specifics (night vs day frequency) not in public dataset at address level

### Source 4: Light Pollution — VIIRS/NOAA
- **Type:** Government satellite data, free
- **URL:** https://ngdc.noaa.gov/eog/viirs/download_monthly.html
- **API alternative:** Light Pollution Map (https://www.lightpollutionmap.info/) provides tile-based access
- **What it provides:** Artificial sky brightness at night, measured in magnitudes/arcsec² or mcd/m²
- **Accuracy:** High — satellite measurement
- **Freshness:** Annual composites
- **Legal Status:** Public domain (NOAA data)
- **Cost:** Free
- **Use:** Classify light pollution level (Bortle scale equivalent)

```javascript
// Light pollution via NOAA VIIRS - tile-based query
// Alternative: use pre-computed tile lookup via lightpollutionmap.info
async function getLightPollutionLevel(lat, lng) {
  // Query NOAA VIIRS raster tile for this coordinate
  // Return SQM (sky quality meter) value
  // Translate to Bortle class and plain-language description
}

function bortleClassDescription(sqm) {
  if (sqm >= 21.7) return { class: 1, label: 'Exceptional dark sky', description: 'Milky Way casts shadows' };
  if (sqm >= 21.3) return { class: 2, label: 'Truly dark sky', description: 'Milky Way clearly visible' };
  if (sqm >= 20.4) return { class: 4, label: 'Rural/suburban transition', description: 'Milky Way visible but not striking' };
  if (sqm >= 19.1) return { class: 6, label: 'Bright suburban sky', description: 'Milky Way barely visible' };
  return { class: 8, label: 'City sky', description: 'Only the brightest stars visible' };
}
```

### Source 5: Air Quality — EPA AirNow (retained from FR-019)
- **Type:** Government API, free
- **URL:** https://docs.airnowapi.org/
- **API Key:** Already in `.env` as `AIRNOW_API_KEY`
- **What it provides:** Real-time AQI, pollutant breakdown, reporting area
- **Accuracy:** High — official monitoring station data
- **Freshness:** Hourly updates
- **Legal Status:** Public domain
- **Cost:** Free
- **Status:** Already implemented in FR-019 (retain as-is)

### Source 6: Water Quality — EPA SDWIS
- **Type:** Government database, free
- **URL:** https://echo.epa.gov/tools/web-services/loading-tool#/SDWA
- **What it provides:** Safe Drinking Water Information System — violations, enforcement actions, treatment techniques per water system
- **Accuracy:** High — official regulatory records
- **Freshness:** Updated as violations are reported/resolved
- **Legal Status:** Public domain
- **Cost:** Free
- **Use:** Look up the water system serving this address, return any violations in the last 5 years

```javascript
// EPA ECHO SDWIS - find violations for water system at coordinates
async function getWaterQualityRecord(lat, lng) {
  // Step 1: Find water system ID via EPA ECHO facility search
  const systemsUrl = `https://echodata.epa.gov/echo/sdw_rest_services.get_facilities` +
    `?output=JSON&p_co_lat=${lat}&p_co_lon=${lng}&p_co_radius=5`;
  
  // Step 2: For the serving water system, fetch violations
  const violationsUrl = `https://echodata.epa.gov/echo/sdw_rest_services.get_qid` +
    `?qid=[system_id]&output=JSON`;
  
  // Return: system name, violation count (last 5 years), most recent violation type/date
}
```

### Source 7: Radon — EPA Radon Zone Map
- **Type:** Government data, free
- **URL:** https://www.epa.gov/radon/epa-map-radon-zones
- **What it provides:** County-level radon zone (1 = highest potential, 3 = lowest)
- **Accuracy:** Medium — county-level, not parcel-level
- **Freshness:** Stable (geological data)
- **Legal Status:** Public domain
- **Cost:** Free
- **Implementation:** Static county-to-zone lookup table from EPA published data
- **Limitation:** Zone 1 counties still have homes with low radon; Zone 3 counties still have homes with high radon. This is a baseline risk indicator, not a definitive measurement.

### Source 8: Industrial/Hazard Proximity — EPA EJSCREEN
- **Type:** Government API, free
- **URL:** https://ejscreen.epa.gov/mapper/ejscreenRESTbroker.aspx
- **What it provides:** Environmental justice indicators including proximity to Superfund sites, RMP facilities (chemical risk), wastewater discharge, hazardous waste, and traffic proximity
- **Accuracy:** High — EPA-compiled from multiple regulatory databases
- **Freshness:** Annual updates
- **Legal Status:** Public domain
- **Cost:** Free
- **Use:** Percentile scores for toxic site proximity and air quality burden vs national average

```javascript
// EPA EJSCREEN API - environmental justice indicators by coordinates
async function getEJScreenData(lat, lng) {
  const url = `https://ejscreen.epa.gov/mapper/ejscreenRESTbroker.aspx` +
    `?namestr=&geometry={"x":${lng},"y":${lat},"spatialReference":{"wkid":4326}}` +
    `&distance=1&unit=9035&areatype=&areaid=&f=pjson`;
  
  // Key fields to surface:
  // PNPL - Superfund proximity percentile
  // PRMP - RMP facility proximity percentile  
  // PWDIS - Wastewater discharge proximity percentile
  // OZONE - Ozone concentration
  // PM25 - PM2.5 concentration
}
```

### Verification Method
Cross-reference: noise levels from BTS should be consistent with distance to highways identified via Google Maps. Flight path exposure from FAA data should correlate with airport distance and direction. Water system violations should be checked against utility company public reports when available.

### If No Reliable Data Exists
Each element degrades independently with explicit fallback text:
- Airport data: if no airports within 20 miles, skip flight path section
- Rail noise: if DNL < 45 dB, describe as "No significant rail noise detected"
- Water quality: if EPA system not found, "Water quality records not available — request Consumer Confidence Report from your utility"
- Radon: always available (county-level lookup table covers all US counties)

---

## Requirements

### Eight Data Points (grouped into three narrative sections)

**Section A: What You'll Hear**
1. Flight path analysis — airports within 20 miles, whether property is under approach/departure path, estimated frequency
2. Road noise — actual modeled DNL in dB(A) from BTS, context (below 55 = acceptable, 55-65 = moderate, 65+ = significant)
3. Rail proximity — distance to nearest rail line, operator, noise DNL, estimated train frequency if available

**Section B: What You'll See at Night**
4. Light pollution — Bortle class and plain-language description

**Section C: What You Can't See**
5. Air quality — AQI and trend (from FR-019, retained)
6. Water quality — EPA water system violations in the last 5 years
7. Radon zone — EPA county classification with mitigation cost context
8. Industrial proximity — EPA EJSCREEN Superfund proximity percentile, RMP facility count within 1 mile

### Report Section
Full chapter card: "Sensory & Environmental" under standard tier.

Organized as three narrative sections (not eight bullet points). Each section has:
- Opening sentence that frames what this means for daily life
- Specific findings with named sources and distances
- Key Takeaway callout for the single most impactful finding

---

## Expected Output Format

```
Sensory & Environmental

What You'll Hear

[FLIGHT PATHS:]
Georgetown, KY sits approximately 22 miles southeast of Cincinnati/Northern Kentucky
International Airport. Based on CVG's runway 36L instrument approach procedure, this
address is not under an active approach path — aircraft making approaches from the
south turn east of this location at approximately 4,000 feet. [OR: This address lies
under the downwind leg of CVG's runway 18R approach, with arriving aircraft passing
overhead at an estimated 2,500 feet during peak periods (6-9am and 4-7pm weekdays).]

[ROAD NOISE:]
The modeled road noise level at this address is [X] dB(A) — [description: below 55 dB
is considered acceptable for residential use by FHWA standards; this is equivalent to
a quiet library at 40 dB or normal conversation at 60 dB]. The nearest significant
road noise source is [road name] [distance] away.

[RAIL:]
[IF applicable:] A CSX freight line runs [distance] from this address. The BTS noise
model shows a DNL of [X] dB from rail traffic at this location. Freight rail schedules
are not fixed — trains may pass at any hour. [IF no rail:] No freight or passenger
rail lines run within a mile of this address.

What You'll See at Night

The sky here is classified as Bortle [X] — a [label] sky. [Description: e.g., "Light
from Georgetown's commercial district to the north reduces star visibility, but the
Milky Way is still visible on clear nights. This is a meaningfully darker sky than
most suburban addresses, but not the dark sky of rural areas."]

What You Can't See

Air quality in this region averages AQI [X] ([category]), measured from the nearest
EPA monitoring station [X] miles away. [Context about primary pollutant if relevant.]

The water here is supplied by [Utility Name]. EPA records show [no violations / X
violations] in the last five years. [If violations: The most recent was a [violation
type] violation in [year], [resolved / still under review].] You can request the
annual Consumer Confidence Report from your utility for full detail.

Scott County is an EPA Radon Zone [1/2/3] county — [1: high potential, 2: moderate
potential, 3: low potential]. Zone [X] means radon testing is [strongly recommended /
recommended / less urgent]. If present, mitigation systems run $800-$2,500 installed.
Testing costs $15-$30 with a DIY kit.

[IF EJSCREEN flags anything:] EPA environmental screening data shows this address is
in the [X]th percentile nationally for proximity to Superfund sites, meaning [context].
[OR: EPA screening data shows no significant industrial or hazardous site proximity
concerns for this location.]

Key Takeaway: [The most impactful single finding from this chapter]

Sources: FAA aeronautical data, BTS National Transportation Noise Map, EPA AirNow,
EPA SDWIS/ECHO, EPA Radon Zone Map, EPA EJSCREEN, NOAA VIIRS. Research date: [date].
```

---

## Migration from FR-019

If FR-019 was already partially implemented:
- Retain the EPA AirNow integration as-is
- Retain the FEMA flood zone integration — move it to Chapter 6 (Climate & Weather Risks)
- Replace the noise estimation algorithm with BTS DNL data
- Add all new sources listed in this spec

The FEMA flood zone data is intentionally moved out of this chapter and into Chapter 6 (FR-007/Climate), where it belongs conceptually. This chapter is about sensory and environmental quality; flood risk is a financial and safety matter better placed with climate risks.

---

## Acceptance Criteria
- [ ] Flight path analysis shown for all airports within 20 miles
- [ ] Properties under active approach/departure paths explicitly identified
- [ ] Road noise shown as modeled DNL value (not estimated from proximity)
- [ ] Rail proximity shown with noise level when rail is within 1 mile
- [ ] Light pollution Bortle class shown with description
- [ ] AQI shown from EPA AirNow (carried from FR-019)
- [ ] EPA water system identified and violation history shown (last 5 years)
- [ ] Radon zone shown with testing recommendation and cost context
- [ ] EPA EJSCREEN Superfund proximity flagged when in top 25th percentile nationally
- [ ] Output is three-section narrative prose, not a data table
- [ ] FEMA flood zone NOT in this chapter (it lives in Chapter 6)
- [ ] Tested with urban (Louisville, KY), suburban (Georgetown, KY), and rural (Harlan, KY)
- [ ] Graceful degradation for each data source independently
- [ ] All sources and research date cited

## Data Quality Requirements
- Road noise must come from BTS modeled data, not distance-based estimation
- Flight path exposure must reference specific airport procedures, not just distance
- Water violation data must include violation type and resolution status — not just count
- Radon zone must be labeled as county-level, not parcel-level
- Never omit the research date on water violation records

## Estimated Effort
**High** — 7-9 hours
- FAA airport proximity + path geometry logic
- BTS GIS service integration (road and rail DNL)
- NOAA VIIRS light pollution tile query
- EPA SDWIS/ECHO water system lookup + violation history
- EPA Radon zone lookup table (static, all US counties)
- EPA EJSCREEN API integration
- Narrative generation across three sections
- Migration/integration of existing FR-019 AirNow implementation
- Testing across urban/suburban/rural addresses
