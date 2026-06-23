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
- **Architecture posture: Tier-2 single-instance monolith with Tier-3/4 discipline** — substrate (state/deploy/security/ops) not yet B2B-ready. Hardening plan in NR-004 → see "Hardening Track" below. **Stage 0 (CI, config validation, admin auth, rate-limit) SHIPPED (FR-064); cost circuit-breaker SHIPPED (FR-075). Stage 1 (state externalization) is the remaining B2B gate.**

## Active Work

### ▶ Session hand-off — 2026-06-23 (session 8 — **READ FIRST: cross-state audit DONE → next = resume contract rollout**)
*Session 8 completed the bounded cross-state audit from session 7: shipped **FR-083** (PM-006, pharmacy cross-state filter — the real target) and confirmed the hospital-enrichment path is clean. The session-7 block below is now reference.*
- **State:** branch `FR-083-pharmacy-crossstate-filter` (PR open — squash-merge then delete). **93 suites / 1,741 tests** green (was 1,732, +9). Verify with `git log` + `npx jest` before acting (hand-offs go stale — see [[verify-handoff-against-code]]).
- **✅ Done — FR-083 / PM-006 (pharmacy cross-state, CONSTRAINT-006 gap):** `findNearestPharmacy(originLatLng, cell, originState)` now routes the final selection through `checkCrossState` via a new `finalizePharmacyRecord` helper — **warn-don't-reject** (mirrors the health safety tier; pharmacy is grouped with hospital/urgent care in the constraint). Applied once at the public entry → covers Google + OSM uniformly, per-address; returns a **new** object so the FR-058 cell cache isn't poisoned across border-straddling addresses. Template surfaces the note in both narrative branches; `reportBuilder` threads `originState`; `compareBuilder` left as no-op. No-op when state empty. +9 tests (data/template/Jeffersonville). See PM-006 + `feature-requests/FR-083-pharmacy-crossstate-filter/`. **Reinforces CONSTRAINT-014.**
- **✅ Audited PASS — hospital enrichment:** `findNearestHospital`/`findNearestUrgentCare` are already drive-time-verified + cross-state-warned (`health/data.js`); `getHealthcareDepth` only *decorates that already-vetted hospital* — no independent cross-state surface. No action needed.
- **Cross-state audit CLOSED:** CONSTRAINT-006's named list (school, hospital, urgent care, pharmacy) is now **fully guarded**. Grocery/gas/coffee remain deliberately out of scope.
- **✅ Done — FR-084 (safety contract, rollout #5):** migrated the **safety** chapter (police/fire response + ISO/crime research) to the contract — **reused `place{}`, no schema change**. New `src/modules/safety/contract.js` — `buildSafetyContract({emergency, safetyLocation}, opts)`. Findings: `police-response`/`fire-response` (consider; `place` + `response_minutes` measure, tone via `responseTone` ≤8/≤12/>12, `modeled:true`; missing → `*-missing` check + instruction fallback), `iso-ppc` (check, always, instruction fallback), `crime-research` (check, always, **no measure** — CONSTRAINT-002 pointer-only, url fallback). **Dropped the graded `response.category` label+color (CONSTRAINT-001/008) — derived tone instead.** +13 tests / +3 snapshots incl. Jeffersonville IN. Wired additively into `reportBuilder`. See `feature-requests/FR-084-safety-contract/`.
- **✅ Done — FR-085 (reachability contract, rollout #6):** migrated the reachability "Daily Conveniences" (**grocery/pharmacy/gas**) to the contract — reused `place{}`, no schema change. New `src/modules/reachability/contract.js` — `buildReachabilityContract({grocery, pharmacy, gasStation}, opts)`. Shared `destFinding` helper: `nearest-grocery`/`nearest-pharmacy`/`nearest-gas` (consider; `drive_minutes` measure + `driveTone` ≤10/≤20/>20; OSM straight-line → `straight_line_miles` + `modeled:true` + caveat; missing → check + Maps url fallback). **Caution overrides:** grocery `coherenceWarning` (CONSTRAINT-010) + pharmacy `crossStateWarning` (FR-083) → tone caution + note (verified: 10-min KY pharmacy for Jeffersonville IN reads caution). Test asserts no internal-key leakage (bandRung/coherenceWarning/location/etc.). +13 tests / +3 snapshots incl. Jeffersonville IN. See `feature-requests/FR-085-reachability-contract/`.
- **✅ Done — FR-086 (recreation contract, rollout #7):** migrated the recreation amenities (**park/coffee/library/rec/post**) to the contract — reused `place{}`, no schema change. New `src/modules/recreation/contract.js` — `buildRecreationContract({park, coffeeShop, library, recCenter, postOffice}, opts)`. Shared `amenityFinding` helper: one `cool` finding per **present** amenity (`drive_minutes` measure + `amenityTone` ≤10 favorable/else neutral — **never caution**; OSM straight-line → `straight_line_miles` + `modeled:true` + caveat). **Absent amenities omitted** (no `*-missing` — discretionary, faithful to template). `elementarySchool` excluded (schools boundary). +11 tests / +3 snapshots incl. Jeffersonville IN. See `feature-requests/FR-086-recreation-contract/`.
- **✅ Done — FR-087 (access contract, rollout #8 — COMPLETES located-facility rollout):** migrated the access chapter (nearest interstate on-ramp) to the contract — reused `place{}`, no schema change. New `src/modules/access/contract.js` — `buildAccessContract({highwayRamp}, opts)`. Single `highway-access` finding (consider; `place` + `drive_minutes` measure + `driveTone` ≤10/≤20/>20; `note`→`defaultCopy`). **Returns null when highwayRamp absent** (faithful to template, which omits "Getting Around"). +9 tests / +3 snapshots incl. Jeffersonville IN. See `feature-requests/FR-087-access-contract/`.
- **✅ Done — FR-088 (property contract, rollout #9 — FIRST non-located chapter):** migrated Property Intelligence (soil + construction era/vintage) — bespoke findings from `propIntel`, no `place{}`. New `src/modules/property/contract.js` — `buildPropertyContract(propIntel, opts)`: `construction-era` (consider; `year_built` measure, neutral — factual median, not a quality judgment), `era-health-risks` (check/caution; only when era cautions present; inspection instruction), `soil-drainage` (check; tone via `toneFromDrainageColor`, color dropped; `isHydric`→caution+note) **or** `soil-missing` (check; SoilWeb url fallback — CONSTRAINT-015 floor), `new-construction` (cool; `percent` measure — housing-stock fact, CONSTRAINT-002 safe). +13 tests / +3 snapshots incl. Jeffersonville IN. See `feature-requests/FR-088-property-contract/`. **Established the non-located pattern:** tone from existing semantic signals (drop colors), factual measures with units, omit/fallback per CONSTRAINT-015.
- **✅ Done — FR-089 (walkability contract, rollout #10 — counts-only, CONSTRAINT-001 resolved):** **Nathan's decision: surface destination counts, drop the composite score.** Data-layer additive change: Google + OSM walkability outputs now expose a `counts` map `{Grocery,Dining,Transit,Park,Pharmacy}` (score/category kept for SSR only). New `src/modules/walkability/contract.js` — `buildWalkabilityContract(walkability, opts)`: one `walkable-{category}` finding per count>0 (cool/favorable; `places_within_walk` measure; nearest+walk-min in defaultCopy); car-dependent/unavailable → single `walkability-pointer` (check) + Walk Score url fallback. **The 0–100 score + graded category are NEVER read or emitted** (test asserts no score/category/color leak). +15 tests / +3 snapshots incl. Jeffersonville IN. See `feature-requests/FR-089-walkability-contract/`.
- **▶▶ DO NEXT — continue non-located chapters. 10 of 14 done** (utilities, community, health, schools, safety, reachability, recreation, access, property, walkability). Remaining: **environment** (FEMA flood zone + EPA air — factual/categorical, good `comparison{}` use — recommended next), **growth**, **garden**, **costs**; multi-source **climate** last. Per-module `contract.js` + `safeBuild` + Zod + per-address snapshots incl. Jeffersonville; derive `tone` from existing semantic signals (drop colors/labels — CONSTRAINT-001/008), surface `comparison{basis, referenceValue, direction, deltaPct}` for state/national-relative data (CONSTRAINT-002: national median only for income). **Watch for more CONSTRAINT-001 score/grade traps** (like walkability) in growth/costs. See "Contract rollout pattern" below.

### ▶ Session hand-off — 2026-06-23 (session 7 — *cross-state audit handed off; completed in session 8 above*)
*Session 6 shipped FR-080 (health), FR-081 (schools) + FR-082 (PM-005 cross-state fix). All merged. This block is reference; session 8 above is the live NEXT-UP.*
- **State:** `main` clean @ `aeb5072` (FR-080 #50, FR-081 #51, FR-082 #52 — all squash-merged), **1,732 tests / 93 suites** green. No open PRs. Verify with `git log` + `npx jest` before acting (hand-offs go stale — see [[verify-handoff-against-code]]).
- **Contract rollout state: 4 of 14 chapters done** (utilities, community, health, schools). `place {name,address}` primitive (FR-080) is live and reused — use it for every located-facility chapter; do **not** re-invent or cram into `subject`/`defaultCopy`.

- **▶▶ DO NEXT (decided via /vibe-architect, in priority order):**
  1. **Bounded cross-state audit (correctness — do before more rollout).** PM-005 proved CONSTRAINT-006 was enforced per-*function*, not per-*class*. Verify the constraint's **named** paths only:
     - **Pharmacy** = the real target. CONSTRAINT-006 explicitly names "school, hospital, urgent care, **or pharmacy**." Check the pharmacy search path (`src/modules/reachability/data.js` — `findNearestPharmacy`/equivalent) for a `checkCrossState` call. **Likely missing** → if so, write it up as **PM-006 + a fix FR** mirroring FR-082 (thread `originState`, prefer in-state, flag cross-state within 50mi, no-op when state empty, +Jeffersonville regression test).
     - **Hospital enrichment** = quick *confirm, don't assume*. `findNearestHospital` is already drive-time-verified + cross-state-warned; `getHealthcareDepth`/`getCMSHospitalType` only *decorate that already-vetted hospital* (CMS by the hospital's own zip; NPI by origin city/state) — so it almost certainly has **no** independent cross-state surface. 5-min read to confirm, then record "audited PASS."
     - **OUT OF SCOPE — do not audit:** grocery, gas, coffee, etc. CONSTRAINT-006 deliberately omits them — a cross-state grocery is a valid result, not a coherence bug. Auditing them = gold-plating.
     - Outcome: gap found → PM + fix FR; clean → one-line "audited PASS" in this roadmap. Time-box it.
  2. **Resume the contract rollout.** Next located-facility chapter: **safety** (fire/police — the other half of the visual "Health & Safety" chapter; reuses `place{}`) or **reachability**. Same pattern: per-module `contract.js` + `safeBuild`/Zod + per-address snapshot incl. Jeffersonville, wired additively into `contract.chapters` in `reportBuilder.js`. Cross-state attention on any remaining located paths comes free as a discovery byproduct of reading those files.

- **Contract rollout pattern (proven 4×):** new `src/modules/<chap>/contract.js` exporting `build<Chap>Contract(input, opts)` → maps logic output to findings `{id, bucket(consider|check|cool), tone(favorable|neutral|caution), claim{subject, measure, comparison, place?}, provenance{source,asOf,modeled}, fallbackAction?, defaultCopy?}` → `safeBuild('<chap>', ...)`. Tone is *derived* (never a color). `place{}` for located facilities. Missing datum → actionable `fallbackAction` (CONSTRAINT-015). Test: schema-valid + per-address snapshots incl. Jeffersonville. Wire `contract.chapters.<chap>` additively (schemaVersion bumps only on breaking change).
- **Tracked follow-ups (lower priority):** optional `lat/lng` on `place` when an FE map consumer exists; precise vintage in `provenance.asOf`; delete `defaultCopy` when FE owns voice; global `logic.js` `color`→`tone` refactor; FE rendering strategy (SSG/SSR vs SPA, given "delivered as a web link"). **Note:** 16 module folders vs "14 chapters" — settles as composite chapters land (Health & Safety = health + safety; Reachability/Walkability/Traffic groupings).

### ▶ Session hand-off — 2026-06-23 (session 6 — **FR-080 Health + FR-081 Schools contracts**) *(reference; superseded by session 7 above)*
*This session shipped **FR-080** (health, contract's first schema evolution) and **FR-081** (schools, reused the new `place{}` primitive), and discovered + documented a cross-state bug (**PM-005 / FR-082**).*
- **State:** `main` clean @ `a01e4cd` (FR-080 #50, FR-081 #51, both squash-merged), **1,726 tests / 92 suites** green. No open PRs.
- **Shipped — FR-081 (schools contract, rollout #3):** migrated the **schools** chapter to the contract — **reused the FR-080 `place{}` primitive, no schema change** (the payoff of building it as a primitive). New `src/modules/schools/contract.js` — `buildSchoolsContract(getSchoolRatings_output, opts)`. Findings: `assigned-school` (headline `check`/`caution` + district-verification instruction, CONSTRAINT-015), `nearest-public-{level}` (place + drive_minutes/miles measure, tone by ≤10/11–20/>20), `private-school-{i}` (each private school its own place finding). The data carries **no ratings** so the contract surfaces none (CONSTRAINT-001). `reportBuilder` envelope now carries `chapters.schools`. +12 tests incl. Georgetown/Harlan/Jeffersonville. See `feature-requests/FR-081-schools-contract/`.
- **✅ Fixed — PM-005 / FR-082 (cross-state school, CONSTRAINT-006 gap):** `getSchoolRatings()` now takes `originState` and routes every public/private candidate through `checkCrossState` — prefers nearest in-state, permits nearest cross-state only within 50 mi (flagged `crossState`/`crossStateNote`), drops beyond; FR-081 contract reads the marker → `tone:caution` + note. No-op when state empty. +6 tests incl. `tests/chapters/schoolRatings.test.js` (PM-005 regression, Jeffersonville IN). See PM-005 + `feature-requests/FR-082-schools-crossstate-filter/`. **Reinforces CONSTRAINT-014.** **Follow-on audit still open:** re-check hospital (`getHealthcareDepth` vs `findNearestHospital`), pharmacy, grocery multi-path searches for the same class of gap.
- **Shipped — FR-080 (health contract, rollout #2):** migrated the **health** chapter (ER / urgent care / CMS+NPI healthcare depth) to the contract. New `src/modules/health/contract.js` — `buildHealthContract({hospital, urgentCare, healthcareDepth}, opts)`, pure mapping. Findings: `emergency-room` (place + `drive_minutes` measure, tone by ≤10/11–20/>20 tier), `urgent-care` (favorable if closer than ER), `hospital-type` (CMS), `primary-care` (CMS NPI, count measure), plus `*-missing` actionable fallbacks (CONSTRAINT-015). `reportBuilder` envelope now carries `chapters.health`. +18 tests incl. Georgetown/Harlan/Jeffersonville snapshots. See `feature-requests/FR-080-health-contract/`.
- **Key decision — FIRST schema evolution (ADR):** added one **optional, non-breaking** field `ClaimSchema.place {name, address}` (`.strict().nullable().optional()`) — the reusable **located-facility primitive**. Driven by real recurring need across ~5 chapters (health, schools, safety, reachability), NOT speculation; chosen over cramming name into `subject` + address into the disposable `defaultCopy` (lossy). schemaVersion stays **1.0** (additive); existing utilities/community contracts validate unchanged. **Coordinates deliberately excluded** until a real FE map consumer exists (non-breaking add later). ADR-1: boundary = health module only — fire/police ("emergency") is the **safety** module's data → its own contract later; the FE composes the visual "Health & Safety" chapter.
- **NEXT UP — continue the rollout:** **4 of 14 chapters on the contract** (utilities, community, health, schools); ~10 remain. `place{}` (FR-080) is proven and reused (FR-081) — next located-facility chapters: safety (fire/police), reachability. Same pattern each: per-module `contract.js` + `safeBuild`/Zod conformance + per-address snapshot incl. Jeffersonville, wired additively (`schemaVersion` bumps only on breaking change). FR-082 (PM-005 cross-state school filter) is **done**. Next located-facility chapter: safety (fire/police) or reachability. Tracked follow-ups: optional `lat/lng` on `place` when an FE map consumer exists; precise vintage in `provenance.asOf`; delete `defaultCopy` when FE owns voice; global `logic.js` `color`→`tone` refactor; FE rendering strategy (SSG/SSR vs SPA). **Note:** 16 module folders vs "14 chapters" — the count settles as composite chapters (Health & Safety = health + safety; Reachability/Walkability/Traffic groupings) land.

### ▶ Session hand-off — 2026-06-21 (session 5 — **FR-076 + FR-077 Degradation Coverage, then FR-078 Headless Contract started**) *(superseded by session 6 above; its "2 of 14 / 12 remain" NEXT UP is now 3 of 14 — see above)*
*Next session starts here. This session shipped **FR-076** (utilities pilot) + **FR-077** (fan-out → logging + 015 audit), then started the **headless-report-contract** initiative (**FR-078**, utilities pilot, PR open).*
- **State:** `main` clean @ `e493680` (FR-076 #46, FR-077 #47, FR-078 #48, FR-079 #49 — all squash-merged), **1,696 tests / 90 suites** green, CI green on Node 20.x + 22.x. No open PRs.
- **Shipped — FR-078 (headless report contract, utilities pilot):** Nathan is going fully **headless** — backend emits a versioned, presentation-free JSON **contract**; the frontend is built separately later (Claude design, full creative freedom). Pilot proved the contract + governance on utilities: new `src/contract/schema.js` (**Zod** single source of truth; `.strict()` makes a stray `color`/`score`/demographic field throw at parse → CONSTRAINT-001/-002/-008 become structural; `safeBuild` crash-safe; `chapterContractJsonSchema` exported for FE types), `src/modules/utilities/contract.js` (maps `assembleUtilities` → findings `{bucket, tone, claim{subject,measure,comparison}, provenance, fallbackAction, defaultCopy?}`; tone derived not colored), a throwaway reference renderer, and `GET /api/report.json`. +24 tests incl. per-address snapshots + Jeffersonville. **Key ADRs:** REST+Zod now / GraphQL only on consumer-count>1 (cheap bolt-on later); `defaultCopy` is transitional scaffolding (delete when FE owns voice); constraints enforced by schema not review. New deps: `zod`, `zod-to-json-schema`. See `feature-requests/FR-078-headless-report-contract/`.
- **Shipped — FR-079 (community contract, rollout #1, PR open):** migrated the **community** chapter to the contract — picked first because it's the Fair-Housing-sensitive one (CONSTRAINT-002). Key ADRs: **every community finding is `tone: neutral`/`bucket: cool`** (demographics are context to know, never a favorable/caution judgment — stricter than the live UI), **income compares to national median only**, missing-income → data.census.gov fallback (agrees with FR-077). +10 tests incl. Jeffersonville. `reportBuilder` envelope now carries `chapters.community`. See `feature-requests/FR-079-community-contract/`.
- **NEXT UP — continue the rollout:** **2 of 14 chapters on the contract** (utilities, community); **12 remain**. Same pattern each: per-module `contract.js` + `safeBuild`/Zod conformance + per-address snapshot, wired additively into the report envelope (`schemaVersion` bumps only on breaking change). Then build the frontend against the stable contract. Tracked follow-ups: precise ACS vintage in `provenance.asOf`; delete `defaultCopy` when FE owns voice; global `logic.js` `color`→`tone` refactor; decide FE rendering strategy (SSG/SSR vs SPA) given "delivered as a web link".
- **State (prior):** `main` clean @ `f07abad` (FR-076 PR #46 + FR-077 PR #47, both squash-merged), **1,662 tests / 87 suites** green, CI green on Node 20.x + 22.x.
- **Shipped — FR-077 (degradation coverage fan-out):** Nathan asked to fan FR-076 out to the other 6 SOURCES-but-no-runtime-`sourceChain` modules (health, community, access, schools, safety, garden). **Discovery disproved the premise — none has a utilities-style silent `||` fallback** (all single-source or multi-datum-single-source-each, mostly already `Promise.allSettled`-resilient), so there was no `sourceChain` routing to do. Minimal scope chosen: (1) `community/data.js` last `console.error`→`logError`; (2) one real CONSTRAINT-015 gap fixed — `community/template.js` income-null "Income data unavailable" → actionable data.census.gov fallback. The other 5 modules audited **PASS/N-A** (named actionable fallbacks already present; `if(!data) return ''` = chapter omission, acceptable). +5 tests. See `feature-requests/FR-077-degradation-coverage-fanout/`. **The FR-076+077 pair completes the degradation-observability story.**
- **Re the FR-076 hand-off below (now superseded):** FR-076 is merged; its "fan out to 6 modules" NEXT-UP is **done** (= FR-077, and the fan-out turned out to be an audit, not a routing job).
- **Shipped — FR-076 (utilities pilot):** discovery found the parked "swallow-site sweep" framing was stale — the real gap is that **degradation is recorded only by `sourceChain`, and 7 modules define a `SOURCES` array (so the FR-063 verify harness shows them resilient) but never call `sourceChain()` at runtime** (utilities, health, community, access, schools, safety, garden) → their real-report fallbacks are invisible to the FR-068 ledger. This FR fixed **utilities** as the pilot: routed its two hand-rolled `||` fallbacks (electric NREL→HIFLD, EV NREL→OpenChargeMap) through `sourceChain` (`label: utilities-electric` / `utilities-ev`), swapped 5 `console.error`→`logError`, added `chainLog`. Return shapes byte-for-byte unchanged; logic/template untouched; CONSTRAINT-015 audit = PASS (template already has actionable fallbacks). +8 tests incl. Jeffersonville IN. See `feature-requests/FR-076-runtime-degradation-coverage/`.
- **NEXT UP:** ~~(a) fan-out FR-076 to the remaining 6 modules~~ — **DONE (FR-077);** the fan-out was an audit, not a routing job (none had the bug). Remaining: **(b) Hardening Stage 1** (the B2B gate, below) if a real B2B timeline materializes — stays gated on demand. Parked lower-priority items (provenance UI pass, cell-cache FR-065 modeled-normals) still available as solo upside.

### ▶ Session hand-off — 2026-06-18 (session 4 — **FR-075 Cost Circuit-Breaker shipped**)
*This session shipped **FR-075** and corrected a stale-context error in the session-3 hand-off below.*
- **State:** `main` clean @ `b5051a2` (FR-075, PR #45, squash-merged), **1,649 tests / 87 suites** green, CI green on Node 20.x + 22.x. No open PRs.
- **Shipped — FR-075 Cost Circuit-Breaker (PR #45):** the FR-064-deferred spend cap. Per-SKU rolling-24h **call budget** enforced at the single billed chokepoint (`makeGoogleMapsRequest`): new `src/costBreaker.js` (`check` before billing / `record` on success only; cache hits bypass), caps derived from Google's per-SKU **monthly free tier** ÷30×0.6 (geocoding/distancematrix 200/day, places_nearby/places_text 100/day — env-tunable via `COST_BREAKER_*`), `BudgetExceededError` → existing graceful "at capacity" page, admin **force-trip/reset kill-switch** + Cost Breaker panel on `/admin/health` (under the FR-064 guard). Live-verified at $0 via the force-trip path (trip → capacity page → zero billed calls logged → reset → panel). Full live *render* blocked by the IP-restricted Google key (403 from dev machine — pre-existing, handled gracefully). Built via subagent-driven development (6 TDD tasks + reviews). See `feature-requests/FR-075-cost-circuit-breaker/`.
- **⚠️ Correction to the session-3 hand-off (below):** it listed **Stage 0 cheap wins** as "NEXT UP" and claimed `/admin/*` routes were "currently unauthenticated — `app.js:98-107`." **That was stale/false.** Stage 0 already shipped as **FR-064 (PR #27)** — admin auth (`requireAdmin` on `app.use('/admin', …)`), `helmet`, `express-rate-limit`, startup config validation, and CI are all live on `main`. The unauthenticated-admin hole was closed there. Don't re-do Stage 0.
- **NEXT UP — Hardening Stage 1 (the B2B gate):** externalize the in-memory/local-disk state (`.cache/`, `data/reports.json`, in-memory `usageLog` — now incl. the FR-075 budget counters) behind the existing `Cache` seam → managed Redis + small Postgres. This is the real single-instance ceiling; it also upgrades FR-075 from per-process to cluster-correct and enables exact calendar-month per-SKU budgets. Gate it on a real B2B timeline (speculative without demand). Parked lower-priority: provenance UI pass (surface ACS vintage + SoilWeb/OSM labels in disclaimers), broader `try/catch → null` swallow-site sweep, cell-cache the FR-065 modeled-normals result.

### ▶ Session hand-off — 2026-06-17 (session 3 — **Track A1 COMPLETE**) *(superseded by session 4 above; Stage-0 "NEXT UP" here is stale — see correction)*
*Next session starts here: Track A1 (resilience) is done (8 slices, FR-065→FR-074, all merged). No A1 work remains. The queue is now the **Hardening Track (NR-004)** — see NEXT UP below. Decision gate carried forward: if the B2B timeline goes near-term, Hardening **Stage 1 (state externalization)** jumps ahead of the Stage 0 cheap wins.*
- **State:** `main` clean @ `8e829bc`, **1,627 tests / 84 suites** green, CI on every push, working tree clean. No open PRs awaiting action.
- **Shipped (this track):** FR-065 (PR #30 — reusable `sourceChain` primitive + NOAA→Open-Meteo climate-normals fallback; honest-provenance principle), FR-066 (PR #32 — Google-POI→OSM fallback for Reachability + shared `overpass.js`/`osmPlaces.js`; latent Overpass-406 fix), FR-067 (PR #35 — Walkability Google→OSM fallback; opt-in `searchOSMPOIs({withTags})` + `categorizeOSMWalkPOI`; observability fix for the swallow-to-empty outage mask).
- **Shipped (sessions 2–3, 2026-06-17):**
  - **FR-068 (PR #37 — degradation observability)** — the resilience track was adding silent-degradation sites faster than visibility. Instrumented the **`sourceChain` chokepoint** (where all fallbacks flow) with a request-scoped **`AsyncLocalStorage` ledger** (`src/shared/degradationLedger.js`): every fallback/miss/error/exhausted is recorded per report, concurrency-safe, crash-safe (no-ops without context → verify harness/tests untouched). `buildReport` emits one `type:'degradation'` log line per affected report; `/admin/health` gains a 7-day label×kind degradation panel. Right-sized for Tier-2: stdlib + existing logger + admin page — **NOT** Sentry/OTel/dashboards (gated on B2B). Every future A1 slice is now observable for free.
  - **FR-069 (PR #38 — Recreation Google→OSM fallback)** — park/coffee/library/rec center/post office now Google→OSM→link-floor (FR-066 single-nearest pattern). Fixed a latent renderer bug: `buildAdditionalServicesCardHTML` printed `driveTimeMinutes` raw (would render "null minutes" for OSM records) — now straight-line-aware via the existing helpers. **Pattern decision settled:** Recreation is the single-nearest pattern, NOT walkability's union-categorize one, so no shared categorize helper is warranted (the hypothetical second caller never materialized).
  - **FR-070 (PR #40 — Sensory airport Google→OSM fallback)** — airport finding now Google→OSM (`aeroway=aerodrome`)→no-result, via `sourceChain`. **Cleanest A1 slice:** airports were *already* straight-line (haversine) on the Google path (no Distance Matrix), so the OSM fallback is a drop-in on the same distance basis + record contract — no narrative rewrite, only two source-label strings (`airportSourceLabel()` flips to "OpenStreetMap" on `source:'osm'`). **Key design:** `null` is a *valid* Google answer (no airports in range — common rural), so the chain's Google `isValid` accepts null-or-array; a legit-empty result short-circuits with **no Overpass call and no false degradation event** — only a thrown Places error falls through to OSM. Live OSM check sane on all 5 addresses (Jeffersonville returns an IN-side field). New `OSM_AIRPORT_FILTERS` excludes private aerodromes, keeps military.
  - **FR-071 (PR #41 — Growth commercial Google→OSM fallback)** — commercial-activity finding ("Commercial Landscape Within 1.5 Miles") now Google→OSM via `sourceChain`. The **FR-067 walkability shape** (multi-type Google union → one Overpass union → categorize-by-tags via new `categorizeOSMCommercialPOI`), **minus** the scoring (CONSTRAINT-001 — it's a list) **and minus** the narrative rewrite (Google path was already straight-line miles → drop-in; only the source label flips via `commercialSourceLabel()`). OSM path mirrors Google's top-2-per-type → top-6 variety, name-deduped. **Carried the FR-067 observability fix:** the Google impl now returns `null` on total outage instead of swallowing to `[]` (which had shown green in the source monitor during an outage, indistinguishable from a genuinely empty area) → monitor red + chain reaches OSM; a real empty area still returns `[]`. New `OSM_COMMERCIAL_FILTERS` (gym unioned across OSM's 3 inconsistent tags). Live OSM check sane on all 5 (Jeffersonville IN-side).
  - **FR-072 (PR #42 — USDA soil resilience, first *non-Google single*)** — the lone USDA SDA soil fetch (silent single point of failure) → hardened + observable + honest floor. **Shape settled by a SoilWeb spike** (in discovery): no public independent SSURGO JSON API exists (SoilWeb 404/403; SDA Spatial shares the host; SoilGrids is modeled/rate-limited) — so per the "primary→fallback *or* actionable floor" framing, this is hardened-SDA + floor, **not** a fabricated second source. `getSoilDataSDA` distinguishes *empty* (unmapped point → `null`, valid, short-circuits) from *failed* (throws → one retry on transient 5xx/timeout → recorded in the **FR-068 ledger**); public `getSoilData` wraps it in `sourceChain` (`property-soil`). `soil` contract stays object-or-null → Property + Garden floors untouched. Floor now links the **exact coordinates** in UC-Davis SoilWeb (`/gmap/?loc=lat,lng`). Kills the verbatim NR-004 silent-swallow debt. Live SDA sane on all 5; floor link HTTP 200.
  - **FR-073 (PR #43 — USGS elevation resilience, 2nd non-Google single)** — the two independent USGS EPQS fetches (Climate topographic position + Garden microclimate) → one shared resilient helper **`src/shared/elevation.js`**. **Unlike soil, a real like-for-like fallback exists** (live-spiked): OpenTopoData `ned10m` serves the same USGS NED 10 m DEM from an independent host (Bozeman 1472.57 m→4831 ft vs EPQS 4829 ft). So: **EPQS → OpenTopoData (one batched call, m→ft, fired only on EPQS center-miss) → honest absence**, via `sourceChain` (`label 'elevation'`). De-dups both consumers, fixes both observability gaps (climate was `logError`-only, garden *fully silent*) → FR-068 ledger. `getWatershedContext` fill-with-center + `classifyTopographicPosition` and `getMicroclimateData` shape unchanged. **Latent bugfix:** unified no-data guard (`null`/`<=-1000`→null) hardens Climate against a −9999 corrupting topo classification. `fetchElevationWithRetry` relocated + re-exported (chapters.js untouched). Floor = honest absence (no buyer action for missing ground elevation). Live EPQS sane on all 5.
  - **FR-074 (PR #44 — Census ACS vintage resilience, 3rd non-Google single — A1 FINALE)** — hardens the app's **most widely-shared external source** (`src/shared/census.js`, 6 modules + rural-mode cascade) + fixes a concrete staleness bug. `fetchCensusACS` was pinned to a hard-coded **`2022`** vintage; now tries `CENSUS_ACS_VINTAGES=[2024,2023,2022]` newest-first via `sourceChain` (`census-acs`). **Live-verified: all 5 addresses now resolve to vintage 2024** (was ~2 years stale). `fetchAcsVintage` distinguishes **404** (vintage absent → `knownAbsentVintages`, skip next call) from **5xx/timeout** (transient → fall to next-newest this call, retry newest next call → self-heals), so a blip never sticks the process staler. `getCensusFIPS` gets a transient retry + `sourceChain` (`census-fips`) — the upstream cascade is no longer silent. Both now in the FR-068 ledger. No keyless fallback (Census requires a key). Contract preserved (`{get,headers,values}` + additive `vintage`); 6 consumers + `census.test.js` untouched. Vintage-in-disclaimers deferred (UI pass).
- **✅ TRACK A1 COMPLETE (8 slices).** Cost-resilience / single-point-of-failure hardening is done across both shapes — Google-Places-backed → OSM (FR-066/067/069/070/071) and non-Google singles (FR-072 soil · FR-073 elevation · FR-074 Census) — all retry/fallback + `sourceChain`-observable (FR-065/068) with honest floors.
- **NEXT UP (no A1 blockers left): the Hardening Track (NR-004).** ~~Two entry points~~ — *(CORRECTED in session 4: this was stale.)* **(a) Stage 0 cheap wins — ✅ ALREADY SHIPPED as FR-064 (PR #27):** admin auth (`requireAdmin` on `app.use('/admin', …)` — the `/admin/*` mutation routes are **not** unauthenticated; that earlier claim was false), `helmet` + `express-rate-limit`, startup config validation, CI. The FR-064-deferred spend cap then shipped as **FR-075 (PR #45)**. **(b) Stage 1 — externalize state** (the B2B gate): swap local-disk/in-memory state (`.cache/`, `data/reports.json`, `usageLog`) behind the existing `Cache` seam to managed Redis + Postgres — **the remaining queue.** Also available: the broader `try/catch → null` swallow-site sweep (FR-068 instrumented the chokepoint; module-level sweep remains), and cell-caching the FR-065 modeled-normals result. See **Hardening Track** + **Track B breadth backlog** below.
- **Watch-items:** observability debt — FR-068 instrumented the sourceChain chokepoint, but a broader sweep of every `try/catch → null` swallow site across modules remains (FR-067's walkability fix is the template); single-instance state ceiling (Hardening Stage 1, the B2B gate); carryover — cell-cache the FR-065 modeled-normals result (Open-Meteo per-minute rate limit).
- **Deferred (human-in-loop):** B1 FR-062 (FCC BDC token), B2 NREL per-address rate (deploy-time verify). State externalization (Hardening Stage 1) deferred until B2B timeline is real — it's the bigger lift and speculative without demand; **if B2B goes near-term it jumps ahead of the remaining A1 slices.**
- **Reminders:** test-first, all 5 addresses; **doc PRs stay open for Nathan's review**; Overpass needs the UA header (in place) and rate-limits rapid calls (space live checks); prefer keyless live verification.

- **Active branch:** `FR-032-utilities-intelligence` — Utilities & Power chapter built (PR pending).
- **FR-032 (Utilities & Power): ✅ BUILT on branch** — new chapter (electric provider + rate-vs-state, state-level reliability, well/septic-vs-municipal inference, EV charging), cell-cached (FR-058 parity), placed after Costs. Full suite green (1,289 / 68). ⏳ **Populated live-data acceptance (Georgetown→Kentucky Utilities, Bozeman→NorthWestern Energy) deferred** — NREL was unreachable from the build sandbox; verify where NREL resolves. See `feature-requests/FR-032-utilities-intelligence/`.
- **Most recent (main):** FR-079 (Community contract — rollout #1 of the headless contract; Fair-Housing-sensitive chapter, every finding tone-neutral, income national-median-only) — **merged (PR #49, squash).** Full suite 1,696 / 90. 2 of 14 chapters now on the contract. See the session-5 hand-off above + `feature-requests/FR-079-community-contract/`. *(Prior: FR-078 #48; FR-077 #47; FR-076 #46.)*
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
1. **Extend the FR-060 resilience pattern** (primary → fallback → graceful link) beyond Utilities to other single-source modules — each lone API (NOAA climate, USDA soil, Google in health/reachability, etc.) is a single point of failure today. *Highest structural value.* — ✅ **DONE (Track A1 complete — 8 slices, FR-065→FR-074). First slice shipped as FR-065 (PR #30):** the pattern is now a **reusable `src/shared/sourceChain.js` primitive** (ordered sources → first-valid wins → provenance tag → miss/error logged), proven on the climate-normals path (NOAA station normals → Open-Meteo ERA5 modeled climatology → link floor). Also codified the **honest-provenance** product principle (surface the best regional signal *with* a plain-language callout; never manufacture precision). **Remaining A1 slices** (each its own FR, reusing the primitive): USDA soil, USGS elevation, Census vintage. **Second slice shipped as FR-066 (PR #32):** the **Google-POI cost-resilience fallback** — Reachability grocery/pharmacy/gas now fall back to OSM (keyless, honest straight-line distances) when Google quota/spend trips, via reusable `shared/overpass.js` + `shared/osmPlaces.js`; safety tier (Health/Schools) untouched. **Bonus fix:** Overpass returns HTTP 406 to Node's default `fetch` User-Agent — a pre-existing latent bug that was silently degrading Sensory's OSM features (road noise/rail/land use) too; fixed in `shared/overpass.js`. **Third slice shipped as FR-067 (PR #35):** the same Google→OSM fallback for **Walkability** — one Overpass *union* call via a new opt-in `searchOSMPOIs({withTags})` + client-side `categorizeOSMWalkPOI` (tag→walk-category), same weight rule as the Google proxy, short-TTL `placesOsmCache`. **Bonus observability fix:** the Google walkability fetcher previously swallowed *total* failure to `score:0` — indistinguishable from a rural walk-desert and showing green in the source monitor during an outage; now it returns `null` on all-rejected (→ chain reaches OSM, → monitor sees red) while a genuine empty area still scores 0. **Fourth slice shipped as FR-069 (PR #38):** the same Google→OSM fallback for **Recreation** (park/coffee/library/rec center/post office) — the single-nearest reachability pattern; fixed a latent renderer bug that would have printed "null minutes" for OSM records. **Observability milestone — FR-068 (PR #37):** instrumented the `sourceChain` chokepoint with a request-scoped `AsyncLocalStorage` degradation ledger so every fallback is recorded per report + surfaced in a `/admin/health` panel — every A1 slice is now observable for free. **Fifth slice shipped as FR-070 (PR #40):** the same Google→OSM fallback for **Sensory airports** (`aeroway=aerodrome`) — the cleanest slice yet, because airports were already straight-line (haversine) on the Google path, so the OSM fallback is a drop-in on the same distance basis with no narrative rewrite; settled the **`null`-is-valid** chain nuance (a legit no-airports result must short-circuit, not fall through to a needless Overpass call + false degradation event). **Sixth slice shipped as FR-071 (PR #41):** the same Google→OSM fallback for **Growth commercial activity** — the FR-067 walkability union+categorize shape (`categorizeOSMCommercialPOI`), minus the scoring (it's a list) and minus the narrative rewrite (already straight-line); carried the FR-067 **swallow-to-empty observability fix** (Google impl returns `null` on total outage instead of `[]`, so the monitor no longer shows green during an outage). This closes the **Google-Places-backed** A1 surface (Reachability, Walkability, Recreation, Sensory airports, Growth commercial all now fall back to OSM). **Seventh slice shipped as FR-072 (PR #42) — first *non-Google single*:** USDA soil (lone USDA SDA fetch, no Google primary). A discovery **spike** confirmed no public independent SSURGO JSON API exists, so the shape is **hardened-primary + observability + honest actionable floor**, not a fabricated fallback: `getSoilDataSDA` distinguishes *empty* (unmapped → `null`, valid) from *failed* (throws → one transient retry → recorded in the FR-068 ledger via a `sourceChain` wrap), and the floor links the exact coordinates in UC-Davis SoilWeb. Pays down the verbatim NR-004 silent-swallow debt. **This establishes the non-Google-single pattern** the remaining slices reuse. **Eighth slice shipped as FR-073 (PR #43) — 2nd non-Google single:** USGS elevation (two consumers — Climate topo position + Garden microclimate — on the flaky EPQS endpoint). Here a discovery spike found a **real independent like-for-like fallback** (OpenTopoData `ned10m`, same USGS NED DEM, different host), so the shape is a true **EPQS → OpenTopoData → absence** chain in a new shared **`src/shared/elevation.js`** helper (batch-aware, `sourceChain`-observable). De-dups both consumers + closes both observability gaps (climate `logError`-only, garden silent) + a latent −9999 topo bugfix. **Final slice — FR-074 (PR #44):** Census ACS vintage resilience — the most-shared source (`src/shared/census.js`, 6 modules + rural-mode cascade). Newest-first ACS5 **vintage** fallback (`[2024,2023,2022]`) via `sourceChain` — fixes a concrete staleness bug (was pinned to 2022; live-verified now resolving 2024) and is resilient to a retired vintage; distinguishes permanent-absent (404) from transient (5xx, self-heals). `getCensusFIPS` retry + observability. **✅ This completes Track A1 — 8 slices, both shapes (Google→OSM + non-Google singles), all retry/fallback + ledger-observable with honest floors.** See `feature-requests/FR-065-…/` through `FR-074-…/`. — ✅ **DONE.**
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
