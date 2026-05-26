# FR-043 — Climate & Weather: History & Preparedness Deep Dive
*Progressive disclosure expansion of the climate chapter*
*May 2026*

---

## Gate 1: Conceptual Review

### What it covers
A deep expansion of the existing Climate & Weather Risks chapter using progressive disclosure. The current chapter (Level 2) stays exactly as-is. This spec adds Level 3 — historic weather event records, rarity vs likelihood framing, and local preparedness infrastructure that tells a buyer not just what the risks are but how often they actually happen and what this community has in place to respond.

### The Three Levels
**Level 1 (skim — always visible):**
Flood zone badge + tornado tier + last major event + 1 action

**Level 2 (read — current chapter):**
Existing content: FEMA zone, Zone X nuance, tornado frequency, 4 action items, Key Takeaway

**Level 3 (deep dive — new, expandable):**
Historic event records by type, rarity vs likelihood framing, preparedness infrastructure, seasonal risk calendar

### The Core Insight
The current chapter tells buyers what COULD happen. Level 3 tells them what HAS happened and what this community does about it. Those are different and both necessary.

"Kentucky has high tornado frequency" is a fact. "The last tornado within 5 miles of this address was an EF1 in 2012. Scott County averages 0.8 tornado events per decade. Warning lead time in this county averages 13 minutes. The nearest public storm shelter is [location] at [distance]" is understanding.

### Quality Checks

**ACTIONABLE:** Buyer knows exactly what to prepare for, how often it actually happens, what the community has in place, and what specific actions to take before and after moving in.

**REVEALING:** Most buyers research "does it tornado in Kentucky" and get "yes." We tell them the last 30 years of actual events within proximity, the warning infrastructure, and whether their specific home has a basement. Nobody does this.

**AVOIDS REGRET:** "I wish I'd known about the 2021 ice storm and how long power was out" / "I wish I'd known my road is secondary priority for snow clearing" / "I wish I'd registered for emergency alerts before the tornado warning" — all answered.

**EXCLUSIVE:** NOAA Storm Events by county + FEMA disaster declarations + county road priority + emergency notification system + utility storm response data + construction era basement detection. Requires combining 6+ data sources. Not a 30-minute Google result.

**Score: 4/4 — MUST BUILD**

---

## Gate 2: Data Sources

### Existing (already implemented, reuse)
- FEMA flood zone (parcel-level)
- NOAA tornado frequency tier

### New data needed for Level 3

**NOAA Storm Events Database**
- Historic tornado, flood, severe storm, winter storm, extreme heat events
- Filter: by county + last 30 years + significant events only
- Fields: date, event type, EF/intensity rating, deaths, injuries, property damage, distance from address
- URL: https://www.ncdc.noaa.gov/stormevents/
- API: https://www.ncdc.noaa.gov/cdo-web/api/v2/

**FEMA OpenFEMA — Disaster Declarations**
- Federal disaster declarations for this county
- Filter: last 20 years
- Fields: declaration date, disaster type, title
- URL: https://www.fema.gov/api/open/v2/disasterDeclarations
- Free, no key required

**NOAA Climate Data Online — Snowfall & Heat**
- Average annual snowfall for nearest weather station
- Average days above 90°F, 95°F
- Drought frequency from US Drought Monitor API
- URL: https://www.ncdc.noaa.gov/cdo-web/

**County Road Priority**
- What priority is this address's road for snow/ice clearing?
- Primary (cleared first), secondary (within 24hrs), residential (within 48hrs)
- Source: State DOT / county road department — varies by state
- Fallback: general county road priority map if API unavailable

**Emergency Notification System**
- What system does this county use? (Everbridge, Nixle, AlertMedia, county-specific)
- Registration URL
- Source: County emergency management website
- Implementation: manually curated database by county (similar to development intel approach)

**Utility Storm Response**
- NERC SAIDI/SAIFI data already pulled for FR-032 (Utilities chapter)
- Reuse: average outage duration after major storm events
- Add: underground vs overhead line context if available

**Construction Era + Basement Detection**
- Already have construction era from Property Intelligence
- Logic: homes built pre-1980 in KY more likely to have basements
- Homes built post-1990 in KY typically slab construction
- Flag: "2003 construction — likely slab foundation, no basement"

**Nearest Public Storm Shelter**
- FEMA shelter database
- County emergency management shelter registry
- URL: https://www.fema.gov/locations/shelters
- Fallback: county emergency management contact with instruction to ask

---

## Gate 3: Content Specification

### Tab 1: Flood History

**FEMA Disaster Declarations**
List all federal disaster declarations for this county in last 20 years:
```
2021  Major Disaster Declaration  Severe storms, flooding
2019  Major Disaster Declaration  Severe storms, tornadoes, flooding  
2017  Major Disaster Declaration  Severe storms, straight-line winds
```
"Scott County has received 4 federal disaster declarations since 2000 — all related to severe weather events."

**Significant Flood Events (NOAA Storm Events)**
List top 3-5 most significant flood events in last 30 years:
- Date, event type, property damage estimate, context sentence
- "May 2010: Flash flooding caused $2.3M in property damage in Scott County following 6 inches of rain in 24 hours."

