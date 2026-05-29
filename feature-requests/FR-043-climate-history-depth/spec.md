# FR-043 — Climate & Weather: Full Depth Implementation
*All four depth levels per FR-045 Chapter Depth & Insight Layer*
*May 2026*

---

## What This Builds

Expands the Climate & Weather chapter from its current two-finding Level 2 (FEMA flood zone + static tornado tier) to all four depth levels. Every buyer gets a Glance-level signal in seconds. Buyers who want more get a full historic record, rarity framing, and community preparedness data that cannot be assembled from a 20-minute Google session.

**The question buyers are actually asking:** "What's the actual risk here? Has bad stuff happened? Is this community prepared — and am I?"

**The standard:** A weather-anxious buyer reads this chapter and feels genuinely prepared, not scared. Every risk is paired with rarity context and what the community does about it.

---

## The Four Depth Levels

### Level 1 — Glance (always visible, ~10 seconds)

Compact badge bar at the top of the chapter card. Three signals, never more than two lines.

```
[Zone X ✓]  [Tornado: Low]  Last significant event: Ice storm, 2021 — Scott County
```

- Flood zone badge (existing)
- Tornado tier badge (existing)
- Last significant event: most recent FEMA disaster declaration OR NOAA storm event with property damage > $100K, whichever is more recent. Format: "[event type], [year] — [county]"
- If no significant event in 20 years: "No federally declared disasters in 20 years"

### Level 2 — Overview (default, ~2 minutes)

All existing content, unchanged, plus two additions:

**Add: FEMA disaster declaration count**
"Scott County has received 4 federal disaster declarations since 2000 — all related to severe weather events."
Placed after the flood zone narrative, before the tornado section.

**Add: Watershed upstream context**
One paragraph describing what's uphill and upstream from this address. Scope: topographic position (uphill / midslope / low point of drainage area) and what's upstream (residential, agricultural, or industrial). Data from USGS NED elevation. Flagged as a "Things to Check" item when the address is at the low point of a drainage basin.

### Level 3 — Deep Read (expandable toggle, ~10 minutes)

Triggered by: `[+ See weather history & preparedness]` toggle button.
Pattern: identical to FR-042 garden deep dive. All data pre-fetched — no API calls on toggle open.

**Tab 1: Flood History**
- FEMA disaster declarations: list all flood-related declarations for this county, last 20 years. Date, disaster type, declaration title.
- Significant flood events (NOAA Storm Events): top 3–5 most significant flood events in last 30 years. Date, property damage, context sentence.
- Rarity framing: frequency statement + "the question isn't whether it will happen — it's whether this specific property drains well."
- Action: seller questions to ask about basement/yard flooding not on any inspection checklist.

**Tab 2: Tornado History**
- Events within 25 miles in last 30 years, sorted by distance. Date, EF rating, distance, max winds, injuries/fatalities.
- Frequency analysis: events per decade, compared to statewide average.
- Warning infrastructure: average NWS lead time for this county vs national average (13 min vs 8 min national). Number of county sirens if available.
- Basement question (conditional — see Basement Detection below).
- Nearest public storm shelter: name, address, distance. Source: FEMA shelter database with county emergency management fallback.
- Action: emergency alert registration link for this county.

**Tab 3: Winter Weather**
- Average winter profile: annual snowfall, ice storm frequency (minor / significant), days below 32°F, record single snowfall from 30-year normals.
- Significant winter events (last 20 years): list of major ice storms and blizzards with outage data if available.
- Rarity frame: "the 2021 ice storm was described as once-in-a-generation — comparable event before that was 2003."
- Road priority context (conditional on address road type): primary arterial / secondary / residential — clearing timeline for each.
- Utility storm preparation: average outage duration for this utility territory from NERC data.
- Three actions: emergency alert registration, road priority lookup, 72-hour kit.

**Tab 4: Heat & Drought**
- Average heat profile: days above 90°F, 95°F, 100°F; heat index peak; trend direction since 1980. From NOAA 30-year normals.
- Drought history: drought frequency from NOAA data. Severity context.
- Well water note (conditional on property type): appears only for addresses with well water. Drought impact on well levels if drought data available.
- Garden implications: heat-day count translated to practical advice (deep watering, mulch, heat-tolerant varieties).
- Two actions: HVAC service reminder, cooling assistance programs.

