# DR-002: Structure Realized — and the Pivot to Production Hardening

**Date:** 2026-06-16
**FRs covered:** FR-046, FR-047, FR-048, FR-049–FR-057, FR-058, FR-059, FR-060, FR-061, FR-062, FR-063, FR-064 (+ architecture reviews NR-002/003/004)
**PRs:** #16–#28
**Status:** Active Build

---

## TL;DR

The single most important thing in DR-001 was an honest gap: the project *documented* a three-layer-per-module architecture (data / logic / template) that did not actually exist on disk — logic and templates were centralized. That gap is now closed. A dedicated refactor (FR-048) gave every one of the 16 modules its own co-located `data.js` / `logic.js` / `template.js`, and the central template directory was deleted. The documented architecture is now the real one. With structure settled, the build visibly pivoted: from "decompose the monolith" to "make this survivable in production" — a cost/caching architecture (spatial cell sharing), a real CI pipeline where there was none, edge hardening, and a source-health monitor. Test suite grew 837 → 1,470 with zero new constraints, which is the tell that the structure caught up to the rules rather than the rules multiplying.

## What Was Built

Framed as structure, not features:

- **The three-layer rule went from aspiration to fact (FR-048, the headline).** DR-001's central caveat — docs describing a per-module data/logic/template structure that wasn't on disk — is resolved. Every module now physically contains all three files; business-rule functions were moved (not rewritten) out of the shared layer and the orchestrator into each module's own `logic.js`, and `src/templates/chapters/` was deleted in favor of co-located `template.js`. This also answers DR-001's open "centralized vs. per-module ownership" question: the project chose **per-module logic**, reserving the shared kernel (`validate.js`) only for genuinely cross-cutting coherence (rural classification, cross-state filtering, drive-time sanity, banding). Logic that belongs to one context now lives in that context.

- **A cost/scaling architecture, not just a cache (FR-058 / NR-003 Phase 1).** Location caches are now keyed by an **H3 spatial cell** instead of exact coordinates, so neighboring addresses share one upstream fetch, and lifestyle drive times are computed once from the cell centroid and carried as an honest integer **band rung** (anti-false-precision, not a score). The discipline here is the notable part: the safety tier (ER / urgent care) is deliberately *carved out* — its selection is cell-shared to save cost, but the displayed drive time and the cross-state determination are recomputed **per exact address**, never banded, never shared (a same-cell neighbor across a state line gets the right answer). This is the first real lever on cost-per-report at B2B volume. First runtime dependency added: `h3-js`.

- **The depth system reached full coverage (FR-049–FR-057).** The four-density progressive-disclosure renderer that DR-001 had proven only on climate and garden is now built out across every chapter. It held: presentation density lives entirely in `template.js` and never leaked back into data or logic — the layering survived contact with all 14 chapters.

- **Four new data domains + a resilience pattern (FR-032/033/059/060/061).** Utilities & Power, a driving-cost calculator (built as a tested engine with a parity-tested client mirror), seismic risk, and internet-as-utility. More structurally interesting is **FR-060's primary→fallback→graceful-link pattern** (electric: NREL → keyless HIFLD → PUC link; EV: NREL → OpenChargeMap → AFDC link), each result self-describing its `source`. This is the template for hardening every single-source dependency.

- **Production hardening became a first-class track (NR-004 → FR-064).** A blunt self-commissioned architecture review (NR-004) named the project honestly: a Tier-2 single-instance monolith carrying Tier-3/4 *discipline*. Stage 0 shipped the cheap, high-ROI half: a **CI pipeline where there was none** (tests now run on every push/PR, Node 20 + 22), fail-loud startup config validation, authentication on all admin mutation endpoints, and `helmet` + inbound rate limiting so a public endpoint can't become an unbounded metered-API bill.

- **An observability down-payment (FR-063).** A source-verification harness: every module self-describes its external sources via an exported descriptor, and a scheduled monitor probes all of them against the five test addresses, surfacing dead upstreams that the graceful-degradation rule otherwise hides behind silent `null`s. It exists because a real outage (a retired FCC API returning 405) hid behind a fallback for weeks.

## Architectural Health

| Area | Status | Notes |
|------|--------|-------|
| Module coverage | ● Done | 16 bounded modules (was 13 at DR-001); the monolith orchestrator is a thin parallel-fetch coordinator. |
| Three-layer rule (data/logic/template) | ● Done | **Resolved since DR-001 (was Partial).** Every module has co-located data/logic/template; `src/templates/chapters/` deleted. Docs and disk now agree. |
| Test suite | ● Done | 1,470 tests / 77 suites (was 837 / 57). Static-analysis structure guards, a source-descriptor contract test, and the Jeffersonville IN border-city regression all included. |
| Shared validation layer | ● Done | `validate.js` is leaner post-FR-048 — module-specific logic moved out; it now holds only true cross-module coherence (rural, cross-state, drive-time, banding). The god-object risk DR-001 flagged receded. |
| Known technical debt | ● Amber | DR-001's items *paid down* (3-layer gap closed, dormant rural-mode wired). New labeled debt: single-instance state ceiling (deferred), CSP `unsafe-inline` (templates emit inline scripts), IP-restricted Google key blocks the CI monitor from geocoding. |
| Constraint count | ● Active | 16 constraints; **+0 since DR-001.** Structure caught up to existing rules rather than new rules accumulating. |

