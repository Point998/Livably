# DR-003: Livably Goes Headless

**Date:** 2026-06-25
**FRs covered:** FR-078–FR-095 (headless contract rollout), FR-082/083 (cross-state fixes), FR-096/097/098 (report-store hardening + seam), plus a docs/governance realignment
**PRs:** #48–#72
**Status:** Architecture Shift

---

## TL;DR

DR-002 ended on three open questions; this window answered the biggest one. The whole report has been pulled apart into a **headless contract** — a versioned, presentation-free JSON view-model (Zod-validated) that is now the durable product, with the server-rendered HTML demoted to "one renderer of it." That rollout is 100% complete across all 16 modules. In parallel, the persistence layer — the single-instance ceiling DR-002 flagged as the gating fork — got its seam built: the report store is now hardened (atomic per-file writes, the read-modify-write race gone) and genuinely swappable (a `ReportStore` interface + a backend-agnostic test suite), with the real external backend deliberately *not* built until a host is chosen. The test suite went 1,470 → 1,929 with, once again, **zero new constraints** — because the contract made several existing rules structural (a stray `score`/`color` field now throws at parse, not at review).

## What Was Built

- **The backend went headless (FR-078 → FR-095, the headline).** Every chapter now emits a validated **contract** — `{ finding: { bucket, tone, claim{subject,measure,comparison}, provenance{source, asOf, modeled}, fallbackAction? } }` — built by a per-module `contract.js` that consumes the existing logic output. The single source of truth is a **Zod schema with `.strict()` on every object**, which means CONSTRAINT-001 (no scores), -002 (no demographics), and -008 (no design values in data) are now enforced at *parse time* rather than by code review — a malformed finding throws before it can ship. A crash-safe `safeBuild()` wrapper validates each chapter and degrades to `null` + a logged degradation on failure, so one bad chapter never takes down a report. `GET /api/report.json` serves the whole thing. This is the structural answer to DR-002's open question "is server-side string-concatenation still the right substrate?" — the project chose to stop coupling to it and make presentation a separately-built concern.

- **The contract is the anti-drift spine for two codebases.** The reason to pay the Zod tax now (rather than after a frontend exists) is that the schema becomes the enforced boundary between the backend and a future separately-built frontend: runtime validation + JSON-schema types exported for the frontend, backed by per-address snapshot tests including the Jeffersonville IN border-city regression. `schemaVersion` stayed at `1.0` through all 16 rollouts — the shape held.

- **The persistence seam — the deferred "moving day," made decision-independent (FR-096/097/098).** This is direct progress on DR-002's gating fork. The report store was rewritten from a single shared `reports.json` map (the NR-004 read-modify-write race) to **one atomic file per report**, then abstracted behind a documented `ReportStore` interface with a **backend-agnostic contract test suite** — an in-memory implementation passes that suite *identically* to the file one, with zero behavioral divergence. A `createReportStore(env)` selector picks the backend. The deliberate move: the seam, the suite, and the selector were built **without building a real external backend** — when a host is picked, a Postgres/object-store implementation just has to pass the existing suite and register as one `case`. They resisted building speculative infrastructure that would bias the host decision.

- **The contract rollout doubled as a cross-state audit (PM-005, PM-006).** Migrating each chapter surfaced two latent instances of an existing bug class — the school-chapter path (PM-005) and pharmacy (PM-006) weren't running results through the shared cross-state filter (CONSTRAINT-006, the rule born from the original Jeffersonville IN / Louisville KY school bug). Both fixed via the existing coherence layer. The migration acted as a forcing function that flushed out drift the original builds had left.

- **A documentation realignment to match the new reality (this session).** With the architecture changed, the repo's own docs had drifted — the README still described a "prototype," the design brief sat at the root as if it were current build guidance. This session realigned them: design concerns relocated and explicitly scoped to the (separate, future) frontend phase; a **doc-governance rule** added that splits docs into a tiny *canonical* set (3 files, kept current) versus *reference* docs (append-only, frozen when written) — the mechanism that keeps the source-of-truth small as the project grows. Project principles that lived only in informal memory ("honest provenance" — say so when data is modeled vs measured) were codified into the constraints doc.

## Architectural Health

| Area | Status | Notes |
|------|--------|-------|
| Module coverage | ● Done | 16 bounded modules, each now with a 4th co-located file (`contract.js`) alongside data/logic/template. |
| Headless contract | ● Done | 100% of the report on the Zod contract (all 16 modules); `schemaVersion` 1.0 unbroken through every rollout. |
| Three-layer rule | ● Done | Held under the rollout. SSR templates left byte-unchanged on each of 16 migrations (additive); where the contract needed a pure rule it went to `logic.js`, never the template. |
| Test suite | ● Done | **1,929 tests / 105 suites** (was 1,470 / 77 at DR-002). +459, zero new constraints. |
| State externalization | ● In Progress | Report-store seam hardened + swappable (NR-004 Stage 1, decision-independent half). Caches + usage log still single-instance; real external backend host-gated. |
| Known technical debt | ● Amber | `defaultCopy` (prose in the contract) is transitional scaffolding pending the frontend owning voice; CSP `unsafe-inline` persists (SSR templates inline scripts); in-memory store intentionally non-durable; logger/errorMemory still read-modify-write. |
| Constraint count | ● Active | 16 constraints; **+0 since DR-002.** Several (001/002/008) are now *structurally* enforced by Zod `.strict()` rather than by review. |

