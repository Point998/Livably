# Livably — Project State, Roadmap & Backlog
*The single source of truth for project status, the build roadmap, and captured ideas.*
*Consolidates the former SESSION-STATE.md and BACKLOG.md (June 2026).*
*Last updated: June 2026*

## How to Start a New Session
Read this file first, then CLAUDE.md (constraints + workflow). Then the relevant module files and postmortems for the work at hand.
- Raw: https://raw.githubusercontent.com/Point998/Livably/main/docs/IMPLEMENTATION_ROADMAP.md
- Note: the CLAUDE.md raw URL sometimes 404s via CDN cache — read it from disk if needed.

## Test Addresses (always test all five)
1. `100 Wishing Well Path Unit 2306, Georgetown, KY 40324` — suburban KY
2. `456 Rural Route 1, Harlan, KY 40831` — rural Appalachian KY
3. `123 Main St, Louisville, KY 40202` — urban KY
4. `789 Main St, Bozeman, MT 59715` — western US, different climate/flora
5. `1007 Stonelilly Dr, Jeffersonville, IN 47130` — border city (IN/KY), PM-001 regression

---

## What Livably Is
A residential address intelligence report for US homebuyers. Delivered as a web link. The goal is to make a buyer feel genuinely more informed about the home they're buying — not judged, not scared, not overwhelmed.

**The product promise:** The things you'd only learn after living there for two years, handed to you before you sign.

**GitHub:** https://github.com/Point998/Livably

## Current State (June 2026)
- All 14 chapters rendering with real data
- Modular architecture: each chapter owns data.js / logic.js / template.js
- Depth slider system (FR-045): Glance / Overview / Deep Read / Research — all 14 chapters wired
- L3/L4 content complete for all 12 data chapters (Daily and Reach are structure only)
- L3/L4 visual distinction: chapter-colored border + research tint, content aligned with inner-pad
- Design system: Fraunces + DM Sans, design-tokens.css, report.css
- Error memory/logging layer
- Feature request workflow established with 4-phase process
- **Tests: 1,214 across 65 suites** (on `fr-058-spatial-cache-banding`; main is at 1,206 until FR-058 merges)

## Active Work
- **Active branch:** `fr-058-spatial-cache-banding` — PR open against `main`.
- **Active FR:** FR-058 (Spatial cache keys + drive-time banding) — **built, in review.** See Cost Architecture below.
- **Recent chain:** NR-002 (API cost forecast) → NR-003 (spatial cost diagnosis) → FR-058 (Phase 1 build).
- **Next:** Phase 5 new chapters (FR-032 Utilities, FR-033 Life-at-Address calculator, FR-034 chapter enhancements).

---

## Completed Phases

### Phase 1 — Module Structure ✅ (PR #9)
Extracted the monolith into proper modules. Each module owns its domain completely.

### Phase 2 — Logic Layer ✅ (FR-035)
Validation and coherence layer in `src/shared/validate.js` catches data errors before buyers see them.

### Phase 3 — Test Suite ✅ (FR-040)
Automated tests for every business rule. All new features shipped with tests.

### Phase 4 — Depth Slider Engine ✅ (FR-045, PRs #7+#8)
4-level reading depth: Glance / Overview / Deep Read / Research. All 14 chapters wired; L3/L4 content shipped for 12 chapters. This delivered the progressive-disclosure pattern originally captured as FR-044.

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

**Depth system debt: resolved** — chapter-colored `border-top` on `.depth-l3`; same border + `background: var(--ink-04)` tint on `.depth-l4`, applied across all chapters via `var(--ch)`.

---

## Cost Architecture — Spatial Intelligence (enables enterprise scale)
NR-002 forecast Google API cost at ~$0.65/report; fine for consumer pricing, but a margin concern in B2B/licensing (Phase 7) at volume. NR-003 diagnosed the root cause — every cache key was the exact origin coordinate, so neighboring addresses shared nothing — and specced the fix: **H3 cell-based cache keys** (neighbors reuse one fetch) + **drive-time banding** (honest shared values, computed once per cell, with the safety tier kept exact). Expected: warm-cell marginal cost ~$0.65 → ~$0.03–0.04, no accuracy regression, no provider change.

Phased: **Phase 1 — FR-058 (pure Google) ✅ built, in review** → Phase 2 (OSRM self-hosted routing, when contract volume justifies) → Phase 3 (precomputed regional warehouse, on demand only). Google stays the POI source of truth throughout (rural accuracy is the differentiation).

**FR-058 delivered:** `src/shared/spatial.js` (`snapToCell`, H3), `classifyBand` in validate.js, a 14-day cell cache, centroid-based lifestyle search/drive-times, and a per-address-exact safety tier (hospital/urgent care). Dependency: `h3-js`. See `feature-requests/FR-058-spatial-cache-banding/` and NR-002/NR-003.

---

## Next Phases

### Phase 5 — New Chapters
Utilities Intelligence (FR-032), Life at This Address Calculator (FR-033), Chapter Enhancements (FR-034).

### Phase 6 — The Livably Sketch
Hand-drawn house that comes to life as the buyer scrolls. See LIVABLY-SKETCH-SPEC.md.

### Phase 7 — Monetization & Launch
Agent subscriptions, API licensing, white label. Deferred until product is solid (FR-022).

---

## Backlog — Captured Ideas & Detail
*Capture system, not a commitment list. Ideas go here when discussed; they graduate to an FR spec in `feature-requests/` when ready to build.*

