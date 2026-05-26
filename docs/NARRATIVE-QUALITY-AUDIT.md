# Livably — Narrative Quality Audit
*Does every chapter pass the 30-minute Google test?*
*May 2026*

---

## The Standard

Every finding must pass at least one of these tests:
1. **Can't Google it** — the data is not findable in 30 minutes of searching
2. **Synthesis no one else does** — the data exists but nobody combines it this way
3. **Actionable specificity** — the exact next step (named contact, phone number, specific question) that Google doesn't provide
4. **Narrative that transforms data into understanding** — not just what, but what it means for THIS buyer at THIS address

A finding that fails all four tests should be removed, deepened, or replaced.

---

## Chapter 1: Health & Safety

### What it currently shows
- Nearest ER name and drive time
- Fire station distance and estimated response time with Excellent/Good/Fair badge
- Police station distance and estimated response time
- ISO explanation
- 3 action items (get ISO rating, drive ER route, test detectors on move-in day)
- Key Takeaway

### 30-Minute Google Test

| Finding | Passes? | Why |
|---------|---------|-----|
| ER name and drive time | ❌ Barely | Google Maps, 2 minutes |
| Fire station ~2 min Excellent | ✅ Yes | The response time context + ISO implication is not findable |
| Police ~6 min Good | ✅ Yes | Same — context and implication matter |
| ISO explanation | ✅ Yes | Most buyers have never heard of ISO PPC |
| "Drive the ER route" action item | ✅ Yes | This specific advice with this specific framing doesn't exist anywhere |
| "Test detectors on move-in day" | ❌ Barely | Generic home safety advice |

### What's Missing (Gaps)
1. **Hospital designation** — is Centerpoint Georgetown a Level 1 Trauma center or a community hospital? For serious emergencies this is the most important fact. Not currently shown.
2. **Primary care availability** — are there physicians accepting new patients within 15 min? A buyer with a chronic condition needs this.
3. **Healthcare depth** — specialists within 30 min? For families with children or aging buyers this matters enormously.
4. **The "what if" framing** — "4 minutes to the ER" is a fact. "In a cardiac event, 4 minutes is the difference between full recovery and permanent damage" is an understanding. We're showing the fact, not the understanding.

### Narrative Quality Score: 3/5
Strong on safety context, weak on healthcare depth and the "so what" framing.

### Recommended Improvements
- Add hospital designation (Level 1 vs community) — FR-034 Enhancement 1
- Add "what this means in practice" sentence to the ER finding
- Replace generic "test detectors" with something more specific to this home's era
- Remove or deepen the generic action items

---

## Chapter 2: What Daily Life Looks Like Here

### What it currently shows
- Daily Conveniences: grocery, pharmacy, gas
- Peace of Mind: hospital, urgent care
- Getting Around: highway access
- Narrative paragraphs for each subsection

### 30-Minute Google Test

| Finding | Passes? | Why |
|---------|---------|-----|
| Kroger 3 min | ❌ Fails | Google Maps, 30 seconds |
| Pharmacy 2 min | ❌ Fails | Google Maps, 30 seconds |
| Hospital 4 min | ❌ Barely | Google Maps, 1 minute |
| "Low-friction living" narrative | ✅ Yes | The synthesis and framing is Livably's |
| Highway 10 min narrative | ✅ Yes | The "buffer without sacrificing connectivity" framing is ours |

### What's Missing (Gaps)
1. **The chapter is too thin** — it's restating Daily Reachability data with narrative. The data is identical to Chapter 3.
2. **No genuine insight layer** — "your grocery is 3 min away" with a warm paragraph is still just a drive time. The insight should be: "Most people in this area spend about 47 minutes per week on essential errands. Based on your address, you'd spend closer to 28 minutes. That's 19 hours back per year."
3. **The annual cost angle is missing** — this is where the Life at This Address Calculator belongs (FR-033). Without it, this chapter is mostly decorative narrative on top of data the buyer already saw.

### Narrative Quality Score: 2/5
Warm tone but thin on genuine insight. Overlaps too heavily with Daily Reachability.

