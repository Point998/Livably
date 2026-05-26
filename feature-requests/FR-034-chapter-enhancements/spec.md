# FR-034 — Chapter Enhancements
*Six targeted additions to existing chapters*

---

## Enhancement 1: Healthcare Depth
**Chapter: Health & Safety**

### What to Add
Beyond ER and urgent care — the depth of the healthcare ecosystem at this address.

### Findings to Surface
- Primary care physicians accepting new patients within 15 min (CMS NPI database)
- Nearest hospital designation (Level 1 Trauma vs Level 2 vs Community) — matters for serious emergencies
- Specialist availability — is there an oncologist, cardiologist, pediatric specialist within 30 min?
- Telehealth context — for rural addresses where specialists are distant

### Sample Output
"Centerpoint Health is a community hospital — not a Level 1 trauma center. For major trauma or complex cardiac events, UK HealthCare in Lexington (29 min) is the nearest Level 1 facility. For everyday healthcare, there are 14 primary care practices within 15 minutes, several accepting new patients."

### Data Sources
- CMS Provider of Services file — hospital designations
- CMS NPI Registry — physician locations and specialties
- HRSA — health professional shortage areas

### Why It Matters
A buyer with a chronic condition, young children, or aging parents is making a healthcare infrastructure decision, not just a home purchase decision. Nobody surfaces this.

---

## Enhancement 2: Air Traffic Direction
**Chapter: Sensory & Environmental**

### What to Add
Not just airport distance — whether this address is under a flight path.

### Findings to Surface
- Is this address within 3 miles of a published approach or departure path?
- Which runways are active and in which direction?
- Time of day pattern — early morning departures, late night arrivals?
- "Visit at 7am on a weekday to hear actual departure frequency"

### Sample Output
"Georgetown-Scott County Regional Airport is 8.3 miles away. This address is not under published approach or departure paths — aircraft noise is unlikely to be a factor. Blue Grass Airport in Lexington (10.4 mi) has approach paths that run south of Georgetown — this address is not in the primary noise corridor."

vs. for an address under a flight path:
"This address sits within 0.8 miles of the primary ILS approach path for Runway 22. Arriving aircraft typically pass at 2,000-3,000 feet. Visit on a weekday morning between 6-9am to hear actual frequency and volume before committing."

### Data Sources
- FAA NASR database — runway orientations and approach paths
- FAA flight path data — published instrument approaches
- OpenFlights — airport runway data

### Why It Matters
Two homes equidistant from an airport can have completely different noise realities. Distance alone is misleading.

---

## Enhancement 3: Construction Era Health Risks
**Chapter: Property Intelligence**

### What to Add
What the home's construction era means for specific health and safety considerations.

### Era-Specific Findings

**Pre-1978 homes:**
- Lead paint — federally required disclosure but buyers often don't understand implications
- "Any painted surface disturbed during renovation requires lead-safe practices"
- Cost of full lead abatement if desired: $10,000-$30,000 typical

**Pre-1980 homes:**
- Possible asbestos in: popcorn ceilings, floor tiles, pipe insulation, siding, roof shingles
- "Undisturbed asbestos is not a health risk — disturbed during renovation is"
- Testing cost: $250-$800, abatement if needed: $1,500-$30,000+

**Pre-1986 homes:**
- Possible lead service lines for water supply
- EPA's Lead and Copper Rule — utility required to test
- "Ask the water utility for lead service line records for this address"

**1980s-1990s homes:**
- Synthetic stucco (EIFS) if applicable — moisture intrusion risk
- Polybutylene plumbing (1978-1995) — known failure issues, check if replaced
- Aluminum wiring (1965-1973) — fire risk if not updated

**2000s+ homes:**
- Chinese drywall (2004-2007 construction) — sulfur compounds, corrosion
- Ask for documentation if built 2004-2007

### Sample Output
"Built in the 1970s, this home falls in the era where lead paint and possible asbestos-containing materials are a real consideration. This doesn't mean they're present — but your inspector should specifically test for both. Budget $500-$1,000 for comprehensive testing. If found, get remediation quotes before closing, not after."

### Data Sources
- Construction era already in the report (Census ACS)
- EPA lead paint guidance
- CPSC polybutylene plumbing records

### Why It Matters
The home inspection will flag obvious issues. But most buyers don't know what questions to ask their inspector about era-specific risks until after they've moved in.

---

## Enhancement 4: Civic Infrastructure
**Chapter: Daily Reachability — "More Nearby" section**

### What to Add
The invisible quality-of-life infrastructure that buyers from cities assume exists everywhere.

### Findings to Surface
- Public library branch: name, distance, hours
- Community/recreation center: name, distance, programming note
- Public park system: nearest park with amenities (already partially there)
- Post office: distance (surprisingly important for rural buyers)
- Government services: DMV, county courthouse distance

