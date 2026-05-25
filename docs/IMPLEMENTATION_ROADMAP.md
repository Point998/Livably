# Livably — Implementation Roadmap
*Last updated: May 2026*

## What Livably Is
A residential address intelligence report for US homebuyers. Delivered as a web link. The goal is to make a buyer feel genuinely more informed about the home they're buying — not judged, not scared, not overwhelmed.

**The product promise:** The things you'd only learn after living there for two years, handed to you before you sign.

## Current State (May 2026)
- Chapter 03 Daily Reachability: complete
- 10+ chapters rendering with real data
- Design system in place (Fraunces + DM Sans, design-tokens.css)
- Error memory/logging layer
- Feature request workflow established
- GitHub: https://github.com/Point998/Livably

## Known Structural Debt
The project was built iteratively without proper architecture. Two files (`app.js` ~500 lines, `premium.js` ~3000+ lines) contain all data fetching, business logic, validation, narrative generation, and HTML generation mixed together. This causes:
- Bugs like cross-state school results (PM-001)
- No testability of business rules
- Design changes require touching data logic
- New features compound existing structural problems

## The Rebuild Plan (Phases)

### Phase 1 — Module Structure (Current Priority)
Extract the monolith into proper modules. Each module owns its domain completely.
See: `docs/plans/module-restructure.md`

### Phase 2 — Logic Layer
Build the validation and coherence layer that catches data errors before buyers see them.
See: FR-035

### Phase 3 — Test Suite
Automated tests for every business rule. No feature ships without tests.
See: FR-040

### Phase 4 — Design Rebuild
Clean separation of HTML generation from data logic enables Claude Design integration.
See: LIVABLY-DESIGN-BRIEF.md

### Phase 5 — New Chapters
Utilities Intelligence, Life at This Address Calculator, Chapter Enhancements.
See: FR-032, FR-033, FR-034

### Phase 6 — The Livably Sketch
Hand-drawn house that comes to life as the buyer scrolls.
See: LIVABLY-SKETCH-SPEC.md

### Phase 7 — Monetization & Launch
Agent subscriptions, API licensing, white label.
See: FR-022 (deferred until product is solid)

## Module Map
```
src/modules/
  reachability/    Daily destinations, drive times
  schools/         Education, district data
  health/          Emergency services, hospital
  climate/         Flood zone, weather risks
  garden/          What Will Grow Here
  community/       Demographics, neighborhood character
  growth/          Development pipeline
  sensory/         Environmental, noise, light
  walkability/     Getting around on foot
  costs/           Property costs and market
  utilities/       Utilities intelligence (FR-032)
  traffic/         Traffic patterns
  dailylife/       What daily life looks like here

src/shared/
  validate.js      Logic Layer — coherence rules
  constants.js     All constants (interstates, exclusions, thresholds)
  utils/           Shared helper functions
  google/          Google API client

src/server/
  app.js           Express setup only (~30 lines)
  routes/          Route handlers
```
