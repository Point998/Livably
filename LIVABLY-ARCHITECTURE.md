# Livably — Full Architecture Review & Restructure Plan
*From "shooting from the hip" to production-grade*
*May 2026*

---

## Executive Summary

Livably was built the way most startups build — fast, iterative, everything in one place. That got you to a working product quickly. The cost is that the codebase now has four separate concerns mixed together in two files (`app.js` ~500 lines, `premium.js` ~3000+ lines), making it fragile, hard to test, and prone to the class of bugs you found with the Jeffersonville school.

This document describes what a well-funded team of engineers would build from scratch, how to get there from where you are, and in what order to do it.

---

## What You Have Now (Honest Assessment)

### Current File Structure
```
livably/
  src/
    app.js          ← Does EVERYTHING for standard chapters
    premium.js      ← Does EVERYTHING for premium chapters
    logger.js       ← Good: already separated
    errorMemory.js  ← Good: already separated
    development-discovery.js ← Partially separated
  public/
    index.html      ← Homepage
    report.css      ← All styles (good: recently separated)
    design-tokens.css ← Good: recently added
    ui.js           ← Animations
  data/
    reports.json    ← Report cache
    logs/           ← Error logs
```

### What's Mixed Together in app.js and premium.js
Every function currently does multiple jobs simultaneously:

1. **API calls** — fetching raw data from Google, USDA, Census, FEMA, etc.
2. **Business logic** — deciding what the data means, which result to use
3. **Validation** — checking if results make sense
4. **Narrative generation** — writing the text that explains the data
5. **HTML generation** — building the markup
6. **Error handling** — deciding what to show when things fail

This is why the Jeffersonville school bug happened — the geographic validation logic is buried inside a function that also fetches data AND generates HTML. You can't fix one without risking the others.

---

## What a Production Architecture Looks Like

### The Three-Layer Principle
```
RAW DATA          PROCESSED DATA        RENDERED OUTPUT
────────────      ──────────────        ───────────────
APIs return   →   Logic makes      →    Templates turn
raw results       sense of it           it into HTML
```

Each layer has one job. Each layer talks only to the layers next to it.

---

## The Full Target Architecture