**The Rarity vs Likelihood Frame**
"Zone X means river flooding isn't your primary risk — but Scott County has experienced significant stormwater flooding in 4 of the last 10 years, all during periods of 3+ inches of rain in 24 hours. The question isn't whether it will happen — it's whether this specific property drains well enough to avoid it."

**Action:**
"Ask the seller specifically: has water ever entered the basement, crawlspace, or garage? Have neighboring properties experienced yard flooding? These questions aren't in any inspection checklist."

---

### Tab 2: Tornado History

**Historic Tornado Events (NOAA)**
Events within 25 miles in last 30 years, sorted by distance:
```
2012  EF1  7.2 miles SW  Max winds 100mph  No injuries
2008  EF0  14.1 miles N  Max winds 85mph   No injuries
1974  F4   18.3 miles SW  [Super Outbreak — historical context]
```

**Frequency Analysis**
"Scott County has experienced 3 tornado events within 25 miles in the last 30 years. That's roughly one significant event per decade — consistent with Kentucky's statewide frequency."

**Warning Infrastructure**
"The National Weather Service issues tornado warnings for Scott County with an average lead time of 13 minutes — above the national average of 8 minutes. Scott County has [X] outdoor warning sirens."

**The Basement Question**
Conditional based on construction era:
- Pre-1980 home: "Homes of this era in Kentucky frequently have full basements — verify with the seller."
- 1980-2000: "Homes of this era in Kentucky vary — some have basements, many are slab. Confirm with seller."
- Post-2000: "Most homes built after 2000 in central Kentucky are slab construction without basements. If confirmed, identify your shelter plan before move-in."

**Nearest Public Storm Shelter**
"[Shelter name] at [address] — [X] miles from this address. Open during tornado warnings."

**Action:**
"Download the Scott County Emergency Management app [or] register for AlertScott at [URL]. Warnings arrive 2-3 minutes faster on your phone than outdoor sirens."

---

### Tab 3: Winter Weather History

**Average Winter Profile**
```
Average annual snowfall:     8.2 inches
Average ice storm events:    0.8 per year (minor)
                             0.2 per year (significant, 0.5"+ ice)
Average days below 32°F:     74 days
Record single snowfall:      16.5 inches (February 2021)
```

**Significant Winter Events (last 20 years)**
```
February 2021  Ice storm  Power outages avg 4.2 days (40% of county)
January 2016   Blizzard   18 inches snow over 36 hours
February 2015  Ice storm  Power outages avg 2.1 days
```

**The Rarity Frame**
"The 2021 ice storm was described as once-in-a-generation. Before that, the comparable 2003 event caused similar outages. In a 20-year ownership period, you'll likely experience one significant ice event affecting power for multiple days."

**Road Priority Context**
Conditional based on address road type:
- Primary arterial: "This address is on a primary road — typically cleared within 4-6 hours of significant snow."
- Secondary: "This address is on a secondary road — typically cleared within 12-24 hours."
- Residential: "This address is on a residential street — typically cleared within 24-48 hours after primary and secondary roads. Plan for potential access limitations after significant snow."

**Utility Storm Preparation**
"Kentucky Utilities averages 3.1 hours of outage per significant winter event in this service territory. For extended outages (ice storms): [generator rental locations in Georgetown] or [where to buy generator fuel]."

**Actions:**
1. Register for emergency alerts: [specific URL for this county]
2. Know your road priority level — call Scott County Road Department: [phone]
3. Stock emergency kit for 72-hour outage minimum: [specific list for winter]

---

### Tab 4: Heat & Drought

**Average Heat Profile**
```
Days above 90°F per year:    26 days
Days above 95°F per year:    8 days  
Days above 100°F per year:   1 day (rare)
Heat index peak:             Feels like 105°F on hottest days
Trend:                       +0.8°F per decade since 1980
```

**Drought History**
"Scott County entered D1 (Moderate Drought) or worse conditions in 3 of the last 10 years. The 2012 drought was the most severe in 50 years — well water levels in this area dropped significantly."

**For Well Water Addresses**
"During the 2012 drought, well levels in Scott County dropped an average of 8-12 feet. If this property has a well, ask about the depth and whether it was affected in 2012."

**Garden Implications**
"26 days above 90°F means heat-stressed tomatoes, bolting lettuce, and stressed lawn grass in July-August. Deep watering twice weekly outperforms shallow daily watering. Mulch is essential."

**Actions:**
1. Check HVAC before first summer — service cost: $80-$150
2. Know your utility's cooling assistance programs if needed
3. Garden with heat in mind — choose heat-tolerant varieties

---

### Tab 5: Preparedness Infrastructure

**Emergency Management**
```
County:           Scott County Emergency Management
Director:         [Name if public]
Phone:            [Number]
Website:          [URL]
Alert system:     AlertScott (text/email/call)
Registration:     [Direct URL]
```

"Register for emergency alerts before move-in. Warnings arrive 2-3 minutes faster than outdoor sirens."