### Recommended Improvements
- Add the Life at This Address Calculator here (FR-033) — this transforms the chapter from "here's your drive times again with nicer words" to "here's what your life actually costs in time and money"
- Add annual time savings comparison ("28 min/week vs national average of 47 min")
- Make the highway finding specific: not just "I-75 is 10 min" but "I-75 connects you to Lexington in 22 min, Cincinnati in 78 min, Louisville in 68 min"

---

## Chapter 3: Daily Reachability

### What it currently shows
- Top 3 grocery stores with drive times
- Pharmacy, hospital, urgent care, highway, gas, school
- I-64 also within 20 min note
- School assignment disclaimer

### 30-Minute Google Test

| Finding | Passes? | Why |
|---------|---------|-----|
| Grocery store names/times | ❌ Fails | Google Maps, 2 minutes |
| Pharmacy/hospital/urgent care | ❌ Fails | Google Maps, 3 minutes |
| Top 3 groceries | ✅ Barely | The top-3 comparison is slightly more useful than Google's single nearest |
| I-64 interchange fallback | ✅ Yes | The technical sophistication behind this result is not replicable manually |
| School assignment disclaimer | ✅ Yes | Most buyers don't know nearest ≠ assigned |
| Gas station | ❌ Fails | Remove this — everyone knows where gas stations are |

### What's Missing (Gaps)
1. **Gas station should be removed** — this is the clearest example of data that fails the test completely. Nobody needs Livably to find a gas station.
2. **No context for what these numbers mean** — "Hospital 4 min" is a fact. "4 minutes is faster than 87% of US residential addresses" is an insight.
3. **No civic infrastructure** — library, community center, post office. These are invisible quality-of-life services buyers assume exist. FR-034 Enhancement 4.
4. **Coffee shop** — currently showing, debatable. A coffee shop within walking distance genuinely affects daily quality of life for many buyers. Keep but frame it as lifestyle context not essential.

### Narrative Quality Score: 2.5/5
Accurate data, weak on insight layer. Gas station drags it down.

### Recommended Improvements
- Remove gas station entirely
- Add percentile context to hospital drive time ("faster than X% of US addresses")
- Add civic infrastructure (library, community center, post office)
- Add the Life at This Address Calculator as the capstone

---

## Chapter 4: Traffic Patterns

### What it currently shows
- Drive times at 4 different times (8am Mon, 12pm Mon, 5pm Mon, 10am Sat)
- Best/Worst labels
- Average and range
- For Kroger and the hospital

### 30-Minute Google Test

| Finding | Passes? | Why |
|---------|---------|-----|
| Traffic variation data | ✅ Yes | Google Maps shows current traffic but not a systematic 4-time comparison |
| "Best" labels when all times equal | ✅ Yes | Georgetown's flat traffic pattern is a genuine insight |
| Range showing 3-3 min | ✅ Yes | This tells a real story — this area has no meaningful traffic |

### What's Missing (Gaps)
1. **Only 2 destinations** — Kroger and the hospital. Should show the commute destination (nearest employment center) if the buyer has a commute.
2. **No worst-case framing** — "Range 3-3 min" is reassuring but needs context. "Georgetown has effectively no rush hour — your commute time will be the same at 8am Monday as it is at 10am Saturday. This is genuinely unusual."
3. **Employment center commute missing** — the most important traffic pattern for most buyers is their actual commute. We show grocery and hospital but not work.

### Narrative Quality Score: 3.5/5
Solid and genuinely useful. Needs commute destination and better narrative framing.

### Recommended Improvements
- Add nearest employment center (Toyota plant for Georgetown — this is a major employer)
- Add "no rush hour" insight when range is flat
- Add commute-specific framing for the Life at This Address Calculator integration

---

## Chapter 5: Schools & Education

### What it currently shows
- Nearest public elementary, middle, high school with drive times
- Private schools within 10 miles
- "Nearest ≠ assigned" warning
- 4 questions to ask before you close
- Key Takeaway

### 30-Minute Google Test

