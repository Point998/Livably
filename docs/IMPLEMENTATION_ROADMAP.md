# Livably — Implementation Roadmap
*Last updated: June 2026*

## What Livably Is
A residential address intelligence report for US homebuyers. Delivered as a web link. The goal is to make a buyer feel genuinely more informed about the home they're buying — not judged, not scared, not overwhelmed.

**The product promise:** The things you'd only learn after living there for two years, handed to you before you sign.

## Current State (June 2026)
- All 14 chapters rendering with real data
- Modular architecture: each chapter owns data.js / logic.js / template.js
- Depth slider system (FR-045): Glance / Overview / Deep Read / Research — all 14 chapters wired
- L3/L4 content complete for all 12 data chapters (Daily and Reach are structure only)
- L3/L4 visual distinction: chapter-colored border + research tint, content aligned with inner-pad
- Design system: Fraunces + DM Sans, design-tokens.css, report.css
- 1,084 tests across 61 suites
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
| Walkability | FR-056 | ✅ | ✅ |
| Costs | FR-057 | ✅ | ✅ |
| Daily (Reachability) | — | structure only | — |
| Reach | — | structure only | — |

**Depth system debt: resolved.**
- L3/L4 visual distinction ✅ — chapter-colored `border-top` on `.depth-l3`; same border + `background: var(--ink-04)` tint on `.depth-l4`. One CSS rule each, applies across all chapters via `var(--ch)`.

## Active Work

**Phase 4 fully complete.** All 14 chapters have full depth slider coverage (L1–L4) with visual distinction.

**Next: Phase 5** — New chapters (FR-032 Utilities Intelligence, FR-033 Life at This Address Calculator, FR-034 Chapter Enhancements).

**Parallel infrastructure track — FR-058 (specced, implementation pending).** Spatial cache keys + drive-time banding. Discovery/spec/plan complete; Phase 4 build is the next step, gated on the `h3-js` dependency decision. See Cost Architecture below.

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

## Cost Architecture — Spatial Intelligence (enables enterprise scale)
NR-002 forecast Google API cost at ~$0.65/report; fine for consumer pricing, but a margin concern in B2B/licensing (Phase 7) at volume. NR-003 diagnosed the root cause — every cache key is the exact origin coordinate, so neighboring addresses share nothing — and specced the fix: **H3 cell-based cache keys** (neighbors reuse one fetch) + **drive-time banding** (honest shared values, computed once per cell, with the safety tier kept exact). Expected: warm-cell marginal cost ~$0.65 → ~$0.03–0.04, no accuracy regression, no provider change.

Phased: **Phase 1** (FR-058, pure Google — specced, build pending) → Phase 2 (OSRM self-hosted routing, when contract volume justifies) → Phase 3 (precomputed regional warehouse, on demand only). Google stays the POI source of truth throughout (rural accuracy is the differentiation).

See: NR-002, NR-003, FR-058

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
