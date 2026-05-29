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

**NOAA Storm Events — three-tier strategy**

Tier 1 (primary): NOAA CDO API
- Endpoint: `https://www.ncdc.noaa.gov/cdo-web/api/v2/data`
- Auth: `NOAA_CDO_API_KEY` header — see `.env.example` requirement below
- Dataset: `GHCND` for climate normals; storm event data via the same CDO token
- Parameters: county FIPS, date range 30 years, event type filters
- Event types: tornado, flash flood, flood, winter storm, ice storm, blizzard, excessive heat, drought
- Fields needed: begin_date, event_type, magnitude, magnitude_type, deaths_direct, injuries_direct, damage_property, begin_lat, begin_lon, end_lat, end_lon
- Rate limit: 5 requests/second, 10,000 requests/day — well within per-report budget

Tier 2 (fallback): Pre-cached CSV for 5 test counties
- Location: `data/noaa-storm-events/[state-fips]-[county-fips].json`
- Content: pre-processed storm events for the 5 test addresses (Scott KY, Harlan KY, Jefferson KY, Gallatin MT, Clark IN)
- Format: same shape as CDO API response so the same processing functions handle both
- Updated: manually refreshed as needed — not auto-updated at runtime
- Used when: CDO API key missing, CDO API rate-limited, or CDO API returns error

Tier 3 (graceful degradation): Direct NOAA link
- When both Tier 1 and Tier 2 unavailable, render a "Things to Check" action item:
  "Review historic storm events for this county at ncdc.noaa.gov/stormevents — filter by county and last 30 years."
- Chapter still renders Level 2 content. No error state shown to buyer.

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
- **Approximation note:** This is a simplified topographic position heuristic, not a true watershed delineation. The 5-point elevation sampling is sufficient for the "is this address at a low point?" determination we need.
- **Future enhancement:** Full watershed delineation via USGS StreamStats API (`https://streamstats.usgs.gov/streamstatsservices/`) would provide drainage area boundaries and upstream land use. Out of scope for this FR — document as a named future enhancement in the summary when this FR ships.

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
    emergencySystem: null,  // { tier, name, url, searchUrl, note } — always non-null if state available
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
| `src/utils/constants.js` | NOAA API constants, STATE_ALERT_SYSTEMS (~50 entries), ROAD_PRIORITY_TYPES |
| `data/noaa-storm-events/` | New directory — pre-cached JSON for 5 test counties (Tier 2 fallback) |
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

### Emergency Notification System — Two-Tier Dynamic Approach

No per-county hardcoding. Works for any US address without maintenance. Never a dead end.

**Tier 1: State-level unified systems (~50 entries)**

Most states operate a unified statewide emergency alert system. A single static lookup keyed by state abbreviation covers the majority of US addresses with a registration URL that never needs county-level maintenance.

Structure in `src/utils/constants.js`:

```js
// ~50 entries — one per state that has a unified statewide system.
// States without a unified system are absent from this map (handled by Tier 2).
const STATE_ALERT_SYSTEMS = new Map([
  ['KY', { name: 'KYEM Alert', url: 'https://kyem.ky.gov/alert', vendor: 'Rave' }],
  ['MT', { name: 'MT Alert', url: 'https://mtalert.mt.gov', vendor: 'Rave' }],
  ['TX', { name: 'TxAlert', url: 'https://txalert.gov', vendor: 'Rave' }],
  ['IN', { name: 'IN-Alert', url: 'https://in.gov/dhs/in-alert', vendor: 'Rave' }],
  // ... remaining states with unified systems
]);
```

Lookup: `STATE_ALERT_SYSTEMS.get(state)` → returns system or undefined.

**Tier 2: Dynamic county fallback (for states without a unified system)**

When a state is not in `STATE_ALERT_SYSTEMS`, generate two things dynamically — no hardcoded data required:

1. **County emergency management URL** — constructed from standard URL patterns:
```js
function buildCountyEmergencyUrl(county, state) {
  const slug = county.toLowerCase().replace(/\s+county$/i, '').replace(/\s+/g, '');
  // Patterns tried in order, first successful one returned
  // Pattern A: [county][state].gov (e.g., scottky.gov)
  // Pattern B: [county]county[state].gov
  // Pattern C: [state].[county]county.gov
  // These are candidate URLs generated for display, not verified at runtime.
  // The template renders the most likely pattern with a note to verify.
}
```