**Tab 5: Community Preparedness**
- Emergency management: county name, alert system name, registration URL. From EMERGENCY_NOTIFICATION_SYSTEMS table (see below).
- Storm shelters: nearest 3 public shelters with name, address, distance. FEMA shelter database.
- Road maintenance: county road department contact, priority system explanation, this address's tier.
- Utility emergency contacts: electric, gas, water providers with outage/emergency numbers.
- 72-hour kit: risk-specific checklist tailored to this address's top 2–3 hazards.

**Tab 6: Seasonal Risk Calendar**
Month-by-month risk awareness. Each month combines: average conditions from climate normals, historical event frequency from NOAA Storm Events, and one action. Not generic — driven by actual event data for this county. Examples: "February: the county's 2 most costly ice storms in 30 years both occurred in February (2003, 2021). Full winter kit essential."

### Level 4 — Research (second expandable toggle, unlimited)

Triggered by: `[+ Full climate data tables]` toggle button.

- **Complete storm event log:** Every NOAA Storm Events record for this county, 30 years, all types. Columns: date, event type, magnitude, deaths, injuries, property damage ($), crop damage ($). Sortable.
- **Full FEMA declaration history:** All declarations, all disaster types, last 20 years. Not filtered to weather-only.
- **Monthly 30-year climate normals:** Table — all 12 months × [high temp, low temp, mean temp, precipitation, snowfall, snow depth]. Source and station name.
- **Annual summary:** Days above 90°F, days below 32°F, first/last frost probability by date (not just average — probability curve), annual precipitation vs historical average.

---

## Data Sources

### Existing (reuse unchanged)
- FEMA Flood Map Service Center — flood zone at parcel level (already fetched in `getEnvironmentalData()`)
- Static tornado tier lookup by state in `constants.js` — keep for now

### New

**NOAA Storm Events**
- Source: NCEI Storm Events Database — `https://www.ncdc.noaa.gov/stormevents/`
- Programmatic access: NCEI CSV bulk download endpoint — `https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/`
- **Data acquisition risk:** No clean REST API exists for Storm Events. Options in priority order:
  1. NCEI CSV download per year per state, cached at report time (preferred — deterministic, no rate limits)
  2. NOAA CDO API with `dataset=GHCND` — returns some storm data but incomplete for narrative events
  3. Manual data enrichment for the 5 test counties as a fallback
- Auth for CDO: `NOAA_CDO_API_KEY` header — see `.env.example` requirement below
- Event types to fetch: tornado, flash flood, flood, winter storm, ice storm, blizzard, excessive heat, drought
- Fields needed: begin_date, event_type, magnitude, magnitude_type, deaths_direct, injuries_direct, damage_property, begin_lat, begin_lon, end_lat, end_lon
- **Implementation decision:** The exact API strategy (CSV vs CDO) must be validated during Phase 1 Discovery of the implementation plan before committing to an approach.

**FEMA OpenFEMA Disaster Declarations**
- Endpoint: `https://www.fema.gov/api/open/v2/disasterDeclarations`
- No API key required
- Filter: `?stateCode=[state]&countyCode=[county]&declarationDate=gt:[20 years ago]`
- Fields: declarationDate, disasterType, declarationTitle, incidentType
- Used for: Overview declaration count, Level 3 Flood History tab, Level 4 full history

**NOAA CDO Climate Normals**
- Endpoint: `https://www.ncdc.noaa.gov/cdo-web/api/v2/data`
- Same key as Storm Events
- Dataset: NORMAL_MLY (monthly normals), NORMAL_ANN (annual normals)
- Station: nearest GHCND station to this address (from existing station-lookup pattern)
- Fields: monthly temp highs/lows, precipitation, snowfall; annual HDD, CDD, heat days
- Used for: Level 3 heat/drought tab, winter tab, seasonal calendar, Level 4 normals table

**USGS Elevation (watershed context)**
- Endpoint: `https://epqs.nationalmap.gov/v1/json?x=[lng]&y=[lat]&units=Feet&wkid=4326`
- No key required
- Used for: Level 2 watershed context — elevation at address + 4 cardinal-direction points (0.25 miles N/S/E/W) to determine topographic position
- **Approximation note:** This is a simplified topographic position heuristic, not a true watershed delineation. Full watershed analysis (USGS StreamStats) requires a separate API and is out of scope for this FR. The 5-point elevation sampling is sufficient for the "is this address at a low point?" determination we need.

