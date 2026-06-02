# Livably — Implementation Roadmap
*Last updated: June 2026*

## What Livably Is
A residential address intelligence report for US homebuyers. Delivered as a web link. The goal is to make a buyer feel genuinely more informed about the home they're buying — not judged, not scared, not overwhelmed.

**The product promise:** The things you'd only learn after living there for two years, handed to you before you sign.

## Current State (June 2026)
- All 14 chapters rendering with real data
- Modular architecture: each chapter owns data.js / logic.js / template.js
- Depth slider system (FR-045): Glance / Overview / Deep Read / Research — all 14 chapters wired
- L3/L4 content shipped for 12 of 14 chapters (Walkability and Costs remaining)
- Design system: Fraunces + DM Sans, design-tokens.css, report.css
- 1049 tests across 61 suites
- Error memory/logging layer
- Feature request workflow established with 4-phase process
- GitHub: https://github.com/Point998/Livably

## Completed Phases

### Phase 1 — Module Structure ✅ (PR #9, May 2026)
Extracted the monolith into proper modules. Each module owns its domain completely.

### Phase 2 — Logic Layer ✅ (FR-035)
Validation and coherence layer in `src/shared/validate.js` catches data errors before buyers see them.

### Phase 3 — Test Suite ✅ (FR-040)
Automated tests for every business rule. All new features shipped with tests.

### Phase 4 — Depth Slider Engine ✅ (FR-045, PRs #7+#8)
4-level reading depth system: Glance / Overview / Deep Read / Research.
All 14 chapters wired. L3/L4 content shipped for 12 chapters.

**L3/L4 status per chapter:**
| Chapter | FR | L3 | L4 |
|---------|----|----|-----|
| Climate | FR-043 | ✅ | ✅ |
| Garden | FR-042 | ✅ | ✅ |
| Property | FR-049 | ✅ | ✅ |
| Community | pre-existing | ✅ | ✅ |
| Health | FR-050 | ✅ | ✅ |
| Traffic | FR-051 | ✅ | ✅ |
| Schools | FR-052 | ✅ | ✅ |
| Safety | FR-053 | ✅ | ✅ |
| Growth | FR-054 | ✅ | ✅ |
| Sensory | FR-055 | ✅ | ✅ |
| Walkability | FR-056 | ⏳ pending | ⏳ pending |
| Costs | FR-057 | ⏳ pending | ⏳ pending |
| Daily (Reachability) | — | structure only | — |
| Reach | — | structure only | — |

**Known outstanding depth system debt:**
- L3/L4 visual distinction — Deep Read and Research look identical (content stacks, no visual diff). Needs a dedicated design pass in report.css. Not fixed per-chapter; fix once for all chapters.

## Active Work

### FR-056 — Walkability L3/L4
Next chapter in the L3/L4 rollout.

### FR-057 — Costs L3/L4
Final chapter in the L3/L4 rollout.

## Next Phases

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
  utilities/       Utilities intelligence (FR-032, not yet built)
  traffic/         Traffic patterns
  property/        Property intelligence (broadband, soil, building age)

src/shared/
  validate.js      Logic Layer — coherence rules
  constants.js     All constants (interstates, exclusions, thresholds)
  utils/           Shared helper functions
  google/          Google API client

src/server/
  app.js           Express setup only (~30 lines)
  routes/          Route handlers
```