2. **Pre-built Google search URL:**
```js
`https://www.google.com/search?q=${encodeURIComponent(`${county} ${state} emergency alert registration`)}`
```

Rendered output (Tier 2):
```
Emergency alerts for [County] are managed locally.
→ Try: [county][state].gov/emergency  (verify this URL)
→ Or search: "[County] [State] emergency alert registration"
```

**Result object shape** (same for both tiers, template handles both):

```js
{
  tier: 1,               // or 2
  name: 'KYEM Alert',    // null for tier 2
  url: 'https://...',    // registration URL (tier 1) or candidate URL (tier 2)
  searchUrl: '...',      // always populated — Google search fallback
  note: null,            // populated for tier 2 with verification guidance
}
```

**Why this works:** Tier 1 covers ~35–40 states that operate unified systems (the majority of US homebuyers). Tier 2 covers the remaining states with a self-serve path that doesn't require Livably to maintain county-level data. The buyer always has a next step.

---

### Basement Detection & CONSTRAINT-007 (Rural Mode)

**Location:** Basement detection logic lives in `src/shared/validate.js` per CONSTRAINT-014 — not in the template or data layer.

**Standard (non-rural) inference by construction era and region:**
- Pre-1980, KY/IN/OH/TN: "Homes of this era in this region frequently have full basements — verify with the seller before assuming storm shelter availability."
- 1980–2000, KY/IN: "Homes of this era vary significantly — some have basements, many are slab. Confirm with seller before your inspection."
- Post-2000, KY/IN: "Most homes built after 2000 in central Kentucky and southern Indiana are slab construction without basements. If confirmed, identify your interior storm shelter plan before move-in."
- Western states (MT, CO, WY, ID): "Basement prevalence in this region varies by lot topography and builder practice — verify directly."

**CONSTRAINT-007 override — Rural and Remote mode:**
When `validate.js` classifies the address as `rural` or `remote`, era-based inference is replaced with a region-aware rural assessment. The key insight: rural construction patterns can run opposite to suburban patterns.

Region-aware rural logic (checked before era-based rules):

- **Rural Appalachian KY/WV/TN/VA** (e.g., Harlan KY): Hillside construction means high basement prevalence across ALL eras, including post-2000. Output: "Hillside construction in this region makes basements common regardless of build year — verify with the seller. Appalachian homes often have full walk-out basements that double as effective storm shelters."
- **Rural Great Plains / Tornado Alley** (KS, NE, OK, northern TX): Storm shelter culture means basement or dedicated underground shelter is common even in newer construction. Output: "Storm shelter culture in this region means most rural homes have a basement or dedicated underground shelter regardless of build year — verify with the seller."
- **Rural Western US** (MT, CO, WY, ID, NM): Variable based on elevation and lot topography — no reliable era-based or region-based inference. Output: "Foundation types in rural western properties vary significantly with lot topography and local practice — verify foundation type and any shelter options directly with the seller."
- **Rural Midwest / Upper South** (general): Higher basement prevalence than urban/suburban equivalents in the same era, particularly pre-2000. Output: "Rural homes in this region often have full basements regardless of era — more common than suburban construction of the same period. Verify with seller."

The region classification uses the address state and rural mode flag — both already available in `validate.js`. No new data required.

The rural mode flag is already available from `validate.js`. Basement detection reads it before applying era-based inference, then selects the appropriate regional variant.

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
- `getEmergencySystem(state, county)` — KY returns Tier 1 with KYEM Alert, state without unified system returns Tier 2 with dynamic URL + search URL, both tiers always populate searchUrl

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
- [ ] `STATE_ALERT_SYSTEMS` covers KY, MT, IN, TX and at least 30 additional states
- [ ] Tier 1 path: KY address shows "KYEM Alert" with kyem.ky.gov/alert registration URL
- [ ] Tier 2 path: address in state without unified system shows dynamic county URL candidate + Google search link
- [ ] Both tiers always render a search URL — no dead ends
- [ ] Basement detection: Harlan KY (rural Appalachian) uses hillside/Appalachian variant, not era-based inference
- [ ] Basement detection: Georgetown KY (suburban) uses standard era-based inference
- [ ] Basement detection: Bozeman MT (rural western) uses western rural variant
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
