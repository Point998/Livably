# NR-004 — Architecture Hardening Review: Closing the Tier Gap Before B2B
*Nathan Borders — June 2026*

---

## The Question

NR-001 rebuilt the bones (modules, logic layer, tests). NR-002/003 proved the cost model and engineered the spatial cache that makes B2B margin viable. Those reviews answered *"is the structure right?"* and *"is it affordable at volume?"* — both yes.

This review answers the next one, and it's the uncomfortable one: **if a B2B customer pointed real, concurrent traffic at Livably tomorrow, would the architecture hold?** Not the product. Not the data. The *substrate* — state, deployment, security, operations.

The honest answer is **no, not yet** — and the reasons are specific, finite, and fixable in stages without a teardown.

---

## The Honest Assessment

Livably today is a **Tier-2 single-instance monolith wearing Tier-3/4 engineering discipline.** That gap *is* the finding.

The discipline is real and rare for this stage: enforced 3-layer module boundaries (data/logic/template), a centralized coherence layer (`validate.js`), a numbered-constraint registry, a postmortem culture, 1,384 passing tests, and genuinely clever cost engineering (the H3 cell cache, FR-058). Most funded startups don't have this.

But that governance is bolted onto an infrastructure foundation that **physically cannot run on more than one machine.** The danger isn't sloppiness — it's the opposite. The discipline makes the system *look* more production-ready than the substrate actually is. NR-001 warned about building a sponge that looks impressive and collapses under weight. We fixed the *code* sponge. The **infrastructure** is still partly sponge: it holds beautifully for one user at a desk and has never been asked to bear concurrent load on a second box.

The good news: unlike NR-001, this is **not** a rebuild. It's edge-hardening plus one state-layer swap. The bones are concrete now. This is sealing the foundation before we pour weight on it.

---

## The Diagnosis — Ranked by "What Breaks, and When"

### 🔴 1. State is local disk + process memory → hard single-instance ceiling. *The enterprise blocker.*
Every persistent thing lives on one box: `.cache/*.json` (`src/cache.js`), `data/reports.json` (`src/services/reportStore.js`), the JSONL error logs (`src/logger.js`), and the in-memory `usageLog` array (`src/rateLimit.js:42`). Run a second instance behind a load balancer — the literal definition of "enterprise resilient" — and caches diverge, report IDs minted on box A 404 on box B, and the FR-058 cost savings fragment per-instance. **We cannot horizontally scale today.** Everything else here is a weekend; this is the one real architectural decision.

### 🔴 2. No CI. 1,384 tests that nothing runs automatically.
There is no `.github/workflows`. Our single biggest quality asset runs only when someone remembers `npm test`. This is the **highest-ROI fix in the repo** — ~20 lines of YAML buys regression protection on every push and is what makes any future synthetic monitor (e.g. FR-063) actually *run* instead of being a thing we have to invoke by hand.

### 🟠 3. Inbound endpoints are unhardened, and they spend money.
`rateLimit.js` throttles *outbound* Google calls (good) but there is **no inbound rate limiting, no `helmet`, no input-size guards** on public Express routes. `/report?address=...` triggers a cascade of *metered* Google calls. An unthrottled public endpoint that bills per request is a **cost-DoS** — this is the abuse blast radius NR-003 flagged, still open.

### 🟠 4. Admin mutation endpoints are unauthenticated.
`/admin/health` checks caller IP (`app.js:86-87`). `/admin/api-usage`, `/admin/clear-cache`, and `/admin/cache-stats` (`app.js:98-107`) **do not.** `/admin/clear-cache` is an unauthenticated `POST` that wipes the geocode/places/drivetime caches — i.e. anyone who knows the path can force every subsequent request into a cold, fully-billed Google refetch. Finding #3 with a trigger button.

### 🟠 5. File JSON read-modify-write races under concurrency.
`reportStore.saveReport` (`reportStore.js:24-33`), the logger, and errorMemory all do read-JSON → mutate → write-JSON with no lock. Two concurrent reports = a lost write or a corrupted `reports.json` — and unlike the cache (which self-heals to `null` on a parse failure), a corrupt reports file *throws*. Harmless at one desk; a data-loss bug under real traffic.

### 🟡 6. No startup config validation.
We check `googleMapsApiKey` truthiness *per request* (`app.js:36`), not at boot. A misconfigured deploy starts "successfully," looks healthy, and serves errors to users instead of failing loud at startup. ~15 lines to fix.