**Storm Shelters**
List nearest 3 public shelters:
```
[Name]  [Address]  [Distance]  [Capacity]  Opens: during active warnings
[Name]  [Address]  [Distance]  [Capacity]
[Name]  [Address]  [Distance]  [Capacity]
```

**Road Maintenance**
```
County Road Dept:    Scott County Public Works — 502-863-XXXX
Winter response:     Salt trucks deploy when road temp < 32°F
Priority system:     Primary (arterials) → Secondary → Residential
This address:        [Primary/Secondary/Residential] priority
```

**Utility Emergency**
```
Electric:   Kentucky Utilities — Outage: 800-981-0600
            Average storm restoration: 3.1 hours (minor), 18 hours (major)
Gas:        [Provider] — Emergency: [Number]
Water:      Georgetown Municipal Water — [Number]
```

**The 72-Hour Kit**
Specific to this address's risk profile:
- Tornado risk: interior room kit, weather radio, shelter plan
- Ice storm risk: power outage kit (water, food, warmth, communication)
- Summer heat risk: cooling plan if HVAC fails

---

### Tab 6: Seasonal Risk Calendar

Month-by-month risk awareness specific to this address:

```
JANUARY    Ice storm risk HIGH. Road conditions most variable.
            Utility outage risk highest of year.
            Action: Know road priority, have 72-hr kit stocked.

FEBRUARY   Ice storm risk HIGH. Peak winter storm month.
            2021 event: February 11-16. 2015 event: February 16-18.
            Action: Generator or outage plan essential.

MARCH      Tornado season begins. Severe thunderstorm risk increases.
            Late-season ice possible through mid-March.
            Action: Register emergency alerts if not done.

APRIL      PEAK tornado month for central Kentucky.
            Also flash flood risk from spring rains.
            Action: Know shelter plan. Check basement/shelter.

MAY        Severe thunderstorm peak. Tornado risk continues.
            Heavy rain flood risk — 3"+ in 24 hours is the threshold.
            Action: Know if road floods. Ask neighbors.

JUNE       Heat season begins. Drought watch starts.
            Severe storm risk remains elevated.

JULY       PEAK heat. Heat index reaches 100°F+ on worst days.
            Well water levels lowest of year if drought.
            Action: HVAC serviced, emergency contacts ready.

AUGUST     Late summer heat continues.
            Hurricane remnants can bring flooding (rare but notable).
            Drought most likely to intensify.

SEPTEMBER  Tornado season winds down. Heat moderates.
            Fall severe weather possible.
            Action: Review winter preparedness supplies.

OCTOBER    First frost risk begins mid-month.
            Last moderate weather month before winter prep.
            Action: Winterize pipes, schedule HVAC service.

NOVEMBER   Winter storm season begins.
            Ice storm risk increases late November.
            Action: Full winter kit assembled, vehicle prepared.

DECEMBER   Ice storm risk HIGH. Full winter storm season.
            Road priority matters — know yours.
            Action: Emergency contacts, kit complete.
```

---

## Gate 4: Acceptance Criteria

- [ ] All existing Level 2 content unchanged
- [ ] Level 3 renders as tabbed interface (6 tabs)
- [ ] Historic events show actual NOAA Storm Events data for this county
- [ ] FEMA disaster declarations show actual records for this county
- [ ] Rarity vs likelihood framing present in flood and tornado tabs
- [ ] Basement detection logic correct for construction era (pre/post 2000)
- [ ] Nearest storm shelter shows actual location if FEMA data available
- [ ] Road priority tier shown if determinable, otherwise county contact provided
- [ ] Emergency notification system shows county-specific system name and registration URL
- [ ] Seasonal calendar frost dates match the actual dates from the garden chapter
- [ ] Heat statistics match NOAA data for nearest weather station
- [ ] Well water drought note only appears for well-water addresses
- [ ] All 5 test addresses render correctly with different historic events
- [ ] Georgetown KY shows KY-specific events, Bozeman MT shows MT-specific events
- [ ] Rural Harlan KY shows Appalachian weather pattern context

## Module
`src/modules/climate/` — extends existing data.js, logic.js, and template.js

## Chapter Color
Storm blue-grey (#3d5a7a) — unchanged

## Progressive Disclosure Implementation
- Level 1: always visible (zone badge + last event + 1 action)
- Level 2: [+ Read full analysis] expands current content
- Level 3: [+ See weather history & preparedness] expands tabbed deep dive

Tab labels:
[Flood History] [Tornado History] [Winter Weather] [Heat & Drought] [Community Preparedness] [Month by Month]

## Relationship to FR-032 (Utilities)
The utility storm response data (outage frequency, restoration time) is fetched in FR-032. The climate chapter reuses this data in the Preparedness tab rather than fetching it separately. The two chapters share this data through the module index.js interface.

## The Tone Standard
This chapter walks the line between informative and alarming more carefully than any other. Every historic event must be accompanied by the rarity frame. Every risk must be accompanied by what the community does about it. The goal is a buyer who feels prepared, not scared.

Wrong: "Scott County has experienced multiple tornado events."
Right: "Scott County has experienced 3 tornado events within 25 miles in 30 years — roughly one per decade. The warning system gives 13 minutes average lead time. Here's your shelter plan."
