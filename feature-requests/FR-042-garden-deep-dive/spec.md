# FR-042 — What Will Grow Here: Deep Dive
*Progressive disclosure expansion of the garden chapter*
*May 2026*

---

## Gate 1: Conceptual Review

### What it covers
A deep expansion of the existing What Will Grow Here chapter using progressive disclosure. The current chapter (Level 2) stays exactly as-is. This spec adds Level 3 — a full botanical and wildlife reference guide organized into tabbed sections that serious gardeners, nature lovers, and curious buyers can explore at their own depth.

### The Three Levels
**Level 1 (skim — always visible):**
Zone + season length + 3 native plants + wildlife summary badge

**Level 2 (read — current chapter):**
Existing content: hardiness zone, frost dates, soil, 6 native plants, 5 invasives, wildlife paragraph, extension CTA

**Level 3 (deep dive — new, expandable):**
Full tabbed reference guide covering trees, shrubs, perennials, edibles, ground covers, birds by season, insects/pollinators, mammals, the seasonal calendar, and invasive species with removal guidance

### Quality Checks

**ACTIONABLE:** A buyer with a yard gets a complete planting guide specific to their zone, soil, and county before they move in. They know what to plant when, what wildlife to expect month by month, and what invasives to watch for.

**REVEALING:** "Put up a bluebird box facing southeast by March 15 — Zone 6b with this soil profile has excellent bluebird habitat. They'll be nesting by April" — this combines 4 data sources into one specific actionable sentence nobody else provides.

**AVOIDS REGRET:** "I wish I'd known deer would eat everything" / "I wish I'd known English Ivy would take over" / "I wish I'd known I could grow persimmons here" — all answered before move-in.

**EXCLUSIVE:** County-specific native plant list + iNaturalist wildlife observations + eBird seasonal bird data + USDA soil + frost dates + construction era tree maturity context. Not a 30-minute Google result. Not a 3-hour Google result.

**Score: 4/4 — MUST BUILD**

---

## Gate 2: Data Sources

### Existing (already implemented, reuse)
- USDA Plant Hardiness Zone API (phzmapi.org) — zone by ZIP
- NOAA ACIS — frost dates
- USDA Web Soil Survey — soil type and drainage
- iNaturalist API — wildlife observations within 10 miles
- eBird API — bird species observations

### New data needed for Level 3

**USDA PLANTS Database — expanded queries**
- Current: 6 native plants, 5 invasives
- Level 3: Full native plant list by growth form (tree/shrub/perennial/grass/vine) by state+county
- Filter by: native status = N, growth habit = tree/shrub/forb, active growth = Y
- URL: https://plants.usda.gov/home/plantProfile
- API: https://plantsservices.sc.egov.usda.gov/

**eBird — seasonal breakdown**
- Current: top backyard birds combined
- Level 3: birds by season (year-round, spring, summer, fall, winter)
- Query: eBird recent observations by species seasonal occurrence
- Filter: backyard-relevant species (exclude pelagic, rare vagrants)

**iNaturalist — expanded categories**
- Current: mammals + birds combined
- Level 3: separate queries for mammals, reptiles, amphibians, insects/pollinators, butterflies
- Filter by: research-grade observations, within 10 miles, common species

**Monarch Watch — milkweed zone**
- Is this address in the Monarch Waystation zone?
- What milkweed species are native to this county?
- URL: https://www.monarchwatch.org/milkweed/

**Firefly Atlas (if available)**
- Firefly habitat suitability for this location
- Source: Firefly Atlas / MassAudubon citizen science data

---

## Gate 3: Content Specification

### Tab 1: Trees
**Canopy Trees (40+ feet)**
- 3-4 species native to this county that reach full canopy height
- Each entry: common name, botanical name, growth rate, fall color, wildlife value, one sentence of character
- Example: "Bur Oak (Quercus macrocarpa) — slow growing but generational. Acorns feed 500+ wildlife species. Plant one and it will outlive your ownership."

**Understory Trees (15-40 feet)**
- 3-4 species for the mid-layer
- Focus on flowering trees with wildlife value
- Example: "Eastern Redbud (Cercis canadensis) — Kentucky's state tree. First to bloom in spring, often before leaves emerge. Hummingbirds arrive just as it peaks."

**Fruit Trees for Zone 6b**
- 3-4 edible trees that reliably produce in this zone
- Chill hours required vs average chill hours for this location
- Example: "American Persimmon (Diospyros virginiana) — native, no spray needed, deer-resistant trunk. Fruit ripens after first frost. Wildlife magnet."