### 🟡 7. In-process Puppeteer is a memory/latency bomb.
`/report/pdf` launches a ~300MB headless Chromium *inside the web process* per request (`app.js:132`), gated by a `while (activePDFs >= MAX) await sleep(500)` busy-wait with **no timeout** (`app.js:121-123`) — a request can hang indefinitely. At volume this competes with request-serving for RAM and will OOM the box. PDF belongs in a worker or a managed render service.

### 🟡 8. Vanilla JS at ~12k LOC, passing rich data shapes by convention.
No TypeScript, lint, or typecheck. The orchestrator threads a dozen loosely-typed objects across module boundaries (`reportBuilder.js:95`). A *growing* tax, not an emergency — but several "data is the wrong shape" postmortems are exactly what a type system catches at author time. Stage this; don't rush it.

---

## The Thread Connecting It All: Graceful Degradation Has a Hidden Cost

Our **graceful-degradation doctrine (CONSTRAINT-015)** is a real UX strength — but architecturally it has been **buying user-experience resilience with observability debt.** Every fetcher swallows failure and returns `null`; the orchestrator wraps everything in `Promise.allSettled` + bare `catch {}`. The user never sees a crack — *and neither do we.* The FCC broadband API was dead (HTTP 405) for an unknown stretch behind a silent fallback. That isn't a bug; it's the designed behavior doing exactly what we told it to.

The planned source-verification harness (FR-063 / roadmap A2) is us paying down **one slice** of that debt by hand. The enterprise-grade version of the instinct is not "hand-write a probe per source forever" — it's a real **observability layer** (the structured logs we already emit + error tracking + a synthetic monitor) where every swallowed failure still lights up a dashboard. FR-063 is the right tactical move; it's a down payment on a theme, not the whole fix.

---

## The Decision — Stage, Don't Cargo-Cult

We will **not** dump the full enterprise checklist (Postgres + managed auth + Sentry + multi-tenancy) on a pre-launch product with no users. That's the "precious about architecture" failure. We harden by leverage, in three stages tied to real milestones.

### Stage 0 — Near-zero-cost wins (before any new feature work)
The difference between "prototype" and "safely deployable." ~1 day total.
1. **CI workflow** — run `npm test` on every push/PR. *(Finding #2)*
2. **Startup config validation** — one `config.js` that asserts required env at boot and crashes loud. *(#6)*
3. **Lock down `/admin/*`** — one shared guard on all four routes. *(#4)*
4. **`helmet` + inbound rate limiter** (`express-rate-limit`) on public routes. *(#3)*

Closes every 🟠 except the state layer.

### Stage 1 — Multi-instance capability (before signing a B2B contract)
The real Tier-2 → scalable unlock.
5. **Externalize state** behind the existing `Cache` interface seam — managed Redis (caches) + small Postgres (reports/usage), or object storage + Postgres. Swap implementations, keep callers. *(#1)*
6. **Move PDF generation out-of-process** — worker queue or managed render service. *(#7)*
7. **Atomic writes** fall out of #5 for free. *(#5)*

### Stage 2 — Durability & type safety (incremental, no big-bang)
8. **Observability layer** — keep JSONL logs, add error tracking + real `/health` + `/ready`, fold FR-063 into a scheduled synthetic monitor. Generalizes the doctrine debt above.
9. **TypeScript, file-by-file**, starting at the orchestrator and `validate.js` (highest fan-in/risk). `// @ts-check` + JSDoc is a zero-migration first step.

---

## Success Criteria

This hardening is "done for now" when:
- CI runs the full suite (and the source-verification harness) on every push.
- The app fails loud at startup on misconfiguration, never silently at request time.
- No public endpoint can be turned into an unbounded Google bill; no admin route mutates state without auth.
- A second instance can be launched behind a load balancer with **zero** correctness or cache-coherence loss.
- Every swallowed failure is still visible on a dashboard — graceful for the buyer, loud for us.

## What Stays the Same
The product, the chapters, the data, the design direction, the 3-layer module pattern, the constraint/postmortem discipline, and the FR-058 cost architecture. This review hardens the edges and swaps the state layer. It does not touch what makes Livably Livably.

---

## Relationship to the Roadmap
This review gives teeth and ordering to what `IMPLEMENTATION_ROADMAP.md` Track A already named vaguely as "production hardening." It is captured there as the **Hardening Track (Stage 0/1/2)**. Sequencing note: **Stage 0 lands before FR-063** — CI is what makes the source-verification harness a scheduled monitor rather than a manual one, so the cheap enterprise win comes first and FR-063 slots in behind it as the Stage-2 observability seed.