| Finding | Passes? | Why |
|---------|---------|-----|
| School names and drive times | ❌ Fails | Google Maps, 3 minutes |
| Nearest ≠ assigned warning | ✅ Yes | Most buyers genuinely don't know this |
| "Call the district office" action | ✅ Yes | Specific, actionable, commonly overlooked |
| 4 questions to ask | ✅ Yes | This checklist is genuinely valuable and not easily assembled |
| Private schools within 10 mi | ✅ Barely | Findable but not commonly assembled this way |
| "Talk to parents at afternoon pickup" | ✅ Yes | This specific advice is excellent and not commonly given |

### What's Missing (Gaps)
1. **No school quality context** — we deliberately avoided ratings (right call) but we also don't provide any meaningful quality signal. The 4 questions help but a buyer still doesn't know if Garth Elementary is improving or declining.
2. **District financial health** — is this district fiscally stable? A district heading toward insolvency cuts programs. NCES data makes this answerable.
3. **Enrollment trend** — is this school growing or shrinking? Growing = investment, shrinking = potential consolidation/closure.
4. **Boundary stability** — have boundaries changed in the last 5 years? This is in the checklist but should be answered by us, not left as a question.

### Narrative Quality Score: 3.5/5
Strong checklist and warning, weak on quality context.

### Recommended Improvements
- Add enrollment trend (NCES data — growing/stable/declining)
- Add district financial health indicator
- Add boundary change history for the last 5 years if available
- The 4 questions are excellent — keep them

---

## Chapter 6: Safety & Emergency Response

### What it currently shows
- Police response with Good/Excellent badge
- Fire response with Good/Excellent badge
- ISO PPC explanation
- 4 research items (crime map, neighborhood watch, community resource officer, ISO rating)
- Key Takeaway

### 30-Minute Google Test

| Finding | Passes? | Why |
|---------|---------|-----|
| Police/fire response times | ✅ Yes | Estimated from station distance — not easily found |
| ISO explanation | ✅ Yes | Most buyers don't know what ISO PPC is |
| "Call community resource officer" | ✅ Yes | Specific, named action most buyers wouldn't think of |
| "Search crime map Georgetown" | ❌ Barely | This is just telling them to Google it |
| "Find neighborhood watch on Nextdoor" | ✅ Yes | Specific platform + specific search term is useful |

### What's Missing (Gaps)
1. **We tell buyers to search crime maps but don't show crime data** — this is the most glaring gap. We're outsourcing the most important finding to the buyer. Fair Housing constraints make this sensitive but THERE IS a Fair Housing-safe way to surface crime data: show call type distribution (welfare checks, traffic stops, noise complaints vs violent incidents) without characterizing the area demographically.
2. **The "search crime map" action item is lazy** — if we're telling them to Google it, we should just do it for them.

### Narrative Quality Score: 3/5
Good on emergency services, weak on the crime/safety data gap.

### Recommended Improvements
- Either surface actual safety data (call type distribution from police department open data) or remove the "search crime map" suggestion since we're not doing the work
- Strengthen the ISO framing with a specific premium savings estimate ("ISO 3 vs ISO 7 can mean $400-$800/year difference in homeowner's insurance")

---

## Chapter 7: Demographics & Community

### What it currently shows
- Age distribution bars
- Median household income vs national median
- Education levels
- Homeownership rate, median tenure, household size
- Community character synthesis

### 30-Minute Google Test

| Finding | Passes? | Why |
|---------|---------|-----|
| Age distribution | ❌ Fails | Census Reporter, 5 minutes |
| Income vs national median | ❌ Barely | Findable but the national median comparison is useful framing |
| Education levels | ❌ Fails | Census Reporter, 5 minutes |
| 78% homeownership | ✅ Barely | The implication (stability, investment, shared stakes) saves it |
| 13-year median tenure | ✅ Yes | The tenure implication is genuinely insightful |
| Community character synthesis | ✅ Yes | The narrative synthesis is Livably's |

### What's Missing (Gaps)
1. **Owner-occupancy trend** — is the 78% going up or down over the last 10 years? Trending down means investors are buying in. Trending up means more homeowners. The direction matters more than the snapshot.
2. **The data is available but the insight isn't** — "78% homeownership" is Census data. "78% homeownership and it's been climbing for a decade, suggesting this area is attracting long-term owner-occupants not investors" is a Livably insight.
3. **Fair Housing tension** — this chapter walks closest to the Fair Housing line. The synthesis paragraph needs careful ongoing review.