The genuinely solid story: the architecture DR-001 described as aspirational is now real, the test suite nearly doubled without inflating the rule count, and the project crossed a real threshold — from "is the code well-organized" to "can this run in production" (there was *no CI* six weeks ago). The honest weakness is singular and well-understood: **state still lives on local disk and in process memory** (`.cache/`, a reports JSON file, an in-memory usage log), so a second instance cannot run behind a load balancer without cache-coherence loss. This is a hard single-instance ceiling, deliberately deferred (see questions) rather than overlooked.

**Recent PMs:** none new since DR-001 (PM-001–004 still the canon). Notably, the bug class that *would* have become PM-005 — a source silently dead behind a fallback — was instead addressed structurally by FR-063 before it recurred.

## How the Build Is Being Directed

Context for Denny: the owner (Nathan) is non-technical and directs an AI coding agent with product intent and constraints rather than writing code — so this assesses the human-AI loop, not one engineer.

**The directional pattern that matters most this window: commissioning adversarial architecture reviews.** Three times (NR-002 cost forecast, NR-003 spatial cost architecture, NR-004 hardening) Nathan deliberately pointed the AI at its *own* codebase and asked for a blunt, no-spin critique, then turned the findings into sequenced work. NR-004 is the clearest example — it produced the "Tier-2 substrate / Tier-3 discipline" framing and a staged hardening track, and Stage 0 shipped directly from it. Using AI to pressure-test architecture, not just to generate features, is the mature move and it's driving the right sequencing: structure was finished (FR-048) before depth was widened, and hardening was started before scaling features were added.

**Where the AI's interpretation was on target.** The discipline shows up under pressure. FR-058's safety-tier carve-out — keeping ER drive time and cross-state status exact-per-address while cell-sharing everything else — is a subtle correctness call the agent got right, and a high-effort review caught the one place it hadn't (cross-state baked into a cell-shared object; fixed test-first). FR-063's layered review caught a *critical* bug the per-task reviews missed — the monitor's JSON output was being polluted by a startup banner, which would have silently broken its CI alerting on every run — precisely because the final whole-branch review exercised the thing as a subprocess.

**Where it drifted or needed correction — no hedging.** Two honest items, both the same signature as DR-001 (debt is labeled, not silent, but it accumulates). (1) FR-064's hardening accepted a `Content-Security-Policy: unsafe-inline` compromise because the report templates emit and re-execute inline scripts — a real concession that a strict CSP can't be set until those scripts are externalized, and tightening it carelessly will break PDF export and history buttons. (2) The FR-063 monitor was built and shipped before anyone noticed the production Google Maps key is IP-restricted and therefore can't geocode from CI's dynamic runners — so the headline "scheduled monitor" can't actually run end-to-end until a CI-usable key is provisioned. Neither is alarming; both are the standard AI-build pattern of correct-code-ahead-of-operational-reality, caught and documented rather than hidden.

## Open Architectural Questions

**State externalization is now the single gating fork — and it's deliberately deferred.**
NR-004 named it: caches, saved reports, and the usage log all live on local disk / in process memory, which means the system physically cannot scale past one instance without losing cache coherence. The project has chosen to defer the fix (managed Redis + small Postgres behind the existing cache interface) until a B2B contract is actually in sight — explicitly resisting the temptation to build distributed infrastructure speculatively. That's a defensible capital-allocation call for a pre-revenue product, but it means "production-ready" currently has an asterisk: ready for *a* box, not *many*. The interesting question for Denny is whether the seams already marked in code (a `Cache` interface, a `trust proxy` note) are enough that this stays a swap-the-implementation job, or whether single-instance assumptions will have leaked elsewhere by the time the contract arrives.

**Graceful degradation buys UX resilience at the cost of observability — is per-source monitoring the right shape, or a band-aid?**
The project's hard rule is that no chapter ever shows a dead end: a failed API always degrades to a named fallback or actionable link. The cost of that rule is that failures are *invisible* — a swallowed `null` hid a retired FCC API for weeks. FR-063 pays this down with an external monitor that probes each source directly, but that's a parallel observability system bolted alongside the swallowing code, not a property of the code itself. The deferred alternative (NR-004 Stage 2) is a generalized observability layer where every swallowed failure is visible from the inside. The fork: keep extending the external synthetic monitor, or invest in making the degradation self-reporting.

**Is server-side string-concatenation still the right substrate, now that depth × 16 chapters has shipped?**
Carried forward from DR-001, and now with a concrete data point. The whole report is HTML assembled as strings server-side, no component model — and the four-density renderer across every chapter is a *lot* of conditional assembly. The new evidence that this is starting to bite: the CSP compromise above exists *because* templates inline their scripts, which a component/templating engine would naturally externalize. The substrate has been the right call for speed, but it's now the place where two separate pressures (presentation complexity and security hardening) are converging.

## What's Coming

- **FR-062: FCC broadband repair** — designed, build deferred on a single human-in-the-loop blocker (an FCC data-portal API token that requires business registration). Architecturally it's the proof case for the FR-060 resilience pattern: restore a live source behind a fallback that already works, with the token used only at ingest so the runtime stays keyless.
- **NREL per-address rate verification (B-track)** — the one remaining unverified live data path (a network/DNS issue has blocked verifying it from every environment tried). Not new code so much as closing an honesty gap on the Utilities chapter; realistic resolution is at deploy time on a clean network.
- **Hardening Stage 1: externalize state** — the big one above, gated on a B2B contract being in sight. This is the work that turns the single-instance ceiling into horizontal scale, and the seams are already marked for it. Worth flagging to Denny now because it's the largest structural change on the horizon and the one most worth getting a second enterprise opinion on before it starts.