The genuinely solid story: a major architectural shift (headless) was executed as ~16 additive, surgical, individually-tested migrations that never broke the schema or the HTML path, and the test suite grew by a third with no new rules — the same healthy signal as last window (structure absorbing complexity, not rules multiplying). The honest weakness is unchanged from DR-002 but now *partially* de-risked: state still lives on a single instance, but the report-store half of that problem has a real, tested seam, so it's now a contained swap rather than a rewrite — gated on a human decision (host selection) rather than on engineering.

**Recent PMs:** PM-005 (school-chapter path skipped the cross-state filter) and PM-006 (pharmacy same) — both the CONSTRAINT-006 cross-state class, surfaced by the contract migration and fixed via the shared coherence layer.

## How the Build Is Being Directed

Context for Denny: the owner (Nathan) is non-technical and directs an AI coding agent with product intent and constraints rather than writing code — so this assesses the human-AI loop.

**The directional pattern that matters most this window: disciplined refusal to build ahead of a decision.** The external storage backend has been deferred for three consecutive windows now, and this time the restraint was active rather than passive — instead of building a speculative Postgres backend, the work was deliberately split so the *decision-independent* half (the swappable seam + a backend-agnostic test suite that a future backend must pass) got built, and the host-dependent half was explicitly left for when Nathan picks a deploy target. That is exactly the capital-allocation instinct DR-002 praised as correct, now executed with precision. The same instinct showed up in this session: the frontend is decided as a monorepo workspace built later via an AI design tool against the contract — but no frontend code was written, only the contract and the repo set up to feed it.

**Where the AI's interpretation was on target.** The rollout's surgical restraint is the standout — 16 chapters migrated to the contract with the production HTML templates left byte-for-byte unchanged each time, so a large architectural change carried near-zero regression risk to the working product. The choice to make the contract enforce constraints *structurally* (Zod `.strict()` throwing on a stray `score`/`color`) rather than adding more review-time rules is the kind of move that makes the rule count flat while the guarantees get stronger.

**Where it drifted or needed correction — no hedging.** Three honest items. (1) The contract carries `defaultCopy` — actual prose — as transitional scaffolding; it's clearly labeled and tested as such, but until the frontend owns voice it's a second source of copy truth that must be deleted on schedule or it becomes permanent debt. (2) The two cross-state PMs (005/006) are a reminder that an existing, well-understood rule (CONSTRAINT-006) had not been applied uniformly when those chapters were first built — the contract migration is what exposed the gap, which is good, but the gap existed. (3) This session's doc realignment was itself a correction of drift: the project's own README and root docs had fallen behind the architecture by enough that a cold reader would have been misled — caught and fixed, and a governance rule added to stop it recurring.

## Open Architectural Questions

**The substrate question is answered — but it created a frontend-build fork worth a second opinion.**
The headless split is decided and complete; the report is now a contract, and the plan is to build the frontend as a separate workspace generated via an AI design tool (Claude Design) importing the repo and rendering against the contract. The open question for Denny: is "generate a production frontend from an AI design tool against a typed contract" a durable delivery path, or a fast prototyping accelerant that will need a hand-owned rewrite before real users — and relatedly, when exactly does the `defaultCopy` prose migrate out of the backend so voice has a single owner?

**State externalization: the seam is real now — does that genuinely de-risk the deferral, or relocate the risk to host selection?**
The report-store is swappable and contract-tested, which turns "moving day" into a contained swap for *that* component. But caches and the usage log are still single-instance, and the bet is that the marked seams hold. The question DR-002 raised stands, now sharper: with the engineering de-risked, the critical path is the human decision (single managed box vs. load-balanced; Postgres-blob vs. object storage) — is host selection now the actual bottleneck to B2B-readiness, and are there single-instance assumptions still lurking outside the one seam that's been built?

**Is Zod-contract-plus-snapshots enough discipline for a two-codebase boundary, without full TypeScript?**
The anti-drift strategy is deliberately "runtime validation + generated JSON-schema types" rather than adopting TypeScript end-to-end. That has kept the schema honest across 16 chapters in one codebase. The fork ahead: once a separately-built frontend is consuming the contract, does runtime-validation-at-the-boundary plus exported types hold the line, or does the backend↔frontend seam eventually force TypeScript across both (already flagged as a later hardening stage)?

## What's Coming

- **The external backend / "moving day"** — host-gated, awaiting Nathan's deploy-target decision. Implement a real `ReportStore` that passes the existing contract suite and register it in the selector. This is NR-004 Hardening Stage 1 proper (the multi-instance / B2B gate) and the largest structural change on the horizon — the one most worth a second enterprise opinion before it starts.
- **The frontend, first consumer of the contract** — a monorepo `web/` workspace, built via the AI-design-tool import path, generating its types from the contract. Architecturally significant because it's the first time the contract is exercised by a real second consumer, which is the true test of whether the headless boundary holds.
- **Carried small items** — atomic-write the logger/errorMemory stores (the same read-modify-write smell the report store just shed); delete `defaultCopy` once the frontend owns voice.