### Tab 2: Shrubs
**Native Flowering Shrubs**
- 4-5 species with bloom times creating a season-long sequence
- Each entry: bloom time, height, sun/shade, wildlife value

**Edible Native Shrubs**
- Elderberry, Gooseberry, Spicebush (berries edible)
- Practical growing notes

**Foundation Shrubs**
- What won't outgrow its space in Zone 6b
- What handles this soil type

### Tab 3: Perennials
**Spring (March-May)**
- 3-4 species with bloom time, height, sun requirement

**Summer (June-August)**
- 3-4 species — focus on pollinator value

**Fall (September-October)**
- 3-4 species — goldenrod, asters, etc.

**The Full Season Sequence**
A simple visual timeline showing what blooms when — so the yard has color from March through November

### Tab 4: Edibles
**Vegetables that thrive in Zone 6b**
- Cool season: kale, spinach, peas, lettuce (plant March-April, Sept-Oct)
- Warm season: tomatoes, peppers, squash, beans (plant after May 1)
- What to plant when — based on ACTUAL frost dates for this address

**What struggles here**
- Crops that need longer seasons or cooler summers
- Honest about limitations

**Soil amendment for this specific soil**
- Bluegrass-Maury silt loam: what to add, what you don't need

### Tab 5: Wildlife — Birds by Season

**Year-Round Residents**
Northern Cardinal, Carolina Wren, Downy Woodpecker, Black-capped Chickadee
"These species will be at your feeders every day of the year."

**Spring Migrants (April-May)**
What passes through this location during spring migration
"Georgetown sits near the edge of the Central Flyway. In May, warblers move through in waves."

**Summer Breeders (May-August)**
What nests here
"Ruby-throated Hummingbirds arrive around May 1 — plant Trumpet Vine or Bee Balm to attract them. They'll leave by September 15."

**Winter Visitors (November-March)**
What comes from further north
"Dark-eyed Juncos arrive in October from Canada. White-throated Sparrows are common at ground feeders."

**The Bluebird Opportunity**
"Eastern Bluebirds are common nesters in Scott County. A bluebird box mounted on a 5-foot pole facing southeast, with a predator guard, placed in open grass at least 100 feet from tree line, gives you a strong chance of nesting pairs by March."

**Feeder Recommendations**
- What feeder type attracts what species
- Best seeds for this region's birds
- Water source importance in summer heat

### Tab 6: Wildlife — Insects & Pollinators

**Monarch Butterfly**
- Is this address in the monarch migration corridor?
- What milkweed species are native to Scott County?
- "Plant 3 native milkweed species and register as a Monarch Waystation — monarchwatch.org"

**Native Bees**
- Common native bee species for this county
- What they need (bare ground, native flowers, no pesticides)
- "Scott County has 47 documented native bee species. Most don't sting and are more effective pollinators than honeybees."

**Butterflies**
- Top 5 butterfly species for this location
- Host plants each requires for caterpillars (not just nectar plants)
- "Eastern Tiger Swallowtail — plant Wild Black Cherry or Tulip Poplar as host plants, not just the flowers they visit."

**Fireflies**
- Habitat suitability context
- "Fireflies need moist soil, leaf litter, and darkness. Zone 6b with this drainage profile is suitable. Reduce lawn lighting and leave leaf litter in low areas."

### Tab 7: Wildlife — Mammals & Other

**Garden Planning by Species**
- White-tailed Deer: specific deer-resistant plants for Zone 6b soil
- Eastern Cottontail: fencing recommendations, deterrent plants
- Groundhog: exclusion methods, their beneficial role
- Eastern Gray Squirrel: feeder baffles, their role in oak regeneration

**The Beneficial Ones**
- Opossum: tick control (eats 5,000 ticks/season), harmless
- Red Fox: rodent control, rarely a problem for pets
- Little Brown Bat: 1,000 mosquitoes/hour, encourage with bat box

**Reptiles & Amphibians**
- Common snake species (mostly beneficial, which to know)
- Frog and toad species — "A toad in your garden eats 10,000 insects per summer"
- Box turtle habitat — increasingly rare, what to do if you find one

### Tab 8: The Seasonal Calendar

Month-by-month guide specific to Zone 6b with this frost profile:

