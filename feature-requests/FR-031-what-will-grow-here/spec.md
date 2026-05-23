# FR-029 — "What Will Grow Here"
*Your yard, your soil, and what this land wants to become.*

---

## Gate 1: Conceptual Review

### What it covers:
A hyper-local yard and garden intelligence section that tells a buyer exactly what their land is capable of — soil type, drainage, hardiness zone, first/last frost dates, native plants that thrive here, invasive species to avoid, wildlife to expect, and what the yard could become with the right approach. Written with optimism and warmth. This is the "Cool Things to Know" bucket at its best.

### Quality Checks:

**ACTIONABLE — How does this change their decision or preparation?**
A buyer with a yard immediately starts thinking about it. This section gives them a head start:
- Hardiness zone tells them what survives winter before they spend $400 on plants that die
- Frost dates tell them when to plant, when to cover, when the season ends
- Soil type tells them whether to amend before planting or whether drainage will be a problem
- Native plant list gives them a starting point for a low-maintenance, thriving yard
- Invasive species list saves them from a costly mistake (English Ivy, Japanese Honeysuckle)

**REVEALING — What hidden thing does this show?**
Nobody tells you this during a showing. You learn your hardiness zone the hard way — after killing plants. You discover your soil drains poorly after the first heavy rain floods your basement. You find out deer eat everything after you've planted $600 of hostas. Livably hands you two years of hard-won yard knowledge before you sign.

**AVOIDS REGRET — What "I wish I knew" does this prevent?**
- "I wish I'd known the soil here needs amendment before planting anything"
- "I wish I'd known deer would eat my garden — I would have planted differently"
- "I wish I'd known English Ivy was invasive — it's taken over three neighbors' yards"
- "I wish I'd known the frost date — I lost an entire bed of seedlings"

**EXCLUSIVE — Can they get this elsewhere easily?**
Not synthesized like this. USDA hardiness zone is on a map. Frost dates are on a gardening site. Soil surveys are on a government portal nobody knows exists. Native plant lists are buried in state extension databases. Wildlife observations are on iNaturalist if you know to look. Nobody has combined all of this into a single, warm, address-specific narrative that tells a buyer what their yard could become. This is exclusively Livably.

### Score: 4/4
### Decision: MUST HAVE — Standard tier. This is a differentiator that makes the whole report feel more thoughtful and human. Every buyer gets this moment.

---

## Gate 2: Data Source Validation

### 1. USDA Plant Hardiness Zone
- **Source:** USDA Plant Hardiness Zone Map API
- **URL:** https://phzmapi.org/ (returns zone by lat/lng)
- **Type:** Free API, government data
- **Accuracy:** High — parcel-level based on coordinates
- **Freshness:** Updated periodically (last major update 2023)
- **Fallback:** USDA hardiness zone lookup by ZIP code

### 2. First & Last Frost Dates
- **Source:** NOAA Climate Normals / Dave's Garden frost date database
- **URL:** https://www.rcc-acis.org/docs_webservices.html (ACIS API, free)
- **Type:** Free API, NOAA-sourced
- **Accuracy:** High — based on nearest weather station, 30-year normals
- **Freshness:** Based on 1991-2020 climate normals
- **Fallback:** State-level average frost dates by region

### 3. Soil Type & Drainage
- **Source:** USDA Web Soil Survey — already implemented in FR-026
- **URL:** https://SDMDataAccess.nrcs.usda.gov/
- **Type:** Free API, government data
- **Accuracy:** High — survey-level, not parcel-specific but very close
- **Freshness:** Stable — soil surveys don't change
- **Already pulling:** Yes — Bluegrass-Maury silt loam for Georgetown

### 4. Native Plants
- **Source:** USDA PLANTS Database
- **URL:** https://plants.usda.gov/
- **Type:** Free, government database
- **Approach:** Query by state + county for native, non-invasive species
- **Filter:** Ornamental value + low maintenance + commonly available
- **Fallback:** Curated list by USDA hardiness zone

### 5. Invasive Species
- **Source:** USDA PLANTS Database invasive species list by state
- **URL:** https://plants.usda.gov/home/invasiveList
- **Type:** Free, government data
- **Approach:** Return top 5 most common invasives for the state
- **Fallback:** State-level invasive species list from state extension service

### 6. Wildlife
- **Source:** iNaturalist API — observations within 10 miles
- **URL:** https://api.inaturalist.org/v1/observations
- **Type:** Free API, citizen science data
- **Approach:** Query for common species observations near coordinates, filter for mammals and birds most relevant to homeowners (deer, rabbits, groundhogs, common birds)
- **Fallback:** State wildlife agency common species list

### 7. Bird Species
- **Source:** eBird API (Cornell Lab)
- **URL:** https://documenter.getpostman.com/view/664302/S1ENwy59
- **Type:** Free API with key, citizen science + scientific data
- **Approach:** Notable/common species within 10 miles, filter for backyard-relevant birds
- **Fallback:** Regional common backyard birds by USDA zone

---

## Gate 3: Narrative Review

### Section Title: What Will Grow Here
### Subheading: *Your yard, your soil, and what this land wants to become.*

### Sample Output (Georgetown, KY):

---

**Your Growing Conditions**

This property sits in USDA Hardiness Zone 6b — a forgiving climate for gardeners. You can grow a wide range of perennials, shrubs, and trees that return year after year without replanting. The last frost typically falls around April 15th, and the first fall frost arrives around October 15th — giving you a growing season of roughly 183 days. That's enough time for tomatoes, peppers, squash, and most vegetables to complete a full cycle.

