# Livably — Product Backlog
*Ideas, enhancements, and future features captured from planning sessions*
*Not all of these are committed — this is a capture system, not a commitment list*
*Last updated: May 2026*

---

## How This Works
- Ideas go here immediately when discussed — even half-formed
- When an idea is ready to build, it graduates to a proper FR spec in feature-requests/
- Items marked [FR-XXX] already have a spec written
- Items marked [ENHANCEMENT] belong in an existing chapter
- Items marked [NEW CHAPTER] need a new FR spec before building

---

## Queued Feature Requests (Spec Written)

- [FR-031] What Will Grow Here — yard, soil, native plants, wildlife ✅ Built
- [FR-032] Utilities Intelligence — electric, gas, water, internet, EV charging
- [FR-033] Life at This Address Calculator — weekly mileage, lifestyle profiles, EV
- [FR-034] Chapter Enhancements — 7 additions to existing chapters
- [FR-035] Logic Layer — validate.js, jurisdictional coherence, rural mode
- [FR-036] Utilities extraction — shared utils
- [FR-037] Data Layer extraction — src/data/ modules
- [FR-038] Template components — shared HTML components
- [FR-039] Chapter templates — one file per chapter
- [FR-040] Test suite — automated tests for all business rules
- [FR-041] Services and routes — reportBuilder.js

---

## The Life at This Address Calculator (FR-033 Detail)
*Discussed in depth — capture the specifics*

Interactive calculator at the end of Daily Reachability chapter.

**Lifestyle profiles:**
- Remote Worker (0 commute days)
- Office Commuter (adjustable days/week)
- Family with Kids (adds school runs)

**Sliders:**
- Days commuting to work per week (0-5)
- Commute destination (nearest employment centers)
- Kids in school (toggle)
- Weekly grocery trips (1-3)
- Monthly trips to nearest large city (0-4)

**Output:**
- Weekly miles breakdown by trip type
- Annual miles estimate
- Annual cost at IRS rate ($0.21/mi)
- Annual cost at avg gas prices
- EV equivalent annual cost
- Nearest Level 2 charger location + drive time
- Nearest DC Fast Charge + drive time
- Home charging feasibility note

**Example for Georgetown KY:**
Commute 3 days to Lexington (24mi each way) + school runs + groceries + city trips = ~131 mi/week = 6,812 mi/year = $1,431/year IRS rate

---

## Utilities Intelligence (FR-032 Detail)
*Key data points to capture*

- Electric provider name and type (municipal vs co-op vs investor-owned)
- Average residential rate (cents/kWh) vs state average
- Annual outage frequency and average duration (NERC SAIDI/SAIFI)
- Natural gas availability (or propane/electric-only note)
- Municipal water vs well detection
- Municipal sewer vs septic detection
- Recycling availability (rural areas often have none)
- Internet: all ISPs, technology type, actual vs advertised speeds
- EV charging context: monthly cost estimate at local rate

---

## Chapter Enhancements Captured (FR-034 Detail)

**Health & Safety:**
- Healthcare depth: primary care physicians accepting new patients within 15 min
- Hospital designation: Level 1 Trauma vs Level 2 vs Community
- Specialist availability within 30 min

**Sensory & Environmental:**
- Air traffic direction: is this address under a flight path or not?
- FAA approach/departure path data, not just airport distance

**Property Intelligence:**
- Construction era health risks: lead paint (pre-1978), asbestos (pre-1980), lead pipes (pre-1986), polybutylene plumbing (1978-1995)
- Deed restrictions and HOA CC&Rs: what you can't do with the property
- Sun angle + seasonal access: what does this address look like in February?

**Daily Reachability:**
- Civic infrastructure: library, community center, recreation center, post office
- These are invisible quality-of-life infrastructure buyers from cities assume exist

**Growth & Development:**
- 10-Year Horizon: population trend direction, school enrollment trend, commercial vacancy
- Documented signals, not speculation

**Climate & Weather Risks:**
- Watershed and upstream context: where does water flow toward this address from?
- Is this parcel at the base of a drainage basin?
- What's upstream (agricultural, industrial, residential)?

**What Will Grow Here:**
- Microclimate context: elevation difference from nearest weather station
- "Expect frost 1-2 weeks earlier/later than regional average"
- Sun angle in December vs June
- Prevailing wind direction

---

## Design Ideas Captured