### Life at This Address Calculator (FR-033 detail)
Interactive calculator at the end of the Daily Reachability chapter.
- **Profiles:** Remote Worker (0 commute days), Office Commuter (adjustable days/week), Family with Kids (adds school runs).
- **Sliders:** commute days/week (0–5), commute destination (nearest employment centers), kids in school (toggle), weekly grocery trips (1–3), monthly large-city trips (0–4).
- **Output:** weekly miles by trip type, annual miles, annual cost at IRS rate ($0.21/mi) and at avg gas prices, EV-equivalent annual cost, nearest L2 + DC-fast charger with drive time, home-charging feasibility note.
- **Georgetown KY example:** 3 days to Lexington (24mi each way) + school runs + groceries + city trips ≈ 131 mi/week ≈ 6,812 mi/year ≈ $1,431/year IRS rate.

### Utilities Intelligence (FR-032 detail)
Electric provider name + type (municipal/co-op/IOU); avg residential rate vs state avg; outage frequency + duration (NERC SAIDI/SAIFI); natural gas vs propane/electric-only; municipal water vs well; municipal sewer vs septic; recycling availability; all ISPs + tech + actual vs advertised speeds; EV charging monthly cost at local rate.

### Chapter Enhancements (FR-034 detail)
- **Health & Safety:** primary care accepting new patients within 15 min; hospital trauma designation (L1/L2/Community); specialist availability within 30 min.
- **Sensory:** air-traffic flight-path detection (FAA approach/departure paths), not just airport distance.
- **Property:** construction-era health risks (lead paint pre-1978, asbestos pre-1980, lead pipes pre-1986, polybutylene 1978–1995); deed restrictions/HOA CC&Rs; sun angle + seasonal access.
- **Daily Reachability:** civic infrastructure (library, community/rec center, post office).
- **Growth:** 10-year horizon (population trend, school enrollment, commercial vacancy) — documented signals, not speculation.
- **Climate:** watershed/upstream context (what flows toward this parcel, what's upstream).
- **What Will Grow Here:** microclimate (elevation delta from nearest station, frost-shift estimate, Dec vs June sun angle, prevailing wind) — *in-progress plan: `docs/superpowers/plans/2026-06-03-fr034-enhancement7-microclimate.md`.*

### Design ideas captured
- **The Livably Sketch** — hand-drawn house that builds as you scroll; each chapter adds elements; color wash tints by chapter at the end. Spec: LIVABLY-SKETCH-SPEC.md.
- **Claude Design exploration** — editorial/almanac direction; eclectic per-chapter visual personality; departure-board layout for Daily Reachability worth keeping. Ongoing in Claude Design.
- **Report as discovery experience** — dark portal → warm cream body; chapters animate in; drive-time counters count up; one "wow moment" per chapter; no map.

### Product direction decisions
- **No scoring — ever.** Three-bucket framework (Consider / Check / Cool to Know) is the only evaluation system (CONSTRAINT-001).
- **All chapters standard** — no premium tier; every buyer gets the full report.
- **Monetization (deferred):** agent subscriptions (bulk), ~$9.99/report for individuals, API licensing longer term.
- **Unique differentiators:** What Will Grow Here; Life-at-Address calculator; Utilities Intelligence; construction-era health risks; watershed/upstream context; the Livably Sketch; narrative quality.
- **What Livably is NOT:** not a restaurant finder, walk score, crime map (Fair Housing), home valuation, home inspection, or investment advice.

### Ideas not yet evaluated
Power-outage history by address (NERC/EIA); local-government financial health; in-house cell signal; aging-in-place reality; seasonal road access; what's upstream/uphill; emergency preparedness (evac routes, shelters, FEMA history); internet speed reality (M-Lab/Ookla); property boundary/easement reality.

### Tagline candidates (undecided)
"The place you're about to call home." · "The address is just the beginning." · "You found your home. Now discover what comes with it." · "Know before you sign." · "See beyond the listing."

---

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
  validate.js      Logic Layer — coherence rules (incl. classifyBand, FR-058)
  spatial.js       H3 cell primitive + cell fetch helpers (FR-058)
  google/          Google API client (distanceMatrix, geocoding, …)
  census.js        Census ACS / FIPS
src/utils/
  constants.js     All constants (interstates, exclusions, thresholds, band ladders)
  geo.js, time.js, text.js   Pure helpers
src/services/
  reportBuilder.js Orchestrates a report
src/cache.js       File-backed caches (geocode, places, drivetime, drivetime_cell)
```

## Key Documents
- **CLAUDE.md** — constraints, 4-phase workflow, architecture rules (read before changing any file)
- **This file** — project state, roadmap, backlog (single source of truth)
- **LIVABLY-ARCHITECTURE.md** — full restructure plan
- **LIVABLY-DESIGN-BRIEF.md** — complete design system (the only design reference)
- **LIVABLY-SKETCH-SPEC.md** — hand-drawn house animation spec
- **docs/plans/module-restructure.md** — module structure reference
- **docs/NARRATIVE-QUALITY-AUDIT.md** — 14-chapter quality audit (30-minute-Google test)
- **docs/nathan-reports/** — NR-XXX owner strategic reviews
- **docs/denny-reports/** — DR-XXX architectural briefs for Denny
- **docs/postmortems/** — PM-XXX, one per production bug
- **feature-requests/** — FR-NNN discovery / spec / plan / summary
