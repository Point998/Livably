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
- All 14 chapters rendering with real data (internet currently on its FR-061 fallback — FCC source dead, repair tracked in FR-062)
- Modular architecture: each chapter owns data.js / logic.js / template.js
- Depth slider system (FR-045): Glance / Overview / Deep Read / Research — all 14 chapters wired
- L3/L4 content complete for all 12 data chapters (Daily and Reach are structure only)
- L3/L4 visual distinction: chapter-colored border + research tint, content aligned with inner-pad
- Design system: Fraunces + DM Sans, design-tokens.css, report.css
- Error memory/logging layer
- Feature request workflow established with 4-phase process
- **Tests: 1,575 across 83 suites** (on `main`)
- **Completion (backend/data, frontend excluded): structure ~90%, data ~75%, blended ~80%** — see "Completion Roadmap" below
- **Architecture posture: Tier-2 single-instance monolith with Tier-3/4 discipline** — substrate (state/deploy/security/ops) not yet B2B-ready. Hardening plan in NR-004 → see "Hardening Track" below. **Stage 0 (CI, config validation, admin auth, rate-limit) leads the queue.**

## Active Work

### ▶ Session hand-off — 2026-06-17 (session 2, read first)
- **State:** `main` clean @ `90d07e1`, **1,575 tests / 83 suites** green, CI on every push, working tree clean. No open PRs awaiting action.
- **Shipped (this track):** FR-065 (PR #30 — reusable `sourceChain` primitive + NOAA→Open-Meteo climate-normals fallback; honest-provenance principle), FR-066 (PR #32 — Google-POI→OSM fallback for Reachability + shared `overpass.js`/`osmPlaces.js`; latent Overpass-406 fix), FR-067 (PR #35 — Walkability Google→OSM fallback; opt-in `searchOSMPOIs({withTags})` + `categorizeOSMWalkPOI`; observability fix for the swallow-to-empty outage mask).
- **Shipped (session 2, 2026-06-17):**
  - **FR-068 (PR #37 — degradation observability)** — the resilience track was adding silent-degradation sites faster than visibility. Instrumented the **`sourceChain` chokepoint** (where all fallbacks flow) with a request-scoped **`AsyncLocalStorage` ledger** (`src/shared/degradationLedger.js`): every fallback/miss/error/exhausted is recorded per report, concurrency-safe, crash-safe (no-ops without context → verify harness/tests untouched). `buildReport` emits one `type:'degradation'` log line per affected report; `/admin/health` gains a 7-day label×kind degradation panel. Right-sized for Tier-2: stdlib + existing logger + admin page — **NOT** Sentry/OTel/dashboards (gated on B2B). Every future A1 slice is now observable for free.
  - **FR-069 (PR #38 — Recreation Google→OSM fallback)** — park/coffee/library/rec center/post office now Google→OSM→link-floor (FR-066 single-nearest pattern). Fixed a latent renderer bug: `buildAdditionalServicesCardHTML` printed `driveTimeMinutes` raw (would render "null minutes" for OSM records) — now straight-line-aware via the existing helpers. **Pattern decision settled:** Recreation is the single-nearest pattern, NOT walkability's union-categorize one, so no shared categorize helper is warranted (the hypothetical second caller never materialized).
- **NEXT UP (no blockers, highest value): continue A1**, each a cheap `searchOSMPOIs` reuse (full 4-phase workflow; none safety tier): ~~Walkability~~ ✅ FR-067 · ~~Recreation~~ ✅ FR-069 → **(1) Sensory airports** — *different shape:* OSM tag `aeroway=aerodrome` (not shop/amenity), and **Sensory already uses OSM** (road-noise/rail/land-use via `shared/overpass.js`), so discovery must check how its existing OSM code is structured and whether the airport search is even Google-backed today → **(2) Growth commercial**. Then non-Google singles: USDA soil, USGS elevation, Census vintage.
- **Watch-items:** observability debt — FR-068 instrumented the sourceChain chokepoint, but a broader sweep of every `try/catch → null` swallow site across modules remains (FR-067's walkability fix is the template); single-instance state ceiling (Hardening Stage 1, the B2B gate); carryover — cell-cache the FR-065 modeled-normals result (Open-Meteo per-minute rate limit).
- **Deferred (human-in-loop):** B1 FR-062 (FCC BDC token), B2 NREL per-address rate (deploy-time verify). State externalization (Hardening Stage 1) deferred until B2B timeline is real — it's the bigger lift and speculative without demand; **if B2B goes near-term it jumps ahead of the remaining A1 slices.**
- **Reminders:** test-first, all 5 addresses; **doc PRs stay open for Nathan's review**; Overpass needs the UA header (in place) and rate-limits rapid calls (space live checks); prefer keyless live verification.

- **Active branch:** `FR-032-utilities-intelligence` — Utilities & Power chapter built (PR pending).
- **FR-032 (Utilities & Power): ✅ BUILT on branch** — new chapter (electric provider + rate-vs-state, state-level reliability, well/septic-vs-municipal inference, EV charging), cell-cached (FR-058 parity), placed after Costs. Full suite green (1,289 / 68). ⏳ **Populated live-data acceptance (Georgetown→Kentucky Utilities, Bozeman→NorthWestern Energy) deferred** — NREL was unreachable from the build sandbox; verify where NREL resolves. See `feature-requests/FR-032-utilities-intelligence/`.
- **Most recent (main):** FR-069 (Recreation Google→OSM cost-resilience fallback) — **merged (PR #38, squash).** Fourth slice of Track A1; preceded by FR-068 (degradation observability — sourceChain ledger, PR #37). See Track A item 1 + `feature-requests/FR-068-degradation-observability/` + `feature-requests/FR-069-recreation-osm-fallback/`. Full suite 1,575 / 83.
- **Recent chain:** NR-002 (API cost forecast) → NR-003 (spatial cost diagnosis) → FR-058 (Phase 1, shipped).
- **FR-034 (Chapter Enhancements): ✅ COMPLETE — all 7 enhancements merged to `main`** (enh 6 named watershed context shipped via PR #15). See FR-034 detail below.
- **Merged to `main`:** FR-032 Utilities (PR #17), FR-033 Life-at-Address (PR #18), FR-059 Seismic-risk-in-Climate (PR #19). FR-033 + FR-059 live-data-verified; FR-032's populated NREL data awaits a network where NREL resolves.
- **FR-061 (Internet as a utility): ✅ MERGED to `main` (PR #23, squash)** — relocated the FCC National Broadband Map integration from the Property chapter into Utilities & Power and reframed it as the lightweight "felt" treatment (who · typical band · what it means · brand-neutral satellite floor), no new data source. Property's internet tab/table/section removed cleanly. Full suite green (1,384 / 73). **Finding:** the old FCC `listAvailability` endpoint is retired (HTTP 405 across the whole `/api/public/map/*` surface) — pre-existing, a verbatim relocation of Property's fetcher — so live verify hit the graceful fallback for all 5 addresses. Repair tracked in **FR-062**.
- **FR-062 (FCC broadband repair): 📋 BACKLOG — design complete, build deferred** — restore live internet data via the official FCC Broadband Data Collection (BDC) API after the old keyless map API was retired (HTTP 405 across the whole surface). Design done: block-aggregate the published BDC availability files (which carry `block_geoid` + `brand_name`, so providers are retained — **no CostQuest Fabric license needed**); `bdc.fcc.gov` verified reachable (401 without auth). **Deferred** because the only blocker is a human-in-the-loop FCC BDC token (CORES/FRN registration asks for SSN/EIN — not worth the friction for a low-stakes "felt" tidbit right now). No production gap: chapter degrades gracefully via FR-061. Remaining-work checklist in `feature-requests/FR-062-fcc-broadband-repair/spec.md`.
- **FR-060 (Resilient Utilities fallback): ✅ MERGED to `main` (PR #21, squash)** — adds a data fallback behind FR-032's NREL dependency: NREL → HIFLD (electric provider/ownership, keyless ArcGIS) + OpenChargeMap (EV) → existing OpenEI/AFDC link fallback. Template gains a "provider known, rate unknown" state (state-average rate context) + HIFLD/OCM provenance notes. **Closes FR-032's NREL provider-verification gap** — HIFLD live-verified across all 5 addresses (Georgetown/Harlan→Kentucky Utilities, Louisville→Louisville Gas & Electric, Bozeman→NorthWestern Energy, Jeffersonville→Duke Energy Indiana). New optional `OPENCHARGEMAP_API_KEY`. Full suite green at 1,371 / 73. See `feature-requests/FR-060-resilient-utilities-fallback/`.
- **Phase 6 (The Livably Sketch): DEFERRED** — excluded for now (it prematurely sets the visual identity; design-setting work is deferred to a dedicated design phase). See LIVABLY-SKETCH-SPEC.md.
- **Direction:** new data goes into the chapter where it fits (e.g. seismic → Climate), not new similar chapters. Most clean free data is already consumed by Climate/Sensory/Property/Utilities.

---

## Completion Roadmap — Structure & Data (to "done for now")

*Added June 2026. Backend/data only — frontend (Phase 6 Sketch) is excluded by design. Honest self-assessment: **structure ~90%, data ~75%, blended ~80%**. The number depends on where "100%" is drawn: against the **currently-scoped 14-chapter model** it's ~85%; against the **full data-differentiation vision** (incl. the breadth backlog) it's ~75%.*

**"Done for now" = all 14 chapters' data sources live + verified against the 5 test addresses + resilient — NOT every breadth idea.** Breadth items (Track B, #4+) are optional upside, promoted to their own FR when a session takes them on.

### Track A — Structure / Architecture (~90% → done)
1. **Extend the FR-060 resilience pattern** (primary → fallback → graceful link) beyond Utilities to other single-source modules — each lone API (NOAA climate, USDA soil, Google in health/reachability, etc.) is a single point of failure today. *Highest structural value.* — 🟡 **IN PROGRESS. First slice shipped as FR-065 (PR #30):** the pattern is now a **reusable `src/shared/sourceChain.js` primitive** (ordered sources → first-valid wins → provenance tag → miss/error logged), proven on the climate-normals path (NOAA station normals → Open-Meteo ERA5 modeled climatology → link floor). Also codified the **honest-provenance** product principle (surface the best regional signal *with* a plain-language callout; never manufacture precision). **Remaining A1 slices** (each its own FR, reusing the primitive): USDA soil, USGS elevation, Census vintage. **Second slice shipped as FR-066 (PR #32):** the **Google-POI cost-resilience fallback** — Reachability grocery/pharmacy/gas now fall back to OSM (keyless, honest straight-line distances) when Google quota/spend trips, via reusable `shared/overpass.js` + `shared/osmPlaces.js`; safety tier (Health/Schools) untouched. **Bonus fix:** Overpass returns HTTP 406 to Node's default `fetch` User-Agent — a pre-existing latent bug that was silently degrading Sensory's OSM features (road noise/rail/land use) too; fixed in `shared/overpass.js`. **Third slice shipped as FR-067 (PR #35):** the same Google→OSM fallback for **Walkability** — one Overpass *union* call via a new opt-in `searchOSMPOIs({withTags})` + client-side `categorizeOSMWalkPOI` (tag→walk-category), same weight rule as the Google proxy, short-TTL `placesOsmCache`. **Bonus observability fix:** the Google walkability fetcher previously swallowed *total* failure to `score:0` — indistinguishable from a rural walk-desert and showing green in the source monitor during an outage; now it returns `null` on all-rejected (→ chain reaches OSM, → monitor sees red) while a genuine empty area still scores 0. **Fourth slice shipped as FR-069 (PR #38):** the same Google→OSM fallback for **Recreation** (park/coffee/library/rec center/post office) — the single-nearest reachability pattern; fixed a latent renderer bug that would have printed "null minutes" for OSM records. **Observability milestone — FR-068 (PR #37):** instrumented the `sourceChain` chokepoint with a request-scoped `AsyncLocalStorage` degradation ledger so every fallback is recorded per report + surfaced in a `/admin/health` panel — every A1 slice is now observable for free. **Remaining A1 slices:** Sensory airports (`aeroway=aerodrome`; Sensory already uses OSM, so check existing structure first), Growth commercial; then USDA soil, USGS elevation, Census vintage. See `feature-requests/FR-065-…/` through `FR-069-…/`.
2. **Source-verification harness** — ✅ **DONE, shipped as FR-063.** `npm run verify:sources` discovers a `SOURCES` descriptor per module's `data.js` (41 descriptors across all 14 modules), runs each live against the 5 test addresses with flap tolerance (retry-once) and a per-provider concurrency cap, and renders a module × source verdict matrix (PASS/FAIL/INFO/SKIPPED). A scheduled `.github/workflows/verify-sources.yml` monitor (Mondays + manual dispatch) runs it in CI and opens/updates/closes a GitHub issue on FAIL. See `feature-requests/FR-063-source-verification-harness/summary.md`.
3. **Production hardening** — now its own first-class workstream with teeth + ordering. **See the Hardening Track below (NR-004).**

---

## Hardening Track — Closing the Tier Gap (NR-004)

*Added June 2026. Source: NR-004 architecture hardening review (`docs/nathan-reports/NR-004-architecture-hardening-review.md`). Livably today is a **Tier-2 single-instance monolith with Tier-3/4 discipline** — the governance is real but the substrate (state, deployment, security, ops) cannot run on a second box. This track seals the foundation before B2B load. Not a rebuild (NR-001 already fixed the code bones) — edge-hardening + one state-layer swap.*

**Top findings (ranked by what breaks, and when):**
- 🔴 **State is local disk + process memory** (`.cache/`, `data/reports.json`, in-memory `usageLog`) → hard single-instance ceiling. *The enterprise blocker.*
- 🔴 **No CI** — 1,384 tests nothing runs automatically. *Highest ROI fix.*
- 🟠 **No inbound rate limiting / `helmet` / input guards** — public `/report` triggers metered Google calls → cost-DoS.
- 🟠 **Admin mutation endpoints unauthenticated** — `/admin/clear-cache|api-usage|cache-stats` lack the IP guard `/admin/health` has (`app.js:98-107`); `clear-cache` POST can force fully-billed cold refetches.
- 🟠 **File JSON read-modify-write races** (`reportStore.js:24-33`, logger, errorMemory) — lost writes / corruption under concurrency.
- 🟡 **No startup config validation** — fails per-request (`app.js:36`), not loud at boot.
- 🟡 **In-process Puppeteer** — ~300MB Chromium per request, unbounded busy-wait (`app.js:121-132`); OOM/latency bomb at volume.
- 🟡 **Vanilla JS at ~12k LOC** — loosely-typed shapes across module boundaries; a growing tax, stage a TS migration.
- 🧵 **Thread:** graceful degradation (CONSTRAINT-015) buys UX resilience with **observability debt** — swallowed `null`s hid the FCC 405. FR-063 pays down one slice; the real fix is a generalized observability layer.

### Stage 0 — Near-zero-cost wins (~1 day; do BEFORE new feature work, incl. FR-063)
1. **CI workflow** — `npm test` on every push/PR.
2. **Startup config validation** — `config.js` asserts required env at boot, crashes loud.
3. **Lock down `/admin/*`** — one shared guard on all four routes.
4. **`helmet` + `express-rate-limit`** on public routes.

### Stage 1 — Multi-instance capability (BEFORE signing a B2B contract)
5. **Externalize state** behind the existing `Cache` interface seam — managed Redis (caches) + small Postgres (reports/usage), or object storage + Postgres. Swap impl, keep callers. *(The Tier-2 → scalable unlock.)*
6. **Move PDF generation out-of-process** — worker queue or managed render service.
7. **Atomic writes** — falls out of #5 for free.

### Stage 2 — Durability & type safety (incremental, no big-bang)
8. **Observability layer** — keep JSONL logs + add error tracking + real `/health`/`/ready`; fold FR-063 in as a scheduled synthetic monitor.
9. **TypeScript file-by-file** — start at orchestrator + `validate.js`; `// @ts-check` + JSDoc as a zero-migration first step.

**"Hardening done for now" =** CI green on every push · fails loud on misconfig · no public endpoint can become an unbounded Google bill · no unauthenticated admin mutation · a second instance runs behind a load balancer with zero cache-coherence loss · every swallowed failure is visible on a dashboard.

### Track B — Data Collected (~75% → done)
**Repair / verify first (close known holes in the current model):**
1. **FR-062 — FCC broadband repair** — 🅿️ **DEFERRED (re-confirmed 2026-06-16):** still blocked on the human-in-the-loop FCC BDC token. `bdc.fcc.gov` reachable (405 bare / 401 with date) but no token in `.env`; no `BDC_USERNAME`/`BDC_API_TOKEN`. FR-061 fallback = no production gap. Pick up the moment the token exists. See Deferred section + `feature-requests/FR-062-fcc-broadband-repair/`.
2. **NREL per-address electric rate** — 🅿️ **DEPLOY-TIME ACCEPTANCE CHECK (re-confirmed 2026-06-16):** NREL still unreachable from Nathan's dev env (`developer.nrel.gov` DNS does not resolve → curl `HTTP 000`, `time_namelookup 0.0s`, even sandbox-disabled). Code is correct + shipped (`getElectricFromNREL`, `utilities/data.js`). This is a **live-verify, not a build** — run on a clean-DNS network/deploy with a real `NREL_API_KEY` and confirm the 5 test addresses return a residential rate (Georgetown→Kentucky Utilities, Bozeman→NorthWestern Energy, etc.). HIFLD already covers the provider name, so no functional gap until then.
3. **Reachability "Daily / Reach" L3/L4 content** — currently structure-only; fill in the depth content.

**Then breadth (new data — ordered by rough value; promote to an FR when picked up):**
4. Power-outage history by address (NERC/EIA) → Utilities.
5. Emergency preparedness — evac routes, shelters, FEMA disaster history (possible own area).
6. In-home cell signal (FCC mobile coverage) → Utilities/Sensory.
7. Property boundary / easement reality → Property.
8. Local-government financial health → fit TBD.
9. Measured internet speed (M-Lab/Ookla) → pairs with FR-062.

### Sequencing suggestion for future sessions
**Hardening Stage 0, A2 (FR-063), the B1/B2 attempt, and A1's first two slices (FR-065, FR-066) are now behind us.** **B1/B2 remain DEFERRED on human-in-the-loop blockers** (2026-06-16: FR-062 needs the FCC BDC token; NREL is a deploy-time live-verify, still DNS-unreachable from dev) — see Track B items 1–2. **A1 is in progress:** FR-065 shipped the reusable `sourceChain` primitive + the NOAA→Open-Meteo climate-normals slice; FR-066 shipped the Google-POI cost-resilience fallback (Reachability → OSM) + `shared/overpass.js`/`osmPlaces.js`. Revised order: **Stage 0 → A2 (FR-063) → ~~B1/B2~~ (deferred) → A1 [primitive + NOAA + Google-POI slices done; more remain] → Hardening Stage 1** (state externalization, before any B2B contract). **Next up: continue A1** — each remaining slice is a cheap reuse of the shared helpers. Suggested order by value: **extend the OSM fallback to the other Google modules** (Walkability, Recreation, Sensory-airports, Growth-commercial — reuse `searchOSMPOIs`), then USDA soil, USGS elevation, Census vintage. Near-term polish carried over: **cell-cache the FR-065 modeled-normals result** (Open-Meteo per-minute rate limit). Track B breadth items follow one FR at a time as upside.

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

Phased: **Phase 1 — FR-058 (pure Google) ✅ merged (PR #10)** → Phase 2 (OSRM self-hosted routing, when contract volume justifies) → Phase 3 (precomputed regional warehouse, on demand only). Google stays the POI source of truth throughout (rural accuracy is the differentiation).

**FR-058 delivered:** `src/shared/spatial.js` (`snapToCell`, H3), `classifyBand` in validate.js, a 14-day cell cache, centroid-based lifestyle search/drive-times, and a per-address-exact safety tier (hospital/urgent care). Dependency: `h3-js`. See `feature-requests/FR-058-spatial-cache-banding/` and NR-002/NR-003.

---

## Next Phases

### Phase 5 — New Chapters
Utilities Intelligence (FR-032), Life at This Address Calculator (FR-033), Chapter Enhancements (FR-034).
- **FR-034 — ✅ COMPLETE (7/7 merged).**
- **FR-032 Utilities — ✅ merged (PR #17)** (populated NREL verification deferred until NREL is reachable).
- **FR-033 Life-at-Address — ✅ merging** (EIA gas + IRS rate verified live). See `feature-requests/FR-033-life-at-address/`.

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
*Status as of June 2026: ✅ ALL 7 enhancements merged to `main`. FR-034 is complete.*
- **Property (enh 1) — ✅ shipped:** construction-era health risks (lead paint pre-1978, asbestos pre-1980, polybutylene 1978–1995) in the L3 Building Age tab. *Not shipped: deed restrictions/HOA CC&Rs; seasonal road access.*
- **Daily Reachability (enh 2) — ✅ shipped:** civic infrastructure (library, community/rec center, post office) in Additional Services.
- **Growth (enh 3) — ✅ shipped:** 10-year horizon synthesis (permit trend + pipeline + commercial), documented signals, not speculation.
- **Health & Safety (enh 4) — ✅ shipped:** CMS hospital type/designation + NPI primary-care count in a new Healthcare Ecosystem L3 tab. *Not shipped: specialist availability within 30 min.*
- **Sensory (enh 5) — ✅ shipped:** airport direction ("to the north") via bearing math. *Deferred: FAA approach/departure-corridor detection (runway/ICAO mapping).*
- **Climate (enh 6) — ✅ shipped:** named HUC-12 watershed + HUC-8 basin (USGS WBD, cell-cached) at L3/L4, augmenting the existing topographic-position signal (`buildWatershedHTML`). *Deferred: named draining stream (no verified NLDI `gnis_name` source); upstream land-use/hydrology tracing.*
- **What Will Grow Here (enh 7) — ✅ shipped:** microclimate (USGS elevation + Dec vs June solar angle + shadow-length reference) in the Garden Overview. *Plan: `docs/superpowers/plans/2026-06-03-fr034-enhancement7-microclimate.md`.*

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

### Deferred — blocked on human-in-the-loop
- **FR-062 (FCC broadband repair)** — design complete, parked on obtaining an FCC BDC API token (CORES/FRN + SSN/EIN friction). Restores live internet data for the Utilities Internet section. Ready to build the moment a token exists; no production gap meanwhile (FR-061 fallback). See `feature-requests/FR-062-fcc-broadband-repair/spec.md` → "Remaining work to complete".

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
  utilities/       Utilities intelligence (FR-032/060/061: electric, reliability, EV, internet)
  traffic/         Traffic patterns
  property/        Property intelligence (soil, building age, permits)

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