### Narrative Quality Score: 2.5/5
Data is findable, narrative synthesis partially saves it. Needs trend data.

### Recommended Improvements
- Add 10-year ownership trend (Census decennial comparison)
- Add rental vs owner trend direction
- Deepen the tenure insight — 13 years is remarkable, explain why that matters

---

## Chapter 8: Growth & Development

### What it currently shows
- Confirmed projects (Publix under construction, Target approved)
- New construction percentage
- Commercial landscape within 1.5 miles
- "Check county planning" CTA

### 30-Minute Google Test

| Finding | Passes? | Why |
|---------|---------|-----|
| Publix under construction | ✅ Yes | Manually verified, not in any API |
| Target approved | ✅ Yes | Same |
| 16% new construction post-2010 | ✅ Barely | Census data but not commonly assembled |
| Commercial landscape list | ❌ Fails | Google Maps, 5 minutes |
| "Check Scott County Planning" CTA | ✅ Yes | Specific named resource most buyers wouldn't know |

### What's Missing (Gaps)
1. **The 10-Year Horizon** — where is this area heading? Population trend, school enrollment trend, commercial vacancy. FR-034 Enhancement 5.
2. **Commercial landscape is too generic** — "Elite Fitness 0.5 mi" is not an insight. What IS an insight: "This commercial corridor has had zero vacancy for 3 years — a signal of economic health in the immediate area."
3. **The development intel is the star** — Publix and Target are genuinely valuable. Everything else in the chapter is noise by comparison.

### Narrative Quality Score: 3/5
Development intel is excellent, commercial landscape drags it down.

### Recommended Improvements
- Add the 10-Year Horizon (population trend, school enrollment)
- Remove or drastically reduce the commercial landscape list — it fails the test
- Lead with the development intel more prominently — it's the strongest finding
- Add economic health signal from commercial vacancy data if available

---

## Chapter 9: Climate & Weather Risks

### What it currently shows
- FEMA flood zone (Zone X — Minimal Risk)
- "25% of Zone X properties still file claims" context
- Preferred-risk policy cost ($300-$500/yr)
- Tornado frequency (High for KY)
- 4 action items
- Key Takeaway

### 30-Minute Google Test

| Finding | Passes? | Why |
|---------|---------|-----|
| FEMA Zone X | ❌ Barely | msc.fema.gov is public but most buyers don't know it exists |
| "25% of Zone X still file claims" | ✅ Yes | This nuance is not on the FEMA website |
| $300-$500 preferred-risk policy | ✅ Yes | Specific cost context nobody provides |
| Tornado frequency High | ❌ Barely | NOAA data but framing as "High" is useful |
| "Get elevation certificate" action | ✅ Yes | Most buyers don't know this exists |
| "Flood insurance 30-day waiting period" | ✅ Yes | Critical timing information nobody tells buyers |

### What's Missing (Gaps)
1. **Watershed and upstream context** — FR-034 Enhancement 6. Where does water flow toward this address? Is there a drainage basin uphill?
2. **Wildfire risk** — not relevant for Georgetown KY but MUST be included for western addresses. Currently absent.
3. **Heat risk** — extreme heat days per year is increasingly important, especially for older buyers and families with young children.
4. **Insurance cost implication** — we say flood insurance is $300-$500 but we don't integrate that with the property costs chapter to show total monthly cost impact.

### Narrative Quality Score: 4/5
Strongest chapter for finding synthesis. The Zone X nuance and timing information are genuinely valuable.

### Recommended Improvements
- Add watershed/upstream context (FR-034)
- Add wildfire risk for applicable addresses
- Add extreme heat days per year
- Connect flood insurance cost to the property costs chapter

---

## Chapter 10: What Will Grow Here

### What it currently shows
- USDA Hardiness Zone 6b
- Frost dates (April 15 / October 15, 183 days)
- Soil type and drainage (Bluegrass-Maury silt loam, well drained)
- 6 native plants with botanical names and descriptions
- 5 invasive plants to avoid
- Wildlife (mammals and birds)
- Cooperative Extension CTA with specific office

