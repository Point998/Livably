# FR-044 — Chapter Depth & Insight Layer
*The master depth specification for every Livably chapter*
*May 2026*

---

## The Vision

Livably is not another Wikipedia file on a location. It is the most comprehensive, trusted source of address-level intelligence available to a homebuyer. Every chapter should feel like it was built by a domain expert who spent weeks researching this specific address — not assembled from a few API calls.

The depth spectrum makes this possible without overwhelming anyone. A buyer skimming before a showing gets what they need in 10 seconds. A serious gardener can spend 45 minutes in What Will Grow Here and still find something new. Both experiences are valid. Both are Livably.

---

## The Four Depth Levels

### Level 1 — Glance (always visible, 10 seconds)
The single most important finding from this chapter. One badge, one number, one sentence. Non-negotiable — always shown regardless of what level the buyer has selected.

Design: Compact summary bar at the top of each chapter card. Never more than 2 lines. The finding that would make a buyer stop scrolling.

### Level 2 — Overview (default, 2 minutes)
The current report content plus immediate improvements from the Narrative Quality Audit (docs/NARRATIVE-QUALITY-AUDIT.md). Warm narrative, key findings, action items. What a buyer reads on a first pass.

Design: Expanded chapter card. Current layout. This is what buyers see when they first open a chapter.

### Level 3 — Deep Read (opt-in, 10 minutes)
Tabbed sections with full data sets. The buyer who wants to understand everything. No raw data tables — still narrative-driven but comprehensive. The FR-042/FR-043 pattern applied to every chapter.

Design: Tabbed interface within the chapter. Each tab is a focused section. Buyer navigates between tabs. Content is still warm and readable — not a data dump.

### Level 4 — Research (opt-in, unlimited)
Complete data. Full tables. Every data point pulled from every API. Source citations. Methodology notes. Raw observation counts. The buyer who is a gardener, scientist, or meticulous planner. The person who will spend 2 hours here.

Design: Data tables, full species lists, complete event logs, probability curves. Clinical but organized. Sortable. Downloadable as CSV eventually.

---

## The Per-Chapter Depth Slider

Each chapter has its own independent depth control. A buyer sets What Will Grow Here to Research while keeping Property Costs at Overview. The setting persists for the session.

