# CLAUDE.md — Livably
*Read this file completely before making any changes to any file.*
*Last updated: May 2026*

---

## Project Overview

Livably is a residential address intelligence report for US homebuyers. Delivered as a web link. The goal is to make a buyer feel genuinely more informed about the home they're buying — not judged, not scared, not overwhelmed.

**The product promise:** The things you'd only learn after living there for two years, handed to you before you sign.

**GitHub:** https://github.com/Point998/Livably
**Design reference:** LIVABLY-DESIGN-BRIEF.md
**Architecture reference:** docs/plans/module-restructure.md
**Roadmap:** docs/IMPLEMENTATION_ROADMAP.md

---

## Technology Stack

- **Runtime:** Node.js
- **Framework:** Express
- **APIs:** Google Maps, Google Places, Google Distance Matrix, USDA, NOAA, Census ACS, FEMA, EPA, iNaturalist, eBird, FCC
- **Frontend:** Vanilla HTML/CSS/JS (no framework)
- **Fonts:** Fraunces + DM Sans (Google Fonts)
- **Design tokens:** public/design-tokens.css
- **Styles:** public/report.css

---

## Architecture

Modular structure with bounded contexts. Each chapter is a module. Each module owns its data fetching, business logic, and HTML generation in separate files.

```
src/
  modules/         ← One folder per chapter/domain
  shared/          ← Cross-module utilities and validation
  server/          ← Express setup and routes only
public/
  design-tokens.css  ← All design values
  report.css         ← All styles
  ui.js              ← Animations only
docs/
  postmortems/     ← PM-XXX: every bug documented
  nathan-reports/  ← NR-XXX: owner strategic reviews
  plans/           ← Architecture and workflow plans
```

**The three-layer rule:**
1. `data.js` — fetches raw API data only
2. `logic.js` — validates and processes data, applies business rules
3. `template.js` — generates HTML from clean processed data

**No layer may reach into another layer's concerns.**

---

## Feature Request Workflow

**Every build task follows this 4-phase workflow. No exceptions. No skipping phases.**

Skipping phases produces working demos with broken features — silent coherence failures, untested edge cases, and constraint violations that only surface in production. PM-001 through PM-003 all trace back to features built without proper discovery and specification.

### Phase 1 — Discovery (read-only)
- Read CLAUDE.md completely
- Read relevant module files
- Read relevant postmortems in docs/postmortems/
- Identify what exists, what's missing, what could break
- Output: written summary of findings
- **No code changes in this phase**

### Phase 2 — Specification
- Write spec.md in feature-requests/FR-NNN-name/
- Define inputs, outputs, edge cases, acceptance criteria
- Define which module this belongs to
- **No code changes in this phase**

### Phase 3 — Planning
- Write implementation-plan.md
- Break into ordered tasks by layer (data → logic → template)
- Flag risks and unknowns
- **No code changes in this phase**

### Phase 4 — Implementation
- Execute plan
- Write tests BEFORE or ALONGSIDE implementation (not after)
- Test on all 5 addresses: Georgetown KY, Harlan KY, Louisville KY, Bozeman MT, Jeffersonville IN
- Write summary.md
- Commit and push

---

## Critical Engineering Constraints

These are non-negotiable. Enforced structurally where possible, by validation where not.

**CONSTRAINT-001: No scoring, grades, or numerical ratings**
No composite scores. No chapter grades. No ring charts. No score bands. The three-bucket framework is the only evaluation system: Things to Consider / Things to Check / Cool Things to Know. Any code that produces a numerical quality rating for an address or chapter is wrong.

**CONSTRAINT-002: Fair Housing — absolute**
No finding may reference or imply racial, ethnic, national origin, income class, or demographic composition of any area. Describe documented behavior and infrastructure only. The word "neighborhood" may describe physical area but never imply demographic character. Income findings must compare to national median only — never characterize the area's economic class. Enforced in `src/modules/community/logic.js`.

**CONSTRAINT-003: Hospital verified by drive time, not search rank**
Hospital search must calculate actual drive time for top 5 candidates and return the one with the shortest drive time. Never trust Google's relevance ranking for safety-critical destinations. Applies equally to urgent care. Enforced in `src/modules/health/logic.js`. See PM-003.

**CONSTRAINT-004: No hardcoded business names in search or filter logic**
No chain names, store names, or brand names in any search query, filter, or exclusion. All filtering must use Google Places type arrays. The only exception is retail clinic exclusions (Little Clinic, MinuteClinic) which are behavior-based, not brand-based. Enforced in `src/shared/validate.js`.

**CONSTRAINT-005: No Google Places text search for highway access**
Highway access must use the geocoding + address validation strategy. Text search for "highway on ramp" returns boat ramps, parking ramps, and unrelated results. See PM-002.

**CONSTRAINT-006: No cross-state results without explicit flagging**
No school, hospital, urgent care, or pharmacy result from a different state than the origin address may be used as a primary finding. Cross-state results are only permissible when no in-state option exists within 50 miles, and must be explicitly labeled as cross-state. State extracted from reverse geocoding at report start, passed to all module logic functions. See PM-001.

**CONSTRAINT-007: Rural mode detection required**
Before any narrative is generated, the address must be classified as urban/suburban/rural/remote based on average daily drive times and population density. Rural and remote addresses require different narrative framing — not failure messages. Enforced in `src/shared/validate.js`.

**CONSTRAINT-008: No inline styles in HTML generators**
All visual appearance lives in public/report.css and public/design-tokens.css. HTML generators in template.js files use semantic class names only. Zero style="" attributes. Zero hardcoded colors or font sizes. Enforced by code review.