### 30-Minute Google Test

| Finding | Passes? | Why |
|---------|---------|-----|
| USDA Zone 6b | ❌ Barely | phzmapi.org is public but obscure |
| Frost dates | ❌ Barely | Multiple gardening sites have this |
| 183-day growing season framing | ✅ Yes | The specific framing and what it means for vegetables is ours |
| Soil type + drainage | ✅ Yes | USDA Web Soil Survey exists but nobody uses it |
| Native plant list for Scott County | ✅ Yes | County-specific native plant list is not a 30-minute Google result |
| Invasive species list | ✅ Yes | State-specific invasive list with practical "what happens" context |
| Wildlife observations | ✅ Yes | iNaturalist data synthesized for homeowner context |
| UK Cooperative Extension contact | ✅ Yes | Named, specific, county-level resource |

### What's Missing (Gaps)
1. **Microclimate context** — elevation difference from weather station, sun angle in December vs June. FR-034 Enhancement 7.
2. **Seasonal reality** — what does this yard look like in February? What's dormant, what's green, what's bare?
3. **Deer pressure** — "deer are common" is mentioned but for a gardener this is a major planning factor. Specific deer-resistant plant recommendations for this zone would be extraordinary.

### Narrative Quality Score: 4.5/5
Livably's strongest chapter. Genuinely irreplaceable. The native plant list and wildlife synthesis pass every test.

### Recommended Improvements
- Add microclimate context (elevation vs weather station)
- Add seasonal summary (what this yard looks like month by month)
- Add deer-resistant plant recommendations if deer are flagged in wildlife
- This chapter is excellent — protect it from scope creep

---

## Chapter 11: Property Intelligence

### What it currently shows
- Construction era (2000s) with decade-specific cautions
- Soil and drainage (Well Drained badge)
- Internet availability (FCC fallback with broadband map link)
- Tax & permit records (county assessor link)
- Key Takeaway

### 30-Minute Google Test

| Finding | Passes? | Why |
|---------|---------|-----|
| Construction era | ❌ Barely | County assessor has this |
| Decade-specific cautions (2000s) | ✅ Yes | The cautions (Chinese drywall 2004-2007, etc.) are not commonly known |
| Soil/drainage | ✅ Yes | USDA Web Soil Survey is not a buyer destination |
| FCC broadband fallback | ❌ Fails | We're just linking to another site |
| County assessor link | ✅ Barely | Useful but borderline |

### What's Missing (Gaps)
1. **Construction era health risks are buried** — lead paint, asbestos, polybutylene plumbing implications are mentioned briefly but not given the weight they deserve. For a pre-1978 home this is one of the most important findings in the report. FR-034 Enhancement 3.
2. **Internet is the weakest section** — the FCC map is notoriously inaccurate and we're just linking to it. Either do the work (ISP lookup, actual speed data) or remove it.
3. **Property tax trajectory missing** — we show the current rate but not the trend. Is this parcel's assessed value going up 5% per year? That's a $2,000/year cost increase compounding. FR-034 (fold into costs chapter).
4. **Deed restrictions missing** — what can and can't the buyer do with this property? FR-034.

### Narrative Quality Score: 2.5/5
Construction era cautions are strong, internet section is weak, too many deferred findings.

### Recommended Improvements
- Expand construction era health risks significantly (FR-034 Enhancement 3)
- Fix internet section — either do ISP lookup properly or remove
- Add deed restrictions note
- Move property tax trajectory to costs chapter

---

## Chapter 12: Sensory & Environmental

### What it currently shows
- Airport distance (8.3 miles, Georgetown-Scott County Regional)
- Road noise estimate (~55 dB)
- Rail proximity (none within 3 miles)
- Bortle scale (6 — Bright suburban sky)
- AQI (19 — Good)
- Water quality (fallback to EWG link)
- Radon Zone 1 with cost context
- EJSCREEN (fallback to EPA link)

### 30-Minute Google Test