---

## Architecture

### New data function

Add `getClimateHistoryData(lat, lng, locationInfo, constructionEra)` to `src/chapters.js`.

Runs in parallel with existing data fetching. Returns:

```js
{
  stormEvents: {
    tornadoes: [],    // events within 25 miles, last 30 years
    floods: [],       // county-level, last 30 years
    winterStorms: [], // county-level, last 20 years
    heatEvents: [],   // county-level, last 20 years
    allEvents: [],    // complete log for Research level
  },
  femaDeclarations: {
    weatherRelated: [],  // filtered to weather types
    all: [],             // complete for Research level
    count: 0,            // for Overview sentence
  },
  climateNormals: {
    monthly: [],         // 12 rows × temp/precip/snow
    annual: {
      daysAbove90: null,
      daysAbove95: null,
      daysBelow32: null,
      annualPrecip: null,
      annualSnowfall: null,
    },
    stationName: '',
    stationDistance: null,
  },
  glance: {
    lastSignificantEvent: null, // { type, year, county } or null
  },
  preparedness: {
    emergencySystem: null,  // from EMERGENCY_NOTIFICATION_SYSTEMS table
    roadPriority: null,     // 'primary' | 'secondary' | 'residential' | null
  },
  watershed: {
    topographicPosition: null, // 'uphill' | 'midslope' | 'lowpoint'
    upstreamContext: null,     // narrative string
  },
  basementContext: null, // narrative string, from logic layer
}
```

### Template changes

`buildClimateChapterHTML(environment, climateHistory, locationInfo)` in `src/templates/chapters/climate.js`

- `environment` parameter unchanged (existing flood + sensory data)
- `climateHistory` is the new object above — nullable; chapter gracefully degrades if null

### Files affected

| File | Change |
|---|---|
| `src/chapters.js` | Add `getClimateHistoryData()` + helper functions |
| `src/templates/chapters/climate.js` | Add Glance bar, Overview additions, Level 3 toggle + tabs, Level 4 toggle + tables |
| `src/utils/constants.js` | NOAA API constants, EMERGENCY_NOTIFICATION_SYSTEMS table, ROAD_PRIORITY_TYPES |
| `public/report.css` | Climate tab styles (scoped `.climate-` prefix), research table styles |
| `public/ui.js` | `initClimateDeepDive()` — toggle + tab switching, identical pattern to `initGardenDeepDive()` |
| `.env.example` | `NOAA_CDO_API_KEY` entry with comment |
| `tests/chapters/climate-data.test.js` | New — unit tests for data functions |
| `tests/templates/chapters/climate.test.js` | New — template output tests |

---

## Special Requirements

### .env.example — NOAA_CDO_API_KEY

Add the following entry to `.env.example`:

```
# NOAA Climate Data Online (CDO) API key
# Required for Climate chapter Deep Read and Research levels (storm events, climate normals)
# Free registration: https://www.ncdc.noaa.gov/cdo-web/token
# Rate limit: 5 requests/second, 10,000 requests/day
NOAA_CDO_API_KEY=your_key_here
```

If `NOAA_CDO_API_KEY` is not set, `getClimateHistoryData()` returns null and the chapter renders Level 2 only (existing behavior). This is graceful degradation per CONSTRAINT-015, not a fatal error.

---

### Emergency Notification System Lookup Table

**Initial scope: Kentucky counties only.**

Structure in `src/utils/constants.js`:

```js
// Key format: '[STATE]-[COUNTY_FIPS_3]'
// State coverage: KY complete. Expand one full state at a time — no partial coverage.
const EMERGENCY_NOTIFICATION_SYSTEMS = new Map([
  ['KY-017', { name: 'AlertScott', url: 'https://www.scottcounty.org/emergency', vendor: 'CodeRED' }],
  ['KY-067', { name: 'Fayette County Emergency Management', url: 'https://www.lexingtonky.gov/emergency', vendor: 'Everbridge' }],
  ['KY-111', { name: 'Jefferson County Emergency Management', url: 'https://www.louisvilleky.gov/government/emergency-management', vendor: 'CodeRED' }],
  // ... all 120 KY counties
]);
```