**CONSTRAINT-009: No design decisions in data or logic layers**
`data.js` and `logic.js` files contain zero HTML, zero CSS class names, zero visual decisions. Template.js files contain zero API calls and zero business rules.

**CONSTRAINT-010: Drive time coherence check required**
Any daily destination showing a drive time over 45 minutes must trigger a coherence check before rendering. Either confirm this is a legitimate rural result (rural mode active) or retry the search. A grocery store 45+ minutes away for a suburban address is almost certainly a wrong result.

**CONSTRAINT-011: No feature ships without tests**
Every new module must have a corresponding test file in tests/. Every business rule in logic.js must have at least one test. The Jeffersonville IN address must be a test case for any module that searches by location.

**CONSTRAINT-012: Session postmortem required for production bugs**
Any bug found in a real report (not during development testing) must be documented in docs/postmortems/PM-NNN.md before the fix is committed. The postmortem becomes a numbered constraint if it represents a class of bug.

**CONSTRAINT-013: No vibe coding**
Never implement a feature in a single unstructured session without the 4-phase workflow. Working demos built without proper specs produce coherence failures, untested edge cases, and constraint violations that surface in production. PM-001 through PM-003 all trace to features built without proper discovery. If time constraints prevent full workflow, explicitly document which phases were skipped and what risks that introduces.

**CONSTRAINT-014: The Logic Layer owns all coherence**
`src/shared/validate.js` is the single place where cross-module coherence rules live. No module may implement its own cross-state filtering, rural detection, or drive time coherence check independently. These rules live in validate.js and are called by all modules.

**CONSTRAINT-015: Graceful degradation required**
No chapter may render an empty section or generic "data not available" message without providing a specific actionable alternative — a named URL, a phone number, or specific instructions for getting the information. Dead API = actionable fallback, not silence.

**CONSTRAINT-016: NOAA CDO station metadata is unreliable**
A station appearing in a `datatypeid=MLY-TMAX-NORMAL` filtered search does not guarantee it has actual temperature records for the requested period. Always validate that fetched records contain the expected datatype before accepting a station as valid. Iterate candidates until a station with confirmed data is found. Do not trust station metadata alone. See PM-004.

---

## Known Bugs — Never Repeat

### BUG-001 (→ CONSTRAINT-003): Hospital returned second-nearest
Cause: Google relevance ranking ≠ geographic nearest. Fixed by drive-time verification. See PM-003.

### BUG-002: Grocery returned distant store over nearby one
Cause: textSearch ranks by relevance not distance. Fixed by tight radius + drive time sort.

### BUG-003 (→ CONSTRAINT-005): Highway returned boat ramp
Cause: "highway on ramp" text search matched the word "ramp." Fixed by geocoding strategy. See PM-002.

### BUG-004: Urgent care returned retail health clinic
Cause: Little Clinic appears in urgent care searches. Fixed by name-based exclusion of retail clinics.

### BUG-005: Highway validation dropped valid interstates
Cause: Address string validation didn't match all Google formats. Partially fixed.

### BUG-006: Claude Code changes not persisting to GitHub
Cause: Claude Code reports success but doesn't always push. Always verify with git log and GitHub raw URL.

### BUG-007 (→ CONSTRAINT-006): School returned from wrong state
Cause: No jurisdictional filter on school search. Jeffersonville IN returned Louisville KY school. See PM-001.

### BUG-008 (→ CONSTRAINT-016): Climate normals rendered without temperature data
Cause: NOAA CDO station passed the datatype filter but had no actual TMAX/TMIN records for the normals period. Louisville KY used BEDFORD 4 SW, IN station. Fixed by validating actual record content after fetch. See PM-004.

---

## Data Standards

- **Drive times:** Google Maps Distance Matrix, 8am Tuesday departure, door-to-door from specific address
- **Hospital:** Verified by drive time across top 5 candidates — never search rank
- **School:** Nearest by distance with disclaimer. Must be same state as origin address.
- **Flood zone:** Parcel-level from FEMA MSC — never neighborhood-level
- **Every finding:** Named source + research date
- **Highway:** Geocoding strategy only. 59 interstates in constants.js.

---

## Test Addresses (always test all five)

1. `100 Wishing Well Path Unit 2306, Georgetown, KY 40324` — suburban KY
2. `456 Rural Route 1, Harlan, KY 40831` — rural Appalachian KY
3. `123 Main St, Louisville, KY 40202` — urban KY
4. `789 Main St, Bozeman, MT 59715` — western US, different climate/flora
5. `1007 Stonelilly Dr, Jeffersonville, IN 47130` — border city (IN/KY), PM-001 regression test

---

## Design

The only design reference is LIVABLY-DESIGN-BRIEF.md. All previous design patterns are deprecated.

- Fonts: Fraunces (headings) + DM Sans (body)
- Design tokens: public/design-tokens.css
- Styles: public/report.css
- No inline styles anywhere
- No scoring UI of any kind
- Eclectic chapter color system — each chapter has its own color identity

---

## Do Not

- Add npm packages without documenting in the feature summary
- Change or expose the .env file
- Add scoring of any kind
- Use hardcoded chain names in search or filter logic
- Skip the 4-phase feature request workflow
- Mark a feature complete without testing on all 5 addresses
- Implement cross-state filtering in individual modules (belongs in validate.js)
- Generate HTML in data.js or logic.js files
- Make API calls in template.js files