### Sample Output
```
CIVIC INFRASTRUCTURE
Public Library        Scott County Public Library    4 min
Recreation Center     Georgetown Recreation Center   6 min
Post Office           Georgetown Main Post Office    3 min
County Services       Scott County Courthouse        5 min
```

### Why It Matters
A buyer moving from Chicago to Georgetown assumes a public library and recreation center exist. A buyer moving from rural Kentucky to a suburb might not think to check. Both need this information — it affects quality of life profoundly and invisibly.

### Data Sources
- Google Places (type: library, community_center, post_office)
- Already using Google Places API — minimal additional cost

---

## Enhancement 5: The 10-Year Horizon
**Chapter: Growth & Development**

### What to Add
A forward-looking section that synthesizes documented trends into an honest picture of where this area is headed.

### Signals to Combine
- Population trend: Census 2010→2020→ACS estimate direction
- School enrollment trend: growing or shrinking district (NCES data)
- Commercial vacancy context: active development vs stagnation
- Infrastructure investment: planned road/utility projects (already in growth chapter)
- Employment base: major employers and their stability

### Sample Output
"Georgetown has grown steadily — Scott County added 8,400 residents between 2010 and 2020, a 17% increase driven partly by Toyota's manufacturing presence. School enrollment is growing. Commercial development (Publix, Target) reflects continued retail investment. The 10-year signals here point toward continued modest growth rather than decline."

vs. for a declining area:
"This county lost 4% of its population between 2010 and 2020. School enrollment has declined 12% in the last decade. Commercial vacancy on the main corridor is visible. These are documented trends — not predictions — but worth factoring into a long-term ownership decision."

### Tone
Honest, not alarming. Present documented trends, not predictions. "These are the signals — you decide what they mean for your decision."

### Data Sources
- Census decennial + ACS — population trends
- NCES — school enrollment trends by district
- BLS QCEW — employment by county
- Already have commercial development context

---

## Enhancement 6: Watershed & Upstream Context
**Chapter: Climate & Weather Risks**

### What to Add
Where does water flow toward this address from? What's uphill and upstream?

### Findings to Surface
- Is this parcel in a drainage basin that concentrates runoff?
- Is the parcel uphill, midslope, or at the base of a drainage area?
- Are there retention ponds, detention basins, or drainage easements nearby?
- What's upstream — agricultural land (fertilizer/pesticide runoff), industrial sites, other residential?
- Historical flood events at this specific location (FEMA NFHL claims data)

### Sample Output
"This parcel sits in the middle of a gently sloping residential area — not at the base of a drainage basin. Runoff from uphill streets flows toward Cane Run Creek approximately 0.4 miles away, not directly toward this address. No upstream agricultural or industrial operations identified within the watershed."

vs. for a concerning address:
"This parcel sits at the low point of a 60-acre drainage basin. During heavy rainfall events, runoff from the subdivision uphill converges at this elevation. The FEMA flood zone designation (Zone X) reflects the absence of riverine flooding risk — but local stormwater drainage events are a separate consideration. Ask the seller specifically about basement or yard flooding during heavy rain."

### Data Sources
- USGS National Elevation Dataset — topographic context
- USGS StreamStats — watershed delineation
- FEMA NFHL — flood claims history
- EPA WATERS — watershed boundaries

---

## Enhancement 7: Microclimate Context
**Split between: What Will Grow Here + Climate & Weather**

### What to Add
How this specific address differs from the official regional climate record.

### Findings to Surface
**For What Will Grow Here:**
- Elevation difference from nearest weather station
- "Expect frost 1-2 weeks earlier/later than regional average" if elevation differs significantly
- Sun angle in December vs June — south-facing slope gets more winter sun
- Prevailing wind direction — affects heating costs, garden placement

**For Climate & Weather:**
- Urban heat island effect if applicable (city addresses run 2-5°F warmer)
- Cold air drainage — valley addresses get more frost than hilltop addresses
- Fog frequency for valley/river addresses

### Sample Output (garden section)
"This address sits at 935 feet elevation — about 180 feet higher than the Georgetown weather station. Expect frost 1-2 weeks earlier in fall and later in spring than the regional average suggests. The growing season may be closer to 160-165 days rather than the regional 183 days."

### Data Sources
- USGS NED — elevation at coordinates
- NOAA GHCN — nearest weather station elevation and location
- EPA EnviroAtlas — urban heat island data
- NOAA — prevailing wind by region

---

## Implementation Priority Order
1. Healthcare Depth (Health & Safety) — high impact, clear data source
2. Air Traffic Direction (Sensory) — we're halfway there, FAA data available
3. Construction Era Health Risks (Property Intelligence) — mostly logic, minimal new APIs
4. Civic Infrastructure (Daily Reachability) — Google Places already integrated
5. The 10-Year Horizon (Growth & Development) — Census data already pulling
6. Watershed & Upstream (Climate) — USGS APIs, moderate complexity
7. Microclimate (Garden + Climate) — NOAA + USGS, moderate complexity