**Fallback for non-KY addresses:**
```js
{
  name: 'Wireless Emergency Alerts',
  url: 'https://www.fema.gov/emergency-managers/practitioners/wireless-emergency-alerts',
  vendor: 'Federal',
  note: 'County-specific alert system data not yet available for this state. WEA alerts are automatic — no registration needed. Check your county emergency management website for local systems.'
}
```

**Expansion plan:** Add states as complete batches in this priority order:
1. Indiana — covers Jeffersonville IN test address (PM-001 regression case, CONSTRAINT-006)
2. Montana — covers Bozeman MT test address
3. Tennessee, Ohio, Virginia — adjacent to existing KY coverage
4. All remaining states by population

No partial state coverage. When a state is added, all counties in that state must be in the table.

---

### Basement Detection & CONSTRAINT-007 (Rural Mode)

**Location:** Basement detection logic lives in `src/shared/validate.js` per CONSTRAINT-014 — not in the template or data layer.

**Standard (non-rural) inference by construction era and region:**
- Pre-1980, KY/IN/OH/TN: "Homes of this era in this region frequently have full basements — verify with the seller before assuming storm shelter availability."
- 1980–2000, KY/IN: "Homes of this era vary significantly — some have basements, many are slab. Confirm with seller before your inspection."
- Post-2000, KY/IN: "Most homes built after 2000 in central Kentucky and southern Indiana are slab construction without basements. If confirmed, identify your interior storm shelter plan before move-in."
- Western states (MT, CO, WY, ID): "Basement prevalence in this region varies by lot topography and builder practice — verify directly."

**CONSTRAINT-007 override — Rural and Remote mode:**
When `validate.js` classifies the address as `rural` or `remote`, the era-based inference does NOT apply. Rural Appalachian Kentucky (e.g., Harlan KY) has high basement prevalence across all eras due to hillside construction. Rural western US (Bozeman MT area) has different patterns entirely.

Rural mode output:
```
"Construction patterns in rural areas vary significantly based on topography and local building practice — era-based generalizations are less reliable here. Ask the seller directly and have your inspector specifically assess foundation type and basement availability as a tornado shelter."
```

The rural mode flag is already available from `validate.js`. Basement detection reads it before applying era-based inference.

---

## Processing Logic

### Last significant event (Glance)
1. Get most recent FEMA declaration (any weather type) within 20 years
2. Get most recent NOAA event with property damage > $100,000 within 20 years
3. Return whichever is more recent
4. If neither: return null → Glance shows "No federally declared disasters in 20 years"
5. Format: `{ type: 'Ice storm', year: 2021, county: 'Scott County' }`

### Rarity framing
Computed from NOAA Storm Events, not static copy:
- Tornado rarity: `count(events within 25 miles, 30 years)` → "X events in 30 years — roughly 1 per decade"
- Flood rarity: `count(events in county, 30 years)` → "significant flooding in X of the last 30 years"
- If zero events: "No recorded [type] events in this county in 30 years" — this is notable and worth saying

### Watershed topographic position
Query USGS elevation at address + 4 points 0.25 miles N/S/E/W. If address elevation is lower than 3 of 4 surrounding points → `lowpoint`. If higher than 3 of 4 → `uphill`. Otherwise → `midslope`.
- Lowpoint + flood history → "Things to Check" action item
- Uphill → reassuring note ("This address sits above surrounding terrain — stormwater drains away from rather than toward this parcel")

### Seasonal risk calendar generation
For each month:
1. Get all NOAA events in that month across all years for this county
2. Count event frequency by type
3. Identify most recent or most destructive event in that month
4. Combine with climate normals for temperature/precipitation context
5. One action per month drawn from the chapter's action item bank

### Road priority classification
Based on address road type from Google reverse geocoding result (already available):
- `route` type with state/US highway prefix → primary
- `route` type with county road → secondary  
- `street_address` / residential street → residential
- Unknown → null (renders county contact instead)

---

## Coherence Checks (CONSTRAINT-010 / CONSTRAINT-014)

All coherence checks live in `src/shared/validate.js`:
- If rural mode active → suppress era-based basement inference (use rural variant)
- If no NOAA_CDO_API_KEY → return null for climateHistory, chapter renders Level 2 only
- If storm events API returns zero results → distinguish "no events" from "API failed" — log the difference
- If FEMA declarations API fails → degrade gracefully, Overview omits declaration count sentence