**Your Soil**

The lot sits on Bluegrass-Maury silt loam — one of the more gardener-friendly soils in central Kentucky. It drains well, holds moisture without waterlogging, and has naturally good structure for root development. You won't need major amendment to grow most plants here. A layer of compost before planting and you're in good shape.

**What Grows Naturally Here**

These native plants thrive in Scott County without much help — they've been doing it for centuries:
- **Eastern Redbud** (Cercis canadensis) — stunning spring bloomer, drought tolerant once established, Kentucky's state tree
- **Wild Columbine** (Aquilegia canadensis) — attracts hummingbirds, partial shade tolerant
- **Black-Eyed Susan** (Rudbeckia hirta) — summer color, pollinator magnet, very low maintenance
- **Spicebush** (Lindera benzoin) — fall color, bird habitat, shade tolerant
- **Little Bluestem** (Schizachyrium scoparium) — native grass, winter interest, drought tolerant

**What to Avoid**

A few plants look appealing but cause real problems in this region:
- **English Ivy** — invasive, smothers native plants, damages tree bark
- **Japanese Honeysuckle** — fast-spreading, outcompetes natives
- **Bradford Pear** — brittle in ice storms, invasive fruit spreads seeds

**Wildlife You'll Share the Yard With**

White-tailed deer are common in Scott County — plan any garden with deer-resistant plants or fencing if you want to protect vegetables and ornamentals. Eastern cottontail rabbits are abundant. Common backyard birds include American Robin, Northern Cardinal, Carolina Wren, and Eastern Bluebird — a simple bird feeder and a water source will bring them close.

**The Opportunity**

A well-maintained yard in this zone with native plantings can become genuinely beautiful with relatively little effort. The soil cooperates, the rainfall is reliable (45 inches annually), and the growing season is long enough for almost anything you'd want to grow.

---

### Quality Checks:
- ✅ Would I read this entire section? Yes — it's specific and useful
- ✅ Does it answer questions as they form? Yes — zone, frost, soil, what to plant, what to avoid, wildlife
- ✅ Is this genuinely useful or just filler? Genuinely useful — saves real money and mistakes
- ✅ Would I need to Google for more info after reading? No — it's comprehensive for a homebuyer's needs
- ✅ Does this sound like a human wrote it? Yes — warm, optimistic, specific
- ✅ Does every sentence add value? Yes

### "So What?" Test: Passes. Every paragraph answers "why does this matter to ME?"

### The "Holy Crap" Moment:
"I can't believe they told me what plants are native to my specific county and what invasives to avoid. Nobody has ever given me this before."

---

## Gate 4: End-to-End Testing Requirements

### Test Addresses:
1. `100 Wishing Well Path Unit 2306, Georgetown, KY 40324` — suburban KY, Zone 6b
2. `456 Rural Route 1, Harlan, KY 40831` — rural Appalachian KY, different zone/soil
3. `123 Main St, Louisville, KY 40202` — urban KY, different soil/wildlife
4. `789 Main St, Bozeman, MT 59715` — very different climate, Zone 5b
5. `321 Oak Ave, Tupelo, MS 38801` — Deep South, Zone 7b, completely different flora

### Acceptance Criteria:
- [ ] Hardiness zone correct for all 5 addresses
- [ ] Frost dates specific to nearest weather station, not generic state average
- [ ] Soil type pulls from USDA Web Soil Survey (already implemented)
- [ ] Native plant list is state/county specific — Montana list is different from Kentucky list
- [ ] Invasive species list is state-specific
- [ ] Wildlife section reflects regional fauna — Montana gets different wildlife than Mississippi
- [ ] No hardcoded plant names or species — all pulled dynamically from APIs
- [ ] Graceful fallback for each data source if API unavailable
- [ ] Section renders correctly on mobile (375px)
- [ ] Tone is warm and optimistic throughout — never clinical, never alarming
- [ ] No Fair Housing language — describes land characteristics only, never neighborhood composition

### Reading Time Target: 2-3 minutes

---

## Implementation Notes

### Section Placement:
After Climate & Weather Risks, before Property Intelligence. It follows naturally from climate (zone, frost) into what that climate means for the yard.

### Tone Guidance:
This is the "Cool Things to Know" bucket. Write with genuine enthusiasm for what the land offers. Use words like "opportunity," "thrive," "flourish," "beautiful," "rewarding." This section should make a buyer excited about their yard before they even move in.

### What NOT to include:
- No lawn care schedules or maintenance checklists — too prescriptive
- No specific product recommendations — not our place
- No generic "consult a local nursery" — too vague, add a specific action instead
- No climate change projections — too speculative for this report

### One Specific Action Item:
End the section with: "Your local Cooperative Extension office has free soil testing and planting guides specific to your county. For Scott County: UK Cooperative Extension Service, 502-863-0984." — Named, specific, free resource.

---

## Estimated Build Effort
- USDA hardiness zone API: 2-3 hours (simple lat/lng lookup)
- NOAA frost dates: 2-3 hours (ACIS API)
- USDA native plants: 4-6 hours (state/county query + filtering)
- iNaturalist wildlife: 2-3 hours
- eBird birds: 2-3 hours
- Narrative rendering: 3-4 hours
- Testing across 5 addresses: 2-3 hours

**Total: ~1 day of focused Claude Code work**
