# Bozeman Report Audit — 789 Main St Bozeman MT 59715
**Generated:** May 23, 2026  
**Report size:** 76,013 bytes  
**Sections rendered:** 17  
**Fallbacks triggered:** 4  
**Bugs flagged:** 2

---

## Section-by-Section Summary

### Hero
**Rendered:** Yes  
**Key stats shown:**
- Coffee nearby: 1 min drive (Wild Joe's Coffee Spot)
- Groceries: 2 min drive
- Walkability: Somewhat Walkable
- Nearest school: 3 min drive

---

### At a Glance (Key Insights)
**Rendered:** Yes — 5 insights  

| Bucket | Insight |
|--------|---------|
| Cool Things to Know | FEMA Zone X — flood insurance not required |
| Things to Check | Nearest school is Stix Yarn (1 min) — assigned school unverified ⚠️ |
| Cool Things to Know | Bozeman Health Deaconess ER is 6 min away |
| Cool Things to Know | I-90 is 4 min away |
| Things to Check | EPA Radon Zone 1 — $15–$30 test before closing recommended |

---

### Chapter 1: Health & Safety
**Rendered:** Yes  
**Key data:**
- Fire: Fire Protction Services [sic — Google Places name], 0.3 mi, ~2 min **Excellent**
- Police: Montana State University Police, 1.3 mi, ~5 min **Excellent**
- ER: Bozeman Health Deaconess Regional Medical Center, 6 min
- Checklist: ISO PPC rating, drive ER route, test detectors on move-in

**Key Takeaway:** Fast fire response (~2 min) and close ER (6 min) are genuine safety assets. Get ISO PPC rating.

**Notes:** "Fire Protction Services" is the actual Google Places name (typo is theirs, not ours).

---

### What Daily Life Looks Like Here
**Rendered:** Yes (narrative insights chapter)  
**Key data:**
- Grocery: Bozeman Co-op Downtown 2 min, Joe's Parkway Market 2 min
- Pharmacy: Safeway Pharmacy 3 min
- Gas: Thriftway 0 min
- Hospital: Bozeman Health Deaconess 6 min
- Urgent Care: B2 UrgentCare Main Street 1 min
- Highway: I-90 4 min

---

### Daily Reachability (Core Services)
**Rendered:** Yes — 7 destination rows  

| Label | Name | Drive Time |
|-------|------|-----------|
| Grocery Stores | Bozeman Co-op Downtown, Joe's Parkway Market, Safeway | 2, 2, 3 min |
| Pharmacy | Safeway Pharmacy | 3 min |
| Hospital — Full ER | Bozeman Health Deaconess Regional Medical Center | 6 min |
| Urgent Care | B2 UrgentCare Main Street | 1 min |
| Highway Access | I-90 | 4 min |
| Gas Station | Thriftway | 0 min |
| School (Nearest by Distance) | **Stix Yarn** | 1 min |

**🐛 BUG-007: "Stix Yarn" (a yarn shop) is appearing as the nearest school.** Google's nearest-school search returned a misclassified place. The assigned-school disclaimer is present and correct, but the listed "school" is not a school. This is a false positive from the school search. The `findNearestElementarySchool`/`buildSchoolSection` pipeline returned an incorrect result.

---

### More Nearby Destinations
**Rendered:** Yes  

| Label | Name | Drive Time |
|-------|------|-----------|
| Elementary School | Hawthorne Elementary School | 3 min |
| Park | Defenders of Wildlife | 2 min |
| Coffee Shop | Wild Joe's Coffee Spot | 1 min |

**Note:** "Defenders of Wildlife" (the conservation advocacy org) appears as the nearest park — Google Places classified it as a park/outdoor location. Not a true public park. Low-severity issue.

---

### Traffic Patterns
**Rendered:** Yes — 2 destinations tracked  

| Destination | 8am Mon | 12pm Mon | 5pm Mon | 10am Sat | Range |
|-------------|---------|----------|---------|----------|-------|
| Bozeman Co-op Downtown | 2 min | 2 min | 2 min | 2 min | 2–2 min |
| Bozeman Health Deaconess ER | 6 min | 7 min | 7 min | 6 min | 6–7 min |

**Notes:** Near-zero variation on grocery reflects how close this address is to downtown (0.1 mi). Hospital shows slight peak-hour increase (6→7 min).

---

### Schools & Education
**Rendered:** Yes — 3 public + 5 private  

**Public schools:**
| Level | Name | Distance | Drive |
|-------|------|----------|-------|
| Elementary | Hawthorne Elementary School | 0.8 mi | 3 min |
| Middle | Sacajawea Middle School | 2.5 mi | 8 min |
| High | Bozeman High School | 0.3 mi | 1 min |

**Private schools within 10 miles:**
- Irving School — 0.4 mi
- Headwaters Academy — 0.5 mi
- Bozeman Field School — 1.4 mi
- Petra Academy — 2.8 mi
- Mount Ellis Academy — 4.8 mi

**Key Takeaway:** 3 min to nearest elementary — confirm assigned school before assuming.  
**Assigned school alert present:** Yes  
**4-question checklist present:** Yes

---

### Safety & Emergency Response
**Rendered:** Yes  
**Key data:**
- Police: Montana State University Police, 1.3 mi, ~5 min **Excellent**
- Fire: Fire Protction Services, 0.3 mi, ~2 min **Excellent**
- ISO PPC note: present (asks agent for address-specific rating)
- 4 research items: crime map, neighborhood watch, community resource officer, ISO rating

**Key Takeaway:** Police 5 min excellent — check ISO rating with insurance agent.

---

### Demographics & Community
**Rendered:** Yes  
**Key data:**
- Age: 45% age 18–34, 10% under 18, 33% age 35–64, 12% 65+, median age 33.2
- Income: **$76,898** — badge: "Above national median" (gold, neutral — FH fix confirmed ✅)
- Income narrative: "$76,898 — $2,000 above the national median of $74,580. Census tract level, not block-specific." ✅
- Education: 37% Bachelor's, 29% Graduate — badge: "Very highly educated"
- Community: Suburban, Singles and young professionals, 44% homeownership, ~9 yr median tenure, 1.97 avg HH size
- Synthesis: "young and professionally active, predominantly renter, college-educated workforce"

**Key Takeaway:** Singles/young professionals character, 44% ownership, median age 33.2 is the daily neighborhood baseline.

**Fair Housing compliance:** Income narrative is factual only (no neighborhood quality characterization). ✅

---

### Growth & Development
**Rendered:** Yes  
**Key data:**
- Named project: **"Official" — Major Retail — Planned** (automated, news search, November 2024)
- New construction: 10% of housing built after 2010
- Commercial within 0.5 mi: Bozeman Community Food Co-op 0.1 mi, Breathelight Yoga 0.3 mi, Bozeman Film Society 0.4 mi, Your Yoga Bozeman 0.5 mi, American Bank 0.6 mi, Downtown Bozeman Partnership 0.7 mi

**Key Takeaway:** 1 confirmed development project nearby.

**⚠️ MINOR FLAG:** The automated news search returned a project named **"Official"** — this is likely a news article title artifact, not the actual retail chain name. The automated note ("verify with Gallatin County Planning & Zoning") is present, but the project name renders as meaninglessly vague.

---

### Climate & Weather Risks
**Rendered:** Yes  
**Key data:**
- Flood zone: **FEMA Zone X** — minimal risk, no federal insurance requirement
- 25% of NFIP claims still from Zone X noted
- Preferred-risk policy ~$300–$500/year mentioned
- Tornado frequency: Moderate (MT)
- 4-item checklist: verify at msc.fema.gov, elevation certificate, flood quote, storm shelter/drainage

**Key Takeaway:** Zone X confirmed. Zone X still accounts for 1 in 4 NFIP claims.

---

### What Will Grow Here (FR-031)
**Rendered:** Yes  
**Key data:**
- USDA Zone: **5a** (winter low -20 to -15°F)
- Growing season: **April 25 – October 5, 163 days**
- Soil: Urban land (no USDA drainage classification — altered by development)
- Native plants (6): arrowleaf balsamroot, chokecherry, Alaska Rein Orchid, Fairy-slipper, sticky geranium, prairie pasqueflower
- Invasive to avoid (5): tansy, hoary alyssum, musk thistle, creeping thistle, white campion
- Wildlife: White-tailed Deer, Richardson's Ground Squirrel, American Red Squirrel, Mountain Cottontail
- Birds: Black-billed Magpie, Mallard, American Robin, Red-winged Blackbird, American Goldfinch
- Extension CTA: Montana State University Extension — www.msuextension.org

**Key Takeaway:** 163-day season. Native plants built for these winters and summers.

---

### Property Intelligence
**Rendered:** Yes  
**Key data:**
- Construction era: **1961 median year built** (1960s–70s tract), 10% after 2010
- Inspection checklist: lead paint (pre-1978), asbestos in tiles/insulation/ceilings, galvanized plumbing near end of life
- Soil: Urban land — no drainage rating, geotechnical evaluation recommended
- Internet: **FALLBACK** — FCC data not accessible; link to broadbandmap.fcc.gov provided ✅
- Tax/Permit: Gallatin County Assessor link (dynamically generated) ✅

**Key Takeaway:** Internet not confirmed via FCC — verify with local providers before committing.

**Fallbacks triggered:** 1 (FCC broadband). Both fallbacks include actionable links. ✅

---

### Sensory & Environmental
**Rendered:** Yes  
**Key data:**
- Airports: Briar Creek Airport-2mt5 7.7 mi; Bozeman Yellowstone International 8.8 mi
- Road noise: **~65 dB** (at FHWA 65 dB residential threshold; estimated from highway proximity)
- Rail: none within 3 miles
- Light pollution: **Bortle 6** — bright suburban sky, Milky Way at threshold of visibility
- Air quality: **FALLBACK** — not available; link to airnow.gov ✅
- Water quality: **FALLBACK** — not accessible; link to EWG Tap Water Database ✅
- Radon: **Zone 1** (high) — $15–$30 test recommended, $800–$2,500 mitigation if elevated
- EJSCREEN: **FALLBACK** — API not accessible; link to EPA EJSCREEN mapper ✅

**Key Takeaway:** Airport 7.7 mi away — visit 6–9am weekdays to gauge actual noise.

**Fallbacks triggered:** 3 (air quality, water quality, EJSCREEN). All include actionable links. ✅

---

### Getting Around on Foot
**Rendered:** Yes  
**Walkability verdict:** Somewhat Walkable  
**Walkable destinations:**

| Name | Type | Walk Time | Distance |
|------|------|-----------|----------|
| Babcock & 7th | Transit | 2 min | 404 ft |
| Bozeman Community Food Co-op - West Main | Grocery | 2 min | 490 ft |
| Mendenhall & 9th | Transit | 2 min | 557 ft |
| Papa Johns Pizza | Dining | 6 min | 0.3 mi |
| Defenders of Wildlife | Park | 6 min | 0.3 mi |
| Cooper Park | Park | 6 min | 0.3 mi |
| Subway | Dining | 7 min | 0.4 mi |

**Pedestrian environment:** Sidewalks on main roads, some crossings; limited side street coverage  
**Key Takeaway:** Walkable for some trips, car still needed for most. Car-dependency note for non-drivers present.

---

### Property Costs & Market
**Rendered:** Yes  
**Key data:**
- MT tax rate: **0.74%** (near national average)
- Monthly carrying costs (ex-mortgage):

| Home Price | Tax | Insurance | Utilities | Total |
|-----------|-----|-----------|----------|-------|
| $300,000 | $185 | $129 | $165 | **$479** |
| $400,000 | $247 | $172 | $165 | **$584** |

- Homestead exemption: not shown (MT may not have a note)
- Valuation redirect: Zillow/Redfin/Realtor.com

**Key Takeaway:** $479/month carrying costs for $300k home before mortgage.

---

## Fallbacks Summary

| Section | Fallback Triggered | Fallback Quality |
|---------|-------------------|-----------------|
| Property Intelligence — Internet | FCC data not accessible | ✅ Links to broadbandmap.fcc.gov |
| Sensory — Air Quality | EPA AirNow not available | ✅ Links to airnow.gov |
| Sensory — Water Quality | EPA SDWIS not accessible | ✅ Links to EWG Tap Water Database |
| Sensory — EJSCREEN | API not accessible | ✅ Links to ejscreen.epa.gov |

All fallbacks include actionable links. No section rendered as a dead-end "Not available."

---

## Bugs and Issues

### 🐛 BUG-007: "Stix Yarn" returned as nearest school (Daily Reachability section)

**Severity:** Medium — misleading data in the standard (non-premium) school section  
**Symptom:** The "School (Nearest by Distance)" row in Daily Reachability shows "Stix Yarn" (a yarn craft shop at 821 West Mendenhall Street) as the nearest school, 1 minute away.  
**Why it happened:** The `buildSchoolSection` function uses a different query path than `findNearestElementarySchool`. The former appears to be pulling a Google Places result that Google has miscategorized (or the search keyword "school" matched a word in the business description/metadata). Hawthorne Elementary correctly appears in the premium Schools section (3 min) and the More Nearby Destinations section.  
**Impact:** The At-a-Glance Key Insight reads "The nearest school is Stix Yarn (1 min)" — this will confuse buyers.  
**Fix needed:** Investigate the query feeding `buildSchoolSection` and add name validation (exclude results whose names don't contain school-related keywords, or use a type filter instead of keyword search).

### ⚠️ MINOR FLAG: Growth project named "Official" (Growth & Development section)

**Severity:** Low — cosmetic  
**Symptom:** An automated news-sourced project is named "Official" (type: Major Retail, status: Planned). This is almost certainly a news article title fragment, not the retailer's name.  
**Impact:** Renders as a vague, unhelpful entry. The automated disclaimer ("verify with Gallatin County Planning & Zoning") is present.  
**Fix needed:** Review the growth project news search logic to filter or truncate article title artifacts before they become project names.
