# DR-001: Foundation and Architecture — From Monolith to Bounded Modules

**Date:** 2026-05-31
**FRs covered:** Full project arc through FR-043 (this is the first DR; no prior baseline)
**PRs:** #5 (garden deep dive), #6 (climate depth), #7 + #8 (depth slider), #9 (module extraction)
**Status:** Foundation Work

---

## TL;DR

Livably is a Node.js/Express server that generates a single SSR (server-side-rendered) HTML report for a US home address — no frontend framework, vanilla HTML/CSS/JS. The last ~6 weeks were almost entirely a structural campaign: a two-file monolith (`app.js` + `premium.js`, ~1,100 lines each) was decomposed into 13 domain modules, a shared coherence layer, and an extracted template layer, all backed by an 837-test suite. The architecture is genuinely solid for its stage, with one honest caveat: the "three-layer rule" the project documents (data/logic/template per module) is not how the code is physically organized — logic and templates are centralized, not co-located, and that gap between the stated rule and the real structure is the most important thing to understand here.

## What Was Built

This is the first DR, so this covers the project arc rather than a single window. Framed as structure, not features:

- **Monolith decomposition (PR #9, the headline).** The two god-files were split into 13 bounded `src/modules/<domain>/` folders (climate, community, garden, health, schools, etc.), each owning the API-fetching layer for one report chapter. What remains in the old orchestrator (`chapters.js`) is now ~180 lines: a parallel-fetch coordinator plus one straggler function (`getSchoolRatings`, a multi-level school search distinct from the single-nearest-school module). The proof point: a 2,200-line monolith reduced to a thin orchestrator over isolated domains, with zero test regressions through the entire migration.

- **Shared coherence layer (FR-035).** `src/shared/validate.js` was created as the single home for cross-module rules — rural/urban classification, cross-state result filtering, and drive-time sanity checks. This is a deliberate Domain-Driven-Design-style choice: rather than each module re-implementing "is this result in the wrong state," coherence lives in one shared kernel that every module calls. Three real production bugs (a hospital that wasn't the nearest, a school returned from the wrong state, a grocery store 45 min away) are what motivated this layer's existence.

- **Template extraction (FR-038, FR-039, FR-041).** HTML generation was pulled out of the business code in stages: first six reusable component functions (badges, buckets, cards), then 14 per-chapter template files, then the Express entry point itself. `app.js` went from 1,128 lines to 167 — now a pure routing/config shell with zero HTML, zero API calls, zero business logic. This is the cleanest part of the codebase.

- **Test suite as a constraint-enforcement mechanism (FR-040).** The suite (837 tests, 57 suites, ~12s) is not just behavior coverage — several tests are *static-analysis guards* that scan source files to enforce architectural rules: no inline styles in templates, no API calls in template files, no scoring UI anywhere. The codebase polices its own structure on every test run. This is a sophisticated move for a project this young.

- **Depth-slider rendering system (FR-045, PRs #7/#8).** A four-level progressive-disclosure system (Glance / Overview / Deep Read / Research) was wired across all 14 chapters — the report can render the same data at four densities. Architecturally significant because it proved the template layer can carry presentation state without leaking back into data or logic. Climate (FR-043) and Garden (FR-042) are the two chapters built out to full depth, validating the pattern on content-heavy chapters before rolling it wider.

## Architectural Health

| Area | Status | Notes |
|------|--------|-------|
| Module coverage | ● Done | 13 domain modules extracted from the monolith; 14 chapter templates exist. The old orchestrator is down to ~180 lines. |
| Three-layer rule (data/logic/template) | ● Partial | **Each module folder contains only `data.js`.** Logic is centralized in `shared/validate.js`; templates in `src/templates/chapters/`. The documented per-module data/logic/template/index pattern is the *target*, not the current reality — this is intentional, but the docs and the code disagree. See commentary. |
| Test suite | ● Done | 837 tests / 57 suites / ~12s. Covers all 16 constraints, the shared logic layer, and a border-city regression suite. Includes self-policing static-analysis tests. |
| Shared validation layer | ● Done | `validate.js` is the single cross-module coherence kernel: rural-mode, cross-state, drive-time coherence. Clean and well-tested. |
| Known technical debt | ● Amber | Three named, deferred items (not silent): a business-rule/HTML mix in `reportPage.js` (`buildHeroInsightRowsHTML`), inline styles in the admin dashboard, and a rural-mode input not yet wired (grocery defaults to "suburban"). All documented in FR summaries. |
| Constraint count | ● Active | 16 numbered engineering constraints in CLAUDE.md; this is the baseline (no prior DR to diff against). |

The genuinely solid parts: the API-fetching layer is cleanly isolated per domain, the Express shell is pristine, and the test suite enforces structure mechanically rather than by convention. The honest weakness: the three-layer rule as *written* in the project's own docs ("`src/modules/` — one folder per chapter… data.js / logic.js / template.js") does not match the filesystem — there are no `logic.js` or `template.js` files inside the module folders. The team chose centralization (one coherence layer, one template directory) over strict co-location, which is a defensible call for cross-cutting rules like Fair Housing and cross-state filtering — but the documentation still describes the aspirational structure, and a new engineer reading CLAUDE.md would expect files that aren't there.

**Recent PMs:** PM-001 (school returned from a neighboring state → cross-state filtering rule), PM-002 (highway search returned a boat ramp → geocoding-only strategy), PM-003 (hospital wasn't the nearest by drive time → drive-time verification), PM-004 (NOAA weather station passed metadata filter but had no actual records → validate fetched content, don't trust station metadata).

## How the Build Is Being Directed

Worth setting context for Denny: the project owner (Nathan) is non-technical and directs an AI coding agent (Claude Code) with product intent and constraints rather than writing code. So this section is really an assessment of the human-AI loop, not just one engineer's output.

**Direction quality — strong on sequencing.** The standout signal is that foundation was prioritized over feature velocity. The entire module extraction, shared-logic layer, and template extraction were completed *before* new chapters were built out — and the test suite was expanded to lock the structure in before the next feature wave (the FR-046 community deep-dive) began. For a non-technical owner directing an AI, choosing "pay down structure first" over "ship more chapters" is the correct instinct and not the obvious one. The four-phase workflow encoded in CLAUDE.md (Discovery → Spec → Plan → Implement, with no code changes in the first three phases) is also an explicit guardrail against the failure mode of AI agents: confidently shipping unspecified, untested work.

**Where the AI's interpretation has been on target.** The migration discipline is real — 837 tests with zero regressions across a multi-PR monolith decomposition is hard to fake, and the static-analysis constraint tests show the agent internalized "enforce structure mechanically, not by hope." The decision to make `validate.js` fail *open* on cross-state checks (pass a result through if the verification API errors, rather than block a legitimate in-state result) is a mature trade-off call.

**Where it drifted or needed correction — specifics, no hedging.** Three honest items. (1) Business logic crept into the template layer: `buildHeroInsightRowsHTML` in `reportPage.js` still contains drive-time thresholds and radon-zone rules — a direct violation of the "no business rules in templates" constraint, caught and explicitly deferred rather than fixed. (2) The rural-mode classifier was built but never connected to its data input; grocery searches silently default to "suburban," meaning a constraint that exists in code is inert in practice. (3) Most importantly, the documentation drift above: the agent built a *centralized* logic/template structure while CLAUDE.md continued to describe a *per-module* one, and nobody reconciled the two. None of these are alarming individually — but together they're the signature of an AI-driven build: the code is more correct than the docs, and deferred debt is well-labeled but accumulating.

## Open Architectural Questions

**Centralized coherence vs. per-module ownership — which wins at scale?**
The project deliberately put all cross-module rules in one `validate.js` and all templates in one directory, rather than giving each module its own logic and template files. At 13 modules this is clean. The question is whether `validate.js` becomes a god-object as modules and rules multiply — the same pull that created the original monolith, just relocated. The Fair Housing rule already lives *outside* validate.js (in the community module) because it's single-module, which hints the boundary isn't fully settled. Denny's DDD background is directly relevant here: is the shared kernel the right pattern, or is per-context logic the safer long-term call?

**Should the documented architecture be corrected down to reality, or the code brought up to the docs?**
CLAUDE.md describes a four-file-per-module pattern that doesn't exist on disk. There are two honest fixes: rewrite the docs to describe the centralized structure that was actually built, or refactor toward the per-module structure the docs promise. The project is implicitly choosing "neither, for now" — which is fine short-term but means the single source of truth for a new contributor (human or AI) is wrong about the codebase.

**Is an SSR-string-concatenation report the right substrate for a four-depth, multi-chapter product?**
The whole report is HTML strings assembled server-side, no framework, no client-side component model. The depth-slider system (four render densities × 14 chapters) is already pushing on this — it's a lot of conditional HTML assembly. This has been the right call for speed and simplicity so far, but it's the architectural fork most likely to bite later: at some point the presentation complexity may want a real component/templating engine, and migrating string-concat SSR is expensive once chapters are deep.

## What's Coming

- **FR-046: Community & Demographics deep-dive (L3/L4)** — Extends the depth-slider pattern to a fourth chapter (after climate and garden). Architecturally it's a stress test of the Fair Housing constraint: it adds Census income-distribution, education, household-composition, and commute data, all of which must be rendered as distribution-vs-national-average *only*, never as area characterizations. The Fair Housing rule lives in the community module's own logic (not the shared layer), so this FR is the test of whether single-module logic can stay clean as that module's data surface triples.
- **Rural-mode activation** — The dormant classifier (built in FR-035, never wired) needs its Census-population input hoisted into the main fetch so the drive-time coherence constraint actually fires. Small change, but it flips an inert constraint to live.