```
livably/
  ├── src/
  │   ├── server/
  │   │   ├── app.js              ← ONLY: Express setup, routes, middleware
  │   │   └── middleware/
  │   │       ├── cache.js        ← Report caching logic
  │   │       ├── rateLimit.js    ← API rate limiting
  │   │       └── errorHandler.js ← Global error handling
  │   │
  │   ├── data/                   ← LAYER 1: Raw API calls only
  │   │   ├── google/
  │   │   │   ├── geocoding.js    ← Address → coordinates
  │   │   │   ├── places.js       ← Places search (grocery, pharmacy, etc.)
  │   │   │   ├── distanceMatrix.js ← Drive time calculations
  │   │   │   └── reverseGeocode.js ← Coordinates → address components
  │   │   ├── usda/
  │   │   │   ├── soilSurvey.js   ← Web Soil Survey API
  │   │   │   ├── plants.js       ← PLANTS Database (native/invasive)
  │   │   │   └── hardiness.js    ← Plant Hardiness Zone API
  │   │   ├── government/
  │   │   │   ├── fema.js         ← Flood zone data
  │   │   │   ├── census.js       ← ACS demographic data
  │   │   │   ├── noaa.js         ← Climate normals, frost dates
  │   │   │   ├── epa.js          ← Air quality, radon, EJSCREEN
  │   │   │   └── fcc.js          ← Broadband data
  │   │   ├── wildlife/
  │   │   │   ├── inaturalist.js  ← Wildlife observations
  │   │   │   └── ebird.js        ← Bird species data
  │   │   └── index.js            ← Exports all data fetchers
  │   │
  │   ├── logic/                  ← LAYER 2: Business rules only
  │   │   ├── validate.js         ← THE LOGIC LAYER (cross-state, coherence)
  │   │   ├── address.js          ← Address parsing, state extraction, rural detection
  │   │   ├── reachability.js     ← Grocery/pharmacy/hospital/school selection rules
  │   │   ├── schools.js          ← State boundary filter, nearest vs assigned
  │   │   ├── health.js           ← Nearest actual ER, response time context
  │   │   ├── highway.js          ← Interstate validation, interchange fallback
  │   │   ├── garden.js           ← Plant filtering, frost logic, zone context
  │   │   ├── community.js        ← Fair Housing rules, demographic framing
  │   │   ├── narratives.js       ← All "if X then say Y" text decisions
  │   │   ├── ruralMode.js        ← Rural vs urban detection, framing adjustments
  │   │   └── index.js            ← Exports all logic processors
  │   │
  │   ├── templates/              ← LAYER 3: HTML generation only
  │   │   ├── report.js           ← Full report assembly
  │   │   ├── hero.js             ← Report header, address, at-a-glance
  │   │   ├── chapters/
  │   │   │   ├── healthSafety.js
  │   │   │   ├── dailyLife.js
  │   │   │   ├── reachability.js
  │   │   │   ├── trafficPatterns.js
  │   │   │   ├── schools.js
  │   │   │   ├── safetyEmergency.js
  │   │   │   ├── community.js
  │   │   │   ├── growth.js
  │   │   │   ├── climate.js
  │   │   │   ├── garden.js
  │   │   │   ├── propertyIntel.js
  │   │   │   ├── sensory.js
  │   │   │   ├── walkability.js
  │   │   │   ├── propertyCosts.js
  │   │   │   └── utilities.js
  │   │   ├── components/
  │   │   │   ├── buckets.js      ← Things to Consider/Check/Know
  │   │   │   ├── keyTakeaway.js  ← Key Takeaway block
  │   │   │   ├── destCard.js     ← Destination card (drive time)
  │   │   │   ├── badge.js        ← Response badges (Excellent/Good/Fair)
  │   │   │   ├── checklist.js    ← Action checklist items
  │   │   │   └── footer.js       ← Report footer
  │   │   └── pages/
  │   │       ├── error.js        ← Error page template
  │   │       └── noAddress.js    ← No address provided page
  │   │
  │   ├── services/               ← ORCHESTRATION: Coordinates the layers
  │   │   ├── reportBuilder.js    ← Calls data → logic → templates in order
  │   │   ├── addressResolver.js  ← Full address processing pipeline
  │   │   └── cacheService.js     ← Report caching
  │   │
  │   ├── utils/                  ← SHARED UTILITIES
  │   │   ├── time.js             ← getNextTuesday8am(), date formatting
  │   │   ├── geo.js              ← Distance calculations, coordinate utils
  │   │   ├── text.js             ← toTitleCase(), escapeHtml(), formatDriveTime()
  │   │   ├── state.js            ← State name/abbreviation lookup
  │   │   └── constants.js        ← Interstate list, exclusion lists, thresholds
  │   │
  │   ├── logger.js               ← Already good, keep as-is
  │   └── errorMemory.js          ← Already good, keep as-is
  │
  ├── public/
  │   ├── index.html              ← Homepage
  │   ├── design-tokens.css       ← Design values (already good)
  │   ├── report.css              ← All styles (already good)
  │   ├── ui.js                   ← Animations
  │   └── sketch.js               ← The Livably Sketch (future)
  │
  ├── tests/                      ← TEST SUITE
  │   ├── data/                   ← Test that APIs return expected shapes
  │   ├── logic/                  ← Test business rules in isolation
  │   │   ├── validate.test.js    ← Cross-state filter, coherence checks
  │   │   ├── schools.test.js     ← State boundary, Jeffersonville case
  │   │   └── ruralMode.test.js   ← Rural detection accuracy
  │   ├── templates/              ← Test HTML output
  │   └── integration/            ← Full report generation tests
  │       ├── georgetown.test.js
  │       ├── bozeman.test.js
  │       ├── harlan.test.js      ← Rural test
  │       └── jeffersonville.test.js ← Border city test
  │
  ├── config/
  │   ├── apis.js                 ← API endpoint constants, timeouts
  │   ├── thresholds.js           ← Distance thresholds, rural detection values
  │   └── narratives.js           ← Narrative text templates (not logic, not HTML)
  │
  ├── CLAUDE.md
  ├── LIVABLY-DESIGN-BRIEF.md
  ├── LIVABLY-SKETCH-SPEC.md
  ├── PRD.md
  └── feature-requests/
```

---

## The 12 Specific Problems to Fix