---

## Test Requirements (CONSTRAINT-011)

`tests/chapters/climate-data.test.js`:
- `getLastSignificantEvent()` — prefers more recent of FEMA vs NOAA, returns null when none
- `computeRarityStatement(events, years)` — correct per-decade framing
- `classifyTopographicPosition(elevations)` — lowpoint/midslope/uphill from 5-point array
- `getBasementContext(constructionEra, state, ruralMode)` — rural mode suppresses era inference
- `getRoadPriority(addressComponents)` — correct classification for primary/secondary/residential
- `getEmergencySystem(stateFips, countyFips)` — KY returns named system, non-KY returns fallback

`tests/templates/chapters/climate.test.js`:
- Glance bar renders for all 3 flood risk levels (green/gold/red)
- Overview declaration count sentence appears when count > 0, absent when 0
- Deep Read toggle button present when `climateHistory` is non-null
- Research toggle button present when `climateHistory.stormEvents.allEvents.length > 0`
- Tornado basement note uses rural variant when `ruralMode = true`
- CONSTRAINT-001: no scoring CSS classes
- CONSTRAINT-008: no inline styles
- All 5 test address fixture objects render without throwing

---

## Acceptance Criteria

- [ ] Glance level renders on every address — flood badge + tornado tier + last event
- [ ] "No federally declared disasters in 20 years" renders correctly for quiet addresses
- [ ] Overview adds FEMA declaration count sentence when count > 0
- [ ] Watershed context paragraph appears in Overview
- [ ] Deep Read toggle opens 6-tab interface; all tabs loaded from pre-fetched data (no API calls on open)
- [ ] Research toggle shows complete storm event table and monthly normals table
- [ ] `NOAA_CDO_API_KEY` documented in `.env.example` with registration URL
- [ ] If `NOAA_CDO_API_KEY` missing: chapter renders Level 2 only, no errors thrown
- [ ] `EMERGENCY_NOTIFICATION_SYSTEMS` table covers all 120 KY counties (researched and populated during implementation)
- [ ] Non-KY addresses render fallback emergency system note
- [ ] Basement detection: rural mode (Harlan KY) uses rural variant copy, not era-based inference
- [ ] Rarity framing present in both Flood and Tornado tabs, computed from actual event counts
- [ ] Seasonal calendar uses actual NOAA event data for this county, not generic copy
- [ ] Georgetown KY: Scott County declarations, era-based basement note (suburban, post-2000 likely slab), KY alert system
- [ ] Harlan KY: rural mode active, rural basement variant, Appalachian weather context (higher elevation), KY alert system
- [ ] Louisville KY: urban mode, Jefferson County system, higher flood event frequency expected
- [ ] Bozeman MT: fallback emergency system, MT-specific weather patterns (cold, low tornado risk)
- [ ] Jeffersonville IN: fallback emergency system (IN not yet in table), cross-state note (CONSTRAINT-006)
- [ ] Zero new Google API calls
- [ ] All new tests pass; no regressions in existing test suite

---

## Module

`src/templates/chapters/climate.js` — extends existing template  
`src/chapters.js` — adds `getClimateHistoryData()` and helpers  
`src/shared/validate.js` — adds basement detection and road priority helpers  
`src/utils/constants.js` — adds NOAA constants, EMERGENCY_NOTIFICATION_SYSTEMS, ROAD_PRIORITY_TYPES

## Chapter Color

Storm blue-grey (`#3d5a7a`) — unchanged

## Relationship to Other FRs

- **FR-045** — this FR implements Climate's four levels per the master depth spec
- **FR-034 Enhancement 6** — watershed upstream context is implemented here as the Level 2 addition
- **FR-042** — pattern reference for Level 3 tab interface (CSS classes use `.climate-` prefix to avoid conflicts)
- **FR-032** — utility outage data reused in Level 3 Preparedness tab (same approach as originally spec'd in FR-043)

## Dependencies

- CONSTRAINT-007 (rural mode detection in `validate.js`) — already implemented ✅
- CONSTRAINT-014 (coherence logic in `validate.js`) — already implemented ✅
- CONSTRAINT-015 (graceful degradation) — NOAA key absence handled ✅ (by design)
- FR-042 tab CSS/JS pattern — already in codebase ✅