```
WHAT WILL GROW HERE                              [🌱 Deep Read ▼]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HEALTH & SAFETY                                  [Overview ▼]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

The dropdown shows: Glance / Overview / Deep Read / Research

Default for all chapters: Overview

The slider position is stored in sessionStorage — persists within a session, resets on new report.

A "Set all chapters to Research" option at the top of the report for power users.

---

## Chapter-by-Chapter Depth Specification

---

### CHAPTER: Health & Safety

**The question buyers are actually asking:**
"If something goes wrong at 2am, what happens? How fast? Is this a place where I can get real help quickly?"

**Glance:**
ER drive time + Excellent/Good/Fair fire badge

**Overview (current + improvements):**
- ER narrative with "faster than X% of US addresses" percentile
- Fire + police response with colored badges
- Hospital designation: Level 1 Trauma vs Level 2 vs Community — MISSING, add now
- ISO PPC explanation with specific premium savings ($400-$800/year difference)
- 3 action items

**Deep Read:**
- Primary care physicians accepting new patients within 15 min (CMS NPI data)
- Specialists within 30 min by category (oncology, cardiology, pediatrics)
- Hospital quality ratings from CMS (mortality rates, patient satisfaction scores)
- Air ambulance coverage — nearest helipad and transport time to Level 1
- Historical ambulance response data if available from county

**Research:**
- Complete physician directory within 30 miles by specialty, accepting status
- Full hospital capability data — beds, specialties, accreditations
- Complete fire station coverage map with response time rings
- ISO PPC lookup methodology specific to this state
- CMS hospital compare full data export for nearest facilities

**Additional data to fetch:**
- CMS Provider of Services: hospital trauma designation
- CMS NPI Registry: physician directory
- HRSA: health professional shortage area status

---

### CHAPTER: What Daily Life Looks Like Here

**The question buyers are actually asking:**
"What does Tuesday morning actually feel like? Is this a place where daily life is easy or a grind?"

**Glance:**
"Daily errands take ~28 min/week here" (vs national average of 47 min)

**Overview (current + improvements):**
- Current narrative stays
- Add: annual time savings vs national average
- Add: highway connections — not just "I-75 is 10 min" but "Lexington 22 min, Cincinnati 78 min, Louisville 68 min"
- Remove: gas station (fails the 30-minute test completely)

**Deep Read:**
- Life at This Address Calculator (FR-033) — weekly mileage by lifestyle profile
- Remote Worker / Office Commuter / Family with Kids profiles
- Annual cost breakdown (IRS rate, gas cost, EV equivalent)
- EV charging nearby with monthly cost estimate

**Research:**
- Full drive time matrix — every destination at every time slot
- Complete employer directory within 45 min with employee counts
- Airport directory within 60 miles with airline service
- Full transit options if applicable

**Additional data to fetch:**
- Bureau of Labor Statistics: major employers by county
- FR-033 calculator uses existing drive time data — no new APIs needed

---

### CHAPTER: Daily Reachability

**The question buyers are actually asking:**
"Where exactly am I going every week and how long does it actually take?"

**Glance:**
Top 3: Grocery X min · Hospital X min · Highway X min

**Overview (current + improvements):**
- Remove gas station entirely
- Add civic infrastructure: library, community center, post office (FR-034 Enhancement 4)
- Add percentile context to hospital: "faster than X% of US addresses"
- Keep top 3 groceries, pharmacy, hospital, urgent care, highway, school

**Deep Read:**
- Complete destination grid — every category, all options within 20 min
- Coffee, parks, fitness, dining within reasonable distance
- Drive time at multiple times of day for each destination
- Walking distance destinations sub-list

**Research:**
- Complete drive time matrix — every destination at 8am/12pm/5pm/10am Saturday
- Full grocery comparison: all stores within 20 miles, hours, departments, ratings
- Complete pharmacy directory with 24-hour availability flags
- All hospitals within 60 miles with trauma designations
- All urgent care within 30 miles with hours

**Additional data to fetch:**
- Google Places: civic infrastructure types (library, community_center, post_office)
- Already have most data — Research level surfaces what we fetch but don't show

---

### CHAPTER: Traffic Patterns

**The question buyers are actually asking:**
"If I commute, what's the realistic worst case? Is rush hour real here?"

**Glance:**
"No meaningful rush hour" OR "Peak adds X min to your commute"

**Overview (current + improvements):**
- Add: nearest major employer commute (Toyota plant for Georgetown)
- Add: explicit "no rush hour" callout when range is flat
- Add: "worst case is X min — plan your commute around that number"

**Deep Read:**
- Commute to top 3 employment centers at all time slots
- Day-of-week variation (Monday vs Friday vs Saturday)
- Seasonal variation note if applicable

**Research:**
- Complete drive time matrix for all daily destinations at all time slots
- Historical traffic trend — is congestion getting worse?
- Construction/road project impact on drive times

**Additional data to fetch:**
- BLS QCEW: major employers by county (already pulling Census data)
- Google Distance Matrix: additional time slots if needed

---

### CHAPTER: Schools & Education

**The question buyers are actually asking:**
"Is this actually a good school? Will my kid be okay here? What am I not being told?"

**Glance:**
"Assigned school requires verification" warning + nearest school drive time

**Overview (current + improvements):**
- Keep all current content — it's strong
- Add: enrollment trend (growing/stable/declining) from NCES
- Add: district financial health indicator
- Add: boundary change history — have boundaries changed in 5 years?

**Deep Read:**
- Full school profile: enrollment, grades, student/teacher ratio
- Extracurricular programs available
- After-school care availability and cost range
- Special education services
- Private school profiles within 10 miles with tuition ranges
- Charter school lottery information

**Research:**
- Complete district financial data: per-pupil spending, reserve levels, bond status
- 10-year enrollment trend by individual school
- Teacher tenure averages
- AP course availability and pass rates
- Complete private school directory within 25 miles
- School boundary map data

**Additional data to fetch:**
- NCES: enrollment trends, per-pupil spending
- State dept of education: boundary stability, financial health

---

### CHAPTER: Safety & Emergency Response

**The question buyers are actually asking:**
"Is this a safe area? What does the data actually show?"

**Glance:**
Police response badge + Fire response badge

**Overview (current + improvements):**
- Keep current content
- Replace "search crime map" action with actual data or remove it
- Add: ISO premium savings specific dollar range
- Add: community resource officer contact for this precinct

**Deep Read:**
- Call type distribution from police open data (welfare checks vs incidents)
- Neighborhood watch active status verification
- Historical incident trend — improving or worsening?
- ISO PPC rating implications table (rating 1-10 with typical premium impact)

**Research:**
- Complete call log data by type if available from open data
- Full ISO PPC methodology explanation
- Fire station equipment inventory (engine, ladder, rescue)
- Complete coverage map with response time rings

**Additional data to fetch:**
- Police department open data APIs (vary by city/county)
- NFPA: fire station equipment data where available

---

### CHAPTER: Demographics & Community

**The question buyers are actually asking:**
"What kind of place is this? Is it stable? Is it changing? Will I fit in?"

**Glance:**
Owner-occupancy % + median tenure + income vs national median badge

**Overview (current + improvements):**
- Add: 10-year ownership trend direction (up/down/stable)
- Add: rental vs owner trend
- Deepen tenure insight — 13 years is remarkable, explain why
- Keep all current content

**Deep Read:**
- Population trend: 2010 → 2020 → current estimate direction
- Household formation trend — growing or shrinking households?
- Age trend — is the area getting younger or older?
- Income trend — median income direction over 10 years

**Research:**
- Full Census tract data tables — every ACS variable available
- 10-year comparison: 2010 vs 2015 vs 2020 for all key metrics
- Commute pattern data — where do residents work?
- Housing cost burden data — what % of residents are cost-burdened?

**Additional data to fetch:**
- Census decennial 2010: for 10-year comparison
- ACS additional tables: commute patterns, cost burden

---

### CHAPTER: Growth & Development

**The question buyers are actually asking:**
"Is this area getting better or worse? What's coming that I should know about?"

**Glance:**
Named confirmed projects (Publix, Target) OR "No confirmed projects within 1 mile"

**Overview (current + improvements):**
- Lead with named projects more prominently — they're the star
- Remove or reduce commercial landscape list (fails 30-minute test)
- Add: 10-Year Horizon summary (population direction, school enrollment)

**Deep Read:**
- Full development project timeline — all confirmed projects with dates
- Zoning change history — what's been rezoned in last 5 years?
- Commercial vacancy context — active vs empty storefronts
- Infrastructure investment — planned road/utility projects

**Research:**
- Complete permit data from county if available
- Full zoning map context for surrounding parcels
- Historical commercial development timeline
- Population projection data

**Additional data to fetch:**
- Census population projections
- County planning department data (manual verification required)

---

### CHAPTER: Climate & Weather Risks

**The question buyers are actually asking:**
"What's the actual risk here? Has bad stuff happened? Is this community prepared?"

**Glance:**
Flood zone badge + Last significant event + Tornado tier

**Overview (current + improvements):**
- Keep all current content — it's strong (4/5)
- Add: FEMA disaster declaration count
- Add: watershed upstream context (FR-034 Enhancement 6)

**Deep Read (FR-043):**
- Flood History tab: FEMA declarations + NOAA storm events
- Tornado History tab: events within 25 miles, EF ratings, distances
- Winter Weather tab: snowfall averages, ice storm history
- Heat & Drought tab: days above 90°F, drought frequency
- Community Preparedness tab: emergency management, shelters, road priority
- Seasonal Risk Calendar tab: month-by-month risk awareness

**Research:**
- Complete NOAA Storm Events database for this county — every event, 30 years
- Full FEMA disaster declaration history
- Monthly temperature and precipitation tables — 30-year normals
- Drought Monitor historical weekly data
- Tornado track maps with paths and widths
- Flood stage data for nearest stream gauge
- Historical snowfall by year
- Growing degree day accumulation
- UV index averages by month
- Solar radiation data

**Additional data to fetch:**
- NOAA Storm Events API: complete event history
- FEMA OpenFEMA: disaster declarations
- NOAA CDO: 30-year climate normals full data

---

### CHAPTER: What Will Grow Here

**The question buyers are actually asking:**
"Can I actually garden here? What will thrive? What will I be fighting? What can I grow for food?"

**Glance:**
Zone + season length + "X native species documented here"

**Overview (current content):**
- Hardiness zone, frost dates, soil type
- 6 native plants, 5 invasives
- Wildlife paragraph
- Extension CTA

**Deep Read (FR-042):**
- Trees tab: canopy, understory, fruit trees for this zone
- Shrubs & Flowers tab: native shrubs, edible shrubs, perennial sequence
- Food Garden tab: vegetables by season, what to plant when based on ACTUAL frost dates, what struggles here
- Birds tab: by season (year-round, migrants, breeders, winter visitors)
- Pollinators tab: monarchs, native bees, butterflies with host plants
- Wildlife tab: mammals with garden planning implications, reptiles, amphibians
- Month by Month tab: full seasonal calendar specific to this zone and frost dates
- What to Remove tab: invasive removal guide with timing and replacement plants

**Research:**
- Complete USDA PLANTS database results for this county — every native species
- Full iNaturalist observation log — every species within 10 miles with dates and frequency counts
- Complete soil survey data — all horizons, pH levels, CEC, organic matter percentage
- Monthly precipitation averages — 30-year normals for nearest station
- Monthly temperature averages — highs, lows, means
- Frost probability curve by date — not just average but probability percentage by day
- Specific variety recommendations by crop for this zone + soil + drainage combination
- Grass seed mix recommendation for this soil, sun exposure, and climate
- Complete bird checklist for this county from eBird — every species recorded
- Butterfly species list with host plants for each
- Tree identification guide for common species in this area
- Water requirements by plant category for this rainfall pattern
- Complete invasive species database for this state

**The Tomato Example (Research level output):**
"Bluegrass-Maury silt loam, pH 6.2-6.8, well drained — ideal tomato conditions. Your 183-day season accommodates indeterminate varieties. Average summer highs of 87°F are within optimal range (75-95°F). Frost probability drops below 5% by May 8, below 1% by May 22 based on 30-year data. Recommended varieties: Celebrity (70 days, disease resistant — safest choice), Big Beef (90 days — full season needed, plant by May 1), Cherokee Purple (heirloom, 80 days, exceptional flavor). Plant after May 1. Stake or cage before planting — this soil grows aggressive plants."

**Additional data to fetch:**
- NOAA CDO: monthly temperature and precipitation normals
- NOAA: frost probability curve (already have frost dates, need probability distribution)
- USDA PLANTS: full county native species database
- eBird: complete county checklist
- iNaturalist: full observation log (already calling, surfacing more)

---

### CHAPTER: Property Intelligence

**The question buyers are actually asking:**
"What does this specific property's history tell me that the listing doesn't?"

**Glance:**
Construction era + soil drainage badge + 1 action

**Overview (current + improvements):**
- Expand construction era health risks significantly (FR-034 Enhancement 3)
- Fix internet section — ISP lookup or remove
- Add deed restrictions note
- Keep soil/drainage and county assessor link

**Deep Read:**
- Full construction era health risk guide by decade
- Internet: all ISPs serving this address with technology type and actual speed context
- Property tax: 5-year assessed value trajectory
- Deed restrictions: what you can and can't do
- Sun angle: winter vs summer, south-facing vs north-facing implications
- Seasonal access: road conditions, maintenance responsibility

**Research:**
- Complete soil survey data for this parcel — all layers, full chemistry
- Full permit history instructions with specific county contact
- Property tax assessment history — assessed value by year
- Zoning classification and what it permits
- Utility easement map if available
- Broadband speed test data from nearby addresses (M-Lab open data)

**Additional data to fetch:**
- M-Lab open data: actual speed tests near this address
- County assessor: property tax trajectory (manual lookup link)
- FCC Area API: ISP coverage alternative endpoint

---

### CHAPTER: Sensory & Environmental

**The question buyers are actually asking:**
"What will I hear, see, and breathe here? What am I not noticing during a showing?"

**Glance:**
AQI badge + Radon zone + Airport distance

**Overview (current + improvements):**
- Add air traffic direction — under approach path or not (FR-034 Enhancement 2)
- Deepen AQI: percentile context + practical implication + primary pollutant season
- Fix water quality — surface EPA SDWA violation data or remove fallback
- Bortle scale is excellent — give it more visual prominence

**Deep Read:**
- Sound environment: airport approach path analysis, road noise dB with context, rail proximity
- Night sky: Bortle scale with visual gradient, best viewing directions
- Air quality: AQI percentile, pollutant breakdown, seasonal patterns, trend direction
- Water quality: utility violation history, source type, treatment method
- Radon: zone with cost context, testing instructions, mitigation costs
- Chemical proximity: Superfund sites, industrial facilities within 5 miles

**Research:**
- Complete FAA approach/departure path data for nearby airports
- Full EPA AQS monitoring station data — hourly readings, annual averages, trends
- EPA SDWA complete violation history for this water system
- EPA EJSCREEN full environmental justice metrics
- Noise contour maps if available from FAA
- Complete Superfund site data within 10 miles
- TRI (Toxic Release Inventory) facilities within 10 miles

**Additional data to fetch:**
- FAA NASR: runway orientations and approach paths
- EPA SDWA: water system violation history
- EPA TRI: toxic release inventory by facility
- EPA EJSCREEN: when API is restored

---

### CHAPTER: Walkability

**The question buyers are actually asking:**
"Can I live here without a car? What's it actually like to walk around? What happens if I can't drive?"

**Glance:**
Car-Dependent / Somewhat Walkable / Very Walkable badge

**Overview (current + improvements):**
- Give aging-in-place implication its own prominent callout — too important to bury
- Reduce walking destination list — remove obvious ones (Subway, Kroger if already in reachability)
- Add bike infrastructure note

**Deep Read:**
- Walking: complete destination list within 0.5 miles with walk times
- Biking: bike lanes, trails, distances to key destinations by bike
- Transit: bus routes, stops, frequency if applicable
- Aging-in-place: full section on what changes if driving becomes impossible
- Pedestrian safety: sidewalk coverage, crosswalk availability, lighting

**Research:**
- Complete street network analysis — sidewalk coverage percentage
- Full transit schedule if applicable
- Bike route mapping to key destinations
- ADA accessibility assessment for nearby services
- Senior transportation services in this area

**Additional data to fetch:**
- OpenStreetMap: sidewalk coverage, bike lanes
- GTFS transit data if applicable to this area

---

### CHAPTER: Property Costs & Market

**The question buyers are actually asking:**
"What does this actually cost me every month beyond the mortgage? Am I walking into any surprises?"

**Glance:**
"$538/month carrying costs before mortgage"

**Overview (current + improvements):**
- Keep carrying cost table — it's strong
- Add: property tax 5-year trajectory
- Add: HOA detection and status
- Replace "check Zillow" with "your agent can pull a CMA in 5 minutes — here's what to ask for"
- Connect flood/climate risk findings to insurance cost estimate

**Deep Read:**
- Property tax trajectory: assessed value trend over 5 years
- HOA: detected or not, estimated fee range if applicable
- Insurance: base estimate + flood/tornado/wildfire risk adjustments
- Utilities preview: monthly cost estimate (connects to FR-032)
- True monthly cost: all-in estimate including mortgage at current rates

**Research:**
- Complete tax assessment history by year
- HOA document lookup instructions if applicable
- Insurance market context — is this area seeing rate increases?
- Full carrying cost breakdown with all variables
- Rental market context — what does this home rent for? (optionality if circumstances change)

**Additional data to fetch:**
- County assessor: tax assessment history
- HOA registry if available by state
- NAIC: insurance market data by state

---

### CHAPTER: Utilities Intelligence (FR-032)

**The question buyers are actually asking:**
"Who provides my services? What do they cost? What happens when there's a storm?"

**Glance:**
Electric provider + outage frequency + internet type available

**Overview:**
- Electric: provider, rate vs state average, annual outage frequency
- Gas: available or propane/electric only
- Water: municipal vs well
- Sewer: municipal vs septic
- Internet: ISPs with technology type
- Trash: collection frequency, recycling availability

**Deep Read:**
- Electric: rate history, reliability metrics, storm response average
- Internet: all ISPs with actual speed context vs advertised
- EV: monthly charging cost estimate, nearest chargers
- Well/septic: what this means for ownership costs and maintenance
- Backup power: options, costs, feasibility

**Research:**
- Complete NERC reliability data for this utility territory
- Full rate comparison vs neighboring utilities
- ISP speed test data from nearby addresses
- Complete utility contact directory
- Emergency procedures for each utility

---

## UI Specification: The Depth Slider

### Per-Chapter Control
Each chapter card has a depth selector in the top-right corner:

```
[Glance ▾]  or  [Overview ▾]  or  [Deep Read ▾]  or  [Research ▾]
```

Clicking opens a dropdown with all four options. Selecting a level updates that chapter's content instantly (already-fetched data — no new API calls on level change).

### Default Behavior
- All chapters default to Overview on first load
- Buyer's selections persist in sessionStorage for the current session
- "Expand All to Research" button at top of report for power users

### Mobile Behavior
- Dropdown replaced with a segmented control: G · O · D · R
- Tap to cycle through levels
- Long press shows level names

### Data Loading Strategy
**Critical:** All depth levels are fetched at report generation time. Level changes are purely a display toggle — no additional API calls when a buyer changes depth. This means:
- Report generation fetches ALL data for ALL levels upfront
- Display layer shows/hides sections based on selected level
- No loading spinners when changing depth — instant response

This requires the data layer to fetch more upfront but eliminates loading states that would break the experience.

### Implementation Location
- `src/templates/components/depthSlider.js` — the slider component
- `public/ui.js` — depth state management, show/hide logic
- `public/report.css` — depth-level CSS classes

---

## API Cost Analysis

Most Level 3 and Level 4 data uses APIs we already call — we just surface more of the response. New API calls needed:

| New API | Used For | Cost |
|---------|----------|------|
| NOAA Storm Events | Climate Research | Free |
| FEMA OpenFEMA | Climate Deep/Research | Free |
| NOAA CDO full data | Garden/Climate Research | Free |
| CMS NPI Registry | Health Deep | Free |
| CMS Provider Services | Health Research | Free |
| NCES enrollment data | Schools Deep | Free |
| M-Lab speed test data | Property Research | Free |
| FAA NASR | Sensory Deep | Free |
| EPA SDWA violations | Sensory Deep | Free |
| EPA TRI | Sensory Research | Free |
| BLS QCEW employers | Traffic Deep | Free |
| eBird full checklist | Garden Research | Free (with key) |
| iNaturalist full log | Garden Research | Free |

**Total additional API cost at scale: $0**

All Level 3 and Level 4 data is available from free public APIs. The cost is in compute time and caching, not API fees.

---

## Implementation Dependencies

FR-044 cannot be fully implemented until:
- FR-039 (Chapter Templates) complete — depth levels live in template files
- FR-035 (Logic Layer) complete ✅ — already done
- FR-042 (Garden Deep Dive) complete — provides Garden Level 3/4
- FR-043 (Climate History) complete — provides Climate Level 3/4
- FR-033 (Calculator) complete — provides Daily Life Level 3

FR-044 can be partially implemented (Glance level for all chapters + Overview improvements) before FR-039 is complete.

---

## Acceptance Criteria

- [ ] Every chapter has a depth slider with 4 levels
- [ ] Glance level shows for every chapter — no exceptions
- [ ] All depth level data fetched at report generation (no lazy loading on level change)
- [ ] Level changes are instant — no loading states
- [ ] SessionStorage persists depth selections within session
- [ ] "Expand All to Research" button functional
- [ ] Mobile: segmented control G/O/D/R works on touch
- [ ] Garden chapter Research level includes: complete USDA PLANTS list, full iNaturalist log, frost probability curve, specific variety recommendations
- [ ] Climate chapter Research level includes: complete NOAA Storm Events for county, FEMA declarations, 30-year climate normals
- [ ] The Tomato Example output renders correctly for Georgetown KY
- [ ] All 5 test addresses render all 4 depth levels correctly
- [ ] Bozeman MT Research garden data is completely different from Georgetown KY
- [ ] Zero additional API costs compared to current report generation

---

## The Standard

Every chapter at Research depth should make a domain expert say "this is better than what I could pull together myself in an afternoon." A gardener should find the Research garden section more useful than any gardening book. A parent should find the Research schools section more useful than calling the district office. A weather-anxious buyer should find the Research climate section more reassuring than 20 minutes of Googling.

That is the bar. That is Livably.