| Finding | Passes? | Why |
|---------|---------|-----|
| Airport 8.3 miles | ❌ Barely | Google Maps, 1 minute |
| Road noise ~55 dB | ✅ Yes | The dB estimation from highway proximity is not easily done |
| Rail proximity | ✅ Yes | Checking for rail within 3 miles is not a common buyer task |
| Bortle 6 | ✅ Yes | Most buyers have never heard of the Bortle scale |
| AQI 19 Good | ❌ Fails | AirNow.gov, 30 seconds |
| Radon Zone 1 + cost | ✅ Yes | The cost context ($800-$2,500 mitigation) is Livably's |
| "Visit at 6-9am to hear aircraft" | ✅ Yes | This specific advice is excellent |

### What's Missing (Gaps)
1. **Air traffic direction missing** — we show airport distance but not whether this address is under a flight path. FR-034 Enhancement 2. A home 8 miles away on the approach path hears every landing. A home 8 miles away perpendicular to runways hears almost nothing.
2. **AQI is too thin** — "AQI 19 — Good" is a number anyone can look up. The insight would be: "Air quality here is better than 73% of US monitoring stations. Primary pollutant is ozone, which peaks in summer afternoons. Open windows in the morning."
3. **Water quality fallback is weak** — linking to EWG is not Livably's job. Either surface the actual water quality data or remove this section.
4. **EJSCREEN fallback is weak** — same issue. Either do the work or remove it.

### Narrative Quality Score: 2.5/5
Bortle scale and radon are strong. AQI and water quality fall back to external links.

### Recommended Improvements
- Add air traffic direction (FR-034 Enhancement 2)
- Deepen AQI with percentile context and practical implication
- Fix water quality — either surface EPA SDWA violation data properly or remove
- The Bortle scale is a gem — make it more visually prominent

---

## Chapter 13: Walkability

### What it currently shows
- Car-Dependent badge
- "This is car-dependent territory" narrative
- What's within walking distance (6 destinations)
- Pedestrian environment notes
- Walkability score (internal, not shown to buyer)

### 30-Minute Google Test

| Finding | Passes? | Why |
|---------|---------|-----|
| Car-Dependent classification | ✅ Yes | The framing and implication is Livably's |
| Walking destinations list | ❌ Barely | Google Maps walking directions, 3 minutes |
| "Plan your life around the car" narrative | ✅ Yes | The honest, non-judgmental framing is excellent |
| Aging-in-place implication | ✅ Yes | "Anyone who loses driving ability is significantly constrained" — this is a genuinely important insight most buyers don't consider |
| Pedestrian environment notes | ✅ Barely | Observable but not commonly documented |

### What's Missing (Gaps)
1. **The aging-in-place implication is buried** — this is one of the most important findings for any buyer over 50 or buying for aging parents. It deserves more prominence.
2. **No transit information** — for addresses near public transit this section should include bus routes, frequency, and nearest stop. For Georgetown it's correctly absent.
3. **Bike infrastructure** — for some buyers this matters. Currently absent.

### Narrative Quality Score: 3/5
The Car-Dependent narrative and aging-in-place implication are strong. Walking destinations list is weak.

### Recommended Improvements
- Give aging-in-place implication its own callout — it's too important to bury
- Remove or reduce walking destinations list if they're all obvious (Subway, Kroger)
- Add bike infrastructure note if relevant

---

## Chapter 14: Property Costs & Market

### What it currently shows
- Property tax rate vs national average
- Monthly carrying costs table ($300k/$400k)
- Homestead exemption note
- "Check Zillow for current values" note
- Key Takeaway

### 30-Minute Google Test

| Finding | Passes? | Why |
|---------|---------|-----|
| Property tax rate 0.83% | ❌ Barely | SmartAsset has this for every state |
| Monthly carrying cost table | ✅ Yes | The specific breakdown ($208 tax + $140 insurance + $190 utilities = $538) is not easily assembled |
| Homestead exemption | ✅ Yes | Many buyers don't know this exists |
| "Check Zillow for values" | ❌ Fails | We're literally redirecting them to our competitor |