### Problem 1: Business Logic Buried in HTML Strings
**Where it is:** `premium.js` lines 400-2000+
**What it looks like:**
```javascript
// WRONG — logic inside template string
return `<div class="flood-banner ${
  zone === 'X' ? 'flood-banner--safe' : 'flood-banner--risk'
}">${zone === 'X' ? 'Minimal Risk' : 'High Risk'}</div>`;
```
**What it should look like:**
```javascript
// logic/climate.js
function classifyFloodZone(zone) {
  if (zone === 'X') return { label: 'Minimal Risk', severity: 'safe' };
  if (zone === 'AE') return { label: 'High Risk', severity: 'danger' };
  return { label: 'Moderate Risk', severity: 'moderate' };
}

// templates/chapters/climate.js
function renderFloodBanner(floodData) {
  return `<div class="flood-banner flood-banner--${floodData.severity}">
    ${floodData.label}
  </div>`;
}
```
**Impact:** Every flood zone decision is testable, changeable, and understandable in isolation.

---

### Problem 2: No State/Jurisdiction Awareness
**Where it is:** Every search function in `app.js` and `premium.js`
**The bug:** Jeffersonville IN returns Louisville KY school
**The fix:** `src/logic/validate.js` — jurisdiction filter applied to all searches
**Also affects:** Hospital (could cross state lines), urgent care, pharmacy in border cities

---

### Problem 3: No Rural Mode
**Where it is:** Nowhere — doesn't exist yet
**The problem:** A rural address with 25-min grocery gets the same framing as a suburban address with 3-min grocery. Both are "correct" but the narrative should be completely different.
**The fix:** `src/logic/ruralMode.js` — detects address type, passes mode flag to narrative generator
**Rural thresholds:**
- Avg daily drive time > 15 min → rural mode
- Population density < 500/sq mile → rural mode
- No grocery within 10 miles → remote mode

---

### Problem 4: Hardcoded Constants Scattered Everywhere
**Where they are:** Inline in search functions throughout `app.js`
**Examples:**
- Interstate list (59 interstates) — hardcoded in highway function
- Grocery exclusion terms — hardcoded in grocery function  
- Retail clinic exclusion names — hardcoded in urgent care function
- Distance thresholds — hardcoded as magic numbers
**The fix:** `src/utils/constants.js` — one file, all constants, easy to update

---

### Problem 5: No Shared Utility Functions
**Where the problem shows:** `getNextTuesday8am()`, `toTitleCase()`, `escapeHtml()`, `formatDriveTime()` are either duplicated or inconsistently applied
**The fix:** `src/utils/` — shared utilities called from anywhere

---

### Problem 6: API Keys and Configuration Mixed with Logic
**Where it is:** `const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY` appears multiple times
**The fix:** `src/config/apis.js` — all API configuration in one place

---

### Problem 7: No Test Suite
**Where the problem shows:** Every bug you've found was found manually by running the app and looking at results
**The cost:** Every fix could break something else and you wouldn't know until a buyer finds it
**The fix:** `tests/` — automated tests that run before every deployment
**Priority tests:**
- Cross-state school filter (the Jeffersonville case)
- Hospital nearest-by-drive-time (BUG-001)
- Rural mode detection
- Fair Housing narrative compliance

---

### Problem 8: Report Assembly Mixed with Route Handling
**Where it is:** The `/report` route in `app.js` does both Express routing AND full report generation (200+ lines)
**The fix:** `src/services/reportBuilder.js` — report generation extracted, route becomes 10 lines

---

### Problem 9: No Component Reuse in Templates
**Where the problem shows:** The "Things to Check" bucket, Key Takeaway block, and response badge are regenerated with slightly different HTML in every chapter
**The cost:** Change the Key Takeaway design in one chapter, have to change it in 14 places
**The fix:** `src/templates/components/` — shared components called from chapter templates

---

### Problem 10: Narrative Text Hardcoded in Logic
**Where it is:** Strings like "A fire truck can reach your front door in two minutes" are hardcoded inside logic functions
**The problem:** Can't A/B test different copy, can't translate, hard to update tone
**The fix:** `src/config/narratives.js` — all narrative text templates in one file

---

### Problem 11: No Error Recovery Strategy
**Where the problem shows:** If one API fails, the whole report fails
**The fix:** Each data fetcher has a defined fallback. The logic layer knows which findings are "critical" (must have) vs "enhanced" (nice to have). A report can render with partial data rather than failing completely.

---

### Problem 12: No Caching Strategy
**Where the problem is:** Every report request hits all APIs fresh, even if the same address was just run
**The cost:** Slow, expensive, burns API quota
**The fix:** `src/services/cacheService.js` — cache reports by address + date, invalidate after 24 hours

---

## The Migration Plan

Do not try to do this all at once. In order:

### Phase 1 — Extract Utilities (1-2 days)
Low risk, high value. No behavior changes.
- Create `src/utils/constants.js` — move all hardcoded lists and thresholds
- Create `src/utils/time.js` — move `getNextTuesday8am()`
- Create `src/utils/text.js` — move `toTitleCase()`, `escapeHtml()`, `formatDriveTime()`
- Create `src/utils/geo.js` — move coordinate utilities
- Update imports everywhere

### Phase 2 — Extract the Logic Layer (2-3 days)
The most important structural change. Fixes the Jeffersonville bug and all future bugs like it.
- Create `src/logic/validate.js` — jurisdiction checks, coherence rules, rural detection
- Create `src/logic/address.js` — state extraction, address type detection
- Create `src/logic/schools.js` — state boundary filter, drive time coherence
- Create `src/logic/health.js` — nearest ER by drive time, response time context
- Wire into existing functions (don't rebuild yet, just add the layer)

### Phase 3 — Extract the Data Layer (3-4 days)
Separates API concerns from everything else.
- Create `src/data/google/` — all Google API calls
- Create `src/data/government/` — FEMA, Census, NOAA, EPA
- Create `src/data/usda/` — soil, plants, hardiness
- Create `src/data/wildlife/` — iNaturalist, eBird
- Each function: only fetches, returns raw data, nothing else

### Phase 4 — Extract Components (2-3 days)
Eliminates the HTML duplication problem.
- Create `src/templates/components/` — buckets, keyTakeaway, badge, checklist, destCard
- Update all chapter HTML generators to use shared components

### Phase 5 — Extract Chapter Templates (4-5 days)
One file per chapter. Each chapter becomes independently changeable.
- Create `src/templates/chapters/` — one file per chapter
- Move HTML generation out of `premium.js`
- `premium.js` becomes an orchestrator, not a generator

### Phase 6 — Add Test Suite (2-3 days)
- Set up Jest or Mocha
- Write tests for every logic module
- Write integration tests for all 5 test addresses
- Add to deployment process — tests must pass before push

### Phase 7 — Extract Services and Routes (1-2 days)
- Create `src/services/reportBuilder.js`
- Reduce `/report` route to ~15 lines
- `app.js` becomes purely Express configuration

---

## What This Enables

**After Phase 1-2 (Logic Layer):**
- The Jeffersonville school bug is impossible
- Every bug of that class is caught before it reaches a buyer
- Business rules are testable and auditable

**After Phase 3-5 (Full Separation):**
- Claude Design outputs slot directly into `src/templates/chapters/`
- A designer can update any chapter's HTML without touching data logic
- A data engineer can improve any API call without touching HTML
- New chapters take hours, not days

**After Phase 6 (Tests):**
- Every push is validated automatically
- Bugs are caught in development, not production
- Confidence to refactor anything

**After Phase 7 (Services):**
- Report generation is a service that can be called from anywhere
- Ready for API monetization (sell report generation as an API)
- Ready for background processing (generate report async, email link)

---

## The One-Line Summary

Right now Livably is a talented solo chef cooking every dish, managing the front of house, ordering supplies, and washing dishes simultaneously. The restructure gives each person their own station. The food gets better because everyone can focus on what they do best.

---

## Recommended FR Numbers

- FR-035 — Logic Layer extraction (Phase 2) — HIGHEST PRIORITY
- FR-036 — Utilities extraction (Phase 1) — do first, enables everything
- FR-037 — Data Layer extraction (Phase 3)
- FR-038 — Template components (Phase 4)
- FR-039 — Chapter templates (Phase 5)
- FR-040 — Test suite (Phase 6)
- FR-041 — Services and routes (Phase 7)

---

*This is the architecture Livably deserves. Build it in phases, test at each phase, and the product gets more reliable with every step.*