**The Livably Sketch**
Hand-drawn house that comes to life as the buyer scrolls through the report.
- Starts as bare outline on report load
- Each chapter adds elements: trees, paths, neighbors, stars, plants
- By end of report the house is fully realized in its world
- Color wash at the end tints each element with chapter colors
- Spec written: LIVABLY-SKETCH-SPEC.md

**Claude Design Exploration**
- First version: beautiful editorial magazine style, warm cream/rust palette
- Second version: "The Livably Almanac" — broadside meets almanac, extraordinary typography
- Direction: eclectic, sophisticated, intriguing, clever — each chapter its own visual personality
- Departure board layout for Daily Reachability was exceptional — keep this
- Currently: design exploration ongoing in Claude Design (claude.ai)

**Report as Discovery Experience**
- Dark homepage portal → warm cream report body
- Chapters animate in as you scroll
- Drive time counters count up from 0
- One "wow moment" per chapter
- No map (removed — was distracting from content)

---

## Product Direction Decisions Captured

**No scoring — ever**
The three-bucket framework (Things to Consider / Things to Check / Cool Things to Know) is the only evaluation system. No numerical scores, no grades, no rings.

**All chapters standard (no premium tier)**
Premium upsell removed. Every buyer gets the full report. Monetization via agent subscriptions and API licensing when ready.

**Pricing direction (not decided)**
- Option A: $9.99 per report, all standard
- Option B: Agent subscriptions for bulk access
- Option C: API licensing for real estate platforms
- Decision deferred until product is solid

**The unique differentiators**
Things Livably has that nobody else has:
1. What Will Grow Here (native plants, wildlife, frost dates, soil)
2. The Life at This Address Calculator (weekly mileage by lifestyle)
3. Utilities Intelligence (outage history, well/septic detection)
4. Construction era health risks
5. Watershed and upstream context
6. The Livably Sketch (when built)
7. Narrative quality — reads like a knowledgeable friend, not a dashboard

**What Livably is NOT**
- Not a restaurant finder (Yelp)
- Not a walk score (already exists)
- Not a crime map (Fair Housing risk)
- Not a home valuation (that's Zillow)
- Not a home inspection (that's a licensed inspector)
- Not investment advice

---

## Architecture Decisions Captured

**Module structure adopted from ASAI**
Each chapter = one module with four files:
- data.js (API calls only)
- logic.js (business rules only)
- template.js (HTML only)
- index.js (public interface)

**The Logic Layer**
src/shared/validate.js owns all cross-module coherence:
- State boundary enforcement
- Drive time coherence
- Rural mode detection
- Fair Housing compliance

**Test-first requirement**
No module ships without tests. Every business rule has a test. Jeffersonville IN is always a test case.

**Docs structure mirrors ASAI**
- docs/postmortems/ — PM-XXX for every production bug
- docs/nathan-reports/ — NR-XXX for owner strategic reviews
- docs/plans/ — architecture and workflow plans
- docs/engineering-decisions/ — why decisions were made

---

## Ideas Not Yet Evaluated

*Raw ideas — need more thought before committing*

- **Power outage history by address** — NERC/EIA data, how often and how long
- **Local government financial health** — bond ratings, pension funding, budget trends
- **Cell signal inside the house** — tower proximity and direction, construction era
- **Aging-in-place reality** — single floor vs multi, primary care accepting patients, medical transport
- **Seasonal road access** — is this road passable year-round? Flood-prone seasonally?
- **What's upstream and uphill** — partially captured in FR-034, needs full spec
- **The 10-year horizon** — population trend, school enrollment, commercial vacancy
- **Emergency preparedness** — evacuation routes, nearest shelter, FEMA disaster history
- **Internet speed reality vs advertised** — M-Lab/Ookla actual speed data near address
- **Property boundary and easement reality** — utility easements, drainage easements

---

## Tagline Candidates
*From copywriting session — not decided*

- "The place you're about to call home." (current homepage headline)
- "The address is just the beginning." (current homepage subhead)
- "You found your home. Now discover what comes with it."
- "Know before you sign."
- "The things worth knowing before you sign."
- "See beyond the listing."

---

## Browser Tab Title
*Currently shows old text — needs update*
Should be: "Livably" or "Livably — The address is just the beginning"

---

*Add new ideas here as they come up. Graduate to FR specs when ready to build.*