### What's Missing (Gaps)
1. **Property tax trajectory** — is this parcel's assessed value trending up? By how much per year? This is the most important forward-looking financial finding we don't have.
2. **Insurance cost context** — $140/month is our estimate but doesn't account for flood, tornado, or other risk factors specific to this address. The climate chapter findings should feed into the cost estimate.
3. **HOA status** — does this address have an HOA? What are the fees? This is a significant cost variable completely absent from the report.
4. **"Check Zillow" is embarrassing** — we should either show current market data or frame the omission better. "We don't show current market values because they change daily and any number we show would be misleading. Your agent can pull a CMA in 5 minutes" is better.

### Narrative Quality Score: 2.5/5
Carrying cost table is strong, everything else is weak or embarrassing.

### Recommended Improvements
- Add property tax trajectory (5-year assessment trend)
- Add HOA detection and status
- Replace "check Zillow" with better framing
- Connect climate risk findings to insurance cost estimates
- Add utilities cost preview (connects to FR-032)

---

## Overall Assessment

### Chapters That Pass the 30-Minute Test Confidently
1. **What Will Grow Here** (4.5/5) — Livably's strongest differentiator
2. **Climate & Weather Risks** (4/5) — Zone X nuance and timing information are excellent
3. **Traffic Patterns** (3.5/5) — flat Georgetown traffic pattern is a genuine insight
4. **Schools & Education** (3.5/5) — the checklist and warning are excellent

### Chapters That Need Significant Deepening
1. **What Daily Life Looks Like Here** (2/5) — restates Daily Reachability with nicer words
2. **Daily Reachability** (2.5/5) — gas station fails the test, needs insight layer
3. **Demographics & Community** (2.5/5) — data is findable, needs trend data
4. **Property Intelligence** (2.5/5) — internet section is broken, health risks underweighted
5. **Property Costs & Market** (2.5/5) — "check Zillow" is the worst line in the report

### The Single Biggest Improvement
Add the Life at This Address Calculator (FR-033) to the Daily Life/Reachability section. This single addition transforms two weak chapters into one genuinely irreplaceable feature.

### The Single Worst Finding in the Report
"For current pricing: Zillow, Redfin, or Realtor.com all show recent sales." — We are literally redirecting buyers to competitors. Remove or reframe immediately.

### The Narrative Quality Problem
Most chapters show data with a warm paragraph. The gap between "showing data warmly" and "providing insight" is significant. The question every paragraph should answer is: **"So what does this mean for ME, buying THIS home, living THIS life?"**

The chapters that answer that question (What Will Grow Here, Climate, Traffic Patterns) are the strongest. The chapters that don't (Daily Reachability, Property Costs) are the weakest.

---

## Action Items by Priority

### Immediate (fix before any new features)
1. Remove gas station from Daily Reachability
2. Remove or reframe "check Zillow" in Property Costs
3. Fix AQI to include percentile context
4. Fix water quality — either surface real data or remove the section

### High Priority (next development cycle)
5. Add Life at This Address Calculator (FR-033) — transforms two weak chapters
6. Add hospital designation Level 1 vs community (FR-034 Enhancement 1)
7. Add air traffic direction (FR-034 Enhancement 2)
8. Add construction era health risks depth (FR-034 Enhancement 3)
9. Add property tax trajectory to costs chapter

### Medium Priority
10. Add the 10-Year Horizon to growth chapter (FR-034 Enhancement 5)
11. Add watershed/upstream context to climate chapter (FR-034 Enhancement 6)
12. Add microclimate context to garden chapter (FR-034 Enhancement 7)
13. Add enrollment trend and district financial health to schools chapter
14. Deepen owner-occupancy trend in community chapter

### Design Pass Needed
15. Aging-in-place implication in walkability needs its own callout
16. Development intel (Publix, Target) should lead the growth chapter more prominently
17. Bortle scale should be more visually prominent in sensory chapter
18. The 4 questions in schools chapter are excellent — make them more screenshot-worthy

---

*Every finding in Livably should be something a buyer couldn't easily find in 30 minutes of Googling, or something presented in a way that transforms data into genuine understanding. This audit identifies where we fall short and what to do about it.*