```
JANUARY    Dormant. Winter birds active at feeders. Plan garden layout.
            Order seeds — popular varieties sell out by February.

FEBRUARY   Snowdrops emerge mid-month. Red Maple buds swell.
            Start tomatoes and peppers indoors (8 weeks before last frost).

MARCH      Eastern Redbud blooms. First robins return.
            Plant spinach, kale, peas, lettuce outdoors after March 15.
            Put up bluebird boxes before March 15.

APRIL      Last frost: April 15 (avg). Do not plant frost-sensitive crops yet.
            Virginia Bluebells peak first week.
            Hummingbirds arrive late April — have feeders ready.
            Peak spring warbler migration mid-month.

MAY        Plant warm crops after May 1 (tomatoes, peppers, squash, beans).
            Native bees emerge. Peak pollinator activity begins.
            Fireflies begin late May in moist areas.

JUNE       Full garden season. Deep water 1-2x/week rather than daily shallow.
            Monarch butterflies begin appearing.
            Elderberries ripe late June.

JULY       Peak heat — water in early morning only.
            Goldenrod begins. Monarchs increase.
            Hummingbird activity peaks.

AUGUST     Monarchs peak migration southward.
            Asters begin blooming — critical late-season pollinator food.
            Plant fall crops: kale, spinach, lettuce, radish (Aug 15-Sept 1).

SEPTEMBER  Fall planting window closes Sept 15.
            Peak fall warbler migration.
            Persimmons ripen after first frost.
            Juncos arrive from Canada.

OCTOBER    First frost: October 15 (avg). Harvest all frost-sensitive crops.
            Fall color peaks late October.
            Plant spring bulbs now.
            Rake leaves to compost — or leave in low areas for firefly habitat.

NOVEMBER   Dormancy begins. Plant garlic now for next summer.
            Winter birds established at feeders.
            Good time for tree and shrub planting (roots establish before spring).

DECEMBER   Cardinals and juncos at feeders daily.
            Plan next year's garden. Order seed catalogs.
```

### Tab 9: Invasives — Full Guide

For each invasive species detected in this county:
- **What it looks like:** description + when it's most recognizable
- **How aggressive:** slow/moderate/aggressive spread rating
- **What it does:** specific ecological harm
- **How to remove:** mechanical method + timing + chemical if necessary
- **What to plant instead:** native alternative that fills the same role

Example for Amur Honeysuckle:
"Amur Honeysuckle (Lonicera maackii) — recognizable by its paired white-to-yellow flowers in May and red berries in fall. Highly aggressive: it leafs out 2-3 weeks before natives and holds leaves 2-3 weeks after, blocking light year-round. Remove in fall or early spring when leaves are visible and native plants are dormant. Cut at base and immediately apply 25% glyphosate to cut surface. Replace with: Spicebush (Lindera benzoin) — same understory role, native, fall color, bird habitat."

---

## Gate 4: Acceptance Criteria

- [ ] All existing Level 2 content unchanged
- [ ] Level 3 renders as tabbed interface (9 tabs)
- [ ] Tabs collapse by default, expand on click
- [ ] Each tab loads its content from the already-fetched data (no new API calls on tab open)
- [ ] Seasonal calendar is specific to the actual frost dates for this address
- [ ] Bird sections use actual eBird seasonal data, not generic lists
- [ ] Wildlife sections use actual iNaturalist observations within 10 miles
- [ ] Plant lists are county-specific, not generic zone lists
- [ ] Bluebird box recommendation only appears if bluebirds observed in iNaturalist data
- [ ] Monarch section only appears if address is in migration corridor
- [ ] Invasive species guide shows only species observed in this county
- [ ] Mobile-friendly tab navigation (swipeable on touch)
- [ ] All 5 test addresses render correctly
- [ ] Bozeman MT shows completely different content than Georgetown KY
- [ ] Rural Harlan KY shows Appalachian-specific species

## Module
`src/modules/garden/` — extends existing data.js, logic.js, and template.js

## Chapter Color
Deep botanical green (#2d6b3d) — unchanged

## Progressive Disclosure Implementation
Uses the standard Livably progressive disclosure pattern:
- Level 1: always visible (existing skim layer)
- Level 2: [+ Read full analysis] expands current content
- Level 3: [+ Explore your yard] expands the tabbed deep dive

The tab labels use simple, warm language:
[Trees] [Shrubs & Flowers] [Food Garden] [Birds] [Pollinators] [Wildlife] [Month by Month] [What to Remove]
